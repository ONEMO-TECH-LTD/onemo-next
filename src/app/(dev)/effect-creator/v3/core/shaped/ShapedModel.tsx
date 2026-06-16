// ShapedModel — renders the prepared effect mesh inside the persistent golden scene (V3).
//
// ONE ENGINE (§3.3): consumes the `prepared` effect from `prepareEffect` (pure 2D) — the mesh
// extrudes the same mm outline the editor shows and the cutline uses (silhouette parity); the
// textures ARE the same composite (composite parity). It never builds geometry from the image.
//
// (R7 — Creator v5) PROP-PURE: this renders from PROPS ALONE — it no longer reaches into the
// outlineStore. The editor↔3D bridge (committedShape / committedContourMM / editorOpen / bgBlur /
// imageFx) is read by <ShapedModelBridge> and handed down as props ("bridge translates, viewer
// renders"). The geometry derivation (vectorTrueContour) is a pure function — the resolved vector is
// passed in, never fetched from global state. Swap-test holds: re-implement this contract and nothing
// else changes (North Star module 8).
//
// V3 contracts honoured here:
//  • §6.1 no blank mount — `invalidate()` fires on every async content arrival (mesh built, texture
//    swapped), so demand-frameloop renders the object the moment it exists.
//  • §6.3 matrix-only texture transforms — pan/zoom (G1) touches repeat/offset ONLY; `needsUpdate`
//    forces a ~23 MB canvas→GPU re-upload per event and is reserved for canvas CONTENT changes.
//  • §6.3 deferred rebuilds — while the editor overlay is open (scene frozen) edited-outline mesh
//    rebuilds are DEFERRED; ONE rebuild fires at the editor-close boundary.
//  • G2 — anisotropic filtering on the front texture so the full-res artwork stays sharp at angles.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Center } from '@react-three/drei'
import * as THREE from 'three'
import type { DesignState, SceneSettings } from '../../types'
import type { SuedeMaterialParams, Contour, Pt } from '@/lib/effect/types'
import { flattenShape, type VShape } from '@/lib/vector-core'
import { DISPLAY_TOLERANCE_MM } from '@/lib/effect/geometry-truth'
import { EFFECT_BUILD_CONFIG, type PreparedEffect } from '@/lib/effect/prepare-effect'
import { buildMeshFromSpec } from '@/lib/effect/build-mesh'
import { buildShapedGeometry } from '@/lib/effect/mesh'
import { composeFront } from '@/lib/effect/composite'
import type { ImageFx } from '../../user/outlineStore'
import { perfGesture } from '../../dev/PerfHUD'

interface ShapedModelProps {
  /** The 2D-prepared effect (geometry + composites) — the one engine's output (parity). */
  prepared: PreparedEffect
  designState: DesignState
  scene: SceneSettings
  suede: SuedeMaterialParams
  backColor: string
  /** world size (scene units) the effect's longest side maps to. Tuned to match golden framing. */
  fitSize?: number
  onStatus?: (status: 'idle' | 'building' | 'ready' | 'error', message?: string) => void
  // ── editor↔3D bridge inputs (R7: passed in by ShapedModelBridge; this component never reads the store) ──
  /** = resolve(source, adjustments): the edited display vector, or null when unedited. Tessellated at display grade. */
  committedShape: VShape | null
  /** = contourFromShape(committedShape) @ 0.05mm: the edited contour, or null when unedited. */
  committedContourMM: Contour | null
  /** while true the editor overlay is open + the scene frozen → mesh rebuilds defer to the close boundary. */
  editorOpen: boolean
  /** live magic-blend intensity (null = build default on). */
  bgBlur: number | null
  /** live image adjustments (null = neutral). */
  imageFx: ImageFx | null
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

/**
 * KAI-8951 + REBUILD-PLAN-v2: the 3D silhouette equals the VECTOR silhouette at any zoom — for
 * EVERY design, not just edited ones (#18: truth is born at generation, so a fresh Magic shape
 * tessellates from its true curves too). Display-grade 0.004 mm chords (adaptive — straights
 * never subdivide), decoupled from the 0.05 mm manufacturing flatten.
 *
 * (R7) PURE: the vector to tessellate (`vs` — the committed edit, else the spec's born vector) is
 * passed IN by the caller; this helper no longer reads global state.
 */
function vectorTrueContour(fallback: Contour, vs: VShape | null | undefined, sp: { mmPerPx: number; maskHeightPx: number }): Contour {
  if (!vs) return fallback
  const k = sp.mmPerPx || 1
  try {
    const ring = flattenShape(vs, Math.max(0.01, DISPLAY_TOLERANCE_MM / k))[0]
    if (!ring || ring.length < 3) return fallback
    const H = sp.maskHeightPx
    return { outer: { pts: ring.map((pt) => [pt.x * k, (H - pt.y) * k] as Pt).reverse() }, holes: [] }
  } catch {
    return fallback
  }
}

/** MeshOptions from the build config + the prepared spec's px↔mm mapping. */
function meshOpts(prepared: PreparedEffect) {
  return {
    thicknessMM: EFFECT_BUILD_CONFIG.thicknessMM,
    edgeRadiusMM: EFFECT_BUILD_CONFIG.edgeRadiusMM,
    edgeSegments: EFFECT_BUILD_CONFIG.edgeSegments,
    mmPerPx: prepared.spec.mmPerPx,
    imgW: prepared.spec.maskWidthPx,
    imgH: prepared.spec.maskHeightPx,
  }
}

export default function ShapedModel({
  prepared,
  designState,
  scene: sceneSettings,
  suede,
  backColor,
  fitSize = 0.09,
  onStatus,
  committedShape,
  committedContourMM,
  editorOpen,
  bgBlur,
  imageFx,
}: ShapedModelProps) {
  const [result, setResult] = useState<{ geometry: THREE.BufferGeometry; texture: THREE.CanvasTexture; edgeTexture: THREE.CanvasTexture; widthMM: number; heightMM: number } | null>(null)
  const artTexRef = useRef<THREE.CanvasTexture | null>(null)
  const frontSrcRef = useRef<{ origCanvas: HTMLCanvasElement; subjCanvas: HTMLCanvasElement; defaultBlurPx: number } | null>(null)
  const resultRef = useRef(result)
  useEffect(() => { resultRef.current = result }, [result])

  // (R7) Latest-value mirrors of the committed geometry props. The [prepared] build effect runs only
  // on a prepared change but must use the CURRENT committed edit (e.g. a snapshot restore installs a
  // new prepared AND a committed shape together) — refs give it the latest value without re-firing on
  // every edit (the deferred-rebuild effects below own per-edit rebuilds). Replaces the old
  // getState() reads with prop-sourced refs, preserving the exact timing.
  const committedShapeRef = useRef(committedShape)
  useEffect(() => { committedShapeRef.current = committedShape }, [committedShape])
  const committedContourRef = useRef(committedContourMM)
  useEffect(() => { committedContourRef.current = committedContourMM }, [committedContourMM])

  // §6.1: demand frameloop — force a render whenever the built mesh/texture changes, else the scene
  // can sit BLANK until a user interaction invalidates (the V2 blank-on-mount class).
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)
  useEffect(() => { invalidate() }, [result, invalidate])

  // G2: anisotropic filtering on the front texture (sharp artwork at grazing angles).
  const maxAniso = useMemo(() => Math.min(8, gl.capabilities.getMaxAnisotropy?.() ?? 1), [gl])

  // Build the mesh from the prepared effect (ONE engine — no image build here). If a committed edited
  // outline exists for THIS spec, build from that so the object reflects the edit (refs = latest).
  useEffect(() => {
    onStatus?.('building')
    const t0 = performance.now()
    try {
      const geom = vectorTrueContour(committedContourRef.current ?? prepared.spec.geometryMM, committedShapeRef.current ?? prepared.spec.vectorShape, prepared.spec)
      const r = buildMeshFromSpec(geom, meshOpts(prepared), prepared.composite, prepared.edgeComposite)
      r.texture.anisotropy = maxAniso
      setResult((prev) => {
        prev?.geometry.dispose(); prev?.texture.dispose(); prev?.edgeTexture.dispose()
        return r
      })
      artTexRef.current = r.texture
      frontSrcRef.current = prepared.frontSrc
      onStatus?.('ready')
      perfGesture('mesh-build', performance.now() - t0)
    } catch (e) {
      console.error('[effect] mesh build failed:', e)
      onStatus?.('error', (e as Error)?.message ?? 'build failed')
    }
    // Build ONLY on prepared change (onStatus is an unstable inline callback — excluded by design;
    // committed* are read via refs so edits don't re-fire this build — the deferred effects own that).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared])

  // editor → 3D, DEFERRED to the editor boundary (§6.3): while the overlay is open the scene is
  // frozen, so rebuilding per commit is wasted work. Track the latest committed contour; when the
  // editor CLOSES (editorOpen flips false) with a pending edit, fire ONE rebuild.
  const pendingContourRef = useRef<Contour | null>(null)
  const pendingBaseRef = useRef(false) // a restore-to-UNEDITED arrived while the editor was open
  useEffect(() => {
    if (!committedContourMM) {
      pendingContourRef.current = null
      // #23 fix: contour → null means a restore to the UNEDITED outline (global undo/redo/reset).
      // The old early-return here left the edited mesh on screen — history stepped, object didn't.
      // Rebuild from the spec's base geometry (same Contour type, same rebuild path).
      if (!resultRef.current) return // nothing built yet (initial mount) — the [prepared] build owns it
      if (editorOpen) { pendingBaseRef.current = true; return } // defer to the editor boundary
      pendingBaseRef.current = false
      rebuildFromBase()
      return
    }
    pendingBaseRef.current = false
    if (editorOpen) { pendingContourRef.current = committedContourMM; return } // defer
    pendingContourRef.current = null
    rebuildFromContour(committedContourMM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedContourMM])
  useEffect(() => {
    if (editorOpen) return
    if (pendingContourRef.current) {
      const c = pendingContourRef.current
      pendingContourRef.current = null
      rebuildFromContour(c)
    } else if (pendingBaseRef.current) {
      pendingBaseRef.current = false
      rebuildFromBase()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen])

  function rebuildFromBase() {
    rebuildFromContour(prepared.spec.geometryMM)
  }

  function rebuildFromContour(contour: Contour) {
    const prev = resultRef.current
    if (!prev) return
    const sp = prepared.spec
    const t0 = performance.now()
    let built: { geometry: THREE.BufferGeometry; widthMM: number; heightMM: number }
    try {
      built = buildShapedGeometry(vectorTrueContour(contour, committedShapeRef.current, sp), {
        thicknessMM: EFFECT_BUILD_CONFIG.thicknessMM,
        edgeRadiusMM: EFFECT_BUILD_CONFIG.edgeRadiusMM,
        edgeSegments: EFFECT_BUILD_CONFIG.edgeSegments,
        mmPerPx: sp.mmPerPx,
        imgW: sp.maskWidthPx,
        imgH: sp.maskHeightPx,
      })
    } catch (e) {
      console.warn('[effect] edited-outline mesh rebuild failed:', e)
      return
    }
    setResult((p) => {
      if (!p) { built.geometry.dispose(); return p }
      p.geometry.dispose() // swap geometry only; keep p.texture / p.edgeTexture
      return { ...p, geometry: built.geometry, widthMM: built.widthMM, heightMM: built.heightMM }
    })
    perfGesture('mesh-rebuild', performance.now() - t0)
  }

  // editor → 3D: live "magic blend" intensity. Re-compose the front texture from the cached source
  // layers (no re-segmentation) when the editor changes the blur. bgBlur null = build default already on.
  // This is a canvas CONTENT change — a fresh CanvasTexture upload is correct here (commit-on-release).
  useEffect(() => {
    if (bgBlur == null && imageFx == null) return
    const fs = frontSrcRef.current
    if (!fs) return
    const blurVal = bgBlur == null ? 0.5 : bgBlur // null = build default (on @ ~50%)
    const px = blurVal <= 0 ? 0 : blurVal * (fs.origCanvas.width / 25) // 0 = off (sharp); ~0.5 ≈ build default
    const fx = imageFx
      ? `brightness(${imageFx.brightness}%) contrast(${imageFx.contrast}%) saturate(${imageFx.saturate}%)${imageFx.warmth > 0 ? ` sepia(${Math.round(imageFx.warmth * 0.45)}%)` : ''}`
      : ''
    const front = composeFront(fs.origCanvas, fs.subjCanvas, px, fx)
    const tex = new THREE.CanvasTexture(front)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = false
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.anisotropy = maxAniso
    tex.needsUpdate = true
    artTexRef.current = tex
    setResult((p) => {
      if (!p) { tex.dispose(); return p }
      p.texture.dispose() // swap the front texture only
      return { ...p, texture: tex }
    })
  }, [bgBlur, imageFx, maxAniso])

  // suede texture maps (normal/roughness/bump) on UV CHANNEL 1 (world-XY) → tiles by physical size,
  // never stretches (on the front OR the rim). The image map stays on channel 0 (position).
  const suedeTex = (url: string | undefined) => { const t = loadTex(url); if (t) t.channel = 1; return t }
  const normalMap = useMemo(() => suedeTex(suede.normalMap), [suede.normalMap])
  const roughnessMap = useMemo(() => suedeTex(suede.roughnessMap), [suede.roughnessMap])
  const bumpMap = useMemo(() => suedeTex(suede.bumpMap), [suede.bumpMap])
  // Dan meta-QA finding 2026-06-11: the suede maps load async — for the first frames the material
  // had no micro-roughness, read glossy, and MIRRORED the (deliberately low-res) HDRI as a
  // pixelated flash. Defer the mesh's FIRST paint until every map's image data is in (TextureLoader
  // populates `.image` on load; a brief poll keeps this dumb and dependency-free — zero cost once
  // cached). Hook count is constant; the gate lives at the bottom return, below every hook.
  const [suedeMapsReady, setSuedeMapsReady] = useState(false)
  useEffect(() => {
    const maps = [normalMap, roughnessMap, bumpMap].filter((m): m is THREE.Texture => !!m)
    if (maps.every((m) => m.image)) { setSuedeMapsReady(true); return }
    setSuedeMapsReady(false)
    let ticks = 0
    const id = window.setInterval(() => {
      // ~5s ceiling: a map that never loads must degrade to visible, not block the product
      if (maps.every((m) => m.image) || ++ticks > 300) {
        window.clearInterval(id)
        setSuedeMapsReady(true)
        invalidate()
      }
    }, 16)
    return () => window.clearInterval(id)
  }, [normalMap, roughnessMap, bumpMap, invalidate])

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
  // doesn't catch the sheen/Fresnel highlight the flat front never shows.
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

  // dispose replaced materials (G10 hygiene — replaced MeshPhysicalMaterials leaked before)
  const prevMaterialsRef = useRef<THREE.Material[]>([])
  useEffect(() => {
    const next: THREE.Material[] = [frontMaterial, edgeMaterial, backMaterial]
    for (const m of prevMaterialsRef.current) if (!next.includes(m)) m.dispose()
    prevMaterialsRef.current = next
  }, [frontMaterial, edgeMaterial, backMaterial])

  // G1 pan/zoom on the front artwork texture — MATRIX-ONLY (repeat/offset; NO needsUpdate, which
  // would force a full ~23 MB canvas→GPU re-upload per pointer event). invalidate() renders the change.
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
    invalidate() // demand frameloop: re-render on pan/zoom change
  }, [designState, result, invalidate])

  // unmount hygiene: release the GPU resources this component owns
  useEffect(() => () => {
    const r = resultRef.current
    r?.geometry.dispose(); r?.texture.dispose(); r?.edgeTexture.dispose()
    for (const m of prevMaterialsRef.current) m.dispose()
  }, [])

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

  if (!result || !suedeMapsReady) {
    // no naked first paint: until geometry AND the suede skin are ready, light only —
    // a bare glossy material would mirror the HDRI (Dan's pixelated-flash finding)
    return <ambientLight intensity={sceneSettings.ambientIntensity} />
  }

  return (
    <>
      <ambientLight intensity={sceneSettings.ambientIntensity} />
      <Center>
        <group>
          <mesh geometry={result.geometry} material={materials} scale={scale} castShadow receiveShadow />
        </group>
      </Center>
    </>
  )
}
