// Core EffectModel — pure, prop-driven, no Leva, no store
// Receives all config as typed props. Both Studio and Create use this.

import { useMemo, useEffect, useRef, useCallback } from 'react'
import { useGLTF, useTexture, Center } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
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
  artworkUrl?: string
  designState: DesignState
  face: FaceMaterial
  back: BackMaterial
  frame: FrameMaterial
  scene: SceneSettings
}

const FALLBACK_NORMAL_MAP = '/assets/materials/ultrasuede/suede-normal.png'
const FALLBACK_ROUGHNESS_MAP = '/assets/materials/ultrasuede/suede-roughness.jpg'
const FALLBACK_HEIGHT_MAP = '/assets/materials/ultrasuede/suede-height.png'

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function collectMetadata(mesh: THREE.Mesh) {
  const materialNames = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    .filter(Boolean)
    .map((material) => (material instanceof THREE.Material ? material.name : ''))
    .join(' ')

  const explicitRole = typeof mesh.userData?.studioRole === 'string' ? mesh.userData.studioRole : ''

  return normalizeName(`${mesh.name} ${materialNames} ${explicitRole}`)
}

function computeBoundsArea(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return 0
  return (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z)
}

function computeBoundsMetrics(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox

  if (!box) {
    return {
      size: new THREE.Vector3(0, 0, 0),
      center: new THREE.Vector3(0, 0, 0),
      planarArea: 0,
      volume: 0,
      flatness: 0,
      thinAxis: 2 as 0 | 1 | 2,
    }
  }

  const size = new THREE.Vector3()
  box.getSize(size)

  const center = new THREE.Vector3()
  box.getCenter(center)

  const dims = [size.x, size.y, size.z]
  const sorted = [...dims].sort((left, right) => right - left)
  const planarArea = sorted[0] * sorted[1]
  const thickness = Math.max(sorted[2], 0.0001)
  const volume = Math.max(size.x * size.y * size.z, 0.0001)
  const flatness = planarArea / thickness
  const thinAxis = dims.indexOf(Math.min(...dims)) as 0 | 1 | 2

  return { size, center, planarArea, volume, flatness, thinAxis }
}

function similarityRatio(left: number, right: number) {
  const max = Math.max(left, right, 0.0001)
  const min = Math.min(left, right, 0.0001)
  return min / max
}

function areLikelyOpposingPanels(left: ReturnType<typeof computeBoundsMetrics>, right: ReturnType<typeof computeBoundsMetrics>) {
  if (left.planarArea === 0 || right.planarArea === 0) return false

  const sizeSimilarity =
    similarityRatio(left.size.x, right.size.x) *
    similarityRatio(left.size.y, right.size.y) *
    similarityRatio(left.size.z, right.size.z)

  const areaSimilarity = similarityRatio(left.planarArea, right.planarArea)
  const thicknessSimilarity = similarityRatio(
    [left.size.x, left.size.y, left.size.z][left.thinAxis],
    [right.size.x, right.size.y, right.size.z][right.thinAxis],
  )

  return left.thinAxis === right.thinAxis && areaSimilarity >= 0.45 && thicknessSimilarity >= 0.45 && sizeSimilarity >= 0.08
}

function findBestMesh(
  meshes: THREE.Mesh[],
  patterns: RegExp[],
  excluded = new Set<THREE.Mesh>(),
) {
  let best: { mesh: THREE.Mesh; score: number } | null = null

  for (const mesh of meshes) {
    if (excluded.has(mesh)) continue
    const name = collectMetadata(mesh)
    const score = patterns.reduce((sum, pattern) => sum + (pattern.test(name) ? 1 : 0), 0)
    if (score === 0) continue
    if (!best || score > best.score) best = { mesh, score }
  }

  return best?.mesh ?? null
}

function ensurePlanarUv(geometry: THREE.BufferGeometry) {
  const clonedGeometry = geometry.clone()
  const position = clonedGeometry.getAttribute('position')
  if (!position || position.count === 0) return clonedGeometry

  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }

  const xRange = xMax - xMin || 1
  const yRange = yMax - yMin || 1
  const uvs = new Float32Array(position.count * 2)

  for (let index = 0; index < position.count; index += 1) {
    uvs[index * 2] = (position.getX(index) - xMin) / xRange
    uvs[index * 2 + 1] = (position.getY(index) - yMin) / yRange
  }

  clonedGeometry.deleteAttribute('uv')
  clonedGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  return clonedGeometry
}

function pickMostPlanarMesh(
  meshes: THREE.Mesh[],
  excluded = new Set<THREE.Mesh>(),
) {
  let best: { mesh: THREE.Mesh; metrics: ReturnType<typeof computeBoundsMetrics> } | null = null

  for (const mesh of meshes) {
    if (excluded.has(mesh)) continue
    const metrics = computeBoundsMetrics(mesh.geometry)
    if (metrics.planarArea === 0) continue

    if (
      !best ||
      metrics.flatness > best.metrics.flatness ||
      (metrics.flatness === best.metrics.flatness && metrics.planarArea > best.metrics.planarArea)
    ) {
      best = { mesh, metrics }
    }
  }

  return best
}

export default function EffectModel({
  modelPath,
  artworkUrl,
  designState,
  face,
  back,
  frame,
  scene: sceneSettings,
}: EffectModelProps) {
  const { gl } = useThree()
  const { scene } = useGLTF(modelPath)
  const faceMeshRef = useRef<THREE.Mesh | null>(null)
  const artworkTexRef = useRef<THREE.Texture | null>(null)
  const maxAnisotropy = Math.max(1, gl.capabilities.getMaxAnisotropy())
  const textureLoader = useMemo(() => new THREE.TextureLoader(), [])

  const loadOptionalTexture = useCallback(
    (
      texturePath: string | undefined,
      options?: {
        colorSpace?: THREE.ColorSpace
        wrap?: THREE.Wrapping
      },
    ) => {
      if (!texturePath) return null
      const texture = textureLoader.load(texturePath)
      texture.wrapS = texture.wrapT = options?.wrap ?? THREE.ClampToEdgeWrapping
      texture.anisotropy = maxAnisotropy
      if (options?.colorSpace) {
        texture.colorSpace = options.colorSpace
      }
      return texture
    },
    [maxAnisotropy, textureLoader],
  )

  // Load face textures
  const faceNormalPath = face.textures.normal || FALLBACK_NORMAL_MAP
  const faceRoughnessPath = face.textures.roughness || FALLBACK_ROUGHNESS_MAP
  const faceHeightPath = face.textures.height || FALLBACK_HEIGHT_MAP
  const [faceNormal, faceRoughnessTex, faceHeight] = useTexture([
    faceNormalPath,
    faceRoughnessPath,
    faceHeightPath,
  ])
  ;[faceNormal, faceRoughnessTex, faceHeight].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.anisotropy = maxAnisotropy
  })
  const faceBaseTexture = useMemo(
    () => loadOptionalTexture(face.textures.texture, { colorSpace: THREE.SRGBColorSpace, wrap: THREE.RepeatWrapping }),
    [face.textures.texture, loadOptionalTexture],
  )

  // Load back textures (may differ from face)
  const backNormalPath = back.textures.normal || FALLBACK_NORMAL_MAP
  const backRoughnessPath = back.textures.roughness || FALLBACK_ROUGHNESS_MAP
  const backHeightPath = back.textures.height || FALLBACK_HEIGHT_MAP
  const [backNormal, backRoughnessTex, backHeight] = useTexture([
    backNormalPath,
    backRoughnessPath,
    backHeightPath,
  ])
  ;[backNormal, backRoughnessTex, backHeight].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.anisotropy = maxAnisotropy
  })
  const backBaseTexture = useMemo(
    () => loadOptionalTexture(back.textures.texture, { colorSpace: THREE.SRGBColorSpace, wrap: THREE.RepeatWrapping }),
    [back.textures.texture, loadOptionalTexture],
  )

  const frameBaseTexture = useMemo(
    () => loadOptionalTexture(frame.textures.texture, { colorSpace: THREE.SRGBColorSpace, wrap: THREE.RepeatWrapping }),
    [frame.textures.texture, loadOptionalTexture],
  )
  const frameNormalTexture = useMemo(
    () => loadOptionalTexture(frame.textures.normal),
    [frame.textures.normal, loadOptionalTexture],
  )
  const frameRoughnessTexture = useMemo(
    () => loadOptionalTexture(frame.textures.roughness),
    [frame.textures.roughness, loadOptionalTexture],
  )
  const frameHeightTexture = useMemo(
    () => loadOptionalTexture(frame.textures.height),
    [frame.textures.height, loadOptionalTexture],
  )

  // Load artwork texture dynamically
  const artworkMap = useMemo(() => {
    if (!artworkUrl) {
      artworkTexRef.current = null
      return null
    }

    const tex = new THREE.TextureLoader().load(artworkUrl, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace
      loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping
      loaded.anisotropy = maxAnisotropy
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
    tex.anisotropy = maxAnisotropy
    return tex
  }, [artworkUrl, maxAnisotropy])

  useEffect(() => {
    if (artworkUrl) return
    artworkTexRef.current = null
    if (faceMeshRef.current) {
      const mat = faceMeshRef.current.material as THREE.MeshPhysicalMaterial
      mat.map = null
      mat.needsUpdate = true
    }
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

  // FACE material — uses face-specific textures
  const fp = face.params
  const faceMaterial = useMemo(() => {
    const activeFaceMap = artworkMap ?? faceBaseTexture
    const faceMaterialParams: THREE.MeshPhysicalMaterialParameters = {
      color: new THREE.Color(fp.colorMultiplier, fp.colorMultiplier, fp.colorMultiplier),
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
    }
    if (activeFaceMap) {
      faceMaterialParams.map = activeFaceMap
    }
    return new THREE.MeshPhysicalMaterial(faceMaterialParams)
  }, [artworkMap, faceBaseTexture, faceHeight, faceNormal, faceRoughnessTex, fp])

  // FRAME material
  const frp = frame.params
  const frameMaterial = useMemo(
    () => {
      const frameMaterialParams: THREE.MeshPhysicalMaterialParameters = {
        color: new THREE.Color(frp.color),
        bumpScale: frameHeightTexture ? 0.2 : 0,
        roughness: frp.roughness,
        metalness: frp.metalness,
        clearcoat: frp.clearcoat,
        clearcoatRoughness: frp.clearcoatRoughness,
        side: THREE.DoubleSide,
      }
      if (frameBaseTexture) frameMaterialParams.map = frameBaseTexture
      if (frameNormalTexture) frameMaterialParams.normalMap = frameNormalTexture
      if (frameRoughnessTexture) frameMaterialParams.roughnessMap = frameRoughnessTexture
      if (frameHeightTexture) frameMaterialParams.bumpMap = frameHeightTexture
      return new THREE.MeshPhysicalMaterial(frameMaterialParams)
    },
    [frameBaseTexture, frameHeightTexture, frameNormalTexture, frameRoughnessTexture, frp]
  )

  // BACK material — uses back-specific textures
  const bp = back.params
  const backMaterial = useMemo(
    () => {
      const backMaterialParams: THREE.MeshPhysicalMaterialParameters = {
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
      }
      if (backBaseTexture) {
        backMaterialParams.map = backBaseTexture
      }
      return new THREE.MeshPhysicalMaterial(backMaterialParams)
    },
    [backBaseTexture, backHeight, backNormal, backRoughnessTex, bp]
  )

  const preparedScene = useMemo(() => {
    const root = scene.clone(true)
    const meshes: THREE.Mesh[] = []

    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
        meshes.push(child)
      }

      if (child.name === 'NEW LIGHTS' || child instanceof THREE.Light) {
        child.visible = false
      }
    })

    const meshesByArea = [...meshes].sort(
      (left, right) => computeBoundsArea(right.geometry) - computeBoundsArea(left.geometry),
    )
    const claimed = new Set<THREE.Mesh>()

    const frameMeshes = meshes.filter((mesh) =>
      [/\bframe\b/, /\bbezel\b/, /\bborder\b/, /\btrim\b/, /\brim\b/, /\baccent\b/, /\bcap\b/, /\bedge\b/, /\bring\b/]
        .some((pattern) => pattern.test(collectMetadata(mesh))),
    )

    for (const mesh of frameMeshes) {
      claimed.add(mesh)
    }

    const faceMesh =
      findBestMesh(meshes, [/\bprint surface front\b/, /\bfront\b/, /\bface\b/, /\bprint\b/, /\bartwork\b/, /\bbody\b/, /\bmain\b/, /\bpanel\b/], claimed) ??
      pickMostPlanarMesh(meshes, claimed)?.mesh ??
      meshesByArea.find((mesh) => !claimed.has(mesh)) ??
      null

    if (faceMesh) claimed.add(faceMesh)

    const explicitBackMesh = findBestMesh(meshes, [/\bback\b/, /\brear\b/, /\breverse\b/, /\binside\b/], claimed)
    const bestRemainingPlanar = pickMostPlanarMesh(meshes, claimed)

    const faceMetrics = faceMesh ? computeBoundsMetrics(faceMesh.geometry) : null
    const backMesh =
      explicitBackMesh ??
      (faceMetrics && bestRemainingPlanar && areLikelyOpposingPanels(faceMetrics, bestRemainingPlanar.metrics)
        ? bestRemainingPlanar.mesh
        : null)

    if (backMesh) claimed.add(backMesh)

    const unresolvedMeshes = meshes.filter((mesh) => !claimed.has(mesh))

    faceMeshRef.current = faceMesh

    if (faceMesh) {
      faceMesh.material = faceMaterial
      faceMesh.geometry = ensurePlanarUv(faceMesh.geometry)
    }

    if (backMesh) {
      backMesh.material = backMaterial
      backMesh.geometry = ensurePlanarUv(backMesh.geometry)
    }

    for (const mesh of unresolvedMeshes) {
      mesh.material = frameMaterial
    }

    return root
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
        <primitive object={preparedScene} />
      </Center>
    </>
  )
}
