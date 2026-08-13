import { describe, expect, it } from 'vitest'
import { listCandidates } from '../bridge'
import { selectRegistration, RELEASED } from '../spec'

const square = (half: number): Array<[number, number]> => [
  [-half, -half],
  [half, -half],
  [half, half],
  [-half, half],
]

function specGap() {
  const r = selectRegistration(RELEASED, 'gap')
  if (r.refused) throw new Error('gap refused')
  return r.spec
}

describe('collectCandidates — shipped entry', () => {
  it('flush-fits a 2×2 on a 72mm square (gap registration)', () => {
    const doc = listCandidates(specGap(), square(36))
    const corners = doc.candidates.filter(
      (c) =>
        c.sizeMM === 72 &&
        c.family === 'rectangle-corners' &&
        c.population === 'base' &&
        c.sites.length === 4,
    )
    expect(corners.length).toBeGreaterThan(0)
    const one = corners[0]
    expect(one).not.toHaveProperty('preferred')
    const xs = [...new Set(one.sites.map((s) => s.x))].sort((a, b) => a - b)
    const ys = [...new Set(one.sites.map((s) => s.y))].sort((a, b) => a - b)
    expect(xs).toEqual([-24, 24])
    expect(ys).toEqual([-24, 24])
  })

  it('finds an off-centre single that a centred-only template would miss', () => {
    // Thin spine (no disc) + a 26mm head above the origin.
    const outline: Array<[number, number]> = [
      [-16, 48],
      [16, 48],
      [16, 16],
      [1, 16],
      [1, -30],
      [-1, -30],
      [-1, 16],
      [-16, 16],
    ]
    const doc = listCandidates(RELEASED, outline)
    const singles = doc.candidates.filter((c) => c.family === 'single' && c.anchor === 'bbox')
    expect(singles.length).toBeGreaterThan(0)
    expect(singles.some((c) => c.sites[0].x !== 0 || c.sites[0].y !== 0)).toBe(true)
    expect(singles.every((c) => !('preferred' in c))).toBe(true)
  })

  it('emits a diagonal run and a skipped-row rectangle on a large square', () => {
    const doc = listCandidates(specGap(), square(84))
    const diagonal = doc.candidates.filter(
      (c) => c.family === 'run' && c.stepCol >= 1 && c.stepRow >= 1 && c.sites.length >= 2,
    )
    expect(diagonal.length).toBeGreaterThan(0)
    const skip = doc.candidates.filter(
      (c) =>
        c.family === 'rectangle-corners' &&
        c.sites.length === 4 &&
        (c.stepCol > 1 || c.stepRow > 1),
    )
    expect(skip.length).toBeGreaterThan(0)
  })
})
