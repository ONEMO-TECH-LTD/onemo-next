'use client'
// ParticleReveal — the model's image IS the particles, one square PIXEL per grid cell (no fader, no
// shrink, no fade). Ref technique: Maxime Heckel, "The magical world of particles".
//
// pixel = particle: an aspect-correct grid of SQUARE points, each sized to tile its cell, so at home
// the image is reconstructed gap-free. The transition is PURELY position: each pixel disperses (gaps
// open), then reassembles. A library of MOTION PATTERNS (scatter/explode/swirl/fluid/wave/fall) sets
// HOW they move; intensity sets HOW FAR. The dispersion amount `uE` is driven from JS so the same
// engine serves both the test cycle AND the Magic transition:
//   • cycle  (test button) — solid → disperse → hold → reassemble, on a timer.
//   • out→hold→in (Magic)  — disperse when Magic is pressed, hold (sampling the live scene) while it
//     computes, then reassemble into the NEW magic shape the instant it lands. The content swap
//     happens at full dispersal, so it's hidden.
// Idle = passthrough (real mesh). Single shader pass — no GPGPU/FloatType → iOS-safe, mobile-cheap.
import { useFrame, useThree } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useRevealStore, type MotionPattern } from '../user/revealStore'

const PATTERN_ID: Record<MotionPattern, number> = { scatter: 0, explode: 1, swirl: 2, fluid: 3, wave: 4, fall: 5 }
const ease = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c) }

// Ashima 3D simplex noise (MIT) + curl (for the fluid pattern) + hashes.
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
vec3 snoiseVec3(vec3 x){return vec3(snoise(x),snoise(vec3(x.y-19.1,x.z+33.4,x.x+47.2)),snoise(vec3(x.z+74.2,x.x-124.5,x.y+99.4)));}
vec3 curl(vec3 p){
  const float e=0.1; vec3 dx=vec3(e,0.0,0.0),dy=vec3(0.0,e,0.0),dz=vec3(0.0,0.0,e);
  vec3 px0=snoiseVec3(p-dx),px1=snoiseVec3(p+dx);
  vec3 py0=snoiseVec3(p-dy),py1=snoiseVec3(p+dy);
  vec3 pz0=snoiseVec3(p-dz),pz1=snoiseVec3(p+dz);
  float x=(py1.z-py0.z)-(pz1.y-pz0.y);
  float y=(pz1.x-pz0.x)-(px1.z-px0.z);
  float z=(px1.y-px0.y)-(py1.x-py0.x);
  return normalize(vec3(x,y,z)/(2.0*e)+1e-6);
}
vec2 flow2(vec2 uv,float t){ return vec2(snoise(vec3(uv*2.0,t)),snoise(vec3(uv*2.0+31.4,t+11.2))); }
vec3 hash33(vec3 p){ p=fract(p*vec3(443.897,441.423,437.195)); p+=dot(p,p.yxz+19.19); return fract((p.xxy+p.yxx)*p.zyx); }`

// the motion-pattern library: each returns a per-pixel displacement direction (pre-intensity)
const MOTION = `
vec2 motionVec(vec2 uv, vec2 c, float t, float pat, vec3 h){
  if (pat < 0.5){ float a=h.x*6.2831853; return vec2(cos(a),sin(a))*(0.35+0.65*h.y); }   // scatter: own dir
  else if (pat < 1.5){ return normalize(c+vec2(1e-4))*(0.45+1.3*length(c)); }             // explode: radial out
  else if (pat < 2.5){ return vec2(-c.y,c.x)*(1.5+0.8*h.x); }                             // swirl: tangential twist
  else if (pat < 3.5){ return curl(vec3(uv*3.0,t)).xy*1.3; }                              // fluid: curl turbulence
  else if (pat < 4.5){ return vec2(0.18*(h.x-0.5), sin(uv.x*14.0+t*4.0)*0.9); }           // wave: sine sweep
  else { return vec2((h.x-0.5)*0.6,-1.0)*(0.6+0.8*h.y); }                                 // fall: gravity down
}`

const P_VERT = `
uniform sampler2D uObjectTex; uniform float uE,uAspect,uTime,uIntensity,uSpeed,uPattern,uPointSize;
varying vec3 vColor; varying float vAlpha;
${NOISE}
${MOTION}
void main(){
  vec2 uv = position.xy;                          // grid cell in [0,1] == the object's screen uv
  vec4 tex = texture2D(uObjectTex, uv);
  vColor = tex.rgb;                               // exact pixel colour, output 1:1
  float inside = step(0.08, tex.a);
  vec3 h = hash33(vec3(uv * 127.3, 7.3));
  vec2 c = uv - 0.5;
  float t = uTime * uSpeed;
  vec2 mv = motionVec(uv, c, t, uPattern, h);     // pattern direction
  vec2 sway = flow2(uv, t) * 0.5;                  // gentle organic life
  vec2 drift = (mv + sway) * uIntensity * uE;      // position only — disperse (gaps) & reassemble
  drift.x /= uAspect;
  vec2 ndc = uv*2.0 - 1.0;
  gl_Position = vec4(ndc + drift, 0.0, 1.0);
  gl_PointSize = uPointSize * inside;             // constant tile size — no shrink, no fade
  vAlpha = tex.a * inside;
}`

const P_FRAG = `
varying vec3 vColor; varying float vAlpha;
void main(){ gl_FragColor = vec4(vColor, vAlpha); }   // SOLID square pixel — no fade`

export default function ParticleReveal() {
  const { gl, scene, camera, size, viewport, invalidate } = useThree()
  const dpr = viewport.dpr
  const fbo = useFBO(Math.max(2, Math.floor(size.width * dpr)), Math.max(2, Math.floor(size.height * dpr)))
  const particleScene = useMemo(() => new THREE.Scene(), [])
  const orthoCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const pMatRef = useRef<THREE.ShaderMaterial | null>(null)
  const ptsRef = useRef<THREE.Points | null>(null)
  const nxRef = useRef(1)
  const lastERef = useRef(0)        // last dispersion amount (for a smooth handoff into reassemble)
  const inStartERef = useRef(1)     // e at the moment reassemble began
  const lastPhaseRef = useRef('cycle')

  const runToken = useRevealStore((s) => s.runToken)
  const density = useRevealStore((s) => s.particle.density)
  useEffect(() => { if (runToken > 0) invalidate() }, [runToken, invalidate])

  useEffect(() => {
    const pMat = new THREE.ShaderMaterial({
      vertexShader: P_VERT, fragmentShader: P_FRAG,
      uniforms: {
        uObjectTex: { value: fbo.texture }, uE: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 },
        uIntensity: { value: 0.3 }, uSpeed: { value: 0.4 }, uPattern: { value: 0 }, uPointSize: { value: 4 },
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
    const Ny = Math.max(8, Math.round(Nx * size.height / size.width))
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
    const passthrough = () => { renderer.setRenderTarget(null); renderer.render(scene, camera) }
    if (!r.active) { passthrough(); return }
    const pMat = pMatRef.current
    if (!pMat) { passthrough(); return }

    const cfg = r.particle
    const now = performance.now()
    const elapsed = now - r.startedAt
    const dur = Math.max(1, cfg.durationMs)

    // dispersion amount e per phase (JS-driven so one engine serves test cycle + Magic)
    let e = 0
    if (r.phase === 'in') {
      if (lastPhaseRef.current !== 'in') inStartERef.current = lastERef.current // smooth handoff
      const p = Math.min(1, elapsed / (dur * 0.30))
      e = inStartERef.current * (1 - ease(p))
      if (p >= 1) { lastPhaseRef.current = 'cycle'; passthrough(); useRevealStore.getState().stop(); return }
    } else if (r.phase === 'out') {
      e = ease(Math.min(1, elapsed / (dur * 0.22))) // ramp to 1, then HOLD (waits for magicFinish)
    } else { // cycle (test button)
      const p = Math.min(1, elapsed / dur)
      if (p >= 1) { lastPhaseRef.current = 'cycle'; passthrough(); useRevealStore.getState().stop(); return }
      const raw = p < 0.34 ? p / 0.34 : p < 0.66 ? 1 : 1 - (p - 0.66) / 0.34
      e = ease(raw)
    }
    lastERef.current = e
    lastPhaseRef.current = r.phase

    const ar = size.width / size.height
    // 1) live model → FBO (transparent clear → alpha = silhouette, rgb = model colour)
    const prevAlpha = renderer.getClearAlpha()
    renderer.setClearAlpha(0)
    renderer.setRenderTarget(fbo); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null)

    // 2) screen: clear transparent, render ONLY the square-pixel particles (they ARE the model)
    renderer.clear()
    const cell = (size.width * dpr) / Math.max(1, nxRef.current)
    const pu = pMat.uniforms
    pu.uObjectTex.value = fbo.texture; pu.uE.value = e; pu.uAspect.value = ar; pu.uTime.value = now / 1000
    pu.uIntensity.value = cfg.intensity; pu.uSpeed.value = cfg.motionSpeed
    pu.uPattern.value = PATTERN_ID[cfg.pattern] ?? 0; pu.uPointSize.value = cell * cfg.pixelSize
    renderer.autoClear = false
    renderer.render(particleScene, orthoCam)
    renderer.autoClear = true
    renderer.setClearAlpha(prevAlpha)

    invalidate()
  }, 1)

  return null
}
