// units/layout.ts — LAYOUT: where the magnets sit on the rigid lattice.
//
// Registration and population, moved from grid-magnet.ts (S2 step 4). It decides WHICH lattice
// nodes the material supports and which survive the coverage rule. It never wraps, never ranks an
// offer and never infers a class. Result shaping stays with the caller.
//
// The voting sweep is gone (step 4a): centre-rules parity is the only registration path.

import type { BBox, Contour, GridConfig, Pt, SafeSegment } from '../types'
import { holds, prepare } from '@/lib/grid-engine/compute/geometry'
import type { Band } from '../grid-magnet-spec'
import { MIN_ANCHORS } from '../grid-magnet-spec'
import {
  bbox, edgeDistMM, pointInOuter,
} from '../foundation/geometry'
import {
  BANDS, DEFAULT_PITCH_MM, FIELD_POSITIONS_PER_AXIS, PADDING_FLOOR_MM, SNAP_STEP_MM,
} from '../grid-magnet-spec'

/** Split seated nodes into perimeter belt and fully-surrounded interior. */
function splitPerimeter(seated: ReadonlyArray<Pt>, step: number): { belt: Pt[]; interior: Pt[] } {
  const R = step * 1.45
  const belt: Pt[] = [], interior: Pt[] = []
  for (let i = 0; i < seated.length; i++) {
    const p = seated[i]
    let l = false, r = false, u = false, d = false
    for (let j = 0; j < seated.length; j++) {
      if (j === i) continue
      const dx = seated[j][0] - p[0], dy = seated[j][1] - p[1]
      if (Math.hypot(dx, dy) > R) continue
      if (dx > 1) r = true; else if (dx < -1) l = true
      if (dy > 1) u = true; else if (dy < -1) d = true
    }
    if (l && r && u && d) interior.push(p); else belt.push(p)
  }
  return { belt, interior }
}

// Moved out of foundation (F3): each had ONE unit consumer — this one. A primitive earns a
// foundation seat with two or more, and a helper does not earn it by being geometry.
/** Spot radius = the padding, measured from the magnet centre. */
export function spotRadiusOf(padMM: number): number {
  return padMM
}

/** Full field span: the fixed 9×9 board on the base 48 grid, plus one spot either side — 408 at
 *  12 padding. Pitch never changes the board: 96 skips points on it, 24 adds points within it. */
export function fieldSpanMM(padMM: number): number {
  return (FIELD_POSITIONS_PER_AXIS - 1) * DEFAULT_PITCH_MM + 2 * spotRadiusOf(padMM)
}

/** Axis positions at `step` with a phase offset, spanning [min, max]. */
function axisFrom(min: number, max: number, step: number, phase: number): number[] {
  if (step <= 0 || max <= min) return [(min + max) / 2]
  const res: number[] = []
  let x = min + (((phase % step) + step) % step)
  while (x - step >= min - 1e-6) x -= step
  for (; x <= max + 1e-6; x += step) if (x >= min - 1e-6) res.push(x)
  return res
}

/** Lattice across a region at phase (ox, oy). */
export function latticeAt(bb: BBox, pitch: number, ox: number, oy: number): Pt[] {
  const out: Pt[] = []
  for (const x of axisFrom(bb.minX, bb.maxX, pitch, ox))
    for (const y of axisFrom(bb.minY, bb.maxY, pitch, oy)) out.push([x, y])
  return out
}

/** The same lattice generator over an arbitrary region. */
export function latticeOver(region: BBox, pitch: number, phase: Pt): Pt[] {
  return latticeAt(region, pitch, phase[0], phase[1])
}

/** Which band a LEGAL extent falls in. Bands are measured on the legal area, never the outline box:
 *  a pointed or diagonal outline is far bigger than the region inside it that can hold a magnet. */
export function bandOf(legalMM: number): Band | null {
  for (const b of BANDS) if (legalMM >= b.minMM && legalMM <= b.maxMM) return b
  return null
}

/** The legal extent an outline of this size leaves: the rim comes off both sides. */
export function legalOfOuterMM(outerMM: number, padMM: number): number {
  return Math.max(0, outerMM - 2 * padMM)
}

/** The outline sizes a band spans for a shape whose rim is `padMM`. The conversion is the shape's
 *  own — a diamond and a square in the same band do NOT share an outline range, which is why the
 *  band is defined on the legal area and this is derived rather than tabulated. */
export function bandOuterMM(band: Band, padMM: number): { minMM: number; maxMM: number } {
  return { minMM: band.minMM + 2 * padMM, maxMM: band.maxMM + 2 * padMM }
}


/** Integer-micron resolution shared by polygon and analytic-circle seating. */
const SEAT_QUANTUM_MM = 0.001

// Placement eligibility is LAYOUT'S: a seat predicate says where a magnet MAY go, which is policy,
// not measurement. It composes foundation's public primitives; the edge index stays private there.
// QA F3 is right — keeping a private shortcut is no reason to hold policy in foundation.
/**
 * Seat predicate for one outline: centre at least `spotRadiusMM` from every boundary point,
 * tangency passing by equality (exact integer arithmetic, micron quantum).
 * A float prescreen answers the clear cases; only points within a guard band of the exact
 * threshold fall through to the integer test — the answer never changes, only the cost.
 * Null for a degenerate outline.
 */
export function makeSeatPredicate(
  outer: ReadonlyArray<Pt>,
  spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const GUARD = 0.05
  let prep: ReturnType<typeof prepare>
  try { prep = prepare(outer, SEAT_QUANTUM_MM) } catch { return null }
  const rQ = Math.round(spotRadiusMM / SEAT_QUANTUM_MM)
  return (pt: Pt) => {
    // The ring-field lower bound is gone with the move: it read foundation's private edge index,
    // and a private shortcut is not a reason to hold policy in foundation (QA F3). edgeDistMM is
    // itself bucketed and indexed, so this costs a query the shortcut sometimes skipped and returns
    // the identical answer — the float guard and the exact `holds` fallback are untouched.
    const d = edgeDistMM(outer, pt)
    if (d > spotRadiusMM + GUARD) return pointInOuter(pt, outer)
    if (d < spotRadiusMM - GUARD) return false
    return holds(prep, [Math.round(pt[0] / SEAT_QUANTUM_MM), Math.round(pt[1] / SEAT_QUANTUM_MM)], rQ)
  }
}

/**
 * Seat predicate for a TRUE CIRCLE (centre c, radius R): the disc of radius r fits iff
 * |p−c|² ≤ (R−r)² — integer microns, tangency by equality. A flattened polygon's chords sit
 * microns inside the curve and wrongly refuse the zero-margin case; the analytic form cannot.
 */
export function makeCircleSeatPredicate(
  cx: number, cy: number, R: number, spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const q = (v: number) => Math.round(v / SEAT_QUANTUM_MM)
  const slack = q(R) - q(spotRadiusMM)
  if (slack < 0) return null
  const cqx = q(cx), cqy = q(cy), s2 = slack * slack
  return (pt: Pt) => {
    const dx = q(pt[0]) - cqx, dy = q(pt[1]) - cqy
    return dx * dx + dy * dy <= s2
  }
}

/** Seat predicate over a whole CONTOUR: a centre must clear the outline and every hole by the spot
 *  radius. The outer-ring predicate above cannot see a hole at all. */
export function makeContourSeatPredicate(
  contour: Contour, spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const outerFits = makeSeatPredicate(contour.outer.pts, spotRadiusMM)
  if (!outerFits) return null
  if (!contour.holes.length) return outerFits
  return (pt: Pt) => outerFits(pt)
    && !contour.holes.some((h) => pointInOuter(pt, h.pts) || edgeDistMM(h.pts, pt) < spotRadiusMM)
}

const mod = (v: number, m: number) => ((v % m) + m) % m

/** What layout decided — placement only; the caller turns it into the engine's result. */
interface LayoutPlacement {
  bb: ReturnType<typeof bbox>; pitch: number; reach: number
  plan: NonNullable<GridConfig['plan']>; perimeterOnly: boolean
  outer: ReadonlyArray<Pt>; fits: ((p: Pt) => boolean) | null
  segments: SafeSegment[]; centres: Pt[]; ruleTarget: Pt
  bestSeated: Pt[]; bestOx: number; bestOy: number; bestKx: number; bestKy: number
  mainCentre: Pt
}

/** Registration + population: which lattice nodes the material supports, and which survive
 *  coverage. The caller shapes the result — layout decides placement, nothing else. */
export function registerLayout(
  contourMM: Contour, cfg: GridConfig, given: { segments: SafeSegment[]; centres: Pt[]; ruleTarget: Pt },
): LayoutPlacement {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  // Coverage reach from a magnet centre: the spot IS the allowance (flap deleted as a dupe).
  const reach = spotRadiusOf(pad)
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  // Eligibility is over the whole CONTOUR: a centre must clear the outline AND every supplied
  // hole. The outer-ring predicate cannot see a hole, which is how a magnet landed inside one.
  // ONE eligibility rule, used. The hole test used to be written out again here beside the shared
  // predicate — the same duplication this refactor removes, inside the fix for it.
  const fits = cfg.circle
    ? makeCircleSeatPredicate(cx, cy, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, spotRadiusOf(pad))
    : makeContourSeatPredicate(contourMM, spotRadiusOf(pad))

  const { segments, centres, ruleTarget } = given

  // THE shape's centre — chosen by the centre-mode switch. Centre rules is the only registration
  // path, so this one point rules outright; Masses names it via the governor switch.

  let bestSeated: Pt[] = []
  let bestOx = 0, bestOy = 0, bestKx = 0, bestKy = 0
  let mainCentre: Pt = centres[0]
  if (fits && cfg.forcePhaseMM) {
    // Manual calibration: seat exactly at the given registration, no search.
    bestOx = mod(cfg.forcePhaseMM[0], pitch)
    bestOy = mod(cfg.forcePhaseMM[1], pitch)
    bestKx = mod(bestOx - (bb.maxX - bb.minX) / 2, pitch)
    bestKy = mod(bestOy - (bb.maxY - bb.minY) / 2, pitch)
    bestSeated = latticeAt(bb, pitch, bestOx, bestOy).filter(fits)
  } else if (fits) {
    // CENTRE RULES — no voting. Parity is DERIVED from the bbox axis classes (canon §4/§6):
    // each axis's class fixes its magnet-line count, odd count puts a NODE on the centre,
    // even count puts the GAP on it — so a 108x91 (class 2x2) shape is judged as a 2x2 frame
    // whose centre IS the governed centre. Magnets still govern first: a parity seating more
    // wins; at EQUAL seats the canonical frame parity always beats the rest, and coverage
    // only sorts the non-canonical remainder. Centring is exact by construction.
    const bxc = ruleTarget[0] - bb.minX, byc = ruleTarget[1] - bb.minY
    const half = pitch / 2
    const clsOf = (side: number) => bandOf(legalOfOuterMM(side, pad))?.id ?? BANDS[BANDS.length - 1].id
    const canX = clsOf(bb.maxX - bb.minX) % 2 === 1 ? bxc : bxc + half
    const canY = clsOf(bb.maxY - bb.minY) % 2 === 1 ? byc : byc + half
    // canon = how many axes carry their class-derived parity (2 = the full canonical frame).
    // THE MAX-COUNT WINNER IS DELETED (Dan, 2026-08-29: "no max-count prefilter · no hidden
    // winner · never hide a lawful result because another has a higher count"). It built all four
    // of these, compared seat counts, then canonical parity, then press excess, and returned ONE —
    // three lawful registrations destroyed before wrap ever saw them. Measured on a 168mm square at
    // 12mm padding it kept 16 magnets and silently dropped the 12, 12 and 9.
    //
    // Registration is the PIPELINE's to enumerate now, and it tries all four. What remains here is
    // the door's display seating, and it takes the CANONICAL parity — the one Dan's centre-rules
    // law names (odd line count puts a node on the centre, even puts the gap on it). That is a
    // stated rule rather than a hidden contest, and it decides nothing the pipeline offers.
    const ox = mod(canX, pitch), oy = mod(canY, pitch)
    bestSeated = latticeAt(bb, pitch, ox, oy).filter(fits)
    bestOx = ox; bestOy = oy
    mainCentre = ruleTarget
  }

  return { bb, pitch, reach, plan, perimeterOnly, outer, fits, segments, centres, ruleTarget,
    bestSeated, bestOx, bestOy, bestKx, bestKy, mainCentre }
}

/** Perimeter belt: with >4 seated, drop fully-surrounded interior nodes, never below the minimum. */
export function applyCoverage(
  seated: Pt[],
  perimeterOnly: boolean,
  pitch: number,
): { seated: Pt[]; interior: Pt[] } {
  if (!perimeterOnly || seated.length <= 4) return { seated, interior: [] }
  const split = splitPerimeter(seated, pitch)
  if (split.belt.length >= MIN_ANCHORS) return { seated: split.belt, interior: split.interior }
  return { seated, interior: [] }
}

/** The fallback population is LAYOUT'S, not the sequencer's. It generates candidate sizes across
 *  the band from the ruled snap step — never a private threshold invented at the call site. */
export function fallbackRevealSizes(loMM: number, hiMM: number): number[] {
  const out: number[] = []
  for (let mm = loMM; mm <= hiMM + 1e-9; mm += SNAP_STEP_MM) out.push(mm)
  return out
}

/** Selecting the calibration witness is layout's too: the candidate the material carries most of.
 *  It is evidence, never an offer — judge alone decides what is lawful. */
export function bestSeatedCandidate<T extends { points: ReadonlyArray<Pt> }>(
  candidates: ReadonlyArray<T>,
): T | null {
  let best: T | null = null
  for (const c of candidates) if (!best || c.points.length > best.points.length) best = c
  return best
}
