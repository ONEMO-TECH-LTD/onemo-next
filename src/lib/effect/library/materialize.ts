// library/materialize.ts — FROM A SELECTION TO GEOMETRY. The library produces the finished
// record: which magnets, where, in millimetres, and the outline around them. The engine bridge
// receives that record and converts it into engine types — it does not select, materialise,
// derive an outline, or decide what to do when a population is not yet a shape.
//
// Dan, 08-26: "separation of UI clean shell and logic and spec must be followed as in the
// fucking bench". This is the producer side of that seam.

import { specOf } from './class-registry'
import { outlineFromLayout } from './outline'
import { resolveSelection, selectedRecords } from './selection'
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
export function materializeSelection(
  sel: LibrarySelection, pitchMM: number,
): MaterializedLibrary {
  const { classId, frame, layout } = selectedRecords(sel, pitchMM)
  const spec = specOf(classId)
  const variant = spec.variantOf(sel, pitchMM)
  // 96mm is physical, and the FRAME already carries the population for this pitch — every
  // reader sees the same magnets rather than the panel counting one set and the canvas another.
  const p = place(frame, layout, sel.view, pitchMM)
  return {
    classId,
    sourceFrameKey: frameKeyOf(frame), frameKey: p.cols + 'x' + p.rows,
    frameCols: p.cols, frameRows: p.rows, layoutId: layout.name,
    nodesMM: p.nodesMM,
    outlineMM: outlineFromLayout(p.nodesMM, variant.outline, spec.boundaryOf?.(sel, p.nodesMM)),
    error: null,
    seedMM: p.nodesMM[0] ?? null,
  }
}

/** A population being DRAWN is allowed to be nothing yet, one node, two, or briefly not a shape:
 *  the canvas has to stay clickable. The corpus outline stands in until the drawn set is sound
 *  again, and the reason travels with it so the panel can refuse the save (QA F1). */
export function materializeDraft(
  sel: LibrarySelection, nodes: ReadonlyArray<readonly [number, number]>,
  pitchMM: number,
): MaterializedLibrary {
  // The AUTHORITATIVE frame is the one this selection resolves to, not dimensions a caller
  // hands in: a caller could pass dimensions the selection contradicts and make the frame key,
  // the placement and the centre all lie. And the selection saveEdit returns names the draft
  // itself, so the corpus fallback must be taken on the NORMALISED selection — resolving the
  // caller's own draft id strictly is how the producer refused its own output.
  const { classId, frame, safeSel } = resolveSelection(sel, [], pitchMM)
  const spec = specOf(classId)
  const variant = spec.variantOf(safeSel, pitchMM)
  // A draft is canonical data like every corpus layout, so it goes through the SAME transform
  // and the same one flip — never straight to mm (QA F2).
  const p = place(frame, { name: 'draft', nodes }, safeSel.view, pitchMM)
  const corpus = materializeSelection(safeSel, pitchMM)
  let outlineMM: readonly PointMM[] = corpus.outlineMM
  const validation = spec.validateDraft({ nodes, geometryId: safeSel.geometryId }, frame)
  let error: string | null = validation[0] ?? null
  if (!error) try { outlineMM = outlineFromLayout(p.nodesMM, variant.outline, spec.boundaryOf?.(safeSel, p.nodesMM)) }
  catch (e) { error = (e as Error).message }
  return {
    classId,
    sourceFrameKey: corpus.sourceFrameKey, frameKey: p.cols + 'x' + p.rows,
    frameCols: p.cols, frameRows: p.rows, layoutId: 'draft',
    nodesMM: p.nodesMM, outlineMM, error,
    seedMM: p.nodesMM.length ? null : corpus.seedMM,
  }
}
