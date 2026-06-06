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
  fitSize?: number
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
  fitSize = 0.15,
  onSpec,
  onStatus,
}: ShapedModelProps) {
  const [result, setResult] = useState<{ geometry: THREE.BufferGeometry; texture: THREE.CanvasTexture; widthMM: number; heightMM: number } | null>(null)
  const artTexRef = useRef<THREE.CanvasTexture | null>(null)

  // Run the pipeline whenever the artwork changes
  useEffect(() => {
    let cancelled = false
    if (!artworkUrl) {
      // clear any stale mesh when artwork is removed
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult((prev) => { prev?.geometry.dispose(); prev?.texture.dispose(); return null })
      return
    }
    onStatus?.('building')
    buildShape(artworkUrl, DEFAULT_BUILD_CONFIG)
      .then((r) => {
        if (cancelled) { r.geometry.dispose(); r.texture.dispose(); return }
        setResult((prev) => {
          prev?.geometry.dispose()
          prev?.texture.dispose()
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

  // suede texture maps (normal/roughness/bump) — reuse the scene's ultrasuede set
  const normalMap = useMemo(() => loadTex(suede.normalMap), [suede.normalMap])
  const roughnessMap = useMemo(() => loadTex(suede.roughnessMap), [suede.roughnessMap])
  const bumpMap = useMemo(() => loadTex(suede.bumpMap), [suede.bumpMap])

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

  const backMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(backColor),
      normalMap,
      normalScale: new THREE.Vector2(suede.normalScale, suede.normalScale),
      bumpMap,
      bumpScale: suede.bumpScale,
      roughnessMap,
      roughness: suede.roughness,
      metalness: 0,
      sheen: suede.sheen,
      sheenColor: new THREE.Color(suede.sheenColor),
      sheenRoughness: suede.sheenRoughness,
      envMapIntensity: suede.envMapIntensity,
      side: THREE.DoubleSide,
    })
  }, [backColor, normalMap, roughnessMap, bumpMap, suede])

  // design-state pan/zoom on the front artwork texture (same model as the golden configurator)
  useEffect(() => {
    const tex = artTexRef.current
    if (!tex) return
    const repeat = 1 / designState.scale
    tex.repeat.set(repeat, repeat)
    const centerOffset = (1 - repeat) / 2
    tex.offset.set(
      centerOffset + designState.offsetX * repeat,
      centerOffset + designState.offsetY * repeat
    )
    tex.needsUpdate = true
  }, [designState, result])

  const materials = useMemo(() => [frontMaterial, backMaterial], [frontMaterial, backMaterial])

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
