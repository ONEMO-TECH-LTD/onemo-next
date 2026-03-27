'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { useGesture } from '@use-gesture/react'
import { INITIAL_DESIGN } from './user/Toolbar'
import type { ColorConfig, DesignState } from './types'

// Dynamic imports — no SSR for 3D components
const EffectViewer = dynamic(() => import('./core/EffectViewer'), { ssr: false })
const ColorPanel = dynamic(() => import('./user/ColorPanel'), { ssr: false })
const Toolbar = dynamic(() => import('./user/Toolbar'), { ssr: false })
const EditOverlay = dynamic(() => import('./user/EditOverlay'), { ssr: false })

const MIN_SCALE = 1.0
const MAX_SCALE = 4.0
const DRAG_SENSITIVITY = 0.001
const SCROLL_SENSITIVITY = 0.002

const DEFAULT_COLORS: ColorConfig = {
  backColor: '#080808',
  frameColor: '#0f0f0f',
  bgColor: '#ffffff',
}

const CLEAN_VIEWER_CONFIG = {
  modelPath: '/assets/shapes/effect-70mm-step.glb',
  face: {
    params: {
      roughness: 1.0,
      metalness: 0,
      envMapIntensity: 0.1,
      normalScale: 0.15,
      bumpScale: 1.0,
      sheen: 1.0,
      sheenColor: '#1a1a1a',
      sheenRoughness: 0.8,
      colorMultiplier: 1.0,
    },
    textures: {
      normal: '/assets/materials/ultrasuede/suede-normal.png',
      roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
      height: '/assets/materials/ultrasuede/suede-height.png',
    },
  },
  back: {
    params: {
      color: DEFAULT_COLORS.backColor,
      roughness: 1.0,
      envMapIntensity: 0.1,
      normalScale: 0.15,
      bumpScale: 1.0,
      sheen: 1.0,
      sheenColor: '#1a1a1a',
      sheenRoughness: 0.8,
    },
    textures: {
      normal: '/assets/materials/ultrasuede/suede-normal.png',
      roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
      height: '/assets/materials/ultrasuede/suede-height.png',
    },
  },
  frame: {
    params: {
      color: DEFAULT_COLORS.frameColor,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
    },
    textures: {},
  },
  scene: {
    exposure: 0.7,
    ambientIntensity: 0.5,
    envIntensity: 1.0,
    background: DEFAULT_COLORS.bgColor,
  },
  camera: {
    fov: 35,
    distance: 0.2,
    polarAngle: 90,
    azimuthAngle: 0,
    enableDamping: true,
    dampingFactor: 0.1,
    autoRotate: false,
    autoRotateSpeed: 2,
  },
  environment: {
    preset: 'studio',
    envRotation: 0,
    groundEnabled: false,
    groundHeight: 0,
    groundRadius: 20,
  },
}

export default function StudioPage() {
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [designState, setDesignState] = useState<DesignState>(INITIAL_DESIGN)
  const [colors, setColors] = useState<ColorConfig>(DEFAULT_COLORS)
  const [showColors, setShowColors] = useState(false)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (artworkUrl?.startsWith('blob:')) URL.revokeObjectURL(artworkUrl)
    setArtworkUrl(URL.createObjectURL(file))
    setDesignState(INITIAL_DESIGN)
  }, [artworkUrl])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const bind = useGesture(
    {
      onDrag: ({ delta: [dx, dy], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((prev) => ({
          ...prev,
          offsetX: prev.offsetX + dx * DRAG_SENSITIVITY,
          offsetY: prev.offsetY - dy * DRAG_SENSITIVITY,
        }))
      },
      onPinch: ({ offset: [scale], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((prev) => ({
          ...prev,
          scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)),
        }))
      },
      onWheel: ({ delta: [, dy], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((prev) => ({
          ...prev,
          scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale - dy * SCROLL_SENSITIVITY)),
        }))
      },
    },
    {
      drag: { enabled: isEditing },
      pinch: { enabled: isEditing, scaleBounds: { min: MIN_SCALE, max: MAX_SCALE } },
      wheel: { enabled: isEditing },
      eventOptions: { passive: false },
    }
  )

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: colors.bgColor, touchAction: isEditing ? 'none' : 'auto' }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      {...(isEditing ? bind() : {})}
    >
      <EffectViewer
        config={{
          ...CLEAN_VIEWER_CONFIG,
          scene: {
            ...CLEAN_VIEWER_CONFIG.scene,
            background: colors.bgColor,
          },
          colors,
          back: {
            ...CLEAN_VIEWER_CONFIG.back,
            params: {
              ...CLEAN_VIEWER_CONFIG.back.params,
              color: colors.backColor,
            },
          },
          frame: {
            ...CLEAN_VIEWER_CONFIG.frame,
            params: {
              ...CLEAN_VIEWER_CONFIG.frame.params,
              color: colors.frameColor,
            },
          },
        }}
        artworkUrl={artworkUrl}
        designState={designState}
        isEditing={isEditing}
      />

      {/* User: color panel */}
      {showColors && (
        <ColorPanel
          backColor={colors.backColor}
          frameColor={colors.frameColor}
          bgColor={colors.bgColor}
          onBackColor={(backColor) => setColors((prev) => ({ ...prev, backColor }))}
          onFrameColor={(frameColor) => setColors((prev) => ({ ...prev, frameColor }))}
          onBgColor={(bgColor) => setColors((prev) => ({ ...prev, bgColor }))}
        />
      )}

      {/* User: toolbar */}
      <Toolbar
        artworkUrl={artworkUrl}
        isEditing={isEditing}
        showColors={showColors}
        onFile={handleFile}
        onToggleEdit={() => setIsEditing((prev) => !prev)}
        onResetDesign={() => setDesignState(INITIAL_DESIGN)}
        onToggleColors={() => setShowColors((prev) => !prev)}
      />

      {/* User: edit mode overlay + drag indicator */}
      <EditOverlay
        isEditing={isEditing}
        scale={designState.scale}
        isDragging={isDragging}
      />
    </div>
  )
}
