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
  cellDiameterMM,
  magnetsInRegion,
  paddedFieldMM,
  registrationOffsetMM,
  summariseField,
  withMinimumSpan,
  type FieldSummary,
  type PointMM,
  type RegionMM,
} from './engine'
import { publishedSizeMM, solveLayout, type Layout, type OutlineMM } from './solve'
import type { GridSystemSpec } from './spec'

export type { FieldSummary, PointMM, RegionMM, Layout, OutlineMM }

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
}

/**
 * A solved shape, ready to state. The exact wrap is the design size (law 3.23); `publishedMM` is
 * what a catalogue shows. The shell is handed both and computes neither — a surface that rounds is a
 * surface holding a number the engine did not produce.
 */
export interface PublishedLayout extends Layout {
  publishedMM: number
}

export function publish(
  spec: GridSystemSpec,
  outline: OutlineMM,
  layout: Layout,
): PublishedLayout {
  return { ...layout, publishedMM: publishedSizeMM(spec, outline, layout) }
}

/** A shape in, a published layout out — the whole unit behind one call. */
export function solveShape(spec: GridSystemSpec, outline: OutlineMM): PublishedLayout | null {
  const layout = solveLayout(spec, outline)
  return layout === null ? null : publish(spec, outline, layout)
}

/** Drive the unit: values out of the spec, geometry out of the engine, one call. */
export function layoutField(spec: GridSystemSpec, contentMM: RegionMM): FieldLayout {
  const field = withMinimumSpan(spec, contentMM)
  const offset = registrationOffsetMM(spec.grid, spec.registration)
  return {
    field,
    padded: paddedFieldMM(spec.grid, field),
    magnets: magnetsInRegion(spec.grid, field, offset),
    cellMM: cellDiameterMM(spec.grid),
    registrationMM: offset,
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
