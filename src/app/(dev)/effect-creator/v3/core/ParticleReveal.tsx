'use client'
// ParticleReveal — the model's own image BECOMES the particles (no fader, no separate solid copy).
// Ref technique: Maxime Heckel, "The magical world of particles with react-three-fiber and shaders".
//
// One honest representation: the live 3D object is rendered to an FBO, then drawn as a grid of points
// whose colour + alpha are sampled from that render. The SAME points are the model:
//   • at home (cycle ends) the points are large enough to tile → they read as the solid model.
//   • mid-cycle they shrink to fine and are advected by a time-evolving, multi-octave CURL field →
//     a chaotic particle fluid.
// Cycle envelope (one play): solid → disperse → chaotic fluid hold → reassemble → solid. (Product:
// disperse on Magic start, hold while Magic computes, reassemble when the shape is ready.)
// Idle = pure passthrough (the real mesh). Run end snaps back to passthrough so the rest state is the
// crisp mesh. Single shader pass — no GPGPU / FloatType, so it is iOS-Safari-safe and mobile-cheap.
import { useFrame, useThree } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useRevealStore } from '../user/revealStore'

const GRID = 300 // 300² ≈ 90k particles — dense enough to tile into the solid model at home

// Ashima 3D simplex noise (MIT) + curl noise (3 offset potential fields) — the fluid flow field.
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
vec3 hash33(vec3 p){ p=fract(p*vec3(443.897,441.423,437.195)); p+=dot(p,p.yxz+19.19); return fract((p.xxy+p.yxx)*p.zyx); }`

const P_VERT = `
uniform sampler2D uObjectTex; uniform float uProgress,uAspect,uTime,uChaos,uFlowSpeed,uSolidSize,uFluidSize;
varying vec3 vColor; varying float vAlpha;
${NOISE}
void main(){
  vec2 uv = position.xy;                          // grid cell in [0,1] == the object's screen uv
  vec4 tex = texture2D(uObjectTex, uv);
  vColor = tex.rgb;                               // sampled model colour — output 1:1, no distortion
  float inside = step(0.08, tex.a);
  float p = uProgress;
  // envelope e: 0 = solid model, 1 = fully dispersed. Plateau: disperse → hold chaotic → reassemble.
  float e = (p < 0.30) ? smoothstep(0.0, 0.30, p) : (p < 0.70) ? 1.0 : (1.0 - smoothstep(0.70, 1.0, p));
  vec3 rnd = hash33(vec3(uv*7.13, 3.1));
  // time-evolving multi-octave curl → chaotic particle fluid (per-particle phase + magnitude = chaos)
  float t = uTime * uFlowSpeed;
  vec3 f1 = curl(vec3(uv*3.0,  t + rnd.z*6.2831));
  vec3 f2 = curl(vec3(uv*6.3 + 17.0, t*1.7));
  vec2 flow = f1.xy + 0.5*f2.xy;
  vec2 disp = flow * uChaos * (0.45 + rnd.x) * e;
  disp.x /= uAspect;                              // keep the fluid isotropic on a wide viewport
  vec2 ndc = uv*2.0 - 1.0;
  gl_Position = vec4(ndc + disp, 0.0, 1.0);
  gl_PointSize = mix(uSolidSize, uFluidSize, e) * inside; // tile-solid at home, fine in the fluid
  vAlpha = tex.a * inside;
}`

const P_FRAG = `
varying vec3 vColor; varying float vAlpha;
void main(){
  float d = distance(gl_PointCoord, vec2(0.5));
  float s = 1.0 - d*2.0; if (s <= 0.0) discard;
  s = pow(clamp(s,0.0,1.0), 1.3);                 // soft round falloff
  gl_FragColor = vec4(vColor, s*vAlpha);          // exact model colour — no distortion
}`

export default function ParticleReveal() {
  const { gl, scene, camera, size, viewport, invalidate } = useThree()
  const dpr = viewport.dpr
  const fbo = useFBO(Math.max(2, Math.floor(size.width * dpr)), Math.max(2, Math.floor(size.height * dpr)))
  const particleScene = useMemo(() => new THREE.Scene(), [])
  const orthoCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const pMatRef = useRef<THREE.ShaderMaterial | null>(null)

  const runToken = useRevealStore((s) => s.runToken)
  useEffect(() => { if (runToken > 0) invalidate() }, [runToken, invalidate])

  useEffect(() => {
    const ar = size.width / size.height
    const N = GRID
    const arr = new Float32Array(N * N * 3)
    let k = 0
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { arr[k++] = x / (N - 1); arr[k++] = y / (N - 1); arr[k++] = 0 }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    const pMat = new THREE.ShaderMaterial({
      vertexShader: P_VERT, fragmentShader: P_FRAG,
      uniforms: {
        uObjectTex: { value: fbo.texture }, uProgress: { value: 0 }, uAspect: { value: ar }, uTime: { value: 0 },
        uChaos: { value: 0.4 }, uFlowSpeed: { value: 0.5 }, uSolidSize: { value: 5 * dpr }, uFluidSize: { value: 2.2 * dpr },
      },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.NormalBlending, toneMapped: false,
    })
    const pts = new THREE.Points(geo, pMat)
    pts.frustumCulled = false; particleScene.add(pts); pMatRef.current = pMat
    return () => { particleScene.remove(pts); geo.dispose(); pMat.dispose() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleScene])

  useFrame(() => {
    const r = useRevealStore.getState()
    const renderer = gl
    if (!r.active) { renderer.setRenderTarget(null); renderer.render(scene, camera); return }
    const pMat = pMatRef.current
    if (!pMat) { renderer.setRenderTarget(null); renderer.render(scene, camera); return }

    const cfg = r.particle
    const p = Math.min(1, (performance.now() - r.startedAt) / Math.max(1, cfg.durationMs))
    const ar = size.width / size.height

    // run finished → snap to the crisp real mesh and stop (rest state is the true model)
    if (p >= 1) { renderer.setRenderTarget(null); renderer.render(scene, camera); useRevealStore.getState().stop(); return }

    // 1) live model → FBO (transparent clear → alpha = silhouette, rgb = model colour)
    const prevAlpha = renderer.getClearAlpha()
    renderer.setClearAlpha(0)
    renderer.setRenderTarget(fbo); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null)

    // 2) screen: clear transparent, render ONLY the particles (they ARE the model — no fader)
    renderer.clear()
    const pu = pMat.uniforms
    pu.uObjectTex.value = fbo.texture; pu.uProgress.value = p; pu.uAspect.value = ar; pu.uTime.value = performance.now() / 1000
    pu.uChaos.value = cfg.chaos; pu.uFlowSpeed.value = cfg.flowSpeed
    pu.uSolidSize.value = cfg.solidSize * dpr; pu.uFluidSize.value = cfg.fluidSize * dpr
    renderer.autoClear = false
    renderer.render(particleScene, orthoCam)
    renderer.autoClear = true
    renderer.setClearAlpha(prevAlpha)

    invalidate()
  }, 1)

  return null
}
