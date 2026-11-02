/* Material card renderer — proven base, stylised to read at card size.
   Base: three.js MeshPhysicalMaterial (sheen, clearcoat, normal/roughness/AO maps) on a flat card,
   lit by a real photographed studio (Poly Haven studio_small_08, CC0) plus one key light.
   Material scans: Poly Haven scuba_suede, velour_velvet, leather_red_02 (CC0, 1K).
   Stylisation (Dan, 2 Nov: "make it all stylised so it reads as suede and correct material"):
   before lighting the print is treated per material (soften, lift, punch, fibre detail, nap/crush patches);
   after lighting a fuzz haze and a velvet edge glow are added. Real fibres are sub-pixel at 304 px, so
   detail is taken from the scan and amplified rather than invented.
   One shared renderer paints a card on demand; nothing runs continuously. */
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

const P = 'public/pbr/';
const SCANS = {
  suede:   { nor: 'scuba_suede_nor_gl_1k.jpg',       rough: 'scuba_suede_rough_1k.jpg',       ao: 'scuba_suede_ao_1k.jpg',   diff: 'scuba_suede_diff_1k.jpg' },
  velvet:  { nor: 'velour_velvet_nor_gl_1k.jpg',     rough: 'velour_velvet_rough_1k.jpg',     ao: 'velour_velvet_ao_1k.jpg', diff: 'velour_velvet_diff_1k.jpg' },
  leather: { nor: 'leather_red_02_nor_gl_1k.jpg',    rough: 'leather_red_02_rough_1k.jpg',    ao: 'leather_red_02_ao_1k.jpg' },   // even fine pebble grain, no seams or creases
};
const DETAIL_SRC = { suede: 'suede', velvet: 'velvet', leather: 'suede' };   // leather has no colour map; its grain comes from the normal map

/* Physical base + stylisation, per material.
   soft: print softening · lift: raises the darkest ink · blurPx: dye bleed · punch: + richer / - flatter colour
   detail/detailGain/detailTile: scan fibres over the print · wash/washScale: nap or crush patches
   haze: fuzz veil (after light) · rim: velvet edge glow (after light) */
export const MATERIALS = {
  'Suede':        { scan: 'suede',   tile: 3, depth: 1.2, rough: 1,   spec: .3, sheen: 1, sheenRough: .8,  sheenTint: .25, coat: 0, coatRough: .05, env: 1,   key: 1.6, expo: 1,    ao: .5,  envRot: 90,
                    soft: .18, lift: .08, blurPx: .6, punch: 0,   detail: .9, detailGain: 6, detailTile: 1.5, wash: .55, washScale: 3, haze: .14, rim: 0 },
  'Velvet':       { scan: 'velvet',  tile: 4, depth: .9,  rough: 1,   spec: .2, sheen: 1, sheenRough: .35, sheenTint: 1,   coat: 0, coatRough: .05, env: 1,   key: 1.6, expo: .95,  ao: .5,  envRot: 90,
                    soft: 0,   lift: .02, blurPx: .4, punch: .12, detail: .55, detailGain: 5, detailTile: 2,  wash: .75, washScale: 2, haze: .04, rim: .35 },
  'Faux leather': { scan: 'leather', tile: 3, depth: 1.1, rough: .55, spec: .8, sheen: 0, sheenRough: .5,  sheenTint: 0,   coat: 0, coatRough: .05, env: 1,   key: 1.5, expo: 1,    ao: 0, envRot: 90,
                    soft: .05, lift: .03, blurPx: 0,  punch: .04, detail: 0,   detailGain: 4, detailTile: 2,  wash: 0, washScale: 2.5, haze: 0, rim: 0 },
  'UV matte':     { scan: null,      tile: 1, depth: 0,   rough: .7,  spec: .4, sheen: 0, sheenRough: .5,  sheenTint: 0,   coat: 0, coatRough: .05, env: 1,   key: 1.2, expo: 1,    ao: 0,   envRot: 90,
                    soft: .04, lift: .05, blurPx: 0,  punch: -.05, detail: 0,  detailGain: 4, detailTile: 2,  wash: 0,   washScale: 2, haze: 0,   rim: 0 },
  'UV gloss':     { scan: null,      tile: 1, depth: 0,   rough: .3,  spec: .5, sheen: 0, sheenRough: .5,  sheenTint: 0,   coat: 1, coatRough: .03, env: 1.3, key: 1.3, expo: 1,    ao: 0,   envRot: 90,
                    soft: 0,   lift: 0,   blurPx: 0,  punch: .14, detail: 0,   detailGain: 4, detailTile: 2,  wash: 0,   washScale: 2, haze: 0,   rim: 0 },
};

export function createThreeCard(size) {
  const glCanvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const out = document.createElement('canvas'); out.width = out.height = size; const og = out.getContext('2d');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(30, 1, .01, 10);
  camera.position.set(0, 0, 1 / (2 * Math.tan(15 * Math.PI / 180)));   // the card exactly fills the frame
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  scene.add(key);
  const mat = new THREE.MeshPhysicalMaterial();
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  scene.add(card);

  const texLoader = new THREE.TextureLoader();
  const tex = (url, srgb) => new Promise(res => texLoader.load(url, t => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy(); res(t); }));
  const scanCache = {}, artCache = {};
  const scan = name => scanCache[name] || (scanCache[name] = Promise.all(['nor', 'rough', 'ao'].map(k => tex(P + SCANS[name][k], false)))
    .then(([nor, rough, ao]) => { for (const t of [nor, rough, ao]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return { nor, rough, ao }; }));
  const art = url => artCache[url] || (artCache[url] = tex(url, true));
  const img = url => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = url; });

  /* scan colour map → neutral grey detail (mean 50% grey), contrast multiplied by `gain` */
  const lumCache = {};
  const lum = name => lumCache[name] || (lumCache[name] = img(P + SCANS[name].diff).then(im => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 512, 512);
    const px = g.getImageData(0, 0, 512, 512).data; const L = new Float32Array(512 * 512); let sum = 0;
    for (let i = 0; i < L.length; i++) { L[i] = .299 * px[i * 4] + .587 * px[i * 4 + 1] + .114 * px[i * 4 + 2]; sum += L[i]; }
    const mean = sum / L.length; for (let i = 0; i < L.length; i++) L[i] -= mean; return L; }));
  const greyCache = {};
  const grey = async (name, gain) => { const k = name + gain; if (greyCache[k]) return greyCache[k];
    const L = await lum(name); const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    const d = g.createImageData(512, 512); for (let i = 0; i < L.length; i++) { const v = Math.max(0, Math.min(255, 128 + L[i] * gain)); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
    g.putImageData(d, 0, 0); return (greyCache[k] = c); };
  /* nap / crush patches: the scan's own large-scale variation, blown up and smoothed */
  const washCache = {};
  const wash = async (name, scale) => { const k = name + scale; if (washCache[k]) return washCache[k];
    const src = await grey(name, 10); const small = document.createElement('canvas'); const n = Math.max(4, Math.round(24 / scale)); small.width = small.height = n;
    small.getContext('2d').drawImage(src, 0, 0, n, n); const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.filter = `blur(${size / n * .6}px) contrast(2.2)`; g.drawImage(small, -size * .1, -size * .1, size * 1.2, size * 1.2); return (washCache[k] = c); };

  const composed = new THREE.CanvasTexture(document.createElement('canvas')); composed.colorSpace = THREE.SRGBColorSpace;
  async function stylisePrint(a, m) {
    const cv = composed.image; cv.width = cv.height = size; const g = cv.getContext('2d');
    const sat = 1 - m.soft + m.punch, con = 1 - m.soft * .35 + m.punch * .6;
    g.filter = `saturate(${sat}) contrast(${con}) blur(${m.blurPx}px)`; g.drawImage(a.image, 0, 0, size, size); g.filter = 'none';
    if (m.lift > 0) { g.globalCompositeOperation = 'screen'; g.fillStyle = `rgb(${m.lift * 255},${m.lift * 255},${m.lift * 255})`; g.fillRect(0, 0, size, size); }
    const ds = DETAIL_SRC[m.scan];
    if (ds && SCANS[ds].diff && m.detail > 0) { const pat = g.createPattern(await grey(ds, m.detailGain), 'repeat'); pat.setTransform(new DOMMatrix().scale(size / 512 / m.detailTile));
      g.globalCompositeOperation = 'overlay'; g.globalAlpha = m.detail; g.fillStyle = pat; g.fillRect(0, 0, size, size); g.globalAlpha = 1; }
    if (ds && SCANS[ds].diff && m.wash > 0) { g.globalCompositeOperation = 'soft-light'; g.globalAlpha = m.wash; g.drawImage(await wash(ds, m.washScale), 0, 0); g.globalAlpha = 1; }
    g.globalCompositeOperation = 'source-over'; composed.needsUpdate = true; return composed; }

  async function stylisePost(m, back) {   // after lighting: fuzz veil and velvet edge glow
    og.globalCompositeOperation = 'source-over'; og.globalAlpha = 1; og.drawImage(glCanvas, 0, 0);
    const ds = DETAIL_SRC[m.scan];
    if (m.haze > 0 && ds && SCANS[ds].diff) { const pat = og.createPattern(await grey(ds, 5), 'repeat'); pat.setTransform(new DOMMatrix().scale(size / 512 / 2));
      og.globalCompositeOperation = 'screen'; og.globalAlpha = m.haze * 1.6; og.fillStyle = pat; og.fillRect(0, 0, size, size); }   // screen lifts darks most: the fuzz veil
    if (m.rim > 0 && !back) { const avg = averageColour(); const rg = og.createRadialGradient(size * .5, size * .5, size * .25, size * .5, size * .5, size * .78);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, `rgba(${avg},${m.rim})`); og.globalCompositeOperation = 'screen'; og.globalAlpha = 1; og.fillStyle = rg; og.fillRect(0, 0, size, size); }
    og.globalCompositeOperation = 'source-over'; og.globalAlpha = 1; }
  const tiny = document.createElement('canvas'); tiny.width = tiny.height = 1;
  function averageColour() { const t = tiny.getContext('2d', { willReadFrequently: true }); t.drawImage(composed.image, 0, 0, 1, 1); const d = t.getImageData(0, 0, 1, 1).data;
    const k = 255 / Math.max(d[0], d[1], d[2], 1) * .9; const mix = c => Math.round(c * k * .5 + 200 * .5); return `${mix(d[0])},${mix(d[1])},${mix(d[2])}`; }   // the print's hue, brightened and half toward a neutral pile white

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envReady = new HDRLoader().loadAsync(P + 'studio_small_08_1k.hdr').then(hdr => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture; hdr.dispose(); });

  return {
    canvas: out,
    /* s: per-card settings — material name + t_* overrides; back: render the plain back face */
    async render(artUrl, s, back) {
      await envReady;
      const m = { ...MATERIALS[s.mat3] }; for (const k in m) if (s['t_' + k] !== undefined) m[k] = s['t_' + k];
      const a = await art(artUrl);
      const sc = m.scan ? await scan(m.scan) : null;
      const printed = back ? null : await stylisePrint(a, m);
      mat.map = printed;
      mat.color.set(back ? 0x3d3d3d : 0xffffff);
      if (sc) { for (const t of [sc.nor, sc.rough, sc.ao]) t.repeat.set(m.tile, m.tile);
        mat.normalMap = sc.nor; mat.normalScale.set(m.depth, m.depth); mat.roughnessMap = sc.rough; mat.aoMap = m.ao > 0 ? sc.ao : null; mat.aoMapIntensity = m.ao; }
      else { mat.normalMap = null; mat.roughnessMap = null; mat.aoMap = null; }
      mat.roughness = m.rough; mat.metalness = 0; mat.specularIntensity = m.spec;
      mat.sheen = m.sheen; mat.sheenRoughness = m.sheenRough;
      mat.sheenColorMap = (!back && m.sheenTint > 0) ? printed : null;   // velvet: the sheen takes the print's colour
      mat.sheenColor.setScalar(mat.sheenColorMap ? m.sheenTint : 1);
      mat.clearcoat = m.coat; mat.clearcoatRoughness = m.coatRough;
      scene.environmentIntensity = m.env;
      mat.needsUpdate = true;
      const az = (s.az ?? 40) * Math.PI / 180, el = (s.el ?? 50) * Math.PI / 180;
      const lx = (s.live && s.liveL) ? s.liveL.x : Math.cos(az) * Math.cos(el), ly = (s.live && s.liveL) ? s.liveL.y : Math.sin(az) * Math.cos(el);
      key.position.set(lx, ly, Math.sqrt(Math.max(.05, 1 - lx * lx - ly * ly)));
      key.intensity = m.key;
      scene.environmentRotation.set(-ly * .9, lx * .9 + m.envRot * Math.PI / 180, 0);
      renderer.toneMappingExposure = m.expo;
      renderer.render(scene, camera);
      await stylisePost(m, back);
    },
  };
}
