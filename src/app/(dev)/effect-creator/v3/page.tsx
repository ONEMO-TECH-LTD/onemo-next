'use client'

// Effect Creator V3 — composition root. ONE SCENE, ONE ENGINE (blueprint §1).
//
// The golden scene mounts ONCE per session and STAYS MOUNTED (§6.1) — there are no phases and no
// "Finish in 3D", because the customer is in 3D the whole time. Upload builds the standard square
// instantly (no segmentation on upload); Magic cuts the subject in a worker while the page stays
// alive; the shape editor opens as an overlay with the scene frozen beneath it; Position (G1)
// pans/zooms the photo within the shape on matrix-only transforms; Trim recolors the live object;
// Save runs the feasibility gate and locks the design (recipe + payload, F1-bound), then the
// offscreen render factory photographs it for the library.
//
// G3: PerfHUD ships in the app. G4: ToastSurface — no swallowed failures. G5: honest Magic progress.

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGesture } from '@use-gesture/react'
import { useSceneStore } from './admin/sceneStore'
import { UndoIcon, RedoIcon, ResetIcon } from './user/icons'
import { INITIAL_ARTWORK } from './user/outlineStore'
import { useOutlineStore } from './user/outlineStore'
import type { DesignState } from './types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { LibraryRow } from './user/SavePanel'
import { deriveSuede } from './core/EffectViewer'
import { toast } from './ui/Toast'

// Dynamic imports — no SSR for 3D components
const EffectViewer = dynamic(() => import('./core/EffectViewer'), { ssr: false })
const AdminViewer = dynamic(() => import('./admin/AdminViewer'), { ssr: false })
const ColorPanel = dynamic(() => import('./user/ColorPanel'), { ssr: false })
const Toolbar = dynamic(() => import('./user/Toolbar'), { ssr: false })
const EditOverlay = dynamic(() => import('./user/EditOverlay'), { ssr: false })
const OutlineEditor = dynamic(() => import('./user/OutlineEditor'), { ssr: false })
const EmptyState = dynamic(() => import('./user/EmptyState'), { ssr: false })
const GenerateShimmer = dynamic(() => import('./user/GenerateShimmer'), { ssr: false })
const SavePanel = dynamic(() => import('./user/SavePanel'), { ssr: false })
const ToastSurface = dynamic(() => import('./ui/Toast'), { ssr: false })
const PerfHUD = dynamic(() => import('./dev/PerfHUD'), { ssr: false })

const MIN_SCALE = 1.0
const MAX_SCALE = 4.0
const DRAG_SENSITIVITY = 0.001
const SCROLL_SENSITIVITY = 0.002

function PrototypePageInner() {
  const searchParams = useSearchParams()
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [prepared, setPrepared] = useState<PreparedEffect | null>(null) // the one engine's output
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false) // G1 Position mode (restored first-class)
  const [editingOutline, setEditingOutline] = useState(false)
  const [editorMode, setEditorMode] = useState<'shape' | 'draw' | null>(null) // #27: toolbar creation modes
  const [autoOutline, setAutoOutline] = useState(false) // false = standard square; true = Magic cut-out
  const [generating, setGenerating] = useState(false)
  const [genLabel, setGenLabel] = useState('Cutting out…') // G5 honest progress
  const designState = useOutlineStore((s) => s.artwork) // #28: lifted — scene + editor share it
  const setDesignState = useCallback((upd: DesignState | ((prev: DesignState) => DesignState)) => {
    const st = useOutlineStore.getState()
    st.setArtwork(typeof upd === 'function' ? upd(st.artwork) : upd)
  }, [])
  const { colors, setBackColor, setFrameColor, setBgColor } = useSceneStore()
  const [showColors, setShowColors] = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [library, setLibrary] = useState<LibraryRow[]>([])
  const sceneName = searchParams.get('scene')

  // ── #23 GLOBAL history — one undo/redo/reset for the whole creator (Magic, editor sessions,
  // trim, position, blend). One user ACTION = one step; the editor keeps its own fine-grained
  // undo inside a session (Dan: Done = one global step). Reset = back to the fresh standard
  // square for the current photo (the photo stays).
  type OutlineSnap = {
    spec: ReturnType<typeof useOutlineStore.getState>['spec']
    editedContourMM: ReturnType<typeof useOutlineStore.getState>['editedContourMM']
    editedDoc: ReturnType<typeof useOutlineStore.getState>['editedDoc']
    bgBlur: number | null
    subjMatteUrl: string | null
  }
  type AppSnap = {
    prepared: PreparedEffect | null
    autoOutline: boolean
    designState: DesignState
    imageFx: ReturnType<typeof useOutlineStore.getState>['imageFx']
    outline: OutlineSnap
    trim: { backColor: string; frameColor: string; bgColor: string }
  }
  const shaped = true // the golden scene renders the generated effect mesh (not a GLB)
  const templateUrl = sceneName
    ? `/api/dev/scenes/${encodeURIComponent(sceneName)}`
    : '/api/dev/scenes/golden'

  const histRef = useRef<{ past: AppSnap[]; future: AppSnap[] }>({ past: [], future: [] })
  const baselineRef = useRef<AppSnap | null>(null)
  const editorPreRef = useRef<AppSnap | null>(null)
  const trimPreRef = useRef<AppSnap | null>(null)
  const [, bumpHist] = useState(0)
  const snapNow = useCallback((): AppSnap => {
    const o = useOutlineStore.getState()
    return {
      prepared, autoOutline, designState,
      imageFx: o.imageFx,
      outline: { spec: o.spec, editedContourMM: o.editedContourMM, editedDoc: o.editedDoc, bgBlur: o.bgBlur, subjMatteUrl: o.subjMatteUrl },
      trim: { ...useSceneStore.getState().colors },
    }
  }, [prepared, autoOutline, designState])
  const pushHistory = useCallback((snap: AppSnap) => {
    histRef.current.past.push(snap)
    if (histRef.current.past.length > 30) histRef.current.past.shift()
    histRef.current.future = []
    bumpHist((v) => v + 1)
  }, [])
  const restoreSnap = useCallback((sn: AppSnap) => {
    setPrepared(sn.prepared)
    setAutoOutline(sn.autoOutline)
    setDesignState(sn.designState)
    const o = useOutlineStore.getState()
    o.setImageFx(sn.imageFx)
    o.setSpec(sn.outline.spec)
    o.setEditedContourMM(sn.outline.editedContourMM)
    o.setEditedDoc(sn.outline.editedDoc)
    o.setBgBlur(sn.outline.bgBlur)
    o.setSubjMatteUrl(sn.outline.subjMatteUrl)
    const sc = useSceneStore.getState()
    sc.setBackColor(sn.trim.backColor)
    sc.setFrameColor(sn.trim.frameColor)
    sc.setBgColor(sn.trim.bgColor)
  }, [])
  const globalUndo = useCallback(() => {
    const h = histRef.current
    if (!h.past.length) return
    const prev = h.past.pop()!
    h.future.unshift(snapNow())
    restoreSnap(prev)
    bumpHist((v) => v + 1)
  }, [snapNow, restoreSnap])
  const globalRedo = useCallback(() => {
    const h = histRef.current
    if (!h.future.length) return
    const next = h.future.shift()!
    h.past.push(snapNow())
    restoreSnap(next)
    bumpHist((v) => v + 1)
  }, [snapNow, restoreSnap])
  const globalReset = useCallback(() => {
    if (!baselineRef.current) return
    pushHistory(snapNow()) // Reset itself is undoable
    restoreSnap(baselineRef.current)
  }, [snapNow, restoreSnap, pushHistory])

  useEffect(() => {
    import('./user/SavePanel').then(({ loadLibrary }) => setLibrary(loadLibrary()))
  }, [])

  // §6.1 no-blank-mount, page-level guarantee (measured 2026-06-10): after content arrives the
  // demand-loop scene can sit unpainted until ANY external repaint trigger — a window resize
  // provably paints it every time. Nudge with a short resize burst whenever the content identity
  // changes (upload, Magic swap, editor close). Cheap (a few frames), deterministic, frameloop-proof.
  useEffect(() => {
    if (!prepared) return
    const fire = () => window.dispatchEvent(new Event('resize'))
    fire()
    const ts = [200, 800, 2000].map((ms) => setTimeout(fire, ms))
    return () => ts.forEach(clearTimeout)
  }, [prepared, editingOutline])

  // #31 preload: DISABLED until the weights are self-hosted (research topic F: R2/CDN, immutable
  // URLs). Measured live: page-load preload (a) dropped the scene's WebGL context at boot via the
  // webgpu session ("THREE.WebGLRenderer: Context Lost" — Dan's freeze), and (b) even download-only
  // it pulls 100s of MB from the hub per origin and double-fetches a different dtype than the
  // pipeline uses. The model loads at the first Magic press (honest shimmer) — proven safe.

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (artworkUrl?.startsWith('blob:')) URL.revokeObjectURL(artworkUrl)
    const url = URL.createObjectURL(file)
    setArtworkUrl(url)
    setDesignState(INITIAL_ARTWORK)
    setAutoOutline(false) // new image → the standard square; Magic opts into the cut-out
    // fresh image → drop any prior edit/blend so the new effect starts clean
    const st = useOutlineStore.getState()
    st.setEditedContourMM(null); st.setEditedDoc(null); st.setBgBlur(null); st.setSubjMatteUrl(null)
    // instant standard square through the ONE engine — the object is real in the scene immediately
    import('@/lib/effect/prepare-effect')
      .then(({ prepareEffect }) => prepareEffect(url, 'standard'))
      .then((p) => {
        setPrepared(p)
        useOutlineStore.getState().setSpec(p.spec) // hand the standard outline to the 2D editor
        // #23: a new image starts a fresh history; this state is the Reset baseline
        baselineRef.current = {
          prepared: p, autoOutline: false, designState: INITIAL_ARTWORK, imageFx: null,
          outline: { spec: p.spec, editedContourMM: null, editedDoc: null, bgBlur: null, subjMatteUrl: null },
          trim: { ...useSceneStore.getState().colors },
        }
        histRef.current = { past: [], future: [] }
        bumpHist((v) => v + 1)
      })
      .catch((e) => {
        console.warn('[effect] prepare (standard) failed:', e)
        toast('error', `Couldn't build the square: ${(e as Error)?.message ?? e}`)
      })
  }, [artworkUrl])

  const handleStatus = useCallback((s: 'idle' | 'building' | 'ready' | 'error', message?: string) => {
    if (s === 'error') toast('error', `3D build failed: ${message ?? 'unknown error'}`) // G4
  }, [])

  // Magic: re-prepare as a SHAPED subject cut-out. BEN runs in the Web Worker — the page stays
  // responsive while the shimmer plays; the object morphs IN PLACE in the same scene (no jump).
  const handleMagic = useCallback(() => {
    if (!artworkUrl || generating) return
    const preMagic = snapNow() // #23: one Magic = one global undo step (pushed only on success)
    setGenerating(true)
    setGenLabel('Cutting out…')
    import('@/lib/effect/prepare-effect')
      .then(({ prepareEffect }) =>
        prepareEffect(artworkUrl, 'shaped', undefined, (s) => {
          if (s === 'fallback') toast('warn', 'AI cut-out unavailable — used the simple background cut instead') // G4
          else setGenLabel(s === 'downloading-model' ? 'Downloading the magic… (one-time)' : 'Cutting out…')
          // #21: the tuned BEN settings are the defaults — Magic reads them, never resets them
        }, useOutlineStore.getState().fairing?.params),
      )
      .then((p) => {
        setPrepared(p)
        const st = useOutlineStore.getState()
        st.setSpec(p.spec) // hand the shaped outline to the 2D editor + 3D
        st.setEditedContourMM(null); st.setEditedDoc(null); st.setBgBlur(null) // fresh cut-out → drop prior edits
        // the editor's magic-blend preview needs the sharp subject matte
        try { st.setSubjMatteUrl(p.frontSrc.subjCanvas.toDataURL()) } catch { st.setSubjMatteUrl(null) }
        setAutoOutline(true)
        setGenerating(false)
        pushHistory(preMagic)
        // #23: the editor session that auto-opens is its own step — stash the post-magic state
        editorPreRef.current = {
          prepared: p, autoOutline: true, designState, imageFx: useOutlineStore.getState().imageFx,
          outline: { spec: p.spec, editedContourMM: null, editedDoc: null, bgBlur: null, subjMatteUrl: useOutlineStore.getState().subjMatteUrl },
          trim: { ...useSceneStore.getState().colors },
        }
        setEditingOutline(true) // #26: after generation the editor opens on the generated outline
      })
      .catch((e) => {
        console.warn('[effect] prepare (shaped) failed:', e)
        toast('error', `Magic failed: ${(e as Error)?.message ?? e}`) // G4 — incl. the TD-E watchdog
        setGenerating(false)
      })
  }, [artworkUrl, generating, snapNow, pushHistory, designState])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  // G1 Position mode — pan/zoom the photo WITHIN the shape. Matrix-only transforms downstream
  // (ShapedModel touches repeat/offset; never a texture re-upload).
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

  // Folded-away Edit (Dan): TAP THE OBJECT to edit — a clean tap on the scene (not a drag, not a
  // button) opens the outline editor. Orbit drags pass the movement threshold and never trigger it.
  const tapRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const onScenePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as Element).closest('button')) { tapRef.current = null; return }
    tapRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
  }, [])
  const onScenePointerUp = useCallback((e: React.PointerEvent) => {
    const t0 = tapRef.current
    tapRef.current = null
    if (!t0 || !artworkUrl || editingOutline || generating || showSave || showColors || isEditing) return
    if ((e.target as Element).closest('button')) return
    const moved = Math.hypot(e.clientX - t0.x, e.clientY - t0.y)
    if (moved < 6 && performance.now() - t0.t < 400) {
      editorPreRef.current = snapNow()
      setEditorMode(null)
      setEditingOutline(true)
    }
  }, [artworkUrl, editingOutline, generating, showSave, showColors, isEditing, snapNow])

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: colors.bgColor, touchAction: isEditing ? 'none' : 'auto' }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onPointerDown={onScenePointerDown}
      onPointerUp={onScenePointerUp}
      {...(isEditing ? bind() : {})}
    >
      {/* ── THE persistent golden scene — mounted once, never unmounted (§6.1). The object is the
          hero from upload onward; the editor freezes (frameloop=never) but never unmounts it. ── */}
      <AdminViewer
        artworkUrl={artworkUrl}
        designState={designState}
        isEditing={isEditing}
        onTextureChange={setArtworkUrl}
        templateUrl={templateUrl}
      >
        {(config) => (
          <>
            <EffectViewer
              config={config}
              artworkUrl={artworkUrl}
              designState={designState}
              isEditing={isEditing}
              shaped={shaped}
              prepared={prepared ?? undefined}
              onStatus={handleStatus}
              frozen={editingOutline}
            />
            {/* Save panel needs the scene's suede/colors for the factory — rendered inside the
                config render-prop so it shares the same source of truth (G8: one framing/material truth). */}
            {showSave && (
              <SavePanel
                open={showSave}
                onClose={() => setShowSave(false)}
                prepared={prepared}
                effectType={autoOutline ? 'shaped' : 'standard'}
                designState={designState}
                suede={deriveSuede(config)}
                backColor={config.colors.backColor}
                trim={{ surfaceColor: colors.backColor, edgeColor: colors.frameColor, backgroundColor: colors.bgColor }}
                sceneSettings={config.scene}
                onEditShape={() => { setShowSave(false); setEditingOutline(true) }}
                library={library}
                onLibraryChange={setLibrary}
              />
            )}
          </>
        )}
      </AdminViewer>

      {/* Pre-upload: pearly-glass ONEMO square + load control (over the warming scene) */}
      {!artworkUrl && <EmptyState onFile={handleFile} />}

      {/* Magic shimmer — page stays responsive (worker); label = the honest wait state (G5) */}
      {generating && <GenerateShimmer label={genLabel} />}

      {/* Trim (appearance-only — invariant 8: never rebuilds geometry) */}
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

      {/* Toolbar — one persistent surface; no phase switch */}
      <Toolbar
        artworkUrl={artworkUrl}
        auto={autoOutline}
        showColors={showColors}
        onFile={handleFile}
        onGenerate={handleMagic}
        onToggleColors={() => setShowColors((prev) => {
          // #23: a Trim panel session = one step (pushed on close if colors changed)
          if (!prev) trimPreRef.current = snapNow()
          else if (trimPreRef.current) {
            const t = trimPreRef.current.trim, c = useSceneStore.getState().colors
            if (t.backColor !== c.backColor || t.frameColor !== c.frameColor || t.bgColor !== c.bgColor) pushHistory(trimPreRef.current)
            trimPreRef.current = null
          }
          return !prev
        })}
        onShapes={() => { editorPreRef.current = snapNow(); setEditorMode('shape'); setEditingOutline(true) }}
        onDraw={() => { editorPreRef.current = snapNow(); setEditorMode('draw'); setEditingOutline(true) }}
        onSave={() => setShowSave((v) => !v)}
      />

      {/* Position-mode banner + drag indicator */}
      <EditOverlay
        isEditing={isEditing}
        scale={designState.scale}
        isDragging={isDragging}
      />

      {/* The 2D outline editor — an overlay; the scene stays mounted (frozen) beneath it */}
      <OutlineEditor
        open={editingOutline}
        openMode={editorMode}
        imageUrl={artworkUrl}
        onClose={() => {
          setEditingOutline(false)
          // #23: one editor session (Done with changes) = one global step
          const pre = editorPreRef.current
          if (pre) {
            const o = useOutlineStore.getState()
            if (o.editedDoc !== pre.outline.editedDoc || o.bgBlur !== pre.outline.bgBlur) pushHistory(pre)
            editorPreRef.current = null
          }
        }}
      />

      {/* #23: global Undo/Redo/Reset — the whole creator, one step per action */}
      {artworkUrl && !editingOutline && (
        <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 40, display: 'flex', gap: 4, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', borderRadius: 999, padding: '4px 8px', boxShadow: '0 4px 18px rgba(15,18,32,0.12)' }}>
          {([
            { icon: <UndoIcon />, label: 'Undo', fn: globalUndo, off: !histRef.current.past.length },
            { icon: <RedoIcon />, label: 'Redo', fn: globalRedo, off: !histRef.current.future.length },
            { icon: <ResetIcon />, label: 'Reset', fn: globalReset, off: !baselineRef.current },
          ] as const).map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={b.fn}
              disabled={b.off}
              aria-label={b.label}
              title={b.label}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, border: 'none', background: 'transparent', cursor: b.off ? 'default' : 'pointer', opacity: b.off ? 0.3 : 0.85, padding: '4px 7px', color: '#1c2030', fontSize: 9, fontFamily: 'inherit' }}
            >
              {b.icon}
              <span>{b.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* G4 + G3 — always present */}
      <ToastSurface />
      <PerfHUD />
    </div>
  )
}

export default function EffectCreatorV3Page() {
  return (
    <Suspense fallback={null}>
      <PrototypePageInner />
    </Suspense>
  )
}
