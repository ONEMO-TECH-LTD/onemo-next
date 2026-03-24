'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { useGesture } from '@use-gesture/react'
import { Leva } from 'leva'
import { useSceneStore } from './admin/sceneStore'
import { INITIAL_DESIGN } from './user/Toolbar'
import type { DesignState } from './types'

// Dynamic imports — no SSR for 3D/admin components
const EffectViewer = dynamic(() => import('./core/EffectViewer'), { ssr: false })
const AdminViewer = dynamic(() => import('./admin/AdminViewer'), { ssr: false })
const ScenePanel = dynamic(() => import('./admin/ScenePanel'), { ssr: false })
const ResetPanel = dynamic(() => import('./admin/ResetPanel'), { ssr: false })
// AssetPanel replaced by per-part MaterialPanels rendered from AdminViewer
const ColorPanel = dynamic(() => import('./user/ColorPanel'), { ssr: false })
const Toolbar = dynamic(() => import('./user/Toolbar'), { ssr: false })
const EditOverlay = dynamic(() => import('./user/EditOverlay'), { ssr: false })

const MIN_SCALE = 1.0
const MAX_SCALE = 4.0
const DRAG_SENSITIVITY = 0.001
const SCROLL_SENSITIVITY = 0.002

export default function StudioPage() {
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [designState, setDesignState] = useState<DesignState>(INITIAL_DESIGN)
  const { colors, setBackColor, setFrameColor, setBgColor } = useSceneStore()
  const [showColors, setShowColors] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)

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
      {/* Leva admin panel — hidden by default */}
      <Leva
        collapsed={false}
        hidden={!showAdmin}
        theme={{
          colors: {
            elevation1: '#e0e0e0', elevation2: '#d0d0d0', elevation3: '#c0c0c0',
            accent1: '#666666', accent2: '#888888', accent3: '#999999',
            highlight1: '#444444', highlight2: '#555555', highlight3: '#333333',
            vivid1: '#555555', folderWidgetColor: '#777777', folderTextColor: '#222222',
            toolTipBackground: '#333333', toolTipText: '#ffffff',
          },
          fonts: { mono: 'ui-monospace, SFMono-Regular, monospace', sans: 'system-ui, -apple-system, sans-serif' },
          sizes: { rootWidth: '320px' },
        }}
      />

      {/* Admin wrapper: material panels + Leva camera/env → config → core viewer */}
      <AdminViewer
        artworkUrl={artworkUrl}
        designState={designState}
        isEditing={isEditing}
        onTextureChange={setArtworkUrl}
      >
        {(config, _assetProps, materialPanels) => (
          <>
            <EffectViewer
              config={config}
              artworkUrl={artworkUrl}
              designState={designState}
              isEditing={isEditing}
            />
            {/* Per-part material panels — left side, visible when admin is open */}
            {showAdmin && (
              <div style={{
                position: 'absolute', left: 16, top: 130, zIndex: 10,
                maxHeight: 'calc(100vh - 200px)', overflowY: 'auto',
                width: 260,
              }}>
                {materialPanels}
              </div>
            )}
          </>
        )}
      </AdminViewer>

      {/* User: color panel */}
      {showColors && (
        <ColorPanel
          backColor={colors.backColor}
          frameColor={colors.frameColor}
          bgColor={colors.bgColor}
          onBackColor={setBackColor}
          onFrameColor={setFrameColor}
          onBgColor={setBgColor}
        />
      )}

      {/* Admin: scene panel + reset indicator */}
      {showAdmin && (
        <div style={{ position: 'absolute', left: 16, top: 16, zIndex: 10 }}>
          <ScenePanel />
          <ResetPanel />
        </div>
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

      {/* Admin toggle */}
      <button onClick={() => setShowAdmin((prev) => !prev)}
        style={{
          position: 'absolute', top: 16, right: 16,
          padding: '8px 16px', background: showAdmin ? '#dc2626' : 'rgba(0,0,0,0.3)',
          color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500,
          cursor: 'pointer', zIndex: 10, opacity: 0.8,
        }}>
        {showAdmin ? 'Hide Admin' : 'Admin'}
      </button>

      {/* User: edit mode overlay + drag indicator */}
      <EditOverlay
        isEditing={isEditing}
        scale={designState.scale}
        isDragging={isDragging}
      />
    </div>
  )
}
