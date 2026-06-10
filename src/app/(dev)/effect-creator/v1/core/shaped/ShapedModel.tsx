// ShapedModel — renders the generated cut-out mesh inside the golden scene (Lane A / Kai).
// Replaces the GLB object; reuses the scene's suede material params, lighting, camera, env.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Center } from '@react-three/drei'
import * as THREE from 'three'
import type { DesignState, SceneSettings } from '../../types'
import type { SuedeMaterialParams, ShapeSpecDraft } from './types'
import { buildShape, buildSquareShape, DEFAULT_BUILD_CONFIG, composeFront } from './pipeline'
import { buildShapedGeometry } from './mesh'
import { useOutlineStore } from '../../user/outlineStore'

interface ShapedModelProps {
  artworkUrl?: string
  designState: DesignState
  scene: SceneSettings
  suede: SuedeMaterialParams
  backColor: string
  /** world size (scene units) the cut-out's longest side maps to. Tuned to match golden framing. */
  fitSize?: number // see default below
  /** false = the instant flat square (default); true = run BEN to build the subject cut-out (Magic wand). */
  auto?: boolean
  onSpec?: (spec: ShapeSpecDraft) => void
  onStatus?: (status: 'idle' | 'building' | 'ready' | 'error', message?: string) => void
}

const texCache = new Map<string, THREE.Texture>()
function loadTex(url: string | undefined) {
  if (!url) return null
  const cached = texCache.get(url)
  if (cached) return cached
  const t = new THREE.TextureLoader().load(url)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.NoColorSpace
  texCache.set(url, t)
  return t
}

export default function ShapedModel({
  artworkUrl,
  designState,
  scene: sceneSettings,
  suede,
  backColor,
  fitSize = 0.09,
  auto = false,
  onSpec,
  onStatus,
}: ShapedModelProps) {
  const [result, setResult] = useState<{ geometry: THREE.BufferGeometry; texture: THREE.CanvasTexture; edgeTexture: THREE.CanvasTexture; widthMM: number; heightMM: number } | null>(null)
  const artTexRef = useRef<THREE.CanvasTexture | null>(null)
  const editedContourMM = useOutlineStore((s) => s.editedContourMM)
  const bgBlur = useOutlineStore((s) => s.bgBlur)
  const frontSrcRef = useRef<{ origCanvas: HTMLCanvasElement; subjCanvas: HTMLCanvasElement; defaultBlurPx: number } | null>(null)
  const resultRef = useRef(result)
  useEffect(() => { resultRef.current = result }, [result])

  // Run the pipeline whenever the artwork changes
  useEffect(() => {
    let cancelled = false
    if (!artworkUrl) {
      // clear any stale mesh when artwork is removed
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult((prev) => { prev?.geometry.dispose(); prev?.texture.dispose(); prev?.edgeTexture.dispose(); return null })
      useOutlineStore.getState().setSpec(null) // clear the 2D editor's outline when artwork is removed
      useOutlineStore.getState().setEditedContourMM(null) // drop any prior edit
      useOutlineStore.getState().setEditedDoc(null)
      useOutlineStore.getState().setBgBlur(null)
      useOutlineStore.getState().setSubjMatteUrl(null)
      frontSrcRef.current = null
      return
    }
    onStatus?.('building')
    ;(auto ? buildShape : buildSquareShape)(artworkUrl, DEFAULT_BUILD_CONFIG)
      .then((r) => {
        if (cancelled) { r.geometry.dispose(); r.texture.dispose(); r.edgeTexture.dispose(); return }
        setResult((prev) => {
          prev?.geometry.dispose()
          prev?.texture.dispose()
          prev?.edgeTexture.dispose()
          return r
        })
        artTexRef.current = r.texture
        frontSrcRef.current = r.frontSrc // source layers for live "magic blend" re-blur
        // Only the cut-out needs the subject matte (for the editor blend preview). Skip the costly
        // 2400px toDataURL on the plain square (subjCanvas is just the full photo there → no blend).
        if (auto) { try { useOutlineStore.getState().setSubjMatteUrl(r.frontSrc.subjCanvas.toDataURL()) } catch { useOutlineStore.getState().setSubjMatteUrl(null) } }
        else useOutlineStore.getState().setSubjMatteUrl(null)
        onSpec?.(r.spec)
        useOutlineStore.getState().setSpec(r.spec) // hand the real contour to the 2D outline editor (A1d)
        useOutlineStore.getState().setEditedContourMM(null) // fresh cut-out → drop any prior edited outline
        useOutlineStore.getState().setEditedDoc(null)
        useOutlineStore.getState().setBgBlur(null) // fresh cut-out → default blend
        onStatus?.('ready')
      })
      .catch((e) => {
        if (cancelled) return
        console.error('[shaped] build failed:', e)
        onStatus?.('error', e?.message ?? 'build failed')
      })
    return () => { cancelled = true }
    // Build ONLY on artwork/auto change. onSpec/onStatus are callbacks (often inline → unstable identity);
    // including them re-fired the build every render → buildSquareShape looped (~166ms/frame, the perf collapse).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artworkUrl, auto])

  // editor → 3D: when the 2D editor commits an edited outline, rebuild ONLY the mesh geometry from it
  // (px→mm already done in the editor) and swap it in — REUSING the existing front/edge textures (no
  // re-segmentation). This is what makes the suede object follow the 2D edits and locks the approved
  // shape as the thing shown (ADDENDUM D steps 4 + 8). Keyed on the committed contour only.
  useEffect(() => {
    if (!editedContourMM) return
    const prev = resultRef.current
    const sp = useOutlineStore.getState().spec
    if (!prev || !sp) return
    let built: { geometry: THREE.BufferGeometry; widthMM: number; heightMM: number }
    try {
      built = buildShapedGeometry(editedContourMM, {
        thicknessMM: DEFAULT_BUILD_CONFIG.thicknessMM,
        edgeRadiusMM: DEFAULT_BUILD_CONFIG.edgeRadiusMM,
        edgeSegments: DEFAULT_BUILD_CONFIG.edgeSegments,
        mmPerPx: sp.mmPerPx,
        imgW: sp.maskWidthPx,
        imgH: sp.maskHeightPx,
      })
    } catch (e) {
      console.warn('[shaped] edited-outline mesh rebuild failed:', e)
      return
    }
    setResult((p) => {
      if (!p) { built.geometry.dispose(); return p }
      p.geometry.dispose() // swap geometry only; keep p.texture / p.edgeTexture
      return { ...p, geometry: built.geometry, widthMM: built.widthMM, heightMM: built.heightMM }
    })
  }, [editedContourMM])

  // editor → 3D: live "magic blend" intensity. Re-compose the front texture from the cached source
  // layers (no re-segmentation) when the editor changes the blur. bgBlur null = build default already on.
  useEffect(() => {
    if (bgBlur == null) return
    const fs = frontSrcRef.current
    if (!fs) return
    const px = bgBlur <= 0 ? 0 : bgBlur * (fs.origCanvas.width / 25) // 0 = off (sharp); ~0.5 ≈ build default
    const front = composeFront(fs.origCanvas, fs.subjCanvas, px)
    const tex = new THREE.CanvasTexture(front)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = false
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.needsUpdate = true
    artTexRef.current = tex
    setResult((p) => {
      if (!p) { tex.dispose(); return p }
      p.texture.dispose() // swap the front texture only
      return { ...p, texture: tex }
    })
  }, [bgBlur])

  // suede texture maps (normal/roughness/bump) on UV CHANNEL 1 (world-XY) → tiles by physical size,
  // never stretches (on the front OR the rim). The image map stays on channel 0 (position).
  const suedeTex = (url: string | undefined) => { const t = loadTex(url); if (t) t.channel = 1; return t }
  const normalMap = useMemo(() => suedeTex(suede.normalMap), [suede.normalMap])
  const roughnessMap = useMemo(() => suedeTex(suede.roughnessMap), [suede.roughnessMap])
  const bumpMap = useMemo(() => suedeTex(suede.bumpMap), [suede.bumpMap])

  // FRONT material = EXACTLY the golden-scene suede setup (Dan: do not change it). Used for the
  // FRONT and the EDGE (one shared instance) — the edge is the same printed suede continuing over
  // the lip, not a separate rim. Suede maps on channel 1 (world-XY) so they don't stretch on the rim.
  const frontMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      map: result?.texture ?? null,
      color: new THREE.Color(0xffffff),
      normalMap,
      normalScale: new THREE.Vector2(suede.normalScale, suede.normalScale),
      bumpMap,
      bumpScale: suede.bumpScale,
      roughnessMap,
      roughness: suede.roughness,
      metalness: suede.metalness,
      sheen: suede.sheen,
      sheenColor: new THREE.Color(suede.sheenColor),
      sheenRoughness: suede.sheenRoughness,
      envMapIntensity: suede.envMapIntensity,
      side: THREE.DoubleSide,
    })
  }, [result?.texture, normalMap, roughnessMap, bumpMap, suede])

  // EDGE = a MATTE COPY of the front: SAME image (arc-length UV → wraps over the lip, no stretch) +
  // SAME suede maps (channel 1 world-XY → no stretch), but reflectivity KILLED so the curved lip
  // doesn't catch the sheen/Fresnel highlight the flat front never shows. Dan: "the edge gets a
  // matte copy is correct." sheen/env/specular = 0 is what makes it read matte at grazing angles.
  const edgeMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      map: result?.edgeTexture ?? null, // STRONGLY blurred → smooth rim colour, no per-pixel bands
      color: new THREE.Color(0xffffff),
      normalMap,
      normalScale: new THREE.Vector2(suede.normalScale, suede.normalScale),
      bumpMap,
      bumpScale: suede.bumpScale,
      roughnessMap,
      roughness: 1,
      metalness: 0,
      sheen: 0,
      envMapIntensity: 0,
      specularIntensity: 0,
      side: THREE.DoubleSide,
    })
  }, [result?.edgeTexture, normalMap, roughnessMap, bumpMap, suede])

  // BACK = same golden suede setup, just the back colour.
  const backMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(backColor),
      normalMap,
      normalScale: new THREE.Vector2(suede.normalScale, suede.normalScale),
      bumpMap,
      bumpScale: suede.bumpScale,
      roughnessMap,
      roughness: suede.roughness,
      metalness: suede.metalness,
      sheen: suede.sheen,
      sheenColor: new THREE.Color(suede.sheenColor),
      sheenRoughness: suede.sheenRoughness,
      envMapIntensity: suede.envMapIntensity,
      side: THREE.DoubleSide,
    })
  }, [backColor, normalMap, roughnessMap, bumpMap, suede])

  // design-state pan/zoom on the front artwork texture (same model as the golden configurator).
  // Recovery F4: repeat/offset are texture-MATRIX params — they must NOT set `needsUpdate`, which
  // forces a full canvas→GPU re-upload (~23 MB at 2400px) per pointer event. needsUpdate is only for
  // canvas CONTENT changes (the bgBlur recompose path creates a fresh CanvasTexture already).
  useEffect(() => {
    const repeat = 1 / designState.scale
    const centerOffset = (1 - repeat) / 2
    const ox = centerOffset + designState.offsetX * repeat
    const oy = centerOffset + designState.offsetY * repeat
    const tex = artTexRef.current
    if (tex) {
      tex.repeat.set(repeat, repeat)
      tex.offset.set(ox, oy)
    }
  }, [designState, result])

  // geometry groups (mesh.ts): 0 = front cap (golden suede, unchanged), 1 = edge lip (matte copy),
  // 2 = back cap (solid back suede). Order MUST match the addGroup material indices in mesh.ts.
  const materials = useMemo(
    () => [frontMaterial, edgeMaterial, backMaterial],
    [frontMaterial, edgeMaterial, backMaterial],
  )

  // mm → scene units so the longest side maps to fitSize
  const scale = useMemo(() => {
    if (!result) return 1
    const longest = Math.max(result.widthMM, result.heightMM) || 1
    return fitSize / longest
  }, [result, fitSize])

  if (!result) {
    return <ambientLight intensity={sceneSettings.ambientIntensity} />
  }

  return (
    <>
      <ambientLight intensity={sceneSettings.ambientIntensity} />
      <Center>
        <mesh geometry={result.geometry} material={materials} scale={scale} castShadow receiveShadow />
      </Center>
    </>
  )
}
