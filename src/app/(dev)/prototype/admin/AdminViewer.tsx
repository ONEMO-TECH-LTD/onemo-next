// AdminViewer — manages material state + Leva for camera/env
// MaterialPanel handles per-part file pickers + sliders
// Leva only used for Camera + Environment

'use client'

import { useState } from 'react'
import { useSceneStore } from './sceneStore'
import { useAssets } from './useAssets'
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

  // ─── Golden scene defaults (from original prototype c0aacab) ───
  const cameraParams = {
    fov: 35, distance: 0.2, polarAngle: 90, azimuthAngle: 0,
    enableDamping: true, dampingFactor: 0.1, autoRotate: false, autoRotateSpeed: 2,
  }
  const envParams = { envRotation: 0, groundEnabled: false, groundHeight: 0, groundRadius: 20 }
  const sceneParams = { exposure: 0.7, ambientIntensity: 0.5, envIntensity: 1.0, background: '#ffffff' }

  const isPreset = !hdriPath.startsWith('/assets/')

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

  return <>{children(config, assetProps, null)}</>
}
