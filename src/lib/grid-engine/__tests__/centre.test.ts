import { describe, expect, it } from 'vitest'
import { centreOutline, gridPanForCentre } from '../bridge'
import { centreOfOutline, compareCentres, type PointMM } from '../engine'
import { RELEASED, type CentreMethod } from '../spec'

const METHODS: CentreMethod[] = [
  'box',
  'oriented-box',
  'area',
  'perimeter',
  'vertices',
  'maximum-clearance',
]

const square: PointMM[] = [
  [-50, -50],
  [50, -50],
  [50, 50],
  [-50, 50],
]

const lShape: PointMM[] = [
  [-60, -60],
  [20, -60],
  [20, 20],
  [60, 20],
  [60, 60],
  [-60, 60],
]

describe('centre-method comparison', () => {
  it('gives the same answer for a symmetric control', () => {
    for (const method of METHODS) {
      const [x, y] = centreOfOutline(RELEASED.grid, square, method)
      expect(x, method).toBeCloseTo(0, 6)
      expect(y, method).toBeCloseTo(0, 6)
    }
  })

  it('keeps genuinely different definitions separate on an asymmetric shape', () => {
    const answers = Object.fromEntries(
      METHODS.map((method) => [method, centreOfOutline(RELEASED.grid, lShape, method)]),
    ) as Record<CentreMethod, PointMM>

    expect(answers.box).toEqual([0, 0])
    expect(answers.area[0]).toBeCloseTo(-11.428571, 5)
    expect(answers.area[1]).toBeCloseTo(5.714286, 5)
    expect(answers.perimeter).not.toEqual(answers.area)
    expect(answers.vertices).not.toEqual(answers.area)
    expect(answers['maximum-clearance']).not.toEqual(answers.area)
  })

  it('keeps oriented-box available without rotating the returned outline', () => {
    const diamond: PointMM[] = [
      [0, -80],
      [60, 0],
      [0, 40],
      [-60, 0],
    ]
    const before = diamond.map(([x, y], i) => {
      const next = diamond[(i + 1) % diamond.length]
      return [next[0] - x, next[1] - y]
    })
    const minX = Math.min(...diamond.map(([x]) => x))
    const minY = Math.min(...diamond.map(([, y]) => y))
    const width = Math.max(...diamond.map(([x]) => x)) - minX
    const height = Math.max(...diamond.map(([, y]) => y)) - minY
    const uv = diamond.map(([x, y]) => [(x - minX) / width, (y - minY) / height] as PointMM)
    const placed = centreOutline(RELEASED, uv, { x: minX, y: minY, w: width, h: height }, 'oriented-box')
    const after = placed.points.map(([x, y], i) => {
      const next = placed.points[(i + 1) % placed.points.length]
      return [next[0] - x, next[1] - y]
    })
    expect(after).toEqual(before)
  })

  it('keeps the shape fixed and moves the grid to every chosen centre', () => {
    const uv = lShape.map(([x, y]) => [(x + 60) / 120, (y + 60) / 120] as PointMM)
    const box = { x: -60, y: -60, w: 120, h: 120 }
    for (const method of METHODS) {
      const placed = centreOutline(RELEASED, uv, box, method)
      expect(placed.points, method).toEqual(lShape)
      expect(gridPanForCentre(placed.centreMM, [3, -2])).toEqual([
        placed.centreMM[0] + 3,
        placed.centreMM[1] - 2,
      ])
    }
  })

  it('rejects a non-polygon instead of manufacturing a centre', () => {
    expect(() => centreOfOutline(RELEASED.grid, [[0, 0], [1, 1]], 'box')).toThrow(
      'at least three points',
    )
  })
})

describe('published full-disc placement solver', () => {
  it('rederives the exact square standards for bands 2, 3 and 4', () => {
    const [answer] = compareCentres(RELEASED.grid, square, ['box'], [2, 3, 4])
    expect(answer.fits.map(({ sizeMM }) => sizeMM)).toEqual([72, 120, 168])
    expect(answer.fits.map(({ magnetCount }) => magnetCount)).toEqual([4, 9, 16])
    expect(answer.fits.every(({ minimumClearanceMM }) => minimumClearanceMM! >= 12)).toBe(true)
  })

  it('rederives from padding and pitch instead of retaining released answers', () => {
    const padding6 = { ...RELEASED.grid, paddingMM: 6 }
    const padding18 = { ...RELEASED.grid, paddingMM: 18 }
    const pitch96 = { ...RELEASED.grid, pitchMM: 96 }
    expect(compareCentres(padding6, square, ['box'], [2])[0].fits[0].sizeMM).toBe(60)
    expect(compareCentres(padding18, square, ['box'], [2])[0].fits[0].sizeMM).toBe(84)
    // 96 thins the one anchored lattice; it does not recenter the surviving population.
    expect(compareCentres(pitch96, square, ['box'], [2])[0].fits[0].sizeMM).toBe(168)
  })

  it('proves centre choice changes the lawful manufacturing answer', () => {
    const answers = compareCentres(RELEASED.grid, lShape, ['box', 'area'], [2])
    expect(answers[0].fits[0].sizeMM).toBe(216)
    expect(answers[1].fits[0].sizeMM).toBe(138)
  })

  it('does not manufacture a solution beyond the released ceiling', () => {
    const narrow: PointMM[] = [
      [-60, -8],
      [60, -8],
      [60, 8],
      [-60, 8],
    ]
    const [answer] = compareCentres(RELEASED.grid, narrow, ['box'], [2])
    expect(answer.fits[0].sizeMM).toBeNull()
  })

  it('is winding-invariant', () => {
    const forward = compareCentres(RELEASED.grid, lShape, ['area', 'perimeter'], [2])
    const reverse = compareCentres(RELEASED.grid, [...lShape].reverse(), ['area', 'perimeter'], [2])
    expect(reverse).toEqual(forward)
  })
})
