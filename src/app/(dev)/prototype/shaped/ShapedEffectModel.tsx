'use client'

import { Center } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildShapedGeometryFromMask } from './shape-geometry'
import type { BinaryMask, ShapeMeshStats } from './shape-spec'

interface ShapedEffectModelProps {
  artworkUrl: string
  mask: BinaryMask
  onStats?: (stats: ShapeMeshStats | null) => void
}

const ULTRASUEDE_TEXTURES = {
  normal: '/assets/materials/ultrasuede/suede-normal.png',
  roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
  height: '/assets/materials/ultrasuede/suede-height.png',
}

const textureCache = new Map<string, THREE.Texture>()

function loadTexture(url: string, color = false) {
  const cacheKey = `${url}::${color ? 'color' : 'data'}`
  const cached = textureCache.get(cacheKey)
  if (cached) return cached

  const texture = new THREE.TextureLoader().load(url, (loaded) => {
    loaded.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    loaded.wrapS = THREE.ClampToEdgeWrapping
    loaded.wrapT = THREE.ClampToEdgeWrapping
    loaded.needsUpdate = true
  })
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  textureCache.set(cacheKey, texture)
  return texture
}

export default function ShapedEffectModel({ artworkUrl, mask, onStats }: ShapedEffectModelProps) {
  const artworkMap = useMemo(() => loadTexture(artworkUrl, true), [artworkUrl])
  const normalMap = useMemo(() => loadTexture(ULTRASUEDE_TEXTURES.normal), [])
  const roughnessMap = useMemo(() => loadTexture(ULTRASUEDE_TEXTURES.roughness), [])
  const bumpMap = useMemo(() => loadTexture(ULTRASUEDE_TEXTURES.height), [])

  const build = useMemo(() => {
    return buildShapedGeometryFromMask(mask)
  }, [mask])

  useEffect(() => {
    onStats?.(build?.stats ?? null)
  }, [build?.stats, onStats])

  useEffect(() => {
    /* eslint-disable react-hooks/immutability -- Three textures are imperative runtime objects. */
    ;[artworkMap, normalMap, roughnessMap, bumpMap].forEach((texture) => {
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.needsUpdate = true
    })
    artworkMap.colorSpace = THREE.SRGBColorSpace
    /* eslint-enable react-hooks/immutability */
  }, [artworkMap, normalMap, roughnessMap, bumpMap])

  const frontAndEdgeMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      map: artworkMap,
      normalMap,
      normalScale: new THREE.Vector2(0.15, 0.15),
      roughnessMap,
      bumpMap,
      bumpScale: 1,
      color: new THREE.Color('#ffffff'),
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.1,
      sheen: 1,
      sheenColor: new THREE.Color('#1a1a1a'),
      sheenRoughness: 0.8,
      side: THREE.DoubleSide,
    })
  }, [artworkMap, bumpMap, normalMap, roughnessMap])

  const backMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      normalMap,
      normalScale: new THREE.Vector2(0.15, 0.15),
      roughnessMap,
      bumpMap,
      bumpScale: 1,
      color: new THREE.Color('#080808'),
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.1,
      sheen: 1,
      sheenColor: new THREE.Color('#1a1a1a'),
      sheenRoughness: 0.8,
      side: THREE.DoubleSide,
    })
  }, [bumpMap, normalMap, roughnessMap])

  if (!build) {
    return null
  }

  return (
    <>
      <ambientLight intensity={0.5} />
      <Center>
        <mesh geometry={build.geometry} material={[frontAndEdgeMaterial, backMaterial]} rotation={[0, 0, 0]} />
      </Center>
    </>
  )
}
