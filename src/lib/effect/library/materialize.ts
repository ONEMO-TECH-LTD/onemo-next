// library/materialize.ts — FROM A SELECTION TO GEOMETRY. The library produces the finished
// record: which magnets, where, in millimetres, and the outline around them. The engine bridge
// receives that record and converts it into engine types — it does not select, materialise,
// derive an outline, or decide what to do when a population is not yet a shape.
//
// Dan, 08-26: "separation of UI clean shell and logic and spec must be followed as in the
// fucking bench". This is the producer side of that seam.

import { outlineFromLayout } from './outline'
import { boundsMM, placeMM } from './geometry'
import { bandOfFrame } from './rules'
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
  /** The band this frame sits in at this lattice, from its CANON population — never from the
   *  outline's outer size, and never from a draft's edited nodes: editing must not silently move
   *  the chip between bands. Non-null: a published frame with no band is a producer bug. */
  bandId: number
  nodesMM: readonly PointMM[]
  outlineMM: readonly PointMM[]
  /** Exact legal box of the authored magnet population. The library outline is derived from these
   *  nodes plus the released rim, so this is the classifier-equivalent ruler without re-eroding
   *  the outline in the UI shell. */
  legalBoxMM: { minX: number; minY: number; maxX: number; maxY: number } | null
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
  const band = bandOfFrame(frame, pitchMM)
  if (band === null) throw new Error('library: ' + frameKeyOf(frame) + ' at ' + pitchMM + 'mm has no released band')
  const bandId = band
  const outlineOf = (ns: readonly PointMM[]) => outlineFromLayout(ns, variant.outline)
  const legalBoxOf = (ns: readonly PointMM[]): MaterializedLibrary['legalBoxMM'] => {
    if (!ns.length) return null
    const xs = ns.map(([x]) => x), ys = ns.map(([, y]) => y)
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
  }
  /** The one record. Only the outline it wraps, its layout name, why it is not a shape yet and
   *  where to look when nothing is drawn ever differ between the three cases. */
  const record = (
    outlineMM: readonly PointMM[], layoutId: string, error: string | null, seedMM: PointMM | null,
  ): MaterializedLibrary => ({
    classId,
    sourceFrameKey: frameKeyOf(frame), frameKey: p.cols + 'x' + p.rows,
    frameCols: p.cols, frameRows: p.rows, layoutId, bandId,
    nodesMM: p.nodesMM, outlineMM, legalBoxMM: legalBoxOf(p.nodesMM),
    ...boundsMM(outlineMM), error, seedMM,
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
