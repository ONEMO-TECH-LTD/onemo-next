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
import { useSceneStore } from './admin/sceneStore'
import { UndoIcon, RedoIcon, ResetIcon, ExportIcon, EditIcon } from './user/icons'
import { INITIAL_ARTWORK } from './user/outlineStore'
import { useOutlineStore } from './user/outlineStore'
import type { DesignState } from './types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import { toast } from './ui/Toast'

// Dynamic imports — no SSR for 3D components
const EffectViewer = dynamic(() => import('./core/EffectViewer'), { ssr: false })
const AdminViewer = dynamic(() => import('./admin/AdminViewer'), { ssr: false })
const TrimCarousel = dynamic(() => import('./user/TrimCarousel'), { ssr: false })
const Toolbar = dynamic(() => import('./user/Toolbar'), { ssr: false })
const EditOverlay = dynamic(() => import('./user/EditOverlay'), { ssr: false })
const OutlineEditor = dynamic(() => import('./user/OutlineEditor'), { ssr: false })
const EmptyState = dynamic(() => import('./user/EmptyState'), { ssr: false })
const GenerateShimmer = dynamic(() => import('./user/GenerateShimmer'), { ssr: false })
const ToastSurface = dynamic(() => import('./ui/Toast'), { ssr: false })
const PerfHUD = dynamic(() => import('./dev/PerfHUD'), { ssr: false })

function PrototypePageInner() {
  const searchParams = useSearchParams()
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [prepared, setPrepared] = useState<PreparedEffect | null>(null) // the one engine's output
  const [isDragging, setIsDragging] = useState(false)
  const [editingOutline, setEditingOutline] = useState(false)
  const [editorMode, setEditorMode] = useState<'shape' | null>(null) // #27: toolbar creation modes
  const [autoOutline, setAutoOutline] = useState(false) // false = standard square; true = Magic cut-out
  const [generating, setGenerating] = useState(false)
  const [genLabel, setGenLabel] = useState('Cutting out…') // G5 honest progress
  const designState = useOutlineStore((s) => s.artwork) // #28: lifted — scene + editor share it
  const setDesignState = useCallback((upd: DesignState | ((prev: DesignState) => DesignState)) => {
    const st = useOutlineStore.getState()
    st.setArtwork(typeof upd === 'function' ? upd(st.artwork) : upd)
  }, [])
  const { colors, setBackColor } = useSceneStore()
  const [showColors, setShowColors] = useState(false)
  const sceneName = searchParams.get('scene')

  // ── #23 GLOBAL history — one undo/redo/reset for the whole creator (Magic, editor sessions,
  // trim, position, blend). One user ACTION = one step; the editor keeps its own fine-grained
  // undo inside a session (Dan: Done = one global step). Reset = back to the fresh standard
  // square for the current photo (the photo stays).
  type OutlineSnap = {
    spec: ReturnType<typeof useOutlineStore.getState>['spec']
    // SINGLE TRUTH (plan §B): the committed shape is the only geometry in a snapshot — the
    // contour re-derives inside commitGeometry on restore, so a snapshot can never desync.
    committedShape: ReturnType<typeof useOutlineStore.getState>['committedShape']
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
  // True byte identity of the CURRENT photo (preserve-at-ingest, §B5) — page-level so EVERY
  // prepared spec for this file carries it: standard at upload, Magic's shaped replacement, and
  // any snapshot restores (which inherit stamped specs). KAI-8973/P1b: Magic was dropping it.
  const sourceShaRef = useRef<string | null>(null)
  const baselineRef = useRef<AppSnap | null>(null)
  const editorPreRef = useRef<AppSnap | null>(null)
  const trimPreRef = useRef<AppSnap | null>(null)
  const [, bumpHist] = useState(0)
  const snapNow = useCallback((): AppSnap => {
    const o = useOutlineStore.getState()
    return {
      prepared, autoOutline, designState,
      imageFx: o.imageFx,
      outline: { spec: o.spec, committedShape: o.committedShape, bgBlur: o.bgBlur, subjMatteUrl: o.subjMatteUrl },
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
    o.commitGeometry(sn.outline.committedShape)
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

  // Export — the mm-true SVG cutline from THE vector truth. TEMPORARY top-bar home (plan v2.1
  // D-SAVE: the Save surface is erased; export rides here until the save/library design round).
  const onExport = useCallback(() => {
    const o = useOutlineStore.getState()
    const v = o.committedShape ?? o.spec?.vectorShape
    const sp = o.spec
    if (!v || !sp) { toast('warn', 'Nothing to export yet — add an image first'); return }
    import('@/lib/export').then(({ toManufacturingSVG }) => {
      const svg = toManufacturingSVG(v, { mmPerPx: sp.mmPerPx || 1, widthPx: sp.maskWidthPx, heightPx: sp.maskHeightPx })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      a.download = 'onemo-cutline-mm.svg'
      document.body.appendChild(a); a.click(); a.remove()
    })
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
    // PRESERVE-AT-INGEST (plan §B5, Dan: original kept untouched in any event): the raw file goes
    // to disk the moment it enters — content-hash keyed, idempotent, fire-and-forget. The byte
    // hash lands on the spec so the manufacturing record identifies the REAL source bytes.
    const fd = new FormData()
    fd.append('file', file)
    sourceShaRef.current = null // new photo → identity unknown until its ingest resolves
    const ingest = fetch('/api/dev/originals', { method: 'POST', body: fd })
      .then((r) => r.json() as Promise<{ saved: boolean; sha256?: string }>)
      .catch(() => ({ saved: false as const, sha256: undefined }))
    setArtworkUrl(url)
    setDesignState(INITIAL_ARTWORK)
    setAutoOutline(false) // new image → the standard square; Magic opts into the cut-out
    // fresh image → drop any prior edit/blend so the new effect starts clean
    const st = useOutlineStore.getState()
    st.commitGeometry(null); st.setBgBlur(null); st.setSubjMatteUrl(null)
    // instant standard square through the ONE engine — the object is real in the scene immediately
    import('@/lib/effect/prepare-effect')
      .then(({ prepareEffect }) => prepareEffect(url, 'standard'))
      .then(async (p) => {
        const ing = await ingest
        if (ing.saved && ing.sha256) { sourceShaRef.current = ing.sha256; p.spec.sourceBytesSha256 = ing.sha256 }
        else toast('warn', 'Original-photo backup failed — the design still works; re-upload to retry')
        setPrepared(p)
        useOutlineStore.getState().setSpec(p.spec) // hand the standard outline to the 2D editor
        // #23: a new image starts a fresh history; this state is the Reset baseline
        baselineRef.current = {
          prepared: p, autoOutline: false, designState: INITIAL_ARTWORK, imageFx: null,
          outline: { spec: p.spec, committedShape: null, bgBlur: null, subjMatteUrl: null },
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
        // KAI-8973/P1b: the shaped spec REPLACES the standard one — carry the original's byte
        // identity forward, or the manufacturing record falls back to a blob-URL hash (§B5)
        if (sourceShaRef.current) p.spec.sourceBytesSha256 = sourceShaRef.current
        setPrepared(p)
        const st = useOutlineStore.getState()
        st.setSpec(p.spec) // hand the shaped outline to the 2D editor + 3D
        st.commitGeometry(null); st.setBgBlur(null) // fresh cut-out → drop prior edits
        // the editor's magic-blend preview needs the sharp subject matte
        try { st.setSubjMatteUrl(p.frontSrc.subjCanvas.toDataURL()) } catch { st.setSubjMatteUrl(null) }
        setAutoOutline(true)
        setGenerating(false)
        pushHistory(preMagic)
        // #23: the editor session that auto-opens is its own step — stash the post-magic state
        // Magic is SELF-SUFFICIENT (Dan ruling, plan v2.1 A4): the fine-tuned result lands in 3D —
        // the editor does NOT open (the old #26 auto-open is dead). Refinement = Edit/double-tap.
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

  // Editor entry (plan A1, Dan: single-tap hijacked touches): DOUBLE-TAP the object — two clean
  // taps within 350ms — or the top bar's Edit. Single taps and orbit drags do NOTHING.
  const tapRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastTapRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const onScenePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as Element).closest('button')) { tapRef.current = null; return }
    tapRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
  }, [])
  const onScenePointerUp = useCallback((e: React.PointerEvent) => {
    const t0 = tapRef.current
    tapRef.current = null
    if (!t0 || !artworkUrl || editingOutline || generating || showColors) return
    if ((e.target as Element).closest('button')) return
    const moved = Math.hypot(e.clientX - t0.x, e.clientY - t0.y)
    const clean = moved < 6 && performance.now() - t0.t < 400
    if (!clean) { lastTapRef.current = null; return }
    const prev = lastTapRef.current
    const now = performance.now()
    if (prev && now - prev.t < 350 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24) {
      lastTapRef.current = null
      editorPreRef.current = snapNow()
      setEditorMode(null)
      setEditingOutline(true)
      return
    }
    lastTapRef.current = { x: e.clientX, y: e.clientY, t: now }
  }, [artworkUrl, editingOutline, generating, showColors, snapNow])

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: colors.bgColor }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onPointerDown={onScenePointerDown}
      onPointerUp={onScenePointerUp}
    >
      {/* ── THE persistent golden scene — mounted once, never unmounted (§6.1). The object is the
          hero from upload onward; the editor freezes (frameloop=never) but never unmounts it. ── */}
      <AdminViewer
        artworkUrl={artworkUrl}
        designState={designState}
        isEditing={false}
        onTextureChange={setArtworkUrl}
        templateUrl={templateUrl}
      >
        {(config) => (
          <>
            <EffectViewer
              config={config}
              artworkUrl={artworkUrl}
              designState={designState}
              isEditing={false}
              shaped={shaped}
              prepared={prepared ?? undefined}
              onStatus={handleStatus}
              frozen={editingOutline}
            />
          </>
        )}
      </AdminViewer>

      {/* Pre-upload: pearly-glass ONEMO square + load control (over the warming scene) */}
      {!artworkUrl && <EmptyState onFile={handleFile} />}

      {/* Magic shimmer — page stays responsive (worker); label = the honest wait state (G5) */}
      {generating && <GenerateShimmer label={genLabel} />}

      {/* Trim takeover (D-TRIM): the creation row swaps to the material-color carousel — tap
          recolors the 3D back LIVE; ✓ keeps (one history step), ✕ reverts to the pre-open color */}
      {showColors ? (
        <TrimCarousel
          backColor={colors.backColor}
          onBackColor={setBackColor}
          onDone={() => {
            if (trimPreRef.current) {
              const t = trimPreRef.current.trim, c = useSceneStore.getState().colors
              if (t.backColor !== c.backColor) pushHistory(trimPreRef.current)
              trimPreRef.current = null
            }
            setShowColors(false)
          }}
          onCancel={() => {
            if (trimPreRef.current) { setBackColor(trimPreRef.current.trim.backColor); trimPreRef.current = null }
            setShowColors(false)
          }}
        />
      ) : (
        /* Creation row (plan A1): Image · Magic · Trim — creation only; editing entries live in
           the global top bar (Edit) and the double-tap gesture */
        <Toolbar
          artworkUrl={artworkUrl}
          auto={autoOutline}
          showColors={showColors}
          onFile={handleFile}
          onGenerate={handleMagic}
          onToggleColors={() => { trimPreRef.current = snapNow(); setShowColors(true) }}
        />
      )}

      {/* drag-and-drop indicator (upload affordance) */}
      <EditOverlay
        isEditing={false}
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
          // #23: one editor session (Done with changes) = one global step. The change test covers
          // EVERYTHING a session can commit — shape, blend, image-fx, photo position (KAI-8971/F2:
          // fx-only sessions pushed no step, so global Undo stayed greyed on a washed-out photo).
          const pre = editorPreRef.current
          if (pre) {
            const o = useOutlineStore.getState()
            const fxChanged = (a: typeof o.imageFx, b: typeof o.imageFx) => {
              const av = a ?? { brightness: 100, contrast: 100, saturate: 100, warmth: 0 }
              const bv = b ?? { brightness: 100, contrast: 100, saturate: 100, warmth: 0 }
              return av.brightness !== bv.brightness || av.contrast !== bv.contrast || av.saturate !== bv.saturate || av.warmth !== bv.warmth
            }
            const art = o.artwork, preArt = pre.designState
            const artChanged = art.offsetX !== preArt.offsetX || art.offsetY !== preArt.offsetY || art.scale !== preArt.scale
            if (o.committedShape !== pre.outline.committedShape || o.bgBlur !== pre.outline.bgBlur || fxChanged(o.imageFx, pre.imageFx) || artChanged) pushHistory(pre)
            editorPreRef.current = null
          }
        }}
      />

      {/* GLOBAL TOP BAR (plan A1 / D-CHROME, Dan's iPhone Photos anatomy): undo/redo pill always
          top-LEFT · RESET top-CENTER only-when-dirty (gold, vanishes when clean) · the screen's
          commit actions top-RIGHT (hero: Edit · Export). ONE anatomy on every screen; the old
          desktop corner pill is dead. Hidden while the editor owns the screen (same anatomy there). */}
      {artworkUrl && !editingOutline && (
        <>
          <div style={{ position: 'fixed', top: 14, left: 14, zIndex: 40, display: 'flex', gap: 2, background: 'rgba(255,255,255,0.88)', borderRadius: 999, padding: '4px 8px', boxShadow: '0 4px 18px rgba(15,18,32,0.12)' }}>
            {([
              { icon: <UndoIcon />, label: 'Undo', fn: globalUndo, off: !histRef.current.past.length },
              { icon: <RedoIcon />, label: 'Redo', fn: globalRedo, off: !histRef.current.future.length },
            ] as const).map((b) => (
              <button key={b.label} type="button" onClick={b.fn} disabled={b.off} aria-label={b.label} title={b.label}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, border: 'none', background: 'transparent', cursor: b.off ? 'default' : 'pointer', opacity: b.off ? 0.3 : 0.85, padding: '4px 7px', color: '#1c2030', fontSize: 9, fontFamily: 'inherit' }}>
                {b.icon}
                <span>{b.label}</span>
              </button>
            ))}
          </div>
          {histRef.current.past.length > 0 && baselineRef.current && (
            <button type="button" onClick={globalReset} aria-label="Reset" title="Reset"
              style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 40, border: 'none', background: 'transparent', cursor: 'pointer', color: '#c79a2a', fontWeight: 700, fontSize: 13, letterSpacing: 1, fontFamily: 'inherit', padding: '6px 10px' }}>
              RESET
            </button>
          )}
          <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 40, display: 'flex', gap: 2, background: 'rgba(255,255,255,0.88)', borderRadius: 999, padding: '4px 8px', boxShadow: '0 4px 18px rgba(15,18,32,0.12)' }}>
            {([
              { icon: <EditIcon />, label: 'Edit', fn: () => { editorPreRef.current = snapNow(); setEditorMode(null); setEditingOutline(true) }, off: !prepared },
              { icon: <ExportIcon />, label: 'Export', fn: onExport, off: !prepared },
            ] as const).map((b) => (
              <button key={b.label} type="button" onClick={b.fn} disabled={b.off} aria-label={b.label} title={b.label}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, border: 'none', background: 'transparent', cursor: b.off ? 'default' : 'pointer', opacity: b.off ? 0.3 : 0.85, padding: '4px 7px', color: '#1c2030', fontSize: 9, fontFamily: 'inherit' }}>
                {b.icon}
                <span>{b.label}</span>
              </button>
            ))}
          </div>
        </>
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
