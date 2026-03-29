// AdminViewer — manages material state + Leva for camera/env
// MaterialPanel handles per-part file pickers + sliders
// Leva only used for Camera + Environment

'use client'

import { useEffect, useState } from 'react'
import { useControls } from 'leva'
import { useSceneStore } from './sceneStore'
import { useAssets } from './useAssets'
import { useLevaHighlight } from './useLevaHighlight'
import MaterialPanel from './MaterialPanel'
import FileField from './FileField'
import type {
  DesignState, ViewerConfig, TexturePaths,
  FaceMaterialConfig, BackMaterialConfig, FrameMaterialConfig,
} from '../types'

export interface AssetProps {
  modelPath: string
  hdriPath: string
  onModelChange: (path: string) => void
  onHdriChange: (path: string) => void
}

interface AdminViewerProps {
  artworkUrl?: string
  designState: DesignState
  isEditing: boolean
  onTextureChange?: (path: string) => void
  children: (config: ViewerConfig, assetProps: AssetProps, materialPanels: React.ReactNode) => React.ReactNode
}

const DEFAULT_TEXTURES: TexturePaths = {
  normal: '/assets/materials/ultrasuede/suede-normal.png',
  roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
  height: '/assets/materials/ultrasuede/suede-height.png',
}

export default function AdminViewer(props: AdminViewerProps) {
  const assets = useAssets()
  if (!assets.loaded) {
    return <AdminViewerInner {...props} assets={assets} key="loading" />
  }
  return <AdminViewerInner {...props} assets={assets} key="loaded" />
}

function AdminViewerInner({
  children,
  assets,
  artworkUrl,
  onTextureChange,
}: AdminViewerProps & { assets: ReturnType<typeof useAssets> }) {
  const colors = useSceneStore((s) => s.colors)

  // ─── Model + HDRI paths ───────────────────────────────────
  const [modelPath, setModelPath] = useState(Object.values(assets.models)[0] || '/assets/shapes/effect-70mm-step.glb')
  const [hdriPath, setHdriPath] = useState('studio')

  // ─── Face Material state ──────────────────────────────────
  const [faceParams, setFaceParams] = useState<FaceMaterialConfig>({
    color: '#ffffff',
    roughness: 1.0, metalness: 0, envMapIntensity: 0.1, normalScale: 0.15,
    bumpScale: 1.0, sheen: 1.0, sheenColor: '#1a1a1a', sheenRoughness: 0.8, colorMultiplier: 1.0,
  })
  const [faceTextures, setFaceTextures] = useState<TexturePaths>({ ...DEFAULT_TEXTURES })

  // ─── Back Material state ──────────────────────────────────
  const [backParams, setBackParams] = useState<BackMaterialConfig>({
    color: colors.backColor, roughness: 1.0, envMapIntensity: 0.1, normalScale: 0.15,
    bumpScale: 1.0, sheen: 1.0, sheenColor: '#1a1a1a', sheenRoughness: 0.8,
  })
  const [backTextures, setBackTextures] = useState<TexturePaths>({ ...DEFAULT_TEXTURES })

  // ─── Frame Material state ─────────────────────────────────
  const [frameParams, setFrameParams] = useState<FrameMaterialConfig>({
    color: colors.frameColor, roughness: 0.5, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3,
  })

  // ─── Camera (Leva) ────────────────────────────────────────
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

  // ─── Environment (Leva) ───────────────────────────────────
  const [envParams] = useControls('Environment', () => ({
    envRotation: { value: 0, min: -180, max: 180, step: 1 },
    groundEnabled: false,
    groundHeight: { value: 0, min: -1, max: 1, step: 0.01 },
    groundRadius: { value: 20, min: 1, max: 100, step: 1 },
  }))

  // ─── Scene (Leva) ────────────────────────────────────────
  const [sceneParams] = useControls('Scene', () => ({
    exposure: { value: 0.7, min: 0.1, max: 3, step: 0.05 },
    ambientIntensity: { value: 0.5, min: 0, max: 2, step: 0.05 },
    envIntensity: { value: 1.0, min: 0, max: 5, step: 0.1 },
    background: '#ffffff',
  }))

  useLevaHighlight()

  const isPreset = !hdriPath.startsWith('/assets/')

  // ─── Param update helpers ─────────────────────────────────
  const updateFaceParam = (key: string, value: number | string) => {
    setFaceParams(prev => ({ ...prev, [key]: value }))
  }
  const updateBackParam = (key: string, value: number | string) => {
    setBackParams(prev => ({ ...prev, [key]: value }))
  }
  const updateFrameParam = (key: string, value: number | string) => {
    setFrameParams(prev => ({ ...prev, [key]: value }))
  }
  const updateFaceTexture = (slot: keyof TexturePaths, path: string) => {
    setFaceTextures(prev => ({ ...prev, [slot]: path }))
  }
  const updateBackTexture = (slot: keyof TexturePaths, path: string) => {
    setBackTextures(prev => ({ ...prev, [slot]: path }))
  }

  // ─── Build config ─────────────────────────────────────────
  const config: ViewerConfig = {
    modelPath,
    face: { params: faceParams, textures: faceTextures },
    back: { params: backParams, textures: backTextures },
    frame: { params: frameParams, textures: {} },
    scene: sceneParams,
    colors,
    camera: cameraParams,
    environment: {
      preset: isPreset ? hdriPath : 'studio',
      customHdri: isPreset ? undefined : hdriPath,
      envRotation: envParams.envRotation,
      groundEnabled: envParams.groundEnabled,
      groundHeight: envParams.groundHeight,
      groundRadius: envParams.groundRadius,
    },
  }

  const assetProps: AssetProps = {
    modelPath, hdriPath,
    onModelChange: setModelPath,
    onHdriChange: setHdriPath,
  }

  // ─── Material panels (rendered in left panel area) ────────
  const materialPanels = (
    <>
      {/* Model + HDRI file pickers */}
      <div style={{ background: 'rgba(224,224,224,0.95)', borderRadius: 8, padding: '8px 0', marginBottom: 4 }}>
        <div style={{ padding: '0 8px 4px', fontSize: 12, fontWeight: 600, color: '#222' }}>Scene Assets</div>
        <FileField label="Model" value={modelPath} type="shapes" accept=".glb,.gltf" onChange={setModelPath} />
        <FileField label="HDRI" value={hdriPath} type="env" accept=".exr,.hdr,.hdri" onChange={setHdriPath} />
      </div>

      {/* Face Material */}
      <MaterialPanel
        title="Face"
        textures={faceTextures}
        params={faceParams as unknown as Record<string, number | string>}
        textureSlots={['texture', 'normal', 'roughness', 'height', 'sheenColor']}
        onTextureChange={updateFaceTexture}
        onParamChange={updateFaceParam}
        sliders={[
          { key: 'roughness', value: 1.0, min: 0, max: 1, step: 0.01 },
          { key: 'metalness', value: 0, min: 0, max: 1, step: 0.01 },
          { key: 'envMapIntensity', value: 0.1, min: 0, max: 2, step: 0.01 },
          { key: 'normalScale', value: 0.15, min: 0, max: 2, step: 0.01 },
          { key: 'bumpScale', value: 1.0, min: 0, max: 5, step: 0.1 },
          { key: 'sheen', value: 1.0, min: 0, max: 1, step: 0.01 },
          { key: 'sheenRoughness', value: 0.8, min: 0, max: 1, step: 0.01 },
          { key: 'colorMultiplier', value: 1.0, min: 0.5, max: 2.5, step: 0.05 },
        ]}
        colors={[{ key: 'sheenColor', value: faceParams.sheenColor }]}
      />

      {/* Back Material */}
      <MaterialPanel
        title="Back"
        textures={backTextures}
        params={backParams as unknown as Record<string, number | string>}
        textureSlots={['texture', 'normal', 'roughness', 'height', 'sheenColor']}
        onTextureChange={updateBackTexture}
        onParamChange={updateBackParam}
        sliders={[
          { key: 'roughness', value: 1.0, min: 0, max: 1, step: 0.01 },
          { key: 'envMapIntensity', value: 0.1, min: 0, max: 2, step: 0.01 },
          { key: 'normalScale', value: 0.15, min: 0, max: 2, step: 0.01 },
          { key: 'bumpScale', value: 1.0, min: 0, max: 5, step: 0.1 },
          { key: 'sheen', value: 1.0, min: 0, max: 1, step: 0.01 },
          { key: 'sheenRoughness', value: 0.8, min: 0, max: 1, step: 0.01 },
        ]}
        colors={[
          { key: 'color', value: backParams.color },
          { key: 'sheenColor', value: backParams.sheenColor },
        ]}
      />

      {/* Frame Material */}
      <MaterialPanel
        title="Frame"
        textures={{}}
        params={frameParams as unknown as Record<string, number | string>}
        textureSlots={[]}
        onTextureChange={() => {}}
        onParamChange={updateFrameParam}
        sliders={[
          { key: 'roughness', value: 0.5, min: 0, max: 1, step: 0.01 },
          { key: 'metalness', value: 0, min: 0, max: 1, step: 0.01 },
          { key: 'clearcoat', value: 0.4, min: 0, max: 1, step: 0.01 },
          { key: 'clearcoatRoughness', value: 0.3, min: 0, max: 1, step: 0.01 },
        ]}
        colors={[{ key: 'color', value: frameParams.color }]}
      />
    </>
  )

  return <>{children(config, assetProps, materialPanels)}</>
}
