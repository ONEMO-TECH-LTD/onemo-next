// ShapedModel — renders the prepared effect mesh inside the golden scene (Phase B / Lane A / Kai).
// ONE ENGINE (§8.2b-2): consumes the SAME `prepared` effect the Phase-A 2D hero (Effect2D) shows —
// the mesh extrudes the same mm outline (silhouette parity) and the textures ARE the same composite
// (composite parity). It does NOT build geometry from the image; `prepareEffect` (pure 2D) already did
// that. Reuses the scene's suede material params, lighting, camera, env.

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

interface ShapedModelProps {
  /** The 2D-prepared effect (geometry + composites) — the SAME one Effect2D shows (parity). */
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
  const bgBlur = useOutlineStore((s) => s.bgBlur)
  const frontSrcRef = useRef<{ origCanvas: HTMLCanvasElement; subjCanvas: HTMLCanvasElement; defaultBlurPx: number } | null>(null)
  const resultRef = useRef(result)
  useEffect(() => { resultRef.current = result }, [result])

  // demand frameloop: force a render whenever the built mesh/texture changes — else the scene mounts BLANK
  // (the initial demand frame fires before the async mesh build finishes) until a user interaction invalidates.
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => { invalidate() }, [result, invalidate])

  // Build the mesh from the prepared effect (ONE engine — no image build here). If the editor has
  // already committed an edited outline (Phase A), build from THAT so entering 3D reflects the edit.
  useEffect(() => {
    onStatus?.('building')
    try {
      const ed = useOutlineStore.getState().editedContourMM
      const geom = ed ?? prepared.spec.geometryMM
      const r = buildMeshFromSpec(geom, meshOpts(prepared), prepared.composite, prepared.edgeComposite)
      setResult((prev) => {
        prev?.geometry.dispose(); prev?.texture.dispose(); prev?.edgeTexture.dispose()
        return r
      })
      artTexRef.current = r.texture
      frontSrcRef.current = prepared.frontSrc
      onStatus?.('ready')
    } catch (e) {
      console.error('[effect] mesh build failed:', e)
      onStatus?.('error', (e as Error)?.message ?? 'build failed')
    }
    // Build ONLY on prepared change (onStatus is an unstable inline callback — excluded by design).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared])

  // editor → 3D: when the 2D editor commits an edited outline, rebuild ONLY the mesh geometry from it
  // (px→mm already done in the editor) and swap it in — REUSING the existing front/edge textures (no
  // re-segmentation). The suede object follows the 2D edits; the approved shape is exactly what's shown.
  useEffect(() => {
    if (!editedContourMM) return
    const prev = resultRef.current
    const sp = useOutlineStore.getState().spec
    if (!prev || !sp) return
    let built: { geometry: THREE.BufferGeometry; widthMM: number; heightMM: number }
    try {
      built = buildShapedGeometry(editedContourMM, {
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

  // design-state pan/zoom on the front artwork texture (same model as the golden configurator)
  useEffect(() => {
    const repeat = 1 / designState.scale
    const centerOffset = (1 - repeat) / 2
    const ox = centerOffset + designState.offsetX * repeat
    const oy = centerOffset + designState.offsetY * repeat
    const tex = artTexRef.current
    if (tex) {
      tex.repeat.set(repeat, repeat)
      tex.offset.set(ox, oy)
      tex.needsUpdate = true
    }
    invalidate() // demand frameloop: re-render on pan/zoom change
  }, [designState, result, invalidate])

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
