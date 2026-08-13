'use client'

// flows/twoDFirstFlow.ts — useTwoDFirstFlow(): THE 2D-FIRST FLOW (Creator v5.5 · blueprint §6 · inv 18/26 ·
// ADR-S58-CREATE-3D-02 · ADR-S58-CREATE-BLEND-01 · KAI-9282).
//
// A SIBLING compose-function to v53Flow — the SAME Layer-2 primitives + transaction services + viewer
// adapter, re-sequenced into Dan's 2D-PRIMARY pipeline (inv 18: a new pipeline is a new compose-function,
// ZERO engine/primitive/service/descriptor change). The delta from v53Flow:
//   • upload: NO publishToViewer + NO background cut-out → loadImage → prepareStandard → 2D editor live
//             (light by construction; no ML model, no 3D scene). Auto-enters the editor (Create Studio = the
//             editor; Dan 2026-06-28).
//   • cut-out DEFERRED, under the hood:
//       – Magic       → prepareShaped (reshape, drops edits) — same as v53 MINUS its publishToViewer.
//       – first-blur  → runCutout → cacheSeg → a stale-guarded matte write (MATTE ONLY; background blur;
//                       current shape PRESERVED; ADR-BLEND-01). A bgBlur watcher fires it once (latch on the matte).
//   • editor Done = commitSession('editor') = save + stay 2D — NO publish (Done never mounts 3D).
//   • previewIn3D() = the SOLE 3D publish — publishToViewer(prepared) on a deliberate preview; exitPreview()
//                     tears it down (modal; not kept warm). 3D is NOT history-driven → a NO-OP publisher is
//                     injected into useHistoryTransaction, so undo/redo/reset never mount 3D (restoreSnap:202
//                     becomes a no-op here).
//
// The CONTRACT is the same { state, actions } seam as v53Flow's CreatorFlow, EXTENDED in-envelope with
// state.previewing3D + actions.previewIn3D()/exitPreview() (TwoDFirstFlow below) — the divergence the
// flow-contract header sanctions (a sibling flow may carry its own surface). The UI binds only { state, actions }.

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSceneStore } from '../admin/sceneStore'
import { INITIAL_ARTWORK, useOutlineStore } from '../user/outlineStore'
import { loadImage, prepareStandard, runCutout, prepareShaped, exportCutlineSvg } from '../core/primitives'
import { useViewerAdapter } from '../core/viewer-adapter'
import { useHistoryTransaction, useGenerationTask, useSessions, liteSpec } from '../core/transactions'
import type { CreatorAdapters, CreatorFlowState, CreatorFlowActions } from './flow-contract'
import type { DesignState } from '../types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import { cancelSegmentML, disposeSegmentML, type MLResult } from '@/lib/effect/segment-ml'

/** The 2D-first flow's surface — the SAME { state, actions } envelope as CreatorFlow, extended IN-envelope
 *  (never top-level extras, so the UI's single binding surface holds): previewing3D in state; previewIn3D /
 *  exitPreview in actions. inv 18: a sibling flow may carry its own surface (flow-contract.ts header). */
export interface TwoDFirstFlow {
  state: CreatorFlowState & { previewing3D: boolean }
  actions: CreatorFlowActions & { previewIn3D: () => void; exitPreview: () => void }
}

export function useTwoDFirstFlow(adapters: CreatorAdapters): TwoDFirstFlow {
  const { notify } = adapters
  // Layer-2a viewer adapter (inv 26): the real publishToViewer is the SOLE 3D publish, driven ONLY by
  // previewIn3D below. prepared-for-3D is split from prepared-for-editing (the `prepared` state).
  const { preparedFor3D, publishToViewer, handleStatus } = useViewerAdapter(notify)

  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [prepared, setPrepared] = useState<PreparedEffect | null>(null) // prepared-for-editing (2D side)
  const [autoOutline, setAutoOutline] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewing3D, setPreviewing3D] = useState(false) // 2D-first: 3D mounted ONLY while a preview is active

  const designState = useOutlineStore((s) => s.artwork)
  // 2D-first: the flow watches the MODEL's bgBlur (engine/app state, not a UI widget — blueprint §0.9 / inv 25)
  // to fire the first-blur cut-out; subjMatteUrl is the latch (a matte exists → never re-run).
  const bgBlur = useOutlineStore((s) => s.bgBlur)
  const subjMatteUrl = useOutlineStore((s) => s.subjMatteUrl)
  const setDesignState = useCallback((upd: DesignState | ((prev: DesignState) => DesignState)) => {
    const st = useOutlineStore.getState()
    st.setArtwork(typeof upd === 'function' ? upd(st.artwork) : upd)
  }, [])
  const { colors, setBackColor } = useSceneStore()

  const sourceShaRef = useRef<string | null>(null)
  const firstBlurRunningRef = useRef(false) // in-flight guard for the deferred matte cut-out
  const detectorGenRef = useRef(0)

  // Layer-2b history transaction. 2D-first injects a NO-OP publisher (restoreSnap:202 → no-op): 3D is NOT
  // history-driven; undo/redo/reset never mount 3D. (publishToViewer above stays the SOLE preview publish.)
  const noopPublish = useCallback(() => {}, [])
  const {
    canUndo, canRedo, dirty, undo, redo, reset,
    snapNow, pushHistory, setBaseline, registerGeneration, cacheSeg, getCachedSeg, patchGenMatte,
  } = useHistoryTransaction({ notify, autoOutline, designState, setPrepared, setAutoOutline, setDesignState, publishToViewer: noopPublish })

  const { beginRun, isCurrent, cancel: cancelGeneration } = useGenerationTask()
  const { sessions, editorMode, beginSession, commitSession, revertSession } = useSessions({ snapNow, pushHistory, setBackColor })

  // Export — identical to v53 (the socket returns the SVG string; the UI writes the file).
  const exportSvg = useCallback(async (): Promise<string | null> => {
    const o = useOutlineStore.getState()
    const v = o.committedShape ?? o.spec?.vectorShape
    const sp = o.spec
    if (!v || !sp) { notify('warn', 'Nothing to export yet — add an image first'); return null }
    const res = await exportCutlineSvg(v, { mmPerPx: sp.mmPerPx || 1, maskWidthPx: sp.maskWidthPx, maskHeightPx: sp.maskHeightPx })
    if (!res.ok) { notify('warn', `Can't export — the outline isn't cleanly cuttable (${res.detail}). Fix the shape first.`); return null }
    return res.svg
  }, [notify])

  // upload — 2D-first: light by construction. loadImage → prepareStandard → 2D editor live. NO publishToViewer
  // (no 3D at upload), NO background cut-out (deferred to Magic / first-blur). Auto-enters the editor.
  const upload = useCallback((file: File) => {
    const loaded = loadImage(file, artworkUrl)
    if (!loaded) return
    const { url } = loaded
    sourceShaRef.current = null
    setArtworkUrl(url)
    setDesignState(INITIAL_ARTWORK)
    setAutoOutline(false)
    const st = useOutlineStore.getState()
    st.commitGeometry(null); st.setBgBlur(null); st.setSubjMatteUrl(null)
    detectorGenRef.current++
    firstBlurRunningRef.current = false
    cancelGeneration()
    cancelSegmentML()
    setGenerating(false)
    // 2D-first: leaving a stale preview must not survive a new upload.
    if (previewing3D) { publishToViewer(null); setPreviewing3D(false) }
    prepareStandard(url) // Layer-2a primitive: the instant square at the display cap (NO 3D, NO cut-out)
      .then((p) => {
        setPrepared(p)
        // (2D-first) NO publishToViewer here — 3D is deferred to a deliberate previewIn3D().
        useOutlineStore.getState().setSpec(p.spec)
        const genId = registerGeneration(p, { url, mode: 'standard' }, null)
        setBaseline({
          genId, recipe: { url, mode: 'standard' }, autoOutline: false, designState: INITIAL_ARTWORK,
          imageFx: null, wrapTile: false,
          outline: { spec: liteSpec(p.spec), committedShape: null, source: null, adjustments: { global: { simplify: 0, smooth: 0, straighten: 0, radius: 0 }, local: {} }, bgBlur: null },
          trim: { ...useSceneStore.getState().colors },
        })
        // (2D-first) NO startBackgroundCutout — the editor is the surface; cut-out runs on Magic / first-blur.
        beginSession('editor', null) // Create Studio = the editor: live at upload (Dan 2026-06-28).
      })
      .catch((e) => {
        console.warn('[effect] prepare (standard) failed:', e)
        notify('error', `Couldn't build the square: ${(e as Error)?.message ?? e}`)
      })
  }, [artworkUrl, registerGeneration, setBaseline, setDesignState, notify, cancelGeneration, beginSession, previewing3D, publishToViewer])

  // first-blur matte watcher (ADR-BLEND-01) — Blend is a BACKGROUND blur: it needs the subject matte to hold
  // the front sharp. The descriptors are flow-blind (blend.ts only setBgBlur), so the FLOW produces the matte:
  // on the first non-zero blur with NO matte yet, run the cut-out for the MATTE ONLY (shape preserved). Latch
  // on subjMatteUrl. genId is derived LIVE from snapNow() (correct through undo/reset — no drifting ref).
  useEffect(() => {
    if (!artworkUrl || !prepared) return
    if (bgBlur == null || bgBlur <= 0) return // first non-zero blur only
    if (subjMatteUrl) return                   // latch: a matte already exists (Magic or a prior first-blur)
    if (firstBlurRunningRef.current) return
    const snap = snapNow()
    if (snap.genId < 0) return // no generation yet (pixel impl-watch: gate on snapNow().genId, not a flow ref)
    const genId = snap.genId
    const detectorGen = ++detectorGenRef.current
    const std = prepared
    firstBlurRunningRef.current = true
    ;(async () => {
      try {
        const seg = await runCutout(artworkUrl) // Layer-2a primitive — AI cut at the working-res cap (seconds)
        cacheSeg(artworkUrl, seg)               // mirror v53: cache the seg (undo/rederive); valid for this url regardless
        // matte-only publish, GUARDED immediately before the mutation (pixel QA — stale-current). The long
        // runCutout await — and the dynamic import below — may have been superseded by Magic/undo/reset/blur-off;
        // build the matte, then re-read LIVE state with NO await before setSubjMatteUrl. A genId change also
        // covers a new upload (registerGeneration bumps it). Mirrors publishCutoutResult (transactions.ts:299-312)
        // but adds the current-gen/latch/blur guard the seq-only service guard lacks — net-new flow, no service edit.
        const { subjectMatteFromSeg } = await import('@/lib/effect/prepare-effect')
        const matteUrl = subjectMatteFromSeg(std.frontSrc.origCanvas, seg).toDataURL()
        const cur = snapNow()
        const st = useOutlineStore.getState()
        if (detectorGenRef.current !== detectorGen || cur.genId !== genId || st.subjMatteUrl || st.bgBlur == null || st.bgBlur <= 0) return // superseded — drop
        st.setSubjMatteUrl(matteUrl)   // matte ONLY — shape/spec/source untouched (ADR-S58-CREATE-BLEND-01)
        patchGenMatte(genId, matteUrl) // patch onto the (still-current) generation's LRU so undo restores it
      } catch (e) {
        // ADR-BLEND-01: no clear subject (degenerate matte throws the worker chain) → loud message, never a
        // silent broken whole-image blur; reset the control so there's no latent nonzero blur. (finger-trace
        // assist + the precise model-unavailable distinction are parked — Dan: "this can be done later".)
        console.warn('[effect] first-blur cut-out failed:', e)
        // stale-current guard on the REJECT path too (pixel QA): a superseded run (Magic/undo/reset/new upload,
        // or a fresh blur attempt) must NOT warn or reset the CURRENT generation's blur. Re-read live state;
        // only warn/reset if THIS run is still the current, matte-less, blur-on generation. No await before setBgBlur.
        const cur = snapNow()
        const st = useOutlineStore.getState()
        if (detectorGenRef.current !== detectorGen || cur.genId !== genId || st.subjMatteUrl || st.bgBlur == null || st.bgBlur <= 0) return // superseded — stay silent
        notify('warn', 'No clear subject found — turn blur off, or try an image with a clearer subject.')
        st.setBgBlur(0)
      } finally {
        if (detectorGenRef.current === detectorGen) firstBlurRunningRef.current = false
      }
    })()
  }, [bgBlur, subjMatteUrl, artworkUrl, prepared, snapNow, cacheSeg, patchGenMatte, notify])

  // Magic — re-prepare as a SHAPED subject cut-out (reshape + drops edits). Same as v53 MINUS publishToViewer
  // (Magic reshapes the 2D; it never mounts 3D in 2D-first).
  const magic = useCallback(() => {
    if (!artworkUrl || generating) return
    const preMagic = snapNow()
    const runId = beginRun()
    setGenerating(true)
    ;(async (): Promise<PreparedEffect> => {
      // no upload-bg pre-cut in 2D-first; reuse a resolved-seg cache if present, else prepareShaped segments
      // on demand (the optional-preseg path — behaviour-identical; the expert/pixel-verified resolution).
      const preseg: MLResult | undefined = getCachedSeg(artworkUrl)
      return prepareShaped(artworkUrl, preseg, (s) => {
        if (s === 'fallback') notify('warn', 'AI cut-out unavailable — used the simple background cut instead')
      })
    })()
      .then((p) => {
        if (!isCurrent(runId)) return
        if (sourceShaRef.current) p.spec.sourceBytesSha256 = sourceShaRef.current
        setPrepared(p)
        // (2D-first) NO publishToViewer — Magic reshapes the 2D editor; 3D stays deferred to previewIn3D().
        const st = useOutlineStore.getState()
        st.setSpec(p.spec)
        st.commitGeometry(null); st.setBgBlur(null) // fresh cut-out → drop prior edits
        let matteUrl: string | null = null
        try { matteUrl = p.frontSrc.subjCanvas.toDataURL() } catch { matteUrl = null }
        st.setSubjMatteUrl(matteUrl) // Magic sets the matte → a later first-blur correctly no-ops (latch)
        registerGeneration(p, { url: artworkUrl, mode: 'shaped' }, matteUrl)
        setAutoOutline(true)
        setGenerating(false)
        pushHistory(preMagic)
      })
      .catch((e) => {
        if (!isCurrent(runId)) return
        console.warn('[effect] prepare (shaped) failed:', e)
        notify('error', `Magic failed: ${(e as Error)?.message ?? e}`)
        setGenerating(false)
      })
  }, [artworkUrl, generating, snapNow, pushHistory, registerGeneration, getCachedSeg, beginRun, isCurrent, notify])

  const cancelMagic = useCallback(() => {
    cancelGeneration()
    detectorGenRef.current++
    firstBlurRunningRef.current = false
    cancelSegmentML()
    setGenerating(false)
  }, [cancelGeneration])

  useEffect(() => () => {
    cancelGeneration()
    detectorGenRef.current++
    firstBlurRunningRef.current = false
    disposeSegmentML()
  }, [cancelGeneration])

  // previewIn3D() — the SOLE 3D publish (ADR-S58-CREATE-3D-02). Assembles the 3D from the CURRENT spec on
  // demand (the viewer reads the edited committedContourMM from the store via ShapedModelBridge), the user
  // waits. Modal: exitPreview tears it down (not kept warm) → every preview is fresh; no stale-3D in Phase 5.
  const previewIn3D = useCallback(() => {
    if (!prepared) { notify('warn', 'Add an image first'); return }
    publishToViewer(prepared)
    setPreviewing3D(true)
  }, [prepared, publishToViewer, notify])
  const exitPreview = useCallback(() => {
    publishToViewer(null)
    setPreviewing3D(false)
  }, [publishToViewer])

  return {
    state: {
      artworkUrl, prepared, preparedFor3D, sessions, editorMode, autoOutline, generating,
      designState, colors,
      canUndo, canRedo, dirty,
      hasArtwork: !!prepared,
      previewing3D,
    },
    actions: {
      upload, magic, cancelMagic, undo, redo, reset,
      beginSession, commitSession, revertSession, exportSvg, handleStatus,
      setBackColor,
      previewIn3D, exitPreview,
    },
  }
}
