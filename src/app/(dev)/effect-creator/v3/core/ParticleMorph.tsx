'use client'
// ParticleMorph — hologram-style surface-sampled particles (technique ref: cortiz2894/hologram-
// particles, MIT). We SURFACE-SAMPLE the live 3D object's mesh (MeshSurfaceSampler → position +
// normal + uv per particle) and render those points, coloured by the REAL artwork (sampled from the
// object's own texture at each particle's uv). Motion = the reference's engine: an idle float-bob +
// fractal-noise displacement ALONG each surface normal, gated by an animated noise mask.
//
// THE MORPH (the Magic transition): each particle holds a SOURCE position (the old shape) and a
// TARGET position (the new shape); uProgress lerps every particle from source→target, so the cloud
// flows ELEGANTLY into the new shape instead of hard-switching. Sequence: deform-out (old shape
// dissolves + holds while BEN computes) → morph (lerp old→new) → settle (deform back to 0 on the new
// shape). First Magic (no old sample) falls back to a scatter→shape assemble (still a smooth lerp).
//
// Mounts as a child of EffectViewer's <Canvas>; adds a Points object to the scene, hides the solid
// object while active, and lets R3F draw. WebGL2 single pass — mobile-safe (no WebGPU/TSL needed).
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
  vec3 base = mix(aPos, aPosTarget, uProgress);          // morph source→target
  float t = uTime;
  float rawMask = snoise(base*uNoiseScale*0.5 + vec3(t*uNoiseSpeed*0.5));
  float mask = pow(clamp(rawMask*0.5+0.5, 0.0, 1.0), uMaskContrast);
  float n = fbm(base*uNoiseScale + vec3(t*uNoiseSpeed, 0.0, t*uNoiseSpeed*0.7));
  vec3 deform = aNormal * (n * uNoiseAmp * mask * uE);    // lift off along the surface normal
  float ph = aSeed*6.2831853;
  vec3 bob = vec3(cos(t*1.3+ph)*0.6, sin(t*1.6+ph), sin(t*1.1+ph+1.0)*0.6) * uFloatAmp;
  vec3 pos = base + deform + bob;
  // travel glow — the particles that move furthest (morph distance) glow brightest mid-morph
  float travel = length(aPosTarget - aPos);
  vGlow = clamp(travel*8.0, 0.0, 1.0) * (uProgress*(1.0-uProgress)*4.0) * uGlow + clamp(length(deform)/max(uNoiseAmp,1e-4),0.0,1.0)*uGlow*uE*0.4;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = uPointSize * uDpr;
}`

const F = `
precision highp float;
uniform sampler2D uTex; uniform vec3 uGlowColor;
varying vec2 vUv; varying float vGlow;
void main(){
  vec2 d = gl_PointCoord - vec2(0.5);
  if (dot(d,d) > 0.25) discard;
  vec4 c = texture2D(uTex, vUv);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(mix(c.rgb, uGlowColor, clamp(vGlow,0.0,1.0)), 1.0);
}`

export default function ParticleMorph() {
  const { scene, invalidate } = useThree()
  const ptsRef = useRef<THREE.Points | null>(null)
  const matRef = useRef<THREE.ShaderMaterial | null>(null)
  const objRef = useRef<THREE.Mesh | null>(null)
  const srcUuidRef = useRef<string>('')   // geometry uuid currently held as SOURCE
  const tgtUuidRef = useRef<string>('')   // geometry uuid sampled as TARGET this run
  const haveSourceRef = useRef(false)
  const dpr = useThree((s) => s.viewport.dpr)
  const count = useRevealStore((s) => s.morph.particleCount)

  const runToken = useRevealStore((s) => s.runToken)
  useEffect(() => { if (runToken > 0) invalidate() }, [runToken, invalidate])

  useEffect(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: V, fragmentShader: F,
      uniforms: {
        uTex: { value: null }, uE: { value: 0 }, uProgress: { value: 0 }, uTime: { value: 0 },
        uNoiseAmp: { value: 0.02 }, uNoiseScale: { value: 26 }, uNoiseSpeed: { value: 0.3 },
        uMaskContrast: { value: 1.4 }, uFloatAmp: { value: 0.0025 }, uPointSize: { value: 2 },
        uGlow: { value: 1 }, uDpr: { value: dpr }, uGlowColor: { value: new THREE.Color('#bfe3ff') },
      },
      transparent: false, depthTest: true, depthWrite: true, toneMapped: false,
    })
    const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), mat)
    pts.frustumCulled = false; pts.visible = false; scene.add(pts)
    ptsRef.current = pts; matRef.current = mat
    return () => { scene.remove(pts); pts.geometry.dispose(); mat.dispose(); ptsRef.current = null; matRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  const findObject = (): THREE.Mesh | null => {
    let mesh: THREE.Mesh | null = null
    scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && o.userData?.isEffectObject && m.geometry?.getAttribute('uv')) mesh = m })
    if (mesh) objRef.current = mesh
    return mesh
  }

  // sample a mesh surface into world-space position/normal/uv arrays
  const sampleMesh = (m: THREE.Mesh, N: number) => {
    m.updateWorldMatrix(true, false)
    const mw = m.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(mw)
    const sampler = new MeshSurfaceSampler(m).build()
    const pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), uv = new Float32Array(N * 2)
    const vp = new THREE.Vector3(), vn = new THREE.Vector3(), vu = new THREE.Vector2()
    for (let i = 0; i < N; i++) {
      sampler.sample(vp, vn, undefined, vu)
      vp.applyMatrix4(mw); vn.applyMatrix3(nm).normalize()
      pos[i*3]=vp.x; pos[i*3+1]=vp.y; pos[i*3+2]=vp.z
      nrm[i*3]=vn.x; nrm[i*3+1]=vn.y; nrm[i*3+2]=vn.z
      uv[i*2]=vu.x; uv[i*2+1]=vu.y
    }
    const mats = m.material as THREE.Material | THREE.Material[]
    const front = Array.isArray(mats) ? mats[0] : mats
    const tex = (front as THREE.MeshStandardMaterial).map as THREE.Texture | null
    return { pos, nrm, uv, tex }
  }

  // SOURCE: rebuild the whole point geometry from a mesh sample (target := source)
  const setSource = (m: THREE.Mesh) => {
    const N = count
    const s = sampleMesh(m, N)
    const seed = new Float32Array(N); for (let i = 0; i < N; i++) seed[i] = Math.random()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3))
    g.setAttribute('aPos', new THREE.BufferAttribute(s.pos, 3))
    g.setAttribute('aPosTarget', new THREE.BufferAttribute(s.pos.slice(), 3))
    g.setAttribute('aNormal', new THREE.BufferAttribute(s.nrm, 3))
    g.setAttribute('aUv', new THREE.BufferAttribute(s.uv, 2))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const pts = ptsRef.current!; const old = pts.geometry; pts.geometry = g; old.dispose()
    if (s.tex && matRef.current) matRef.current.uniforms.uTex.value = s.tex
    srcUuidRef.current = (m.geometry as THREE.BufferGeometry).uuid
    haveSourceRef.current = true
  }

  // TARGET: overwrite only aPosTarget on the existing geometry (keep the source as the start)
  const setTarget = (m: THREE.Mesh) => {
    const pts = ptsRef.current!; const g = pts.geometry
    const tgt = g.getAttribute('aPosTarget') as THREE.BufferAttribute | undefined
    if (!tgt) { setSource(m); return }
    const N = (g.getAttribute('aPos') as THREE.BufferAttribute).count
    const s = sampleMesh(m, N)
    ;(tgt.array as Float32Array).set(s.pos); tgt.needsUpdate = true
    tgtUuidRef.current = (m.geometry as THREE.BufferGeometry).uuid
  }

  // FIRST-MAGIC fallback: build from the new shape, then scatter the SOURCE so it assembles in
  const setScatterInto = (m: THREE.Mesh) => {
    setSource(m)
    const g = ptsRef.current!.geometry
    const src = g.getAttribute('aPos') as THREE.BufferAttribute
    const tgt = g.getAttribute('aPosTarget') as THREE.BufferAttribute
    const a = src.array as Float32Array, b = tgt.array as Float32Array
    for (let i = 0; i < a.length; i += 3) {
      a[i]   = b[i]   + (Math.random()-0.5)*0.12
      a[i+1] = b[i+1] + (Math.random()-0.5)*0.12
      a[i+2] = b[i+2] + (Math.random()-0.5)*0.12
    }
    src.needsUpdate = true
    tgtUuidRef.current = (m.geometry as THREE.BufferGeometry).uuid
  }

  const finish = () => { useRevealStore.getState().stop(); if (objRef.current) objRef.current.visible = true; if (ptsRef.current) ptsRef.current.visible = false }

  useFrame(() => {
    const r = useRevealStore.getState()
    const mat = matRef.current, pts = ptsRef.current
    if (!mat || !pts) return
    if (!r.active) { if (objRef.current) objRef.current.visible = true; pts.visible = false; tgtUuidRef.current = ''; return }
    const cfg = r.morph
    const now = performance.now()
    const elapsed = now - r.startedAt
    const dur = Math.max(1, cfg.durationMs)
    const obj = findObject()
    let e = 0, prog = 0

    if (r.phase === 'cycle') {
      if (obj && srcUuidRef.current !== (obj.geometry as THREE.BufferGeometry).uuid) setSource(obj)
      if (!haveSourceRef.current) return
      const p = Math.min(1, elapsed / dur)
      if (p >= 1) { finish(); return }
      e = ease(p < 0.34 ? p/0.34 : p < 0.66 ? 1 : 1-(p-0.66)/0.34)
    } else if (r.phase === 'out') {
      if (obj && srcUuidRef.current !== (obj.geometry as THREE.BufferGeometry).uuid) setSource(obj)
      e = ease(Math.min(1, elapsed / (dur * 0.4)))   // ramp the dissolve and hold (waits for magicFinish)
    } else { // 'in' — morph into the new shape
      // grab the new shape as TARGET once it appears (different geometry than the source)
      if (obj && (obj.geometry as THREE.BufferGeometry).uuid !== srcUuidRef.current && tgtUuidRef.current !== (obj.geometry as THREE.BufferGeometry).uuid) {
        if (haveSourceRef.current) setTarget(obj)
        else setScatterInto(obj)   // first Magic: no old sample → assemble from scatter
      }
      const haveTarget = tgtUuidRef.current !== '' || haveSourceRef.current
      if (!haveTarget) { e = 1; prog = 0 }            // hold the dissolved old cloud until the new shape lands
      else {
        const morphDur = dur * 0.55, settleDur = dur * 0.45
        if (elapsed < morphDur) { prog = ease(elapsed / morphDur); e = 1 }   // fly old→new, fully lifted
        else {
          prog = 1
          e = 1 - ease(Math.min(1, (elapsed - morphDur) / settleDur))        // settle onto the new shape
          if (elapsed >= morphDur + settleDur) {
            // bake target as the new source for next time, then finish
            const g = pts.geometry
            const src = g.getAttribute('aPos') as THREE.BufferAttribute, tgt = g.getAttribute('aPosTarget') as THREE.BufferAttribute
            ;(src.array as Float32Array).set(tgt.array as Float32Array); src.needsUpdate = true
            srcUuidRef.current = tgtUuidRef.current || srcUuidRef.current
            finish(); return
          }
        }
      }
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
