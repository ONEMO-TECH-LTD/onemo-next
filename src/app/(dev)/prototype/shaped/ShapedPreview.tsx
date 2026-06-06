'use client'

import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { DesignState, SceneSettings } from '../types'
import { createEdgeBleedCanvas, loadImageElement, segmentImageToMask } from './browser-segmentation'
import { createShapeSpecDraftFromMask } from './contour'
import { createRoundedShapeGeometry } from './mesh-builder'
import type { ShapeSpecDraft, ShapedPreviewSettings } from './shape-spec'

interface ShapedPreviewProps {
  artworkUrl: string
  designState: DesignState
  scene: SceneSettings
  settings: ShapedPreviewSettings
  onDraftChange?: (draft: ShapeSpecDraft | null) => void
  onErrorChange?: (message: string | null) => void
}

export default function ShapedPreview({
  artworkUrl,
  designState,
  scene,
  settings,
  onDraftChange,
  onErrorChange,
}: ShapedPreviewProps) {
  const [draft, setDraft] = useState<ShapeSpecDraft | null>(null)
  const [frontTexture, setFrontTexture] = useState<THREE.Texture | null>(null)
  const [edgeTexture, setEdgeTexture] = useState<THREE.Texture | null>(null)
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
        const loader = new THREE.TextureLoader()
        const nextFrontTexture = await loader.loadAsync(artworkUrl)
        nextFrontTexture.colorSpace = THREE.SRGBColorSpace
        nextFrontTexture.wrapS = THREE.ClampToEdgeWrapping
        nextFrontTexture.wrapT = THREE.ClampToEdgeWrapping

        const bleedCanvas = createEdgeBleedCanvas(loaded, nextDraft.geometry_px.outer)
        const nextEdgeTexture = new THREE.CanvasTexture(bleedCanvas)
        nextEdgeTexture.colorSpace = THREE.SRGBColorSpace
        nextEdgeTexture.wrapS = THREE.RepeatWrapping
        nextEdgeTexture.wrapT = THREE.ClampToEdgeWrapping
        nextEdgeTexture.needsUpdate = true

        if (cancelled) {
          nextFrontTexture.dispose()
          nextEdgeTexture.dispose()
          return
        }

        setDraft(nextDraft)
        setError(null)
        onErrorChange?.(null)
        setFrontTexture((prev) => {
          prev?.dispose()
          return nextFrontTexture
        })
        setEdgeTexture((prev) => {
          prev?.dispose()
          return nextEdgeTexture
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
      edgeTexture?.dispose()
    }
  }, [frontTexture, edgeTexture])

  const geometry = useMemo(() => {
    if (!draft) return null
    return createRoundedShapeGeometry(draft)
  }, [draft])

  useEffect(() => {
    return () => geometry?.dispose()
  }, [geometry])

  const materials = useMemo(() => {
    if (!frontTexture || !edgeTexture) return null
    return [
      new THREE.MeshPhysicalMaterial({
        map: frontTexture,
        roughness: 0.82,
        metalness: 0,
        sheen: 0.65,
        sheenColor: new THREE.Color('#f4efe4'),
        sheenRoughness: 0.9,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshPhysicalMaterial({
        color: '#17130f',
        roughness: 0.94,
        metalness: 0,
        sheen: 0.7,
        sheenColor: new THREE.Color('#30251d'),
        sheenRoughness: 0.95,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshPhysicalMaterial({
        map: edgeTexture,
        roughness: 0.88,
        metalness: 0,
        sheen: 0.55,
        sheenColor: new THREE.Color('#eadfce'),
        sheenRoughness: 0.9,
        side: THREE.DoubleSide,
      }),
    ]
  }, [edgeTexture, frontTexture])

  useEffect(() => {
    return () => {
      materials?.forEach((material) => material.dispose())
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
