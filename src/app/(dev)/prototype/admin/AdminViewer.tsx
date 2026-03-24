// AdminViewer — wraps core/EffectViewer with Leva controls
// All useControls() calls live here (DOM side, outside Canvas).
// Values pass as typed config prop to the core viewer.

'use client'

import { useEffect } from 'react'
import { useControls } from 'leva'
import { useSceneStore } from './sceneStore'
import { useAssets } from './useAssets'
import { useLevaHighlight } from './useLevaHighlight'
// useLevaBrowse removed — browse buttons live in ScenePanel (left panel)
import type { DesignState, ViewerConfig } from '../types'

interface AdminViewerProps {
  artworkUrl?: string
  designState: DesignState
  isEditing: boolean
  children: (config: ViewerConfig) => React.ReactNode
}

export default function AdminViewer(props: AdminViewerProps) {
  const assets = useAssets()

  // Force remount of controls when assets finish loading
  // Leva useControls options are static at mount — remount to update
  if (!assets.loaded) {
    return <AdminViewerInner {...props} assets={assets} key="loading" />
  }
  return <AdminViewerInner {...props} assets={assets} key="loaded" />
}

function AdminViewerInner({
  children,
  assets,
}: AdminViewerProps & { assets: ReturnType<typeof useAssets> }) {
  const registerSetter = useSceneStore((s) => s.registerSetter)
  const syncValues = useSceneStore((s) => s.syncValues)
  const colors = useSceneStore((s) => s.colors)

  // ─── Scene Setup ──────────────────────────────────────────
  const [sceneParams, setScene] = useControls('Scene', () => ({
    model: {
      value: Object.values(assets.models)[0] || '/assets/shapes/effect-70mm-step.glb',
      options: assets.models,
    },
    exposure: { value: 0.7, min: 0.1, max: 3, step: 0.05 },
    ambientIntensity: { value: 0.5, min: 0, max: 2, step: 0.05 },
    envIntensity: { value: 1.0, min: 0, max: 5, step: 0.1 },
    background: '#ffffff',
  }))

  // ─── Camera ───────────────────────────────────────────────
  const [cameraParams] = useControls('Camera', () => ({
    fov: { value: 35, min: 10, max: 120, step: 1 },
    distance: { value: 0.2, min: 0.05, max: 2, step: 0.01 },
    polarAngle: { value: 90, min: 0, max: 180, step: 1 },
    azimuthAngle: { value: 0, min: -180, max: 180, step: 1 },
    enableDamping: true,
    dampingFactor: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
    autoRotate: false,
    autoRotateSpeed: { value: 2, min: 0.1, max: 10, step: 0.1 },
  }))

  // ─── Environment ──────────────────────────────────────────
  const [envParams] = useControls('Environment', () => ({
    hdri: {
      value: Object.values(assets.hdris)[0] || 'studio',
      options: assets.hdris,
    },
    envRotation: { value: 0, min: -180, max: 180, step: 1 },
    groundEnabled: false,
    groundHeight: { value: 0, min: -1, max: 1, step: 0.01 },
    groundRadius: { value: 20, min: 1, max: 100, step: 1 },
  }))

  // ─── Textures (read-only dropdowns — select from existing, import via left panel) ─
  const [textureParams] = useControls('Textures', () => ({
    normalMap: {
      value: Object.values(assets.normalMaps)[0] || '/assets/materials/ultrasuede/suede-normal.png',
      options: Object.keys(assets.normalMaps).length > 0 ? assets.normalMaps : { 'ultrasuede': '/assets/materials/ultrasuede/suede-normal.png' },
    },
    roughnessMap: {
      value: Object.values(assets.roughnessMaps)[0] || '/assets/materials/ultrasuede/suede-roughness.jpg',
      options: Object.keys(assets.roughnessMaps).length > 0 ? assets.roughnessMaps : { 'ultrasuede': '/assets/materials/ultrasuede/suede-roughness.jpg' },
    },
    heightMap: {
      value: Object.values(assets.heightMaps)[0] || '/assets/materials/ultrasuede/suede-height.png',
      options: Object.keys(assets.heightMaps).length > 0 ? assets.heightMaps : { 'ultrasuede': '/assets/materials/ultrasuede/suede-height.png' },
    },
    sheenMap: {
      value: Object.values(assets.sheenMaps)[0] || 'none',
      options: { 'none': 'none', ...assets.sheenMaps },
    },
  }))

  // ─── Face Material ────────────────────────────────────────
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

  // ─── Back Material ────────────────────────────────────────
  const [backParams, setBack] = useControls('Back Material', () => ({
    color: colors.backColor,
    roughness: { value: 1.0, min: 0, max: 1, step: 0.01 },
    envMapIntensity: { value: 0.1, min: 0, max: 2, step: 0.01 },
    normalScale: { value: 0.15, min: 0, max: 2, step: 0.01 },
    bumpScale: { value: 1.0, min: 0, max: 5, step: 0.1 },
    sheen: { value: 1.0, min: 0, max: 1, step: 0.01 },
    sheenColor: '#1a1a1a',
    sheenRoughness: { value: 0.8, min: 0, max: 1, step: 0.01 },
  }))

  // ─── Frame Material ───────────────────────────────────────
  const [frameParams, setFrame] = useControls('Frame Material', () => ({
    color: colors.frameColor,
    roughness: { value: 0.5, min: 0, max: 1, step: 0.01 },
    metalness: { value: 0, min: 0, max: 1, step: 0.01 },
    clearcoat: { value: 0.4, min: 0, max: 1, step: 0.01 },
    clearcoatRoughness: { value: 0.3, min: 0, max: 1, step: 0.01 },
  }))

  // Register setters with store for save/load
  useEffect(() => {
    registerSetter('Face Material', setFace)
    registerSetter('Back Material', setBack)
    registerSetter('Frame Material', setFrame)
    registerSetter('Scene', setScene)
  }, [registerSetter, setFace, setBack, setFrame, setScene])

  // Sync current values to store
  useEffect(() => { syncValues('Face Material', faceParams) }, [syncValues, faceParams])
  useEffect(() => { syncValues('Back Material', backParams) }, [syncValues, backParams])
  useEffect(() => { syncValues('Frame Material', frameParams) }, [syncValues, frameParams])
  useEffect(() => { syncValues('Scene', sceneParams) }, [syncValues, sceneParams])

  // Per-value highlighting: labels turn amber when value differs from saved baseline
  // Clicking a highlighted label resets that specific value
  useLevaHighlight()

  // Determine if HDRI is a preset name or a custom file path
  const hdriValue = envParams.hdri as string
  const isPreset = !hdriValue.startsWith('/assets/')

  // Build the typed config from Leva values
  const config: ViewerConfig = {
    modelPath: sceneParams.model as string,
    face: faceParams,
    back: backParams,
    frame: frameParams,
    scene: sceneParams,
    textures: {
      normal: (textureParams as Record<string, string>).normalMap || '/assets/materials/ultrasuede/suede-normal.png',
      roughness: (textureParams as Record<string, string>).roughnessMap || '/assets/materials/ultrasuede/suede-roughness.jpg',
      height: (textureParams as Record<string, string>).heightMap || '/assets/materials/ultrasuede/suede-height.png',
      sheenColor: (textureParams as Record<string, string>).sheenMap,
    },
    colors,
    camera: cameraParams,
    environment: {
      preset: isPreset ? hdriValue : 'studio',
      customHdri: isPreset ? undefined : hdriValue,
      envRotation: envParams.envRotation,
      groundEnabled: envParams.groundEnabled,
      groundHeight: envParams.groundHeight,
      groundRadius: envParams.groundRadius,
    },
  }

  return <>{children(config)}</>
}
