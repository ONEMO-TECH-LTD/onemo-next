// R14 §7.3: "Reuse changes cost only; certificates and results are byte-identical with caches
// disabled." Timing is not that proof. These fixtures run the same certified work with the memo
// switched OFF and ON and compare the values themselves — enclosures at every precision, exact
// signs, quadratic normal forms, and the full clearance-maximum records including their expression
// trees. A memo that ever returned a stale or differently-rounded value fails here, not in a
// downstream answer nobody traced back.

import { afterEach, describe, expect, it } from 'vitest'
import {
  asQuadratic, cAdd, cDiv, cInt, cMul, cRat, cSqrt, cSub, certifiedMemo, evaluate, resetCertifiedMemo,
  signOf, type CReal,
} from '../compute/certified-real'
import { exactContour, toUnits } from '../compute/clearance'
import { clearanceMaximum } from '../compute/deepest'
import { rational } from '../compute/exact-real'
import { exactRegions } from '../compute/region'
import type { Contour } from '../spec'

const third = cDiv(cInt(1), cInt(3))
const root2 = cSqrt(cInt(2))
const EXPRESSIONS: ReadonlyArray<{ id: string; e: CReal }> = [
  // rational only — decided exactly, zero width
  { id: 'rational', e: cSub(cMul(third, cInt(3)), cInt(1)) },
  { id: 'rational-deep', e: cAdd(cMul(third, third), cDiv(cRat(rational(BigInt(7), BigInt(9))), cInt(5))) },
  // one radical — decided by the quadratic normal form
  { id: 'single-radical', e: cSub(cMul(root2, root2), cInt(2)) },
  { id: 'single-radical-order', e: cSub(cMul(cInt(3), root2), cInt(4)) },
  // a shared subtree reached twice: exactly the shape the memo exists for
  { id: 'shared-subtree', e: cSub(cMul(cAdd(root2, third), cAdd(root2, third)), cMul(root2, cInt(2))) },
  // two distinct radicals — genuinely zero, but the bounds may never exclude zero: must stay undecidable
  { id: 'mixed-radical-undecidable', e: cSub(cMul(cSqrt(cInt(2)), cSqrt(cInt(3))), cSqrt(cInt(6))) },
  { id: 'nested-radical', e: cSub(cSqrt(cAdd(cInt(1), root2)), cInt(1)) },
]
const PRECISIONS = [BigInt(8), BigInt(16), BigInt(32), BigInt(64), BigInt(128), BigInt(256), BigInt(512), BigInt(1024)]

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? `${v}n` : v))

/** Run `work` with the memo off, then fresh with it on. */
function bothModes<T>(work: () => T): { off: T; on: T } {
  try {
    certifiedMemo(false)
    const off = work()
    certifiedMemo(true)
    return { off, on: work() }
  } finally {
    certifiedMemo(true) // a throw in either mode must not leave the memo disabled
  }
}

describe('certified memo is semantically transparent (R14 §7.3)', () => {
  // a thrown assertion must never leave the module cold for the rest of the suite
  afterEach(() => certifiedMemo(true))

  it('returns identical enclosures at every precision, cached or not', () => {
    for (const { id, e } of EXPRESSIONS) for (const bits of PRECISIONS) {
      const { off, on } = bothModes(() => evaluate(e, bits))
      expect(canonical(on), `${id} @${bits}`).toBe(canonical(off))
    }
  })

  it('returns identical signs and quadratic normal forms, including the undecidable cases', () => {
    for (const { id, e } of EXPRESSIONS) {
      const sign = bothModes(() => signOf(e))
      expect(sign.on, `${id} sign`).toBe(sign.off)
      const quad = bothModes(() => asQuadratic(e))
      expect(canonical(quad.on), `${id} quadratic`).toBe(canonical(quad.off))
    }
    // the mixed-radical case must be undecidable in BOTH modes — a memo must never manufacture a verdict
    expect(bothModes(() => signOf(EXPRESSIONS[5].e)).on).toBeNull()
    expect(bothModes(() => signOf(EXPRESSIONS[5].e)).off).toBeNull()
  })

  it('a warm memo cannot serve a stale value across precisions', () => {
    // ascending then descending: a table keyed only by node (not by precision) would hand the
    // 1024-bit enclosure back for an 8-bit request, or vice versa
    certifiedMemo(true)
    const ascending = PRECISIONS.map((bits) => canonical(evaluate(EXPRESSIONS[4].e, bits)))
    resetCertifiedMemo()
    const descending = [...PRECISIONS].reverse().map((bits) => canonical(evaluate(EXPRESSIONS[4].e, bits))).reverse()
    expect(descending).toEqual(ascending)
  })

  it('produces byte-identical clearance maxima — trees, bounds, cells and reasons', () => {
    const shapes: ReadonlyArray<{ id: string; contour: Contour }> = [
      { id: 'square-certified', contour: { outer: { pts: [[0, 0], [72, 0], [72, 72], [0, 72]] }, holes: [] } },
      { id: 'plateau', contour: { outer: { pts: [[0, 0], [96, 0], [96, 48], [0, 48]] }, holes: [] } },
      { id: 'tie', contour: { outer: { pts: [[0, 0], [100, 0], [100, 100], [0, 100]] }, holes: [{ pts: [[40, 40], [60, 40], [60, 60], [40, 60]] }] } },
      { id: 'two-islands', contour: { outer: { pts: [[0, 0], [60, 0], [60, 25], [100, 25], [100, 0], [160, 0], [160, 60], [100, 60], [100, 35], [60, 35], [60, 60], [0, 60]] }, holes: [] } },
    ]
    for (const shape of shapes) {
      const solve = () => {
        const c = exactContour(shape.contour)
        const ru = toUnits(12, c)
        return exactRegions(c, ru).regions.map((region) => clearanceMaximum(c, region, ru))
      }
      const { off, on } = bothModes(solve)
      expect(canonical(on), shape.id).toBe(canonical(off))
    }
  }, 120_000)
})
