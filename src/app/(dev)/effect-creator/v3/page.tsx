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
import { INITIAL_DESIGN } from './user/Toolbar'
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
  const [autoOutline, setAutoOutline] = useState(false) // false = standard square; true = Magic cut-out
  const [generating, setGenerating] = useState(false)
  const [genLabel, setGenLabel] = useState('Cutting out…') // G5 honest progress
  const [designState, setDesignState] = useState<DesignState>(INITIAL_DESIGN)
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
  const posPreRef = useRef<AppSnap | null>(null)
  const trimPreRef = useRef<AppSnap | null>(null)
  const [, bumpHist] = useState(0)
  const snapNow = useCallback((): AppSnap => {
    const o = useOutlineStore.getState()
    return {
      prepared, autoOutline, designState,
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

  // #31: warm BEN silently the moment the creator opens — weights download + session init happen
  // in the background worker, so the first Magic press starts at full speed.
  useEffect(() => {
    import('@/lib/effect/segment-ml').then((m) => m.preloadBen()).catch(() => { /* real run reports */ })
  }, [])

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (artworkUrl?.startsWith('blob:')) URL.revokeObjectURL(artworkUrl)
    const url = URL.createObjectURL(file)
    setArtworkUrl(url)
    setDesignState(INITIAL_DESIGN)
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
          prepared: p, autoOutline: false, designState: INITIAL_DESIGN,
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
          prepared: p, autoOutline: true, designState,
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

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: colors.bgColor, touchAction: isEditing ? 'none' : 'auto' }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
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
        positioning={isEditing}
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
        onEditOutline={() => { editorPreRef.current = snapNow(); setEditingOutline(true) }}
        onTogglePosition={() => setIsEditing((v) => {
          // #23: a Position session = one step (pushed on exit if the photo moved/zoomed)
          if (!v) posPreRef.current = snapNow()
          else if (posPreRef.current) {
            const d = posPreRef.current.designState
            if (d.offsetX !== designState.offsetX || d.offsetY !== designState.offsetY || d.scale !== designState.scale) pushHistory(posPreRef.current)
            posPreRef.current = null
          }
          return !v
        })}
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
