// Core EffectModel — pure, prop-driven, no Leva, no store
// Receives all config as typed props. Both Studio and Create use this.

import { useMemo, useEffect, useRef } from 'react'
import { useGLTF, useTexture, Center } from '@react-three/drei'
import * as THREE from 'three'
import type {
  DesignState,
  FaceMaterial,
  BackMaterial,
  FrameMaterial,
  SceneSettings,
} from '../types'

interface EffectModelProps {
  modelPath: string
  artworkUrl: string
  designState: DesignState
  face: FaceMaterial
  back: BackMaterial
  frame: FrameMaterial
  scene: SceneSettings
  onReady?: (payload: {
    modelRoot: THREE.Object3D
    materialSlots: Map<string, THREE.Material | THREE.Material[]>
  }) => void
}

export default function EffectModel({
  modelPath,
  artworkUrl,
  designState,
  face,
  back,
  frame,
  scene: sceneSettings,
  onReady,
}: EffectModelProps) {
  const { scene } = useGLTF(modelPath)
  const faceMeshRef = useRef<THREE.Mesh | null>(null)
  const artworkTexRef = useRef<THREE.Texture | null>(null)

  const faceTextureOverride = useMemo(() => {
    if (!face.textures.texture) return null

    const tex = new THREE.TextureLoader().load(face.textures.texture)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.needsUpdate = true
    return tex
  }, [face.textures.texture])

  const backColorMap = useMemo(() => {
    if (!back.textures.texture) return null

    const tex = new THREE.TextureLoader().load(back.textures.texture)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.needsUpdate = true
    return tex
  }, [back.textures.texture])

  // Load face textures
  const [faceNormal, faceRoughnessTex, faceHeight] = useTexture([
    face.textures.normal,
    face.textures.roughness,
    face.textures.height,
  ])
  ;[faceNormal, faceRoughnessTex, faceHeight].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  })

  // Load back textures (may differ from face)
  const [backNormal, backRoughnessTex, backHeight] = useTexture([
    back.textures.normal,
    back.textures.roughness,
    back.textures.height,
  ])
  ;[backNormal, backRoughnessTex, backHeight].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  })

  // Load artwork texture dynamically
  const artworkMap = useMemo(() => {
    const tex = new THREE.TextureLoader().load(artworkUrl, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace
      loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping
      loaded.needsUpdate = true
      artworkTexRef.current = loaded
      if (faceMeshRef.current && !face.textures.texture) {
        const mat = faceMeshRef.current.material as THREE.MeshPhysicalMaterial
        mat.map = loaded
        mat.needsUpdate = true
      }
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return tex
  }, [artworkUrl])

  const activeFaceMap = faceTextureOverride ?? artworkMap

  // Apply design state to artwork texture
  useEffect(() => {
    if (faceTextureOverride) return

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
  }, [designState, artworkMap, faceTextureOverride])

  // FACE material — uses face-specific textures
  const fp = face.params
  const faceMaterial = useMemo(() => {
    const baseColor = new THREE.Color(fp.color ?? '#ffffff')
    baseColor.multiplyScalar(fp.colorMultiplier)

    return new THREE.MeshPhysicalMaterial({
      map: activeFaceMap,
      color: baseColor,
      normalMap: faceNormal,
      normalScale: new THREE.Vector2(fp.normalScale, fp.normalScale),
      bumpMap: faceHeight,
      bumpScale: fp.bumpScale,
      roughnessMap: faceRoughnessTex,
      roughness: fp.roughness,
      metalness: fp.metalness,
      sheen: fp.sheen,
      sheenColor: new THREE.Color(fp.sheenColor),
      sheenRoughness: fp.sheenRoughness,
      envMapIntensity: fp.envMapIntensity,
      side: THREE.DoubleSide,
    })
  }, [activeFaceMap, faceNormal, faceHeight, faceRoughnessTex, fp])

  // FRAME material
  const frp = frame.params
  const frameMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(frp.color),
        roughness: frp.roughness,
        metalness: frp.metalness,
        clearcoat: frp.clearcoat,
        clearcoatRoughness: frp.clearcoatRoughness,
        side: THREE.DoubleSide,
      }),
    [frp]
  )

  // BACK material — uses back-specific textures
  const bp = back.params
  const backMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: backColorMap,
        color: new THREE.Color(bp.color),
        normalMap: backNormal,
        normalScale: new THREE.Vector2(bp.normalScale, bp.normalScale),
        bumpMap: backHeight,
        bumpScale: bp.bumpScale,
        roughnessMap: backRoughnessTex,
        roughness: bp.roughness,
        metalness: 0,
        sheen: bp.sheen,
        sheenColor: new THREE.Color(bp.sheenColor),
        sheenRoughness: bp.sheenRoughness,
        envMapIntensity: bp.envMapIntensity,
        side: THREE.DoubleSide,
      }),
    [backColorMap, backNormal, backHeight, backRoughnessTex, bp]
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
    if (!onReady) return

    const materialSlots = new Map<string, THREE.Material | THREE.Material[]>()
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        materialSlots.set(child.uuid, child.material)
      }
    })

    onReady({
      modelRoot: scene,
      materialSlots,
    })
  }, [scene, onReady, faceMaterial, backMaterial, frameMaterial])

  useEffect(() => {
    if (faceMeshRef.current) {
      const mat = faceMeshRef.current.material as THREE.MeshPhysicalMaterial
      mat.map = activeFaceMap
      mat.needsUpdate = true
    }
  }, [activeFaceMap])

  return (
    <>
      <ambientLight intensity={sceneSettings.ambientIntensity} />
      <Center>
        <primitive object={scene} />
      </Center>
    </>
  )
}
