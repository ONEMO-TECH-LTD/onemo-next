'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGesture } from '@use-gesture/react'
import { useSceneStore } from './admin/sceneStore'
import { INITIAL_DESIGN } from './user/Toolbar'
import type { DesignState } from './types'

// Dynamic imports — no SSR for 3D components
const EffectViewer = dynamic(() => import('./core/EffectViewer'), { ssr: false })
const AdminViewer = dynamic(() => import('./admin/AdminViewer'), { ssr: false })
const ColorPanel = dynamic(() => import('./user/ColorPanel'), { ssr: false })
const Toolbar = dynamic(() => import('./user/Toolbar'), { ssr: false })
const EditOverlay = dynamic(() => import('./user/EditOverlay'), { ssr: false })
const OutlineEditor = dynamic(() => import('./user/OutlineEditor'), { ssr: false })
const EmptyState = dynamic(() => import('./user/EmptyState'), { ssr: false })
const GenerateShimmer = dynamic(() => import('./user/GenerateShimmer'), { ssr: false })

const MIN_SCALE = 1.0
const MAX_SCALE = 4.0
const DRAG_SENSITIVITY = 0.001
const SCROLL_SENSITIVITY = 0.002

function PrototypePageInner() {
  const searchParams = useSearchParams()
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingOutline, setEditingOutline] = useState(false)
  const [autoOutline, setAutoOutline] = useState(false) // false = flat square (default); true = Magic-wand BEN cut-out
  const [generating, setGenerating] = useState(false)   // BEN building → show the magic shimmer / loading
  const [designState, setDesignState] = useState<DesignState>(INITIAL_DESIGN)
  const { colors, setBackColor, setFrameColor, setBgColor } = useSceneStore()
  const [showColors, setShowColors] = useState(false)
  const sceneName = searchParams.get('scene')
  const shaped = true // this IS the shaped-effect configurator (its own route /shaped)
  const templateUrl = sceneName
    ? `/api/dev/scenes/${encodeURIComponent(sceneName)}`
    : '/api/dev/scenes/golden'

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (artworkUrl?.startsWith('blob:')) URL.revokeObjectURL(artworkUrl)
    setArtworkUrl(URL.createObjectURL(file))
    setDesignState(INITIAL_DESIGN)
    setAutoOutline(false) // new image → start on the flat square; Magic wand opts into the cut-out
  }, [artworkUrl])

  const handleStatus = useCallback((s: 'idle' | 'building' | 'ready' | 'error') => setGenerating(s === 'building'), [])

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
      {/* AdminViewer builds config from golden defaults → passes to core viewer */}
      <AdminViewer
        artworkUrl={artworkUrl}
        designState={designState}
        isEditing={isEditing}
        onTextureChange={setArtworkUrl}
        templateUrl={templateUrl}
      >
        {(config) => (
          <EffectViewer
            config={config}
            artworkUrl={artworkUrl}
            designState={designState}
            isEditing={isEditing}
            shaped={shaped}
            auto={autoOutline}
            onStatus={handleStatus}
            frozen={editingOutline}
          />
        )}
      </AdminViewer>

      {/* Pre-upload: pearly-glass ONEMO square + load control */}
      {!artworkUrl && <EmptyState onFile={handleFile} />}

      {/* Magic-wand generate: full-surface shimmer while BEN runs (doubles as the loading state) */}
      {generating && autoOutline && <GenerateShimmer />}

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

      {/* User: toolbar */}
      <Toolbar
        artworkUrl={artworkUrl}
        auto={autoOutline}
        showColors={showColors}
        onFile={handleFile}
        onGenerate={() => setAutoOutline(true)}
        onToggleColors={() => setShowColors((prev) => !prev)}
        onEditOutline={() => setEditingOutline(true)}
      />

      {/* User: edit mode overlay + drag indicator */}
      <EditOverlay
        isEditing={isEditing}
        scale={designState.scale}
        isDragging={isDragging}
      />

      {/* Effect Configurator: 2D outline editor (A1b) */}
      <OutlineEditor
        open={editingOutline}
        imageUrl={artworkUrl}
        onClose={() => setEditingOutline(false)}
      />
    </div>
  )
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <PrototypePageInner />
    </Suspense>
  )
}
