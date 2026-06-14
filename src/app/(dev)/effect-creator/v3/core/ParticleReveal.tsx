'use client'
// ParticleReveal — the "magical particles" effect (ref technique: Maxime Heckel, "The magical world
// of particles with react-three-fiber and shaders" — GPU points + curl noise). Applied to OUR object:
// the live 3D object is rendered to an FBO, then represented as a cloud of soft particles (one per
// grid cell, colour + alpha sampled from the object's own render). Pressing play makes the object
// DISPERSE into a curl-noise particle cloud and REASSEMBLE into the shape — a real volumetric effect
// on the object (this is the Magic-completion transition: disperse → reassemble into the magic shape).
// Idle = pure passthrough (zero behaviour change).
//
// Look notes: the product UI is LIGHT, so additive "glow" (Heckel's dark-bg trick) washes out — we
// use soft colour particles (normal blend) tinted by the real artwork. The solid object fades as the
// cloud takes over (envelope sin(πp): 0→peak→0), so at rest it's the clean object, mid-run it's the
// cloud, and it returns. Single shader pass (displacement in the vertex shader) — no GPGPU ping-pong,
// which keeps it mobile-cheap. GLSL ES 1.00 (default ShaderMaterial) → vertex texture fetch is fine.
import { useFrame, useThree } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useRevealStore } from '../user/revealStore'

const GRID = 240 // 240² ≈ 58k particles — dense enough to read as the object, cheap on GPU/mobile

// Ashima 3D simplex noise (MIT) + curl noise (3 offset potential fields) — the swirl source.
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
}`

const P_VERT = `
uniform sampler2D uObjectTex; uniform float uProgress,uAspect,uTime,uAmp,uPointSize;
varying vec3 vColor; varying float vAlpha;
${NOISE}
void main(){
  vec2 uv = position.xy;                   // grid cell in [0,1] == the object's screen uv
  vec4 tex = texture2D(uObjectTex, uv);
  vColor = tex.rgb;
  float inside = step(0.08, tex.a);        // keep only particles where the object actually is
  float env = sin(uProgress*3.14159265);   // 0 → peak → 0 across the run
  vColor += (1.0 - vColor) * env * 0.18;    // lift dark artwork a touch so the cloud stays legible
  vec3 flow = curl(vec3(uv*2.6, uTime*0.12));
  vec2 ndc = uv*2.0 - 1.0;                 // base screen position (matches the live object)
  vec2 disp = flow.xy * uAmp * env;
  disp.x /= uAspect;                        // keep the swirl circular on a wide viewport
  gl_Position = vec4(ndc + disp, 0.0, 1.0);
  gl_PointSize = uPointSize * (0.7 + 0.7*env) * inside;
  vAlpha = tex.a * inside * env;            // fade the cloud in/out with the run
}`

const P_FRAG = `
varying vec3 vColor; varying float vAlpha;
void main(){
  float d = distance(gl_PointCoord, vec2(0.5));
  float s = 1.0 - d*2.0;
  if (s <= 0.0) discard;
  s = pow(clamp(s,0.0,1.0), 1.4);          // soft round falloff
  gl_FragColor = vec4(vColor, s*vAlpha);   // soft colour dot (normal blend → reads on the light UI)
}`

// object quad: the live object, faded out as the cloud takes over (so it visibly disperses & returns)
const O_VERT = `varying vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy,0.0,1.0); }`
const O_FRAG = `uniform sampler2D uObjectTex; uniform float uProgress; varying vec2 vUv;
void main(){ float env=sin(uProgress*3.14159265); vec4 t=texture2D(uObjectTex,vUv); gl_FragColor=vec4(t.rgb, t.a*(1.0-0.92*env)); }`

export default function ParticleReveal() {
  const { gl, scene, camera, size, viewport, invalidate } = useThree()
  const dpr = viewport.dpr
  const fbo = useFBO(Math.max(2, Math.floor(size.width * dpr)), Math.max(2, Math.floor(size.height * dpr)))
  const objectScene = useMemo(() => new THREE.Scene(), [])
  const particleScene = useMemo(() => new THREE.Scene(), [])
  const orthoCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const pMatRef = useRef<THREE.ShaderMaterial | null>(null)
  const oMatRef = useRef<THREE.ShaderMaterial | null>(null)

  // kick the demand render loop when a run starts (a settled scene renders no frames otherwise)
  const runToken = useRevealStore((s) => s.runToken)
  useEffect(() => { if (runToken > 0) invalidate() }, [runToken, invalidate])

  // build the faded object quad + the particle grid once
  useEffect(() => {
    const ar = size.width / size.height
    // object quad
    const oMat = new THREE.ShaderMaterial({
      vertexShader: O_VERT, fragmentShader: O_FRAG,
      uniforms: { uObjectTex: { value: fbo.texture }, uProgress: { value: 0 } },
      transparent: true, depthTest: false, depthWrite: false,
    })
    const oQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), oMat)
    oQuad.frustumCulled = false; objectScene.add(oQuad); oMatRef.current = oMat
    // particle grid (position.xy = the [0,1] uv cell)
    const N = GRID
    const arr = new Float32Array(N * N * 3)
    let k = 0
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { arr[k++] = x / (N - 1); arr[k++] = y / (N - 1); arr[k++] = 0 }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    const pMat = new THREE.ShaderMaterial({
      vertexShader: P_VERT, fragmentShader: P_FRAG,
      uniforms: {
        uObjectTex: { value: fbo.texture },
        uProgress: { value: 0 }, uAspect: { value: ar }, uTime: { value: 0 },
        uAmp: { value: 0.3 }, uPointSize: { value: 4.2 * dpr },
      },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.NormalBlending,
    })
    const pts = new THREE.Points(geo, pMat)
    pts.frustumCulled = false; particleScene.add(pts); pMatRef.current = pMat
    return () => {
      objectScene.remove(oQuad); oQuad.geometry.dispose(); oMat.dispose()
      particleScene.remove(pts); geo.dispose(); pMat.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectScene, particleScene])

  useFrame(() => {
    const r = useRevealStore.getState()
    const renderer = gl
    if (!r.active) { renderer.setRenderTarget(null); renderer.render(scene, camera); return }
    const pMat = pMatRef.current, oMat = oMatRef.current
    if (!pMat || !oMat) { renderer.setRenderTarget(null); renderer.render(scene, camera); return }

    const p = Math.min(1, (performance.now() - r.startedAt) / r.durationMs)
    const ar = size.width / size.height

    // 1) live object → FBO (transparent clear → alpha = the object silhouette + its artwork colour)
    const prevAlpha = renderer.getClearAlpha()
    renderer.setClearAlpha(0)
    renderer.setRenderTarget(fbo); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null)

    // 2) screen: clear transparent (page shows through), then object-quad (fading) + particle cloud
    renderer.clear()
    oMat.uniforms.uObjectTex.value = fbo.texture; oMat.uniforms.uProgress.value = p
    pMat.uniforms.uObjectTex.value = fbo.texture; pMat.uniforms.uProgress.value = p
    pMat.uniforms.uAspect.value = ar; pMat.uniforms.uTime.value = performance.now() / 1000
    pMat.uniforms.uPointSize.value = 4.2 * dpr
    renderer.autoClear = false
    renderer.render(objectScene, orthoCam)
    renderer.render(particleScene, orthoCam)
    renderer.autoClear = true
    renderer.setClearAlpha(prevAlpha)

    if (p < 1) invalidate(); else useRevealStore.getState().stop()
  }, 1)

  return null
}
