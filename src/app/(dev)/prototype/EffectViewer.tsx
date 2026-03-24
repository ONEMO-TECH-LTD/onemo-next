import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  useGLTF,
  useTexture,
  Center,
  Environment,
} from '@react-three/drei'
import { Suspense, useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useControls } from 'leva'
import { useSceneStore } from './sceneStore'

const DEFAULT_ARTWORK = '/assets/test-artwork.png'

interface DesignState {
  offsetX: number
  offsetY: number
  scale: number
}

function EffectModel({
  artworkUrl,
  designState,
  backColor,
  frameColor,
}: {
  artworkUrl: string
  designState: DesignState
  backColor: string
  frameColor: string
}) {
  const { scene } = useGLTF('/assets/shapes/effect-70mm-step.glb')
  const faceMeshRef = useRef<THREE.Mesh | null>(null)
  const artworkTexRef = useRef<THREE.Texture | null>(null)

  // Leva controls — function form for save/load set() access
  const [faceParams, setFace] = useControls('Face Material', () => ({
    roughness: { value: 1.0, min: 0, max: 1, step: 0.01 },
    metalness: { value: 0, min: 0, max: 1, step: 0.01 },
    envMapIntensity: { value: 0.1, min: 0, max: 2, step: 0.01 },
    normalScale: { value: 0.15, min: 0, max: 2, step: 0.01 },
    bumpScale: { value: 1.0, min: 0, max: 5, step: 0.1 },
    sheen: { value: 1.0, min: 0, max: 1, step: 0.01 },
    sheenColor: '#1a1a1a',
    sheenRoughness: { value: 0.8, min: 0, max: 1, step: 0.01 },
    colorMultiplier: { value: 1.0, min: 0.5, max: 2.5, step: 0.05 },
  }))

  const [backParams, setBack] = useControls('Back Material', () => ({
    color: backColor,
    roughness: { value: 1.0, min: 0, max: 1, step: 0.01 },
    envMapIntensity: { value: 0.1, min: 0, max: 2, step: 0.01 },
    normalScale: { value: 0.15, min: 0, max: 2, step: 0.01 },
    bumpScale: { value: 1.0, min: 0, max: 5, step: 0.1 },
    sheen: { value: 1.0, min: 0, max: 1, step: 0.01 },
    sheenColor: '#1a1a1a',
    sheenRoughness: { value: 0.8, min: 0, max: 1, step: 0.01 },
  }))

  const [frameParams, setFrame] = useControls('Frame Material', () => ({
    color: frameColor,
    roughness: { value: 0.5, min: 0, max: 1, step: 0.01 },
    metalness: { value: 0, min: 0, max: 1, step: 0.01 },
    clearcoat: { value: 0.4, min: 0, max: 1, step: 0.01 },
    clearcoatRoughness: { value: 0.3, min: 0, max: 1, step: 0.01 },
  }))

  const [sceneParams, setScene] = useControls('Scene', () => ({
    exposure: { value: 0.7, min: 0.1, max: 2, step: 0.05 },
    ambientIntensity: { value: 0.5, min: 0, max: 2, step: 0.05 },
    envIntensity: { value: 1.0, min: 0, max: 3, step: 0.1 },
    background: '#ffffff',
  }))

  // Register Leva setters with scene store for save/load
  const registerSetter = useSceneStore((s) => s.registerSetter)
  const syncValues = useSceneStore((s) => s.syncValues)

  useEffect(() => {
    registerSetter('Face Material', setFace)
    registerSetter('Back Material', setBack)
    registerSetter('Frame Material', setFrame)
    registerSetter('Scene', setScene)
  }, [registerSetter, setFace, setBack, setFrame, setScene])

  useEffect(() => { syncValues('Face Material', faceParams) }, [syncValues, faceParams])
  useEffect(() => { syncValues('Back Material', backParams) }, [syncValues, backParams])
  useEffect(() => { syncValues('Frame Material', frameParams) }, [syncValues, frameParams])
  useEffect(() => { syncValues('Scene', sceneParams) }, [syncValues, sceneParams])

  // Load suede textures (static)
  const [suedeNormal, suedeRoughness, suedeHeight] = useTexture([
    '/assets/materials/ultrasuede/suede-normal.png',
    '/assets/materials/ultrasuede/suede-roughness.jpg',
    '/assets/materials/ultrasuede/suede-height.png',
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

  // Apply design state to artwork texture (Three.js texture mutation is intentional)
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

  // FACE material — reactive to Leva controls
  const faceMaterial = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      map: artworkMap,
      color: new THREE.Color(faceParams.colorMultiplier, faceParams.colorMultiplier, faceParams.colorMultiplier),
      normalMap: suedeNormal,
      normalScale: new THREE.Vector2(faceParams.normalScale, faceParams.normalScale),
      bumpMap: suedeHeight,
      bumpScale: faceParams.bumpScale,
      roughnessMap: suedeRoughness,
      roughness: faceParams.roughness,
      metalness: faceParams.metalness,
      sheen: faceParams.sheen,
      sheenColor: new THREE.Color(faceParams.sheenColor),
      sheenRoughness: faceParams.sheenRoughness,
      envMapIntensity: faceParams.envMapIntensity,
      side: THREE.DoubleSide,
    })
    return mat
  }, [artworkMap, suedeNormal, suedeHeight, suedeRoughness, faceParams])

  // FRAME — reactive to Leva
  const frameMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(frameParams.color),
        roughness: frameParams.roughness,
        metalness: frameParams.metalness,
        clearcoat: frameParams.clearcoat,
        clearcoatRoughness: frameParams.clearcoatRoughness,
        side: THREE.DoubleSide,
      }),
    [frameParams]
  )

  // BACK — reactive to Leva
  const backMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(backParams.color),
        normalMap: suedeNormal,
        normalScale: new THREE.Vector2(backParams.normalScale, backParams.normalScale),
        bumpMap: suedeHeight,
        bumpScale: backParams.bumpScale,
        roughnessMap: suedeRoughness,
        roughness: backParams.roughness,
        metalness: 0,
        sheen: backParams.sheen,
        sheenColor: new THREE.Color(backParams.sheenColor),
        sheenRoughness: backParams.sheenRoughness,
        envMapIntensity: backParams.envMapIntensity,
        side: THREE.DoubleSide,
      }),
    [suedeNormal, suedeHeight, suedeRoughness, backParams]
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
      <ambientLight intensity={sceneParams.ambientIntensity} />
      <Center>
        <primitive object={scene} />
      </Center>
    </>
  )
}

useGLTF.preload('/assets/shapes/effect-70mm-step.glb')

export default function EffectViewer({
  artworkUrl,
  isEditing,
  designState,
  backColor = '#080808',
  frameColor = '#0f0f0f',
  bgColor = '#ffffff',
}: {
  artworkUrl?: string
  isEditing: boolean
  designState: DesignState
  backColor?: string
  frameColor?: string
  bgColor?: string
}) {
  const sceneParams = useControls('Scene', {
    exposure: { value: 0.7, min: 0.1, max: 2, step: 0.05 },
    ambientIntensity: { value: 0.5, min: 0, max: 2, step: 0.05 },
    envIntensity: { value: 1.0, min: 0, max: 3, step: 0.1 },
  })

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: bgColor }}>
      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: sceneParams.exposure,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 0.2], fov: 35, near: 0.001, far: 100 }}
      >
        <Suspense fallback={null}>
          <Environment preset="studio" environmentIntensity={sceneParams.envIntensity} />
          <EffectModel
            artworkUrl={artworkUrl || DEFAULT_ARTWORK}
            designState={designState}
            backColor={backColor}
            frameColor={frameColor}
          />
        </Suspense>

        <OrbitControls
          target={[0, 0, 0]}
          enableDamping
          dampingFactor={0.1}
          enabled={!isEditing}
        />
      </Canvas>
    </div>
  )
}
