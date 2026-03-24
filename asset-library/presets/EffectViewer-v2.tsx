import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  useGLTF,
  Environment,
  useTexture,
  Center,
} from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'

function EffectModel() {
  const { scene } = useGLTF('/assets/shapes/effect-70mm-step.glb')

  // Load textures — GSG SuedeBlack 4K PBR set + artwork
  const [suedeNormal, suedeRoughness, suedeHeight, suedeSheenColor, artworkMap] = useTexture([
    '/assets/materials/ultrasuede/suede-normal.png',
    '/assets/materials/ultrasuede/suede-roughness.jpg',
    '/assets/materials/ultrasuede/suede-height.png',
    '/assets/materials/ultrasuede/suede-sheencolor.jpg',
    '/assets/test-artwork.png',
  ])

  // 1:1 scale, no tiling
  ;[suedeNormal, suedeRoughness, suedeHeight, suedeSheenColor].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  })

  artworkMap.colorSpace = THREE.SRGBColorSpace

  // FACE material — research preset: high sheen + dark sheenColor
  const faceMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: artworkMap,
        color: new THREE.Color(1.0, 1.0, 1.0),
        normalMap: suedeNormal,
        normalScale: new THREE.Vector2(0.15, 0.15),
        bumpMap: suedeHeight,
        bumpScale: 1.0,
        roughnessMap: suedeRoughness,
        roughness: 1.0,
        metalness: 0,
        sheen: 1.0,
        sheenColor: new THREE.Color(0.1, 0.1, 0.1),
        sheenRoughness: 0.8,
        envMapIntensity: 0.1,
        side: THREE.DoubleSide,
      }),
    [artworkMap, suedeNormal, suedeHeight, suedeRoughness]
  )

  // FRAME — dark PETG
  const frameMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0.015, 0.015, 0.015),
        roughness: 0.5,
        metalness: 0,
        clearcoat: 0.4,
        clearcoatRoughness: 0.3,
        side: THREE.DoubleSide,
      }),
    []
  )

  // BACK — black suede (research preset)
  const backMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0.08, 0.08, 0.08),
        normalMap: suedeNormal,
        normalScale: new THREE.Vector2(0.15, 0.15),
        bumpMap: suedeHeight,
        bumpScale: 1.0,
        roughnessMap: suedeRoughness,
        roughness: 1.0,
        metalness: 0,
        sheen: 1.0,
        sheenColor: new THREE.Color(0.1, 0.1, 0.1),
        sheenRoughness: 0.8,
        envMapIntensity: 0.1,
        side: THREE.DoubleSide,
      }),
    [suedeNormal, suedeHeight, suedeRoughness]
  )

  // Override materials and generate planar UVs for face
  useMemo(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        switch (child.name) {
          case 'PRINT_SURFACE_FRONT': {
            child.material = faceMaterial

            // Generate planar UV projection (KeyShot UVs are unusable for artwork)
            const geo = child.geometry
            const posAttr = geo.getAttribute('position')
            const count = posAttr.count

            // Find XY bounding box
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

            // Project positions to 0-1 UV space
            const uvs = new Float32Array(count * 2)
            for (let i = 0; i < count; i++) {
              uvs[i * 2] = (posAttr.getX(i) - xMin) / xRange
              uvs[i * 2 + 1] = (posAttr.getY(i) - yMin) / yRange
            }

            // Replace the UV attribute with our planar projection
            geo.deleteAttribute('uv')
            geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))

            console.log('[UV] Face planar UVs generated:', { count, xMin, xMax, yMin, yMax })
            break
          }
          case 'BACK': {
            child.material = backMaterial

            // Generate planar UVs for back too (KeyShot UVs cause stretching)
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
      // Hide KeyShot lights/empties
      if (child.name === 'NEW LIGHTS' || child instanceof THREE.Light) {
        child.visible = false
      }
    })
  }, [scene, faceMaterial, backMaterial, frameMaterial])

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  )
}

useGLTF.preload('/assets/shapes/effect-70mm-step.glb')

export default function EffectViewer() {
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
        camera={{ position: [0, 0, 0.2], fov: 35, near: 0.001, far: 100 }}
      >
        <Suspense fallback={null}>
          <Environment preset="studio" intensity={1.0} />
          <ambientLight intensity={0.5} />
          <EffectModel />
        </Suspense>

        <OrbitControls
          target={[0, 0, 0]}
          enableDamping
          dampingFactor={0.1}
        />
      </Canvas>
    </div>
  )
}
