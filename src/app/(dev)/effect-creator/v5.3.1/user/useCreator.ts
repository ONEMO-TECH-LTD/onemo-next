'use client'

// useCreator() — the creation/page socket (Creator v5.4 · blueprint §4 · DEC-v5-06).
//
// The headless orchestration core, lifted OUT of page.tsx (the Layer-2 seam): the upload sequence,
// the background cut-out cache, the Magic pipeline, the GLOBAL undo/redo/reset history machine,
// editor entry, the trim + filter sessions, and the mm-SVG export string. The UI binds to
// { state, actions } and nothing else.
//
// THE SPLIT (not a clean lift) — the concerns that straddle the seam are INJECTED by the UI, never
// reached from inside the socket (blueprint §4, the five injected adapters):
//   • notifications     → `adapters.notify` (the socket never imports toast)
//   • URL/route params  → injected (`adapters.segPresent`; ?scene / ?internal stay UI-side config)
//   • export download   → the socket RETURNS the SVG string; the UI writes the file
//   • editor-entry gesture → the socket exposes `enterEditor()`; the UI owns the double-tap
//   • first-paint resize nudge → the viewer adapter's concern, kept out of orchestration
//
// F25 RECIPE-HISTORY (leg 2, blueprint invariant 19/20): the history NEVER retains canvas-backed
// PreparedEffect snapshots, the full-res subject-matte data-URL, or the raw trace ×N. Each snapshot
// holds a lightweight RECIPE (a generation id + the re-derive inputs); the heavy `prepared` (+ its
// matte) live in a BOUNDED LRU keyed by generation id, so only the last few distinct generations are
// resident and the rest are GC-released. Restore pulls the prepared from the LRU, or RE-DERIVES it
// from the recipe (re-using a cached segmentation so a shaped re-derive skips the ML step). The
// geometry truth is the lightweight source/adjustments — unchanged; re-derive only rebuilds canvases.
// (The F25 texture cap, leg 1, already landed in the engine via effectiveTextureDim — 262963a.)

import { useState, useCallback, useRef } from 'react'
import { useSceneStore } from '../admin/sceneStore'
import { INITIAL_ARTWORK, useOutlineStore } from './outlineStore'
import { detailToFloorMm } from './editor/producers'
import type { DesignState } from '../types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { MLResult } from '@/lib/effect/segment-ml'

/** UI-side notification sink — the socket emits, the UI binds it to toast() (blueprint §4 adapter). */
export type Notify = (kind: 'warn' | 'error' | 'info', message: string) => void

export interface CreatorAdapters {
  notify: Notify
  /** Injected URL/route param: ?seg present → skip the upload-time background cut-out (harness override).
   *  Product URLs carry no ?seg. Read by the UI from window.location, never inside the socket. */
  segPresent: boolean
}

/** Re-derive inputs for a prepared generation (F25: stored in history instead of the canvases). */
type Recipe = { url: string; mode: 'standard' | 'shaped' }

/** How many DISTINCT prepared generations stay resident (instant undo); older ones re-derive on restore. */
const KEEP_GENERATIONS = 6
/** How many resolved segmentations to cache (one per uploaded url) so a shaped re-derive skips ML.
 *  Bounded so the F25 memory fix doesn't itself leak — evicting a seg only makes that re-derive re-segment. */
const SEG_CACHE_CAP = 12

// ── #23 GLOBAL history snapshot shapes — lightweight (F25 leg 2: NO prepared object, NO matte URL) ──
type OutlineSnap = {
  // spec is stored WITHOUT rawTracePx (provenance/debug only — never read on restore; F25).
  spec: ReturnType<typeof useOutlineStore.getState>['spec']
  committedShape: ReturnType<typeof useOutlineStore.getState>['committedShape']
  source: ReturnType<typeof useOutlineStore.getState>['source']
  adjustments: ReturnType<typeof useOutlineStore.getState>['adjustments']
  bgBlur: number | null
}
type AppSnap = {
  genId: number          // → prepared LRU; -1 = no prepared yet
  recipe: Recipe | null  // re-derive inputs if this generation has been evicted from the LRU
  autoOutline: boolean
  designState: DesignState
  imageFx: ReturnType<typeof useOutlineStore.getState>['imageFx']
  wrapTile: boolean
  outline: OutlineSnap
  trim: { backColor: string; frameColor: string; bgColor: string }
}

/** Strip rawTracePx from a spec for history storage (provenance only — never resolved from; F25 leg 2). */
function liteSpec(spec: ReturnType<typeof useOutlineStore.getState>['spec']) {
  if (!spec) return spec
  if (spec.rawTracePx === undefined) return spec
  return { ...spec, rawTracePx: undefined }
}

export function useCreator(adapters: CreatorAdapters) {
  const { notify, segPresent } = adapters

  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [prepared, setPrepared] = useState<PreparedEffect | null>(null) // the one engine's output (live)
  const [editingOutline, setEditingOutline] = useState(false)
  const [editorMode, setEditorMode] = useState<'shape' | 'image' | null>(null) // #27 + KAI-9027
  const [autoOutline, setAutoOutline] = useState(false) // false = standard square; true = Magic cut-out
  const [generating, setGenerating] = useState(false)
  const [showColors, setShowColors] = useState(false)
  const [showFilters, setShowFilters] = useState(false) // KAI-9124: standalone Filters takeover

  const designState = useOutlineStore((s) => s.artwork) // #28: scene + editor share it
  const setDesignState = useCallback((upd: DesignState | ((prev: DesignState) => DesignState)) => {
    const st = useOutlineStore.getState()
    st.setArtwork(typeof upd === 'function' ? upd(st.artwork) : upd)
  }, [])
  const { colors, setBackColor } = useSceneStore()

  // refs — cut-out cache, run tokens, per-session pre-snapshots
  const sourceShaRef = useRef<string | null>(null)
  const cutCacheRef = useRef<{ url: string; promise: Promise<MLResult> } | null>(null)
  const uploadSeqRef = useRef(0)
  const histRef = useRef<{ past: AppSnap[]; future: AppSnap[] }>({ past: [], future: [] })
  const baselineRef = useRef<AppSnap | null>(null)
  const editorPreRef = useRef<AppSnap | null>(null)
  const trimPreRef = useRef<AppSnap | null>(null)
  const filterPreRef = useRef<AppSnap | null>(null) // KAI-9124 pre-Filters snapshot
  const magicRunRef = useRef(0) // UX-5 / KAI-9083 cancel/new-upload token

  // F25 leg 2 — the prepared generation registry (bounded LRU) + the current-generation pointers.
  const genRef = useRef(0)
  const curGenRef = useRef(-1)
  const curRecipeRef = useRef<Recipe | null>(null)
  const lruRef = useRef<Map<number, { prepared: PreparedEffect; matteUrl: string | null }>>(new Map())
  const segCacheRef = useRef<Map<string, MLResult>>(new Map()) // resolved seg per url → shaped re-derive skips ML
  const restoringRef = useRef(false) // re-entrancy lock: a re-derive in flight blocks a racing undo/redo
  const [, bumpHist] = useState(0)

  /** Mark genId most-recently-used and evict the oldest beyond KEEP_GENERATIONS (releases their canvases). */
  const touchGen = useCallback((genId: number) => {
    const lru = lruRef.current
    const e = lru.get(genId)
    if (e) { lru.delete(genId); lru.set(genId, e) } // move to newest
    while (lru.size > KEEP_GENERATIONS) { const oldest = lru.keys().next().value as number; lru.delete(oldest) }
  }, [])

  /** Register a freshly-built prepared as the CURRENT generation; returns its id. */
  const registerGeneration = useCallback((p: PreparedEffect, recipe: Recipe, matteUrl: string | null): number => {
    const genId = ++genRef.current
    lruRef.current.set(genId, { prepared: p, matteUrl })
    touchGen(genId)
    curGenRef.current = genId
    curRecipeRef.current = recipe
    return genId
  }, [touchGen])

  /** Re-derive the matte data-URL for a (re-derived) prepared — shaped from its subject canvas, standard
   *  from the cached segmentation (null if the cut-out never ran / isn't cached). */
  const matteFor = useCallback(async (p: PreparedEffect, recipe: Recipe): Promise<string | null> => {
    try {
      if (recipe.mode === 'shaped') return p.frontSrc.subjCanvas.toDataURL()
      const seg = segCacheRef.current.get(recipe.url)
      if (!seg) return null
      const pe = await import('@/lib/effect/prepare-effect')
      return pe.subjectMatteFromSeg(p.frontSrc.origCanvas, seg).toDataURL()
    } catch { return null }
  }, [])

  /** Re-derive a prepared from its recipe (LRU miss on restore). Reuses a cached seg so shaped skips ML. */
  const reDerive = useCallback(async (recipe: Recipe): Promise<PreparedEffect> => {
    const { prepareEffect, EFFECT_BUILD_CONFIG } = await import('@/lib/effect/prepare-effect')
    if (recipe.mode === 'standard') return prepareEffect(recipe.url, 'standard')
    const preseg = segCacheRef.current.get(recipe.url)
    return prepareEffect(recipe.url, 'shaped', { ...EFFECT_BUILD_CONFIG, minFeatureMM: detailToFloorMm(100), paddingMM: 0 }, undefined, preseg)
  }, [])

  const snapNow = useCallback((): AppSnap => {
    const o = useOutlineStore.getState()
    return {
      genId: curGenRef.current,
      recipe: curRecipeRef.current,
      autoOutline, designState,
      imageFx: o.imageFx,
      wrapTile: o.wrapTile,
      outline: { spec: liteSpec(o.spec), committedShape: o.committedShape, source: o.source, adjustments: o.adjustments, bgBlur: o.bgBlur },
      trim: { ...useSceneStore.getState().colors },
    }
  }, [autoOutline, designState])

  const pushHistory = useCallback((snap: AppSnap) => {
    histRef.current.past.push(snap)
    if (histRef.current.past.length > 30) histRef.current.past.shift()
    histRef.current.future = []
    bumpHist((v) => v + 1)
  }, [])

  /** Restore a lightweight snapshot — resolves its prepared from the LRU or RE-DERIVES it (F25 leg 2). */
  const restoreSnap = useCallback(async (sn: AppSnap) => {
    // resolve the heavy prepared (+ matte) for this generation
    let resolvedPrepared: PreparedEffect | null = null
    let matteUrl: string | null = null
    if (sn.genId >= 0) {
      const entry = lruRef.current.get(sn.genId)
      if (entry) {
        resolvedPrepared = entry.prepared; matteUrl = entry.matteUrl
      } else if (sn.recipe) {
        resolvedPrepared = await reDerive(sn.recipe)
        matteUrl = await matteFor(resolvedPrepared, sn.recipe)
        lruRef.current.set(sn.genId, { prepared: resolvedPrepared, matteUrl })
      }
      curGenRef.current = sn.genId
      curRecipeRef.current = sn.recipe
      touchGen(sn.genId)
    } else {
      curGenRef.current = -1
      curRecipeRef.current = null
    }
    setPrepared(resolvedPrepared)
    setAutoOutline(sn.autoOutline)
    setDesignState(sn.designState)
    const o = useOutlineStore.getState()
    o.setImageFx(sn.imageFx)
    o.setWrapTile(sn.wrapTile)
    o.setSpec(sn.outline.spec)
    o.setSource(sn.outline.source, sn.outline.adjustments)
    o.setBgBlur(sn.outline.bgBlur)
    o.setSubjMatteUrl(matteUrl)
    const sc = useSceneStore.getState()
    sc.setBackColor(sn.trim.backColor)
    sc.setFrameColor(sn.trim.frameColor)
    sc.setBgColor(sn.trim.bgColor)
  }, [reDerive, matteFor, touchGen, setDesignState])

  const undo = useCallback(async () => {
    if (restoringRef.current) return
    const h = histRef.current
    if (!h.past.length) return
    restoringRef.current = true
    const prev = h.past.pop()!
    h.future.unshift(snapNow())
    bumpHist((v) => v + 1)
    try { await restoreSnap(prev) } finally { restoringRef.current = false; bumpHist((v) => v + 1) }
  }, [snapNow, restoreSnap])

  const redo = useCallback(async () => {
    if (restoringRef.current) return
    const h = histRef.current
    if (!h.future.length) return
    restoringRef.current = true
    const next = h.future.shift()!
    h.past.push(snapNow())
    bumpHist((v) => v + 1)
    try { await restoreSnap(next) } finally { restoringRef.current = false; bumpHist((v) => v + 1) }
  }, [snapNow, restoreSnap])

  const reset = useCallback(async () => {
    if (restoringRef.current || !baselineRef.current) return
    restoringRef.current = true
    pushHistory(snapNow()) // Reset itself is undoable
    try { await restoreSnap(baselineRef.current) } finally { restoringRef.current = false; bumpHist((v) => v + 1) }
  }, [snapNow, restoreSnap, pushHistory])

  // Export — the mm-true SVG cutline from THE vector truth. The socket returns the STRING; the UI
  // performs the download (the injected export adapter). null = nothing/not-feasible (already notified).
  const exportSvg = useCallback(async (): Promise<string | null> => {
    const o = useOutlineStore.getState()
    const v = o.committedShape ?? o.spec?.vectorShape
    const sp = o.spec
    if (!v || !sp) { notify('warn', 'Nothing to export yet — add an image first'); return null }
    const [{ toManufacturingSVG }, { contourFromShape, assertContourCuttable }] = await Promise.all([
      import('@/lib/export'), import('@/lib/effect/geometry-truth'),
    ])
    // KAI-9077 / MFG-1: gate the live cut-line export on feasibility — never emit a folded/uncuttable shape.
    const c = contourFromShape(v, { mmPerPx: sp.mmPerPx || 1, maskHeightPx: sp.maskHeightPx })
    const feas = c ? assertContourCuttable(c, sp.mmPerPx || 1) : { ok: false as const, reason: 'degenerate' as const }
    if (!feas.ok) { notify('warn', `Can't export — the outline isn't cleanly cuttable (${feas.reason}). Fix the shape first.`); return null }
    return toManufacturingSVG(v, { mmPerPx: sp.mmPerPx || 1, widthPx: sp.maskWidthPx, heightPx: sp.maskHeightPx })
  }, [notify])

  // v5.3·P1 (KAI-9146): subject cut-out in the BACKGROUND once the instant square is up — cached per
  // image so Magic reuses it (instant), and the matte lights up Blend on any shape. `segPresent` (an
  // injected ?seg) selects the harness WebGPU path, so we SKIP the background run (Magic cuts on demand).
  // F25: the resolved seg is cached per url (segCacheRef) so a later shaped RE-DERIVE skips the ML step,
  // and the published matte is patched onto the standard generation's LRU entry (so undo restores it).
  const startBackgroundCutout = useCallback((url: string, standard: PreparedEffect, seq: number, genId: number) => {
    if (segPresent) return
    const segPromise = (async () => {
      const [{ segmentML }, { effectiveTextureDim }, pe] = await Promise.all([
        import('@/lib/effect/segment-ml'),
        import('@/lib/effect/mask'),
        import('@/lib/effect/prepare-effect'),
      ])
      const cfg = pe.EFFECT_BUILD_CONFIG
      const texDim = effectiveTextureDim() // F25: capped working res; SAME helper Magic uses → reusable
      const seg = await segmentML(url, cfg.maxImageDim, texDim)
      segCacheRef.current.set(url, seg) // F25: cache for instant shaped re-derive on undo
      while (segCacheRef.current.size > SEG_CACHE_CAP) { const k = segCacheRef.current.keys().next().value as string; segCacheRef.current.delete(k) }
      if (uploadSeqRef.current === seq) { // still the active image — publish the matte for Blend
        try {
          const matteUrl = pe.subjectMatteFromSeg(standard.frontSrc.origCanvas, seg).toDataURL()
          useOutlineStore.getState().setSubjMatteUrl(matteUrl)
          const entry = lruRef.current.get(genId)
          if (entry) entry.matteUrl = matteUrl // so a later undo back to this standard generation restores it
        } catch (err) { console.warn('[effect] P1 matte publish failed:', err) }
      }
      return seg
    })()
    cutCacheRef.current = { url, promise: segPromise }
    segPromise.catch((e) => {
      console.warn('[effect] background cut-out failed (Magic re-runs on demand):', e)
      if (cutCacheRef.current?.url === url) cutCacheRef.current = null
    })
  }, [segPresent])

  const upload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (artworkUrl?.startsWith('blob:')) URL.revokeObjectURL(artworkUrl)
    const url = URL.createObjectURL(file)
    sourceShaRef.current = null // identity captured later, at order/save
    setArtworkUrl(url)
    setDesignState(INITIAL_ARTWORK)
    setAutoOutline(false) // new image → the standard square; Magic opts into the cut-out
    const st = useOutlineStore.getState()
    st.commitGeometry(null); st.setBgBlur(null); st.setSubjMatteUrl(null)
    const seq = ++uploadSeqRef.current
    cutCacheRef.current = null
    magicRunRef.current++ // KAI-9083: a new image supersedes any in-flight Magic
    setGenerating(false)
    import('@/lib/effect/prepare-effect')
      .then(({ prepareEffect }) => prepareEffect(url, 'standard'))
      .then((p) => {
        setPrepared(p)
        useOutlineStore.getState().setSpec(p.spec)
        const genId = registerGeneration(p, { url, mode: 'standard' }, null)
        baselineRef.current = {
          genId, recipe: { url, mode: 'standard' }, autoOutline: false, designState: INITIAL_ARTWORK,
          imageFx: null, wrapTile: false,
          outline: { spec: liteSpec(p.spec), committedShape: null, source: null, adjustments: { global: { simplify: 0, smooth: 0, straighten: 0, radius: 0 }, local: {} }, bgBlur: null },
          trim: { ...useSceneStore.getState().colors },
        }
        histRef.current = { past: [], future: [] }
        bumpHist((v) => v + 1)
        startBackgroundCutout(url, p, seq, genId)
      })
      .catch((e) => {
        console.warn('[effect] prepare (standard) failed:', e)
        notify('error', `Couldn't build the square: ${(e as Error)?.message ?? e}`)
      })
  }, [artworkUrl, startBackgroundCutout, registerGeneration, setDesignState, notify])

  const handleStatus = useCallback((s: 'idle' | 'building' | 'ready' | 'error', message?: string) => {
    if (s === 'error') notify('error', `3D build failed: ${message ?? 'unknown error'}`) // G4
  }, [notify])

  // Magic — re-prepare as a SHAPED subject cut-out (BEN in the worker; morphs in place, no jump).
  const magic = useCallback(() => {
    if (!artworkUrl || generating) return
    const preMagic = snapNow() // #23: one Magic = one global undo step (pushed only on success)
    const runId = ++magicRunRef.current
    setGenerating(true)
    import('@/lib/effect/prepare-effect')
      .then(async ({ prepareEffect, EFFECT_BUILD_CONFIG }) => {
        let preseg: MLResult | undefined
        const cache = cutCacheRef.current
        if (cache && cache.url === artworkUrl) {
          try { preseg = await cache.promise } catch { preseg = undefined }
        }
        if (!preseg) preseg = segCacheRef.current.get(artworkUrl) // F25: fall back to the resolved-seg cache
        return prepareEffect(artworkUrl, 'shaped', { ...EFFECT_BUILD_CONFIG, minFeatureMM: detailToFloorMm(100), paddingMM: 0 }, (s) => {
          if (s === 'fallback') notify('warn', 'AI cut-out unavailable — used the simple background cut instead') // G4
        }, preseg)
      })
      .then((p) => {
        if (magicRunRef.current !== runId) return // cancelled mid-run — prior state stands (UX-5)
        if (sourceShaRef.current) p.spec.sourceBytesSha256 = sourceShaRef.current
        setPrepared(p)
        const st = useOutlineStore.getState()
        st.setSpec(p.spec)
        st.commitGeometry(null); st.setBgBlur(null) // fresh cut-out → drop prior edits
        let matteUrl: string | null = null
        try { matteUrl = p.frontSrc.subjCanvas.toDataURL() } catch { matteUrl = null }
        st.setSubjMatteUrl(matteUrl)
        registerGeneration(p, { url: artworkUrl, mode: 'shaped' }, matteUrl)
        setAutoOutline(true)
        setGenerating(false)
        pushHistory(preMagic)
      })
      .catch((e) => {
        if (magicRunRef.current !== runId) return // cancelled — stay quiet
        console.warn('[effect] prepare (shaped) failed:', e)
        notify('error', `Magic failed: ${(e as Error)?.message ?? e}`) // G4
        setGenerating(false)
      })
  }, [artworkUrl, generating, snapNow, pushHistory, registerGeneration, notify])

  /** Cancel an in-flight Magic (UX-5): bump the token so a stale result/error is a no-op. */
  const cancelMagic = useCallback(() => { magicRunRef.current++; setGenerating(false) }, [])

  // Editor entry — the socket action; the UI owns the double-tap gesture / Edit button that calls it.
  const enterEditor = useCallback((mode: 'shape' | 'image' | null) => {
    editorPreRef.current = snapNow()
    setEditorMode(mode)
    setEditingOutline(true)
  }, [snapNow])

  // Editor close — one editor session (Done with changes) = one global step. The change test covers
  // EVERYTHING a session can commit — shape, blend, image-fx, photo position (KAI-8971/F2).
  const closeEditor = useCallback(() => {
    setEditingOutline(false)
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
  }, [pushHistory])

  // Trim (D-TRIM) session — tap recolors the 3D back LIVE; ✓ keeps (one step), ✕ reverts.
  const openTrim = useCallback(() => { trimPreRef.current = snapNow(); setShowColors(true) }, [snapNow])
  const closeTrim = useCallback(() => {
    if (trimPreRef.current) {
      const t = trimPreRef.current.trim, c = useSceneStore.getState().colors
      if (t.backColor !== c.backColor) pushHistory(trimPreRef.current)
      trimPreRef.current = null
    }
    setShowColors(false)
  }, [pushHistory])
  const cancelTrim = useCallback(() => {
    if (trimPreRef.current) { setBackColor(trimPreRef.current.trim.backColor); trimPreRef.current = null }
    setShowColors(false)
  }, [setBackColor])

  // Filters (KAI-9124) session — over the LIVE 3D; ✓ keeps (one global step), ✕ reverts.
  const openFilters = useCallback(() => { filterPreRef.current = snapNow(); setShowFilters(true) }, [snapNow])
  const closeFilters = useCallback(() => {
    const pre = filterPreRef.current
    if (pre) {
      const o = useOutlineStore.getState()
      if (o.imageFx !== pre.imageFx || o.bgBlur !== pre.outline.bgBlur || o.wrapTile !== pre.wrapTile) pushHistory(pre)
      filterPreRef.current = null
    }
    setShowFilters(false)
  }, [pushHistory])
  const cancelFilters = useCallback(() => { filterPreRef.current = null; setShowFilters(false) }, [])

  return {
    state: {
      artworkUrl, prepared, editingOutline, editorMode, autoOutline, generating,
      showColors, showFilters, designState, colors,
      canUndo: histRef.current.past.length > 0,
      canRedo: histRef.current.future.length > 0,
      dirty: histRef.current.past.length > 0 && !!baselineRef.current,
      hasArtwork: !!prepared,
    },
    actions: {
      upload, magic, cancelMagic, undo, redo, reset,
      enterEditor, closeEditor, exportSvg, handleStatus,
      setBackColor, openTrim, closeTrim, cancelTrim, openFilters, closeFilters, cancelFilters,
    },
  }
}
