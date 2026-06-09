'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGesture } from '@use-gesture/react'
import { useSceneStore } from './admin/sceneStore'
import { INITIAL_DESIGN } from './user/Toolbar'
import { useOutlineStore } from './user/outlineStore'
import type { DesignState } from './types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { EffectViewerBridge } from './core/EffectViewer'
import type { GalleryArtifact } from '@/lib/effect/gallery'

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
  // §8.8 render-factory gallery: the live golden-scene bridge (set by EffectViewer onCreated) + the
  // captured artifact (3 angles + flat tile). Finish-phase only — the scene exists only there.
  const viewerRef = useRef<EffectViewerBridge | null>(null)
  const [gallery, setGallery] = useState<GalleryArtifact | null>(null)
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
    // fresh image → drop any prior edit/blend so the new effect starts clean
    const st = useOutlineStore.getState()
    st.setEditedContourMM(null); st.setEditedDoc(null); st.setBgBlur(null); st.setSubjMatteUrl(null)
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

  // Magic wand (Phase A): re-prepare the effect as a SHAPED subject cut-out. BEN runs in the Web
  // Worker (§8.3) — the main thread stays responsive while the shimmer plays. On success the cut-out
  // replaces the standard square in the Effect2D hero, and the editor + (on-demand) 3D get the shaped spec.
  const handleMagic = useCallback(() => {
    if (!artworkUrl || generating) return
    setGenerating(true)
    import('@/lib/effect/prepare-effect')
      .then(({ prepareEffect }) => prepareEffect(artworkUrl, 'shaped'))
      .then((p) => {
        setPrepared(p)
        const st = useOutlineStore.getState()
        st.setSpec(p.spec) // hand the shaped outline to the 2D editor + 3D
        st.setEditedContourMM(null); st.setEditedDoc(null); st.setBgBlur(null); st.setSubjMatteUrl(null) // fresh cut-out → drop prior edits
        setAutoOutline(true) // Magic active (shaped) state
        setGenerating(false)
      })
      .catch((e) => { console.warn('[effect] prepare (shaped) failed:', e); setGenerating(false) })
  }, [artworkUrl, generating])

  // §8.8: EffectViewer hands up the live {scene, camera, renderer} once the golden scene mounts (Phase B).
  const handleViewerCreated = useCallback((bridge: EffectViewerBridge) => { viewerRef.current = bridge }, [])

  // §8.8: capture the render-factory gallery from the on-demand golden scene — the flat 2D shape-truth tile
  // (the composite) + 3 product angles (front/3Q/back), hash-tied to the manufacturing payload (§11). Engine
  // (+ three via gallery) is dynamic-imported HERE so the create phase never loads it (stays WebGL-free).
  const handleCaptureGallery = useCallback(async () => {
    const bridge = viewerRef.current
    if (!bridge || !prepared) return
    try {
      const [{ captureGallery, flatTileDataUrl, assembleGallery }, { buildApprovedEffectPayload }] = await Promise.all([
        import('@/lib/effect/gallery'),
        import('@/lib/effect/payload'),
      ])
      const renders = await captureGallery({ renderer: bridge.renderer, scene: bridge.scene, camera: bridge.camera })
      const flat = flatTileDataUrl(prepared.composite)
      let payloadHash = ''
      try {
        payloadHash = buildApprovedEffectPayload(prepared, { type: autoOutline ? 'shaped' : 'standard', size: 's70' }).payload_hash
      } catch (e) {
        console.warn('[gallery] payload hash unavailable (uncuttable shape?):', e)
      }
      setGallery(assembleGallery(payloadHash, flat, renders))
    } catch (e) {
      console.error('[gallery] capture failed:', e)
    }
  }, [prepared, autoOutline])

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
              prepared={prepared ?? undefined}
              onStatus={handleStatus}
              onCreated={handleViewerCreated}
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

      {/* Magic-wand cut-out shimmer (Phase A, while the BEN worker traces the subject — main thread stays free) */}
      {generating && phase === 'create' && <GenerateShimmer />}

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
        onGenerate={handleMagic}
        onToggleColors={() => setShowColors((prev) => !prev)}
        onEditOutline={() => setEditingOutline(true)}
        onFinish={() => setPhase('finish')}
        onBackToCreate={() => setPhase('create')}
        onCaptureGallery={handleCaptureGallery}
      />

      {/* §8.8 render-factory gallery — captured angles preview (finish phase only). Dev/validation surface:
          the flat 2D shape-truth tile + the 3 golden-scene angles, tagged with the payload_hash they depict. */}
      {phase === 'finish' && gallery && (
        <div
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 104, zIndex: 60,
            display: 'flex', gap: 10, alignItems: 'flex-end', padding: '12px 14px',
            background: 'rgba(20,24,40,0.72)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
            backdropFilter: 'none',
          }}
        >
          {[{ label: 'Flat', url: gallery.flat2D_dataUrl }, ...gallery.renders.map((r) => ({ label: r.angle, url: r.dataUrl }))].map((tile) => (
            <figure key={tile.label} style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL capture, not a remote asset */}
              <img src={tile.url} alt={`gallery ${tile.label}`} style={{ width: 88, height: 88, objectFit: 'contain', background: '#15171f', borderRadius: 8 }} />
              <figcaption style={{ fontSize: 10, color: '#c8ccd8', letterSpacing: 0.3 }}>{tile.label}</figcaption>
            </figure>
          ))}
          <button
            type="button"
            onClick={() => setGallery(null)}
            aria-label="Dismiss gallery preview"
            style={{ alignSelf: 'flex-start', width: 22, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 13, lineHeight: '22px' }}
          >
            ×
          </button>
          {gallery.payload_hash && (
            <span style={{ position: 'absolute', top: 4, left: 12, fontSize: 9, color: '#7f8499', letterSpacing: 0.4 }}>
              #{gallery.payload_hash}
            </span>
          )}
        </div>
      )}

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
