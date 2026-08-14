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
  collectCandidates,
  placedOutline,
  type Candidate,
  type CandidateDocument,
} from './candidates'
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
import { BAND_SIZES_MM, selectPitch, type BandId, type GridSystemSpec } from './spec'

export type { Candidate, CandidateDocument }
export { placedOutline }

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

/** Ladder step the selection examples sit on, per band. */
const EXAMPLE_SIZE_INDEX: Record<BandId, number> = { 1: 3, 2: 1, 3: 2, 4: 4 }

function isExampleClass(c: Candidate, band: BandId): boolean {
  const n = c.sites.length
  if (band === 1) return c.family === 'single' && n === 1
  if (band === 2) return n === 2 && (c.family === 'run' || c.family === 'full-window')
  if (band === 3) {
    if (n === 3 && c.family === 'corner-triangle') return true
    if (n === 4 && (c.family === 'rectangle-corners' || c.family === 'run')) return true
    return false
  }
  return n === 4 && (c.family === 'rectangle-corners' || c.population === 'sparse')
}

function siteTop(c: Candidate): number {
  return Math.min(...c.sites.map((s) => s.y))
}

/** Bench face = the example class for that band. Engine still holds the full document. */
export function benchCandidates(
  spec: GridSystemSpec,
  doc: CandidateDocument,
  band: BandId,
): Candidate[] {
  const home = BAND_SIZES_MM[band][EXAMPLE_SIZE_INDEX[band]]
  const raw = doc.candidates.filter((c) => c.band === band && isExampleClass(c, band))
  raw.sort((a, b) => {
    const da = Math.abs(a.sizeMM - home)
    const db = Math.abs(b.sizeMM - home)
    if (da !== db) return da - db
    if (band === 1 && siteTop(a) !== siteTop(b)) return siteTop(a) - siteTop(b)
    if (b.sites.length !== a.sites.length) return b.sites.length - a.sites.length
    return a.id.localeCompare(b.id)
  })
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const c of raw) {
    const key = [
      c.sizeMM,
      c.family,
      c.population,
      c.sites
        .map((s) => `${s.col},${s.row}`)
        .sort()
        .join('_'),
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
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

/** One collect. Caller caches. Pan and step must not call this. */
export function listCandidates(
  spec: GridSystemSpec,
  outline: ReadonlyArray<PointMM>,
): CandidateDocument {
  return collectCandidates(spec, outline)
}

export function candidateSites(doc: CandidateDocument, id: string): PointMM[] {
  const hit = doc.candidates.find((c: Candidate) => c.id === id)
  return hit ? hit.sites.map((s) => [s.x, s.y] as PointMM) : []
}

function originAxis(reg: 'gap' | 'point', half: number): number {
  return reg === 'gap' ? half : 0
}

/**
 * One lattice. Magnets never move. A candidate whose origin is not the standing
 * origin is shown by moving the SHAPE so its sites land on the standing magnets.
 * Sparse only hides every second standing point.
 */
export function standingView(
  spec: GridSystemSpec,
  candidate: Candidate,
  outline: ReadonlyArray<PointMM>,
): { spec: GridSystemSpec; panMM: PointMM; shape: PointMM[]; sites: PointMM[] } {
  const half = spec.grid.basePitchMM / 2
  const standX = originAxis(spec.registration, half)
  const standY = originAxis(spec.registration, half)
  const dx = standX - originAxis(candidate.registration.x, half)
  const dy = standY - originAxis(candidate.registration.y, half)
  const pitched = selectPitch(
    spec,
    candidate.population === 'sparse' ? spec.grid.basePitchMM * 2 : spec.grid.basePitchMM,
  )
  return {
    spec: pitched.spec,
    panMM: [0, 0],
    shape: placedOutline(outline, candidate.sizeMM, candidate.anchor).map(([x, y]) => [x + dx, y + dy]),
    sites: candidate.sites.map((s) => [s.x + dx, s.y + dy]),
  }
}
