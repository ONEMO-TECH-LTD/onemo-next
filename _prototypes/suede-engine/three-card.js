/* Material card renderer — proven base, stylised to read at card size.
   Base: three.js MeshPhysicalMaterial (sheen, clearcoat, normal/roughness/AO maps) on a flat card,
   lit by a product-photography studio (Dan's GSG HDRIs from KeyShot "DS----", or Poly Haven studio_small_08) plus one key light.
   Suede / Velvet: Dan's KeyShot materials (lux_velvet lobe + noise bump), velvet surface = Dan's fabric pack Fabric_valvet_01.
   Comparison scans: ambientCG Leather039 (fine suede), Poly Haven velour_velvet, leather_red_02 (CC0, 1K).
   Stylisation (Dan, 2 Nov: "make it all stylised so it reads as suede and correct material"):
   before lighting the print is treated per material (soften, lift, punch, fibre detail, nap/crush patches);
   after lighting a fuzz haze and a velvet edge glow are added. Real fibres are sub-pixel at 304 px, so
   detail is taken from the scan and amplified rather than invented.
   One shared renderer paints a card on demand; nothing runs continuously. */
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();

const P = 'public/pbr/';
const SCANS = {
  suede:   { nor: 'acg_suede_Leather039_nor_gl_1k.jpg', rough: 'acg_suede_Leather039_rough_1k.jpg', ao: null, diff: 'acg_suede_Leather039_diff_1k.jpg' },   // ambientCG Leather039: photogrammetry fine suede (CC0)
  velvet:  { nor: 'velour_velvet_nor_gl_1k.jpg',     rough: 'velour_velvet_rough_1k.jpg',     ao: 'velour_velvet_ao_1k.jpg', diff: 'velour_velvet_diff_1k.jpg' },
  velvetTB:{ nor: 'twinbru_black_velvet_normal_1k.jpg', rough: 'twinbru_black_velvet_rough_1k.jpg', ao: null, diff: 'twinbru_black_velvet_diffuse_1k.jpg' },   // Twinbru Plain Black Velvet (manufacturer scan shipped with KeyShot)
  fabVelvet:{ nor: 'fab_velvet_01_normal_1k.jpg', rough: 'fab_velvet_01_roughness_1k.jpg', ao: 'fab_velvet_01_ambientocclusion_1k.jpg', diff: 'fab_velvet_01_basecolor_1k.jpg' },   // Dan's fabric pack (juliosillet Materials_Fabric) Fabric_valvet_01
  leather: { nor: 'leather_red_02_nor_gl_even_1k.png',    rough: 'leather_red_02_rough_1k.jpg',    ao: 'leather_red_02_ao_1k.jpg' },   // even fine pebble grain; normal map high-passed (patches broader than ~20 px removed) so the card reads as one even surface
};
const DETAIL_SRC = { suede: 'suede', velvet: 'velvet', velvetTB: 'velvetTB', fabVelvet: 'fabVelvet', leather: 'suede' };   // leather has no colour map; its grain comes from the normal map

/* Physical base + stylisation, per material.
   soft: print softening · lift: raises the darkest ink · blurPx: dye bleed · punch: + richer / - flatter colour
   detail/detailGain/detailTile: scan fibres over the print · wash/washScale: nap or crush patches
   haze: fuzz veil (after light) · rim: velvet edge glow (after light) */
/* studios: Dan's product-photography HDRIs (GSG, from KeyShot's DS---- environments), downsized to 1024×512 */
export const STUDIOS = { 'Three softboxes': 'GSG_HC008_A064_ThreeSoftboxesStudio1_1k.hdr', 'Softbox': 'GSG_HC008_A047_Softbox_1k.hdr', 'Softbox tent': 'GSG_HC008_A048_SoftboxTent1_1k.hdr',
  'Overhead + strips': 'GSG_HC008_A034_OverheadAndStripesLarge_1k.hdr', 'Two umbrellas': 'GSG_HC008_A069_TwoUmbrellasLarge_1k.hdr', 'Poly Haven studio': 'studio_small_08_1k.hdr' };
export const DEFAULT_STUDIO = 'Three softboxes';
export const MATERIALS = {
  /* Dan's own KeyShot materials ("!!! --- DS"): MOD BACK SUEDE and MOD Velvet Black BRUSHED —
     lux_velvet (roughness .1, backscatter .2, edginess 10) over a noise bump; ks* = that velvet lobe, ksHeights = its noise layers */
  'Suede':        { washSrc: 'suede', ks: 1, ksSheen: .22, ksEdge: 10, ksBack: .5, ksGrain: .35, ksGrainSize: 1.2, ksBump: 0, ksScales: [.5, .06, .0045, .0028], ksHeights: [.05, .08, 1, .4],
                    scan: null, tile: 1, depth: 0, rough: 1, spec: .15, sheen: 0, sheenRough: .8, sheenTint: 0, coat: 0, coatRough: .05, env: 1, key: 1.2, box: 2, expo: 1, ao: 0, envRot: 90,
                    soft: .12, lift: .06, blurPx: .4, punch: 0, detail: 0, detailGain: 3, detailTile: 1, wash: .2, washScale: 3, haze: 0, rim: 0 },
  'Velvet':       { ks: 1, ksSheen: .3, ksEdge: 10, ksBack: .2, ksGrain: .2, ksGrainSize: 1.8, ksBump: .5, ksScales: [.35, .08, .006, .003], ksHeights: [.6, .2, 0, 0],
                    scan: 'fabVelvet', tile: 2, depth: .8, rough: 1, spec: .1, sheen: 1, sheenRough: .35, sheenTint: .8, coat: 0, coatRough: .05, env: 1, key: 1.2, box: 2.5, expo: 1, ao: .5, envRot: 90,
                    soft: 0, lift: .02, blurPx: .3, punch: .12, detail: .35, detailGain: 6, detailTile: 1, wash: .25, washScale: 2, haze: 0, rim: .12 },
  'Suede · scan': { fall: .55, fallPow: 2.5, fallTint: .35, scan: 'suede',   tile: 2, depth: 1.0, rough: 1,   spec: .3, sheen: 1, sheenRough: .8,  sheenTint: .25, coat: 0, coatRough: .05, env: 1,   key: 1.2, box: 2.5, expo: 1,    ao: .4,  envRot: 90,
                    soft: .15, lift: .06, blurPx: .5, punch: 0,   detail: .35, detailGain: 3, detailTile: 1, wash: .4, washScale: 3, haze: .08, rim: 0 },
  'Velvet · scan': { fall: .9, fallPow: 2, fallTint: .8, scan: 'velvet',  tile: 4, depth: .8,  rough: 1,   spec: .2, sheen: 1, sheenRough: .35, sheenTint: 1,   coat: 0, coatRough: .05, env: 1,   key: 1.2, box: 3,   expo: .95,  ao: .4,  envRot: 90,
                    soft: 0,   lift: .02, blurPx: .4, punch: .12, detail: 0,   detailGain: 2.5, detailTile: 1.5, wash: .6, washScale: 2, haze: 0,   rim: .2 },
  'Faux leather': { antiTile: 1, roughMap: 0, scan: 'leather', tile: 3, depth: 1.4, rough: .5,  spec: .8, sheen: 0, sheenRough: .5,  sheenTint: 0,   coat: 0, coatRough: .05, env: .8,  key: 1.1, box: 5,   expo: 1,    ao: 0,   envRot: 90,
                    soft: .05, lift: .03, blurPx: 0,  punch: .04, detail: 0,   detailGain: 4, detailTile: 2,  wash: 0, washScale: 2.5, haze: 0, rim: 0 },
  'UV matte':     { antiTile: 1, roughMap: 0, scan: 'leather', tile: 3, depth: 0,   rough: .6,  spec: .6, sheen: 0, sheenRough: .5,  sheenTint: 0,   coat: 0, coatRough: .05, env: .8,  key: 1,   box: 6,   expo: 1,    ao: 0,   envRot: 90,
                    soft: .04, lift: .05, blurPx: 0,  punch: -.05, detail: 0,  detailGain: 4, detailTile: 2,  wash: 0,   washScale: 2, haze: 0,   rim: 0 },
  'UV gloss':     { antiTile: 1, roughMap: 0, scan: 'leather', tile: 3, depth: 0,   rough: .08, spec: 1,  sheen: 0, sheenRough: .5,  sheenTint: 0,   coat: 0, coatRough: .02, env: 1.2, key: 1,   box: 0,   expo: 1,    ao: 0,   envRot: 270, studio: 'Softbox',
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
  const key = new THREE.PointLight(0xffffff, 1, 0, 2);   // physical fall-off: closer = brighter, tighter hotspot
  scene.add(key);
  const fill = new THREE.AmbientLight(0xffffff, 0);   // ambient fill: lifts the shadow side evenly, no direction
  scene.add(fill);
  /* the softbox: a rectangular area light near the card — a smooth, resolution-free light spot on matte,
     a satin glow on leather, a clean rectangular reflection on gloss */
  const box = new THREE.RectAreaLight(0xffffff, 6, .55, .38);
  scene.add(box);
  const mat = new THREE.MeshPhysicalMaterial();
  const fall = { uFall: { value: 0 }, uFallPow: { value: 3 }, uFallTint: { value: .5 },
    uKs: { value: 0 }, uKsSheen: { value: new THREE.Color(.13, .13, .13) }, uKsEdge: { value: 10 }, uKsBack: { value: .2 }, uKsBump: { value: 0 },
    uKsScales: { value: new THREE.Vector4(.5, .05, .006, .003) }, uKsHeights: { value: new THREE.Vector4(.1, .1, 1., .1) }, uKsL: { value: new THREE.Vector3(0, 0, 1) }, uKsSeed: { value: 3 }, uKsGrain: { value: 0 }, uKsGrainSize: { value: 1.2 }, uAntiTile: { value: 0 }, uRimW: { value: 0 }, uRimAng: { value: 1.2 }, uRimR: { value: 52 / 304 }, uRimSoft: { value: .6 }, uRimHi: { value: .15 }, uRimShade: { value: .25 }, uRimSheen: { value: .3 } };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, fall);
    const noise = `
      vec3 ksm289(vec3 x){return x-floor(x*(1./289.))*289.;} vec2 ksm289(vec2 x){return x-floor(x*(1./289.))*289.;} vec3 ksperm(vec3 x){return ksm289(((x*34.)+1.)*x);}
      float kssn(vec2 v){ const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
        vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx); vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.); vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=ksm289(i);
        vec3 p=ksperm(ksperm(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.)); vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.); m=m*m; m=m*m;
        vec3 x=2.*fract(p*C.www)-1.; vec3 h=abs(x)-.5; vec3 ox=floor(x+.5); vec3 a0=x-ox; m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
        vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw; return 130.*dot(m,g); }
      // rim: xy = outward direction, z = how far into the rim (0 flat face → 1 edge), eased so the curve starts without a seam
      vec3 rimAt(vec2 uv){ if (uRimW <= 0.) return vec3(0.); vec2 q = uv - .5, k = abs(q) - (.5 - uRimR);
        float d = length(max(k, 0.)) + min(max(k.x, k.y), 0.) - uRimR; float t = clamp(1. + d / uRimW, 0., 1.);
        vec2 g = k.x > 0. && k.y > 0. ? normalize(k) : (k.x > k.y ? vec2(1., 0.) : vec2(0., 1.));
        return vec3(g * sign(q), pow(t, 1. + 3. * uRimSoft)); }
      // nap grain at fibre scale (about one card pixel) — sandy, not bumpy
      // simplex (no grid, no sine hash → no line patterns on any GPU), rotated off the pixel axes
      float ksGrainAt(vec2 uv){ vec2 q = mat2(.8, .6, -.6, .8) * uv * 608. / uKsGrainSize;
        return .5 + .5 * (kssn(q) * .65 + kssn(q * .5 + 31.) * .35); }
      // KeyShot-style noise bump: 4 layers; a layer's 'scale' is its feature size as a fraction of the card (68 mm)
      float ksH(vec2 uv){ float h=0.; for(int k=0;k<4;k++){ float f=1./max(uKsScales[k],.001); h+=uKsHeights[k]*smoothstep(260.,140.,f)*kssn(uv*f+uKsSeed*float(k+1)*17.)/f; } return h; }`;
    sh.vertexShader = 'varying vec2 vKsUv;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vKsUv = uv;');
    sh.fragmentShader = 'varying vec2 vKsUv; uniform float uRimW, uRimAng, uRimR, uRimSoft, uRimHi, uRimShade, uRimSheen, uAntiTile, uFall, uFallPow, uFallTint, uKsGrain, uKsGrainSize, uKs, uKsEdge, uKsBack, uKsBump, uKsSeed; uniform vec3 uKsSheen, uKsL; uniform vec4 uKsScales, uKsHeights;\n' + noise + '\n' + sh.fragmentShader
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
       if (uAntiTile > 0.0) {   // anti-tiling: a rotated, rescaled second sample blended in by a soft mask, so no repeat lines up
         vec3 n2 = texture2D( normalMap, mat2(.6, .8, -.8, .6) * vNormalMapUv * 1.37 + vec2(.31, .67) ).xyz * 2.0 - 1.0;
         float w = smoothstep(-.35, .35, kssn(vKsUv * 2.5 + 7.)) * uAntiTile; mapN = normalize(mix(mapN, n2, w)); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
       { vec3 rim = rimAt(vKsUv); if (rim.z > 0.) {   // rounded rim: the outer edge curves down like a real 2–3 mm slab, so light catches/loses it
         float th = rim.z * uRimAng; normal = normalize(normal * cos(th) + vec3(rim.xy, 0.) * sin(th)); } }
       if (uKsBump > 0.0) { vec2 uv = vKsUv; float e = 1. / 608.; float h0 = ksH(uv), hx = ksH(uv + vec2(e, 0.)), hy = ksH(uv + vec2(0., e));
         normal = normalize(normal + vec3(-(hx - h0), -(hy - h0), 0.) / e * uKsBump * .15); }`)
      .replace('#include <opaque_fragment>', `{ vec3 rim = rimAt(vKsUv); if (rim.z > 0.) {   // rim lit on the side facing the light, shaded on the far side
           vec2 lr = normalize((viewMatrix * vec4(uKsL, 0.)).xy + 1e-4); float f = dot(rim.xy, lr);
           outgoingLight += uRimHi * rim.z * max(f, 0.) * (outgoingLight + .2); outgoingLight *= 1. - uRimShade * rim.z * max(-f, 0.); } }
       { if (uKs > 0.0) { vec3 Vv = normalize(vViewPosition); float nv = clamp(dot(normal, Vv), 0., 1.);
           vec3 Lv = normalize((viewMatrix * vec4(uKsL, 0.)).xyz); vec2 tn = normal.xy; float tilt = length(tn);
           float edge = 1. - exp(-tilt * uKsEdge * .8);                                  // edginess: how fast pile tilt turns into sheen
           float toward = tilt > 1e-4 ? dot(tn / tilt, normalize(Lv.xy + 1e-4)) : 0.;     // pile leaning toward the light catches it
           float sheenAmt = edge * (.5 + .5 * toward) + uKsBack * .6;                    // backscatter: the soft milky veil over the whole pile
           sheenAmt *= 1. - rimAt(vKsUv).z * (1. - uRimSheen);   // the pile sheen would otherwise ring the whole rim
           float g = ksGrainAt(vKsUv);
           if (uKsGrain > 0.) { outgoingLight *= 1. + (g - .5) * uKsGrain; sheenAmt *= .4 + g * 1.2; }   // fibre tips catch the sheen
           outgoingLight += uKs * uKsSheen * sheenAmt * (outgoingLight * 1.5 + .25); } }
       #include <opaque_fragment>`)
      .replace('#include <opaque_fragment>',
      `{ vec3 Vv = normalize(vViewPosition); float fo = pow(1.0 - clamp(dot(normal, Vv), 0.0, 1.0), uFallPow);   // piled-fabric fall-off
         vec3 pile = mix(vec3(1.0), diffuseColor.rgb * 1.6 + 0.15, uFallTint);
         outgoingLight = mix(outgoingLight, pile * (outgoingLight + 0.12), clamp(fo * uFall, 0.0, 1.0)); }
       #include <opaque_fragment>`); };
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  scene.add(card);

  const texLoader = new THREE.TextureLoader();
  const tex = (url, srgb) => new Promise(res => texLoader.load(url, t => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy(); res(t); }));
  const scanCache = {}, artCache = {};
  const scan = name => scanCache[name] || (scanCache[name] = Promise.all(['nor', 'rough', 'ao'].map(k => SCANS[name][k] ? tex(P + SCANS[name][k], false) : null))
    .then(([nor, rough, ao]) => { for (const t of [nor, rough, ao]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return { nor, rough, ao }; }));
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
    g.putImageData(d, 0, 0); const c2 = document.createElement('canvas'); c2.width = c2.height = 512; const g2 = c2.getContext('2d');
    g2.filter = 'blur(1.2px)'; g2.drawImage(c, 0, 0); return (greyCache[k] = c2); };   // soft fibres, not speckle
  /* nap / crush patches: the scan's own large-scale variation, blown up and smoothed */
  const washCache = {};
  const wash = async (name, scale, seed = 0) => { const k = name + scale + '|' + seed; if (washCache[k]) return washCache[k];
    const src = await grey(name, 10); const small = document.createElement('canvas'); const n = Math.max(4, Math.round(24 / scale)); small.width = small.height = n;
    const sg = small.getContext('2d'), rnd = i => { const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };
    const pat = sg.createPattern(src, 'repeat');   // seed → where in the scan the patches come from, and their rotation
    pat.setTransform(new DOMMatrix().translate(n / 2, n / 2).rotate(rnd(1) * 360).translate(-rnd(2) * n, -rnd(3) * n).scale(n / 512));
    sg.fillStyle = pat; sg.fillRect(0, 0, n, n); const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
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
    const wsrc = m.washSrc || ds;
    if (wsrc && SCANS[wsrc].diff && m.wash > 0) { g.globalCompositeOperation = 'soft-light'; g.globalAlpha = m.wash; g.drawImage(await wash(wsrc, m.washScale, m.seed), 0, 0); g.globalAlpha = 1; }
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
  const envCache = {};
  const env = name => envCache[name] || (envCache[name] = new HDRLoader().loadAsync(P + (STUDIOS[name] || STUDIOS[DEFAULT_STUDIO])).then(hdr => {
    hdr.mapping = THREE.EquirectangularReflectionMapping; const t = pmrem.fromEquirectangular(hdr).texture; hdr.dispose(); return t; }));

  return {
    canvas: out,
    /* s: per-card settings — material name + t_* overrides; back: render the plain back face */
    async render(artUrl, s, back) {
      const m = { ...MATERIALS[s.mat3] }; for (const k in s) if (k.startsWith('t_')) m[k.slice(2)] = s[k];
      scene.environment = await env(s.studio || m.studio || DEFAULT_STUDIO);   // card's pick, else the material's default studio
      const a = await art(artUrl);
      let h = 0; for (const c of artUrl) h = (h * 31 + c.charCodeAt(0)) % 9973;
      m.seed = h + (m.washSeed ?? 0) * 131 + (back ? 4999 : 0);   // per artwork, per face, per reseed
      const sc = m.scan ? await scan(m.scan) : null;
      const printed = back ? null : await stylisePrint(a, m);
      mat.map = printed;
      mat.color.set(back ? 0x3d3d3d : 0xffffff);
      if (sc) { for (const t of [sc.nor, sc.rough, sc.ao]) if (t) t.repeat.set(m.tile, m.tile);
        mat.normalMap = sc.nor; mat.normalScale.set(m.depth, m.depth); mat.roughnessMap = m.roughMap === 0 ? null : sc.rough; mat.aoMap = m.ao > 0 && sc.ao ? sc.ao : null; mat.aoMapIntensity = m.ao; }
      else { mat.normalMap = null; mat.roughnessMap = null; mat.aoMap = null; }
      mat.roughness = m.rough; mat.metalness = 0; mat.specularIntensity = m.spec;
      mat.sheen = m.sheen; mat.sheenRoughness = m.sheenRough;
      mat.sheenColorMap = (!back && m.sheenTint > 0) ? printed : null;   // velvet: the sheen takes the print's colour
      mat.sheenColor.setScalar(mat.sheenColorMap ? m.sheenTint : 1);
      mat.clearcoat = m.coat; mat.clearcoatRoughness = m.coatRough;
      scene.environmentIntensity = m.env;
      fall.uKs.value = m.ks ?? 0; fall.uKsSheen.value.setScalar(m.ksSheen ?? .13); fall.uKsEdge.value = m.ksEdge ?? 10; fall.uKsBack.value = m.ksBack ?? .2;
      fall.uRimW.value = (s.rimMm ?? 2.5) / 68; fall.uRimAng.value = (s.rimAng ?? 70) * Math.PI / 180;
      fall.uRimSoft.value = s.rimSoft ?? .6; fall.uRimHi.value = s.rimHi ?? .15; fall.uRimShade.value = s.rimShade ?? .25; fall.uRimSheen.value = s.rimSheen ?? .3;
      fall.uAntiTile.value = m.antiTile ?? 0; fall.uKsGrain.value = m.ksGrain ?? 0; fall.uKsGrainSize.value = m.ksGrainSize ?? 1.2; fall.uKsBump.value = m.ksBump ?? 0; if (m.ksHeights) fall.uKsHeights.value.set(...m.ksHeights); if (m.ksScales) fall.uKsScales.value.set(...m.ksScales);
      fall.uFall.value = m.fall ?? 0; fall.uFallPow.value = m.fallPow ?? 3; fall.uFallTint.value = m.fallTint ?? .5;
      mat.needsUpdate = true;
      const az = (s.az ?? 40) * Math.PI / 180, el = (s.el ?? 50) * Math.PI / 180;
      const lx = (s.live && s.liveL) ? s.liveL.x : Math.cos(az) * Math.cos(el), ly = (s.live && s.liveL) ? s.liveL.y : Math.sin(az) * Math.cos(el);
      const dist = s.dist ?? 1.5, dir = new THREE.Vector3(lx, ly, Math.sqrt(Math.max(.05, 1 - lx * lx - ly * ly))).normalize();
      key.position.copy(dir).multiplyScalar(dist);
      fill.intensity = m.amb ?? .6;
      key.intensity = m.key * 2.25; fall.uKsL.value.copy(dir);   // = the old directional brightness at the default distance 1.5
      box.position.copy(dir).multiplyScalar(dist); box.lookAt(0, 0, 0); box.intensity = m.box ?? 0;   // the softbox sits with the lamp, aimed at the card
      scene.environmentRotation.set(-ly * .9, lx * .9 + m.envRot * Math.PI / 180, 0);
      renderer.toneMappingExposure = m.expo;
      renderer.render(scene, camera);
      await stylisePost(m, back);
    },
  };
}
