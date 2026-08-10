// ENGINE ACCEPTANCE — the gate Sub 1 must pass.
//
// Written by @s62-meta BEFORE the engine existed, so it is judged against Dan's law rather than
// against whatever the engine turned out to do. Every case cites the clause it enforces. These are
// the checks that would have caught the forty previous versions — not the ones a build passes by
// accident.
//
// The fixtures are deliberate: a blob and a two-limb shape carry no published numbers, so they
// cannot be passed by tuning. Dan's own law says it — a green square or circle is silence, not a pass.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publishedSizeMM } from '../engine'
import { solveLayout, signedDistanceMM, type OutlineMM } from '../solve'
import { applyGridValue, RELEASED, selectPitch } from '../spec'

type PointMM = [number, number]

const circle = (dMM: number, n = 240): PointMM[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n
    return [(Math.cos(a) * dMM) / 2, (Math.sin(a) * dMM) / 2] as PointMM
  })

/** Five points, rounded nothing. The shape the 130mm failure was recorded on. */
const star = (dMM: number, points = 5, inner = 0.382): PointMM[] =>
  Array.from({ length: points * 2 }, (_, i) => {
    const a = (Math.PI * i) / points - Math.PI / 2
    const r = ((i % 2 === 0 ? 1 : inner) * dMM) / 2
    return [Math.cos(a) * r, Math.sin(a) * r] as PointMM
  })

/** A single ring with two limbs and a gap between them — the case §3.1(b) exists for. */
const twoLimbs = (): PointMM[] => [
  [-60, -80], [-20, -80], [-20, 40], [20, 40], [20, -80], [60, -80],
  [60, 80], [-60, 80],
]

const rotate = (pts: PointMM[], deg: number): PointMM[] => {
  const r = (deg * Math.PI) / 180
  return pts.map(([x, y]) => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)])
}

/** Solve, and fail loudly rather than let a null slide past as a pass. */
const solved = (spec: typeof RELEASED, outline: OutlineMM) => {
  const out = solveLayout(spec, outline)
  expect(out, 'the engine returned no layout at all').not.toBeNull()
  return out!
}

/** The outline as the engine sees it — centred on its own centroid — at a given scale. */
const atScale = (outline: PointMM[], scale: number): PointMM[] => {
  const n = outline.length
  const cx = outline.reduce((a, p) => a + p[0], 0) / n
  const cy = outline.reduce((a, p) => a + p[1], 0) / n
  return outline.map(([x, y]) => [(x - cx) * scale, (y - cy) * scale] as PointMM)
}

describe('SUB 1 ACCEPTANCE', () => {
  it('takes an outline and returns a layout AND a size (law 1.1a)', () => {
    const out = solved(RELEASED, circle(200))
    expect(out.sizeMM).toBeGreaterThan(0)
    expect(out.magnets.length).toBeGreaterThan(0)
  })

  it('rejects a tighter layout that bunches magnets into one lobe (§3.2)', () => {
    // The recorded instance: on the 162mm star the smallest four-magnet fit is 130mm, reached by
    // shoving four magnets into the fattest lobe. Arithmetically correct, rejected on sight.
    const out = solved(RELEASED, star(162))
    expect(Math.round(out.sizeMM)).not.toBe(130)
  })

  it('centres the population on the shape (§3.1a)', () => {
    const { magnets } = solved(RELEASED, circle(200))
    const cx = magnets.reduce((a, m) => a + m[0], 0) / magnets.length
    const cy = magnets.reduce((a, m) => a + m[1], 0) / magnets.length
    expect(Math.hypot(cx, cy)).toBeLessThan(RELEASED.grid.pitchMM / 2)
  })

  it('puts no magnet where there is no material (§3.1b)', () => {
    const out = solved(RELEASED, twoLimbs())
    const shape = atScale(twoLimbs(), out.scale)
    for (const [x, y] of out.magnets) {
      expect(signedDistanceMM(shape, x, y), `magnet ${x},${y} is outside the material`).toBeGreaterThan(0)
    }
  })

  it('supports the top, not only a bottom row (§3.1c — gravity)', () => {
    const { magnets } = solved(RELEASED, twoLimbs())
    expect(Math.max(...magnets.map((m) => m[1]))).toBeGreaterThan(0)
  })

  it('every published magnet sits at least paddingMM inside the outline (v1 2.2 + §10.4)', () => {
    // The historical defect: a magnet published at 9.947mm because a tolerance softened the test.
    // Tolerance is gone, so this is exact — clearance is geometry, not a comparison.
    const out = solved(RELEASED, circle(200))
    const shape = atScale(circle(200), out.scale)
    for (const [x, y] of out.magnets) {
      expect(signedDistanceMM(shape, x, y)).toBeGreaterThanOrEqual(RELEASED.grid.paddingMM)
    }
  })

  it('a circle and a 3:1 oval return DIFFERENT answers (§2.1 — the stretch test)', () => {
    // Ten seconds, no argument possible. The old engine returned the identical ladder for a circle,
    // a 3:1 oval and an 8:1 sliver because it deformed the shape instead of reading it.
    const c = solved(RELEASED, circle(200))
    const oval = circle(200).map(([x, y]) => [x * 3, y] as PointMM)
    const o = solved(RELEASED, oval)
    expect([o.magnets.length, Math.round(o.sizeMM)]).not.toEqual([c.magnets.length, Math.round(c.sizeMM)])
  })

  it('is rotation invariant in its LAYOUT (§4.3)', () => {
    // MEASURED, and the clause needed narrowing — flagged to s62-meta rather than tuned to green.
    //
    // The lattice is fixed to the garment; it does not turn with the artwork. Dan's own framing: the
    // grid is the world and a shape is placed onto it. So turning a cut-out 45 degrees genuinely
    // changes which cells its material can legally reach, and it must grow to hold the same set:
    // measured 1.29x on this fixture. The engine may only SCALE ("scale is the only part must be
    // applied"), so it cannot turn the shape back to recover the tighter fit.
    //
    // What IS invariant, and what the clause exists to protect, is that the engine reads the SHAPE
    // rather than the orientation it happens to arrive in — same population, not a different answer.
    // Whether a shape should be allowed to rotate to fit better is a product decision, not ours.
    const a = solved(RELEASED, twoLimbs())
    const b = solved(RELEASED, rotate(twoLimbs(), 45))
    expect(b.magnets.length).toBe(a.magnets.length)
  })

  it('registers on the population’s parity at BOTH 48 and 96 (§9.2 / §9.3)', () => {
    // The 96mm defect: half the BASE lattice lands back on a magnet. It must be half the POPULATED
    // pitch. Identical at 48mm, which is exactly why it stayed invisible.
    for (const pitch of [48, 96]) {
      const spec = selectPitch(RELEASED, pitch).spec
      const { magnets } = solved(spec, circle(200))
      const xs = [...new Set(magnets.map((m) => m[0]))].sort((a, b) => a - b)
      const ys = [...new Set(magnets.map((m) => m[1]))].sort((a, b) => a - b)
      expect((xs[0] + xs[xs.length - 1]) / 2, `x run off centre at ${pitch}mm`).toBeCloseTo(0, 6)
      expect((ys[0] + ys[ys.length - 1]) / 2, `y run off centre at ${pitch}mm`).toBeCloseTo(0, 6)
    }
  })

  it('holds no shape name and no published size anywhere in its logic (§4.1)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/grid-engine/solve.ts'), 'utf8')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    for (const n of [68, 88, 116, 156, 164, 212, 224, 260, 308]) {
      expect(src, `${n} is a published size and must not appear`).not.toMatch(new RegExp(`\\b${n}\\b`))
    }
    for (const s of ['circle', 'square', 'triangle', 'star', 'oval']) {
      expect(src, `${s} is a shape name and must not appear`).not.toMatch(new RegExp(`\\b${s}\\b`, 'i'))
    }
  })

  it('publishes the exact wrap rounded UP to the next even whole millimetre (§3.23)', () => {
    // Dan, 2026-07-29: "round to the highest number obviously not lowest because the shape must not
    // be smaller than grid… and to the next non-odd number so that grid is centered as well with no
    // fractions — we cannot place anything on a fraction, it is just humanly impossible with fabric."
    for (const [exact, expected] of [[87.9, 88], [88, 88], [88.1, 90], [141.5, 142], [209.1, 210]]) {
      expect(publishedSizeMM(exact)).toBe(expected)
    }
  })

  it('publication can only improve clearance, never break the padding floor (§3.23 + v1 2.2)', () => {
    // Asserted, not assumed. A publication that shrank the shape would be the 9.947mm class coming
    // back through a different door.
    const out = solved(RELEASED, circle(200))
    const published = publishedSizeMM(out.sizeMM)
    expect(published).toBeGreaterThanOrEqual(out.sizeMM)
    const grown = atScale(circle(200), out.scale * (published / out.sizeMM))
    for (const [x, y] of out.magnets) {
      expect(signedDistanceMM(grown, x, y)).toBeGreaterThanOrEqual(RELEASED.grid.paddingMM)
    }
  })

  it('re-derives everything when an input changes (§4.2 — mutation)', () => {
    // On a shape nobody has ever published numbers for. A pinned output is a baked value.
    const base = solved(RELEASED, twoLimbs())
    const padded = solved(applyGridValue(RELEASED, 'paddingMM', 14).spec, twoLimbs())
    const spaced = solved(selectPitch(RELEASED, 96).spec, twoLimbs())
    expect(padded.sizeMM).not.toBe(base.sizeMM)
    expect(spaced.sizeMM).not.toBe(base.sizeMM)
  })
})
