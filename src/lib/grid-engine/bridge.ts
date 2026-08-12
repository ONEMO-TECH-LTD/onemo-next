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

// ---------------------------------------------------------------------------
// MEASUREMENT — the shell asks HERE, never at the engine or the logic layer.
// One composition: engine facts → policy annotations → one object the canvas
// draws. The bridge adds no geometry of its own; every number below is the
// engine's, and every mark is the logic layer's.
// ---------------------------------------------------------------------------

import { loadCorpus, measureOutline, type Measurement, type OutlinePoints } from './engine/measure'
import {
  ALL_OFF,
  annotate,
  POLICIES,
  type AnnotatedSize,
  type PolicyId,
  type PolicySettings,
  type PolicyState,
} from './logic/policies'

// Re-exported so the shell can render the catalogue and hold switch state while importing ONLY
// the bridge — the separation guard forbids it reaching into logic/ itself.
export type { AnnotatedSize, OutlinePoints, PolicyId, PolicySettings, PolicyState }
export { ALL_OFF, loadCorpus, POLICIES }

/**
 * Bands the instrument measures. 1 is included because the minimum measure is one disc
 * (Dan, 2026-08-12 — a triangle's top corner takes exactly one), 4 because Dan added it
 * back the same day. Sizes therefore run 24mm to 204mm.
 */
export const REVIEW_BANDS: readonly number[] = Object.freeze([1, 2, 3, 4])

export interface MeasuredCutout {
  readonly ok: boolean
  readonly error?: string
  readonly vertexCount?: number
  readonly sizes: readonly AnnotatedSize[]
}

/** Measure an outline across the review bands, with the current policy switches applied as marks. */
export async function measureCutout(
  outline: OutlinePoints,
  settings: PolicySettings,
  bands: readonly number[] = REVIEW_BANDS,
): Promise<MeasuredCutout> {
  const measured: Measurement = await measureOutline(outline, bands)
  if (!measured.ok) return { ok: false, error: measured.error, sizes: [] }
  return {
    ok: true,
    vertexCount: measured.vertexCount,
    sizes: annotate(measured.sizes, settings),
  }
}
