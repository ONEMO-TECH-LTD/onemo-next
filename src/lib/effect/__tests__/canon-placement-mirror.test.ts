import { describe, it, expect } from 'vitest'
import { registerLayout } from '../units/layout'
import { safeSegments } from '../units/segment'
import { RELEASED_PADDING_MM } from '../grid-magnet-spec'
import type { Contour, Pt } from '../types'

// THE CANON PLACEMENT MUST BE MIRROR-INVARIANT (QA F1, 2026-08-30).
//
// The first wiring displaced the layout by the candidate's UNWRAPPED coordinate instead of the
// phase the lattice is actually built at. On a square the two sets coincide by luck, which is why
// it looked right. On an off-centre rectangle the correspondence reverses and the answer depends
// on which way round the shape is drawn — QA's counterexample was an 80x40 with free [1,2] both
// ways while canon gave [1,1] one way and [2,1] the other.
//
// Measured with the bias restored: 76 of these 120 cases disagree under mirror. With the fix: 0.
// These numbers are why the sweep is here and not a single case — one case can pass by luck.

const ring = (pts: Pt[]): Contour => ({ outer: { pts }, holes: [] })
const CANON: Pt[] = [[-24, 0], [24, 0]]

const seat = (c: Contour, centre: Pt): number[] =>
  registerLayout(c, { pitchMM: 48, paddingMM: RELEASED_PADDING_MM, centreOverrideMM: centre },
    { segments: safeSegments(c, RELEASED_PADDING_MM, 'light'), centres: [centre], ruleTarget: centre },
    CANON).canonSeatings.map((s) => s.length).sort((a, b) => a - b)

const free = (c: Contour, centre: Pt): number[] =>
  registerLayout(c, { pitchMM: 48, paddingMM: RELEASED_PADDING_MM, centreOverrideMM: centre },
    { segments: safeSegments(c, RELEASED_PADDING_MM, 'light'), centres: [centre], ruleTarget: centre },
    CANON).seatings.map((s) => s.length).sort((a, b) => a - b)

describe('the canon is placed at the free search phases, and mirrors agree', () => {
  it("THE COUNTEREXAMPLE: 80x40, centre 24mm off — biased gives [1,1] vs [1,2]", () => {
    const c = ring([[0, 0], [80, 0], [80, 40], [0, 40]])
    const a = seat(c, [40 + 24, 20]), b = seat(c, [40 - 24, 20])
    expect(b, 'mirroring the centre changed the canon placement').toEqual(a)
    // and the free search was never the problem — it must stay invariant too
    expect(free(c, [40 - 24, 20]), 'the FREE search moved').toEqual(free(c, [40 + 24, 20]))
  })

  it('SWEEP: no mirrored centre changes the canon, across 120 rectangles', () => {
    const bad: string[] = []
    for (const w of [80, 96, 104, 120, 136]) for (const h of [40, 48, 56, 72])
      for (const off of [0, 6, 12, 18, 24, 30]) {
        const c = ring([[0, 0], [w, 0], [w, h], [0, h]])
        const a = seat(c, [w / 2 + off, h / 2]), b = seat(c, [w / 2 - off, h / 2])
        if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${w}x${h} off ${off}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`)
      }
    expect(bad, 'mirrored centres disagree — the placement is directionally biased').toEqual([])
  }, 60_000)

  it('every canon seating sits on a phase the free search also builds', () => {
    // The canon may not invent a grid position of its own; that is the point of plugging it in.
    const pitch = 48
    const ph = (pts: readonly Pt[]) => pts.length
      ? `${(((pts[0][0] % pitch) + pitch) % pitch).toFixed(3)},${(((pts[0][1] % pitch) + pitch) % pitch).toFixed(3)}` : ''
    for (const off of [0, 12, 24, 30]) {
      const c = ring([[0, 0], [120, 0], [120, 72], [0, 72]])
      const centre: Pt = [60 + off, 36]
      const r = registerLayout(c, { pitchMM: 48, paddingMM: RELEASED_PADDING_MM, centreOverrideMM: centre },
        { segments: safeSegments(c, RELEASED_PADDING_MM, 'light'), centres: [centre], ruleTarget: centre }, CANON)
      const phases = new Set(r.seatings.map(ph))
      for (const s of r.canonSeatings)
        expect(phases.has(ph(s)), `canon phase ${ph(s)} is not one the free search builds`).toBe(true)
    }
  })
})
