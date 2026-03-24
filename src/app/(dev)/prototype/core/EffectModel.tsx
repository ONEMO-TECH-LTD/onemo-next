// Core EffectModel — pure, prop-driven, no Leva, no store
// Receives all config as typed props. Both Studio and Create use this.

import { useMemo, useEffect, useRef } from 'react'
import { useGLTF, useTexture, Center } from '@react-three/drei'
import * as THREE from 'three'
import type {
  DesignState,
  FaceMaterialConfig,
  BackMaterialConfig,
  FrameMaterialConfig,
  SceneSettings,
  TexturePaths,
} from '../types'

interface EffectModelProps {
  modelPath: string
  artworkUrl: string
  designState: DesignState
  face: FaceMaterialConfig
  back: BackMaterialConfig
  frame: FrameMaterialConfig
  scene: SceneSettings
  textures: TexturePaths
}

export default function EffectModel({
  modelPath,
  artworkUrl,
  designState,
  face,
  back,
  frame,
  scene: sceneSettings,
  textures,
}: EffectModelProps) {
  const { scene } = useGLTF(modelPath)
  const faceMeshRef = useRef<THREE.Mesh | null>(null)
  const artworkTexRef = useRef<THREE.Texture | null>(null)

  // Load textures from config paths
  const [suedeNormal, suedeRoughness, suedeHeight] = useTexture([
    textures.normal,
    textures.roughness,
    textures.height,
  ])

  ;[suedeNormal, suedeRoughness, suedeHeight].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  })

  // Load artwork texture dynamically
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

  // Apply design state to artwork texture
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

  // FACE material — reactive to config props
  const faceMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      map: artworkMap,
      color: new THREE.Color(face.colorMultiplier, face.colorMultiplier, face.colorMultiplier),
      normalMap: suedeNormal,
      normalScale: new THREE.Vector2(face.normalScale, face.normalScale),
      bumpMap: suedeHeight,
      bumpScale: face.bumpScale,
      roughnessMap: suedeRoughness,
      roughness: face.roughness,
      metalness: face.metalness,
      sheen: face.sheen,
      sheenColor: new THREE.Color(face.sheenColor),
      sheenRoughness: face.sheenRoughness,
      envMapIntensity: face.envMapIntensity,
      side: THREE.DoubleSide,
    })
  }, [artworkMap, suedeNormal, suedeHeight, suedeRoughness, face])

  // FRAME material
  const frameMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(frame.color),
        roughness: frame.roughness,
        metalness: frame.metalness,
        clearcoat: frame.clearcoat,
        clearcoatRoughness: frame.clearcoatRoughness,
        side: THREE.DoubleSide,
      }),
    [frame]
  )

  // BACK material
  const backMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(back.color),
        normalMap: suedeNormal,
        normalScale: new THREE.Vector2(back.normalScale, back.normalScale),
        bumpMap: suedeHeight,
        bumpScale: back.bumpScale,
        roughnessMap: suedeRoughness,
        roughness: back.roughness,
        metalness: 0,
        sheen: back.sheen,
        sheenColor: new THREE.Color(back.sheenColor),
        sheenRoughness: back.sheenRoughness,
        envMapIntensity: back.envMapIntensity,
        side: THREE.DoubleSide,
      }),
    [suedeNormal, suedeHeight, suedeRoughness, back]
  )

  // Override materials and generate planar UVs
  useMemo(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        switch (child.name) {
          case 'PRINT_SURFACE_FRONT': {
            child.material = faceMaterial
            faceMeshRef.current = child

            const geo = child.geometry
            const posAttr = geo.getAttribute('position')
            const count = posAttr.count

            let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity
            for (let i = 0; i < count; i++) {
              const x = posAttr.getX(i)
              const y = posAttr.getY(i)
              if (x < xMin) xMin = x
              if (x > xMax) xMax = x
              if (y < yMin) yMin = y
              if (y > yMax) yMax = y
            }

            const xRange = xMax - xMin
            const yRange = yMax - yMin
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

            const backGeo = child.geometry
            const backPos = backGeo.getAttribute('position')
            const backCount = backPos.count

            let bxMin = Infinity, bxMax = -Infinity, byMin = Infinity, byMax = -Infinity
            for (let i = 0; i < backCount; i++) {
              const x = backPos.getX(i)
              const y = backPos.getY(i)
              if (x < bxMin) bxMin = x
              if (x > bxMax) bxMax = x
              if (y < byMin) byMin = y
              if (y > byMax) byMax = y
            }

            const bxRange = bxMax - bxMin
            const byRange = byMax - byMin
            const backUvs = new Float32Array(backCount * 2)
            for (let i = 0; i < backCount; i++) {
              backUvs[i * 2] = (backPos.getX(i) - bxMin) / bxRange
              backUvs[i * 2 + 1] = (backPos.getY(i) - byMin) / byRange
            }

            backGeo.deleteAttribute('uv')
            backGeo.setAttribute('uv', new THREE.BufferAttribute(backUvs, 2))
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
      <ambientLight intensity={sceneSettings.ambientIntensity} />
      <Center>
        <primitive object={scene} />
      </Center>
    </>
  )
}
