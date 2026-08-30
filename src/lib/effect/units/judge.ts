// units/judge.ts — JUDGE: which offers are lawful, and in what order they stand.
//
// The rules that were buried inside the band ladder (S2 step 6). Judge decides; it never places a
// magnet, never wraps and never mutates a population.

import type { BandRung } from '../types'

/** BAND MEMBERSHIP (Dan, 08-24): a layout whose TRUE wrapped size falls outside the band does not
 *  exist in that band. No clamping to band floors — the size decides, not the request. */
export function inBand(sizeMM: number, loMM: number, hiMM: number): boolean {
  return !(sizeMM < loMM - 0.005 || sizeMM > hiMM + 0.005)
}

/** Offers stand smallest-first. Ordering is judgement, not sequencing. */
export function orderOffers(rungs: BandRung[]): BandRung[] {
  return [...rungs].sort((a, b) => a.at.sizeMM - b.at.sizeMM)
}

/** RULE 4 (Dan, 08-24): prefer the tight solution closest to the centroid — never the smallest at
 *  any centring cost. Among offers of the SAME COUNT as the tightest, within half a pitch of it,
 *  the best-centred is the default landing. Every other lawful offer stays visible. */
export function defaultLanding(rungs: BandRung[], pitchMM: number): number {
  if (!rungs.length) return 0
  const half = pitchMM / 2
  const c0 = rungs[0]
  let idx = 0
  for (let i = 1; i < rungs.length; i++) {
    const r = rungs[i]
    if (r.at.count !== c0.at.count || r.at.sizeMM > c0.at.sizeMM + half) continue
    if (r.at.centreOffMM < rungs[idx].at.centreOffMM - 0.01) idx = i
  }
  return idx
}

// ─── THE UNPROTECTED AREA, AND WHAT IT PREFERS ──────────────────────────────────────────────────
//
// Dan, 2026-08-30, verbatim:
//
//   "one rule we need to implement as filter as well and enforcer is the unprotected area and also
//    unprotected area holding preferences - means that in order of the general to more specific :
//    1. the perimeter side holds are prefered to centers
//    2. extreme apart sides must be held in preference to closest sides top and bottom of the
//       rectangle for instance in portrait and right left in landscape
//    3. corners are prefered to sides
//    4. top unprotected area is prefered to side - gravity law
//    basically even distruibution with less unprotected areas further from the the protected area
//    than 24-48mm is better to be protected and aligned to it especially top side cause the top
//    will by gravity will unstick the effect with no magnets."
//
// Why it must exist at all: both answers Dan rejected — the bot's bare leg, the arm with a magnet
// touching beside an empty seat — are LAWFUL WRAPS. Wrap is satisfied the moment the magnets it
// has touch an edge, so nothing in the engine could tell them from a good answer. This is the only
// measure that sees the difference.
//
// FOUR READINGS TAKEN FROM HIS WORDS, not invented:
//   · rule 2 says "must be held"; 1, 3 and 4 say "preferred". So 2 REJECTS and the rest ORDER —
//     which is exactly "a filter as well as an enforcer".
//   · each rule is independently switchable ("toggles on off and test the results").
//   · "top" is the top as drawn. It is the only up the engine has.
//   · the threshold is 48mm, the far end of his "24-48mm": a gap counts only when it is more than
//     one magnet spacing from anything held.

import { Clipper, FillRule, type Paths64 } from '@countertype/clipper2-ts'
import type { Pt } from '../types'

/** A gap in the legal area that nothing holds. */
export interface UnprotectedRegion {
  areaMM2: number
  /** Where it sits, for the gravity rule. */
  centreMM: Pt
}

/** Which of the four rules are switched on. All off is the released behaviour. */
export interface HoldingRules {
  /** 1 · perimeter holds preferred to centres */
  perimeter: boolean
  /** 2 · the extremes of the dominant axis MUST be held — the enforcer */
  extremes: boolean
  /** 3 · corners preferred to sides */
  corners: boolean
  /** 4 · unprotected at the TOP is worse than at a side — the gravity law */
  gravity: boolean
}

export const NO_HOLDING_RULES: HoldingRules =
  { perimeter: false, extremes: false, corners: false, gravity: false }

/** Dan's "24-48mm", taken at its far end: one magnet spacing. A gap nearer than this to a held
 *  magnet is the sliver every offset leaves, not a hole worth reporting. */
export const UNPROTECTED_REACH_MM = 48

const S = 1000

/** THE GAPS: the legal area minus what the magnets reach, at Dan's threshold.
 *
 *  `reachMM` IS the rule — pass his 48 and every region that comes back is, by construction, made
 *  entirely of points more than 48mm from any magnet. That is his "further from the protected area
 *  than 24-48mm" measured directly, with no second test and no tolerance to tune.
 *
 *  An earlier version measured each region's ring vertices instead and reported 21.6mm for a
 *  25,670mm2 hole through the middle of a rectangle — because a ring hugs the boundary and never
 *  visits the deep interior. Subtracting at the threshold cannot make that mistake.
 *
 *  Exact polygon arithmetic — the same Clipper2 the seating and the ruler use, never a sampled
 *  field. */
export function unprotectedRegions(
  /** The legal magnet-centre region, handed in by the sequencer — a unit never reaches for another
   *  unit's work, and the ruler that produced this is the classifier's. */
  legal: Paths64 | null, magnets: ReadonlyArray<Pt>, reachMM: number,
): UnprotectedRegion[] {
  if (!legal || !legal.length) return []
  if (!magnets.length) return []
  // Each magnet's reach as an explicit disc polygon. A one-point path cannot be offset — asking
  // Clipper to inflate one returns nothing, which silently reported every shape as fully covered.
  const SEG = 48
  const discs = magnets.map((m) => {
    const flat: number[] = []
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2
      flat.push(Math.round((m[0] + Math.cos(a) * reachMM) * S), Math.round((m[1] + Math.sin(a) * reachMM) * S))
    }
    return Clipper.makePath(flat)
  })
  const held = Clipper.union(discs, FillRule.NonZero)
  if (!held || !held.length) return []
  const left = Clipper.difference(legal, held, FillRule.NonZero)
  if (!left || !left.length) return []
  const out: UnprotectedRegion[] = []
  for (const path of left) {
    if (path.length < 3) continue
    let a2 = 0, cx = 0, cy = 0
    const pts: Pt[] = path.map((p) => [Number(p.x) / S, Number(p.y) / S] as Pt)
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const cross = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
      a2 += cross
      cx += (pts[j][0] + pts[i][0]) * cross
      cy += (pts[j][1] + pts[i][1]) * cross
    }
    const area = Math.abs(a2 / 2)
    if (area <= 0) continue
    const centre: Pt = a2 === 0 ? pts[0] : [cx / (3 * a2), cy / (3 * a2)]
    out.push({ areaMM2: area, centreMM: centre })
  }
  return out
}

/** What one offer's holding looks like, measured against the shape it sits on. */
export interface HoldingFacts {
  /** magnets on the rim rather than surrounded — rule 1 */
  perimeter: number
  /** magnets in a corner quadrant of the legal box — rule 3 */
  corners: number
  /** does the held population reach BOTH ends of the dominant axis — rule 2, the enforcer */
  holdsExtremes: boolean
  /** unprotected area sitting in the top third, weighted by size — rule 4, gravity */
  topUnprotectedMM2: number
  /** every gap further than the reach from a magnet */
  unprotectedMM2: number
}

/** Measure one offer. Geometry only — no preference is applied here. */
export function holdingFactsOf(
  magnets: ReadonlyArray<Pt>, legalBox: { minX: number; minY: number; maxX: number; maxY: number },
  gaps: ReadonlyArray<UnprotectedRegion>, pitchMM: number,
): HoldingFacts {
  const w = legalBox.maxX - legalBox.minX, h = legalBox.maxY - legalBox.minY
  const portrait = h >= w
  // RULE 1 — a magnet is a perimeter hold when it is NOT surrounded on all four sides by others.
  // Same shape as the belt's own test, which is Dan's existing rule for what a rim is.
  const R = pitchMM * 1.45
  let perimeter = 0
  for (let i = 0; i < magnets.length; i++) {
    let l = false, r = false, u = false, d = false
    for (let j = 0; j < magnets.length; j++) {
      if (i === j) continue
      const dx = magnets[j][0] - magnets[i][0], dy = magnets[j][1] - magnets[i][1]
      if (Math.hypot(dx, dy) > R) continue
      if (dx > 1) r = true; else if (dx < -1) l = true
      if (dy > 1) u = true; else if (dy < -1) d = true
    }
    if (!(l && r && u && d)) perimeter++
  }
  // RULE 3 — a corner hold sits in the outer quarter of BOTH axes of the legal box.
  const qx = w / 4, qy = h / 4
  let corners = 0
  for (const [x, y] of magnets) {
    const nearX = x <= legalBox.minX + qx || x >= legalBox.maxX - qx
    const nearY = y <= legalBox.minY + qy || y >= legalBox.maxY - qy
    if (nearX && nearY) corners++
  }
  // RULE 2 — "extreme apart sides must be held ... top and bottom in portrait, right and left in
  // landscape". Held when the population reaches within one pitch of BOTH ends of that axis.
  const along = magnets.map((p) => (portrait ? p[1] : p[0]))
  const lo = portrait ? legalBox.minY : legalBox.minX
  const hi = portrait ? legalBox.maxY : legalBox.maxX
  const holdsExtremes = magnets.length > 0
    && Math.min(...along) <= lo + pitchMM && Math.max(...along) >= hi - pitchMM
  // RULE 4 — gravity. A gap in the top third is the one that peels the effect off.
  const topFrom = legalBox.maxY - h / 3
  let unprotectedMM2 = 0, topUnprotectedMM2 = 0
  for (const g of gaps) {
    // no sliver test here: the gaps were subtracted AT his threshold, so each one already is a
    // region every point of which is further than that from any magnet
    unprotectedMM2 += g.areaMM2
    if (g.centreMM[1] >= topFrom) topUnprotectedMM2 += g.areaMM2
  }
  return { perimeter, corners, holdsExtremes, topUnprotectedMM2, unprotectedMM2 }
}

/** APPLY DAN'S RULES to a set of offers.
 *
 *  Rule 2 is the ENFORCER: with it on, an offer that does not hold both extremes is removed. The
 *  other three are PREFERENCES: they order what survives, in the sequence he gave them — perimeter
 *  first, then corners, then gravity. Every rule is independent, so any of them can be switched
 *  off and the result seen.
 *
 *  An offer with no facts is left where it is. Nothing is invented: no weighting, no score, no
 *  threshold beyond his own. */
export function applyHoldingRules<T>(
  offers: ReadonlyArray<T>, factsOf: (o: T) => HoldingFacts | null, rules: HoldingRules,
): T[] {
  const kept = rules.extremes
    ? offers.filter((o) => { const f = factsOf(o); return !f || f.holdsExtremes })
    : [...offers]
  if (!rules.perimeter && !rules.corners && !rules.gravity) return kept
  return [...kept].sort((a, b) => {
    const fa = factsOf(a), fb = factsOf(b)
    if (!fa || !fb) return 0
    if (rules.perimeter && fa.perimeter !== fb.perimeter) return fb.perimeter - fa.perimeter
    if (rules.corners && fa.corners !== fb.corners) return fb.corners - fa.corners
    if (rules.gravity && fa.topUnprotectedMM2 !== fb.topUnprotectedMM2)
      return fa.topUnprotectedMM2 - fb.topUnprotectedMM2
    return 0
  })
}
