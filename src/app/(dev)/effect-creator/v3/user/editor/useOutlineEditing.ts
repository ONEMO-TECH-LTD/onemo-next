// editor/useOutlineEditing — the editor's geometry-state ENGINE (V4, blueprint v4-foundation.md §2/§7).
//
// REPLACES the baked-VShape timeline (useEditorHistory). The truth is SOURCE + ADJUSTMENTS in the
// store; this hook owns the editor session over it: the live display (resolve), a transient preview
// for slider ticks (§6.3), the history stack (VD10 — snapshots of {source, adjustments}), and the
// three write verbs:
//   • applyAdjustments  — a TOOL edit (global slider / radius / curve): reversible, all-off = source.
//   • reBaseline        — a MANUAL op (drag / insert / delete / sharpen): bakes the resolved shape into
//                         a fresh immutable source (mintIds) with adjustments OFF, then is editable on.
//   • transformSource   — move / rotate / stretch: transforms the source vector (ids preserved, so the
//                         per-anchor adjustments survive the transform — VD9).
// No second geometry model, no shadow, no corner-pin. resolve() is the only path from truth → display.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { VShape } from '@/lib/vector-core'
import { transformShape, type Vec2 } from '@/lib/vector-core'
import { useOutlineStore } from '../outlineStore'
import { resolve, mintIds, ADJUSTMENTS_OFF, type OutlineAdjustments, type OutlineSource } from '@/lib/effect/outline-resolve'

export interface EditSnapshot { source: OutlineSource; adjustments: OutlineAdjustments }

const offAdj = (): OutlineAdjustments => ({ global: { ...ADJUSTMENTS_OFF.global }, local: {} })

export function useOutlineEditing() {
  const source = useOutlineStore((s) => s.source)
  const adjustments = useOutlineStore((s) => s.adjustments)
  // transient preview during a slider/handle drag — display reflects it; NOT committed, NOT historied.
  const [preview, setPreviewState] = useState<OutlineAdjustments | null>(null)
  const histRef = useRef<{ past: EditSnapshot[]; future: EditSnapshot[] }>({ past: [], future: [] })
  const [, bump] = useState(0)

  // the live display: resolve the source with the preview (if any) else the committed adjustments.
  const display: VShape | null = source ? resolve(source, preview ?? adjustments) : null
  // mirror the display into a ref for the gesture handlers (sync after commit, current for events).
  const displayRef = useRef<VShape | null>(display)
  useEffect(() => { displayRef.current = display }, [display])

  const pushHistory = useCallback(() => {
    const st = useOutlineStore.getState()
    if (st.source) {
      histRef.current.past.push({ source: st.source, adjustments: st.adjustments })
      if (histRef.current.past.length > 50) histRef.current.past.shift()
    }
    histRef.current.future = []
  }, [])

  /** Set the transient preview (slider/handle tick) — display re-resolves, store untouched. */
  const setPreview = useCallback((adj: OutlineAdjustments | null) => setPreviewState(adj), [])

  /** TOOL edit: commit new adjustments on the current source (push history + store). */
  const applyAdjustments = useCallback((adj: OutlineAdjustments) => {
    setPreviewState(null)
    pushHistory()
    useOutlineStore.getState().setAdjustments(adj)
    bump((n) => n + 1)
  }, [pushHistory])

  /** PRODUCER: install a brand-new source (Magic seed / stock / upload / drawn / Reset). adjustments
   *  default OFF (a fresh source shows verbatim). `pushPrior` = false for the session seed (not undoable). */
  const seedSource = useCallback((src: OutlineSource, adj?: OutlineAdjustments, pushPrior = true) => {
    if (pushPrior) pushHistory()
    useOutlineStore.getState().setSource(src, adj ?? offAdj())
    bump((n) => n + 1)
  }, [pushHistory])

  /** MANUAL op: bake the current resolved display through `op`, install it as a fresh source (mintIds),
   *  adjustments OFF. Use for drag / insert / delete / sharpen — anything that changes anchor topology. */
  const reBaseline = useCallback((op: (resolved: VShape) => VShape) => {
    const st = useOutlineStore.getState()
    if (!st.source) return
    const resolved = resolve(st.source, st.adjustments)
    const next = mintIds(op(resolved))
    pushHistory()
    st.setSource({ ...st.source, shape: next }, offAdj())
    bump((n) => n + 1)
  }, [pushHistory])

  /** MOVE / ROTATE / STRETCH: affine-transform the source (ids preserved → adjustments survive). */
  const transformSource = useCallback((fn: (p: Vec2) => Vec2) => {
    const st = useOutlineStore.getState()
    if (!st.source) return
    pushHistory()
    st.setSource({ ...st.source, shape: transformShape(st.source.shape, fn) }, st.adjustments)
    bump((n) => n + 1)
  }, [pushHistory])

  const restore = (snap: EditSnapshot) => {
    useOutlineStore.getState().setSource(snap.source, snap.adjustments)
    setPreviewState(null)
    bump((n) => n + 1)
  }
  const undo = useCallback((): boolean => {
    const h = histRef.current
    const st = useOutlineStore.getState()
    if (!h.past.length || !st.source) return false
    h.future.unshift({ source: st.source, adjustments: st.adjustments })
    restore(h.past.pop()!)
    return true
  }, [])
  const redo = useCallback((): boolean => {
    const h = histRef.current
    const st = useOutlineStore.getState()
    if (!h.future.length || !st.source) return false
    h.past.push({ source: st.source, adjustments: st.adjustments })
    restore(h.future.shift()!)
    return true
  }, [])

  return {
    source, adjustments, display, displayRef, preview,
    setPreview, applyAdjustments, seedSource, reBaseline, transformSource,
    undo, redo, histRef,
  }
}
