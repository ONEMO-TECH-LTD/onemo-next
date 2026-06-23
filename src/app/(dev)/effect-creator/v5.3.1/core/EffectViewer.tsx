// Core EffectViewer — pure Canvas wrapper, no Leva, no store
// Receives all config as typed props. Both Studio and Create use this.
// Studio wraps this via children + onCreated for composability.

import { Canvas, type RootState, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'
import React, { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EffectModel from './EffectModel'
import ShapedModelBridge from './shaped/ShapedModelBridge'
import type { ViewerConfig, DesignState } from '../types'
import type { SuedeMaterialParams } from '@/lib/effect/types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'

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
  /** Shaped-effect mode: render the prepared effect mesh (not a GLB object) in the same scene. */
  shaped?: boolean
  /** The 2D-prepared effect — the one engine's output; the mesh + textures derive from it. */
  prepared?: PreparedEffect
  /** Build status (used to show the generate shimmer / loading while BEN runs). */
  onStatus?: (status: 'idle' | 'building' | 'ready' | 'error', message?: string) => void
  /** Freeze the WebGL render loop (e.g. while the 2D outline editor is open — no 3D needed). */
  frozen?: boolean
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

/** §6.1 no-blank-mount: demand frameloop misses content that arrives AFTER the initial frame
 *  (HDR env, suede maps, GLB). Hook the global LoadingManager → invalidate() on every load batch.
 *  PLUS a boot/unfreeze cascade: a deterministic invalidate burst after mount, on prepared-content
 *  swaps, and whenever the freeze lifts — measured live (2026-06-10): the fully loaded scene sat
 *  blank ~15s until ANY external invalidate (a click / window resize) because no single async
 *  arrival path fired post-boot. The burst guarantees first paint regardless of which path misses. */
function InvalidateOnAssetLoad({ frozen, contentKey }: { frozen?: boolean; contentKey?: unknown }) {
  const invalidate = useThree((s) => s.invalidate)
  React.useEffect(() => {
    const mgr = THREE.DefaultLoadingManager
    const prevOnLoad = mgr.onLoad
    mgr.onLoad = () => { prevOnLoad?.(); invalidate() }
    return () => { mgr.onLoad = prevOnLoad }
  }, [invalidate])
  React.useEffect(() => {
    if (frozen) return
    invalidate()
    const ts = [150, 500, 1000, 1800].map((ms) => setTimeout(() => invalidate(), ms))
    return () => ts.forEach(clearTimeout)
  }, [frozen, contentKey, invalidate])
  return null
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
    } else {
      camera.lookAt(new THREE.Vector3(...target))
    }
    /* eslint-enable react-hooks/immutability */
  }, [camera, config.camera, orbitControlsRef])

  return null
}

/** Derive suede material params from the scene's artwork/face role — the ONE material truth
 *  shared by the live ShapedModel AND the offscreen render factory (G8: one look everywhere). */
export function deriveSuede(config: ViewerConfig): SuedeMaterialParams {
  const roles = config.product?.materialRoles ?? []
  const artRole = config.product?.artworkSlot?.role
  const role = roles.find((r) => r.role === artRole) ?? roles[0]
  const d = role?.defaults ?? {}
  const t = role?.textures ?? {}
  return {
    color: d.color ?? '#ffffff',
    roughness: Number(d.roughness ?? 1),
    metalness: Number(d.metalness ?? 0),
    envMapIntensity: Number(d.envMapIntensity ?? 1),
    normalScale: Number(d.normalScale ?? 1),
    bumpScale: Number(d.bumpScale ?? 1),
    sheen: Number(d.sheen ?? 0),
    sheenColor: d.sheenColor ?? '#000000',
    sheenRoughness: Number(d.sheenRoughness ?? 1),
    normalMap: t.normalMap,
    roughnessMap: t.roughnessMap,
    bumpMap: t.bumpMap,
  }
}

export default function EffectViewer({
  config,
  artworkUrl,
  designState,
  isEditing,
  shaped = false,
  prepared,
  onStatus,
  frozen = false,
  children,
  onCreated,
  orbitControlsRef,
  onModelReady,
}: EffectViewerProps) {
  // Preload the model (skip in shaped mode — no GLB object)
  if (config.modelPath && !shaped) {
    useGLTF.preload(config.modelPath)
  }

  const cam = config.camera
  const env = config.environment
  const effectiveArtworkUrl = artworkUrl || config.product.artworkSlot?.defaultUrl

  // Derive suede material params from the scene's artwork/face role (reused by the shaped mesh)
  const suede = useMemo<SuedeMaterialParams>(() => deriveSuede(config), [config])

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
        frameloop={frozen ? 'never' : 'demand'}  /* demand = render only on change; never = frozen while the 2D editor is open */
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
        dpr={[1, 2]}  /* DPR ceiling 2: the 1.5 cap rendered ~83% of a 1.8-DPR display (the measured
                         "pixelated scene" deficit — Run 0 lens diagnosis); 2 covers retina-class
                         displays at native sharpness while still capping DPR-3 phones (perf) */
        camera={canvasCamera}
        onCreated={handleCreated}
      >
        <Suspense fallback={null}>
          <InvalidateOnAssetLoad frozen={frozen} contentKey={prepared} />
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
          {shaped ? (
            prepared ? (
              <ShapedModelBridge
                prepared={prepared}
                designState={designState}
                scene={config.scene}
                suede={suede}
                backColor={config.colors.backColor}
                onStatus={onStatus}
              />
            ) : null
          ) : config.modelPath ? (
            <EffectModel
              modelPath={config.modelPath}
              artworkUrl={effectiveArtworkUrl}
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
          /* perf: damping defaults FALSE. enableDamping=true makes OrbitControls call invalidate()
             every frame to decay inertia → defeats frameloop="demand" → the idle scene redraws
             continuously (the one real continuous-render cause — blueprint §6.1). Off = idle renders
             once then stops; spin still works (active drag fires invalidate during interaction). */
          enableDamping={cam?.enableDamping ?? false}
          dampingFactor={cam?.dampingFactor ?? 0.1}
          autoRotate={false}  /* perf: no continuous spin → idle renders once then stops (frameloop demand) */
          autoRotateSpeed={cam?.autoRotateSpeed ?? 2}
          enabled={!isEditing && !frozen}
        />

        {children}
      </Canvas>
    </div>
  )
}
