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
export function defaultLanding(rungs: BandRung[], pitchMM: number, rulesActive = false): number {
  if (!rungs.length) return 0
  // WHEN DAN'S HOLDING RULES ARE ON, THEY DECIDE. Rule 4 was written for a ladder sorted by size,
  // where rungs[0] is the tightest; the ruled list is sorted by his preferences instead, so
  // re-running rule 4 over it silently overrode the answer his filters had chosen — the bench
  // listed "optimal + min" first and drew "max" (QA F4). A filter that cannot change what you see
  // is not a filter.
  if (rulesActive) return 0
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
  /** 5 · THE ONE LAW, universal. Dan, 2026-08-31: rules 1-4 "are weaker products of it" — extremes
   *  is a fallback, perimeter is a consequence, the top gap is the same thing where gravity makes
   *  it hurt first. Hold every span at its ends; what is left unheld beyond one disc's reach is
   *  the measure. Kept alongside the other four so they can be compared, not instead of them. */
  universal: boolean
  /** 6 · BALANCE, an enforcer. Dan, 2026-08-31: "one large flap remaining lopsided is worse [than]
   *  2 small on each side, so centering must be also enforcer." When unprotected area remains
   *  whichever answer you take, the balanced one wins. */
  balance: boolean
}

export const NO_HOLDING_RULES: HoldingRules =
  { perimeter: false, extremes: false, corners: false, gravity: false, universal: false, balance: false }

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
  /** HOW LOPSIDED that unprotected area is about the shape's own middle, 0 (even) to 1 (all on one
   *  side). Dan's balance law: one large flap on one side is worse than two small ones either
   *  side, even though both leave the same total bare. */
  imbalance: number
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

/** CORNER HOLDS — the ends of a span, not the vertices of an outline.
 *
 *  Dan, 2026-08-31: "Corners rule is not about the vertex, it is about even and balanced
 *  distribution similar to extremes. Imagine holding shape like square: the best hold is in the
 *  corners not in middle of each side, cause this keeps corners unprotected flap. If two top
 *  corners hold, mid section will not flap. On free form shape same thing — right and left sides
 *  of the top and bottom make it semantic corner analogue. If the unprotected disk of its material
 *  is 24-48mm... imagine head of the batwoman: it is narrow, the top when it is around 24-48mm
 *  thick is fine and can be held by one magnet disk; when it is larger it becomes more than that
 *  and we need to hold it with min 2 magnets, ideally side extremes closer to the top — corners."
 *
 *  So a corner is a POSITION IN A SPAN: the left and right extremes of the material at the top,
 *  and at the bottom (or the top and bottom extremes of the left and right ends, on a landscape
 *  shape). A span no wider than one disc's reach needs one hold and has no ends to speak of; a
 *  wider one needs a hold at each end, or the far side flaps.
 *
 *  This replaces a vertex-turn test, which measured the outline's geometry rather than how the
 *  material is held — and which called every hold beside a smooth curve a corner. */
function spanEndHolds(
  magnets: ReadonlyArray<Pt>, legalBox: { minX: number; minY: number; maxX: number; maxY: number },
  legal: Paths64, reachMM: number,
): number {
  const w = legalBox.maxX - legalBox.minX, h = legalBox.maxY - legalBox.minY
  const portrait = h >= w
  let held = 0
  // the two extreme strips of the dominant axis — the "top and bottom" of Dan's description
  for (const far of [true, false]) {
    const lo = portrait ? legalBox.minY : legalBox.minX
    const hi = portrait ? legalBox.maxY : legalBox.maxX
    const from = far ? hi - reachMM : lo
    const to = far ? hi : lo + reachMM
    const inStrip = magnets.filter((m) => {
      const along = portrait ? m[1] : m[0]
      return along >= from && along <= to
    })
    if (!inStrip.length) continue
    // THE LOCAL SPAN, not the global box. Dan's batwoman: a wide body with a NARROW head. The head
    // is 36mm across, so one magnet holds it — but the shape's bounding box is the body's width,
    // and measuring that called the head wide and demanded two holds it can never have. The span
    // is the material actually present in this strip, which is what he described.
    const strip = Clipper.makePath(portrait
      ? [Math.round(legalBox.minX * S), Math.round(from * S), Math.round(legalBox.maxX * S), Math.round(from * S),
         Math.round(legalBox.maxX * S), Math.round(to * S), Math.round(legalBox.minX * S), Math.round(to * S)]
      : [Math.round(from * S), Math.round(legalBox.minY * S), Math.round(to * S), Math.round(legalBox.minY * S),
         Math.round(to * S), Math.round(legalBox.maxY * S), Math.round(from * S), Math.round(legalBox.maxY * S)])
    const material = Clipper.intersect(legal, [strip], FillRule.NonZero)
    if (!material || !material.length) continue
    // each connected run of material in that strip is its own span with its own ends
    for (const run of material) {
      const across = run.map((q) => Number(portrait ? q.x : q.y) / S)
      const rLo = Math.min(...across), rHi = Math.max(...across)
      const here = inStrip.filter((m) => {
        const a = portrait ? m[0] : m[1]
        return a >= rLo - 1e-6 && a <= rHi + 1e-6
      })
      if (!here.length) continue
      const at = here.map((m) => (portrait ? m[0] : m[1]))
      if (rHi - rLo <= reachMM) { held++; continue }   // narrow: one hold is the whole answer
      if (Math.min(...at) <= rLo + reachMM) held++
      if (Math.max(...at) >= rHi - reachMM) held++
    }
  }
  return held
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
  /** The GOVERNED CENTRE this answer was wrapped about — the point Dan's centring named. Balance
   *  is measured around it, not the bounding box's midpoint: his rule is about CENTRING the hold,
   *  and the box's middle is not where the engine centres (QA F3). */
  anchorMM: Pt,
  /** The grid pitch. The reach is CLAMPED here, so no caller can widen Dan's 24-48mm by handing in
   *  a 96mm pitch — which is exactly how a 96mm bare end passed as "holding the extremes". */
  pitchMM: number,
  /** The legal region itself — REQUIRED. Rule 1 reads its real boundary: a magnet 5mm from the
   *  inner edge of a U is a perimeter hold, and a bounding box cannot see that, being 71mm away.
   *  The optional box fallback is gone: an API that still permits the implementation a
   *  counterexample disproved is an API that will be used that way (QA F2). */
  legal: Paths64,
): HoldingFacts {
  const reachMM = protectionReachMM(pitchMM)
  const w = legalBox.maxX - legalBox.minX, h = legalBox.maxY - legalBox.minY
  // RULE 1 and RULE 3 — PHYSICAL, measured against the legal region's own boundary. The previous
  // version reused the belt's "is this magnet surrounded by neighbours" test, which answers a
  // different question entirely: a lone magnet dead-centre of a 200x200 box counted as a perimeter
  // hold because it had no neighbours (QA F2). A perimeter-side hold is one NEAR AN EDGE.
  // RULE 1 — the real legal boundary. RULE 3 — actual corner FEATURES of the shape.
  const segs = boundarySegments(legal)
  let perimeter = 0
  for (const m of magnets) if (segs.some((sg) => segDistMM(sg, m) <= reachMM)) perimeter++
  // RULE 3 — the ends of a span, not the vertices of an outline (Dan, 2026-08-31)
  const corners = spanEndHolds(magnets, legalBox, legal, reachMM)
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
  // BALANCE — the unprotected area either side of the shape's own middle, on the axis ACROSS the
  // dominant one. Dan's BOT B2: two magnets to the left leave the whole right bare, which is one
  // large lopsided flap; holding the extremes centred leaves a little bare on each side instead.
  // Same law as everything else — what differs is that it compares the two halves rather than the
  // total.
  const midX = anchorMM[0], midY = anchorMM[1]
  const half = (a: number, b: number, c: number, d: number) => {
    if (!gaps.length) return 0
    const cut = Clipper.makePath([Math.round(a * S), Math.round(b * S), Math.round(c * S), Math.round(b * S),
      Math.round(c * S), Math.round(d * S), Math.round(a * S), Math.round(d * S)])
    const part = Clipper.intersect(gaps, [cut], FillRule.NonZero)
    return part && part.length ? areaOf(part) : 0
  }
  const portrait = h >= w
  const one = portrait ? half(legalBox.minX, legalBox.minY, midX, legalBox.maxY)
    : half(legalBox.minX, legalBox.minY, legalBox.maxX, midY)
  const two = portrait ? half(midX, legalBox.minY, legalBox.maxX, legalBox.maxY)
    : half(legalBox.minX, midY, legalBox.maxX, legalBox.maxY)
  const both = one + two
  return {
    perimeter, corners, holdsExtremes,
    topUnprotectedMM2: top && top.length ? areaOf(top) : 0,
    unprotectedMM2,
    imbalance: both > 0 ? Math.abs(one - two) / both : 0,
  }
}

/** ORDER THE OFFERS by whichever PREFERENCES are switched on, WEIGHING THEM EVENLY.
 *
 *  Dan, 2026-08-31, ruling the question that was open: "I don't know what is the best way to. Just
 *  make them apply evenly when on."
 *
 *  So there is no priority. Each enabled rule ranks the offers on its own measure, best first, and
 *  the ranks are added with equal weight — lowest total stands first. Ranks rather than raw values
 *  because the measures have no common unit: a perimeter COUNT and a top-gap AREA in mm2 cannot be
 *  added, and scaling them into each other would be inventing weights he did not give.
 *
 *  What this replaces: a lexicographic chain — perimeter, then corners, then gravity — which meant
 *  perimeter alone decided almost every comparison and gravity was never reached. That chain was
 *  my reading of "in order of the general to more specific"; it is now ruled out.
 *
 *  Ties keep their existing order, so a rule that cannot separate two offers does not disturb
 *  them. */
export function applyHoldingRules<T>(
  offers: ReadonlyArray<T>, factsOf: (o: T) => HoldingFacts | null, rules: HoldingRules,
): T[] {
  // 6 · BALANCE, an ENFORCER — it removes, it does not merely order. Dan, 2026-08-31: "if either
  // option provides unprotected result we must choose centered... one large flap remaining
  // lopsided is worse [than] 2 small on each side, so centering must be also enforcer."
  //
  // Comparative, with no invented threshold: of the answers on the table, the least lopsided
  // stand and the rest go. Ties survive together, so it only ever removes a genuinely worse
  // balance. An answer that cannot be measured is not waved through.
  let pool = [...offers]
  if (rules.balance && pool.length > 1) {
    const scored = pool.map((o) => ({ o, f: factsOf(o) }))
    const measurable = scored.filter((x) => x.f !== null)
    if (measurable.length) {
      const best = Math.min(...measurable.map((x) => x.f!.imbalance))
      pool = measurable.filter((x) => x.f!.imbalance <= best + 1e-9).map((x) => x.o)
    }
  }
  offers = pool
  const enabled: Array<(f: HoldingFacts) => number> = []
  // each returns "lower is better", so one comparator serves every rule
  if (rules.perimeter) enabled.push((f) => -f.perimeter)
  if (rules.corners) enabled.push((f) => -f.corners)
  if (rules.gravity) enabled.push((f) => f.topUnprotectedMM2)
  // 5 · THE ONE LAW: what is left unheld beyond a disc's reach. Weighed evenly with the rest, so
  // it can be run beside them and compared rather than replacing them.
  if (rules.universal) enabled.push((f) => f.unprotectedMM2)
  if (!enabled.length) return [...offers]

  const facts = new Map<T, HoldingFacts | null>()
  for (const o of offers) facts.set(o, factsOf(o))
  const rankSum = new Map<T, number>(offers.map((o) => [o, 0]))
  for (const measure of enabled) {
    // rank on this measure alone: equal values share a rank, so a rule that cannot tell two
    // offers apart contributes nothing to the difference between them
    const scored = offers.map((o) => {
      const f = facts.get(o) ?? null
      return { o, v: f ? measure(f) : Number.POSITIVE_INFINITY }
    }).sort((a, b) => a.v - b.v)
    let rank = 0
    for (let i = 0; i < scored.length; i++) {
      if (i > 0 && scored[i].v !== scored[i - 1].v) rank = i
      rankSum.set(scored[i].o, (rankSum.get(scored[i].o) ?? 0) + rank)
    }
  }
  return [...offers].sort((a, b) => (rankSum.get(a) ?? 0) - (rankSum.get(b) ?? 0))
}
