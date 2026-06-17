'use client'

// Effect Creator V3 — composition root. ONE SCENE, ONE ENGINE (blueprint §1).
//
// The golden scene mounts ONCE per session and STAYS MOUNTED (§6.1) — there are no phases and no
// "Finish in 3D", because the customer is in 3D the whole time. Upload builds the standard square
// instantly (no segmentation on upload); Magic cuts the subject in a worker while the page stays
// alive; the shape editor opens as an overlay with the scene frozen beneath it; Position (G1)
// pans/zooms the photo within the shape on matrix-only transforms; Trim recolors the live back
// material. There is NO save surface this wave (erased by ruling — the manufacturing contract
// modules stay pure + tested underneath for the future save round).
//
// G3: PerfHUD ships in the app. G4: ToastSurface — no swallowed failures. G5: honest Magic progress.

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSceneStore } from './admin/sceneStore'
import { UndoIcon, RedoIcon, ExportIcon } from './user/icons'
import TopBar, { TopBarButton } from './user/TopBar'
import edStyles from './user/outline-editor.module.css'
import { INITIAL_ARTWORK } from './user/outlineStore'
import { useOutlineStore } from './user/outlineStore'
import type { DesignState } from './types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import { toast } from './ui/Toast'
import { rdpClosed, repairSimplePolygon, type Vec2Px } from '@/lib/outline-core/math'
import { simplifyPaper } from '@/lib/vector-core/paper-kernel'
import { insetRingMM } from '@/lib/effect/offset'
import { flattenPath } from '@/lib/vector-core'
import type { VShape, VPath } from '@/lib/vector-core'

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

// POC (Dan 2026-06-17, branch v5poc-detail): post-generation "Detail" — re-simplify the cached AI
// trace to a chosen detail WITHOUT re-running the AI. 100% = tightest (hugs the silhouette; only the
// pixel staircase / hair-wobble removed); 0% = coarsest facets. mm-true (scale-invariant). Tunable.
const DETAIL_TIGHT_MM = 0   // detail 100% = RAW exact trace (eps floors to ~1px) = pixel-perfect silhouette
const DETAIL_COARSE_MM = 10 // detail 0% = coarsest facets
const SMOOTH_MAX_MM = 0.8   // smooth 100% = curve-fit tolerance 0.8mm (fairs the pixel staircase away; safe < fold)
const OFFSET_MAX_MM = 10    // offset 100% = 10mm OUTSET (margin/bleed). Outset-only — no inset (Dan).
const detailToTraceMm = (pct: number) => { const d = Math.max(0, Math.min(100, pct)) / 100; return DETAIL_COARSE_MM + d * (DETAIL_TIGHT_MM - DETAIL_COARSE_MM) }
const offsetToMm = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * OFFSET_MAX_MM

// POC: build the editor source from the cached AI trace at a Detail (RDP) + Smooth (catmull) level —
// the unified RDP/Paper engines, no AI re-run. RDP+repair = tight, de-degenerate polygon (no mesh
// tears); smoothPaper then fairs the pixel staircase into clean curves. Returns null if degenerate.
function buildTrace(rawTracePx: ReadonlyArray<readonly [number, number]>, H: number, mmPerPx: number, detailPct: number, smoothPct: number, offsetMM: number): VShape | null {
  if (!rawTracePx.length) return null
  const eps = Math.max(1, detailToTraceMm(detailPct) / mmPerPx)
  const yDown = rawTracePx.map(([x, y]) => [x, H - y] as Vec2Px)
  let pts = rdpClosed(yDown, eps)
  pts = repairSimplePolygon(pts, 1)
  if (pts.length < 3) return null
  // DETAIL + SMOOTH define the shape FIRST.
  let path: VPath = { anchors: pts.map(([x, y]) => ({ p: { x, y }, hIn: null, hOut: null, corner: true })) }
  if (smoothPct > 0) {
    const tolPx = (Math.max(0, Math.min(100, smoothPct)) / 100) * SMOOTH_MAX_MM / mmPerPx
    const fit = simplifyPaper(path, tolPx) // Paper curve-fit: fair the pixel staircase into smooth bézier curves
    if (fit.anchors.length >= 3) path = fit // keep the polygon if the fit collapsed (degenerate guard)
  }
  // OFFSET LAST (Dan): expand the FINISHED detail+smooth shape uniformly — flatten it, Clipper2 outset
  // (round joins), and DON'T re-simplify. So offset preserves the shape and just grows it; no dynamic
  // re-fairing of the offset result (the cowlick keeps its form). Same engine as the −8mm magnetic inset.
  if (offsetMM > 0) {
    const ringMM = flattenPath(path, 0.3).map((p) => [p.x * mmPerPx, p.y * mmPerPx] as [number, number])
    const off = insetRingMM(ringMM, offsetMM, true) // MITER joins: expand + KEEP corners sharp (don't round)
    if (off && off.length >= 3) path = { anchors: off.map(([x, y]) => ({ p: { x: x / mmPerPx, y: y / mmPerPx }, hIn: null, hOut: null, corner: true })) }
  }
  return { paths: [path] }
}

function PrototypePageInner() {
  const searchParams = useSearchParams()
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [prepared, setPrepared] = useState<PreparedEffect | null>(null) // the one engine's output
  const [isDragging, setIsDragging] = useState(false)
  const [editingOutline, setEditingOutline] = useState(false)
  const [editorMode, setEditorMode] = useState<'shape' | 'image' | null>(null) // #27 + KAI-9027
  const [autoOutline, setAutoOutline] = useState(false) // false = standard square; true = Magic cut-out
  const [generating, setGenerating] = useState(false)
  const designState = useOutlineStore((s) => s.artwork) // #28: lifted — scene + editor share it
  const setDesignState = useCallback((upd: DesignState | ((prev: DesignState) => DesignState)) => {
    const st = useOutlineStore.getState()
    st.setArtwork(typeof upd === 'function' ? upd(st.artwork) : upd)
  }, [])
  const { colors, setBackColor } = useSceneStore()
  const [showColors, setShowColors] = useState(false)
  // POC (Dan 2026-06-17, v5poc-detail): post-generation Detail dial (0..100). 100 = RAW exact trace
  // (pixel-perfect tight silhouette, like Apple object-lift); lower = simplified/coarser. Live re-simplify
  // of the cached AI trace — no AI re-run. Default 100 (exact) so the tight silhouette shows first.
  const [detail, setDetail] = useState(100)
  const [smooth, setSmooth] = useState(50) // POC: fair the pixel staircase into curves (Paper simplify)
  const [offset, setOffset] = useState(0)  // POC: the generation padding as a tool (Clipper outset, 0..100%). 0 = tight
  const sceneName = searchParams.get('scene')

  // ── #23 GLOBAL history — one undo/redo/reset for the whole creator (Magic, editor sessions,
  // trim, position, blend). One user ACTION = one step; the editor keeps its own fine-grained
  // undo inside a session (Dan: Done = one global step). Reset = back to the fresh standard
  // square for the current photo (the photo stays).
  type OutlineSnap = {
    spec: ReturnType<typeof useOutlineStore.getState>['spec']
    // V4: the page-level step stores source + adjustments (the lossless recipe) and the derived
    // committedShape (for the change-diff at the editor boundary). Restore re-installs source+adjustments.
    committedShape: ReturnType<typeof useOutlineStore.getState>['committedShape']
    source: ReturnType<typeof useOutlineStore.getState>['source']
    adjustments: ReturnType<typeof useOutlineStore.getState>['adjustments']
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

  // KAI-9010: internal tooling (Export) is armed by ?internal=1 — never product chrome
  // KAI-9066 cleanup: read ?internal=1 AFTER mount, not in the useState initializer. Reading window in
  // the initializer made the SSR/initial-client render internalTools=false but the hydrated client true
  // → a React hydration mismatch around the client-only Export button. Default false (SSR-safe); flip
  // on after hydration (the internal Export tool appears one tick post-mount — dev-only, fine).
  const [internalTools, setInternalTools] = useState(false)
  useEffect(() => {
    setInternalTools(new URLSearchParams(window.location.search).get('internal') === '1')
  }, [])
  const histRef = useRef<{ past: AppSnap[]; future: AppSnap[] }>({ past: [], future: [] })
  // True byte identity of the CURRENT photo — captured at ORDER / SAVE (Dan 2026-06-16: NOT at
  // upload — privacy + cost), so this stays null until that Phase-2 flow records it. Kept page-level
  // so once it exists EVERY prepared spec for the file can carry it forward (standard, Magic's shaped
  // replacement, snapshot restores). The old preserve-at-ingest disk write (§B5) is removed.
  const sourceShaRef = useRef<string | null>(null)
  const baselineRef = useRef<AppSnap | null>(null)
  const editorPreRef = useRef<AppSnap | null>(null)
  const trimPreRef = useRef<AppSnap | null>(null)
  const magicRunRef = useRef(0) // UX-5 / KAI-9083: cancel OR a new upload bumps the token; a stale Magic run's result is discarded
  const [, bumpHist] = useState(0)
  const snapNow = useCallback((): AppSnap => {
    const o = useOutlineStore.getState()
    return {
      prepared, autoOutline, designState,
      imageFx: o.imageFx,
      outline: { spec: o.spec, committedShape: o.committedShape, source: o.source, adjustments: o.adjustments, bgBlur: o.bgBlur, subjMatteUrl: o.subjMatteUrl },
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
    o.setSource(sn.outline.source, sn.outline.adjustments)
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
    Promise.all([import('@/lib/export'), import('@/lib/effect/geometry-truth')]).then(([{ toManufacturingSVG }, { contourFromShape, assertContourCuttable }]) => {
      // KAI-9077 / MFG-1: gate the live cut-line export on feasibility — never write a folded/
      // uncuttable shape to a cut file (committedShape is gated at derive, but spec.vectorShape isn't).
      const c = contourFromShape(v, { mmPerPx: sp.mmPerPx || 1, maskHeightPx: sp.maskHeightPx })
      const feas = c ? assertContourCuttable(c, sp.mmPerPx || 1) : { ok: false as const, reason: 'degenerate' as const }
      if (!feas.ok) { toast('warn', `Can't export — the outline isn't cleanly cuttable (${feas.reason}). Fix the shape first.`); return }
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
    // Source-byte storage is DEFERRED to order / save-for-later (Dan, 2026-06-16: don't store every
    // uploaded image — privacy + cost). This supersedes the old preserve-at-INGEST (§B5), whose
    // dev-disk write can't run on Vercel's read-only serverless FS anyway (the "Original-photo backup
    // failed" banner). The manufacturing record captures the real source bytes + hash at order/save.
    sourceShaRef.current = null // identity captured later, at order/save
    setArtworkUrl(url)
    setDesignState(INITIAL_ARTWORK)
    setAutoOutline(false) // new image → the standard square; Magic opts into the cut-out
    // fresh image → drop any prior edit/blend so the new effect starts clean
    const st = useOutlineStore.getState()
    st.commitGeometry(null); st.setBgBlur(null); st.setSubjMatteUrl(null)
    // KAI-9083: a new image supersedes any in-flight Magic — bump the run token so a stale Magic
    // result/error becomes a no-op (can't clobber the new image or fire a false "Magic failed").
    magicRunRef.current++
    setGenerating(false)
    // instant standard square through the ONE engine — the object is real in the scene immediately
    import('@/lib/effect/prepare-effect')
      .then(({ prepareEffect }) => prepareEffect(url, 'standard'))
      .then((p) => {
        setPrepared(p) // render immediately — no longer gated on a backup round-trip
        useOutlineStore.getState().setSpec(p.spec) // hand the standard outline to the 2D editor
        // #23: a new image starts a fresh history; this state is the Reset baseline
        baselineRef.current = {
          prepared: p, autoOutline: false, designState: INITIAL_ARTWORK, imageFx: null,
          outline: { spec: p.spec, committedShape: null, source: null, adjustments: { global: { simplify: 0, smooth: 0, straighten: 0 }, local: {} }, bgBlur: null, subjMatteUrl: null },
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
    const runId = ++magicRunRef.current
    setGenerating(true)
    import('@/lib/effect/prepare-effect')
      .then(({ prepareEffect, EFFECT_BUILD_CONFIG }) =>
        // Progress text is intentionally silent (Dan, 2026-06-16: no "Downloading…/Cutting out…"
        // captions). The shimmer animation alone signals work; only the honest fallback still toasts.
        // DEV TUNING: feed the chosen manufacturing min-feature floor into the trace simplification.
        prepareEffect(artworkUrl, 'shaped', { ...EFFECT_BUILD_CONFIG, minFeatureMM: detailToTraceMm(detail), paddingMM: 0 }, (s) => {
          if (s === 'fallback') toast('warn', 'AI cut-out unavailable — used the simple background cut instead') // G4
        }),
      )
      .then((p) => {
        if (magicRunRef.current !== runId) return // cancelled mid-run — prior state stands (UX-5)
        // KAI-8973/P1b: the shaped spec REPLACES the standard one — carry the original's byte
        // identity forward, or the manufacturing record falls back to a blob-URL hash (§B5)
        if (sourceShaRef.current) p.spec.sourceBytesSha256 = sourceShaRef.current
        setPrepared(p)
        const st = useOutlineStore.getState()
        st.setSpec(p.spec) // hand the shaped outline to the 2D editor + 3D
        st.setBgBlur(null) // fresh cut-out → drop prior edits
        // POC: build the editor source from the raw trace at the current Detail + Smooth (no AI re-run)
        const vs0 = p.spec.rawTracePx?.length ? buildTrace(p.spec.rawTracePx, p.spec.maskHeightPx, p.spec.mmPerPx, detail, smooth, offsetToMm(offset)) : null
        if (vs0) { st.setSpec({ ...p.spec, vectorShape: vs0 }); st.commitGeometry(vs0) } else st.commitGeometry(null)
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
        if (magicRunRef.current !== runId) return // cancelled — stay quiet
        console.warn('[effect] prepare (shaped) failed:', e)
        toast('error', `Magic failed: ${(e as Error)?.message ?? e}`) // G4 — incl. the TD-E watchdog
        setGenerating(false)
      })
  }, [artworkUrl, generating, snapNow, pushHistory, designState, detail, smooth, offset])

  // POC: live post-gen re-trace — rebuild the source from the cached AI trace at Detail `d`, Smooth `s`,
  // Offset `o` and push it to the 3D via the store, WITHOUT re-running the AI. Unified RDP/Paper/Clipper.
  const reTrace = useCallback((d: number, s: number, o: number) => {
    const st = useOutlineStore.getState()
    const spec = st.spec
    if (!spec?.rawTracePx?.length) return
    const vs = buildTrace(spec.rawTracePx, spec.maskHeightPx, spec.mmPerPx, d, s, offsetToMm(o))
    if (!vs) return
    st.setSpec({ ...spec, vectorShape: vs })
    st.commitGeometry(vs)
  }, [])

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
      {generating && <GenerateShimmer onCancel={() => { magicRunRef.current++; setGenerating(false) }} />}

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
          onFilters={() => { editorPreRef.current = snapNow(); setEditorMode('image'); setEditingOutline(true) }}
          onEditor={() => { editorPreRef.current = snapNow(); setEditorMode(null); setEditingOutline(true) }}
          editorReady={!!prepared}
        />
      )}

      {/* POC (Dan 2026-06-17, v5poc-detail): post-gen Detail + Smooth dials — rebuild the cached AI
          trace LIVE (no AI re-run). Detail = tight↔coarse; Smooth = fair the pixel staircase. */}
      {artworkUrl && autoOutline && !editingOutline && !showColors && (
        <div style={{ position: 'fixed', left: 0, right: 0, top: 72, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px', borderRadius: 16, background: 'rgba(20,20,22,0.82)', color: '#f5f5f0', font: '500 13px system-ui, sans-serif', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ opacity: 0.75, minWidth: 50 }}>Detail</span>
              <input type="range" min={0} max={100} step={1} value={detail} onChange={(e) => { const v = Number(e.target.value); setDetail(v); reTrace(v, smooth, offset) }} style={{ width: 160, accentColor: '#c8a23c' }} aria-label="Magic trace detail (post-generation)" />
              <span style={{ minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{detail}%</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ opacity: 0.75, minWidth: 50 }}>Smooth</span>
              <input type="range" min={0} max={100} step={1} value={smooth} onChange={(e) => { const v = Number(e.target.value); setSmooth(v); reTrace(detail, v, offset) }} style={{ width: 160, accentColor: '#c8a23c' }} aria-label="Magic trace smooth (staircase fairing)" />
              <span style={{ minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{smooth}%</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ opacity: 0.75, minWidth: 50 }}>Offset</span>
              <input type="range" min={0} max={100} step={1} value={offset} onChange={(e) => { const v = Number(e.target.value); setOffset(v); reTrace(detail, smooth, v) }} style={{ width: 160, accentColor: '#c8a23c' }} aria-label="Magic trace offset (outset)" />
              <span style={{ minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{offset}%</span>
            </label>
          </div>
        </div>
      )}

      {/* drag-and-drop indicator (upload affordance) */}
      <EditOverlay isDragging={isDragging} />

      {/* The 2D outline editor — an overlay; the scene stays mounted (frozen) beneath it */}
      <OutlineEditor
        open={editingOutline}
        openMode={editorMode}
        onMagic={handleMagic}
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

      {/* THE GLOBAL TOP BAR — the SAME strip component identity as the editor's (fab-qa F-UX1):
          ✕-less hero form = undo/redo LEFT · RESET center only-when-dirty (real button) ·
          Edit · Export RIGHT. Hidden while the editor owns the screen (it mounts its own). */}
      {/* KAI-9005 (Dan): no gaps — the bar mounts from the EMPTY state too, controls greyed
          until a design exists (undo/redo disable themselves; RESET stays only-when-dirty) */}
      {!editingOutline && (
        <div className={`${edStyles.topbarFixed}`}>
          <TopBar
            left={(
              <>
                <TopBarButton icon={<UndoIcon />} label="Undo" onClick={globalUndo} disabled={!histRef.current.past.length} />
                <TopBarButton icon={<RedoIcon />} label="Redo" onClick={globalRedo} disabled={!histRef.current.future.length} />
              </>
            )}
            dirty={histRef.current.past.length > 0 && !!baselineRef.current}
            onReset={globalReset}
            right={(
              /* KAI-9011: Edit left the bar (Editor lives in the bottom dock). KAI-9010: Export
                 is internal-only (?internal=1). The hero bar is pills-first now. */
              internalTools ? <TopBarButton icon={<ExportIcon />} label="Export" onClick={onExport} disabled={!prepared} /> : null
            )}
          />
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
