'use client'

// editor/useEditor.ts — the COMPOSER + editor controller (Phase 4 step 6 · blueprint §4 / inv 30).
//
// A THIN composer over the present (runtime-enabled) descriptors → `{ state, actions }` the UI client binds.
// It is NOT a controller that *contains* the tools (that would be the monoblock §0 rejects): the per-tool
// logic lives in the descriptors; this assembles them + owns the cross-tool concerns a composer must:
//   • the editor SESSION (open-seed / discard / reset / spec-change re-seed) — re-homed from OutlineEditor.
//   • GENERIC per-tool/group session state (keyed in one record — expert §11.1; no picker-specific field, so
//     dropping a tool drops its state entry, no shared-controller residue).
//   • the F8-ordered engine bindings the descriptors call (EditorCtx) — commitAdjustments/reDeriveTrace/
//     installSource push editor-local history ONLY on {ok:true} (the 4 via useOutlineEditing 6a; reDeriveTrace
//     + installSource here are the 5th path).
// The gesture/canvas-interaction layer (useEditorGestures/useCanvasView) stays in the UI client, wired with
// the editing verbs this composer exposes. The descriptors never touch the store directly; the client only
// ever sees `state` + `actions` (Layer-2 boundary, inv 14/16).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TOOL_REGISTRY, isPickerDescriptor } from './descriptors'
import type { EditorCtx, ToolEnabled, PickerParams } from './descriptors/types'
import { useOutlineEditing } from './useOutlineEditing'
import { useOutlineStore, NEUTRAL_FX, INITIAL_ARTWORK, type ImageFx } from '../outlineStore'
import type { CommitResult } from '../outlineStore'
import { DEFAULT_SHAPE_PARAMS } from './shape-chips'
import { cornerRadiusAdjustments, representativeLocal } from './seed-defaults'
import { traceSourceFromRaw, offsetPctToMm } from './producers'
import { getShape } from '@/lib/shape-library'
import { mintIds, type OutlineSource, type OutlineAdjustments } from '@/lib/effect/outline-resolve'
import { type OffsetJoin } from '@/lib/effect/offset'
import type { VShape } from '@/lib/vector-core'
import type { Pt } from '@/lib/effect/types'
import type { DesignState } from '../../types'

export interface UseEditorArgs {
  open: boolean
  defaultBlurPct?: number
  onClose: () => void
  /** injected notification sink (the composer/descriptors never import toast — blueprint §4). */
  notify: (kind: 'warn' | 'error' | 'info', message: string) => void
}

/** Generic per-tool/group session state (expert §11.1): one record, keyed by a stable key. Removing a tool
 *  drops its key — no hardcoded per-tool field on the composer. `generation` is shared by detail+offset. */
interface GenParams { detail: number; offset: number; offsetJoin: OffsetJoin }

export function useEditor({ open, defaultBlurPct = 0, onClose, notify }: UseEditorArgs) {
  const ed = useOutlineEditing()
  const { source, adjustments, display, displayRef, setPreview: setPreviewAdj, applyAdjustments, seedSource, reBaseline, transformSource, undo: undoEdit, redo: redoEdit, histRef } = ed

  const spec = useOutlineStore((s) => s.spec)
  const setBgBlur = useOutlineStore((s) => s.setBgBlur)
  const setImageFx = useOutlineStore((s) => s.setImageFx)
  const setWrapTile = useOutlineStore((s) => s.setWrapTile)

  // ── interaction + per-tool session state (generic; the descriptors read truth via read(), these hold the
  //    bits NOT derivable from the store) ──
  const [selVA, setSelVA] = useState<number | null>(null)
  const [gen, setGen] = useState<GenParams>({ detail: 100, offset: 0, offsetJoin: 'sharp' })
  const genRef = useRef(gen); useEffect(() => { genRef.current = gen }, [gen])
  const [shapeParams, setShapeParams] = useState<PickerParams>({ ...DEFAULT_SHAPE_PARAMS })
  const shapeParamsRef = useRef(shapeParams); useEffect(() => { shapeParamsRef.current = shapeParams }, [shapeParams])
  const [shapeKind, setShapeKind] = useState<string | null>(null) // active picker chip (null = chips only)
  const [shapePreview, setShapePreview] = useState<string | null>(null) // generator morph ring `d` while a param ticks
  const picker = useMemo(() => TOOL_REGISTRY.find(isPickerDescriptor) ?? null, [])
  const [fxDraft, setFxDraft] = useState<ImageFx>(NEUTRAL_FX)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const confirmDiscardRef = useRef(confirmDiscard); useEffect(() => { confirmDiscardRef.current = confirmDiscard }, [confirmDiscard]) // F12: read fresh

  // session snapshots (re-homed from OutlineEditor)
  const preEditRef = useRef<{ source: OutlineSource | null; adjustments: OutlineAdjustments | null; bgBlur: number | null; imageFx: ImageFx | null; wrapTile: boolean; artwork: DesignState }>({ source: null, adjustments: null, bgBlur: null, imageFx: null, wrapTile: false, artwork: INITIAL_ARTWORK })
  const entryRef = useRef<{ source: OutlineSource | null; adjustments: OutlineAdjustments | null }>({ source: null, adjustments: null })
  const traceDragRef = useRef<{ source: OutlineSource | null; adjustments: OutlineAdjustments } | null>(null)

  // ── the editor's selection→source-id map (re-homed from useEditorAdjustments) ──
  const sourceIdForSelection = useCallback((): string | null => {
    const disp = displayRef.current
    if (!disp || selVA === null) return null
    const a = disp.paths[0].anchors[selVA]
    if (!a) return null
    const src = useOutlineStore.getState().source
    if (!src) return null
    const ids = new Set<string>()
    src.shape.paths.forEach((p) => p.anchors.forEach((x) => { if (x.id) ids.add(x.id) }))
    if (a.id && ids.has(a.id)) return a.id
    let best: string | null = null, bd = Infinity
    src.shape.paths.forEach((p) => p.anchors.forEach((x) => {
      if (!x.id) return
      const d = (x.p.x - a.p.x) ** 2 + (x.p.y - a.p.y) ** 2
      if (d < bd) { bd = d; best = x.id }
    }))
    return best
  }, [selVA, displayRef])

  // ── GENERATION re-derive (detail/offset) — the shared engine-binding (no AI re-run); the 5th F8 path:
  //    history pushes only on an accepted commit (re-homed from OutlineEditor.buildTraceSource/commitTrace). ──
  const buildTraceSource = useCallback((d: number, o: number, join: OffsetJoin): OutlineSource | null => {
    const sp = useOutlineStore.getState().spec
    const raw = sp?.rawTracePx as Pt[] | undefined
    if (!sp || !raw?.length) return null
    const offMaxMm = Math.max(sp.maskWidthPx, sp.maskHeightPx) * sp.mmPerPx
    const shape = traceSourceFromRaw(raw, sp.maskHeightPx, sp.mmPerPx, d, offsetPctToMm(o, offMaxMm), join)
    if (!shape) return null
    return { shape: mintIds(shape), klass: 'generated', mmPerPx: sp.mmPerPx, maskHeightPx: sp.maskHeightPx, rawTracePx: raw }
  }, [])

  const reDeriveTrace = useCallback((params: { detail?: number; offset?: number; offsetJoin?: OffsetJoin }, commit: boolean): CommitResult => {
    const next = { ...genRef.current, ...params }
    setGen(next)
    const built = buildTraceSource(next.detail, next.offset, next.offsetJoin)
    if (!built) return { ok: false, reason: 'no-trace' }
    const st = useOutlineStore.getState()
    if (!commit) {
      if (!traceDragRef.current) traceDragRef.current = { source: st.source, adjustments: st.adjustments }
      const r = st.setSource(built, { global: { ...st.adjustments.global }, local: {} }) // transient — no history
      if (r.ok) { setSelVA(null) }
      return r
    }
    // commit: ONE undo step for the whole drag, pushed only on an accepted commit (F8)
    const pre = traceDragRef.current ?? { source: st.source, adjustments: st.adjustments }
    traceDragRef.current = null
    const r = st.setSource(built, { global: { ...st.adjustments.global }, local: {} })
    if (r.ok) {
      if (pre.source) { histRef.current.past.push({ source: pre.source, adjustments: pre.adjustments }); if (histRef.current.past.length > 50) histRef.current.past.shift(); histRef.current.future = [] }
      setSelVA(null)
    }
    return r
  }, [buildTraceSource, histRef])

  // ── SHARED source-install (shape-pick + upload) — via the editing hook's history-aware seedSource (F8). ──
  const installSource = useCallback((src: OutlineSource, adj: OutlineAdjustments | undefined, commit: boolean): CommitResult => {
    const r = seedSource(src, adj, commit)
    if (r.ok) { setSelVA(null) }
    return r
  }, [seedSource])

  // ── the EditorCtx the descriptors call (Layer-2 internal — never handed to the UI). Rebuilt each render;
  //    every read goes through getState/refs so the descriptors always see fresh truth. ──
  const ctx: EditorCtx = useMemo(() => ({
    getSource: () => useOutlineStore.getState().source,
    getAdjustments: () => useOutlineStore.getState().adjustments,
    getSpec: () => useOutlineStore.getState().spec,
    getDisplay: () => displayRef.current,
    selVA,
    sourceIdForSelection,
    preview: (adj) => setPreviewAdj(adj),
    commitAdjustments: (adj) => applyAdjustments(adj),
    // image-fx: the editor wires preview→draft (CSS), commit→store (deferred bake on Done via the version-bridge)
    getImageFx: () => useOutlineStore.getState().imageFx ?? NEUTRAL_FX,
    previewImageFx: (next) => setFxDraft(next),
    commitImageFx: (next) => { setFxDraft(next); setImageFx(next) },
    getBgBlur: () => useOutlineStore.getState().bgBlur,
    setBgBlur: (v) => setBgBlur(v),
    getWrapTile: () => useOutlineStore.getState().wrapTile,
    setWrapTile: (v) => setWrapTile(v),
    getGenParams: () => genRef.current,
    reDeriveTrace,
    installSource,
    notify: (kind, message) => notify(kind, message),
  }), [selVA, sourceIdForSelection, setPreviewAdj, applyAdjustments, setImageFx, setBgBlur, setWrapTile, reDeriveTrace, installSource, displayRef, notify])

  // ── the descriptor-driven tool list (the runtime-disable filter + applies/read) ──
  const buildTools = useCallback((toolEnabled: ToolEnabled) =>
    TOOL_REGISTRY.filter((d) => toolEnabled(d.id)).map((d) => {
      if (isPickerDescriptor(d)) {
        // the picker entry carries DATA the Shape-outlet client renders (chips + the active kind's param specs +
        // the live params + the preview ring) — never the descriptor object (value-opaque; pixel 6b boundary).
        return {
          id: d.id, outlet: d.outlet, label: d.label, icon: d.icon, kind: 'picker' as const,
          available: true, control: undefined, value: undefined,
          picker: { chips: d.chips, activeKind: shapeKind, paramSpecs: shapeKind ? d.paramSpecs(shapeKind) : [], params: shapeParams, preview: shapePreview },
        }
      }
      return { id: d.id, outlet: d.outlet, label: d.label, icon: d.icon, kind: 'value' as const, control: d.control, available: d.applies ? d.applies(ctx) : true, value: d.read ? d.read(ctx) : undefined, picker: undefined }
    }), [ctx, shapeKind, shapeParams, shapePreview])

  // ── per-descriptor preview/commit (value tools) — the UI calls these by id; rollback on {ok:false} is the
  //    composer's job (re-resolve to truth → the next render's read() shows the rolled-back value). ──
  const previewTool = useCallback((id: string, v: unknown) => {
    const d = TOOL_REGISTRY.find((x) => x.id === id)
    if (!d || isPickerDescriptor(d)) return
    d.preview(v, ctx)
  }, [ctx])
  const commitTool = useCallback((id: string, v: unknown): CommitResult => {
    const d = TOOL_REGISTRY.find((x) => x.id === id)
    if (!d || isPickerDescriptor(d)) return { ok: false, reason: 'not-a-value-tool' }
    const r = d.commit(v, ctx)
    if (!r.ok) setPreviewAdj(null) // refused → drop the transient preview; truth stands, read() reflects it
    return r
  }, [ctx, setPreviewAdj])

  // ── picker actions (shape-pick) — drive the PickerDescriptor's interface; the picker owns the shape-build,
  //    the composer owns the session state (activeKind/params/preview) + the calls. Graceful if no picker
  //    (returns no-picker) so dropping shape-pick needs ZERO composer edit (the bundling test). ──
  const pickShape = useCallback((kind: string): CommitResult => {
    if (!picker) return { ok: false, reason: 'no-picker' }
    const { params, result } = picker.pick(kind, shapeParamsRef.current, ctx)
    setShapeParams(params); setShapeKind(kind); setShapePreview(null)
    return result
  }, [ctx, picker])
  /** stepper / slider-release: re-apply at an absolute param value (the client clamps per the spec). */
  const applyShapeParam = useCallback((key: string, value: number): CommitResult => {
    if (!picker || !shapeKind) return { ok: false, reason: 'no-picker' }
    const next = { ...shapeParamsRef.current, [key]: value }
    setShapeParams(next); setShapePreview(null)
    return picker.apply(shapeKind, next, ctx)
  }, [ctx, picker, shapeKind])
  /** slider tick: transient generator morph ring (no commit/history); commitShapeParam bakes on release. */
  const previewShapeParam = useCallback((key: string, value: number) => {
    if (!picker || !shapeKind) return
    const next = { ...shapeParamsRef.current, [key]: value }
    setShapeParams(next); setShapePreview(picker.previewRing(shapeKind, next, ctx))
  }, [ctx, picker, shapeKind])
  const commitShapeParam = useCallback((): CommitResult => {
    if (!picker || !shapeKind) return { ok: false, reason: 'no-picker' }
    setShapePreview(null)
    return picker.apply(shapeKind, shapeParamsRef.current, ctx)
  }, [ctx, picker, shapeKind])
  const rerollShape = useCallback((): CommitResult => {
    if (!picker || !shapeKind) return { ok: false, reason: 'no-picker' }
    const { params, result } = picker.reroll(shapeKind, shapeParamsRef.current, ctx)
    setShapeParams(params)
    return result
  }, [ctx, picker, shapeKind])
  const uploadShape = useCallback(async (file: File): Promise<CommitResult> => {
    if (!picker) return { ok: false, reason: 'no-picker' }
    const r = await picker.uploadShape(file, ctx)
    if (r.ok) { setShapeKind(null); setShapePreview(null) }
    return r
  }, [ctx, picker])

  // ── undo/redo: step the editor-local history, then resync the transient UI ──
  const syncSlidersTo = useCallback(() => { setSelVA(null) }, [])
  const undo = useCallback(() => { if (undoEdit()) syncSlidersTo() }, [undoEdit, syncSlidersTo])
  const redo = useCallback(() => { if (redoEdit()) syncSlidersTo() }, [redoEdit, syncSlidersTo])

  // ── session: open-seed (re-homed from OutlineEditor:216-292; trimmed to the composer's concerns) ──
  useEffect(() => {
    if (!open) return
    const st0 = useOutlineStore.getState()
    preEditRef.current = { source: st0.source, adjustments: st0.adjustments, bgBlur: st0.bgBlur, imageFx: st0.imageFx, wrapTile: st0.wrapTile, artwork: st0.artwork }
    st0.setEditorOpen(true)
    setSelVA(null); setGen({ detail: 100, offset: 0, offsetJoin: 'sharp' }); setConfirmDiscard(false); setShapeKind(null); setShapePreview(null)
    setFxDraft(st0.imageFx ?? NEUTRAL_FX)
    if (spec && !st0.source) {
      if (spec.generator.adapter !== 'standard') {
        seedSource({ shape: mintIds(spec.vectorShape), klass: 'generated', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx, rawTracePx: spec.rawTracePx as Pt[] | undefined }, undefined, false)
      } else {
        const base = mintIds(getShape('square', spec.maskWidthPx, spec.maskHeightPx))
        const side = Math.min(spec.maskWidthPx, spec.maskHeightPx) * 0.72
        const defaultR = Math.min(Math.round(8 / (spec.mmPerPx || 1)), Math.floor(side / 2))
        seedSource({ shape: base, klass: 'stock', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx }, cornerRadiusAdjustments(base, defaultR), false)
      }
    }
    const cur = useOutlineStore.getState()
    entryRef.current = { source: cur.source, adjustments: cur.adjustments }
    histRef.current = { past: [], future: [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // spec-change re-seed while open (re-homed from OutlineEditor:494-504)
  const lastSpecRef = useRef(spec)
  useEffect(() => {
    if (!open) { lastSpecRef.current = spec; return }
    if (spec === lastSpecRef.current) return
    lastSpecRef.current = spec
    if (!spec || spec.generator.adapter === 'standard') return
    seedSource({ shape: mintIds(spec.vectorShape), klass: 'generated', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx, rawTracePx: spec.rawTracePx as Pt[] | undefined })
    setSelVA(null); setGen({ detail: 100, offset: 0, offsetJoin: 'sharp' }); setShapePreview(null)
    const cur = useOutlineStore.getState()
    entryRef.current = { source: cur.source, adjustments: cur.adjustments }
  }, [spec, open, seedSource])

  const onReset = useCallback(() => {
    const e = entryRef.current
    if (!e.source) return
    seedSource(e.source, e.adjustments ?? undefined)
    setSelVA(null); setShapeKind(null); setShapePreview(null)
  }, [seedSource])

  const onDone = useCallback(() => {
    setSelVA(null)
    useOutlineStore.getState().setEditorOpen(false)
    onClose()
  }, [onClose])

  // F12: onCancel reads confirmDiscard via the ref (fresh) — the stale-closure bug fixed.
  const onCancel = useCallback((force = false) => {
    if (histRef.current.past.length > 0 && !confirmDiscardRef.current && !force) { setConfirmDiscard(true); return }
    setConfirmDiscard(false)
    const pe = preEditRef.current
    const st = useOutlineStore.getState()
    st.setSource(pe.source, pe.adjustments ?? undefined)
    if (st.bgBlur !== pe.bgBlur) st.setBgBlur(pe.bgBlur)
    st.setImageFx(pe.imageFx)
    if (st.wrapTile !== pe.wrapTile) st.setWrapTile(pe.wrapTile) // F3 (pixel): discard reverts Fill too
    st.setArtwork(pe.artwork)
    setSelVA(null)
    st.setEditorOpen(false)
    onClose()
  }, [onClose, histRef])

  const canUndo = histRef.current.past.length > 0
  const canRedo = histRef.current.future.length > 0

  // The UI client receives ONLY state + actions — never the raw EditorCtx or a descriptor object (Layer-2
  //  boundary, inv 14/16; pixel 6b). previewTool/commitTool/pickShape resolve the descriptor by id internally.
  return {
    state: {
      source, adjustments, display, selVA, gen, shapeParams, shapeKind, shapePreview, fxDraft, confirmDiscard,
      canUndo, canRedo, defaultBlurPct,
    },
    actions: {
      buildTools, previewTool, commitTool,
      pickShape, applyShapeParam, previewShapeParam, commitShapeParam, rerollShape, uploadShape,
      undo, redo, onReset, onDone, onCancel,
      setSelVA, setConfirmDiscard, setFxDraft, setShapeParams,
      // editor-op verbs the gesture/canvas client wires into useEditorGestures (Layer-2 editor actions, not raw ctx)
      reBaseline, transformSource, applyVec: (v: VShape) => reBaseline(() => v),
    },
  }
}
