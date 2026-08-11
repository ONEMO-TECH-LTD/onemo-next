// grid-engine/bridge.ts — THE BRIDGE.
//
// Dan, 2026-08-10: "The BRIDGE. Separate from the shell. It wires the logic sub into the engine and
// drives it. It exists so the shell can drive the unit without the unit ever knowing a shell exists."
//
// So this is the only door to the ENGINE. The shell imports this file for everything computed, and
// `spec` for the values and their guard — it never reaches into the engine and never assembles an
// engine call itself. Everything the canvas can draw came back from here on this render; that is
// what makes a stale screen structurally impossible.
//
// (The earlier wording claimed the shell imported "nothing else from the unit", which the code and
// the test both contradicted — the admin panel has to read and write law values. Doc corrected to
// what is actually enforced rather than the enforcement loosened to match a doc.)
//
// It reads values from Sub 2 and hands them to Sub 1. It holds no values and does no geometry.

import {
  bandSpanMM,
  cellDiameterMM,
  fieldSpanMM,
  latticeAnchorMM,
  magnetsInRegion,
  paddedFieldMM,
  registrationOffsetMM,
  resizeBoxToLongest,
  summariseField,
  withMinimumSpan,
  type FieldSummary,
  type PointMM,
  type RegionMM,
} from './engine'
import { LAUNCH_PITCHES_MM, type GridSystemSpec } from './spec'
import type { SolveRequest, PointMM as SolverPointMM } from './solver/contract'

/**
 * The complete SolveRequest from the guarded live spec — the bridge's job, so no surface ever
 * assembles an engine call or holds law arithmetic. Every number is read from the spec or derived
 * from released values: the sparse factor is the released pitch ladder's own ratio, the flap
 * switch positions are the padding and twice it (12/24 under the released spec), and the
 * operational bands are 2 and 3 (bands 1 and 4 are ruled non-operational). Empty centreMethods =
 * the solver's full registry — every contested construction stays a visible test option.
 */
export function engineRequestOf(spec: GridSystemSpec, outline: readonly SolverPointMM[]): SolveRequest {
  return {
    outline,
    spec: {
      basePitchMM: spec.grid.basePitchMM,
      sparseFactor: LAUNCH_PITCHES_MM[1] / LAUNCH_PITCHES_MM[0],
      paddingMM: spec.grid.paddingMM,
      positionsPerAxis: spec.grid.positionsPerAxis,
      bands: [2, 3],
      centreMethods: [],
    },
    flapLimitsMM: [spec.grid.paddingMM, spec.grid.paddingMM * 2],
  }
}

export type { FieldSummary, PointMM, RegionMM }

/** One field, solved. Everything a surface may draw or say about it is in here. */
interface FieldLayout {
  /** The block the magnets occupy. */
  field: RegionMM
  /** That block plus its margin — what a camera should frame so the field's edge is visible. */
  padded: RegionMM
  /** Every magnet centre, in millimetres. */
  magnets: PointMM[]
  /** The spot each magnet owns, in millimetres. */
  cellMM: number
  /** The rule's anchor per axis — registration plus pan. A surface draws lines here or they drift. */
  anchorMM: PointMM
}

/** Drive the unit: values out of the spec, geometry out of the engine, one call. */
export function layoutField(
  spec: GridSystemSpec,
  contentMM: RegionMM,
  panMM: PointMM = [0, 0],
): FieldLayout {
  const field = withMinimumSpan(spec, contentMM)
  const offset = registrationOffsetMM(spec.grid, spec.registration)
  return {
    field,
    padded: paddedFieldMM(spec.grid, field),
    magnets: magnetsInRegion(spec.grid, field, offset, panMM),
    cellMM: cellDiameterMM(spec.grid),
    /** Where the rule must anchor so its intersections stay ON the magnet centres (law 8.3). */
    anchorMM: latticeAnchorMM(offset, panMM),
  }
}

/** What a given region of that layout holds — so a surface can state it without counting anything. */
export function describeRegion(
  spec: GridSystemSpec,
  layout: FieldLayout,
  region: RegionMM,
): FieldSummary {
  return summariseField(spec.grid, region, layout.magnets)
}

/** Drive the shape's longest side from a surface control. The shape itself is untouchable. */
export function resizeShape(spec: GridSystemSpec, box: RegionMM, longestMM: number): RegionMM {
  return resizeBoxToLongest(box, longestMM, cellDiameterMM(spec.grid))
}

/**
 * THE SMALLEST A SHAPE MAY BE — one magnet spot, because a shape narrower than the spot cannot hold
 * a single magnet and is not a shape the system can answer about.
 *
 * ONE FLOOR, and the unit owns it. The surface used to carry its own (20mm) while the unit enforced
 * this one (24mm), so asking for 20 gave you a 24mm shape and a control still reading 20 — a surface
 * holding a number the engine did not produce, which is the defect law 5.3 exists to prevent.
 */
export function minShapeSpan(spec: GridSystemSpec): number {
  return cellDiameterMM(spec.grid)
}

/**
 * THE ATOM — the millimetre square the whole system is built on (law 10.6b: "the cell is actually
 * 12x12 not really 24 - 24 is 4 x12mm"). It IS the padding, so it is read from the padding rather
 * than restated: a surface drawing the notepad rule asks for it instead of knowing it is 12.
 */
export function atomSpan(spec: GridSystemSpec): number {
  return spec.grid.paddingMM
}

/** The span of a band, in millimetres — so a surface never has to compute one. */
export function bandSpan(spec: GridSystemSpec, magnets: number): number {
  return bandSpanMM(spec.grid, magnets)
}

/**
 * The magnet block across, without its margin — what a camera scales against.
 *
 * Scaling against the PADDED field instead cancels the margin out: the same millimetres appear
 * above and below the line and the shape ends up filling the view edge to edge.
 */
export function fieldBlockSpan(spec: GridSystemSpec): number {
  return fieldSpanMM(spec)
}
