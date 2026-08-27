// library/materialize.ts — FROM A SELECTION TO GEOMETRY. The library produces the finished
// record: which magnets, where, in millimetres, and the outline around them. The engine bridge
// receives that record and converts it into engine types — it does not select, materialise,
// derive an outline, or decide what to do when a population is not yet a shape.
//
// Dan, 08-26: "separation of UI clean shell and logic and spec must be followed as in the
// fucking bench". This is the producer side of that seam.

import { specOf } from './class-registry'
import { outlineFromLayout } from './outline'
import { resolveSelection, type ResolvedSelection } from './selection'
import { frameKeyOf, transformLayout } from './transforms'
import type { LibraryFrame, LibraryLayout, LibrarySelection, LibraryTransform, PointMM } from './types'

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
  /** Why the population being drawn is not a shape yet — null when it is. */
  error: string | null
  /** Where to look when nothing is drawn yet: the selected layout's own first magnet, so an
   *  empty canvas opens where the magnets the admin just saw were, not at the mm origin. */
  seedMM: PointMM | null
}

/** Library canon counts rows downward from the top; millimetres count upward. One flip, here. */
const toMM = (
  nodes: ReadonlyArray<readonly [number, number]>, rows: number, pitchMM: number,
): PointMM[] => nodes.map(([ix, iy]) => [ix * pitchMM, (rows - 1 - iy) * pitchMM] as PointMM)

function place(
  frame: LibraryFrame, layout: LibraryLayout, view: LibraryTransform, pitchMM: number,
): { cols: number; rows: number; nodesMM: PointMM[] } {
  const t = transformLayout(frame, layout, view)
  return { cols: t.cols, rows: t.rows, nodesMM: toMM(t.nodes, t.rows, pitchMM) }
}

/** A corpus selection, materialised. Throws on an unknown id — stable IDs exist so that a stale
 *  identity cannot silently retarget to unrelated data (QA F3). */
export function materializeResolved(
  resolved: ResolvedSelection, nodes: ReadonlyArray<readonly [number, number]> | null, pitchMM: number,
): MaterializedLibrary {
  const { classId, frame, layout, safeSel } = resolved
  const spec = specOf(classId)
  const variant = spec.variantOf(safeSel, pitchMM)
  // 96mm is physical, and the FRAME already carries the population for this pitch — every
  // reader sees the same magnets rather than the panel counting one set and the canvas another.
  const p = place(frame, nodes ? { name: 'draft', nodes } : layout, safeSel.view, pitchMM)
  if (!nodes) return {
    classId,
    sourceFrameKey: frameKeyOf(frame), frameKey: p.cols + 'x' + p.rows,
    frameCols: p.cols, frameRows: p.rows, layoutId: layout.name,
    nodesMM: p.nodesMM,
    outlineMM: outlineFromLayout(p.nodesMM, variant.outline, spec.boundaryOf?.(safeSel, p.nodesMM)),
    error: null,
    seedMM: p.nodesMM[0] ?? null,
  }
  const validation = spec.validateDraft({ nodes, geometryId: safeSel.geometryId }, frame)
  let error: string | null = validation[0] ?? null
  if (!error) try {
    const outlineMM = outlineFromLayout(p.nodesMM, variant.outline, spec.boundaryOf?.(safeSel, p.nodesMM))
    return {
      classId,
      sourceFrameKey: frameKeyOf(frame), frameKey: p.cols + 'x' + p.rows,
      frameCols: p.cols, frameRows: p.rows, layoutId: 'draft',
      nodesMM: p.nodesMM,
      outlineMM, error: null,
      seedMM: null,
    }
  }
  catch (e) { error = (e as Error).message }
  const corpus = place(frame, layout, safeSel.view, pitchMM)
  const outlineMM = outlineFromLayout(corpus.nodesMM, variant.outline, spec.boundaryOf?.(safeSel, corpus.nodesMM))
  return {
    classId,
    sourceFrameKey: frameKeyOf(frame), frameKey: p.cols + 'x' + p.rows,
    frameCols: p.cols, frameRows: p.rows, layoutId: 'draft',
    nodesMM: p.nodesMM,
    outlineMM, error,
    seedMM: p.nodesMM.length ? null : corpus.nodesMM[0] ?? null,
  }
}

export function materializeSelection(
  sel: LibrarySelection, pitchMM: number,
): MaterializedLibrary {
  const resolved = resolveSelection(sel, [], pitchMM)
  if (resolved.safeSel.layoutId !== sel.layoutId)
    throw new Error('library: unknown layoutId ' + sel.layoutId + ' in ' + sel.frameKey)
  return materializeResolved(resolved, null, pitchMM)
}
