import { Center } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { ColorConfig, SceneSettings, ShapeProfile } from '../types'
import {
  SHAPED_EFFECT_RULES,
  createShapeMetrics,
  shapePointToWorld,
  worldToShapeUv,
} from './shaped-geometry'

interface ShapedEffectModelProps {
  artworkUrl?: string
  profile: ShapeProfile
  scene: SceneSettings
  colors: ColorConfig
}

const DEFAULT_EDGE_COLOR = '#d8aa64'

function loadTexture(url: string | undefined) {
  if (!url) {
    return null
  }

  const texture = new THREE.TextureLoader().load(url, (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace
    loaded.wrapS = THREE.ClampToEdgeWrapping
    loaded.wrapT = THREE.ClampToEdgeWrapping
    loaded.needsUpdate = true
  })
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

function createShape(profile: ShapeProfile) {
  const metrics = createShapeMetrics(profile.points)
  const shape = new THREE.Shape()

  profile.points.forEach((point, index) => {
    const world = shapePointToWorld(point, metrics)
    if (index === 0) {
      shape.moveTo(world.x, world.y)
    } else {
      shape.lineTo(world.x, world.y)
    }
  })
  shape.closePath()

  return { shape, metrics }
}

function applyFrontUvs(geometry: THREE.BufferGeometry, metrics: ReturnType<typeof createShapeMetrics>) {
  const position = geometry.getAttribute('position')
  const uvs = new Float32Array(position.count * 2)

  for (let i = 0; i < position.count; i += 1) {
    const uv = worldToShapeUv(position.getX(i), position.getY(i), metrics)
    uvs[i * 2] = uv.u
    uvs[i * 2 + 1] = 1 - uv.v
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}

function createSideGeometry(profile: ShapeProfile, metrics: ReturnType<typeof createShapeMetrics>) {
  const depth = metrics.thicknessMm * SHAPED_EFFECT_RULES.mmToWorld
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const color = new THREE.Color()

  profile.points.forEach((point, index) => {
    const next = profile.points[(index + 1) % profile.points.length]
    const a = shapePointToWorld(point, metrics)
    const b = shapePointToWorld(next, metrics)
    const colorA = profile.edgeColors[index] ?? DEFAULT_EDGE_COLOR
    const colorB = profile.edgeColors[(index + 1) % profile.points.length] ?? colorA
    const base = positions.length / 3

    positions.push(
      a.x, a.y, -depth / 2,
      b.x, b.y, -depth / 2,
      b.x, b.y, depth / 2,
      a.x, a.y, depth / 2
    )

    color.set(colorA)
    colors.push(color.r, color.g, color.b)
    color.set(colorB)
    colors.push(color.r, color.g, color.b)
    colors.push(color.r, color.g, color.b)
    color.set(colorA)
    colors.push(color.r, color.g, color.b)

    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export default function ShapedEffectModel({
  artworkUrl,
  profile,
  scene,
  colors,
}: ShapedEffectModelProps) {
  const artworkMap = useMemo(() => loadTexture(artworkUrl), [artworkUrl])

  const { frontGeometry, backGeometry, sideGeometry, metrics } = useMemo(() => {
    const { shape, metrics: shapeMetrics } = createShape(profile)
    const depth = shapeMetrics.thicknessMm * SHAPED_EFFECT_RULES.mmToWorld
    const front = new THREE.ShapeGeometry(shape, 32)
    const back = new THREE.ShapeGeometry(shape, 32)
    const side = createSideGeometry(profile, shapeMetrics)

    applyFrontUvs(front, shapeMetrics)
    front.translate(0, 0, depth / 2)
    back.translate(0, 0, -depth / 2 - 0.00005)
    front.computeVertexNormals()
    back.computeVertexNormals()

    return {
      frontGeometry: front,
      backGeometry: back,
      sideGeometry: side,
      metrics: shapeMetrics,
    }
  }, [profile])

  const materials = useMemo(() => {
    const front = new THREE.MeshPhysicalMaterial({
      map: artworkMap,
      color: artworkMap ? '#ffffff' : '#f2c46e',
      roughness: 0.92,
      metalness: 0,
      sheen: 0.55,
      sheenColor: new THREE.Color('#f4d8a2'),
      sheenRoughness: 0.9,
      envMapIntensity: 0.55,
      side: THREE.FrontSide,
    })

    const back = new THREE.MeshPhysicalMaterial({
      color: colors.backColor,
      roughness: 0.94,
      metalness: 0,
      sheen: 0.35,
      sheenColor: new THREE.Color('#ffffff'),
      sheenRoughness: 1,
      envMapIntensity: 0.45,
      side: THREE.DoubleSide,
    })

    const edge = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
      sheen: 0.35,
      sheenColor: new THREE.Color('#ffffff'),
      sheenRoughness: 1,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    })

    return { front, back, edge }
  }, [artworkMap, colors.backColor])

  const attachmentSize = metrics.requiredAttachmentSquareMm * SHAPED_EFFECT_RULES.mmToWorld
  const attachmentColor = metrics.attachmentPass ? '#2f8f5b' : '#d18a2f'

  return (
    <>
      <ambientLight intensity={scene.ambientIntensity} />
      <Center>
        <group>
          <mesh geometry={sideGeometry} material={materials.edge} />
          <mesh geometry={frontGeometry} material={materials.front} />
          <mesh geometry={backGeometry} material={materials.back} />
          <mesh position={[0, 0, metrics.thicknessMm * SHAPED_EFFECT_RULES.mmToWorld / 2 + 0.0002]}>
            <planeGeometry args={[attachmentSize, attachmentSize]} />
            <meshBasicMaterial
              color={attachmentColor}
              transparent
              opacity={0.12}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      </Center>
    </>
  )
}
