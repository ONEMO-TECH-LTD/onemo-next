// adapters/libraryViewModel.ts — the Library tab's engine picture, requested by the shell (T2).
// The one measurement moved here from page.tsx (08fd49e7): the legal area of a canon record, drawn so
// its legal box is checkable by eye. The engine measures; this adapter only asks and hands it on.

import type { Contour, SafeSegment } from '../types'
import { safeSegments, spotRadiusOf } from '../grid-magnet'
import { RELEASED_PADDING_MM } from '../grid-magnet-spec'

/** MEASURED ONCE PER RECORD. A published record's legal area is a fixed fact, but the field that
 *  measures it is the solver's own 2mm clearance mesh — 85–175 ms a record — and it was re-run on
 *  every click, including band clicks that left the same record on the canvas (Dan, 2026-09-07:
 *  "these are precomputed must be instant"). Keyed by the outline itself, so a draft being edited is
 *  a different record and a band chip that changes nothing is a hit. */
const measured = new Map<string, SafeSegment[]>()
const KEEP = 256
const keyOf = (contour: Contour): string =>
  contour.outer.pts.map((p) => p[0] + ',' + p[1]).join(';')
  + '|' + contour.holes.map((h) => h.pts.map((p) => p[0] + ',' + p[1]).join(';')).join('#')

export function librarySegments(stage: { contour: Contour }): SafeSegment[] {
  const key = keyOf(stage.contour)
  const hit = measured.get(key)
  if (hit) return hit
  const segs = safeSegments(stage.contour, spotRadiusOf(RELEASED_PADDING_MM), 'full')
  if (measured.size >= KEEP) measured.delete(measured.keys().next().value!)
  measured.set(key, segs)
  return segs
}

/** Measure a class's records ahead of the click, one per idle slice, so the first visit is a hit
 *  too. Returns the cancel; a class switch mid-warm stops the old list rather than finishing it. */
export function warmLibrarySegments(contours: readonly Contour[]): () => void {
  let i = 0, handle: ReturnType<typeof setTimeout> | number | null = null
  const idle = typeof requestIdleCallback === 'function'
    ? (f: () => void) => requestIdleCallback(() => f(), { timeout: 250 })
    : (f: () => void) => setTimeout(f, 16)
  const step = () => {
    while (i < contours.length && measured.has(keyOf(contours[i]))) i++
    if (i >= contours.length) { handle = null; return }
    librarySegments({ contour: contours[i++] })
    handle = idle(step)
  }
  handle = idle(step)
  return () => {
    if (handle === null) return
    if (typeof cancelIdleCallback === 'function' && typeof handle === 'number') cancelIdleCallback(handle)
    else clearTimeout(handle as ReturnType<typeof setTimeout>)
    handle = null
  }
}
