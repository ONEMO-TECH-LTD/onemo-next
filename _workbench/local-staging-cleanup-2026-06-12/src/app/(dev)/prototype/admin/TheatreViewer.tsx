// TheatreViewer — wraps core/EffectViewer with Theatre.js Studio
// Theatre replaces Leva for all scene editing (materials, camera, environment, transforms)

'use client'

import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { SheetProvider, editable as e, PerspectiveCamera } from '@theatre/r3f'
import { OrbitControls, Environment, useGLTF, useTexture, Center } from '@react-three/drei'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { initTheatre, sheet } from './theatreSetup'
import type { DesignState } from '../types'

const DEFAULT_ARTWORK = '/assets/test-artwork.png'
const DEFAULT_MODEL = '/assets/shapes/effect-70mm-step.glb'

interface TheatreViewerProps {
  artworkUrl?: string
  designState: DesignState
  isEditing: boolean
}

// Theatre-wrapped EffectModel — each mesh is editable
function EditableEffectModel({
  artworkUrl,
  designState,
}: {
  artworkUrl: string
  designState: DesignState
}) {
  const { scene } = useGLTF(DEFAULT_MODEL)
  const faceMeshRef = useRef<THREE.Mesh | null>(null)
  const artworkTexRef = useRef<THREE.Texture | null>(null)

  // Load textures
  const [suedeNormal, suedeRoughness, suedeHeight] = useTexture([
    '/assets/materials/ultrasuede/suede-normal.png',
    '/assets/materials/ultrasuede/suede-roughness.jpg',
    '/assets/materials/ultrasuede/suede-height.png',
  ])
  ;[suedeNormal, suedeRoughness, suedeHeight].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  })

  // Load artwork
  const artworkMap = useMemo(() => {
    const tex = new THREE.TextureLoader().load(artworkUrl, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace
      loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping
      loaded.needsUpdate = true
      artworkTexRef.current = loaded
      if (faceMeshRef.current) {
        const mat = faceMeshRef.current.material as THREE.MeshPhysicalMaterial
        mat.map = loaded
        mat.needsUpdate = true
      }
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return tex
  }, [artworkUrl])

  // Apply design state
  useEffect(() => {
    const tex = artworkTexRef.current || artworkMap
    if (!tex) return
    const repeat = 1 / designState.scale
    tex.repeat.set(repeat, repeat)
    const centerOffset = (1 - repeat) / 2
    tex.offset.set(
      centerOffset - designState.offsetX * repeat,
      centerOffset - designState.offsetY * repeat
    )
    // eslint-disable-next-line react-hooks/immutability
    tex.needsUpdate = true
  }, [designState, artworkMap])

  // Create materials
  const faceMaterial = useMemo(() =>
    new THREE.MeshPhysicalMaterial({
      map: artworkMap,
      normalMap: suedeNormal,
      normalScale: new THREE.Vector2(0.15, 0.15),
      bumpMap: suedeHeight,
      bumpScale: 1.0,
      roughnessMap: suedeRoughness,
      roughness: 1.0,
      metalness: 0,
      sheen: 1.0,
      sheenColor: new THREE.Color('#1a1a1a'),
      sheenRoughness: 0.8,
      envMapIntensity: 0.1,
      side: THREE.DoubleSide,
    }),
  [artworkMap, suedeNormal, suedeHeight, suedeRoughness])

  const backMaterial = useMemo(() =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#080808'),
      normalMap: suedeNormal,
      normalScale: new THREE.Vector2(0.15, 0.15),
      bumpMap: suedeHeight,
      bumpScale: 1.0,
      roughnessMap: suedeRoughness,
      roughness: 1.0,
      sheen: 1.0,
      sheenColor: new THREE.Color('#1a1a1a'),
      sheenRoughness: 0.8,
      envMapIntensity: 0.1,
      side: THREE.DoubleSide,
    }),
  [suedeNormal, suedeHeight, suedeRoughness])

  const frameMaterial = useMemo(() =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#0f0f0f'),
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
    }),
  [])

  // Assign materials to meshes
  useMemo(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        switch (child.name) {
          case 'PRINT_SURFACE_FRONT': {
            child.material = faceMaterial
            faceMeshRef.current = child
            // Generate planar UVs
            const geo = child.geometry
            const posAttr = geo.getAttribute('position')
            const count = posAttr.count
            let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity
            for (let i = 0; i < count; i++) {
              const x = posAttr.getX(i); const y = posAttr.getY(i)
              if (x < xMin) xMin = x; if (x > xMax) xMax = x
              if (y < yMin) yMin = y; if (y > yMax) yMax = y
            }
            const xRange = xMax - xMin; const yRange = yMax - yMin
            const uvs = new Float32Array(count * 2)
            for (let i = 0; i < count; i++) {
              uvs[i * 2] = (posAttr.getX(i) - xMin) / xRange
              uvs[i * 2 + 1] = (posAttr.getY(i) - yMin) / yRange
            }
            geo.deleteAttribute('uv')
            geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
            break
          }
          case 'BACK': {
            child.material = backMaterial
            const geo = child.geometry; const pos = geo.getAttribute('position'); const cnt = pos.count
            let bxMin = Infinity, bxMax = -Infinity, byMin = Infinity, byMax = -Infinity
            for (let i = 0; i < cnt; i++) {
              const x = pos.getX(i); const y = pos.getY(i)
              if (x < bxMin) bxMin = x; if (x > bxMax) bxMax = x
              if (y < byMin) byMin = y; if (y > byMax) byMax = y
            }
            const bxR = bxMax - bxMin; const byR = byMax - byMin
            const buvs = new Float32Array(cnt * 2)
            for (let i = 0; i < cnt; i++) {
              buvs[i * 2] = (pos.getX(i) - bxMin) / bxR
              buvs[i * 2 + 1] = (pos.getY(i) - byMin) / byR
            }
            geo.deleteAttribute('uv')
            geo.setAttribute('uv', new THREE.BufferAttribute(buvs, 2))
            break
          }
          case 'FRAME':
            child.material = frameMaterial
            break
        }
      }
      if (child.name === 'NEW LIGHTS' || child instanceof THREE.Light) {
        child.visible = false
      }
    })
  }, [scene, faceMaterial, backMaterial, frameMaterial])

  useEffect(() => {
    if (faceMeshRef.current) {
      const mat = faceMeshRef.current.material as THREE.MeshPhysicalMaterial
      mat.map = artworkMap
      mat.needsUpdate = true
    }
  }, [artworkMap])

  return (
    <>
      <e.ambientLight theatreKey="Ambient Light" intensity={0.5} />
      <Center>
        <primitive object={scene} />
      </Center>
    </>
  )
}

export default function TheatreViewer({
  artworkUrl,
  designState,
  isEditing,
}: TheatreViewerProps) {
  // Initialize Theatre Studio on mount
  useEffect(() => {
    initTheatre()
  }, [])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#ffffff' }}>
      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 0.7,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[1, 2]}
      >
        <SheetProvider sheet={sheet}>
          <PerspectiveCamera
            theatreKey="Camera"
            makeDefault
            position={[0, 0, 0.2]}
            fov={35}
            near={0.001}
            far={100}
          />

          <Suspense fallback={null}>
            <e.group theatreKey="Environment">
              <Environment preset="studio" environmentIntensity={1.0} />
            </e.group>

            <EditableEffectModel
              artworkUrl={artworkUrl || DEFAULT_ARTWORK}
              designState={designState}
            />
          </Suspense>

          <OrbitControls
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.1}
            enabled={!isEditing}
          />
        </SheetProvider>
      </Canvas>
    </div>
  )
}
