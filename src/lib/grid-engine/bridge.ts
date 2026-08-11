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
  framedSpanMM,
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
import type { GridSystemSpec } from './spec'

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
  /**
   * Where the lattice sits against the shape's centre. A surface drawing the lattice as a rule must
   * anchor it here, or the rule lands at zero while the magnets sit half a pitch off it — lines that
   * miss the centres they are meant to run through.
   */
  registrationMM: number
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
    registrationMM: offset,
    /** Where the rule must anchor so its intersections stay ON the magnet centres (law 8.3). */
    anchorMM: [offset + panMM[0], offset + panMM[1]],
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

/** The span of a band, in millimetres — so a surface never has to compute one. */
export function bandSpan(spec: GridSystemSpec, magnets: number): number {
  return bandSpanMM(spec.grid, magnets)
}

/** The span a run of lattice positions occupies with its margin — for framing, never for layout. */
export function fieldSpan(spec: GridSystemSpec, positions: number): number {
  return framedSpanMM(spec.grid, positions)
}
