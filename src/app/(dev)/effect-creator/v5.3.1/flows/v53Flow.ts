'use client'

// flows/v53Flow.ts — useV53Flow(): THE v53 FLOW (Creator v5.5 · blueprint §6 · inv 18 · KAI-9205).
//
// The current product behaviour as a thin COMPOSITION of the Layer-2 primitives + transaction services:
// upload → loadImage → prepareStandard → publishToViewer + runCutout(bg) → publishCutoutResult; Magic →
// prepareShaped(cached preseg) → publishToViewer → history.commit (blueprint §6). Formalized from the
// Phase-2 `useCreator` macro — the macro identity is retired; this IS the named, swappable flow. Returns the
// `CreatorFlow` surface (flow-contract.ts) the Layer-3 page binds to. A second flow (twoDFirstFlow) is a
// sibling compose-function in Phase 5 — "a new pipeline is a new compose-function, not a socket rewrite."
//
// THE SPLIT (not a clean lift) — the concerns that straddle the seam are INJECTED by the UI, never
// reached from inside the flow (blueprint §4, the five injected adapters):
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
import { INITIAL_ARTWORK, useOutlineStore } from '../user/outlineStore'
import { loadImage, prepareStandard, runCutout, prepareShaped, exportCutlineSvg } from '../core/primitives'
import { useViewerAdapter } from '../core/viewer-adapter'
import { useHistoryTransaction, useGenerationTask, useUploadPublish, useSessions, liteSpec } from '../core/transactions'
import type { CreatorAdapters, CreatorFlow } from './flow-contract'
import type { DesignState } from '../types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { MLResult } from '@/lib/effect/segment-ml'

// Notify + CreatorAdapters now live in flow-contract.ts (the named seam); the page imports them there.

export function useV53Flow(adapters: CreatorAdapters): CreatorFlow {
  const { notify, segPresent } = adapters
  // Layer-2a viewer adapter (inv 26): prepared-for-3D + publishToViewer + handleStatus live here, SPLIT
  // from prepared-for-editing (the `prepared` state below — drives the 2D editor + hasArtwork, never the 3D).
  const { preparedFor3D, publishToViewer, handleStatus } = useViewerAdapter(notify)

  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [prepared, setPrepared] = useState<PreparedEffect | null>(null) // prepared-for-editing (2D side)
  const [autoOutline, setAutoOutline] = useState(false) // false = standard square; true = Magic cut-out
  const [generating, setGenerating] = useState(false)
  // editingOutline / editorMode / showColors / showFilters are owned by the sessions transaction (below).

  const designState = useOutlineStore((s) => s.artwork) // #28: scene + editor share it
  const setDesignState = useCallback((upd: DesignState | ((prev: DesignState) => DesignState)) => {
    const st = useOutlineStore.getState()
    st.setArtwork(typeof upd === 'function' ? upd(st.artwork) : upd)
  }, [])
  const { colors, setBackColor } = useSceneStore()

  // refs — the flow-timing state the macro still owns (cut-out cache, upload/cancel tokens, session snaps).
  const sourceShaRef = useRef<string | null>(null)
  const cutCacheRef = useRef<{ url: string; promise: Promise<MLResult> } | null>(null)

  // Layer-2b history transaction (KAI-9222): the global undo/redo/reset machine + the F25 recipe/LRU/seg
  // caches — flow-timing state, NOT a primitive (inv 20). The macro COMPOSES it; restore drives the
  // injected setters + publishToViewer.
  const {
    canUndo, canRedo, dirty, undo, redo, reset,
    snapNow, pushHistory, setBaseline, registerGeneration, cacheSeg, getCachedSeg, patchGenMatte,
  } = useHistoryTransaction({ notify, autoOutline, designState, setPrepared, setAutoOutline, setDesignState, publishToViewer })

  // Layer-2b generation-cancel token (UX-5/KAI-9083) + the upload-publish seq-guard (publishCutoutResult)
  // — flow-timing services; publishCutoutResult composes the history's patchGenMatte.
  const { beginRun, isCurrent, cancel: cancelGeneration } = useGenerationTask()
  const { nextUploadSeq, publishCutoutResult } = useUploadPublish(patchGenMatte)
  // Layer-2b sessions (editor/trim/filter begin/commit/revert) — owns the overlay flags + pre-snapshots.
  const {
    editingOutline, editorMode, showColors, showFilters,
    enterEditor, closeEditor, openTrim, closeTrim, cancelTrim, openFilters, closeFilters, cancelFilters,
  } = useSessions({ snapNow, pushHistory, setBackColor })

  // Export — the mm-true SVG cutline from THE vector truth. The socket returns the STRING; the UI
  // performs the download (the injected export adapter). null = nothing/not-feasible (already notified).
  const exportSvg = useCallback(async (): Promise<string | null> => {
    const o = useOutlineStore.getState()
    const v = o.committedShape ?? o.spec?.vectorShape
    const sp = o.spec
    if (!v || !sp) { notify('warn', 'Nothing to export yet — add an image first'); return null }
    // Layer-2a `exportCutlineSvg` owns the feasibility gate + the mm-SVG (KAI-9077/MFG-1: never emit a
    // folded/uncuttable shape); the flow keeps the nothing-to-export check + notify (the injected adapter —
    // never inside a primitive, blueprint §4 / F4).
    const res = await exportCutlineSvg(v, { mmPerPx: sp.mmPerPx || 1, maskWidthPx: sp.maskWidthPx, maskHeightPx: sp.maskHeightPx })
    if (!res.ok) { notify('warn', `Can't export — the outline isn't cleanly cuttable (${res.detail}). Fix the shape first.`); return null }
    return res.svg
  }, [notify])

  // v5.3·P1 (KAI-9146): subject cut-out in the BACKGROUND once the instant square is up — cached per
  // image so Magic reuses it (instant), and the matte lights up Blend on any shape. `segPresent` (an
  // injected ?seg) selects the harness WebGPU path, so we SKIP the background run (Magic cuts on demand).
  // F25: the resolved seg is cached per url (segCacheRef) so a later shaped RE-DERIVE skips the ML step,
  // and the published matte is patched onto the standard generation's LRU entry (so undo restores it).
  const startBackgroundCutout = useCallback((url: string, standard: PreparedEffect, seq: number, genId: number) => {
    if (segPresent) return
    const segPromise = (async () => {
      const seg = await runCutout(url) // Layer-2a primitive: segmentation at the working-res cap (inv 19)
      cacheSeg(url, seg) // F25: cache for instant shaped re-derive on undo (history transaction owns the cache)
      await publishCutoutResult(seq, standard, genId, seg) // seq-guard at PUBLICATION: write the matte iff still active
      return seg
    })()
    cutCacheRef.current = { url, promise: segPromise }
    segPromise.catch((e) => {
      console.warn('[effect] background cut-out failed (Magic re-runs on demand):', e)
      if (cutCacheRef.current?.url === url) cutCacheRef.current = null
    })
  }, [segPresent, cacheSeg, publishCutoutResult])

  const upload = useCallback((file: File) => {
    // Layer-2a `loadImage` = validate + blob lifecycle ONLY (flow-blind). The app-state new-image reset
    // below stays in the flow (it sequences the stores/tokens — not a primitive's job).
    const loaded = loadImage(file, artworkUrl)
    if (!loaded) return
    const { url } = loaded
    sourceShaRef.current = null // identity captured later, at order/save
    setArtworkUrl(url)
    setDesignState(INITIAL_ARTWORK)
    setAutoOutline(false) // new image → the standard square; Magic opts into the cut-out
    const st = useOutlineStore.getState()
    st.commitGeometry(null); st.setBgBlur(null); st.setSubjMatteUrl(null)
    const seq = nextUploadSeq()
    cutCacheRef.current = null
    cancelGeneration() // KAI-9083: a new image supersedes any in-flight Magic
    setGenerating(false)
    prepareStandard(url) // Layer-2a primitive: the instant square at the display cap (no 3D, no cut-out)
      .then((p) => {
        setPrepared(p)
        publishToViewer(p) // v53Flow publishes 3D immediately; twoDFirstFlow would defer this to editor SAVE
        useOutlineStore.getState().setSpec(p.spec)
        const genId = registerGeneration(p, { url, mode: 'standard' }, null)
        setBaseline({ // installs the baseline + clears history (the history transaction owns the stack)
          genId, recipe: { url, mode: 'standard' }, autoOutline: false, designState: INITIAL_ARTWORK,
          imageFx: null, wrapTile: false,
          outline: { spec: liteSpec(p.spec), committedShape: null, source: null, adjustments: { global: { simplify: 0, smooth: 0, straighten: 0, radius: 0 }, local: {} }, bgBlur: null },
          trim: { ...useSceneStore.getState().colors },
        })
        startBackgroundCutout(url, p, seq, genId)
      })
      .catch((e) => {
        console.warn('[effect] prepare (standard) failed:', e)
        notify('error', `Couldn't build the square: ${(e as Error)?.message ?? e}`)
      })
  }, [artworkUrl, startBackgroundCutout, registerGeneration, setBaseline, setDesignState, notify, publishToViewer, nextUploadSeq, cancelGeneration])

  // handleStatus now lives in the viewer-adapter (the 3D status/error channel — inv 26 split).

  // Magic — re-prepare as a SHAPED subject cut-out (BEN in the worker; morphs in place, no jump).
  const magic = useCallback(() => {
    if (!artworkUrl || generating) return
    const preMagic = snapNow() // #23: one Magic = one global undo step (pushed only on success)
    const runId = beginRun()
    setGenerating(true)
    ;(async (): Promise<PreparedEffect> => {
      // preseg resolution is flow-timing (cutCache/segCache are flow caches, not primitive state): reuse
      // the upload-time background cut (instant Magic), else the resolved-seg cache; else prepareShaped
      // segments internally at the cap with the G4 flood-fill fallback (Option A — behaviour-identical).
      let preseg: MLResult | undefined
      const cache = cutCacheRef.current
      if (cache && cache.url === artworkUrl) {
        try { preseg = await cache.promise } catch { preseg = undefined }
      }
      if (!preseg) preseg = getCachedSeg(artworkUrl)
      return prepareShaped(artworkUrl, preseg, (s) => {
        if (s === 'fallback') notify('warn', 'AI cut-out unavailable — used the simple background cut instead') // G4
      })
    })()
      .then((p) => {
        if (!isCurrent(runId)) return // cancelled mid-run — prior state stands (UX-5)
        if (sourceShaRef.current) p.spec.sourceBytesSha256 = sourceShaRef.current
        setPrepared(p)
        publishToViewer(p)
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
        if (!isCurrent(runId)) return // cancelled — stay quiet
        console.warn('[effect] prepare (shaped) failed:', e)
        notify('error', `Magic failed: ${(e as Error)?.message ?? e}`) // G4
        setGenerating(false)
      })
  }, [artworkUrl, generating, snapNow, pushHistory, registerGeneration, getCachedSeg, beginRun, isCurrent, notify, publishToViewer])

  /** Cancel an in-flight Magic (UX-5): bump the generation token so a stale result/error is a no-op. */
  const cancelMagic = useCallback(() => { cancelGeneration(); setGenerating(false) }, [cancelGeneration])

  // Editor / Trim / Filter SESSIONS (enterEditor/closeEditor, open/close/cancel Trim + Filters) are owned
  // by the sessions transaction (useSessions, above) — destructured into { state, actions } below.

  return {
    state: {
      artworkUrl, prepared, preparedFor3D, editingOutline, editorMode, autoOutline, generating,
      showColors, showFilters, designState, colors,
      canUndo, canRedo, dirty,
      hasArtwork: !!prepared,
    },
    actions: {
      upload, magic, cancelMagic, undo, redo, reset,
      enterEditor, closeEditor, exportSvg, handleStatus,
      setBackColor, openTrim, closeTrim, cancelTrim, openFilters, closeFilters, cancelFilters,
    },
  }
}
