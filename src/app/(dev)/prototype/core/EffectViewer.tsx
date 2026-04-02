// Core EffectViewer — pure Canvas wrapper, no Leva, no store
// Receives all config as typed props. Both Studio and Create use this.

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import EffectModel from './EffectModel'
import type { ViewerConfig, DesignState } from '../types'

const DEFAULT_ARTWORK = '/assets/test-artwork.png'

interface EffectViewerProps {
  config: ViewerConfig
  artworkUrl?: string
  designState: DesignState
  isEditing: boolean
}

export default function EffectViewer({
  config,
  artworkUrl,
  designState,
  isEditing,
}: EffectViewerProps) {
  // Preload the model
  useGLTF.preload(config.modelPath)

  const cam = config.camera
  const env = config.environment

  // Camera position from spherical coordinates (distance, polar, azimuth)
  const cameraPosition = useMemo(() => {
    if (!cam) return [0, 0, 0.2] as [number, number, number]
    const d = cam.distance
    const polar = (cam.polarAngle * Math.PI) / 180
    const azimuth = (cam.azimuthAngle * Math.PI) / 180
    return [
      d * Math.sin(polar) * Math.sin(azimuth),
      d * Math.cos(polar),
      d * Math.sin(polar) * Math.cos(azimuth),
    ] as [number, number, number]
  }, [cam])

  // Environment rotation as euler
  const envRotation = useMemo(() => {
    if (!env) return undefined
    const rad = (env.envRotation * Math.PI) / 180
    return new THREE.Euler(0, rad, 0)
  }, [env])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: config.colors.bgColor }}>
      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: config.scene.exposure,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[1, 2]}
        camera={{
          position: cameraPosition,
          fov: cam?.fov ?? 35,
          near: 0.001,
          far: 100,
        }}
      >
        <Suspense fallback={null}>
          <Environment
            {...(env?.customHdri
              ? { files: env.customHdri }
              : { preset: (env?.preset ?? 'studio') as 'studio' | 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'park' | 'lobby' }
            )}
            environmentIntensity={config.scene.envIntensity}
            environmentRotation={envRotation}
            ground={env?.groundEnabled ? {
              height: env.groundHeight,
              radius: env.groundRadius,
            } : undefined}
          />
          <EffectModel
            modelPath={config.modelPath}
            artworkUrl={artworkUrl || DEFAULT_ARTWORK}
            designState={designState}
            face={config.face}
            back={config.back}
            frame={config.frame}
            scene={config.scene}
          />
        </Suspense>

        <OrbitControls
          target={[0, 0, 0]}
          enableDamping={cam?.enableDamping ?? true}
          dampingFactor={cam?.dampingFactor ?? 0.1}
          autoRotate={cam?.autoRotate ?? false}
          autoRotateSpeed={cam?.autoRotateSpeed ?? 2}
          enabled={!isEditing}
        />
      </Canvas>
    </div>
  )
}
