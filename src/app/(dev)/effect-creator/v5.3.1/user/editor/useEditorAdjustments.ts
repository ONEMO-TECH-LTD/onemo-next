'use client'

// editor/useEditorAdjustments.ts — ADJUSTMENT WRITERS (R8 — Creator v5 monolith split, seam 2).
//
// The editor's recipe writers: Radius / Curve (LOCAL, per stable SOURCE-anchor id, reversible, pinned
// through the global pass) + Simplify/Smooth/Straighten (GLOBAL 0..100 axes, DEC-v5-03) + the magic-blend
// (bgBlur). Each maps the current selection to SOURCE ids and either PREVIEWS (no commit/history) or
// COMMITS (applyAdjustments) onto outlineStore's source+adjustments truth — the resolver owns shaping;
// this hook never fairs/fits/repairs. Swap-test: replace this hook, the recipe-writing contract holds.

import { useCallback } from 'react'
import { useOutlineStore } from '../outlineStore'
import { perfGesture } from '../../dev/PerfHUD'
import type { GlobalAdjustments, LocalAdjustment, OutlineAdjustments } from '@/lib/effect/outline-resolve'
import type { VShape } from '@/lib/vector-core'

interface AdjustmentsCtx {
  /** the selected display-anchor index (null = whole-shape / none). */
  selVA: number | null
  /** ref to the resolved display VShape (the editor's working shape). */
  vshapeRef: { readonly current: VShape | null }
  applyAdjustments: (a: OutlineAdjustments) => void
  setPreviewAdj: (a: OutlineAdjustments | null) => void
  setBgBlur: (v: number | null) => void
  setRadius: (v: number) => void
  setCurveVal: (v: number) => void
  setAllSelected: (v: boolean) => void
}

export function useEditorAdjustments(ctx: AdjustmentsCtx) {
  const { selVA, vshapeRef, applyAdjustments, setPreviewAdj, setBgBlur, setRadius, setCurveVal, setAllSelected } = ctx

  // ── LOCAL adjustments (Radius / Curve) — keyed by STABLE source id (VD2/VD9), reversible (off →
  //    exact source corner), PINNED through any global pass. Edits ALWAYS map to a SOURCE id (the
  //    selected anchor's own id when present — a filleted corner carries its source id (F1) — else the
  //    NEAREST source anchor). So there is NO bake fallback and globals are never silently reset (F1).
  const sourceIdForSelection = useCallback((): string | null => {
    const disp = vshapeRef.current
    if (!disp || selVA === null) return null
    const a = disp.paths[0].anchors[selVA]
    if (!a) return null
    const src = useOutlineStore.getState().source
    if (!src) return null
    const ids = new Set<string>()
    src.shape.paths.forEach((p) => p.anchors.forEach((x) => { if (x.id) ids.add(x.id) }))
    if (a.id && ids.has(a.id)) return a.id // direct — source anchor, pinned anchor, or filleted carrying its id
    let best: string | null = null, bd = Infinity // transient faired anchor → nearest source id (stay on recipe)
    src.shape.paths.forEach((p) => p.anchors.forEach((x) => {
      if (!x.id) return
      const d = (x.p.x - a.p.x) ** 2 + (x.p.y - a.p.y) ** 2
      if (d < bd) { bd = d; best = x.id }
    }))
    return best
  }, [selVA, vshapeRef])

  /** write a local adjustment onto target source ids (preview or commit). */
  const writeLocal = useCallback((ids: string[], mut: LocalAdjustment, commit: boolean) => {
    if (!ids.length) return
    const adj = useOutlineStore.getState().adjustments
    const local = { ...adj.local }
    for (const id of ids) local[id] = { ...local[id], ...mut }
    const next = { global: adj.global, local }
    if (commit) applyAdjustments(next); else setPreviewAdj(next)
  }, [applyAdjustments, setPreviewAdj])

  // RADIUS — DEC-v5-03/04 DUAL-ENGINE, selection-routed. A SELECTED corner rounds alone via the Paper
  // single-segment plugin (LocalAdjustment.radius, pinned through the global pass). With NO selection the
  // WHOLE shape rounds via Clipper2 offset-round (the GLOBAL radius axis) — symmetric by construction, a
  // square at 100% → a circle (retires the old per-corner-orchestrated whole-shape round that left the
  // seam/right corner straight). 0 = sharp (off), reversible either way.
  const writeGlobalRadius = useCallback((v: number, commit: boolean) => {
    const adj = useOutlineStore.getState().adjustments
    const next = { global: { ...adj.global, radius: Math.max(0, v) }, local: adj.local }
    if (commit) applyAdjustments(next); else setPreviewAdj(next)
  }, [applyAdjustments, setPreviewAdj])
  const previewRadius = useCallback((v: number) => {
    setRadius(v)
    const sel = sourceIdForSelection()
    if (sel) writeLocal([sel], { radius: v }, false) // per-corner → Paper
    else writeGlobalRadius(v, false)                 // whole-shape → Clipper offset-round
  }, [writeLocal, writeGlobalRadius, sourceIdForSelection, setRadius])
  const commitRadius = useCallback((v: number) => {
    setRadius(v)
    const t0 = performance.now()
    const sel = sourceIdForSelection()
    if (sel) writeLocal([sel], { radius: v }, true)
    else writeGlobalRadius(v, true)
    perfGesture('round-commit', performance.now() - t0)
  }, [writeLocal, writeGlobalRadius, sourceIdForSelection, setRadius])
  // CURVE — bend anchors into tangent curves. L4 (Dan: "Curve is dead"): a SELECTED anchor bends
  // alone; with NO selection it bends EVERY anchor (whole-shape) — mirroring Radius, so Curve is
  // usable straight from Adjust without the hidden Points-select gate. 0 = straight (off), reversible.
  // A folded whole-shape bend can't commit — outlineStore is fail-closed (R9).
  const curveTargets = useCallback((): string[] => {
    const sel = sourceIdForSelection()
    if (sel) return [sel]
    const src = useOutlineStore.getState().source
    return src ? src.shape.paths.flatMap((p) => p.anchors.filter((a) => a.id).map((a) => a.id as string)) : []
  }, [sourceIdForSelection])
  const previewCurve = useCallback((v: number) => { setCurveVal(v); writeLocal(curveTargets(), { curve: (v / 100) * 2 }, false) }, [writeLocal, curveTargets, setCurveVal])
  const commitCurve = useCallback((v: number) => {
    setCurveVal(v)
    const t0 = performance.now()
    writeLocal(curveTargets(), { curve: (v / 100) * 2 }, true)
    perfGesture('curve-commit', performance.now() - t0)
  }, [writeLocal, curveTargets, setCurveVal])

  // "Magic blend" — the soft real-background blur composited behind the subject on the 3D front
  // texture. Edit-mode only; on/off + intensity. Writes bgBlur (0 = off/sharp · 0..1 = intensity).
  const writeBlend = useCallback((on: boolean, pct: number) => setBgBlur(on ? pct / 100 : 0), [setBgBlur])

  // ── GLOBAL adjustments (Simplify / Smooth / Straighten) — INDEPENDENT 0..100 axes written to
  //    adjustments.global, each a direct library op (DEC-v5-03). Slider ticks PREVIEW (the display
  //    re-resolves; no commit, no history); release COMMITS via applyAdjustments. Fold guard in resolve().
  const previewGlobal = useCallback((g: GlobalAdjustments) => {
    const t0 = performance.now()
    setPreviewAdj({ global: g, local: useOutlineStore.getState().adjustments.local })
    perfGesture('tune-tick', performance.now() - t0)
  }, [setPreviewAdj])
  const commitGlobal = useCallback((g: GlobalAdjustments) => {
    const t0 = performance.now()
    applyAdjustments({ global: g, local: useOutlineStore.getState().adjustments.local })
    setAllSelected(false)
    perfGesture('tune-commit', performance.now() - t0)
  }, [applyAdjustments, setAllSelected])

  return { sourceIdForSelection, writeLocal, previewRadius, commitRadius, previewCurve, commitCurve, writeBlend, previewGlobal, commitGlobal }
}
