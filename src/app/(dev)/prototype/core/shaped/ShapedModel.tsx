// ShapedModel — renders the generated cut-out mesh inside the golden scene (Lane A / Kai).
// Replaces the GLB object; reuses the scene's suede material params, lighting, camera, env.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Center } from '@react-three/drei'
import * as THREE from 'three'
import type { DesignState, SceneSettings } from '../../types'
import type { SuedeMaterialParams, ShapeSpecDraft } from './types'
import { buildShape, DEFAULT_BUILD_CONFIG } from './pipeline'

interface ShapedModelProps {
  artworkUrl?: string
  designState: DesignState
  scene: SceneSettings
  suede: SuedeMaterialParams
  backColor: string
  /** world size (scene units) the cut-out's longest side maps to. Tuned to match golden framing. */
  fitSize?: number // see default below
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
  onSpec,
  onStatus,
}: ShapedModelProps) {
  const [result, setResult] = useState<{ geometry: THREE.BufferGeometry; texture: THREE.CanvasTexture; edgeTexture: THREE.CanvasTexture; widthMM: number; heightMM: number } | null>(null)
  const artTexRef = useRef<THREE.CanvasTexture | null>(null)

  // Run the pipeline whenever the artwork changes
  useEffect(() => {
    let cancelled = false
    if (!artworkUrl) {
      // clear any stale mesh when artwork is removed
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult((prev) => { prev?.geometry.dispose(); prev?.texture.dispose(); prev?.edgeTexture.dispose(); return null })
      return
    }
    onStatus?.('building')
    buildShape(artworkUrl, DEFAULT_BUILD_CONFIG)
      .then((r) => {
        if (cancelled) { r.geometry.dispose(); r.texture.dispose(); r.edgeTexture.dispose(); return }
        setResult((prev) => {
          prev?.geometry.dispose()
          prev?.texture.dispose()
          prev?.edgeTexture.dispose()
          return r
        })
        artTexRef.current = r.texture
        onSpec?.(r.spec)
        onStatus?.('ready')
      })
      .catch((e) => {
        if (cancelled) return
        console.error('[shaped] build failed:', e)
        onStatus?.('error', e?.message ?? 'build failed')
      })
    return () => { cancelled = true }
  }, [artworkUrl, onSpec, onStatus])

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

  // Edge uses the EXACT SAME material as the front (frontMaterial) — see `materials` below.
  // The rim's image (channel 0 position UV) wraps slightly over the rounded edge and fades into the
  // bled colour; suede (channel 1 world-XY) doesn't stretch. No separate edge material.

  // EDGE = the front image rolling over the lip (edge band UV), but DARKER, BLURRED (edgeTexture)
  // and fully MATTE / reflectivity 0 (Dan). Same suede maps (channel 1). Standard material, not a
  // custom shader; map is the front image (blurred), not a generated contour strip.
  const edgeMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      map: result?.edgeTexture ?? null,
      color: new THREE.Color(0x808080), // darken the rolled-over image
      normalMap,
      normalScale: new THREE.Vector2(suede.normalScale, suede.normalScale),
      bumpMap,
      bumpScale: suede.bumpScale,
      roughnessMap,
      roughness: 1,
      metalness: 0,
      specularIntensity: 0, // reflectivity 0 → no gloss
      sheen: 0,
      clearcoat: 0,
      envMapIntensity: 0,
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
  }, [designState, result])

  // geometry groups: 0 = edge+front (front material — image wraps inward over the lip), 1 = back
  // geometry groups: 0 = front cap, 1 = edge lip, 2 = back cap
  const materials = useMemo(() => [frontMaterial, edgeMaterial, backMaterial], [frontMaterial, edgeMaterial, backMaterial])

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
