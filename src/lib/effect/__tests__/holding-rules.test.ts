import { describe, it, expect } from 'vitest'
import { legalRegion, legalRegionBoxMM } from '../units/classifier'
import {
  applyHoldingRules, holdingFactsOf, unprotectedRegions, NO_HOLDING_RULES, protectionReachMM,
} from '../units/judge'
import { BANDS, RELEASED_PADDING_MM } from '../grid-magnet-spec'
import { wrapBandLadder } from '../grid-magnet-wrap-compute'
import type { Contour, Pt } from '../types'
import { Clipper, FillRule } from '@countertype/clipper2-ts'

// DAN'S UNPROTECTED-AREA RULES (2026-08-30). Rule 2 says "must be held" — it REJECTS. Rules 1, 3
// and 4 say "preferred" — they ORDER. That split is his wording, not a design choice, and it is
// what "a filter as well as an enforcer" means.
//
// Why any of it exists: both answers he rejected — the bot's bare leg, the arm with a magnet
// touching beside an empty seat — are LAWFUL WRAPS. Wrap is satisfied the moment its magnets touch
// an edge, so nothing else in the engine can tell a good answer from a bare one.

const ring = (pts: Pt[]): Contour => ({ outer: { pts }, holes: [] })
/** Dan's protection reach at the released 48mm pitch — clamped to his own 24-48mm. */
const REACH = protectionReachMM(48)
/** A tall rectangle: portrait, so the extremes are top and bottom. */
const tall = ring([[0, 0], [140, 0], [140, 260], [0, 260]])

const factsFor = (magnets: Pt[], shape: Contour = tall) => {
  const region = legalRegion(shape, RELEASED_PADDING_MM)!
  const box = legalRegionBoxMM(shape, RELEASED_PADDING_MM)!
  const gaps = unprotectedRegions(region, magnets, REACH)
  return holdingFactsOf(magnets, box, gaps, 48, region, [shape.outer.pts, ...shape.holes.map((h) => h.pts)])
}

const signedAreaMM2 = (paths: NonNullable<ReturnType<typeof legalRegion>>) => {
  let a2 = 0
  for (const path of paths) for (let i = 0, j = path.length - 1; i < path.length; j = i++)
    a2 += Number(path[j].x) * Number(path[i].y) - Number(path[i].x) * Number(path[j].y)
  return Math.abs(a2 / 2) / 1_000_000
}

describe("Dan's holding rules: rule 2 enforces, rules 1/3/4 order", () => {
  it('RULE 2 — a population that does not reach both ends is REJECTED, and only when it is on', () => {
    // clustered near the bottom: lawful wrap, does not hold the extremes
    const clustered: Pt[] = [[30, 20], [110, 20], [30, 68], [110, 68]]
    // the same four spread to the ends
    const spread: Pt[] = [[30, 20], [110, 20], [30, 236], [110, 236]]
    expect(factsFor(clustered).holdsExtremes, 'clustered must not count as holding the extremes').toBe(false)
    expect(factsFor(spread).holdsExtremes, 'spread reaches both ends').toBe(true)

    // The enforcer no longer lives in applyHoldingRules: it now runs on the CANDIDATE POOLS,
    // before optimal/min/max are picked (QA F5). Applied after the collapse it discarded the
    // lawful candidates first — if the chosen max failed while another max-count candidate held
    // the extremes, the row vanished instead of falling back. So this asserts the FACT here, and
    // the ladder test below asserts the filtering where it actually happens.
    const offers = [clustered, spread]
    expect(applyHoldingRules(offers, factsFor, { ...NO_HOLDING_RULES, extremes: true }),
      'applyHoldingRules must NOT remove anything — only order').toEqual(offers)
    expect(applyHoldingRules(offers, factsFor, NO_HOLDING_RULES),
      'with every rule off nothing is removed and nothing is reordered').toEqual(offers)
  })

  it('RULE 4 — gravity: a gap at the TOP is measured apart from one at the bottom', () => {
    const bottomBare: Pt[] = [[30, 200], [110, 200], [30, 236], [110, 236]]   // holds the top
    const topBare: Pt[] = [[30, 20], [110, 20], [30, 56], [110, 56]]          // holds the bottom
    expect(factsFor(topBare).topUnprotectedMM2, 'a bare top must register as top-unprotected')
      .toBeGreaterThan(factsFor(bottomBare).topUnprotectedMM2)
    // and with gravity on, the one that leaves the top bare sinks
    const ruled = applyHoldingRules([topBare, bottomBare], factsFor, { ...NO_HOLDING_RULES, gravity: true })
    expect(ruled[0], 'the answer holding the top must stand first').toEqual(bottomBare)
  })

  it('RULE 3 — corners are counted, and preferred to sides', () => {
    const corners: Pt[] = [[30, 20], [110, 20], [30, 236], [110, 236]]
    const middle: Pt[] = [[70, 128], [70, 80], [70, 176], [70, 32]]
    expect(factsFor(corners).corners, 'four corner holds').toBe(4)
    expect(factsFor(middle).corners, 'a centre column holds no corners').toBe(0)
    expect(applyHoldingRules([middle, corners], factsFor, { ...NO_HOLDING_RULES, corners: true })[0],
      'corners are preferred to sides').toEqual(corners)
  })

  it('RULE 1 — perimeter holds are counted, and preferred to centres', () => {
    // This test existed in name only: it was titled "RULE 1 and RULE 3" and asserted nothing about
    // the perimeter count at all. Found by reading my own diff, not by a failing run — which is
    // exactly the vacuous-test pattern I have shipped twice today.
    //
    // A 3x3 block: the middle magnet is surrounded on all four sides, the other eight are not.
    const block: Pt[] = []
    for (const x of [30, 70, 110]) for (const y of [80, 128, 176]) block.push([x, y])
    // Six, not eight — and my first expectation of eight was the OLD neighbour test talking. In a
    // 116mm-wide legal box the middle COLUMN sits 58mm from either side, past the 48mm reach, so
    // none of its three magnets is a perimeter-side hold. That is the physical answer and it is
    // the point of the repair: rule 1 is about distance to an edge, not about having neighbours.
    expect(factsFor(block).perimeter, 'only the two outer columns are within reach of a side').toBe(6)
    const ringOnly: Pt[] = block.filter(([x, y]) => !(x === 70 && y === 128))
    expect(factsFor(ringOnly).perimeter, 'removing the centre magnet changes nothing — it never counted').toBe(6)
    // and the rule prefers the population with more of them
    const sparse: Pt[] = [[70, 128], [70, 80]]
    expect(applyHoldingRules([sparse, ringOnly], factsFor, { ...NO_HOLDING_RULES, perimeter: true })[0],
      'more perimeter holds must stand first').toEqual(ringOnly)
  })

  it("THE THRESHOLD IS HIS, and it is applied by subtraction so it cannot be fudged", () => {
    expect(REACH, "the far end of Dan's 24-48mm at the released pitch").toBe(48)
    expect(protectionReachMM(96), 'a 96mm pitch must NOT expand his limit').toBe(48)
    expect(protectionReachMM(24), 'nor shrink below his floor').toBe(24)
    const spread: Pt[] = [[30, 20], [110, 20], [30, 236], [110, 236]]
    const region = legalRegion(tall, RELEASED_PADDING_MM)
    // four magnets at the corners of a 116x236 legal area leave the middle unheld
    expect(signedAreaMM2(unprotectedRegions(region, spread, REACH)),
      'a 140x260 rectangle held only at its corners must report a hole').toBeGreaterThan(0)
    // and a dense population leaves none: the same call, the same threshold, the opposite answer
    const dense: Pt[] = []
    for (let x = 20; x <= 120; x += 40) for (let y = 20; y <= 240; y += 40) dense.push([x, y])
    expect(signedAreaMM2(unprotectedRegions(region, dense, REACH)),
      'a dense population must leave nothing beyond the threshold').toBe(0)
  })

  it('THE THRESHOLD: no point inside the true reach survives between disc vertices', () => {
    const shape = ring([[0, 0], [200, 0], [200, 200], [0, 200]])
    const legal = legalRegion(shape, RELEASED_PADDING_MM)!
    const gaps = unprotectedRegions(legal, [[100, 100]], REACH)
    // Halfway between two vertices of the current 64-gon, 0.02mm inside the true 48mm radius.
    const a = Math.PI / 64, d = REACH - 0.02
    const x = 100 + Math.cos(a) * d, y = 100 + Math.sin(a) * d
    const q = 2 // two microns either side
    const probe = Clipper.makePath([
      Math.round(x * 1000) - q, Math.round(y * 1000) - q,
      Math.round(x * 1000) + q, Math.round(y * 1000) - q,
      Math.round(x * 1000) + q, Math.round(y * 1000) + q,
      Math.round(x * 1000) - q, Math.round(y * 1000) + q,
    ])
    expect(signedAreaMM2(Clipper.intersect(gaps, [probe], FillRule.NonZero))).toBe(0)
  })

  it('HOLES: unprotected area never exceeds the legal material', () => {
    const donut: Contour = {
      outer: { pts: [[0, 0], [300, 0], [300, 300], [0, 300]] },
      holes: [{ pts: [[100, 100], [200, 100], [200, 200], [100, 200]] }],
    }
    const legal = legalRegion(donut, RELEASED_PADDING_MM)!
    const gapArea = signedAreaMM2(unprotectedRegions(legal, [[30, 30]], REACH))
    expect(gapArea).toBeLessThanOrEqual(signedAreaMM2(legal))
  })

  it('RULE 1: a lone centre magnet is not a perimeter-side hold', () => {
    const sq = ring([[0, 0], [224, 0], [224, 224], [0, 224]])   // legal box is 12..212
    expect(factsFor([[112, 112]], sq).perimeter,
      'a lone magnet 100mm from every edge is not a perimeter-side hold').toBe(0)
  })

  it('RULE 1: a hold beside a concave legal-region edge is a perimeter hold', () => {
    // U-shape: after the 12mm inset, the left arm's inner legal edge is x=88. The magnet is 5mm
    // from that real edge but 71mm from the legal bounding box's nearest edge. A box-only rule
    // therefore misses precisely the concave perimeter Dan asked the Clipper defender to see.
    const u = ring([[0, 0], [300, 0], [300, 300], [200, 300], [200, 100],
      [100, 100], [100, 300], [0, 300]])
    // QA's own repair says the fact seam must RECEIVE the legal path set; their test omitted it,
    // and with only a box the answer cannot be 1 by construction. Passing the region, as their
    // repair specifies.
    // The box-only fallback is GONE (QA F2): an API that still permits an implementation a
    // counterexample disproved is an API that will be used that way. `legal` is now required.
    expect(factsFor([[83, 200]], u).perimeter,
      '5mm from the concave legal edge is a perimeter hold; a bbox is 71mm away and blind').toBe(1)
  })

  it('RULE 3: a smooth circular boundary is not a corner', () => {
    const pts: Pt[] = []
    for (let i = 0; i < 96; i++) {
      const a = i * Math.PI * 2 / 96
      pts.push([100 + 100 * Math.cos(a), 100 + 100 * Math.sin(a)])
    }
    const circle = ring(pts)
    expect(factsFor([[180, 100]], circle).corners,
      'a smooth boundary has no corner feature, however many segments lie within reach').toBe(0)
  })

  it("RULE 2: the 48mm limit does not expand with a 96mm pitch", () => {
    const strip = ring([[0, 0], [100, 0], [100, 300], [0, 300]])
    expect(factsFor([[50, 95], [50, 205]], strip).holdsExtremes,
      'a 96mm pitch must not stretch the 48mm limit').toBe(false)
  })

  it('RULE 4: measures top area even when it shares one region with the middle', () => {
    const shape = ring([[0, 0], [140, 0], [140, 260], [0, 260]])
    const legal = legalRegion(shape, RELEASED_PADDING_MM)!
    const box = { minX: 12, minY: 12, maxX: 128, maxY: 248 }
    const magnets: Pt[] = [[70, 20]]
    void legal; void box
    expect(factsFor(magnets, shape).topUnprotectedMM2).toBeGreaterThan(0)
  })
})

describe('the toggle REACHES the ladder — not just the pressed state', () => {
  // The ruler toggle shipped inert once today: it was missing from the solve effect's dependency
  // array, so the button changed its own appearance and nothing else. This pins the equivalent for
  // the holding rules at the engine seam, where a UI wiring mistake cannot hide it.
  const bar = (mm: number): Contour => {
    const s = mm / 260
    return { outer: { pts: ([[0, 0], [140, 0], [140, 260], [0, 260]] as Pt[]).map(([x, y]) => [x * s, y * s] as Pt) }, holes: [] }
  }
  const band = BANDS.find((b) => b.id === 4)!
  const anchor = (mm: number): Pt => [mm * 140 / 260 / 2, mm / 2]
  const run = (rules?: { perimeter: boolean; extremes: boolean; corners: boolean; gravity: boolean }) =>
    wrapBandLadder(bar, { pitchMM: 48, paddingMM: RELEASED_PADDING_MM, holdingRules: rules },
      band.minMM + 24, band.maxMM + 24, 24, anchor)
      .offers.map((o) => `${o.roles.join('+')}:${o.at.count}`)

  it('all rules off is the released path, byte for byte', () => {
    expect(run(undefined)).toEqual(run(NO_HOLDING_RULES))
  })

  it('THE ENFORCER IS ACTIVE: 96mm U B3 removes the unheld minimum', () => {
    // The earlier 48mm B2-B5 sweep happened to produce only offers that already held both ends.
    // It was then promoted into a universal "wrap guarantees this" claim. At another released
    // pitch the rule bites: U B3 has min:2 + max:4 with the rule off, and only the held 4 survives.
    const pts: Pt[] = [[0, 0], [300, 0], [300, 300], [200, 300], [200, 100],
      [100, 100], [100, 300], [0, 300]]
    const sized = (mm: number): Contour => ring(pts.map(([x, y]) => [x * mm / 300, y * mm / 300] as Pt))
    const at = (mm: number): Pt => [mm / 2, mm / 2]
    const band = BANDS.find((b) => b.id === 3)!
    const solve = (extremes: boolean) => wrapBandLadder(sized, {
      pitchMM: 96, paddingMM: RELEASED_PADDING_MM,
      holdingRules: { ...NO_HOLDING_RULES, extremes },
    }, band.minMM + 24, band.maxMM + 24, 24, at).offers
      .map((o) => `${o.roles.join('+')}:${o.at.count}`)
    expect(solve(false)).toEqual(['min:2', 'max:4'])
    expect(solve(true)).toEqual(['min+max:4'])
  }, 60_000)

  it("AT 48MM B2-B5: the sampled corpus already holds the extremes", () => {
    // This is a bounded 48mm observation, not a universal wrap invariant; the focused 96mm case
    // above proves the enforcer remains necessary.
    const shapes: Record<string, Pt[]> = {
      tall: [[0, 0], [140, 0], [140, 260], [0, 260]],
      wide: [[0, 0], [260, 0], [260, 140], [0, 140]],
      L: [[0, 0], [260, 0], [260, 90], [90, 90], [90, 260], [0, 260]],
      U: [[0, 0], [300, 0], [300, 300], [200, 300], [200, 100], [100, 100], [100, 300], [0, 300]],
      tri: [[0, 0], [260, 0], [130, 240]],
    }
    let checked = 0
    for (const [name, pts] of Object.entries(shapes)) {
      const spanX = Math.max(...pts.map((p) => p[0])), spanY = Math.max(...pts.map((p) => p[1]))
      const longest = Math.max(spanX, spanY)
      const sized = (mm: number): Contour => ring(pts.map(([x, y]) => [x * mm / longest, y * mm / longest] as Pt))
      const at = (mm: number): Pt => [spanX * mm / longest / 2, spanY * mm / longest / 2]
      for (const id of [2, 3, 4, 5]) {
        const b = BANDS.find((x) => x.id === id)!
        const solve = wrapBandLadder(sized, { pitchMM: 48, paddingMM: RELEASED_PADDING_MM },
          b.minMM + 24, b.maxMM + 24, 24, at)
        for (const o of solve.offers) {
          const c = sized(o.at.sizeMM)
          const region = legalRegion(c, RELEASED_PADDING_MM)
          const box = legalRegionBoxMM(c, RELEASED_PADDING_MM)
          if (!region || !box) continue
          const f = holdingFactsOf(o.at.points, box,
            unprotectedRegions(region, o.at.points, REACH), 48, region,
            [c.outer.pts, ...c.holes.map((h) => h.pts)])
          expect(f.holdsExtremes, `${name} B${id} ${o.roles.join('+')} does NOT hold the extremes`).toBe(true)
          checked++
        }
      }
    }
    expect(checked, 'the corpus produced no offers — this proves nothing').toBeGreaterThan(10)
  }, 300_000)

  it('a rule ON changes what the ladder returns', () => {
    const off = run(NO_HOLDING_RULES)
    const perimeter = run({ ...NO_HOLDING_RULES, perimeter: true })
    expect(perimeter, 'the perimeter rule did not reach the ladder — the toggle is inert')
      .not.toEqual(off)
    // and it reorders rather than deleting: the same answers, a different order
    expect([...perimeter].sort(), 'a preference must not remove an offer').toEqual([...off].sort())
  }, 60_000)
})
