/* Proven-material card renderer.
   three.js MeshPhysicalMaterial (sheen, clearcoat, normal/roughness/AO maps) on a flat card,
   lit by a real photographed studio (Poly Haven studio_small_08, CC0) plus one key light.
   Material scans: Poly Haven scuba_suede, velour_velvet, fabric_leather_01 (CC0, 1K).
   One shared renderer paints a card on demand; nothing runs continuously. */
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

const P = 'public/pbr/';
const SCANS = {
  suede:   { nor: 'scuba_suede_nor_gl_1k.jpg',       rough: 'scuba_suede_rough_1k.jpg',       ao: 'scuba_suede_ao_1k.jpg' },
  velvet:  { nor: 'velour_velvet_nor_gl_1k.jpg',     rough: 'velour_velvet_rough_1k.jpg',     ao: 'velour_velvet_ao_1k.jpg' },
  leather: { nor: 'fabric_leather_01_nor_gl_1k.jpg', rough: 'fabric_leather_01_rough_1k.jpg', ao: 'fabric_leather_01_ao_1k.jpg' },
};

/* The five materials, as three.js material settings. Values are the physical parameters, not looks
   faked on top: sheen for fabrics, clear coat for the gloss print. */
export const MATERIALS = {
  'Suede':        { scan: 'suede',   tile: 4, depth: 1.2, rough: 1,   sheen: 1, sheenRough: .8,  sheenTint: .25, coat: 0, coatRough: .05, spec: .3, env: 1,   key: 1.6, expo: 1, ao: .6, envRot: 90, tilt: 0 },
  'Velvet':       { scan: 'velvet',  tile: 4, depth: .9,  rough: 1,   sheen: 1, sheenRough: .35, sheenTint: 1,   coat: 0, coatRough: .05, spec: .2, env: 1,   key: 1.6, expo: 1, ao: .6, envRot: 90, tilt: 0 },
  'Faux leather': { scan: 'leather', tile: 2, depth: .8,  rough: .9,  sheen: 0, sheenRough: .5,  sheenTint: 0,   coat: 0, coatRough: .05, spec: .7, env: 1,   key: 1.4, expo: 1, ao: 0,  envRot: 90, tilt: 0 },
  'UV matte':     { scan: null,      tile: 1, depth: 0,   rough: .65, sheen: 0, sheenRough: .5,  sheenTint: 0,   coat: 0, coatRough: .05, spec: .5, env: 1,   key: 1.2, expo: 1, ao: 0,  envRot: 90, tilt: 0 },
  'UV gloss':     { scan: null,      tile: 1, depth: 0,   rough: .35, sheen: 0, sheenRough: .5,  sheenTint: 0,   coat: 1, coatRough: .04, spec: .5, env: 1.2, key: 1.2, expo: 1, ao: 0,  envRot: 90, tilt: 0 },
};

export function createThreeCard(size) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

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

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envReady = new HDRLoader().loadAsync(P + 'studio_small_08_1k.hdr').then(hdr => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture; hdr.dispose(); });

  return {
    canvas,
    /* s: per-card settings — material name + overrides; back: render the plain back face */
    async render(artUrl, s, back) {
      await envReady;
      const m = { ...MATERIALS[s.mat3] }; for (const k in m) if (s['t_' + k] !== undefined) m[k] = s['t_' + k];
      const a = await art(artUrl);
      const sc = m.scan ? await scan(m.scan) : null;
      // base colour: the artwork (or the suede back)
      mat.map = back ? null : a;
      mat.color.set(back ? 0x3d3d3d : 0xffffff);
      // surface from the scan, repeated finer by `tile`
      if (sc) { for (const t of [sc.nor, sc.rough, sc.ao]) t.repeat.set(m.tile, m.tile);
        mat.normalMap = sc.nor; mat.normalScale.set(m.depth, m.depth); mat.roughnessMap = sc.rough; mat.aoMap = m.ao > 0 ? sc.ao : null; mat.aoMapIntensity = m.ao; }
      else { mat.normalMap = null; mat.roughnessMap = null; mat.aoMap = null; }
      mat.roughness = m.rough; mat.metalness = 0; mat.specularIntensity = m.spec;
      mat.sheen = m.sheen; mat.sheenRoughness = m.sheenRough;
      mat.sheenColor.setRGB(1, 1, 1); mat.sheenColorMap = (!back && m.sheenTint > 0) ? a : null;   // velvet: the sheen takes the print's colour
      if (mat.sheenColorMap) mat.sheenColor.setScalar(m.sheenTint); else mat.sheenColor.setScalar(1);
      mat.clearcoat = m.coat; mat.clearcoatRoughness = m.coatRough;
      scene.environmentIntensity = m.env;   // envMapIntensity only affects material.envMap, not scene.environment
      mat.needsUpdate = true;
      // light: key light from the card's angle/height; the studio turns with it
      const az = (s.az ?? 40) * Math.PI / 180, el = (s.el ?? 50) * Math.PI / 180;
      const lx = (s.live && s.liveL) ? s.liveL.x : Math.cos(az) * Math.cos(el), ly = (s.live && s.liveL) ? s.liveL.y : Math.sin(az) * Math.cos(el);
      key.position.set(lx, ly, Math.sqrt(Math.max(.05, 1 - lx * lx - ly * ly)));
      key.intensity = m.key;
      scene.environmentRotation.set(-ly * .9, lx * .9 + m.envRot * Math.PI / 180, 0);
      card.rotation.set(m.tilt * Math.PI / 180 * (s.live && s.liveL ? -s.liveL.y : .6), m.tilt * Math.PI / 180 * (s.live && s.liveL ? s.liveL.x : -.8), 0);   // a slight turn shows the material, like a product shot
      renderer.toneMappingExposure = m.expo;
      renderer.render(scene, camera);
    },
  };
}
