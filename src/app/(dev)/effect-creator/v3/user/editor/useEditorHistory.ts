// editor/useEditorHistory — the editor's geometry-state ENGINE (REBUILD-PLAN-v2 §B2).
// ONE VShape timeline: the truth is the ONLY session geometry. Every apply is ONE history entry +
// ONE store commit through commitGeometry (the single writer) — visible = committed, always.
// No document, no shadow, no second model.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { VShape } from '@/lib/vector-core'
import { useOutlineStore } from '../outlineStore'

export interface HistoryEntry {
  v: VShape
}

export function useEditorHistory() {
  const [vshape, setVShape] = useState<VShape | null>(null)
  const vshapeRef = useRef<VShape | null>(null)
  useEffect(() => { vshapeRef.current = vshape }, [vshape])
  // vBaseRef = the unfilleted base so Radius re-fillets from clean corners.
  const vBaseRef = useRef<VShape | null>(null)
  const histRef = useRef<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] })
  const [, bumpHist] = useState(0)

  const push = () => {
    if (vshapeRef.current) {
      histRef.current.past.push({ v: vshapeRef.current })
      if (histRef.current.past.length > 50) histRef.current.past.shift()
    }
    histRef.current.future = []
  }

  /** Vector edit: ONE history entry + ONE store commit (shape + derived contour, atomically). */
  const applyVec = useCallback((nextV: VShape, nextBase?: VShape | null) => {
    push()
    vshapeRef.current = nextV
    setVShape(nextV)
    if (nextBase !== undefined) vBaseRef.current = nextBase
    useOutlineStore.getState().commitGeometry(nextV)
    bumpHist((n) => n + 1)
  }, [])

  const restore = (entry: HistoryEntry) => {
    vshapeRef.current = entry.v
    setVShape(entry.v)
    useOutlineStore.getState().commitGeometry(entry.v)
    bumpHist((n) => n + 1)
  }

  /** Undo; returns the restored shape so the caller syncs tool state (null = nothing to undo). */
  const undoRaw = useCallback((): VShape | null => {
    const h = histRef.current
    if (!h.past.length || !vshapeRef.current) return null
    const prev = h.past.pop()!
    h.future.unshift({ v: vshapeRef.current })
    restore(prev)
    return prev.v
  }, [])

  /** Redo; returns the restored shape (null = nothing to redo). */
  const redoRaw = useCallback((): VShape | null => {
    const h = histRef.current
    if (!h.future.length || !vshapeRef.current) return null
    const next = h.future.shift()!
    h.past.push({ v: vshapeRef.current })
    restore(next)
    return next.v
  }, [])

  return { vshape, vshapeRef, vBaseRef, histRef, applyVec, undoRaw, redoRaw }
}
