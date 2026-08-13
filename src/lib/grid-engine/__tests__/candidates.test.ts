import { describe, expect, it } from 'vitest'
import { listCandidates } from '../bridge'
import { enumerateArrangements, type SiteInput } from '../enumerate'
import { RELEASED } from '../spec'

const square = (half: number): Array<[number, number]> => [
  [-half, -half],
  [half, -half],
  [half, half],
  [-half, half],
]

describe('enumerateArrangements', () => {
  it('emits every run length ≥ 2 on four consecutive held sites', () => {
    const sites: SiteInput[] = [0, 1, 2, 3].map((col) => ({
      col,
      row: 0,
      x: col * 48,
      y: 0,
      fits: true,
    }))
    const runs = enumerateArrangements(sites, 'base').filter((a) => a.family === 'run' && a.stepCol === 1 && a.stepRow === 0)
    const lens = new Set(runs.map((a) => a.sites.length))
    expect(lens.has(2)).toBe(true)
    expect(lens.has(3)).toBe(true)
    expect(lens.has(4)).toBe(true)
    expect(runs.some((a) => a.sites.map((s) => s.col).join(',') === '0,1')).toBe(true)
    expect(runs.some((a) => a.sites.map((s) => s.col).join(',') === '0,1,2')).toBe(true)
  })

  it('does not let a three-site run hide the pair 0-1', () => {
    const sites: SiteInput[] = [0, 1, 2].map((col) => ({
      col,
      row: 0,
      x: col * 48,
      y: 0,
      fits: true,
    }))
    const runs = enumerateArrangements(sites, 'base').filter((a) => a.family === 'run')
    expect(runs.some((a) => a.sites.map((s) => s.col).join(',') === '0,1')).toBe(true)
    expect(runs.some((a) => a.sites.map((s) => s.col).join(',') === '0,1,2')).toBe(true)
    const singles = enumerateArrangements(sites, 'base').filter((a) => a.family === 'single')
    expect(singles.every((a) => a.stepCol === 0 && a.stepRow === 0)).toBe(true)
  })

  it('builds a sparse full window on even base indices', () => {
    const sites: SiteInput[] = []
    for (const col of [0, 2]) {
      for (const row of [0, 2]) {
        sites.push({ col, row, x: col * 48, y: row * 48, fits: true })
      }
    }
    const wins = enumerateArrangements(sites, 'sparse').filter((a) => a.family === 'full-window')
    const four = wins.find((a) => a.sites.length === 4 && a.stepCol === 1 && a.stepRow === 1)
    expect(four).toBeTruthy()
    const cols = [...new Set(four!.sites.map((s) => s.col))].sort((a, b) => a - b)
    const rows = [...new Set(four!.sites.map((s) => s.row))].sort((a, b) => a - b)
    expect(cols).toEqual([0, 2])
    expect(rows).toEqual([0, 2])
  })
})

describe('collectCandidates — shipped entry', () => {
  it('flush-fits a 2×2 on a 72mm square under gap parity even if the spec is point', () => {
    const doc = listCandidates(RELEASED, square(36))
    const corners = doc.candidates.filter(
      (c) =>
        c.sizeMM === 72 &&
        c.family === 'rectangle-corners' &&
        c.population === 'base' &&
        c.sites.length === 4 &&
        c.registration.x === 'gap' &&
        c.registration.y === 'gap',
    )
    expect(corners.length).toBeGreaterThan(0)
    const one = corners[0]
    expect(one).not.toHaveProperty('preferred')
    const xs = [...new Set(one.sites.map((s) => s.x))].sort((a, b) => a - b)
    const ys = [...new Set(one.sites.map((s) => s.y))].sort((a, b) => a - b)
    expect(xs).toEqual([-24, 24])
    expect(ys).toEqual([-24, 24])
    const illegal = doc.candidates.filter(
      (c) =>
        c.sizeMM === 72 &&
        c.family === 'rectangle-corners' &&
        c.population === 'base' &&
        c.sites.length === 4 &&
        (c.registration.x !== 'gap' || c.registration.y !== 'gap'),
    )
    expect(illegal).toEqual([])
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
    const doc = listCandidates(RELEASED, square(84))
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
