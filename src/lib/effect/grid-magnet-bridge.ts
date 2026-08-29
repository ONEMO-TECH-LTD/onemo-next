// grid-magnet-bridge.ts — UI bridge: shape preparation and display lists for the bench shell.
// Wiring only — values from spec, geometry from compute, answers from the engine.

import { contourFromShape } from './geometry-truth'
import { makeSizer } from './grid-magnet-shape'
export { makeSizer, contourCacheKey } from './grid-magnet-shape'
import { traceContourRaw } from './contour'

import { flattenShape, type VShape } from '@/lib/vector-core'
import type { Contour, Pt } from './types'
import type { PipelineResult } from './pipeline'
import { assignSizes } from './grid-magnet-logic'
import type { MagnetPlan, SafeSegment } from './types'
import {
  fieldSpanMM,
  latticeOver,
  MIN_EFFECT_MM,
  SIZE_CEIL_MARGIN_MM,
  type GridResult,
} from './grid-magnet'

/** Flatten reference: curves are flattened as if cut at this size, THEN normalized, so the 0.05mm
 *  manufacturing tolerance holds at every slider size. */
const FLATTEN_REF_MM = 250

function bboxOf(pts: ReadonlyArray<{ x: number; y: number }>) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const p of pts) { if (p.x < a) a = p.x; if (p.x > c) c = p.x; if (p.y < b) b = p.y; if (p.y > d) d = p.y }
  return { w: c - a, h: d - b }
}

/** VShape → mm contour normalized so its longest side = 1mm, flattened at manufacturing scale. */
export function normBaseContour(vs: VShape, maskHeightPx: number): Contour | null {
  const rings = flattenShape(vs, 1)
  const bb = bboxOf(rings[0] ?? [])
  const L = Math.max(bb.w, bb.h, 1)
  const c = contourFromShape(vs, { mmPerPx: FLATTEN_REF_MM / L, maskHeightPx })
  if (!c) return null
  const norm = (pts: ReadonlyArray<Pt>): Pt[] => pts.map(([x, y]) => [x / FLATTEN_REF_MM, y / FLATTEN_REF_MM] as Pt)
  // Every ring normalises. Dropping holes here deleted them before the engine ever saw them.
  return { outer: { pts: norm(c.outer.pts) }, holes: c.holes.map((h) => ({ pts: norm(h.pts) })) }
}

/** Finished-cutout path: alpha mask (image px, y-down) → traced outline → base contour
 *  normalized to longest side = 1mm, y-up. No AI — the outline IS the mask's edge. */
export function normMaskContour(mask: Uint8Array, w: number, h: number): Contour | null {
  const raw = traceContourRaw(mask, w, h)
  if (!raw || raw.length < 3) return null
  // A raw half-pixel trace carries thousands of points; the engine's cost scales with them.
  // Decimate to the same order the AI path's flatten produces — sub-0.2mm fidelity at product
  // sizes, ~10x cheaper solves.
  const MAXV = 600
  const k = Math.max(1, Math.ceil(raw.length / MAXV))
  const ring: typeof raw = []
  for (let i = 0; i < raw.length; i += k) ring.push(raw[i])
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ring) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const L = Math.max(maxX - minX, maxY - minY, 1)
  return { outer: { pts: ring.map(([x, y]) => [(x - minX) / L, (maxY - y) / L] as Pt) }, holes: [] }
}

/** Generated polygon ring (image px, y-down) → mm contour normalized to 1mm, y-up. */
export function normGeneratedRing(ring: ReadonlyArray<readonly [number, number]>, imgH: number): Contour | null {
  if (ring.length < 3) return null
  const bb = bboxOf(ring.map(([x, y]) => ({ x, y })))
  const L = Math.max(bb.w, bb.h, 1)
  return { outer: { pts: ring.map(([x, y]) => [x / L, (imgH - y) / L] as Pt) }, holes: [] }
}

/** The size range a surface may offer — the fixed board plus a margin so shapes can pad past it. */
export function sizeRange(padMM: number): { minMM: number; maxMM: number } {
  return { minMM: MIN_EFFECT_MM, maxMM: fieldSpanMM(padMM) + SIZE_CEIL_MARGIN_MM }
}
/** One drawable spot: engine-space centre, radius, and whether a magnet seats there. */
export interface FieldSpot {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly held: boolean
}

/** Every lattice position over a region as a display list, on the engine's own phase.
 *  Phase is re-anchored on a real answer point: the generator's phase is relative to the region's
 *  min, so the same phase over a different region would be a different absolute lattice. */
export function fieldSpots(
  grid: GridResult,
  view: { minX: number; minY: number; maxX: number; maxY: number },
): FieldSpot[] {
  const A = grid.anchors[0]?.p ?? grid.lattice[0]
  if (!A) return []
  const pad = grid.spotRadiusMM
  const rgn = { minX: view.minX - pad, minY: view.minY - pad, maxX: view.maxX + pad, maxY: view.maxY + pad }
  // A spot holds a magnet when one SITS ON IT. Matching by rounded-coordinate string keys made
  // that a knife edge: the generator steps its axis by repeated addition while the solver's
  // anchors are origin + k·pitch, so a coordinate near a rounding boundary keyed differently the
  // further out it sat — and a whole column of seated magnets drew as empty. Distance decides;
  // the lattice is 48mm apart, so half a millimetre is unambiguous.
  const near = (n: Pt) => grid.anchors.some((a) => Math.abs(a.p[0] - n[0]) < 0.5 && Math.abs(a.p[1] - n[1]) < 0.5)
  return latticeOver(rgn, grid.pitchCentreMM, [A[0] - rgn.minX, A[1] - rgn.minY]).map((n) => (
    { x: n[0], y: n[1], r: grid.spotRadiusMM, held: near(n) }
  ))
}

/** The seated spots alone — what a surface draws when the full field is off. */
export function seatedSpots(grid: GridResult): FieldSpot[] {
  return grid.anchors.map((a) => ({ x: a.p[0], y: a.p[1], r: grid.spotRadiusMM, held: true }))
}

/** One row of the pipeline's ledger, as the bench draws it. Every fact the attempt recorded
 *  reaches the card: a count alone made distinct attempts look like repeated duplicates, and the
 *  positions the material refused were thrown away between the engine and the screen. */
export interface LedgerRow {
  readonly attemptId: string
  readonly classId: string
  readonly frameCols: number
  readonly frameRows: number
  readonly label: string
  readonly viewId: string
  readonly registration: string
  readonly attempted: number
  readonly count: number
  readonly omittedMM: readonly Pt[]
  readonly sizeMM: number | null
  readonly landedBandId: number | null
  readonly outcome: 'fit' | 'no-fit'
  readonly offMM: number | null
}

/** Which registration, in words — two rows can carry the same size and count and still be
 *  different products (a 4x4 dropping a column reads like one dropping a row). */
function registrationName(offset: readonly [number, number]): string {
  if (offset[0] === 0 && offset[1] === 0) return 'grid on centre'
  if (offset[1] === 0) return 'grid half-step across'
  if (offset[0] === 0) return 'grid half-step down'
  return 'grid half-step across and down'
}

export function ledgerOf(result: PipelineResult): LedgerRow[] {
  return result.attempts.map((a) => ({
    attemptId: a.attemptId,
    classId: a.classId,
    frameCols: a.frameCols,
    frameRows: a.frameRows,
    label: a.label,
    viewId: a.viewId,
    registration: registrationName(a.registrationMM),
    attempted: a.attempted,
    count: a.wrap ? a.wrap.count : a.seatedMM.length,
    omittedMM: a.omitted.map(({ pointMM }) => pointMM),
    sizeMM: a.wrap ? a.wrap.sizeMM : null,
    landedBandId: a.landedBandId,
    outcome: a.wrap ? 'fit' : 'no-fit',
    offMM: a.wrap ? a.wrap.centreOffMM : null,
  }))
}

/** Every lattice position across the shape at this size, on the governed registration. */
function latticeOverContour(contour: Contour, pitchMM: number, anchor: Pt): Pt[] {
  const xs = contour.outer.pts.map((p) => p[0]), ys = contour.outer.pts.map((p) => p[1])
  const region = {
    minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys),
  }
  return latticeOver(region, pitchMM, [
    ((anchor[0] - region.minX) % pitchMM + pitchMM) % pitchMM,
    ((anchor[1] - region.minY) % pitchMM + pitchMM) % pitchMM,
  ])
}

/** THE BENCH MODEL — the pipeline's result as the canvas draws it. Assembly only: it chooses
 *  nothing. With no selection it returns the classified shape and an empty magnet set, so the
 *  bench shows what the pipeline found without promoting one answer, which is what the raw MVP
 *  requires (a default landing IS a ranking). */
export function benchModel(
  result: PipelineResult, selectedAttemptId: string | null, plan: MagnetPlan,
): {
  contour: Contour; grid: GridResult; effSize: number; ladder: LedgerRow[]
  selectedAttemptId: string | null; segments: readonly SafeSegment[]
  offMM: number | null; frame: { cols: number; rows: number } | null; reason?: string
} {
  const ladder = ledgerOf(result)
  const chosen = selectedAttemptId == null ? null
    : result.attempts.find((a) => a.attemptId === selectedAttemptId && a.wrap) ?? null
  const sized = makeSizer(result.baseContour, result.offsetMM)
  const sizeMM = chosen?.wrap ? chosen.wrap.sizeMM : result.classifiedAtMM
  const contour = sized(sizeMM)
  const points = chosen?.wrap ? chosen.wrap.points : []
  const anchor = chosen?.wrap ? chosen.wrap.anchorMM : (result.anchorMM ?? [0, 0] as Pt)
  return {
    contour,
    grid: {
      anchors: assignSizes(points.map(([x, y]) => [x, y] as Pt), plan),
      pitchCentreMM: result.pitchMM,
      // THE LATTICE IS THE SHAPE'S, NOT THE SELECTION'S. It is every position this grid offers on
      // this shape at this size, and it must be visible before anything is picked — returning an
      // empty list left the board blank on a shape that was loaded and classified.
      lattice: latticeOverContour(contour, result.pitchMM, anchor),
      phaseMM: [0, 0],
      panMM: [0, 0],
      spotRadiusMM: result.spotRadiusMM,
      contactsMM: chosen?.wrap ? chosen.wrap.points.filter((_, i) => (chosen.wrap!.gapsMM[i] ?? Infinity) <= 0.6) : [],
      segments: [...result.segments],
      centresMM: [anchor],
      centreMainMM: anchor,
    },
    effSize: sizeMM,
    ladder,
    selectedAttemptId: chosen ? chosen.attemptId : null,
    segments: result.segments,
    offMM: chosen?.wrap ? chosen.wrap.centreOffMM : null,
    frame: result.frame ? { cols: result.frame.cols, rows: result.frame.rows } : null,
    reason: result.reason,
  }
}
