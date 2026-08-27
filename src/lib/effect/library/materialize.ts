// library/materialize.ts — FROM A SELECTION TO GEOMETRY. The library produces the finished
// record: which magnets, where, in millimetres, and the outline around them. The engine bridge
// receives that record and converts it into engine types — it does not select, materialise,
// derive an outline, or decide what to do when a population is not yet a shape.
//
// Dan, 08-26: "separation of UI clean shell and logic and spec must be followed as in the
// fucking bench". This is the producer side of that seam.

import { outlineFromLayout } from './outline'
import { boundsMM, placeMM } from './geometry'
import { resolveSelection, type ResolvedSelection } from './selection'
import { frameKeyOf } from './transforms'
import type { LibrarySelection, PointMM } from './types'

/** WHAT A SELECTION IS, once resolved: stable identity, truthful frame identity after the view
 *  transform, magnet positions and the outline that wraps them. Millimetres, y UP. */
export interface MaterializedLibrary {
  classId: string
  /** The canonical frame the selection named. */
  sourceFrameKey: string
  /** The ACTUAL frame identity after the view transform — what the pipeline must believe. */
  frameKey: string
  frameCols: number
  frameRows: number
  layoutId: string
  nodesMM: readonly PointMM[]
  outlineMM: readonly PointMM[]
  widthMM: number
  heightMM: number
  /** Why the population being drawn is not a shape yet — null when it is. */
  error: string | null
  /** Where to look when nothing is drawn yet: the selected layout's own first magnet, so an
   *  empty canvas opens where the magnets the admin just saw were, not at the mm origin. */
  seedMM: PointMM | null
}

/** A corpus selection, materialised. Throws on an unknown id — stable IDs exist so that a stale
 *  identity cannot silently retarget to unrelated data (QA F3). */
export function materializeResolved(
  resolved: ResolvedSelection, nodes: ReadonlyArray<readonly [number, number]> | null, pitchMM: number,
): MaterializedLibrary {
  const { classId, spec, variant, frame, layout, safeSel } = resolved
  // 96mm is physical, and the FRAME already carries the population for this pitch — every
  // reader sees the same magnets rather than the panel counting one set and the canvas another.
  const p = placeMM(frame, nodes ? { name: 'draft', nodes } : layout, safeSel.view, pitchMM)
  const outlineOf = (ns: readonly PointMM[]) =>
    outlineFromLayout(ns, variant.outline, spec.boundaryOf?.(safeSel, ns))
  /** The one record. Only the outline it wraps, its layout name, why it is not a shape yet and
   *  where to look when nothing is drawn ever differ between the three cases. */
  const record = (
    outlineMM: readonly PointMM[], layoutId: string, error: string | null, seedMM: PointMM | null,
  ): MaterializedLibrary => ({
    classId,
    sourceFrameKey: frameKeyOf(frame), frameKey: p.cols + 'x' + p.rows,
    frameCols: p.cols, frameRows: p.rows, layoutId,
    nodesMM: p.nodesMM, outlineMM, ...boundsMM(outlineMM), error, seedMM,
  })

  if (!nodes) return record(outlineOf(p.nodesMM), layout.name, null, p.nodesMM[0] ?? null)

  let error: string | null = spec.validateDraft({ nodes, geometryId: safeSel.geometryId }, frame)[0] ?? null
  if (!error) try { return record(outlineOf(p.nodesMM), 'draft', null, null) }
  catch (e) { error = (e as Error).message }
  // not a shape yet: the magnets being drawn are still shown, wrapped by the corpus outline
  const corpus = placeMM(frame, layout, safeSel.view, pitchMM)
  return record(outlineOf(corpus.nodesMM), 'draft', error,
    p.nodesMM.length ? null : corpus.nodesMM[0] ?? null)
}

export function materializeSelection(
  sel: LibrarySelection, pitchMM: number,
): MaterializedLibrary {
  const resolved = resolveSelection(sel, [], pitchMM)
  if (resolved.safeSel.layoutId !== sel.layoutId)
    throw new Error('library: unknown layoutId ' + sel.layoutId + ' in ' + sel.frameKey)
  return materializeResolved(resolved, null, pitchMM)
}
