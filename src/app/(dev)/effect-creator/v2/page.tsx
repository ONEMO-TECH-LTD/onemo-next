'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGesture } from '@use-gesture/react'
import { useSceneStore } from './admin/sceneStore'
import { INITIAL_DESIGN } from './user/Toolbar'
import { useOutlineStore } from './user/outlineStore'
import type { DesignState } from './types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'

// Dynamic imports — no SSR for 3D components
const EffectViewer = dynamic(() => import('./core/EffectViewer'), { ssr: false })
const AdminViewer = dynamic(() => import('./admin/AdminViewer'), { ssr: false })
const ColorPanel = dynamic(() => import('./user/ColorPanel'), { ssr: false })
const Toolbar = dynamic(() => import('./user/Toolbar'), { ssr: false })
const EditOverlay = dynamic(() => import('./user/EditOverlay'), { ssr: false })
const OutlineEditor = dynamic(() => import('./user/OutlineEditor'), { ssr: false })
const EmptyState = dynamic(() => import('./user/EmptyState'), { ssr: false })
const GenerateShimmer = dynamic(() => import('./user/GenerateShimmer'), { ssr: false })
const Effect2D = dynamic(() => import('./user/Effect2D'), { ssr: false })

const MIN_SCALE = 1.0
const MAX_SCALE = 4.0
const DRAG_SENSITIVITY = 0.001
const SCROLL_SENSITIVITY = 0.002

// Two-phase creation (lean-spec §4): 'create' = 2D shape & face (WebGL-FREE, the default);
// 'finish' = 3D finish & fit (the golden scene mounts on demand). The 3D is NEVER mounted in
// create — that's what removes V1's always-on perf trap.
type Phase = 'create' | 'finish'

function PrototypePageInner() {
  const searchParams = useSearchParams()
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [prepared, setPrepared] = useState<PreparedEffect | null>(null) // the 2D-prepared standard effect
  const [phase, setPhase] = useState<Phase>('create')
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingOutline, setEditingOutline] = useState(false)
  const [autoOutline, setAutoOutline] = useState(false) // false = flat square (default); true = Magic-wand BEN cut-out (Phase-B old path for now; §8.4 wires the worker)
  const [generating, setGenerating] = useState(false)   // BEN building → show the magic shimmer / loading
  const [designState, setDesignState] = useState<DesignState>(INITIAL_DESIGN)
  const { colors, setBackColor, setFrameColor, setBgColor } = useSceneStore()
  const [showColors, setShowColors] = useState(false)
  const sceneName = searchParams.get('scene')
  const shaped = true // the golden scene renders a generated cut-out mesh (not a GLB)
  const templateUrl = sceneName
    ? `/api/dev/scenes/${encodeURIComponent(sceneName)}`
    : '/api/dev/scenes/golden'

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (artworkUrl?.startsWith('blob:')) URL.revokeObjectURL(artworkUrl)
    const url = URL.createObjectURL(file)
    setArtworkUrl(url)
    setDesignState(INITIAL_DESIGN)
    setAutoOutline(false) // new image → the standard square; Magic opts into the cut-out
    setPrepared(null)
    setPhase('create')
    // 2D-first: prepare the STANDARD effect (instant — no BEN) → the Effect2D hero + the editor's spec.
    // Dynamic import keeps the effect engine (+ its transitive deps) out of the initial create bundle.
    import('@/lib/effect/prepare-effect')
      .then(({ prepareEffect }) => prepareEffect(url, 'standard'))
      .then((p) => {
        setPrepared(p)
        useOutlineStore.getState().setSpec(p.spec) // hand the standard outline to the 2D editor
      })
      .catch((e) => console.warn('[effect] prepare (standard) failed:', e))
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
      {/* ── Phase B (3D finish & fit): the golden scene, mounted ONLY on demand. No WebGL in create. ── */}
      {phase === 'finish' && (
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
      )}

      {/* ── Phase A (2D shape & face): the WebGL-free creation surface. ── */}
      {phase === 'create' && (
        <>
          {/* Pre-upload: ONEMO square + load control */}
          {!artworkUrl && <EmptyState onFile={handleFile} />}
          {/* The 2D hero — the composite clipped to the live mm outline (follows editor edits) */}
          {prepared && <Effect2D prepared={prepared} />}
        </>
      )}

      {/* Magic-wand generate shimmer (Phase B BEN loading) */}
      {generating && autoOutline && phase === 'finish' && <GenerateShimmer />}

      {/* Appearance panel (Trim) */}
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

      {/* Toolbar — phase-aware (create: Upload·Magic·Edit·Finish-in-3D · finish: Back·Trim) */}
      <Toolbar
        artworkUrl={artworkUrl}
        auto={autoOutline}
        showColors={showColors}
        phase={phase}
        onFile={handleFile}
        onGenerate={() => setAutoOutline(true)}
        onToggleColors={() => setShowColors((prev) => !prev)}
        onEditOutline={() => setEditingOutline(true)}
        onFinish={() => setPhase('finish')}
        onBackToCreate={() => setPhase('create')}
      />

      {/* Edit mode overlay + drag indicator */}
      <EditOverlay
        isEditing={isEditing}
        scale={designState.scale}
        isDragging={isDragging}
      />

      {/* Effect Configurator: 2D outline editor (Phase A) */}
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
