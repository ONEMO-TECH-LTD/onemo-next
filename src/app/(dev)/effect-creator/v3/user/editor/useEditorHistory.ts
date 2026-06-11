// editor/useEditorHistory — the editor's geometry-state ENGINE (Run 2 · G6 decomposition, seam 3).
// ONE paired timeline {doc, vshape}: undo/redo restore both together, so a session mixing vector
// ops (vshape truth) and doc ops (tune/draw/non-vector chips) can never desync. Every apply is
// ONE history entry + ONE store persistence write (§6.3 commit discipline lives here).
// Blueprint: v3/blueprint/modules/editor.md (+ history.md).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { OutlineDocument, Vec2Px } from '@/lib/outline-core'
import { flattenShape, type VShape } from '@/lib/vector-core'
import { useOutlineStore } from '../outlineStore'
import { docFromRings } from './geometry'

export interface HistoryEntry {
  d: OutlineDocument
  v: VShape | null
}

export function useEditorHistory(seed: () => OutlineDocument) {
  const [doc, setDoc] = useState<OutlineDocument>(seed)
  const docRef = useRef(doc)
  useEffect(() => { docRef.current = doc }, [doc])
  // VECTOR CORE: when set, the VShape IS the geometry truth — the doc becomes a derived
  // interaction shadow. vBaseRef = the unfilleted base so Radius re-fillets from clean corners.
  const [vshape, setVShape] = useState<VShape | null>(null)
  const vshapeRef = useRef<VShape | null>(null)
  useEffect(() => { vshapeRef.current = vshape }, [vshape])
  const vBaseRef = useRef<VShape | null>(null)
  const histRef = useRef<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] })
  const [, bumpHist] = useState(0)

  /** polyline SHADOW of a VShape — feeds the doc-based interaction machinery (bbox/hit/grips). */
  const shadowDoc = useCallback((v: VShape, image?: OutlineDocument['image']): OutlineDocument => {
    const ring = flattenShape(v, 0.5)[0].map((p) => [p.x, p.y] as Vec2Px)
    return docFromRings(ring, image ?? docRef.current.image, 0, 1.5)
  }, [])

  const push = () => {
    histRef.current.past.push({ d: docRef.current, v: vshapeRef.current })
    if (histRef.current.past.length > 50) histRef.current.past.shift()
    histRef.current.future = []
  }

  /** REBUILD-PLAN-v2 §B2: doc-level edits no longer exist as a truth path. Every session is
   *  vector-seeded (truth at birth), so this is UNREACHABLE — it fails loud rather than silently
   *  re-entering the polyline model. Its dead callers are removed with the doc layer in P4. */
  const applyDocRaw = useCallback((_next: OutlineDocument) => {
    void _next
    throw new Error('applyDocRaw: the OutlineDocument edit path was removed (single geometry truth) — a doc-level commit is a bug')
  }, [])

  /** Vector-shape edit: ONE history entry + ONE store commit through THE single writer
   *  (commitGeometry derives the contour atomically — visible = committed, always). */
  const applyVec = useCallback((nextV: VShape, nextBase?: VShape | null) => {
    push()
    const sd = shadowDoc(nextV) // session-local interaction adapter — never persisted
    docRef.current = sd
    setDoc(sd)
    vshapeRef.current = nextV
    setVShape(nextV)
    if (nextBase !== undefined) vBaseRef.current = nextBase
    useOutlineStore.getState().commitGeometry(nextV)
    bumpHist((v) => v + 1)
  }, [shadowDoc])

  const restore = (entry: HistoryEntry) => {
    docRef.current = entry.d
    setDoc(entry.d)
    vshapeRef.current = entry.v
    setVShape(entry.v)
    useOutlineStore.getState().commitGeometry(entry.v)
    bumpHist((v) => v + 1)
  }

  /** Undo; returns the restored doc so the caller syncs tool state (null = nothing to undo). */
  const undoRaw = useCallback((): OutlineDocument | null => {
    const h = histRef.current
    if (!h.past.length) return null
    const prev = h.past.pop()!
    h.future.unshift({ d: docRef.current, v: vshapeRef.current })
    restore(prev)
    return prev.d
  }, [])

  /** Redo; returns the restored doc (null = nothing to redo). */
  const redoRaw = useCallback((): OutlineDocument | null => {
    const h = histRef.current
    if (!h.future.length) return null
    const next = h.future.shift()!
    h.past.push({ d: docRef.current, v: vshapeRef.current })
    restore(next)
    return next.d
  }, [])

  return { doc, setDoc, docRef, vshape, setVShape, vshapeRef, vBaseRef, histRef, shadowDoc, applyDocRaw, applyVec, undoRaw, redoRaw }
}
