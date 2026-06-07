'use client'

import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { DesignState, SceneSettings, ViewerMaterialRole, ViewerProductConfig } from '../types'
import { loadImageElement, segmentImageToMask } from './browser-segmentation'
import { createShapeSpecDraftFromMask } from './contour'
import { createRoundedShapeGeometry } from './mesh-builder'
import type { ShapeSpecDraft, ShapedPreviewSettings } from './shape-spec'

interface ShapedPreviewProps {
  artworkUrl: string
  designState: DesignState
  scene: SceneSettings
  product?: ViewerProductConfig
  settings: ShapedPreviewSettings
  onDraftChange?: (draft: ShapeSpecDraft | null) => void
  onErrorChange?: (message: string | null) => void
}

const textureCache = new Map<string, THREE.Texture>()

function loadMaterialTexture(
  url: string | undefined,
  {
    color = false,
    repeat = false,
  }: { color?: boolean; repeat?: boolean } = {}
) {
  if (!url) return null

  const cacheKey = `${url}::${color ? 'color' : 'data'}::${repeat ? 'repeat' : 'clamp'}`
  const cached = textureCache.get(cacheKey)
  if (cached) return cached

  const texture = new THREE.TextureLoader().load(url, (loaded) => {
    loaded.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    loaded.wrapS = loaded.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
    loaded.needsUpdate = true
  })
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.wrapS = texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  textureCache.set(cacheKey, texture)
  return texture
}

function createGoldenFaceMaterial(role: ViewerMaterialRole | undefined, artworkMap: THREE.Texture) {
  const defaults = role?.defaults ?? {}
  const textures = role?.textures ?? {}
  const colorMultiplier = Number(defaults.colorMultiplier ?? 1)

  return new THREE.MeshPhysicalMaterial({
    map: artworkMap,
    color: new THREE.Color(colorMultiplier, colorMultiplier, colorMultiplier),
    normalMap: loadMaterialTexture(textures.normalMap, { color: false }),
    normalScale: new THREE.Vector2(
      Number(defaults.normalScale ?? 0.15),
      Number(defaults.normalScale ?? 0.15)
    ),
    bumpMap: loadMaterialTexture(textures.bumpMap, { color: false }),
    bumpScale: Number(defaults.bumpScale ?? 1),
    roughnessMap: loadMaterialTexture(textures.roughnessMap, { color: false }),
    roughness: Number(defaults.roughness ?? 1),
    metalness: Number(defaults.metalness ?? 0),
    sheen: Number(defaults.sheen ?? 1),
    sheenColor: new THREE.Color(defaults.sheenColor ?? '#1a1a1a'),
    sheenRoughness: Number(defaults.sheenRoughness ?? 0.8),
    envMapIntensity: Number(defaults.envMapIntensity ?? 0.1),
    clearcoat: Number(defaults.clearcoat ?? 0),
    clearcoatRoughness: Number(defaults.clearcoatRoughness ?? 0),
    side: THREE.DoubleSide,
  })
}

function createGoldenSolidSuedeMaterial(role: ViewerMaterialRole | undefined, color: string) {
  const defaults = role?.defaults ?? {}
  const textures = role?.textures ?? {}

  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    normalMap: loadMaterialTexture(textures.normalMap, { color: false }),
    normalScale: new THREE.Vector2(
      Number(defaults.normalScale ?? 0.15),
      Number(defaults.normalScale ?? 0.15)
    ),
    bumpMap: loadMaterialTexture(textures.bumpMap, { color: false }),
    bumpScale: Number(defaults.bumpScale ?? 1),
    roughnessMap: loadMaterialTexture(textures.roughnessMap, { color: false }),
    roughness: Number(defaults.roughness ?? 1),
    metalness: Number(defaults.metalness ?? 0),
    sheen: Number(defaults.sheen ?? 1),
    sheenColor: new THREE.Color(defaults.sheenColor ?? '#1a1a1a'),
    sheenRoughness: Number(defaults.sheenRoughness ?? 0.8),
    envMapIntensity: Number(defaults.envMapIntensity ?? 0.1),
    side: THREE.DoubleSide,
  })
}

function createArtworkTexture(loaded: { image: HTMLImageElement; width: number; height: number }) {
  const canvas = document.createElement('canvas')
  canvas.width = loaded.width
  canvas.height = loaded.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable for artwork texture.')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(loaded.image, 0, 0, loaded.width, loaded.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 16
  texture.needsUpdate = true
  return texture
}

export default function ShapedPreview({
  artworkUrl,
  designState,
  scene,
  product,
  settings,
  onDraftChange,
  onErrorChange,
}: ShapedPreviewProps) {
  const [draft, setDraft] = useState<ShapeSpecDraft | null>(null)
  const [frontTexture, setFrontTexture] = useState<THREE.Texture | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function build() {
      try {
        const loaded = await loadImageElement(artworkUrl)
        if (cancelled) return

        const mask = segmentImageToMask(loaded, settings)
        const nextDraft = createShapeSpecDraftFromMask({
          sourceRef: artworkUrl,
          sourceWidth: loaded.width,
          sourceHeight: loaded.height,
          mask,
          settings,
        })
        const nextFrontTexture = createArtworkTexture(loaded)

        if (cancelled) {
          nextFrontTexture.dispose()
          return
        }

        setDraft(nextDraft)
        setError(null)
        onErrorChange?.(null)
        setFrontTexture((prev) => {
          prev?.dispose()
          return nextFrontTexture
        })
        onDraftChange?.(nextDraft)
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setError(message)
          setDraft(null)
          onDraftChange?.(null)
          onErrorChange?.(message)
        }
      }
    }

    build()

    return () => {
      cancelled = true
    }
  }, [artworkUrl, onDraftChange, onErrorChange, settings])

  useEffect(() => {
    return () => {
      frontTexture?.dispose()
    }
  }, [frontTexture])

  const geometry = useMemo(() => {
    if (!draft) return null
    return createRoundedShapeGeometry(draft)
  }, [draft])

  useEffect(() => {
    return () => geometry?.dispose()
  }, [geometry])

  const materials = useMemo(() => {
    if (!frontTexture) return null
    const faceRole = product?.artworkSlot
      ? product.materialRoles.find((role) => role.role === product.artworkSlot?.role)
      : product?.materialRoles.find((role) => role.role === 'face') ?? product?.materialRoles[0]
    const backRole = product?.materialRoles.find((role) => role.role === 'back') ?? faceRole

    const frontMaterial = createGoldenFaceMaterial(faceRole, frontTexture)
    return [
      frontMaterial,
      createGoldenSolidSuedeMaterial(backRole, String(backRole?.defaults?.color ?? '#080808')),
      frontMaterial,
    ]
  }, [frontTexture, product])

  useEffect(() => {
    return () => {
      const disposed = new Set<THREE.Material>()
      materials?.forEach((material) => {
        if (disposed.has(material)) return
        disposed.add(material)
        material.dispose()
      })
    }
  }, [materials])

  if (error) {
    return null
  }

  if (!geometry || !materials) {
    return null
  }

  return (
    <>
      <ambientLight intensity={scene.ambientIntensity} />
      <group
        position={[designState.offsetX * 0.08, designState.offsetY * 0.08, 0]}
        scale={[designState.scale, designState.scale, designState.scale]}
        rotation={[-0.08, 0.18, 0]}
      >
        <mesh geometry={geometry} material={materials} castShadow receiveShadow />
      </group>
    </>
  )
}
