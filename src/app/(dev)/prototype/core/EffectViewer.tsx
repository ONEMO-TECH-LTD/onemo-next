// Core EffectViewer — pure Canvas wrapper, no Leva, no store
// Receives all config as typed props. Both Studio and Create use this.
// Studio wraps this via children + onCreated for composability.

import { Canvas, type RootState, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'
import React, { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EffectModel from './EffectModel'
import type { ViewerConfig, DesignState } from '../types'

const DEFAULT_ARTWORK = '/assets/test-artwork.png'
const DEFAULT_ENVIRONMENT_PRESET = 'studio'
type DreiEnvironmentPreset =
  | 'studio'
  | 'city'
  | 'sunset'
  | 'dawn'
  | 'night'
  | 'warehouse'
  | 'forest'
  | 'apartment'
  | 'park'
  | 'lobby'
const LOCAL_ENVIRONMENT_PRESETS: Partial<Record<DreiEnvironmentPreset, string>> = {
  studio: '/assets/env/studio_small_03_1k.hdr',
}

// Bridge interface — what Studio gets from onCreated to wire the bridge
export interface EffectViewerBridge {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
}

interface EffectViewerProps {
  config: ViewerConfig
  artworkUrl?: string
  designState: DesignState
  isEditing: boolean
  /** Studio injects controls (grid, gizmo, selection overlay) as children inside the Canvas */
  children?: React.ReactNode
  /** Fires after Canvas + WebGLRenderer are created. Studio uses this to wire the bridge. */
  onCreated?: (bridge: EffectViewerBridge) => void
  /** Studio passes this to control OrbitControls externally (camera commands, navigation). */
  orbitControlsRef?: React.RefObject<React.ComponentRef<typeof OrbitControls> | null>
  /** Studio receives the loaded model root directly from EffectModel instead of scanning mesh names. */
  onModelReady?: (payload: {
    modelRoot: THREE.Object3D
    materialSlots: Map<string, THREE.Material | THREE.Material[]>
  }) => void
}

function RendererBackgroundSync({ color }: { color: string }) {
  const { gl } = useThree()

  React.useEffect(() => {
    gl.setClearColor(color, 1)
  }, [color, gl])

  return null
}

function RendererSettingsSync({ config }: { config: ViewerConfig }) {
  const { gl } = useThree()

  React.useEffect(() => {
    const rendererConfig = config.renderer
    if (!rendererConfig) {
      return
    }

    /* eslint-disable react-hooks/immutability -- Three renderer is an imperative runtime object. */
    gl.toneMapping = rendererConfig.toneMapping as THREE.ToneMapping
    gl.toneMappingExposure = rendererConfig.toneMappingExposure
    gl.outputColorSpace = rendererConfig.outputColorSpace === 'srgb-linear'
      ? THREE.LinearSRGBColorSpace
      : THREE.SRGBColorSpace
    gl.shadowMap.enabled = rendererConfig.shadowsEnabled
    gl.shadowMap.type = rendererConfig.shadowType as THREE.ShadowMapType
    gl.shadowMap.needsUpdate = true
    /* eslint-enable react-hooks/immutability */
  }, [config.renderer, gl])

  return null
}

function CameraConfigSync({
  config,
  orbitControlsRef,
}: {
  config: ViewerConfig
  orbitControlsRef?: React.RefObject<React.ComponentRef<typeof OrbitControls> | null>
}) {
  const camera = useThree((state) => state.camera)
  const appliedSignatureRef = useRef<string | null>(null)
  const appliedCameraRef = useRef<THREE.Camera | null>(null)

  React.useEffect(() => {
    const cam = config.camera
    if (!cam) {
      return
    }

    const signature = JSON.stringify({
      fov: cam.fov,
      distance: cam.distance,
      polarAngle: cam.polarAngle,
      azimuthAngle: cam.azimuthAngle,
      target: cam.target ?? [0, 0, 0],
    })

    if (appliedSignatureRef.current === signature && appliedCameraRef.current === camera) {
      return
    }

    appliedSignatureRef.current = signature
    appliedCameraRef.current = camera

    const applyCameraConfig = () => {
      const polar = (cam.polarAngle * Math.PI) / 180
      const azimuth = (cam.azimuthAngle * Math.PI) / 180
      const target = cam.target ?? [0, 0, 0]
      const nextPosition: [number, number, number] = [
        target[0] + cam.distance * Math.sin(polar) * Math.sin(azimuth),
        target[1] + cam.distance * Math.cos(polar),
        target[2] + cam.distance * Math.sin(polar) * Math.cos(azimuth),
      ]

      /* eslint-disable react-hooks/immutability -- Three camera and controls are imperative runtime objects. */
      camera.position.set(...nextPosition)

      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = cam.fov
      }

      if ('updateProjectionMatrix' in camera && typeof camera.updateProjectionMatrix === 'function') {
        camera.updateProjectionMatrix()
      }

      const controls = orbitControlsRef?.current
      if (controls) {
        controls.target.set(...target)
        controls.update()
        return
      }

      camera.lookAt(new THREE.Vector3(...target))
      /* eslint-enable react-hooks/immutability */
    }

    applyCameraConfig()
    const timers = [
      window.setTimeout(applyCameraConfig, 0),
      window.setTimeout(applyCameraConfig, 50),
      window.setTimeout(applyCameraConfig, 150),
      window.setTimeout(applyCameraConfig, 500),
    ]

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [camera, config.camera, orbitControlsRef])

  return null
}

export default function EffectViewer({
  config,
  artworkUrl,
  designState,
  isEditing,
  children,
  onCreated,
  orbitControlsRef,
  onModelReady,
}: EffectViewerProps) {
  // Preload the model
  if (config.modelPath) {
    useGLTF.preload(config.modelPath)
  }

  const cam = config.camera
  const env = config.environment

  // Camera position from spherical coordinates (distance, polar, azimuth)
  const cameraPosition = useMemo(() => {
    if (!cam) return [0, 0, 0.2] as [number, number, number]
    const d = cam.distance
    const polar = (cam.polarAngle * Math.PI) / 180
    const azimuth = (cam.azimuthAngle * Math.PI) / 180
    const target = cam.target ?? [0, 0, 0]
    return [
      target[0] + d * Math.sin(polar) * Math.sin(azimuth),
      target[1] + d * Math.cos(polar),
      target[2] + d * Math.sin(polar) * Math.cos(azimuth),
    ] as [number, number, number]
  }, [cam])

  // Environment rotation as euler
  const envRotation = useMemo(() => {
    if (!env) return undefined
    const rad = (env.envRotation * Math.PI) / 180
    return new THREE.Euler(0, rad, 0)
  }, [env])

  const environmentSource = useMemo(() => {
    if (!env) {
      return null
    }

    if (env.customHdri) {
      return { files: env.customHdri }
    }

    const preset = (env.preset ?? DEFAULT_ENVIRONMENT_PRESET) as DreiEnvironmentPreset
    const localPresetFile = LOCAL_ENVIRONMENT_PRESETS[preset]
    if (localPresetFile) {
      return { files: localPresetFile }
    }

    return { preset }
  }, [env])

  const canvasCamera = useMemo(() => {
    return {
      position: cameraPosition,
      fov: cam?.fov ?? 35,
      near: 0.001,
      far: 100,
    }
  }, [cameraPosition, cam?.fov])

  const handleCreated = (state: RootState) => {
    state.gl.setClearColor(0x000000, 0)
    onCreated?.({
      scene: state.scene,
      camera: state.camera,
      renderer: state.gl,
    })
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: config.colors.bgColor }}>
      <Canvas
        gl={{
          alpha: true,
          antialias: true,
          toneMapping: (config.renderer?.toneMapping ?? THREE.NeutralToneMapping) as THREE.ToneMapping,
          toneMappingExposure: config.renderer?.toneMappingExposure ?? config.scene.exposure,
          outputColorSpace: config.renderer?.outputColorSpace === 'srgb-linear'
            ? THREE.LinearSRGBColorSpace
            : THREE.SRGBColorSpace,
        }}
        shadows={config.renderer?.shadowsEnabled ?? false}
        dpr={[1, 2]}
        camera={canvasCamera}
        onCreated={handleCreated}
      >
        <Suspense fallback={null}>
          <RendererBackgroundSync color={config.colors.bgColor} />
          <RendererSettingsSync config={config} />
          <CameraConfigSync config={config} orbitControlsRef={orbitControlsRef} />
          {env && environmentSource ? (
            <Environment
              {...environmentSource}
              environmentIntensity={config.scene.envIntensity}
              environmentRotation={envRotation}
              ground={env.groundEnabled ? {
                height: env.groundHeight,
                radius: env.groundRadius,
              } : undefined}
            />
          ) : null}
          {config.modelPath ? (
            <EffectModel
              modelPath={config.modelPath}
              artworkUrl={artworkUrl || DEFAULT_ARTWORK}
              designState={designState}
              scene={config.scene}
              product={config.product}
              onModelReady={onModelReady}
            />
          ) : null}
        </Suspense>

        <OrbitControls
          ref={orbitControlsRef}
          makeDefault
          target={cam?.target ?? [0, 0, 0]}
          enableDamping={cam?.enableDamping ?? true}
          dampingFactor={cam?.dampingFactor ?? 0.1}
          autoRotate={cam?.autoRotate ?? false}
          autoRotateSpeed={cam?.autoRotateSpeed ?? 2}
          enabled={!isEditing}
        />

        {children}
      </Canvas>
    </div>
  )
}
