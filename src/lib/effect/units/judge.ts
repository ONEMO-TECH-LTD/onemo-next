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

/** THE GAPS as a path set, kept whole. Never split into per-ring areas: a hole ring must SUBTRACT
 *  from its owner, and taking |area| of each path adds it instead — a 60,924mm2 legal donut
 *  reported 87,614mm2 unprotected, more gap than it has material (QA F1). */
export type UnprotectedPaths = Paths64

/** Which of the four rules are switched on. All off is the released behaviour. */
export interface HoldingRules {
  /** 1 · perimeter-side holds preferred to centres */
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

/** DAN'S PROTECTION REACH — "further from the protected area than 24-48mm", clamped to his own
 *  range. It never expands with the grid: at 96mm pitch it stays 48, because nothing in his rule
 *  authorises a 96mm gap (QA F3). */
export function protectionReachMM(pitchMM: number): number {
  return Math.min(48, Math.max(24, pitchMM))
}

const S = 1000
const areaOf = (paths: Paths64): number => Math.abs(Number(Clipper.areaPaths(paths))) / (S * S)

/** A disc polygon at the given reach. A one-point path cannot be offset — asking Clipper to
 *  inflate one returns nothing, which silently reported every shape as fully covered. */
function discAt(m: Pt, reachMM: number): ReturnType<typeof Clipper.makePath> {
  // CIRCUMSCRIBED, not inscribed. An inscribed polygon cuts INSIDE the true circle between its
  // vertices, so points nearer than the reach survived as "unprotected" — QA found a probe 47.98mm
  // from a magnet surviving a 48mm subtraction, which made the promise of the measure false. The
  // vertex radius is pushed out by 1/cos(half the segment angle) so every point within the true
  // radius is covered; 72 sides keeps the overreach under 0.05mm at 48mm, inside manufacturing
  // tolerance. The error now leans toward protecting slightly too much, never too little.
  const SEG = 72
  const r = reachMM / Math.cos(Math.PI / SEG)
  const flat: number[] = []
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2
    flat.push(Math.round((m[0] + Math.cos(a) * r) * S), Math.round((m[1] + Math.sin(a) * r) * S))
  }
  return Clipper.makePath(flat)
}

/** THE UNPROTECTED AREA: the legal region minus what the magnets reach, at Dan's threshold.
 *
 *  `reachMM` IS the rule — pass his clamped reach and every point in the result is, by
 *  construction, further than that from any magnet. The threshold is applied AT the subtraction,
 *  so there is no second test and no tolerance to tune.
 *
 *  With no magnets the answer is the whole legal region, not nothing: an empty population protects
 *  nothing (QA F1). */
export function unprotectedRegions(
  /** The legal magnet-centre region, handed in by the sequencer — a unit never reaches for another
   *  unit's work, and the ruler that produced this is the classifier's. */
  legal: Paths64 | null, magnets: ReadonlyArray<Pt>, reachMM: number,
): UnprotectedPaths {
  if (!legal || !legal.length) return []
  if (!magnets.length) return legal
  const held = Clipper.union(magnets.map((m) => discAt(m, reachMM)), FillRule.NonZero)
  if (!held || !held.length) return legal
  return Clipper.difference(legal, held, FillRule.NonZero) ?? []
}

/** What one offer's holding looks like, measured against the shape it sits on. */
export interface HoldingFacts {
  /** magnets within the protection reach of the legal region's own boundary — rule 1 */
  perimeter: number
  /** magnets within reach of TWO boundaries at once, i.e. in a corner — rule 3 */
  corners: number
  /** does the held population reach BOTH ends of the dominant axis — rule 2, the enforcer */
  holdsExtremes: boolean
  /** unprotected area inside the top zone, by actual intersection — rule 4, gravity */
  topUnprotectedMM2: number
  /** every point further than the reach from a magnet */
  unprotectedMM2: number
}

/** A legal boundary edge in mm: ax, ay, bx, by, and its unit direction. */
type Seg = [number, number, number, number, number, number]

function boundarySegments(paths: Paths64): Seg[] {
  const out: Seg[] = []
  for (const path of paths) {
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      const ax = Number(path[j].x) / S, ay = Number(path[j].y) / S
      const bx = Number(path[i].x) / S, by = Number(path[i].y) / S
      const dx = bx - ax, dy = by - ay
      const len = Math.hypot(dx, dy)
      if (len < 1e-9) continue
      out.push([ax, ay, bx, by, dx / len, dy / len])
    }
  }
  return out
}

/** THE SHAPE'S ACTUAL CORNERS: vertices where the outline turns sharply.
 *
 *  Read from the SOURCE rings, never from the legal region — the inward offset uses round joins,
 *  so every convex corner of a square arrives as an arc and a square becomes indistinguishable
 *  from a circle. And never inferred from "two non-parallel segments within reach", which was the
 *  previous version: a smooth circle has many differently-oriented segments inside any radius, so
 *  every hold beside a circle counted as a corner (QA F1).
 *
 *  CORNER_TURN_DEG is the one authored number left in this file. A 96-point circle turns 3.75
 *  degrees a vertex and a right angle turns 90, so anything in between separates them; 40 is
 *  chosen to sit clear of both, and the three frozen counterexamples — circle 0, rectangle corner
 *  1, U concave corner 1 — are what hold it honest. */
const CORNER_TURN_DEG = 40

function cornerFeatures(rings: ReadonlyArray<ReadonlyArray<Pt>>): Pt[] {
  const out: Pt[] = []
  // The angle BETWEEN the incoming and outgoing directions: a straight run gives cos 1, a right
  // angle gives 0, a reversal gives -1. So a turn of at least CORNER_TURN_DEG is cos below
  // cos(CORNER_TURN_DEG). My first version compared against cos(180 - turn), which asked for a
  // near-reversal and found no corner on a square at all.
  const limit = Math.cos(CORNER_TURN_DEG * Math.PI / 180)
  for (const ring of rings) {
    const n = ring.length
    if (n < 3) continue
    for (let i = 0; i < n; i++) {
      const a = ring[(i - 1 + n) % n], b = ring[i], c = ring[(i + 1) % n]
      const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1]
      const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy)
      if (lu < 1e-9 || lv < 1e-9) continue
      // cos of the angle between the incoming and outgoing directions; a straight run is 1
      const cos = (ux * vx + uy * vy) / (lu * lv)
      if (cos < limit) out.push(b)
    }
  }
  return out
}

const segDistMM = (sg: Seg, p: Pt): number => {
  const dx = sg[2] - sg[0], dy = sg[3] - sg[1]
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((p[0] - sg[0]) * dx + (p[1] - sg[1]) * dy) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return Math.hypot(p[0] - (sg[0] + t * dx), p[1] - (sg[1] + t * dy))
}

/** Measure one offer. Geometry only — no preference is applied here. */
export function holdingFactsOf(
  magnets: ReadonlyArray<Pt>, legalBox: { minX: number; minY: number; maxX: number; maxY: number },
  gaps: UnprotectedPaths,
  /** The grid pitch. The reach is CLAMPED here, so no caller can widen Dan's 24-48mm by handing in
   *  a 96mm pitch — which is exactly how a 96mm bare end passed as "holding the extremes". */
  pitchMM: number,
  /** The legal region itself — REQUIRED. Rule 1 reads its real boundary: a magnet 5mm from the
   *  inner edge of a U is a perimeter hold, and a bounding box cannot see that, being 71mm away.
   *  The optional box fallback is gone: an API that still permits the implementation a
   *  counterexample disproved is an API that will be used that way (QA F2). */
  legal: Paths64,
  /** The SOURCE contour's rings — outer and holes — for rule 3. A corner is a TURN in the shape,
   *  and it must be read here rather than off the legal region, because the inward offset rounds
   *  every convex corner into an arc and would make a square indistinguishable from a circle. */
  cornersOf: ReadonlyArray<ReadonlyArray<Pt>>,
): HoldingFacts {
  const reachMM = protectionReachMM(pitchMM)
  const w = legalBox.maxX - legalBox.minX, h = legalBox.maxY - legalBox.minY
  // RULE 1 and RULE 3 — PHYSICAL, measured against the legal region's own boundary. The previous
  // version reused the belt's "is this magnet surrounded by neighbours" test, which answers a
  // different question entirely: a lone magnet dead-centre of a 200x200 box counted as a perimeter
  // hold because it had no neighbours (QA F2). A perimeter-side hold is one NEAR AN EDGE.
  // RULE 1 — the real legal boundary. RULE 3 — actual corner FEATURES of the shape.
  const segs = boundarySegments(legal)
  const features = cornerFeatures(cornersOf)
  let perimeter = 0, corners = 0
  for (const m of magnets) {
    if (!segs.some((sg) => segDistMM(sg, m) <= reachMM)) continue
    perimeter++
    if (features.some((f) => Math.hypot(m[0] - f[0], m[1] - f[1]) <= reachMM)) corners++
  }
  // RULE 2 — "extreme apart sides must be held ... top and bottom in portrait, right and left in
  // landscape". Held when the population reaches within Dan's OWN reach of both ends — never the
  // grid pitch, which at 96mm would accept a 96mm bare end (QA F3). A square has no dominant axis,
  // so BOTH axes must hold rather than silently calling it portrait.
  const square = Math.abs(h - w) < 1e-6
  const endsHeld = (axis: 0 | 1, lo: number, hi: number) => {
    const along = magnets.map((p) => p[axis])
    return magnets.length > 0 && Math.min(...along) <= lo + reachMM && Math.max(...along) >= hi - reachMM
  }
  const holdsExtremes = square
    ? endsHeld(0, legalBox.minX, legalBox.maxX) && endsHeld(1, legalBox.minY, legalBox.maxY)
    : h > w ? endsHeld(1, legalBox.minY, legalBox.maxY) : endsHeld(0, legalBox.minX, legalBox.maxX)
  // RULE 4 — gravity, by ACTUAL INTERSECTION with the top zone. Classifying a whole region by its
  // centroid reported zero top-gap for a region spanning the middle AND the whole top, because the
  // centroid sat in the middle (QA F4).
  const unprotectedMM2 = areaOf(gaps)
  // THE TOP ZONE is one protection reach down from the top edge — derived from Dan's own 24-48mm
  // rather than the "top third" I had invented (QA F4/F6). It is the band where a bare patch is
  // beyond any magnet's hold AND at the top, which is what his gravity law describes.
  const topFrom = legalBox.maxY - reachMM
  const strip = Clipper.makePath([
    Math.round(legalBox.minX * S), Math.round(topFrom * S),
    Math.round(legalBox.maxX * S), Math.round(topFrom * S),
    Math.round(legalBox.maxX * S), Math.round(legalBox.maxY * S),
    Math.round(legalBox.minX * S), Math.round(legalBox.maxY * S),
  ])
  const top = gaps.length ? Clipper.intersect(gaps, [strip], FillRule.NonZero) : []
  return {
    perimeter, corners, holdsExtremes,
    topUnprotectedMM2: top && top.length ? areaOf(top) : 0,
    unprotectedMM2,
  }
}

/** ORDER THE OFFERS by whichever PREFERENCES are switched on.
 *
 *  Rule 2 is not here: it rejects, and it does so on the candidate pools before any role is
 *  picked. This orders only what already ships.
 *
 *  COMBINED ORDERING IS NOT RULED. Dan listed his rules "in order of the general to more
 *  specific", which describes how he enumerated them, not that perimeter must always outrank
 *  corners. Turning ONE preference on is unambiguous and is what the toggles are for. With more
 *  than one on, this falls back to his listed sequence as a tie-break chain — the least-invented
 *  reading available — and that fallback is an OPEN RULING recorded in _WIP/v3.5.6/DAN-ASK.md,
 *  not a decision (QA F6). Nothing here weights or scores. */
export function applyHoldingRules<T>(
  offers: ReadonlyArray<T>, factsOf: (o: T) => HoldingFacts | null, rules: HoldingRules,
): T[] {
  if (!rules.perimeter && !rules.corners && !rules.gravity) return [...offers]
  return [...offers].sort((a, b) => {
    const fa = factsOf(a), fb = factsOf(b)
    if (!fa || !fb) return 0
    if (rules.perimeter && fa.perimeter !== fb.perimeter) return fb.perimeter - fa.perimeter
    if (rules.corners && fa.corners !== fb.corners) return fb.corners - fa.corners
    if (rules.gravity && fa.topUnprotectedMM2 !== fb.topUnprotectedMM2)
      return fa.topUnprotectedMM2 - fb.topUnprotectedMM2
    return 0
  })
}
