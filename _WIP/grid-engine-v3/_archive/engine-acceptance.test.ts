// ENGINE ACCEPTANCE — the gate Sub 1 must pass. Written by @s62-meta BEFORE the engine exists,
// so it is judged against Dan's law rather than against whatever it turns out to do.
//
// Dan's definition of Sub 1, verbatim:
//   "the ENGINE. Pure computing. Takes a shape and the values, works out the layout and the size."
//
// Every case below cites the clause it enforces. These are the checks that would have caught the
// forty previous versions — not the ones a build passes by accident.
//
// TO ACTIVATE: move into src/lib/grid-engine/__tests__/ and point the import at the real entry.
// It is written against the smallest honest surface: solveLayout(spec, outline) -> Layout.

import { describe, expect, it } from 'vitest'
// import { solveLayout } from '../engine'
// import { RELEASED, applyGridValue, selectPitch } from '../spec'

/** An outline is points in millimetres. A shape is nothing more than that. */
type PointMM = [number, number]

const circle = (dMM: number, n = 240): PointMM[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n
    return [Math.cos(a) * dMM / 2, Math.sin(a) * dMM / 2] as PointMM
  })

/** A shape with two limbs and a gap between them — the case §3.1(b) exists for. */
const twoLimbs = (): PointMM[] => [
  [-60, -80], [-20, -80], [-20, 80], [-60, 80],
  [20, -80], [60, -80], [60, 80], [20, 80],
]

const rotate = (pts: PointMM[], deg: number): PointMM[] => {
  const r = (deg * Math.PI) / 180
  return pts.map(([x, y]) => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)])
}

const scale = (pts: PointMM[], k: number): PointMM[] => pts.map(([x, y]) => [x * k, y * k])

describe.skip('SUB 1 ACCEPTANCE — activate when the engine lands', () => {
  // ── A shape goes in. A layout and a size come out. ────────────────────────
  it('takes an outline and returns a layout AND a size', () => {
    // const out = solveLayout(RELEASED, circle(200))
    // expect(out.sizeMM).toBeGreaterThan(0)
    // expect(out.magnets.length).toBeGreaterThan(0)
    // Law 1.1a: the engine answers with the size. Nothing outside it may choose one.
  })

  // ── §3.2 — BALANCE OUTRANKS SMALLEST. The recorded failure. ───────────────
  it('rejects a tighter layout that bunches magnets into one lobe', () => {
    // On Dan's 162mm star the mathematically smallest four-magnet fit is 130mm, achieved by
    // shoving the four magnets into the fattest lobe. It is arithmetically correct and it is
    // REJECTED ON SIGHT under 3.1(a). A build that returns 130 has failed, however tight it is.
    // const out = solveLayout(RELEASED, star(162))
    // expect(out.sizeMM).not.toBeCloseTo(130, 0)
  })

  it('centres the population on the shape — symmetric on every side (§3.1a)', () => {
    // const { magnets } = solveLayout(RELEASED, circle(200))
    // const cx = mean(magnets.map(m => m[0])), cy = mean(magnets.map(m => m[1]))
    // expect(Math.abs(cx)).toBeLessThan(1e-6)
    // expect(Math.abs(cy)).toBeLessThan(1e-6)
  })

  it('puts no magnet where there is no material (§3.1b)', () => {
    // Two limbs with a gap: every returned magnet must lie INSIDE the outline, never in the gap.
    // for (const m of solveLayout(RELEASED, twoLimbs()).magnets) expect(inside(twoLimbs(), m)).toBe(true)
  })

  it('supports the top, not only a bottom row (§3.1c — gravity)', () => {
    // const { magnets } = solveLayout(RELEASED, twoLimbs())
    // const ys = magnets.map(m => m[1])
    // expect(Math.max(...ys)).toBeGreaterThan(0)   // something above the centre line
  })

  // ── §2.2 — tight: the outer cells press the edge, no slack ────────────────
  it('returns the smallest size that holds the CHOSEN layout (§2.2)', () => {
    // Growing the shape by 1mm must not still be "the" answer for the same magnet set.
    // const out = solveLayout(RELEASED, circle(200))
    // expect(solveLayout(RELEASED, scale(circle(200), 1.05)).sizeMM).not.toBe(out.sizeMM)
  })

  // ── v1 law 2.2 + §10.4 — the 10mm floor is CATEGORICAL, and there is no tolerance ──
  it('every published magnet sits at least paddingMM inside the outline', () => {
    // The measured historical defect: a magnet published at 9.947mm because a tolerance was used
    // to soften the test. §10.4 removes tolerance entirely — exact sizing, no slack.
    // for (const m of solveLayout(RELEASED, circle(200)).magnets)
    //   expect(distanceToEdge(circle(200), m)).toBeGreaterThanOrEqual(RELEASED.grid.paddingMM)
  })

  // ── §2.1 — scale only, aspect locked. THE STRETCH TEST. ───────────────────
  it('a circle and a 3:1 oval return DIFFERENT answers', () => {
    // This is the ten-second test that exposed the old engine: it returned the identical ladder
    // for a circle, a 3:1 oval and an 8:1 sliver, because it was deforming the shape, not reading
    // it. If these two agree, the engine is not reading the shape.
    // const c = solveLayout(RELEASED, circle(200))
    // const oval = circle(200).map(([x, y]) => [x * 3, y] as PointMM)
    // expect(solveLayout(RELEASED, oval).magnets.length).not.toBe(c.magnets.length)
  })

  // ── §4.3 — rotate the shape and the layout rotates with it ────────────────
  it('is rotation invariant', () => {
    // const a = solveLayout(RELEASED, twoLimbs())
    // const b = solveLayout(RELEASED, rotate(twoLimbs(), 45))
    // expect(b.sizeMM).toBeCloseTo(a.sizeMM, 6)
    // expect(b.magnets.length).toBe(a.magnets.length)
  })

  // ── §9.2 / §9.3 — registration follows parity, at BOTH spacings ───────────
  it('an even population centres in the gap; an odd one on a point — at 48 AND 96', () => {
    // The 96mm defect: half the BASE lattice lands back on a magnet. It must be half the
    // POPULATED pitch. Identical at 48mm, which is exactly why it stayed invisible.
    // for (const pitch of [48, 96]) { ... expect run centre === 0 ... }
  })

  // ── §4.1 — blindness. No published number is a target. ────────────────────
  it('holds no shape name and no published size anywhere in its logic', () => {
    // const src = readFileSync(ENGINE, 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')
    // for (const n of [68, 88, 116, 156, 164, 212, 224, 260, 308]) expect(src).not.toMatch(...)
    // for (const s of ['circle', 'square', 'triangle', 'star']) expect(src).not.toMatch(...)
  })

  // ── §4.2 — mutation. The acceptance, in Dan's own words. ──────────────────
  it('re-derives everything when an input changes, on a shape with no published numbers', () => {
    // A blob nobody has ever given numbers for. Change padding 10 -> 14 and 48 -> 96:
    // every output must move coherently, and none may stay pinned (a pinned output is a baked value).
    // const base = solveLayout(RELEASED, twoLimbs())
    // const padded = solveLayout(applyGridValue(RELEASED, 'paddingMM', 14).spec, twoLimbs())
    // expect(padded.sizeMM).not.toBe(base.sizeMM)
  })
})
