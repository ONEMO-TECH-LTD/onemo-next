// units/layout.ts — LAYOUT: where the magnets sit on the rigid lattice.
//
// Registration and population, moved from grid-magnet.ts (S2 step 4). It decides WHICH lattice
// nodes the material supports and which survive the coverage rule. It never wraps, never ranks an
// offer and never infers a class. Result shaping stays with the caller.
//
// The voting sweep is gone (step 4a): centre-rules parity is the only registration path.

import type { Contour, GridConfig, Pt, SafeSegment } from '../types'
import { MIN_ANCHORS } from '../grid-magnet-spec'
import {
  bandOf, bbox, edgeDistMM, edgeDistToContourMM, latticeAt, makeCircleSeatPredicate, makeSeatPredicate, pointInOuter, spotRadiusOf,
} from '../foundation/geometry'
import {
  BANDS, DEFAULT_PITCH_MM, PADDING_FLOOR_MM, POSITIONING,
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

const mod = (v: number, m: number) => ((v % m) + m) % m

/** What layout decided — placement only; the caller turns it into the engine's result. */
interface LayoutPlacement {
  bb: ReturnType<typeof bbox>; pitch: number; reach: number
  plan: NonNullable<GridConfig['plan']>; perimeterOnly: boolean
  outer: ReadonlyArray<Pt>; fits: ((p: Pt) => boolean) | null
  segments: SafeSegment[]; centres: Pt[]; ruleTarget: Pt
  bestSeated: Pt[]; bestOx: number; bestOy: number; bestKx: number; bestKy: number
  mainCentre: Pt; positioning: number
}

/** THE WRAP LAW (Dan, 2026-08-20: "0 flap means magnets and edges touch"): wrap is each
 *  disc PRESSED against the outline. The force is the mean of every seated disc's own gap
 *  past its margined edge (spot + allowance) — zero when every disc that can touch does.
 *  Enforced through the dominance tiers, not preferred. */
function pressExcessMM(contour: Contour, seated: ReadonlyArray<Pt>, reach: number): number {
  if (!seated.length) return 0
  let sum = 0
  for (const s of seated) sum += Math.max(0, edgeDistToContourMM(contour, s) - reach)
  return sum / seated.length
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
  const holeFree = (p: Pt) => contourMM.holes.every((h) => !pointInOuter(p, h.pts) && edgeDistMM(h.pts, p) >= spotRadiusOf(pad))
  const outerFits = cfg.circle
    ? makeCircleSeatPredicate(cx, cy, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, spotRadiusOf(pad))
    : makeSeatPredicate(outer, spotRadiusOf(pad))
  const fits = outerFits && (contourMM.holes.length ? (p: Pt) => outerFits(p) && holeFree(p) : outerFits)

  const { segments, centres, ruleTarget } = given

  // THE shape's centres — chosen by the centre-mode switch (logic's table). Every returned
  // point anchors the slide walk; single-target modes also fix the balance target.
  const positioning = cfg.positioning ?? POSITIONING
  // Under CENTRE RULES one point rules outright; Masses names it via the governor switch.

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
  } else if (fits && positioning === 1) {
    // CENTRE RULES — no voting. Parity is DERIVED from the bbox axis classes (canon §4/§6):
    // each axis's class fixes its magnet-line count, odd count puts a NODE on the centre,
    // even count puts the GAP on it — so a 108x91 (class 2x2) shape is judged as a 2x2 frame
    // whose centre IS the governed centre. Magnets still govern first: a parity seating more
    // wins; at EQUAL seats the canonical frame parity always beats the rest, and coverage
    // only sorts the non-canonical remainder. Centring is exact by construction.
    const bxc = ruleTarget[0] - bb.minX, byc = ruleTarget[1] - bb.minY
    const half = pitch / 2
    const clsOf = (side: number) => bandOf(side)?.id ?? BANDS[BANDS.length - 1].id
    const canX = clsOf(bb.maxX - bb.minX) % 2 === 1 ? bxc : bxc + half
    const canY = clsOf(bb.maxY - bb.minY) % 2 === 1 ? byc : byc + half
    const otherX = canX === bxc ? bxc + half : bxc
    const otherY = canY === byc ? byc + half : byc
    // canon = how many axes carry their class-derived parity (2 = the full canonical frame).
    const cands: Array<[number, number, number]> = [
      [canX, canY, 2], [otherX, canY, 1], [canX, otherY, 1], [otherX, otherY, 0],
    ]
    let best: { seats: number; canon: number; excess: number } | null = null
    for (const [px, py, canon] of cands) {
      const ox = mod(px, pitch), oy = mod(py, pitch)
      const seat = latticeAt(bb, pitch, ox, oy).filter(fits)
      if (!seat.length) continue
      const excess = pressExcessMM(contourMM, seat, reach)
      const wins = !best
        || seat.length > best.seats
        || (seat.length === best.seats && canon > best.canon)
        || (seat.length === best.seats && canon === best.canon && excess < best.excess)
      if (wins) { best = { seats: seat.length, canon, excess }; bestSeated = seat; bestOx = ox; bestOy = oy }
    }
    mainCentre = ruleTarget
  }

  return { bb, pitch, reach, plan, perimeterOnly, outer, fits, segments, centres, ruleTarget,
    bestSeated, bestOx, bestOy, bestKx, bestKy, mainCentre, positioning }
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
