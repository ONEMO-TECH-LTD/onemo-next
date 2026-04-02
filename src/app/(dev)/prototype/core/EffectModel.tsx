// Core EffectModel — pure, prop-driven, no Leva, no store
// Receives all config as typed props. Both Studio and Create use this.

import { useMemo, useEffect, useRef } from 'react'
import { useGLTF, Center } from '@react-three/drei'
import * as THREE from 'three'
import type {
  DesignState,
  FaceMaterial,
  BackMaterial,
  FrameMaterial,
  SceneSettings,
  ViewerMaterialRole,
  ViewerProductConfig,
} from '../types'

interface EffectModelProps {
  modelPath: string
  artworkUrl: string
  designState: DesignState
  face: FaceMaterial
  back: BackMaterial
  frame: FrameMaterial
  scene: SceneSettings
  product?: ViewerProductConfig
  onModelReady?: (payload: {
    modelRoot: THREE.Object3D
    materialSlots: Map<string, THREE.Material | THREE.Material[]>
  }) => void
}

function collectMaterialSlots(root: THREE.Object3D) {
  const materialSlots = new Map<string, THREE.Material | THREE.Material[]>()
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      materialSlots.set(child.uuid, child.material)
    }
  })
  return materialSlots
}

function matchesMeshName(meshName: string, patterns: string[]) {
  const normalizedMeshName = meshName.trim().toLowerCase()
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.trim().toLowerCase()
    if (!normalizedPattern) return false
    if (normalizedPattern.includes('*')) {
      const regex = new RegExp(`^${normalizedPattern.split('*').map((part) => {
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      }).join('.*')}$`)
      return regex.test(normalizedMeshName)
    }
    return normalizedMeshName === normalizedPattern
  })
}

function ensureUvAttribute(geometry: THREE.BufferGeometry) {
  const uv = geometry.getAttribute('uv')
  if (uv && uv.count === geometry.getAttribute('position').count) {
    return
  }

  const posAttr = geometry.getAttribute('position')
  const count = posAttr.count
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i)
    const y = posAttr.getY(i)
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }

  const xRange = xMax - xMin || 1
  const yRange = yMax - yMin || 1
  const uvs = new Float32Array(count * 2)

  for (let i = 0; i < count; i++) {
    uvs[i * 2] = (posAttr.getX(i) - xMin) / xRange
    uvs[i * 2 + 1] = (posAttr.getY(i) - yMin) / yRange
  }

  geometry.deleteAttribute('uv')
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}

function forcePlanarUvAttribute(geometry: THREE.BufferGeometry) {
  const posAttr = geometry.getAttribute('position')
  const count = posAttr.count
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i)
    const y = posAttr.getY(i)
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }

  const xRange = xMax - xMin || 1
  const yRange = yMax - yMin || 1
  const uvs = new Float32Array(count * 2)

  for (let i = 0; i < count; i++) {
    uvs[i * 2] = (posAttr.getX(i) - xMin) / xRange
    uvs[i * 2 + 1] = (posAttr.getY(i) - yMin) / yRange
  }

  geometry.deleteAttribute('uv')
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}

function loadOptionalTexture(
  url: string | undefined,
  {
    color = false,
    repeat = false,
  }: { color?: boolean; repeat?: boolean } = {}
) {
  if (!url) {
    return null
  }

  const texture = new THREE.TextureLoader().load(url)
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.wrapS = texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

function createRoleMaterial(role: ViewerMaterialRole, artworkMap: THREE.Texture | null) {
  const defaults = role.defaults ?? {}
  const textures = role.textures ?? {}
  const usesArtwork = !!artworkMap

  const colorMultiplier = Number(defaults.colorMultiplier ?? 1)
  const baseColor = usesArtwork
    ? new THREE.Color(colorMultiplier, colorMultiplier, colorMultiplier)
    : new THREE.Color(defaults.color ?? '#ffffff')

  const normalMap = loadOptionalTexture(textures.normalMap, { color: false })
  const roughnessMap = loadOptionalTexture(textures.roughnessMap, { color: false })
  const bumpMap = loadOptionalTexture(textures.bumpMap, { color: false })
  const diffuseMap = usesArtwork
    ? artworkMap
    : loadOptionalTexture(textures.map, { color: true })

  return new THREE.MeshPhysicalMaterial({
    map: diffuseMap,
    color: baseColor,
    normalMap,
    normalScale: new THREE.Vector2(
      Number(defaults.normalScale ?? 1),
      Number(defaults.normalScale ?? 1)
    ),
    bumpMap,
    bumpScale: Number(defaults.bumpScale ?? 1),
    roughnessMap,
    roughness: Number(defaults.roughness ?? 1),
    metalness: Number(defaults.metalness ?? 0),
    sheen: Number(defaults.sheen ?? 0),
    sheenColor: new THREE.Color(defaults.sheenColor ?? '#000000'),
    sheenRoughness: Number(defaults.sheenRoughness ?? 1),
    envMapIntensity: Number(defaults.envMapIntensity ?? 1),
    clearcoat: Number(defaults.clearcoat ?? 0),
    clearcoatRoughness: Number(defaults.clearcoatRoughness ?? 0),
    side: THREE.DoubleSide,
  })
}

export default function EffectModel({
  modelPath,
  artworkUrl,
  designState,
  face,
  back,
  frame,
  scene: sceneSettings,
  product,
  onModelReady,
}: EffectModelProps) {
  const { scene } = useGLTF(modelPath)
  const artworkMeshRef = useRef<THREE.Mesh | null>(null)
  const artworkTexRef = useRef<THREE.Texture | null>(null)

  // Load artwork texture dynamically
  const artworkMap = useMemo(() => {
    const tex = new THREE.TextureLoader().load(artworkUrl, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace
      loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping
      loaded.needsUpdate = true
      artworkTexRef.current = loaded
      if (artworkMeshRef.current) {
        const mat = artworkMeshRef.current.material as THREE.MeshPhysicalMaterial
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

  const roleEntries = useMemo<ViewerMaterialRole[]>(() => {
    if (product?.materialRoles?.length) {
      return product.materialRoles
    }

    return [
      {
        role: 'face',
        meshNames: ['PRINT_SURFACE_FRONT', 'Face', 'face'],
        defaults: {
          color: face.params.color ?? '#ffffff',
          colorMultiplier: face.params.colorMultiplier,
          roughness: face.params.roughness,
          metalness: face.params.metalness,
          envMapIntensity: face.params.envMapIntensity,
          normalScale: face.params.normalScale,
          bumpScale: face.params.bumpScale,
          sheen: face.params.sheen,
          sheenColor: face.params.sheenColor,
          sheenRoughness: face.params.sheenRoughness,
        },
        textures: {
          normalMap: face.textures.normal,
          roughnessMap: face.textures.roughness,
          bumpMap: face.textures.height,
        },
        configurable: true,
        configurableProperties: ['color', 'artwork'],
      },
      {
        role: 'back',
        meshNames: ['BACK', 'Back', 'back'],
        defaults: {
          color: back.params.color,
          roughness: back.params.roughness,
          envMapIntensity: back.params.envMapIntensity,
          normalScale: back.params.normalScale,
          bumpScale: back.params.bumpScale,
          sheen: back.params.sheen,
          sheenColor: back.params.sheenColor,
          sheenRoughness: back.params.sheenRoughness,
        },
        textures: {
          normalMap: back.textures.normal,
          roughnessMap: back.textures.roughness,
          bumpMap: back.textures.height,
        },
        configurable: true,
        configurableProperties: ['color'],
      },
      {
        role: 'frame',
        meshNames: ['FRAME', 'Frame', 'frame'],
        defaults: {
          color: frame.params.color,
          roughness: frame.params.roughness,
          metalness: frame.params.metalness,
          clearcoat: frame.params.clearcoat,
          clearcoatRoughness: frame.params.clearcoatRoughness,
        },
        configurable: true,
        configurableProperties: ['color'],
      },
    ]
  }, [back, face, frame, product])

  const artworkMeshPatterns = useMemo(() => {
    if (product?.artworkSlot?.meshName) {
      return [product.artworkSlot.meshName]
    }
    const fallbackFaceRole = roleEntries.find((role) => role.role === 'face')
    return fallbackFaceRole?.meshNames ?? []
  }, [product, roleEntries])

  const roleMaterials = useMemo(() => {
    const materials = new Map<string, THREE.MeshPhysicalMaterial>()

    roleEntries.forEach((role) => {
      const usesArtwork = product?.artworkSlot?.role === role.role
      materials.set(role.role, createRoleMaterial(role, usesArtwork ? artworkMap : null))
    })

    return materials
  }, [artworkMap, product, roleEntries])

  // Override materials and generate planar UVs
  useMemo(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const matchedRole = roleEntries.find((role) => matchesMeshName(child.name, role.meshNames))
        if (matchedRole) {
          const isArtworkRole = product?.artworkSlot?.role === matchedRole.role
          const shouldApplyRole =
            !isArtworkRole || matchesMeshName(child.name, artworkMeshPatterns)

          if (!shouldApplyRole) {
            return
          }

          const material = roleMaterials.get(matchedRole.role)
          if (material) {
            child.material = material
          }

          if (matchesMeshName(child.name, artworkMeshPatterns)) {
            artworkMeshRef.current = child
            forcePlanarUvAttribute(child.geometry)
          } else {
            ensureUvAttribute(child.geometry)
          }
        }
      }
      if (child.name === 'NEW LIGHTS') {
        child.visible = false
      }
    })
  }, [artworkMeshPatterns, roleEntries, roleMaterials, scene])

  useEffect(() => {
    onModelReady?.({
      modelRoot: scene,
      materialSlots: collectMaterialSlots(scene),
    })
  }, [onModelReady, scene])

  useEffect(() => {
    if (artworkMeshRef.current) {
      const mat = artworkMeshRef.current.material as THREE.MeshPhysicalMaterial
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
