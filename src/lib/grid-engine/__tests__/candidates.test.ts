import { describe, expect, it } from 'vitest'
import { benchCandidates, listCandidates, standingView } from '../bridge'
import { placedPicture, scaleToSize } from '../candidates'
import { enumerateArrangements, type SiteInput } from '../enumerate'
import { RELEASED } from '../spec'

const square = (half: number): Array<[number, number]> => [
  [-half, -half],
  [half, -half],
  [half, half],
  [-half, half],
]

describe('scaleToSize — proportions', () => {
  it('does not change aspect ratio', () => {
    const tall: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 20],
      [0, 20],
    ]
    const scaled = scaleToSize(tall, 100)
    const xs = scaled.map((p) => p[0])
    const ys = scaled.map((p) => p[1])
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(50)
  })

  it('places a tall picture with the same aspect as the source', () => {
    const verts: Array<[number, number]> = [
      [0, 0],
      [1240, 0],
      [1240, 1912],
      [0, 1912],
    ]
    const pic = placedPicture(verts, { w: 1240, h: 1912 }, 144, 'bbox')
    expect(pic.w / pic.h).toBeCloseTo(1240 / 1912)
  })
})

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

  it('emits a T from a bar and a stem', () => {
    const sites: SiteInput[] = [
      { col: -1, row: 0, x: -48, y: 0, fits: true },
      { col: 0, row: 0, x: 0, y: 0, fits: true },
      { col: 1, row: 0, x: 48, y: 0, fits: true },
      { col: 0, row: 1, x: 0, y: 48, fits: true },
    ]
    const tees = enumerateArrangements(sites, 'base').filter((a) => a.family === 'tee')
    expect(tees.some((a) => a.sites.length === 4)).toBe(true)
  })

  it('emits the utmost triangle when the apex is on the top mid-edge', () => {
    const sites: SiteInput[] = [
      { col: 0, row: -1, x: 0, y: -48, fits: true },
      { col: -1, row: 1, x: -48, y: 48, fits: true },
      { col: 1, row: 1, x: 48, y: 48, fits: true },
    ]
    const tris = enumerateArrangements(sites, 'base').filter((a) => a.family === 'corner-triangle')
    expect(tris.some((a) => a.sites.length === 3 && a.stepCol === 2 && a.stepRow === 2)).toBe(true)
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
  it('band-2 pairs include millimetre seats, not only 12mm pans', () => {
    const slim: Array<[number, number]> = [
      [-13, -40],
      [13, -40],
      [13, 40],
      [-13, 40],
    ]
    const doc = listCandidates(RELEASED, slim)
    const pairs = doc.candidates.filter((c) => c.band === 2 && c.sites.length === 2)
    expect(pairs.length).toBeGreaterThan(0)
    expect(pairs.some((c) => c.origin[0] % 12 !== 0 || c.origin[1] % 12 !== 0)).toBe(true)
  })

  it('band-1 singles include millimetre seats, not only 12mm pans', () => {
    const slim: Array<[number, number]> = [
      [-21.5, -12],
      [21.5, -12],
      [21.5, 12],
      [-21.5, 12],
    ]
    const doc = listCandidates(RELEASED, slim)
    const ones = doc.candidates.filter((c) => c.band === 1 && c.family === 'single')
    expect(ones.length).toBeGreaterThan(0)
    expect(ones.some((c) => c.origin[0] % 12 !== 0 || c.origin[1] % 12 !== 0)).toBe(true)
  })

  it('band-3 lists a three-in-a-line below the 168 pack', () => {
    const tall: Array<[number, number]> = [
      [-12, -75],
      [12, -75],
      [12, 75],
      [-12, 75],
    ]
    const doc = listCandidates(RELEASED, tall)
    const runs = doc.candidates.filter(
      (c) => c.band === 3 && c.family === 'run' && c.sites.length === 3 && c.sizeMM < 168,
    )
    expect(runs.length).toBeGreaterThan(0)
  })

  it('a band lists mixed magnet counts, not only pairs or fours', () => {
    const doc = listCandidates(RELEASED, square(84))
    const ns = new Set(doc.candidates.filter((c) => c.band === 3).map((c) => c.sites.length))
    expect(ns.has(1)).toBe(true)
    expect([...ns].some((n) => n >= 3)).toBe(true)
    expect(
      doc.candidates.some((c) => c.family === 'run' && c.stepCol >= 1 && c.stepRow >= 1),
    ).toBe(true)
  })

  it('band-1 wrap is the smallest millimetre, not the next 12mm ladder step', () => {
    // 43×24: a 24mm disc kisses the short side at 43 and falls out at 42.
    const slim: Array<[number, number]> = [
      [-21.5, -12],
      [21.5, -12],
      [21.5, 12],
      [-21.5, 12],
    ]
    const doc = listCandidates(RELEASED, slim)
    const face = benchCandidates(RELEASED, doc, 1, slim)
    expect(face[0]?.sizeMM).toBe(43)
    expect(face[0]?.sites[0].x).toBeCloseTo(0, 0)
    expect(face[0]?.sites[0].y).toBeCloseTo(0, 0)
  })

  it('a pixel-dense outline still collects in millimetre time', () => {
    const ring: Array<[number, number]> = []
    for (let i = 0; i < 4000; i++) {
      const a = (i / 4000) * Math.PI * 2
      ring.push([36 * Math.cos(a), 36 * Math.sin(a)])
    }
    const t0 = Date.now()
    const doc = listCandidates(RELEASED, ring)
    expect(Date.now() - t0).toBeLessThan(4000)
    expect(doc.candidates.length).toBeGreaterThan(0)
  })

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
  })

  it('keeps all four half-pitch origins on the document', () => {
    const doc = listCandidates(RELEASED, square(84))
    const keys = new Set(doc.candidates.map((c) => `${c.registration.x}/${c.registration.y}`))
    expect(keys.has('point/point')).toBe(true)
    expect(keys.has('gap/gap')).toBe(true)
    expect(keys.has('gap/point')).toBe(true)
    expect(keys.has('point/gap')).toBe(true)
  })

  it('sparse candidates never sit on adjacent 48mm base neighbours', () => {
    const doc = listCandidates(RELEASED, square(84))
    const sparse = doc.candidates.filter((c) => c.population === 'sparse')
    expect(sparse.length).toBeGreaterThan(0)
    for (const c of sparse) {
      for (let i = 0; i < c.sites.length; i++) {
        for (let j = i + 1; j < c.sites.length; j++) {
          const dx = Math.abs(c.sites[i].x - c.sites[j].x)
          const dy = Math.abs(c.sites[i].y - c.sites[j].y)
          if (dx > 0) expect(dx % 96).toBe(0)
          if (dy > 0) expect(dy % 96).toBe(0)
          expect(dx === 48 || dy === 48).toBe(false)
        }
      }
    }
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

  it('proposes the centred seat over an offset one at the same wrap', () => {
    const box: Array<[number, number]> = [
      [-30, -30],
      [30, -30],
      [30, 30],
      [-30, 30],
    ]
    const doc = listCandidates(RELEASED, box)
    const face = benchCandidates(RELEASED, doc, 1, box)
    expect(face[0]?.sites.length).toBe(1)
    expect(Math.abs(face[0]!.sites[0].x)).toBeLessThan(6)
    expect(Math.abs(face[0]!.sites[0].y)).toBeLessThan(6)
  })

  it('proposes a top-half single on a top-heavy outline, never a bottom one', () => {
    const topHeavy: Array<[number, number]> = [
      [-22, -40],
      [22, -40],
      [22, -8],
      [8, -8],
      [8, 40],
      [-8, 40],
      [-8, -8],
      [-22, -8],
    ]
    const doc = listCandidates(RELEASED, topHeavy)
    const face = benchCandidates(RELEASED, doc, 1, topHeavy)
    expect(face[0]?.sites.length).toBe(1)
    expect(face[0]!.sites[0].y).toBeLessThan(0)
  })

  it('proposes the wide body, not the skinny tip, when the top cannot hold', () => {
    const spike: Array<[number, number]> = [
      [0, -36],
      [8, 8],
      [28, 36],
      [-28, 36],
      [-8, 8],
    ]
    const doc = listCandidates(RELEASED, spike)
    const face = benchCandidates(RELEASED, doc, 1, spike)
    expect(face[0]?.sites.length).toBe(1)
    expect(face[0]!.sites[0].y).toBeGreaterThan(0)
  })

  it('proposes two magnets on a two-lobed outline', () => {
    const lobes: Array<[number, number]> = [
      [-16, -40],
      [16, -40],
      [16, -8],
      [4, -8],
      [4, 8],
      [16, 8],
      [16, 40],
      [-16, 40],
      [-16, 8],
      [-4, 8],
      [-4, -8],
      [-16, -8],
    ]
    const doc = listCandidates(RELEASED, lobes)
    const face = benchCandidates(RELEASED, doc, 2, lobes)
    expect(face.some((c) => c.sites.length === 2)).toBe(true)
  })

  it('standing view sites stay on the candidate millimetres, not a later slider size', () => {
    const outline = square(36)
    const doc = listCandidates(RELEASED, outline)
    const c = doc.candidates.find((row) => row.sizeMM === 72 && row.sites.length >= 1)
    expect(c).toBeTruthy()
    const view = standingView(RELEASED, c!, outline, undefined, 120)
    const k = 120 / c!.sizeMM
    expect(view.sites[0]).toEqual([c!.sites[0].x * k, c!.sites[0].y * k])
  })

  it('standing view keeps the sticker size when the law size changes', () => {
    const outline = square(36)
    const doc = listCandidates(RELEASED, outline)
    const a = doc.candidates.find((c) => c.sizeMM === 72 && c.sites.length >= 1)
    const b = doc.candidates.find((c) => c.sizeMM === 168 && c.sites.length >= 1)
    expect(a && b).toBeTruthy()
    const sticker = 120
    const va = standingView(RELEASED, a!, outline, undefined, sticker)
    const vb = standingView(RELEASED, b!, outline, undefined, sticker)
    const box = (verts: Array<[number, number]>) => {
      const xs = verts.map((p) => p[0])
      const ys = verts.map((p) => p[1])
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    }
    expect(box(va.shape)).toEqual(box(vb.shape))
  })

  it('standing view keeps the shape bbox-centred across origins', () => {
    const outline = square(36)
    const doc = listCandidates(RELEASED, outline)
    const pair = doc.candidates.filter((c) => c.sizeMM === 72 && c.sites.length >= 1)
    expect(pair.length).toBeGreaterThan(1)
    const a = standingView(RELEASED, pair[0], outline)
    const b = standingView(RELEASED, pair[pair.length - 1], outline)
    const box = (verts: Array<[number, number]>) => {
      const xs = verts.map((p) => p[0])
      const ys = verts.map((p) => p[1])
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    }
    expect(box(a.shape)).toEqual(box(b.shape))
  })

  it('standing view lands marks on the frozen lattice', () => {
    const outline = square(36)
    const doc = listCandidates(RELEASED, outline)
    expect(doc.candidates.length).toBeGreaterThan(0)
    const pitch = RELEASED.grid.basePitchMM
    const families = ['single', 'run', 'tee', 'rectangle-corners', 'corner-triangle', 'full-window']
    const sample = families.flatMap((f) => doc.candidates.filter((c) => c.family === f).slice(0, 8))
    expect(sample.length).toBeGreaterThan(0)
    for (const c of sample) {
      const view = standingView(RELEASED, c, outline)
      for (const [x, y] of view.sites) {
        expect((x - view.panMM[0]) % pitch === 0).toBe(true)
        expect((y - view.panMM[1]) % pitch === 0).toBe(true)
      }
    }
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
