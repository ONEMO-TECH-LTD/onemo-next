'use client'
// RevealComposer — a transition-TESTING pass as an in-canvas postprocessing pass, wired to the
// CANONICAL gl-transitions contract (ref: gl-transition runtime, MIT). Mounts as a child INSIDE
// EffectViewer's <Canvas>, owns the render loop via a priority useFrame:
//   • idle  → passthrough: render the scene exactly as R3F would (zero behaviour change).
//   • reveal→ render the live object into an FBO ("to"), render the live scene to screen UNTOUCHED
//             as the base, then overlay the chosen transition (flat photo "from" → object) CLIPPED
//             to the object silhouette — so the effect plays ONLY on the 3D object, never the
//             whole screen. The trigger is the replay button (RevealFxPicker), NOT Magic — this is
//             an audition surface to see every effect on the object on demand. When Dan pins one,
//             collapse the picker and re-wire start() into Magic completion + other transitions.
// Contract (verbatim from the reference runtime): the host provides `from`,`to` samplers +
// `progress`,`ratio`,`_fromR`,`_toR` uniforms + getFromColor/getToColor (cover-resize); the
// transition GLSL implements `vec4 transition(vec2 uv)`. Compiled as GLSL ES 1.00 (no glslVersion)
// — that's what the spec targets, and it's lenient about the few transitions with non-constant
// global initializers. A compile-test filter still drops anything the driver rejects, so the
// picker only ever offers transitions that actually run (fallback = the custom waterfall).
import { useFrame, useThree } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useRevealStore, type RevealTransition } from '../user/revealStore'

// canonical resize (cover): preserve each image's aspect against the viewport ratio
const COVER = (r: string) => `.5+(uv-.5)*vec2(min(ratio/${r},1.),min(${r}/ratio,1.))`
const VERT = `attribute vec3 position; attribute vec2 uv; varying vec2 _uv;
void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); _uv = uv; }`
const fragFor = (glsl: string) => `precision highp float;
varying vec2 _uv;
uniform sampler2D from, to;
uniform float progress, ratio, _fromR, _toR;
vec4 getFromColor(vec2 uv){ return texture2D(from, ${COVER('_fromR')}); }
vec4 getToColor(vec2 uv){ return texture2D(to, ${COVER('_toR')}); }
${glsl}
// OBJECT-ONLY: clip the transition to the live object's silhouette (the "to" render is the scene
// on a transparent bg, so its alpha IS the object mask). Output straight alpha → composites over
// the untouched live scene, so the effect plays only on the 3D object, never the whole screen.
void main(){ vec4 c = transition(_uv); float mask = getToColor(_uv).a; gl_FragColor = vec4(c.rgb, c.a * mask); }`

const WATERFALL: RevealTransition = { name: '★ waterfall (custom)', glsl: `
vec4 transition(vec2 uv){ float past=clamp((uv.x-(progress*1.5-.12))/.55,0.,1.);
 float bw=mix(6.,90.,past)/256.; float col=floor(uv.x/bw);
 float rh=mix(8.,70.,past)*(0.6+0.8*fract(sin(col*3.7)*4e4))/256.; float row=floor(uv.y/rh);
 float slide=(progress*progress*1.4)*past*(0.35+fract(sin(col*9.1)*4e4));
 vec2 q=vec2((col+.5)*bw,(row+.5)*rh+slide); q.x+=(fract(sin(dot(vec2(col,row),vec2(127.1,311.7)))*4e4)-.5)*bw*1.6*past;
 float front=smoothstep(.02,-.02,uv.x-(progress*1.5-.12)); return mix(getFromColor(q),getToColor(uv),front);}`, paramsTypes: {}, defaultParams: {} }

// raw GL compile/link test so the picker only offers transitions that actually run on this driver
function compiles(gl: WebGLRenderingContext, fsSrc: string): boolean {
  const vs = gl.createShader(gl.VERTEX_SHADER); const fs = gl.createShader(gl.FRAGMENT_SHADER)
  if (!vs || !fs) return false
  gl.shaderSource(vs, VERT); gl.compileShader(vs)
  gl.shaderSource(fs, fsSrc); gl.compileShader(fs)
  const ok = gl.getShaderParameter(vs, gl.COMPILE_STATUS) && gl.getShaderParameter(fs, gl.COMPILE_STATUS)
  gl.deleteShader(vs); gl.deleteShader(fs)
  return !!ok
}

export default function RevealComposer() {
  const { gl, scene, camera, size, viewport, invalidate } = useThree()
  const dpr = viewport.dpr
  // The Canvas runs frameloop="demand" — an idle scene renders no frames. Pressing play only flips
  // the store flag, so we must KICK the render loop here when a run starts. useFrame then keeps
  // itself alive via state.invalidate() until the transition finishes. (This is exactly why
  // "replay did nothing" on a settled scene — nothing was driving the loop.)
  const runToken = useRevealStore((s) => s.runToken)
  useEffect(() => { if (runToken > 0) invalidate() }, [runToken, invalidate])
  const fbo = useFBO(Math.max(2, Math.floor(size.width * dpr)), Math.max(2, Math.floor(size.height * dpr)))
  const quadScene = useMemo(() => new THREE.Scene(), [])
  const quadCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const meshRef = useRef<THREE.Mesh | null>(null)
  const matRef = useRef<THREE.ShaderMaterial | null>(null)
  const fromTexRef = useRef<THREE.Texture | null>(null)
  const fromRRef = useRef(1)
  const lastTokenRef = useRef(0)
  const catalogRef = useRef<RevealTransition[]>([WATERFALL])

  // load the catalog, compile-test each against THIS driver, publish only the working ones
  useEffect(() => {
    let alive = true
    const ctx = gl.getContext() as WebGLRenderingContext
    fetch('/reveal-transitions.json').then((r) => r.json()).then((j: RevealTransition[]) => {
      if (!alive) return
      const valid = [WATERFALL, ...j].filter((t) => compiles(ctx, fragFor(t.glsl)))
      catalogRef.current = valid
      useRevealStore.getState().setValidFx(valid.map((t) => t.name))
      // if the current fx didn't survive the filter, fall back to the waterfall
      const cur = useRevealStore.getState().fx
      if (!valid.some((t) => t.name === cur)) useRevealStore.getState().setFx(WATERFALL.name)
    }).catch(() => { catalogRef.current = [WATERFALL]; useRevealStore.getState().setValidFx([WATERFALL.name]) })
    return () => { alive = false }
  }, [gl])

  // quad mesh once
  useEffect(() => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial())
    meshRef.current = mesh; quadScene.add(mesh)
    return () => { quadScene.remove(mesh); mesh.geometry.dispose() }
  }, [quadScene])

  const buildMaterial = (t: RevealTransition) => {
    const ar = size.width / size.height
    const uniforms: Record<string, THREE.IUniform> = {
      from: { value: fromTexRef.current }, to: { value: fbo.texture },
      progress: { value: 0 }, ratio: { value: ar }, _fromR: { value: fromRRef.current }, _toR: { value: ar },
    }
    if (t.paramsTypes) for (const k in t.paramsTypes) uniforms[k] = { value: (t.defaultParams || {})[k] as number | number[] }
    // RawShaderMaterial, NO glslVersion → GLSL ES 1.00 (the canonical target).
    // transparent → the masked quad blends over the live scene base (object-only overlay).
    const mat = new THREE.RawShaderMaterial({ vertexShader: VERT, fragmentShader: fragFor(t.glsl), uniforms, transparent: true, depthTest: false, depthWrite: false })
    if (meshRef.current) { matRef.current?.dispose(); meshRef.current.material = mat; matRef.current = mat }
  }

  useFrame((state) => {
    const r = useRevealStore.getState()
    const renderer = state.gl
    if (!r.active) { renderer.setRenderTarget(null); renderer.render(scene, camera); return }

    if (lastTokenRef.current !== r.runToken) {
      lastTokenRef.current = r.runToken
      const t = catalogRef.current.find((x) => x.name === r.fx) ?? catalogRef.current[0]
      if (!t) { useRevealStore.getState().stop(); renderer.setRenderTarget(null); renderer.render(scene, camera); return }
      if (r.fromUrl) {
        new THREE.TextureLoader().load(r.fromUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace; fromTexRef.current = tex
          fromRRef.current = (tex.image?.width ?? 1) / (tex.image?.height ?? 1)
          if (matRef.current) { matRef.current.uniforms.from.value = tex; matRef.current.uniforms._fromR.value = fromRRef.current }
        })
      }
      buildMaterial(t)
    }
    const mat = matRef.current
    if (!mat) { renderer.setRenderTarget(null); renderer.render(scene, camera); return }

    const p = Math.min(1, (performance.now() - r.startedAt) / r.durationMs)
    const ar = size.width / size.height
    mat.uniforms.progress.value = p; mat.uniforms.ratio.value = ar; mat.uniforms._toR.value = ar
    // 1) live object → FBO (the "to" image + its alpha = the object mask). Force a TRANSPARENT
    // clear so the area outside the object silhouette has alpha 0 — that's what clips the effect to
    // the object. (Without this the FBO clears opaque and the mask reads "everywhere" → whole-screen wash.)
    const prevAlpha = renderer.getClearAlpha()
    renderer.setClearAlpha(0)
    renderer.setRenderTarget(fbo); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null)
    renderer.setClearAlpha(prevAlpha)
    mat.uniforms.to.value = fbo.texture
    // 2) the live scene to screen, untouched (bg + shadow + object stay exactly as normal)
    renderer.autoClear = true; renderer.render(scene, camera)
    // 3) overlay the transition, clipped to the object silhouette, on top — nothing else moves
    renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true
    if (p < 1) state.invalidate(); else useRevealStore.getState().stop()
  }, 1)

  return null
}
