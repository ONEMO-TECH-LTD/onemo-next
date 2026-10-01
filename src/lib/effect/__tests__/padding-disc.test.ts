import { describe, expect, it } from 'vitest'

import { paddingDiscParts, paddingDiscRingMM, paddingDiscSpec } from '../foundation/padding-disc'
import { wrapGroup } from '../units/wrap'
import type { Contour, Pt } from '../types'
import {
  DISC_OFFSET_MM, OFFSET_SQUIRCLE_RADIUS_MM, RELEASED_PADDING_MM, SQUIRCLE_RADIUS_MM,
} from '../grid-magnet-spec'

// Dan, 2026-09-22 — the padding is a square of 2*padding with a corner radius, in three variants.
// The lattice is invisible; the padding disc is what is SEEN, so its shape is engine spec, never a
// drawing choice in a component.
const rim = RELEASED_PADDING_MM        // 12
const cell = (s: ReturnType<typeof paddingDiscSpec>) => 2 * s.halfMM

describe('the padding disc — three spec variants the engine reacts to', () => {
  it('circle · the default is the 24mm cell at full radius, which is the circle drawn today', () => {
    const s = paddingDiscSpec(rim)
    expect(s.shape).toBe('circle')
    expect(cell(s)).toBe(24)
    expect(s.radiusMM, 'full radius is half the cell — that is what makes it a circle').toBe(12)
    expect(paddingDiscParts(s), 'a circle is all round margin, no square core').toEqual({ squareHalfMM: 0, roundMM: 12 })
  })

  it('squircle · 24mm cell, 11mm radius by default', () => {
    const s = paddingDiscSpec(rim, { shape: 'squircle' })
    expect(cell(s)).toBe(24)
    expect(s.radiusMM).toBe(SQUIRCLE_RADIUS_MM)
    expect(paddingDiscParts(s), 'a 1mm square core grown by the 11mm corner').toEqual({ squareHalfMM: 1, roundMM: 11 })
  })

  it('offset · 4mm a side grows the 24mm cell to 32mm, at 12.8mm radius', () => {
    const s = paddingDiscSpec(rim, { shape: 'offset' })
    expect(DISC_OFFSET_MM).toBe(4)
    expect(cell(s), 'the sparse cell Dan draws at the 96 lattice').toBe(32)
    expect(s.radiusMM).toBe(OFFSET_SQUIRCLE_RADIUS_MM)
    expect(paddingDiscParts(s).squareHalfMM).toBeCloseTo(3.2, 6)
  })

  it('THE EDGE PADDING IS NOT A DISC INPUT — the cell is the same however far the line stands off', () => {
    // Dan, 2026-09-22: "the discs are 1 category of the additions the edge padding is another",
    // and "the line that wraps the grid must be padded = edge padding". One number feeding both
    // drew a released square as a four-petal blob at 24mm.
    const bare = paddingDiscSpec(rim, { shape: 'squircle' })
    // there is no edgePaddingMM option to pass — the type forbids it, and the cell is unchanged
    expect(cell(bare)).toBe(24)
    expect(cell(paddingDiscSpec(rim, { shape: 'squircle', discOffsetMM: 0 }))).toBe(24)
    expect(cell(paddingDiscSpec(rim, { shape: 'offset', discOffsetMM: 0 })), 'offset at zero is a 24mm cell').toBe(24)
    expect(cell(paddingDiscSpec(rim, { shape: 'circle', discOffsetMM: 4 })), 'any mode may be offset').toBe(32)
  })

  it('a radius past half the cell is clamped — a square cannot round further than a circle', () => {
    expect(paddingDiscSpec(rim, { shape: 'squircle', radiusMM: 99 }).radiusMM).toBe(12)
    expect(paddingDiscParts(paddingDiscSpec(rim, { shape: 'squircle', radiusMM: 99 })).squareHalfMM).toBe(0)
  })

  it('the ring is real geometry, and its extent is the cell it was asked for', () => {
    for (const shape of ['circle', 'squircle', 'offset'] as const) {
      const s = paddingDiscSpec(rim, { shape })
      const ring = paddingDiscRingMM(s)
      expect(ring.length, shape + ' must produce a closed ring').toBeGreaterThan(8)
      const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1])
      expect(Math.max(...xs) - Math.min(...xs), shape + ' width').toBeCloseTo(cell(s), 6)
      expect(Math.max(...ys) - Math.min(...ys), shape + ' height').toBeCloseTo(cell(s), 6)
    }
  })
})

// Dan, 2026-09-22: "the main point is to have true shapes and wrap engine to react to that shape not
// circle - there will be points where circle fits and square does not and vice versa". One magnet, a
// 24mm squircle at 5mm corners: the wrap must clear THAT shape, not the circle round it.
describe('the wrap reacts to the true disc shape, not a circle round it', () => {
  const squircle = { paddingShape: 'squircle' as const, paddingRadiusMM: 5 }
  const at: Pt = [0, 0]
  const tight = (outline: (mm: number) => Contour, cfg: object) =>
    wrapGroup(outline, { anchorAtMM: () => at, paddingMM: rim, ...cfg }, [at], 10, 120)!.sizeMM
  const square = (mm: number): Contour => ({ outer: { pts: [[-mm / 2, -mm / 2], [mm / 2, -mm / 2], [mm / 2, mm / 2], [-mm / 2, mm / 2]] }, holes: [] })
  const diamond = (mm: number): Contour => ({ outer: { pts: [[0, -mm / 2], [mm / 2, 0], [0, mm / 2], [-mm / 2, 0]] }, holes: [] })

  it('a square outline holds the squircle at its own 24mm — the circle round it would need 29.8', () => {
    // reach across the corner is hypot(7,7) + 5 = 14.9; a reach circle wraps to 29.8
    expect(tight(square, squircle)).toBeCloseTo(24, 0)
    expect(tight(square, squircle)).toBeLessThan(25)
  })

  it('a diamond refuses the squircle where the 24mm circle fits — its corner points at the edge', () => {
    // the circle clears a diamond at 12*2*sqrt2 = 33.9; the squircle's corner needs (7*sqrt2 + 5)*2*sqrt2 = 42.1
    const circle = tight(diamond, {})
    const sq = tight(diamond, squircle)
    expect(circle).toBeCloseTo(24 * Math.SQRT2, 0)
    expect(sq).toBeCloseTo((7 * Math.SQRT2 + 5) * 2 * Math.SQRT2, 0)
    expect(sq).toBeGreaterThan(circle + 5)
  })

  it('the edge padding is not the wrap\'s business — the true-shape fit is the same at any dial', () => {
    // it pads the line the wrap found (wrapGrid), never the clearance the wrap searches with
    expect(tight(square, { ...squircle, edgePaddingMM: 24 })).toBe(tight(square, squircle))
  })
})

