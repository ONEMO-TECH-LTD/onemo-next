'use client'

// core/transactions.ts — Layer-2b FLOW-OWNED TRANSACTION SERVICES (Creator v5.5 · blueprint §4 · KAI-9222).
//
// Flow-TIMING state that is deliberately NOT a primitive (forcing it into a primitive leaks flow knowledge
// — pixel's verdict). This module holds the **history transaction** (the F25 recipe + bounded-LRU machine,
// inv 20): snapshot the whole app state as a lightweight re-derivable recipe (NEVER canvas snapshots), and
// restore by pulling the prepared from the LRU or RE-DERIVING it via the Layer-2a primitives.
//
// Lifted verbatim (behaviour-neutral) from useCreator.ts's macro. The ONLY change: reDerive now COMPOSES
// the primitives (prepareStandard/prepareShaped) instead of importing prepareEffect directly — same call,
// same cfg, behaviour-identical (the expert-noted right layering).
//
// This module also holds the other Layer-2b transaction services that COMPOSE this history (snapNow/
// pushHistory): the publishCutoutResult seq-guard, the generation-cancel token, and the editor/trim/filter
// sessions — all below.

import { useState, useCallback, useRef } from 'react'
import { useSceneStore } from '../admin/sceneStore'
import { useOutlineStore } from './../user/outlineStore'
import { prepareStandard, prepareShaped } from './primitives'
import type { DesignState } from '../types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { MLResult } from '@/lib/effect/segment-ml'

/** UI-side notification sink (the injected adapter — blueprint §4). */
type Notify = (kind: 'warn' | 'error' | 'info', message: string) => void

/** Re-derive inputs for a prepared generation (F25: stored in history instead of the canvases). */
export type Recipe = { url: string; mode: 'standard' | 'shaped' }

/** How many DISTINCT prepared generations stay resident (instant undo); older ones re-derive on restore. */
const KEEP_GENERATIONS = 6
/** How many resolved segmentations to cache (one per uploaded url) so a shaped re-derive skips ML.
 *  Bounded so the F25 memory fix doesn't itself leak — evicting a seg only makes that re-derive re-segment. */
const SEG_CACHE_CAP = 12

// ── #23 GLOBAL history snapshot shapes — lightweight (F25 leg 2: NO prepared object, NO matte URL) ──
export type OutlineSnap = {
  // spec is stored stripped of rawTracePx (memory); restore RE-ATTACHES the full spec from the prepared,
  // because the editor's Detail/Offset re-derivation reads spec.rawTracePx (OutlineEditor:354,362) — F25.
  spec: ReturnType<typeof useOutlineStore.getState>['spec']
  committedShape: ReturnType<typeof useOutlineStore.getState>['committedShape']
  source: ReturnType<typeof useOutlineStore.getState>['source']
  adjustments: ReturnType<typeof useOutlineStore.getState>['adjustments']
  bgBlur: number | null
}
export type AppSnap = {
  genId: number          // → prepared LRU; -1 = no prepared yet
  recipe: Recipe | null  // re-derive inputs if this generation has been evicted from the LRU
  autoOutline: boolean
  designState: DesignState
  imageFx: ReturnType<typeof useOutlineStore.getState>['imageFx']
  wrapTile: boolean
  outline: OutlineSnap
  trim: { backColor: string; frameColor: string; bgColor: string }
}

/** Strip rawTracePx from a STORED spec (memory win). Restore re-attaches the full spec from the prepared,
 *  so the editor's Detail/Offset (which read spec.rawTracePx) survive undo/redo/reset (F25 leg 2). */
export function liteSpec(spec: ReturnType<typeof useOutlineStore.getState>['spec']) {
  if (!spec) return spec
  if (spec.rawTracePx === undefined) return spec
  return { ...spec, rawTracePx: undefined }
}

/** Strip rawTracePx from a STORED source — it is write-only provenance (no reader; verified by grep), so
 *  dropping it from each snapshot is zero-behaviour + stops the raw trace being retained ×N history (F25 leg 2).
 *  Exported for the KAI-9223 unit test (the dep-free F25 coverage). */
export function liteSource(source: ReturnType<typeof useOutlineStore.getState>['source']) {
  if (!source || source.rawTracePx === undefined) return source
  return { ...source, rawTracePx: undefined }
}

export interface HistoryTransactionArgs {
  notify: Notify
  /** live React state snapNow must capture (the flow's current autoOutline + designState). */
  autoOutline: boolean
  designState: DesignState
  /** the flow's published outputs the restore drives (injected — the transaction never owns React UI state). */
  setPrepared: (p: PreparedEffect | null) => void
  setAutoOutline: (v: boolean) => void
  setDesignState: (d: DesignState | ((prev: DesignState) => DesignState)) => void
  publishToViewer: (p: PreparedEffect | null) => void
}

/** The history transaction service — the global undo/redo/reset machine + the F25 recipe/LRU/seg caches. */
export function useHistoryTransaction(args: HistoryTransactionArgs) {
  const { notify, autoOutline, designState, setPrepared, setAutoOutline, setDesignState, publishToViewer } = args

  const histRef = useRef<{ past: AppSnap[]; future: AppSnap[] }>({ past: [], future: [] })
  const baselineRef = useRef<AppSnap | null>(null)

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

  /** Cache the resolved segmentation for a url (so a shaped re-derive skips ML); bounded. */
  const cacheSeg = useCallback((url: string, seg: MLResult) => {
    segCacheRef.current.set(url, seg)
    while (segCacheRef.current.size > SEG_CACHE_CAP) { const k = segCacheRef.current.keys().next().value as string; segCacheRef.current.delete(k) }
  }, [])
  const getCachedSeg = useCallback((url: string) => segCacheRef.current.get(url), [])
  /** Patch the published matte onto a generation's LRU entry (so a later undo back to it restores the matte). */
  const patchGenMatte = useCallback((genId: number, matteUrl: string) => {
    const entry = lruRef.current.get(genId)
    if (entry) entry.matteUrl = matteUrl
  }, [])

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

  /** Re-derive a prepared from its recipe (LRU miss on restore) — COMPOSES the Layer-2a primitives (same
   *  call/cfg as the macro's old inline prepareEffect; behaviour-identical). Reuses a cached seg for shaped. */
  const reDerive = useCallback(async (recipe: Recipe): Promise<PreparedEffect> => {
    if (recipe.mode === 'standard') return prepareStandard(recipe.url)
    return prepareShaped(recipe.url, segCacheRef.current.get(recipe.url))
  }, [])

  const snapNow = useCallback((): AppSnap => {
    const o = useOutlineStore.getState()
    return {
      genId: curGenRef.current,
      recipe: curRecipeRef.current,
      autoOutline, designState,
      imageFx: o.imageFx,
      wrapTile: o.wrapTile,
      outline: { spec: liteSpec(o.spec), committedShape: o.committedShape, source: liteSource(o.source), adjustments: o.adjustments, bgBlur: o.bgBlur },
      trim: { ...useSceneStore.getState().colors },
    }
  }, [autoOutline, designState])

  const pushHistory = useCallback((snap: AppSnap) => {
    histRef.current.past.push(snap)
    if (histRef.current.past.length > 30) histRef.current.past.shift()
    histRef.current.future = []
    bumpHist((v) => v + 1)
  }, [])

  /** Install a baseline snapshot + clear history (a fresh upload). */
  const setBaseline = useCallback((snap: AppSnap) => {
    baselineRef.current = snap
    histRef.current = { past: [], future: [] }
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
    publishToViewer(resolvedPrepared) // restore the 3D for this generation (null clears it) — v53 parity
    setAutoOutline(sn.autoOutline)
    setDesignState(sn.designState)
    const o = useOutlineStore.getState()
    o.setImageFx(sn.imageFx)
    o.setWrapTile(sn.wrapTile)
    // F25 finding-1: re-attach the FULL spec (with rawTracePx) from the resolved prepared, so the editor's
    // Detail/Offset re-derivation (which reads spec.rawTracePx) survives undo. resolvedPrepared.spec ≡ the
    // stored lite spec + rawTracePx (spec is never edited post-generation). Lite spec is the fallback.
    o.setSpec(resolvedPrepared?.spec ?? sn.outline.spec)
    o.setSource(sn.outline.source, sn.outline.adjustments)
    o.setBgBlur(sn.outline.bgBlur)
    o.setSubjMatteUrl(matteUrl)
    const sc = useSceneStore.getState()
    sc.setBackColor(sn.trim.backColor)
    sc.setFrameColor(sn.trim.frameColor)
    sc.setBgColor(sn.trim.bgColor)
  }, [reDerive, matteFor, touchGen, setPrepared, setAutoOutline, setDesignState, publishToViewer])

  // F25 finding-2: snapshot the move target + current, restore FIRST, and commit the stack mutation ONLY
  // on success — a re-derive throw then leaves the history + UI consistent (no desync) and notifies, vs the
  // old "mutate-then-await" which popped before a possible throw. restoreSnap's re-derive (the only throw
  // point) runs before any state setter, so a failure leaves on-screen state untouched.
  const undo = useCallback(async () => {
    if (restoringRef.current) return
    const h = histRef.current
    if (!h.past.length) return
    restoringRef.current = true
    const prev = h.past[h.past.length - 1]
    const cur = snapNow()
    try {
      await restoreSnap(prev)
      h.past.pop(); h.future.unshift(cur)
    } catch (e) {
      console.warn('[effect] undo restore failed:', e)
      notify('error', `Undo failed: ${(e as Error)?.message ?? e}`)
    } finally { restoringRef.current = false; bumpHist((v) => v + 1) }
  }, [snapNow, restoreSnap, notify])

  const redo = useCallback(async () => {
    if (restoringRef.current) return
    const h = histRef.current
    if (!h.future.length) return
    restoringRef.current = true
    const next = h.future[0]
    const cur = snapNow()
    try {
      await restoreSnap(next)
      h.future.shift(); h.past.push(cur)
    } catch (e) {
      console.warn('[effect] redo restore failed:', e)
      notify('error', `Redo failed: ${(e as Error)?.message ?? e}`)
    } finally { restoringRef.current = false; bumpHist((v) => v + 1) }
  }, [snapNow, restoreSnap, notify])

  const reset = useCallback(async () => {
    if (restoringRef.current || !baselineRef.current) return
    restoringRef.current = true
    const cur = snapNow()
    try {
      await restoreSnap(baselineRef.current)
      pushHistory(cur) // Reset itself is undoable — push only after a successful restore
    } catch (e) {
      console.warn('[effect] reset restore failed:', e)
      notify('error', `Reset failed: ${(e as Error)?.message ?? e}`)
    } finally { restoringRef.current = false; bumpHist((v) => v + 1) }
  }, [snapNow, restoreSnap, pushHistory, notify])

  return {
    // history state (derived — recomputed on bumpHist re-render)
    canUndo: histRef.current.past.length > 0,
    canRedo: histRef.current.future.length > 0,
    dirty: histRef.current.past.length > 0 && !!baselineRef.current,
    // actions
    undo, redo, reset,
    // composition surface for the flow (upload/magic/sessions/publishCutoutResult)
    snapNow, pushHistory, setBaseline, registerGeneration,
    cacheSeg, getCachedSeg, patchGenMatte,
  }
}

/** Generation-cancel token (UX-5 / KAI-9083): a new image OR an explicit cancel supersedes an in-flight
 *  Magic; a stale/cancelled result is a no-op. Flow-timing state — owned by the flow, NOT a primitive. */
export function useGenerationTask() {
  const runRef = useRef(0)
  const beginRun = useCallback(() => ++runRef.current, []) // start a run; returns its id
  const isCurrent = useCallback((runId: number) => runRef.current === runId, []) // false ⇒ superseded/cancelled
  const cancel = useCallback(() => { runRef.current++ }, []) // bump so any in-flight result is a no-op
  return { beginRun, isCurrent, cancel }
}

/** Upload-publish seq-guard (blueprint §4: the guard is at PUBLICATION, not segmentation). A new image bumps
 *  the seq; publishCutoutResult writes the matte ONLY if its seq is still the active image — then patches it
 *  onto the generation's LRU entry (composes the history transaction) so an undo back to it restores the matte. */
export function useUploadPublish(patchGenMatte: (genId: number, matteUrl: string) => void) {
  const uploadSeqRef = useRef(0)
  const nextUploadSeq = useCallback(() => ++uploadSeqRef.current, [])
  const publishCutoutResult = useCallback(async (seq: number, standard: PreparedEffect, genId: number, seg: MLResult) => {
    if (uploadSeqRef.current !== seq) return // fast-return: already superseded by a newer image
    try {
      const { subjectMatteFromSeg } = await import('@/lib/effect/prepare-effect')
      // RE-CHECK after the await, immediately before the mutation — the macro published the matte
      // SYNCHRONOUSLY right after its guard (pe already imported), so the guard sat immediately before the
      // write. Extracting moved the import inside, opening an async gap; this second check restores the
      // "stale cannot mutate" guarantee (KAI-9222/9223 acceptance · pixel-2 F1). Behaviour-neutral.
      if (uploadSeqRef.current !== seq) return
      const matteUrl = subjectMatteFromSeg(standard.frontSrc.origCanvas, seg).toDataURL()
      useOutlineStore.getState().setSubjMatteUrl(matteUrl)
      patchGenMatte(genId, matteUrl)
    } catch (err) { console.warn('[effect] P1 matte publish failed:', err) }
  }, [patchGenMatte])
  return { nextUploadSeq, publishCutoutResult }
}

// ── Session change-detection predicates (KAI-9223 +C) — PURE so they're unit-testable without the
//    hook/DOM (the build-plan's "session commit semantics" acceptance). They catch the bug class the live
//    A/B misses by eye: a spurious OR missed history step on a no-op session close. Behaviour-IDENTICAL to
//    the old inline tests — note the deliberate asymmetry kept verbatim: the EDITOR compares imageFx by
//    VALUE (null = the {100/100/100/0} default), the FILTER compares imageFx by REFERENCE.
type StoreImageFx = ReturnType<typeof useOutlineStore.getState>['imageFx']
type StoreArtwork = ReturnType<typeof useOutlineStore.getState>['artwork']
type StoreShape = ReturnType<typeof useOutlineStore.getState>['committedShape']

/** Value-compare imageFx with the null→default {100/100/100/0} normalization: an untouched null reads as
 *  NO change vs the explicit default (the editor's change-test, KAI-8971/F2). */
export function imageFxChanged(a: StoreImageFx, b: StoreImageFx): boolean {
  const av = a ?? { brightness: 100, contrast: 100, saturate: 100, warmth: 0 }
  const bv = b ?? { brightness: 100, contrast: 100, saturate: 100, warmth: 0 }
  return av.brightness !== bv.brightness || av.contrast !== bv.contrast || av.saturate !== bv.saturate || av.warmth !== bv.warmth
}

/** Did the EDITOR session change anything commit-worthy? shape · blur · image-fx (VALUE) · photo position. */
export function editorSessionChanged(
  cur: { committedShape: StoreShape; bgBlur: number | null; imageFx: StoreImageFx; artwork: StoreArtwork },
  pre: AppSnap,
): boolean {
  const artChanged = cur.artwork.offsetX !== pre.designState.offsetX || cur.artwork.offsetY !== pre.designState.offsetY || cur.artwork.scale !== pre.designState.scale
  return cur.committedShape !== pre.outline.committedShape || cur.bgBlur !== pre.outline.bgBlur || imageFxChanged(cur.imageFx, pre.imageFx) || artChanged
}

/** Did the FILTER session change anything? imageFx (REFERENCE — matches the existing inline test) · blur · tile. */
export function filterSessionChanged(
  cur: { imageFx: StoreImageFx; bgBlur: number | null; wrapTile: boolean },
  pre: AppSnap,
): boolean {
  return cur.imageFx !== pre.imageFx || cur.bgBlur !== pre.outline.bgBlur || cur.wrapTile !== pre.wrapTile
}

/** Editor / Trim / Filter SESSIONS — begin (snapshot) / commit (push one history step on a real change) /
 *  revert. Owns the overlay flags + the pre-snapshots; composes the history (snapNow/pushHistory). The
 *  change-test on commit covers EVERYTHING a session can touch (shape · blend · image-fx · photo position —
 *  KAI-8971/F2). Phase-2 Option A: cancelFilters is close-only; the real imageFx/bgBlur/wrapTile revert
 *  still lives in FiltersSurface (Layer-3) until Phase 6 re-authors it onto this session's revert action by
 *  construction (tracked). trim's revert (cancelTrim) lifts cleanly now; the editor's discard is Phase 4. */
export function useSessions(args: {
  snapNow: () => AppSnap
  pushHistory: (s: AppSnap) => void
  setBackColor: (c: string) => void
}) {
  const { snapNow, pushHistory, setBackColor } = args
  const [editingOutline, setEditingOutline] = useState(false)
  const [editorMode, setEditorMode] = useState<'shape' | 'image' | null>(null) // #27 + KAI-9027
  const [showColors, setShowColors] = useState(false)
  const [showFilters, setShowFilters] = useState(false) // KAI-9124: standalone Filters takeover
  const editorPreRef = useRef<AppSnap | null>(null)
  const trimPreRef = useRef<AppSnap | null>(null)
  const filterPreRef = useRef<AppSnap | null>(null)

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
      if (editorSessionChanged({ committedShape: o.committedShape, bgBlur: o.bgBlur, imageFx: o.imageFx, artwork: o.artwork }, pre)) pushHistory(pre)
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
      if (filterSessionChanged({ imageFx: o.imageFx, bgBlur: o.bgBlur, wrapTile: o.wrapTile }, pre)) pushHistory(pre)
      filterPreRef.current = null
    }
    setShowFilters(false)
  }, [pushHistory])
  // Phase-2 Option A: close-only. The imageFx/bgBlur/wrapTile revert lives in FiltersSurface (Layer-3)
  // until Phase 6 binds the new UI to this session's revert (a behaviour relocation deferred with a live A/B).
  const cancelFilters = useCallback(() => { filterPreRef.current = null; setShowFilters(false) }, [])

  return {
    editingOutline, editorMode, showColors, showFilters,
    enterEditor, closeEditor, openTrim, closeTrim, cancelTrim, openFilters, closeFilters, cancelFilters,
  }
}
