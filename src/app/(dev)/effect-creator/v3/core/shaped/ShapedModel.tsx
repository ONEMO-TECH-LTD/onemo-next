// ShapedModel — renders the prepared effect mesh inside the persistent golden scene (V3).
//
// ONE ENGINE (§3.3): consumes the `prepared` effect from `prepareEffect` (pure 2D) — the mesh
// extrudes the same mm outline the editor shows and the cutline uses (silhouette parity); the
// textures ARE the same composite (composite parity). It never builds geometry from the image.
//
// V3 contracts honoured here:
//  • §6.1 no blank mount — `invalidate()` fires on every async content arrival (mesh built, texture
//    swapped), so demand-frameloop renders the object the moment it exists.
//  • §6.3 matrix-only texture transforms — pan/zoom (G1) touches repeat/offset ONLY; `needsUpdate`
//    forces a ~23 MB canvas→GPU re-upload per event and is reserved for canvas CONTENT changes.
//  • §6.3 deferred rebuilds — while the editor overlay is open (scene frozen) edited-outline mesh
//    rebuilds are DEFERRED; ONE rebuild fires at the editor-close boundary.
//  • G2 — anisotropic filtering on the front texture so the full-res artwork stays sharp at angles.
//  • Phase 3 — back-cap attachment visualization (magnet anchor dots; red flap-risk locators).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Center } from '@react-three/drei'
import * as THREE from 'three'
import type { DesignState, SceneSettings } from '../../types'
import type { SuedeMaterialParams } from '@/lib/effect/types'
import { EFFECT_BUILD_CONFIG, type PreparedEffect } from '@/lib/effect/prepare-effect'
import { buildMeshFromSpec } from '@/lib/effect/build-mesh'
import { buildShapedGeometry } from '@/lib/effect/mesh'
import { composeFront } from '@/lib/effect/composite'
import { useOutlineStore } from '../../user/outlineStore'
import { useAttachmentStore } from '../../user/attachmentStore'
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
}: ShapedModelProps) {
  const [result, setResult] = useState<{ geometry: THREE.BufferGeometry; texture: THREE.CanvasTexture; edgeTexture: THREE.CanvasTexture; widthMM: number; heightMM: number } | null>(null)
  const artTexRef = useRef<THREE.CanvasTexture | null>(null)
  const editedContourMM = useOutlineStore((s) => s.editedContourMM)
  const editorOpen = useOutlineStore((s) => s.editorOpen)
  const bgBlur = useOutlineStore((s) => s.bgBlur)
  const imageFx = useOutlineStore((s) => s.imageFx)
  const attachment = useAttachmentStore((s) => s.result)
  const frontSrcRef = useRef<{ origCanvas: HTMLCanvasElement; subjCanvas: HTMLCanvasElement; defaultBlurPx: number } | null>(null)
  const resultRef = useRef(result)
  useEffect(() => { resultRef.current = result }, [result])

  // §6.1: demand frameloop — force a render whenever the built mesh/texture changes, else the scene
  // can sit BLANK until a user interaction invalidates (the V2 blank-on-mount class).
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)
  useEffect(() => { invalidate() }, [result, attachment, invalidate])

  // G2: anisotropic filtering on the front texture (sharp artwork at grazing angles).
  const maxAniso = useMemo(() => Math.min(8, gl.capabilities.getMaxAnisotropy?.() ?? 1), [gl])

  // Build the mesh from the prepared effect (ONE engine — no image build here). If the editor has
  // already committed an edited outline for THIS spec, build from that so the object reflects the edit.
  useEffect(() => {
    onStatus?.('building')
    const t0 = performance.now()
    try {
      const ed = useOutlineStore.getState().editedContourMM
      const geom = ed ?? prepared.spec.geometryMM
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
    // Build ONLY on prepared change (onStatus is an unstable inline callback — excluded by design).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared])

  // editor → 3D, DEFERRED to the editor boundary (§6.3): while the overlay is open the scene is
  // frozen, so rebuilding per commit is wasted work. Track the latest committed contour; when the
  // editor CLOSES (editorOpen flips false) with a pending edit, fire ONE rebuild.
  const pendingContourRef = useRef<typeof editedContourMM>(null)
  useEffect(() => {
    if (!editedContourMM) { pendingContourRef.current = null; return }
    if (editorOpen) { pendingContourRef.current = editedContourMM; return } // defer
    pendingContourRef.current = null
    rebuildFromContour(editedContourMM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedContourMM])
  useEffect(() => {
    if (editorOpen || !pendingContourRef.current) return
    const c = pendingContourRef.current
    pendingContourRef.current = null
    rebuildFromContour(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen])

  function rebuildFromContour(contour: NonNullable<typeof editedContourMM>) {
    const prev = resultRef.current
    const sp = useOutlineStore.getState().spec
    if (!prev || !sp) return
    const t0 = performance.now()
    let built: { geometry: THREE.BufferGeometry; widthMM: number; heightMM: number }
    try {
      built = buildShapedGeometry(contour, {
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

  // ── Phase 3: attachment visualization — magnet anchors as flush dots on the BACK cap; flap-risk
  // locators in red on the silhouette. Anchors arrive in FINAL-physical-mm; the mesh is BASE-mm —
  // map final→base by the inverse size scale, then into this mesh's centred coordinate space.
  const attachmentViz = useMemo(() => {
    if (!attachment || !result) return null
    const sp = useOutlineStore.getState().spec
    if (!sp) return null
    const contour = useOutlineStore.getState().editedContourMM ?? sp.geometryMM
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [x, y] of contour.outer.pts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    const baseLongest = Math.max(maxX - minX, maxY - minY) || 1
    // attachment ran on FINAL-physical-mm (base × band scale); invert the uniform band scale to
    // place dots on this base-mm mesh.
    const finalLongest = baseLongest * (useAttachmentStore.getState().size === 's140' ? 2 : 1)
    const s = baseLongest / finalLongest // final mm → base mm
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    const zBack = -(EFFECT_BUILD_CONFIG.thicknessMM / 2) - 0.05
    const toLocal = ([x, y]: [number, number]): [number, number, number] => [x * s - cx, y * s - cy, zBack]
    return {
      anchors: attachment.anchors.map(toLocal),
      locators: attachment.locators.map(toLocal),
      dotR: Math.max(1.6, baseLongest * 0.025),
    }
  }, [attachment, result])

  if (!result) {
    return <ambientLight intensity={sceneSettings.ambientIntensity} />
  }

  return (
    <>
      <ambientLight intensity={sceneSettings.ambientIntensity} />
      <Center>
        <group>
          <mesh geometry={result.geometry} material={materials} scale={scale} castShadow receiveShadow />
          {attachmentViz && (
            <group scale={scale}>
              {attachmentViz.anchors.map(([x, y, z], i) => (
                /* flush metal disc on the back cap (cylinder axis Y → rotate into the XY plane) */
                <mesh key={`a${i}`} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[attachmentViz.dotR, attachmentViz.dotR, 0.4, 24]} />
                  <meshStandardMaterial color="#8a93ad" metalness={0.85} roughness={0.35} />
                </mesh>
              ))}
              {attachmentViz.locators.map(([x, y, z], i) => (
                <mesh key={`l${i}`} position={[x, y, z]}>
                  <sphereGeometry args={[attachmentViz.dotR * 0.8, 16, 16]} />
                  <meshBasicMaterial color="#ff5a5a" />
                </mesh>
              ))}
            </group>
          )}
        </group>
      </Center>
    </>
  )
}
