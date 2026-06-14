'use client'
// ParticleReveal — the model's image IS the particles, one square PIXEL per grid cell (no fader, no
// separate solid copy, no shrink). Ref technique: Maxime Heckel, "The magical world of particles".
//
// pixel = particle: an aspect-correct grid of SQUARE points, each sized to tile its cell exactly, so
// at home they reconstruct the image with NO gaps. The transition is PURELY position — a single
// smooth, coherent flow field drifts the pixels apart and back. No opacity fade, no size change; the
// "dissolve" is the pixels separating, the "reassemble" is them returning. Motion is one low-frequency
// simplex field (not per-particle jitter) → elegant flow, not violent chaos.
// Cycle (one play): solid → pixels drift apart → loose pixel field hold → drift back → solid.
// Idle = passthrough (real mesh); run end snaps to passthrough. Single shader pass — no GPGPU /
// FloatType → iOS-Safari-safe, mobile-cheap. GLSL ES 1.00.
import { useFrame, useThree } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useRevealStore } from '../user/revealStore'

// Ashima 3D simplex noise (MIT) → a smooth vector field for elegant, coherent pixel drift.
const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec2 flow2(vec2 uv, float t){
  // two decorrelated samples → a smooth 2D drift vector. Mid frequency: locally coherent (adjacent
  // pixels move together → no jitter) but different REGIONS drift apart → elegant pixel separation.
  return vec2(snoise(vec3(uv*3.8, t)), snoise(vec3(uv*3.8 + 31.4, t + 11.2)));
}`

const P_VERT = `
uniform sampler2D uObjectTex; uniform float uProgress,uAspect,uTime,uSpread,uFlowSpeed,uPointSize;
varying vec3 vColor; varying float vAlpha;
${NOISE}
void main(){
  vec2 uv = position.xy;                          // grid cell in [0,1] == the object's screen uv
  vec4 tex = texture2D(uObjectTex, uv);
  vColor = tex.rgb;                               // exact pixel colour, output 1:1
  float inside = step(0.08, tex.a);
  // envelope: 0 = solid (tiled), 1 = dispersed. Plateau: drift apart → hold → drift back.
  float p = uProgress;
  float e = (p < 0.30) ? smoothstep(0.0, 0.30, p) : (p < 0.70) ? 1.0 : (1.0 - smoothstep(0.70, 1.0, p));
  e = smoothstep(0.0, 1.0, e);                    // ease for elegance
  // position-only transition (no fade, no shrink): a smooth flow field drifts the pixels apart and
  // back. Locally coherent → elegant, not jittery; regionally divergent → the pixels visibly separate.
  vec2 drift = flow2(uv, uTime * uFlowSpeed) * uSpread * e;
  drift.x /= uAspect;
  vec2 ndc = uv*2.0 - 1.0;
  gl_Position = vec4(ndc + drift, 0.0, 1.0);
  gl_PointSize = uPointSize * inside;            // constant tile size — no shrink, no fade
  vAlpha = tex.a * inside;
}`

const P_FRAG = `
varying vec3 vColor; varying float vAlpha;
void main(){
  gl_FragColor = vec4(vColor, vAlpha);           // SOLID square pixel (gl.POINTS = square) — no fade
}`

export default function ParticleReveal() {
  const { gl, scene, camera, size, viewport, invalidate } = useThree()
  const dpr = viewport.dpr
  const fbo = useFBO(Math.max(2, Math.floor(size.width * dpr)), Math.max(2, Math.floor(size.height * dpr)))
  const particleScene = useMemo(() => new THREE.Scene(), [])
  const orthoCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const pMatRef = useRef<THREE.ShaderMaterial | null>(null)
  const ptsRef = useRef<THREE.Points | null>(null)
  const nxRef = useRef(1) // grid columns → cell size for gap-free tiling

  const runToken = useRevealStore((s) => s.runToken)
  const density = useRevealStore((s) => s.particle.density)
  useEffect(() => { if (runToken > 0) invalidate() }, [runToken, invalidate])

  // material + Points once (placeholder geometry; the density effect builds the real grid)
  useEffect(() => {
    const pMat = new THREE.ShaderMaterial({
      vertexShader: P_VERT, fragmentShader: P_FRAG,
      uniforms: {
        uObjectTex: { value: fbo.texture }, uProgress: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 },
        uSpread: { value: 0.22 }, uFlowSpeed: { value: 0.15 }, uPointSize: { value: 4 },
      },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.NormalBlending, toneMapped: false,
    })
    const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), pMat)
    pts.frustumCulled = false; particleScene.add(pts); pMatRef.current = pMat; ptsRef.current = pts
    return () => { particleScene.remove(pts); pts.geometry.dispose(); pMat.dispose(); ptsRef.current = null; pMatRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleScene])

  // (re)build the aspect-correct SQUARE-pixel grid on density change (geometry swap, no recompile)
  useEffect(() => {
    const pts = ptsRef.current
    if (!pts) return
    const Nx = Math.max(8, Math.floor(density))
    const Ny = Math.max(8, Math.round(Nx * size.height / size.width)) // square cells → square pixels
    nxRef.current = Nx
    const arr = new Float32Array(Nx * Ny * 3)
    let k = 0
    for (let y = 0; y < Ny; y++) for (let x = 0; x < Nx; x++) { arr[k++] = x / (Nx - 1); arr[k++] = y / (Ny - 1); arr[k++] = 0 }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    const old = pts.geometry
    pts.geometry = geo
    if (old) old.dispose()
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, invalidate])

  useFrame(() => {
    const r = useRevealStore.getState()
    const renderer = gl
    if (!r.active) { renderer.setRenderTarget(null); renderer.render(scene, camera); return }
    const pMat = pMatRef.current
    if (!pMat) { renderer.setRenderTarget(null); renderer.render(scene, camera); return }

    const cfg = r.particle
    const p = Math.min(1, (performance.now() - r.startedAt) / Math.max(1, cfg.durationMs))
    const ar = size.width / size.height

    if (p >= 1) { renderer.setRenderTarget(null); renderer.render(scene, camera); useRevealStore.getState().stop(); return }

    // 1) live model → FBO (transparent clear → alpha = silhouette, rgb = model colour)
    const prevAlpha = renderer.getClearAlpha()
    renderer.setClearAlpha(0)
    renderer.setRenderTarget(fbo); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null)

    // 2) screen: clear transparent, render ONLY the square-pixel particles (they ARE the model)
    renderer.clear()
    const cell = (size.width * dpr) / Math.max(1, nxRef.current) // device px per cell → tile size
    const pu = pMat.uniforms
    pu.uObjectTex.value = fbo.texture; pu.uProgress.value = p; pu.uAspect.value = ar; pu.uTime.value = performance.now() / 1000
    pu.uSpread.value = cfg.spread; pu.uFlowSpeed.value = cfg.flowSpeed; pu.uPointSize.value = cell * cfg.pixelSize
    renderer.autoClear = false
    renderer.render(particleScene, orthoCam)
    renderer.autoClear = true
    renderer.setClearAlpha(prevAlpha)

    invalidate()
  }, 1)

  return null
}
