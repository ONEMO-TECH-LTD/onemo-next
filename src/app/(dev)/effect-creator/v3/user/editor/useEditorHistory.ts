// editor/useEditorHistory — the editor's geometry-state ENGINE (REBUILD-PLAN-v2 §B2).
// ONE VShape timeline: the truth is the ONLY session geometry. Every apply is ONE history entry +
// ONE store commit through commitGeometry (the single writer) — visible = committed, always.
// No document, no shadow, no second model.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { VShape } from '@/lib/vector-core'
import type { FairTracedRingOpts } from '@/lib/outline-core'
import { useOutlineStore } from '../outlineStore'

/** Session dial state riding each entry (plan §B2.1 "+ session state") — KAI-8976/F4: undo must
 *  restore the readout that PRODUCED the restored shape, or the ruler lies about the screen. */
export interface HistoryMeta { detail: number; fairParams: FairTracedRingOpts }

export interface HistoryEntry {
  v: VShape
  meta?: HistoryMeta
  /** the shape's lineage at this point in time (KAI-9032) — restored with the shape */
  lineage?: 'trace' | 'vector'
}

export function useEditorHistory(captureMeta?: () => HistoryMeta) {
  // ref-stable capture: push/undo/redo stay dependency-free (their [] memoization is truthful)
  const captureMetaRef = useRef(captureMeta)
  useEffect(() => { captureMetaRef.current = captureMeta }, [captureMeta])
  const [vshape, setVShape] = useState<VShape | null>(null)
  const vshapeRef = useRef<VShape | null>(null)
  useEffect(() => { vshapeRef.current = vshape }, [vshape])
  // vBaseRef = the unfilleted base so Radius re-fillets from clean corners.
  const vBaseRef = useRef<VShape | null>(null)
  const histRef = useRef<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] })
  const [, bumpHist] = useState(0)

  const push = () => {
    if (vshapeRef.current) {
      histRef.current.past.push({ v: vshapeRef.current, meta: captureMetaRef.current?.(), lineage: useOutlineStore.getState().shapeLineage })
      if (histRef.current.past.length > 50) histRef.current.past.shift()
    }
    histRef.current.future = []
  }

  /** Vector edit: ONE history entry + ONE store commit (shape + derived contour, atomically).
   *  `lineage` marks shape identity changes (seed/pick/upload/reset); omitted = unchanged. */
  const applyVec = useCallback((nextV: VShape, nextBase?: VShape | null, lineage?: 'trace' | 'vector') => {
    push()
    vshapeRef.current = nextV
    setVShape(nextV)
    if (nextBase !== undefined) vBaseRef.current = nextBase
    useOutlineStore.getState().commitGeometry(nextV, lineage)
    bumpHist((n) => n + 1)
  }, [])

  const restore = (entry: HistoryEntry) => {
    vshapeRef.current = entry.v
    setVShape(entry.v)
    useOutlineStore.getState().commitGeometry(entry.v, entry.lineage)
    bumpHist((n) => n + 1)
  }

  /** Undo; returns the restored ENTRY (shape + its dial meta) so the caller syncs tool state. */
  const undoRaw = useCallback((): HistoryEntry | null => {
    const h = histRef.current
    if (!h.past.length || !vshapeRef.current) return null
    const prev = h.past.pop()!
    h.future.unshift({ v: vshapeRef.current, meta: captureMetaRef.current?.(), lineage: useOutlineStore.getState().shapeLineage })
    restore(prev)
    return prev
  }, [])

  /** Redo; returns the restored entry (null = nothing to redo). */
  const redoRaw = useCallback((): HistoryEntry | null => {
    const h = histRef.current
    if (!h.future.length || !vshapeRef.current) return null
    const next = h.future.shift()!
    h.past.push({ v: vshapeRef.current, meta: captureMetaRef.current?.(), lineage: useOutlineStore.getState().shapeLineage })
    restore(next)
    return next
  }, [])

  return { vshape, vshapeRef, vBaseRef, histRef, applyVec, undoRaw, redoRaw }
}
