import { describe, it, expect } from 'vitest'
import { legalRegion, legalRegionBoxMM } from '../units/classifier'
import {
  applyHoldingRules, holdingFactsOf, unprotectedRegions, NO_HOLDING_RULES, UNPROTECTED_REACH_MM,
} from '../units/judge'
import { BANDS, RELEASED_PADDING_MM } from '../grid-magnet-spec'
import { wrapBandLadder } from '../grid-magnet-wrap-compute'
import type { Contour, Pt } from '../types'

// DAN'S UNPROTECTED-AREA RULES (2026-08-30). Rule 2 says "must be held" — it REJECTS. Rules 1, 3
// and 4 say "preferred" — they ORDER. That split is his wording, not a design choice, and it is
// what "a filter as well as an enforcer" means.
//
// Why any of it exists: both answers he rejected — the bot's bare leg, the arm with a magnet
// touching beside an empty seat — are LAWFUL WRAPS. Wrap is satisfied the moment its magnets touch
// an edge, so nothing else in the engine can tell a good answer from a bare one.

const ring = (pts: Pt[]): Contour => ({ outer: { pts }, holes: [] })
/** A tall rectangle: portrait, so the extremes are top and bottom. */
const tall = ring([[0, 0], [140, 0], [140, 260], [0, 260]])

const factsFor = (magnets: Pt[]) => {
  const region = legalRegion(tall, RELEASED_PADDING_MM)
  const box = legalRegionBoxMM(tall, RELEASED_PADDING_MM)!
  const gaps = unprotectedRegions(region, magnets, UNPROTECTED_REACH_MM)
  return holdingFactsOf(magnets, box, gaps, 48)
}

describe("Dan's holding rules: rule 2 enforces, rules 1/3/4 order", () => {
  it('RULE 2 — a population that does not reach both ends is REJECTED, and only when it is on', () => {
    // clustered near the bottom: lawful wrap, does not hold the extremes
    const clustered: Pt[] = [[30, 20], [110, 20], [30, 68], [110, 68]]
    // the same four spread to the ends
    const spread: Pt[] = [[30, 20], [110, 20], [30, 236], [110, 236]]
    expect(factsFor(clustered).holdsExtremes, 'clustered must not count as holding the extremes').toBe(false)
    expect(factsFor(spread).holdsExtremes, 'spread reaches both ends').toBe(true)

    const offers = [clustered, spread]
    const facts = (o: Pt[]) => factsFor(o)
    expect(applyHoldingRules(offers, facts, { ...NO_HOLDING_RULES, extremes: true }),
      'the enforcer must drop the clustered answer').toEqual([spread])
    expect(applyHoldingRules(offers, facts, NO_HOLDING_RULES),
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
    expect(factsFor(block).perimeter, 'eight of nine sit on the rim; the middle one does not').toBe(8)
    // an all-rim population: every magnet is a perimeter hold
    const ringOnly: Pt[] = block.filter(([x, y]) => !(x === 70 && y === 128))
    expect(factsFor(ringOnly).perimeter, 'with the centre gone all eight are rim').toBe(8)
    // and the rule prefers the population with more of them
    const sparse: Pt[] = [[70, 128], [70, 80]]
    expect(applyHoldingRules([sparse, ringOnly], factsFor, { ...NO_HOLDING_RULES, perimeter: true })[0],
      'more perimeter holds must stand first').toEqual(ringOnly)
  })

  it("THE THRESHOLD IS HIS, and it is applied by subtraction so it cannot be fudged", () => {
    expect(UNPROTECTED_REACH_MM, "the far end of Dan's 24-48mm").toBe(48)
    const spread: Pt[] = [[30, 20], [110, 20], [30, 236], [110, 236]]
    const region = legalRegion(tall, RELEASED_PADDING_MM)
    // four magnets at the corners of a 116x236 legal area leave the middle unheld
    expect(unprotectedRegions(region, spread, UNPROTECTED_REACH_MM).length,
      'a 140x260 rectangle held only at its corners must report a hole').toBeGreaterThan(0)
    // and a dense population leaves none: the same call, the same threshold, the opposite answer
    const dense: Pt[] = []
    for (let x = 20; x <= 120; x += 40) for (let y = 20; y <= 240; y += 40) dense.push([x, y])
    expect(unprotectedRegions(region, dense, UNPROTECTED_REACH_MM).length,
      'a dense population must leave nothing beyond the threshold').toBe(0)
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

  it('a rule ON changes what the ladder returns', () => {
    const off = run(NO_HOLDING_RULES)
    const perimeter = run({ ...NO_HOLDING_RULES, perimeter: true })
    expect(perimeter, 'the perimeter rule did not reach the ladder — the toggle is inert')
      .not.toEqual(off)
    // and it reorders rather than deleting: the same answers, a different order
    expect([...perimeter].sort(), 'a preference must not remove an offer').toEqual([...off].sort())
  }, 60_000)
})
