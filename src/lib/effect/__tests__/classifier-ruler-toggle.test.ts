import { describe, it, expect } from 'vitest'
import { classifyBands } from '../grid-magnet'
import { optimalLayoutForBox } from '../grid-magnet-library-catalogue'
import { RELEASED_PADDING_MM } from '../grid-magnet-spec'
import type { Contour, Pt } from '../types'

// BOTH RULERS, ON THE SAME SHAPE (Dan, 2026-08-30: "i prefer testing both"). A test instrument,
// not a preference: 'legal' is the released behaviour — the exact Clipper2 legal region — and
// 'outer' is the outline's own box less the rim, i.e. what the shape WOULD carry if its material
// reached its outline. They agree on solid shapes and diverge on hollow ones, and seeing that
// divergence on real cutouts is the point.

const ring = (pts: Pt[]): Contour => ({ outer: { pts }, holes: [] })
const sq = (mm: number): Contour => ring([[0, 0], [mm, 0], [mm, mm], [0, mm]])

/** A wide, hollow shape: a bar with two thin arms — the butterfly's problem in miniature. */
const winged = (mm: number): Contour => {
  const s = mm / 100
  return ring(([[0, 44], [30, 44], [38, 0], [62, 0], [70, 44], [100, 44],
    [100, 56], [70, 56], [62, 100], [38, 100], [30, 56], [0, 56]] as Pt[])
    .map(([x, y]) => [x * s, y * s] as Pt))
}

const box = (c: (mm: number) => Contour, ruler: 'legal' | 'outer', band: number) =>
  classifyBands(c, { pitchMM: 48, paddingMM: RELEASED_PADDING_MM, classifierRuler: ruler })
    .find((r) => r.bandId === band)

describe('the classifier ruler is switchable, and the switch changes the answer', () => {
  it('SOLID: on a square the two rulers agree exactly — outline minus the rim, both ways', () => {
    for (const band of [3, 4, 5]) {
      const l = box(sq, 'legal', band)!, o = box(sq, 'outer', band)!
      expect(o.legalWidthMM, `B${band} width`).toBeCloseTo(l.legalWidthMM, 6)
      expect(o.legalHeightMM, `B${band} height`).toBeCloseTo(l.legalHeightMM, 6)
      expect(l.legalWidthMM, `B${band} is outline minus the rim`)
        .toBeCloseTo(l.seedMM - 2 * RELEASED_PADDING_MM, 6)
    }
  })

  it('HOLLOW: the rulers disagree, and the disagreement reaches the canon', () => {
    const l = box(winged, 'legal', 3)!, o = box(winged, 'outer', 3)!
    // the outer ruler cannot see that the arms hold nothing, so it reads a larger box
    expect(o.legalWidthMM, 'outer must read at least as wide as legal').toBeGreaterThan(l.legalWidthMM)
    const lo = optimalLayoutForBox(48, 3, l.legalWidthMM, l.legalHeightMM)
    const oo = optimalLayoutForBox(48, 3, o.legalWidthMM, o.legalHeightMM)
    // the whole reason the switch exists: one ruler names a record where the other names none,
    // or names a bigger one. If this ever stops being true the instrument is measuring nothing.
    expect(`${lo?.frameCols}x${lo?.frameRows}` === `${oo?.frameCols}x${oo?.frameRows}`,
      'both rulers named the same record — the switch would be inert on this shape').toBe(false)
  })

  it("DEFAULT IS THE RELEASED RULER: omitting the flag equals 'legal', never 'outer'", () => {
    const dflt = classifyBands(winged, { pitchMM: 48, paddingMM: RELEASED_PADDING_MM })
    const legal = classifyBands(winged, { pitchMM: 48, paddingMM: RELEASED_PADDING_MM, classifierRuler: 'legal' })
    expect(dflt.map((r) => r.legalWidthMM.toFixed(6)))
      .toEqual(legal.map((r) => r.legalWidthMM.toFixed(6)))
  })
})
