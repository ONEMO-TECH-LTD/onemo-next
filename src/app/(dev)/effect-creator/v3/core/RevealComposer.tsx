'use client'
// RevealComposer — the Magic-generation reveal as a proper in-canvas postprocessing pass (the
// EffectComposer pattern, dependency-free). Mounts as a child INSIDE EffectViewer's <Canvas>, so
// it owns the render loop via a priority useFrame:
//   • idle  → passthrough: render the scene exactly as R3F would (zero visual/behaviour change).
//   • reveal→ render the live scene into an FBO ("to"), then draw a fullscreen quad running the
//             chosen gl-transition from the flat photo ("from") → the object, advancing progress.
// No canvas capture, no preserveDrawingBuffer — the FBO is a real GPU texture, never blank.
import { useFrame, useThree } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useRevealStore, type RevealTransition } from '../user/revealStore'

// glslVersion GLSL3, but the SOURCE stays GLSL1-style (varying / texture2D / gl_FragColor):
// three's GLSL3 prelude already injects `#version 300 es`, `out pc_fragColor`, and the
// `varying`/`texture2D`/`gl_FragColor` compat #defines — so gl-transitions' GLSL1 code compiles
// verbatim. (Declaring our own out/defines duplicated three's and broke the compile.)
// RawShaderMaterial GLSL3 — we own the WHOLE program (three only prepends `#version 300 es`),
// no hidden prelude/define collisions. gl-transitions' GLSL1 `texture2D` is bridged with one define.
const VERT = `in vec3 position; in vec2 uv; out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`
const fragFor = (glsl: string) => `precision highp float;
#define texture2D texture
in vec2 vUv; out vec4 outColor;
uniform sampler2D tFrom, tTo;
uniform float progress, ratio, fromAspect, viewAspect;
vec2 coverUv(vec2 uv){ float s = fromAspect / viewAspect; vec2 u = uv;
  if (s > 1.0) u.x = (uv.x - 0.5) / s + 0.5; else u.y = (uv.y - 0.5) * s + 0.5; return u; }
vec4 getFromColor(vec2 uv){ return texture(tFrom, coverUv(uv)); }
vec4 getToColor(vec2 uv){ return texture(tTo, uv); }
${glsl}
void main(){ outColor = transition(vUv); }`

export default function RevealComposer() {
  const { gl, scene, camera, size, viewport } = useThree()
  const dpr = viewport.dpr
  const fbo = useFBO(Math.max(2, Math.floor(size.width * dpr)), Math.max(2, Math.floor(size.height * dpr)))
  const quadScene = useMemo(() => new THREE.Scene(), [])
  const quadCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const meshRef = useRef<THREE.Mesh | null>(null)
  const matRef = useRef<THREE.ShaderMaterial | null>(null)
  const fromTexRef = useRef<THREE.Texture | null>(null)
  const builtFxRef = useRef<string>('')
  const lastTokenRef = useRef(0)
  const catalogRef = useRef<RevealTransition[]>([])

  // load the transition catalog once (123 gl-transitions + our custom waterfall)
  useEffect(() => {
    let alive = true
    fetch('/reveal-transitions.json').then((r) => r.json()).then((j: RevealTransition[]) => {
      const custom: RevealTransition = { name: '★ waterfall (custom)', glsl: `
vec4 transition(vec2 uv){ float past=clamp((uv.x-(progress*1.5-.12))/.55,0.,1.);
 float bw=mix(6.,90.,past)/256.; float col=floor(uv.x/bw);
 float rh=mix(8.,70.,past)*(0.6+0.8*fract(sin(col*3.7)*4e4))/256.; float row=floor(uv.y/rh);
 float slide=(progress*progress*1.4)*past*(0.35+fract(sin(col*9.1)*4e4));
 vec2 q=vec2((col+.5)*bw,(row+.5)*rh+slide); q.x+=(fract(sin(dot(vec2(col,row),vec2(127.1,311.7)))*4e4)-.5)*bw*1.6*past;
 float front=smoothstep(.02,-.02,uv.x-(progress*1.5-.12)); return mix(getFromColor(q),getToColor(uv),front);}`, paramsTypes: {}, defaultParams: {} }
      if (alive) catalogRef.current = [custom, ...j]
    }).catch(() => { catalogRef.current = [] })
    return () => { alive = false }
  }, [])

  // build (or rebuild) the fullscreen quad material for the active transition
  const buildMaterial = (t: RevealTransition) => {
    const uniforms: Record<string, THREE.IUniform> = {
      tFrom: { value: fromTexRef.current }, tTo: { value: fbo.texture },
      progress: { value: 0 }, ratio: { value: size.width / size.height },
      fromAspect: { value: 1 }, viewAspect: { value: size.width / size.height },
    }
    if (t.paramsTypes) for (const k in t.paramsTypes) {
      const v = (t.defaultParams || {})[k]
      uniforms[k] = { value: v as number | number[] }
    }
    let mat: THREE.ShaderMaterial
    try {
      mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: fragFor(t.glsl), uniforms, depthTest: false, depthWrite: false })
    } catch { return false }
    if (meshRef.current) { meshRef.current.material = mat; matRef.current?.dispose(); matRef.current = mat }
    builtFxRef.current = t.name
    return true
  }

  // create the quad mesh once
  useEffect(() => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial())
    meshRef.current = mesh; quadScene.add(mesh)
    return () => { quadScene.remove(mesh); mesh.geometry.dispose() }
  }, [quadScene])

  useFrame((state) => {
    const r = useRevealStore.getState()
    const renderer = state.gl
    if (!r.active) { renderer.setRenderTarget(null); renderer.render(scene, camera); return }

    // a fresh start token → load the "from" photo + (re)build the chosen transition material
    if (lastTokenRef.current !== r.runToken) {
      lastTokenRef.current = r.runToken
      const t = catalogRef.current.find((x) => x.name === r.fx) ?? catalogRef.current[0]
      if (!t) { useRevealStore.getState().stop(); renderer.setRenderTarget(null); renderer.render(scene, camera); return }
      if (r.fromUrl) {
        new THREE.TextureLoader().load(r.fromUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          fromTexRef.current = tex
          if (matRef.current) { matRef.current.uniforms.tFrom.value = tex; matRef.current.uniforms.fromAspect.value = (tex.image?.width ?? 1) / (tex.image?.height ?? 1) }
        })
      }
      buildMaterial(t)
    }
    const mat = matRef.current
    if (!mat) { renderer.setRenderTarget(null); renderer.render(scene, camera); return }

    const p = Math.min(1, (performance.now() - r.startedAt) / r.durationMs)
    mat.uniforms.progress.value = p
    mat.uniforms.viewAspect.value = size.width / size.height
    // 1) the live object → FBO ("to")
    renderer.setRenderTarget(fbo); renderer.render(scene, camera); renderer.setRenderTarget(null)
    mat.uniforms.tTo.value = fbo.texture
    // 2) the transition → screen
    renderer.render(quadScene, quadCam)
    if (p < 1) state.invalidate(); else useRevealStore.getState().stop()
  }, 1)

  return null
}
