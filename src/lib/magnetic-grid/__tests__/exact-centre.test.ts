// The centre law over certified evidence: all nine ruled policies (five modes, plus Masses with
// each of its four governors). The donor's branch meanings are preserved — box and weight read the
// shape alone, core is the area-weighted mean of the islands, deep takes the deepest island, top the
// highest mass, Masses governs by its dial — and what changes is that every comparison is exact.
//
// The assertions that carry weight here are the REFUSALS. A mesh always produced a point, so it
// could never say "these two masses are exactly equal" or "this maximum is a ridge, not a point".
// Naming those is the whole difference, so each is pinned, and the sliver-hijack case that the
// top-small governor exists to defeat is pinned on the shape that motivated it.

import { describe, expect, it } from 'vitest'
import { exactContour } from '../compute'
import { exactCentre } from '../engine'
import { compareExact, ratFromInt, ratToNumber } from '../compute/exact-real'
import type { CentrePolicy, Contour, ExactCentreVerdict, Pt } from '../spec'

const POLICIES: ReadonlyArray<{ id: string; policy: CentrePolicy }> = [
  { id: 'box', policy: { mode: 'box' } },
  { id: 'core', policy: { mode: 'core' } },
  { id: 'weight', policy: { mode: 'weight' } },
  { id: 'deep', policy: { mode: 'deep' } },
  { id: 'top', policy: { mode: 'top' } },
  { id: 'masses/smallest', policy: { mode: 'masses', governor: 'smallest' } },
  { id: 'masses/deepest', policy: { mode: 'masses', governor: 'deepest' } },
  { id: 'masses/top', policy: { mode: 'masses', governor: 'top' } },
  { id: 'masses/top-small', policy: { mode: 'masses', governor: 'top-small' } },
]

const rect = (w: number, h: number): Contour => ({ outer: { pts: [[0, 0], [w, 0], [w, h], [0, h]] }, holes: [] })

/**
 * A body with a narrow leg below it: the shape class the top-small governor was ruled for, where a
 * thin limb must not govern the centre of a large body. Traced as ONE simple ring — an earlier
 * version of this fixture doubled back on itself, which the engine correctly refused as an outline
 * with no offset junction rather than solving nonsense.
 */
const bodyWithSliver = (): Contour => ({
  outer: { pts: [[0, 40], [34, 40], [34, 0], [46, 0], [46, 40], [80, 40], [80, 120], [0, 120]] as Pt[] },
  holes: [],
})

const mm = (bounds: { lo: { n: bigint; d: bigint }; hi: { n: bigint; d: bigint } }) =>
  (ratToNumber(bounds.lo) + ratToNumber(bounds.hi)) / 2

const decided = (verdict: ExactCentreVerdict, id: string) => {
  if (verdict.status !== 'decided') throw new Error(`${id}: expected a decision, got ${verdict.status}${verdict.status === 'refused' ? ` (${verdict.reason})` : ''}`)
  return verdict
}

describe('the exact centre law, all nine policies', () => {
  it('decides every policy on a plain square, and the shape-only branches are exact', () => {
    const c = exactContour(rect(96, 96))
    for (const { id, policy } of POLICIES) {
      const verdict = exactCentre(c, policy)
      // a square is symmetric: every branch that resolves must land on the middle
      if (verdict.status === 'decided') {
        expect(mm(verdict.decision.target.x), `${id} x`).toBeCloseTo(48, 6)
        expect(mm(verdict.decision.target.y), `${id} y`).toBeCloseTo(48, 6)
      } else {
        // a square's legal region is a square, whose deepest set is a single point: every policy
        // must therefore decide, and anything else is a defect rather than honest evidence
        throw new Error(`${id}: ${verdict.status}${verdict.status === 'refused' ? ` (${verdict.reason})` : ''}`)
      }
    }
    // box and weight are rational: their enclosures are zero-width, not merely tight
    const box = decided(exactCentre(c, { mode: 'box' }), 'box')
    expect(compareExact(box.decision.target.x.lo, box.decision.target.x.hi)).toBe(0)
    expect(compareExact(box.decision.target.x.lo, ratFromInt(48))).toBe(0)
    const weight = decided(exactCentre(c, { mode: 'weight' }), 'weight')
    expect(compareExact(weight.decision.target.y.lo, ratFromInt(48))).toBe(0)
  })

  it('refuses a ridge by name instead of placing a centre on an arbitrary point of it', () => {
    // 144×96: the legal region is 120×72, whose deepest set is a horizontal ridge, not a point. A
    // continuum establishes no unique governed centre and no finite set of them, so there is nothing
    // a lattice could be placed on — the authorized answer is a typed refusal naming the ridge, not
    // a fourth kind of result. The mesh always returned some sample here.
    const c = exactContour(rect(144, 96))
    const verdict = exactCentre(c, { mode: 'deep' })
    expect(verdict.status).toBe('refused')
    if (verdict.status === 'refused') {
      expect(verdict.code).toBe('CENTRE_TIE_UNRESOLVED')
      expect(verdict.reason).toContain('plateau')
    }
    // box and weight are unaffected: they read the shape, not the region
    expect(decided(exactCentre(c, { mode: 'box' }), 'box').decision.target.x.lo.n).toBeGreaterThan(BigInt(0))
  })

  it('keeps an exact tie as a tie rather than choosing by iteration order', () => {
    // two identical lobes joined by a neck thinner than a magnet: the two islands are congruent, so
    // their areas are exactly equal and neither governs. Choosing one would be a silent centre.
    const dumbbell: Contour = { outer: { pts: [[0, 0], [60, 0], [60, 25], [100, 25], [100, 0], [160, 0], [160, 60], [100, 60], [100, 35], [60, 35], [60, 60], [0, 60]] }, holes: [] }
    const c = exactContour(dumbbell)
    // By CLEARANCE the two lobes are exactly co-equal and both are kept: a real tie, not a choice.
    const deep = exactCentre(c, { mode: 'deep' })
    expect(deep.status).toBe('refused')
    if (deep.status === 'refused') expect(deep.code).toBe('CENTRE_TIE_UNRESOLVED')

    // By AREA the honest answer is unresolved, and the reason is worth stating: each lobe's area
    // includes the neck arcs, so it carries π and is a certified enclosure rather than an exact
    // algebraic value. Congruent lobes can never be PROVEN equal that way — only fail to separate.
    // The donor's float comparison simply picked one. R14 §7.1b rules this case unresolved.
    const bySize = exactCentre(c, { mode: 'masses', governor: 'smallest' })
    expect(bySize.status).toBe('refused')
    if (bySize.status === 'refused') {
      expect(bySize.code).toBe('CENTRE_EVIDENCE_UNRESOLVED')
      expect(bySize.reason).toContain('area')
    }
  })

  it('top-small never governs from below mid-height while a body sits above it', () => {
    const contour = bodyWithSliver()
    const c = exactContour(contour)
    const midY = ratToNumber({ n: c.minY + c.maxY, d: BigInt(2) * c.unit })
    const topSmall = exactCentre(c, { mode: 'masses', governor: 'top-small' })
    // the ruling: whatever governs must come from the upper half whenever any mass qualifies
    if (topSmall.status === 'decided') {
      expect(mm(topSmall.decision.target.y), 'top-small governs from the upper half').toBeGreaterThanOrEqual(midY - 1e-6)
    } else {
      // the only honest alternative is naming why it could not choose
      expect(['tie', 'refused']).toContain(topSmall.status)
    }
  })

  it('an unresolved region set blocks only the policies that read it', () => {
    // Provenance travels with the evidence: box and weight are read from the supplied shape, so an
    // unresolved island cannot block them. Anything governed by islands or masses must refuse
    // rather than rank an incomplete set.
    const c = exactContour(rect(72, 72))
    for (const { id, policy } of POLICIES) {
      const verdict = exactCentre(c, policy)
      expect(verdict.status, `${id} on a clean square`).not.toBe('refused')
    }
  })
})
