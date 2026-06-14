'use client'
// ParticleMorph — hologram-style surface-sampled particles (technique ref: cortiz2894/hologram-
// particles, MIT). Instead of a screen-space pixel grid, we SURFACE-SAMPLE the live 3D object's mesh
// (MeshSurfaceSampler → position + normal + uv per particle) and render those points, coloured by the
// REAL artwork (sampled from the object's own texture at each particle's uv). Motion = the reference's
// engine: a tiny idle float-bob + fractal-noise displacement ALONG each particle's surface normal,
// gated by an animated noise "mask" (so the surface lifts off organically and the silhouette stays
// readable). The transition deforms outward and reforms (and will morph between shapes — wired next).
//
// Mounts as a child of EffectViewer's <Canvas>; it does NOT own the render loop — it adds a Points
// object to the scene, hides the solid object while active, and lets R3F draw. WebGL2, single pass —
// mobile-safe (no WebGPU/TSL needed; the reference's WebGPU is a convenience, not a requirement).
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { useRevealStore } from '../user/revealStore'

const ease = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c) }

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
float fbm(vec3 p){ return snoise(p)*0.6 + snoise(p*2.03+11.0)*0.3 + snoise(p*4.07+23.0)*0.1; }`

const V = `
attribute vec3 aPos; attribute vec3 aPosTarget; attribute vec3 aNormal; attribute vec2 aUv; attribute float aSeed;
uniform float uE, uProgress, uTime, uNoiseAmp, uNoiseScale, uNoiseSpeed, uMaskContrast, uFloatAmp, uPointSize, uGlow, uDpr;
varying vec2 vUv; varying float vGlow;
${NOISE}
void main(){
  vUv = aUv;
  vec3 base = mix(aPos, aPosTarget, uProgress);          // morph source→target (target==source in cycle)
  float t = uTime;
  // animated dissolve mask — which particles lift off, and how much
  float rawMask = snoise(base*uNoiseScale*0.5 + vec3(t*uNoiseSpeed*0.5));
  float mask = pow(clamp(rawMask*0.5+0.5, 0.0, 1.0), uMaskContrast);
  // fractal-noise displacement ALONG the surface normal, gated by the mask + the run envelope uE
  float n = fbm(base*uNoiseScale + vec3(t*uNoiseSpeed, 0.0, t*uNoiseSpeed*0.7));
  vec3 deform = aNormal * (n * uNoiseAmp * mask * uE);
  // idle float bob (always-on subtle life)
  float ph = aSeed*6.2831853;
  vec3 bob = vec3(cos(t*1.3+ph)*0.6, sin(t*1.6+ph), sin(t*1.1+ph+1.0)*0.6) * uFloatAmp;
  vec3 pos = base + deform + bob;
  // travel glow — particles displaced furthest glow during the run
  vGlow = clamp(length(deform)/max(uNoiseAmp,1e-4), 0.0, 1.0) * uGlow * uE;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = uPointSize * uDpr;                      // constant screen-px particle size
}`

const F = `
precision highp float;
uniform sampler2D uTex; uniform vec3 uGlowColor;
varying vec2 vUv; varying float vGlow;
void main(){
  vec2 d = gl_PointCoord - vec2(0.5);
  if (dot(d,d) > 0.25) discard;                 // round point
  vec4 c = texture2D(uTex, vUv);
  if (c.a < 0.5) discard;                        // skip transparent texels
  vec3 col = mix(c.rgb, uGlowColor, vGlow);      // artwork colour, brightened where it travels
  gl_FragColor = vec4(col, 1.0);
}`

export default function ParticleMorph() {
  const { scene, invalidate } = useThree()
  const ptsRef = useRef<THREE.Points | null>(null)
  const matRef = useRef<THREE.ShaderMaterial | null>(null)
  const objRef = useRef<THREE.Mesh | null>(null)
  const sampledUuidRef = useRef<string>('')
  const dpr = useThree((s) => s.viewport.dpr)

  const count = useRevealStore((s) => s.morph.particleCount)

  const runToken = useRevealStore((s) => s.runToken)
  useEffect(() => { if (runToken > 0) invalidate() }, [runToken, invalidate])

  // build the Points object once (empty geometry; filled by sampling)
  useEffect(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)) // placeholder
    const mat = new THREE.ShaderMaterial({
      vertexShader: V, fragmentShader: F,
      uniforms: {
        uTex: { value: null }, uE: { value: 0 }, uProgress: { value: 0 }, uTime: { value: 0 },
        uNoiseAmp: { value: 0.02 }, uNoiseScale: { value: 26 }, uNoiseSpeed: { value: 0.3 },
        uMaskContrast: { value: 1.4 }, uFloatAmp: { value: 0.0025 }, uPointSize: { value: 2 },
        uGlow: { value: 1 }, uDpr: { value: dpr }, uGlowColor: { value: new THREE.Color('#bfe3ff') },
      },
      transparent: true, depthTest: true, depthWrite: true, toneMapped: false,
    })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    pts.visible = false
    scene.add(pts)
    ptsRef.current = pts; matRef.current = mat
    return () => { scene.remove(pts); geo.dispose(); mat.dispose(); ptsRef.current = null; matRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  // find the effect object mesh + (re)sample its surface when geometry changes
  const sampleObject = () => {
    let mesh: THREE.Mesh | null = null
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData?.isEffectObject) mesh = o as THREE.Mesh })
    if (!mesh) return false
    objRef.current = mesh
    const m = mesh as THREE.Mesh
    const geom = m.geometry as THREE.BufferGeometry
    if (!geom.getAttribute('uv')) return false
    if (sampledUuidRef.current === geom.uuid && ptsRef.current?.geometry.getAttribute('aPos')) return true
    sampledUuidRef.current = geom.uuid

    m.updateWorldMatrix(true, false)
    const mw = m.matrixWorld
    const nm = new THREE.Matrix3().getNormalMatrix(mw)
    const sampler = new MeshSurfaceSampler(m).build()
    const N = count
    const aPos = new Float32Array(N * 3), aNorm = new Float32Array(N * 3), aUv = new Float32Array(N * 2), aSeed = new Float32Array(N)
    const p = new THREE.Vector3(), nrm = new THREE.Vector3(), uv = new THREE.Vector2()
    for (let i = 0; i < N; i++) {
      sampler.sample(p, nrm, undefined, uv)
      p.applyMatrix4(mw); nrm.applyMatrix3(nm).normalize()
      aPos[i*3] = p.x; aPos[i*3+1] = p.y; aPos[i*3+2] = p.z
      aNorm[i*3] = nrm.x; aNorm[i*3+1] = nrm.y; aNorm[i*3+2] = nrm.z
      aUv[i*2] = uv.x; aUv[i*2+1] = uv.y
      aSeed[i] = Math.random()
    }
    const pts = ptsRef.current!
    const old = pts.geometry
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(aPos, 3)) // also used for frustum/bounds
    g.setAttribute('aPos', new THREE.BufferAttribute(aPos, 3))
    g.setAttribute('aPosTarget', new THREE.BufferAttribute(aPos.slice(), 3)) // == source until a morph
    g.setAttribute('aNormal', new THREE.BufferAttribute(aNorm, 3))
    g.setAttribute('aUv', new THREE.BufferAttribute(aUv, 2))
    g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))
    pts.geometry = g
    old.dispose()
    // artwork texture = the object's front-cap material map
    const mats = m.material as THREE.Material | THREE.Material[]
    const front = Array.isArray(mats) ? mats[0] : mats
    const tex = (front as THREE.MeshStandardMaterial).map as THREE.Texture | null
    if (tex && matRef.current) matRef.current.uniforms.uTex.value = tex
    return true
  }

  useFrame(() => {
    const r = useRevealStore.getState()
    const mat = matRef.current, pts = ptsRef.current
    if (!mat || !pts) return
    const cfg = r.morph

    if (!r.active) {
      if (objRef.current) objRef.current.visible = true
      pts.visible = false
      return
    }
    // entering/continuing a run — make sure we have a fresh surface sample of the object
    if (!sampleObject()) { return }

    const now = performance.now()
    const p = Math.min(1, (now - r.startedAt) / Math.max(1, cfg.durationMs))
    // dissolve envelope e (deform amount). cycle = plateau; out = ramp&hold; in = ramp down.
    let e = 0, prog = 0
    if (r.phase === 'in') {
      e = 1 - ease(Math.min(1, (now - r.startedAt) / (cfg.durationMs * 0.5)))
      prog = 1
      if (e <= 0.001) { useRevealStore.getState().stop(); if (objRef.current) objRef.current.visible = true; pts.visible = false; return }
    } else if (r.phase === 'out') {
      e = ease(Math.min(1, (now - r.startedAt) / (cfg.durationMs * 0.4)))
    } else {
      if (p >= 1) { useRevealStore.getState().stop(); if (objRef.current) objRef.current.visible = true; pts.visible = false; return }
      const raw = p < 0.34 ? p / 0.34 : p < 0.66 ? 1 : 1 - (p - 0.66) / 0.34
      e = ease(raw)
    }

    if (objRef.current) objRef.current.visible = false
    pts.visible = true
    const u = mat.uniforms
    u.uE.value = e; u.uProgress.value = prog; u.uTime.value = now / 1000
    u.uNoiseAmp.value = cfg.noiseAmp; u.uNoiseScale.value = cfg.noiseScale; u.uNoiseSpeed.value = cfg.noiseSpeed
    u.uMaskContrast.value = cfg.maskContrast; u.uFloatAmp.value = cfg.floatAmp
    u.uPointSize.value = cfg.pointSize; u.uGlow.value = cfg.glow; u.uDpr.value = dpr
    invalidate()
  })

  return null
}
