// ADAPT proof (R14 §3): the exact clearance kernel is the moved seat predicate
// (grid-engine/compute/geometry `atLeast`/`locate`) with its 0.001mm rounding quantum removed in
// favour of a lossless integer lift. On inputs the donor represents exactly, both must agree on
// every point; where the donor rounds, the adapted kernel must be the one telling the truth.

import { describe, expect, it } from 'vitest'
import { holds, prepare } from '../../grid-engine/compute/geometry'
import { exactContour, insideContour, nearestDist2, toUnits } from '../compute/clearance'
import { compareExact, ratFromInt } from '../compute/exact-real'
import type { Contour } from '../spec'

const shapes: Record<string, Contour> = {
  square: { outer: { pts: [[0, 0], [72, 0], [72, 72], [0, 72]] }, holes: [] },
  wedge: { outer: { pts: [[0, 0], [90, 0], [90, 30], [30, 30], [30, 60], [0, 60]] }, holes: [] },
  oblique: { outer: { pts: [[0, 0], [80, 10], [70, 65], [5, 50]] }, holes: [] },
}

function seatsExact(contour: Contour, x: number, y: number, r: number): boolean {
  const c = exactContour(contour)
  const px = toUnits(x, c), py = toUnits(y, c), ru = toUnits(r, c)
  if (!insideContour(px, py, c)) return false
  return compareExact(nearestDist2(px, py, c).d2, ratFromInt(ru * ru)) >= 0
}

describe('clearance kernel ≡ donor seat predicate (ADAPT equivalence)', () => {
  it('agrees with the donor on every integer-mm point of donor-exact shapes', () => {
    for (const [name, contour] of Object.entries(shapes)) {
      const donor = prepare(contour.outer.pts, 1) // integer-mm quantum: donor is exact here
      let checked = 0
      for (let x = -2; x <= 92; x += 1) for (let y = -2; y <= 74; y += 1) {
        // donor treats boundary ('ON') as inside; the kernel's parity test does not — compare where the donor is IN/OUT strictly
        const onBoundary = nearestDist2(toUnits(x, exactContour(contour)), toUnits(y, exactContour(contour)), exactContour(contour)).d2.n === BigInt(0)
        if (onBoundary) continue
        expect(seatsExact(contour, x, y, 12), `${name} (${x},${y})`).toBe(holds(donor, [x, y], 12))
        checked++
      }
      expect(checked).toBeGreaterThan(5000)
    }
  })

  it('keeps tangency by equality exactly where the donor does', () => {
    // 72 square: a 12mm disc centred at (12,12) is tangent to two sides — legal in both
    expect(seatsExact(shapes.square, 12, 12, 12)).toBe(true)
    expect(holds(prepare(shapes.square.outer.pts, 1), [12, 12], 12)).toBe(true)
    // and one lift-unit short (2^-12 mm) is illegal in the exact kernel, one quantum short in the donor
    expect(seatsExact(shapes.square, 12 - 2 ** -12, 12, 12)).toBe(false)
    expect(holds(prepare(shapes.square.outer.pts, 0.001), [11999, 12000], 12000)).toBe(false)
  })

  it('tells the truth where the donor rounds: a coordinate the quantum cannot hold', () => {
    // centre 2^-12 mm (0.000244) short of tangency: the donor's 0.001 quantum rounds it onto the
    // tangent line and calls the disc legal; the lossless kernel sees the shortfall and refuses.
    const short = 12 - 2 ** -12
    expect(holds(prepare(shapes.square.outer.pts, 0.001), [Math.round(short / 0.001), 20000], 12000)).toBe(true)
    expect(seatsExact(shapes.square, short, 20, 12)).toBe(false)
  })
})
