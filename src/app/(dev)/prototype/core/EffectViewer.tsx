// Core EffectViewer — pure Canvas wrapper, no Leva, no store
// Receives all config as typed props. Both Studio and Create use this.

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Line, DragControls, ContactShadows, useGLTF } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import EffectModel from './EffectModel'
import type { DirectionalLightConfig, ViewerConfig, DesignState } from '../types'

const DEFAULT_ARTWORK = '/assets/test-artwork.png'

interface EffectViewerProps {
  config: ViewerConfig
  artworkUrl?: string
  designState: DesignState
  isEditing: boolean
  showLightingHelpers?: boolean
  editLights?: boolean
  onLightChange?: (key: 'key' | 'fill' | 'rim', patch: Partial<DirectionalLightConfig>) => void
}

function GroundGuide({
  height,
  radius,
  background,
  showGrid,
}: {
  height: number
  radius: number
  background: string
  showGrid: boolean
}) {
  const gridSize = Math.max(radius * 2.2, 2)
  const gridDivisions = Math.max(8, Math.round(radius * 4))

  return (
    <group position={[0, height, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.001, 0]}>
        <planeGeometry args={[gridSize, gridSize]} />
        <meshStandardMaterial color={background} transparent opacity={0.16} />
      </mesh>

      {showGrid ? (
        <gridHelper args={[gridSize, gridDivisions, '#64748b', '#1e293b']} position={[0, 0.001, 0]} />
      ) : null}

      <ContactShadows
        position={[0, 0.002, 0]}
        scale={Math.max(radius * 1.8, 2)}
        blur={2.2}
        opacity={0.42}
        far={Math.max(radius * 1.6, 2)}
        resolution={1024}
        frames={1}
      />
    </group>
  )
}

function LightGuide({
  color,
  position,
  target,
}: {
  color: string
  position: [number, number, number]
  target: [number, number, number]
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Line
        points={[
          [0, 0, 0],
          [target[0] - position[0], target[1] - position[1], target[2] - position[2]],
        ]}
        color={color}
        lineWidth={1}
        transparent
        opacity={0.45}
      />
    </group>
  )
}

function SceneDirectionalLight({
  lightKey,
  light,
  showGuide,
  editable,
  shadowFrustum,
  shadowsEnabled,
  onLightChange,
}: {
  lightKey: 'key' | 'fill' | 'rim'
  light: DirectionalLightConfig
  showGuide: boolean
  editable: boolean
  shadowFrustum: number
  shadowsEnabled: boolean
  onLightChange?: (key: 'key' | 'fill' | 'rim', patch: Partial<DirectionalLightConfig>) => void
}) {
  const lightRef = useRef<THREE.DirectionalLight | THREE.SpotLight | null>(null)
  const targetRef = useRef<THREE.Object3D | null>(null)
  const target = useMemo<[number, number, number]>(
    () => [light.targetX ?? 0, light.targetY ?? 0, light.targetZ ?? 0],
    [light.targetX, light.targetY, light.targetZ],
  )
  const handleRef = useRef<THREE.Group | null>(null)
  const targetHandleRef = useRef<THREE.Group | null>(null)
  const setLightRef = useCallback((node: THREE.DirectionalLight | THREE.SpotLight | null) => {
    lightRef.current = node
  }, [])

  useEffect(() => {
    if (!lightRef.current || !targetRef.current) return
    lightRef.current.target = targetRef.current
    lightRef.current.target.updateMatrixWorld()
  }, [target])

  return (
    <>
      <object3D ref={targetRef} position={target} />
      {showGuide && light.type !== 'point' ? (
        editable ? (
          <DragControls
            axisLock={undefined}
            onDrag={(localMatrix) => {
              const position = new THREE.Vector3()
              const rotation = new THREE.Quaternion()
              const scale = new THREE.Vector3()
              localMatrix.decompose(position, rotation, scale)
              onLightChange?.(lightKey, { targetX: position.x, targetY: position.y, targetZ: position.z })
            }}
          >
            <group ref={targetHandleRef} position={target}>
              <mesh>
                <sphereGeometry args={[0.016, 12, 12]} />
                <meshBasicMaterial color={light.color} wireframe />
              </mesh>
            </group>
          </DragControls>
        ) : (
          <mesh position={target}>
            <sphereGeometry args={[0.016, 12, 12]} />
            <meshBasicMaterial color={light.color} wireframe />
          </mesh>
        )
      ) : null}
      {light.type === 'point' ? (
        <pointLight
          position={[light.x, light.y, light.z]}
          intensity={light.intensity}
          color={light.color}
          castShadow={shadowsEnabled}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
        />
      ) : light.type === 'spot' ? (
        <spotLight
          ref={setLightRef}
          position={[light.x, light.y, light.z]}
          intensity={light.intensity}
          color={light.color}
          angle={0.45}
          penumbra={0.35}
          castShadow={shadowsEnabled}
          shadow-mapSize-width={light.intensity > 1 ? 2048 : 1024}
          shadow-mapSize-height={light.intensity > 1 ? 2048 : 1024}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
        />
      ) : (
        <directionalLight
          ref={setLightRef}
          position={[light.x, light.y, light.z]}
          intensity={light.intensity}
          color={light.color}
          castShadow={shadowsEnabled}
          shadow-mapSize-width={light.intensity > 1 ? 2048 : 1024}
          shadow-mapSize-height={light.intensity > 1 ? 2048 : 1024}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
          shadow-camera-left={-shadowFrustum}
          shadow-camera-right={shadowFrustum}
          shadow-camera-top={shadowFrustum}
          shadow-camera-bottom={-shadowFrustum}
          shadow-camera-near={0.1}
          shadow-camera-far={Math.max(shadowFrustum * 6, 12)}
        />
      )}
      {showGuide && (
        <>
          {editable ? (
            <DragControls
              axisLock={undefined}
              onDrag={(localMatrix) => {
                const position = new THREE.Vector3()
                const rotation = new THREE.Quaternion()
                const scale = new THREE.Vector3()
                localMatrix.decompose(position, rotation, scale)
                onLightChange?.(lightKey, { x: position.x, y: position.y, z: position.z })
              }}
            >
              <group ref={handleRef} position={[light.x, light.y, light.z]}>
                <LightGuide color={light.color} position={[0, 0, 0]} target={[target[0] - light.x, target[1] - light.y, target[2] - light.z]} />
              </group>
            </DragControls>
          ) : (
            <LightGuide color={light.color} position={[light.x, light.y, light.z]} target={light.type === 'point' ? [light.x, light.y, light.z] : target} />
          )}
        </>
      )}
    </>
  )
}

export default function EffectViewer({
  config,
  artworkUrl,
  designState,
  isEditing,
  showLightingHelpers = false,
  editLights = false,
  onLightChange,
}: EffectViewerProps) {
  // Preload the model
  useGLTF.preload(config.modelPath)

  const cam = config.camera
  const env = config.environment
  const lights = config.lighting
  const groundRadius = Math.max(env?.groundRadius ?? 2, 2)
  const shadowFrustum = Math.max(groundRadius * 1.4, 2.5)
  const shadowsEnabled = config.scene.shadowEnabled ?? true
  const transparentBackground = config.scene.transparentBackground ?? false
  const toneMapping =
    config.scene.toneMapping === 'aces'
      ? THREE.ACESFilmicToneMapping
      : THREE.NeutralToneMapping
  const dprMin = Math.max(1, config.scene.dprMin ?? 2)
  const dprMax = Math.max(dprMin, config.scene.dprMax ?? 2)

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

  const postEffects = useMemo(() => {
    if (!config.postprocessing) return []

    const effects = []

    if (config.postprocessing.bloomEnabled) {
      effects.push(
        <Bloom
          key="bloom"
          intensity={config.postprocessing.bloomIntensity}
          luminanceThreshold={config.postprocessing.bloomLuminanceThreshold}
          mipmapBlur
          radius={config.postprocessing.bloomRadius}
        />,
      )
    }

    if (config.postprocessing.vignetteEnabled) {
      effects.push(
        <Vignette
          key="vignette"
          offset={config.postprocessing.vignetteOffset}
          darkness={config.postprocessing.vignetteDarkness}
          eskil={false}
        />,
      )
    }

    return effects
  }, [config.postprocessing])

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: transparentBackground ? 'transparent' : config.colors.bgColor,
      }}
    >
      <Canvas
        shadows={shadowsEnabled}
        gl={{
          antialias: true,
          alpha: transparentBackground,
          toneMapping,
          toneMappingExposure: config.scene.exposure,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[dprMin, dprMax]}
        frameloop={config.scene.frameloop ?? 'always'}
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
          {(env?.groundEnabled || showLightingHelpers) && shadowsEnabled ? (
            <GroundGuide
              height={env?.groundHeight ?? 0}
              radius={groundRadius}
              background={config.colors.bgColor}
              showGrid={showLightingHelpers}
            />
          ) : null}
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

        {lights?.key.enabled && (
          <SceneDirectionalLight lightKey="key" light={lights.key} showGuide={showLightingHelpers} editable={editLights} shadowFrustum={shadowFrustum} shadowsEnabled={shadowsEnabled} onLightChange={onLightChange} />
        )}
        {lights?.fill.enabled && (
          <SceneDirectionalLight lightKey="fill" light={lights.fill} showGuide={showLightingHelpers} editable={editLights} shadowFrustum={shadowFrustum} shadowsEnabled={shadowsEnabled} onLightChange={onLightChange} />
        )}
        {lights?.rim.enabled && (
          <SceneDirectionalLight lightKey="rim" light={lights.rim} showGuide={showLightingHelpers} editable={editLights} shadowFrustum={shadowFrustum} shadowsEnabled={shadowsEnabled} onLightChange={onLightChange} />
        )}

        <OrbitControls
          target={[0, 0, 0]}
          enableDamping={cam?.enableDamping ?? true}
          dampingFactor={cam?.dampingFactor ?? 0.1}
          autoRotate={cam?.autoRotate ?? false}
          autoRotateSpeed={cam?.autoRotateSpeed ?? 2}
          enabled={!isEditing}
        />

        {postEffects.length > 0 && (
          <EffectComposer multisampling={4}>
            {postEffects}
          </EffectComposer>
        )}
      </Canvas>
    </div>
  )
}
