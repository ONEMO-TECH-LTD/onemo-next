import { describe, expect, it } from 'vitest'
import { centreOutline } from '../bridge'
import { centreOfOutline, type PointMM } from '../engine'
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
      return Math.hypot(next[0] - x, next[1] - y)
    })
    const centre = centreOfOutline(RELEASED.grid, diamond, 'oriented-box')
    const after = diamond.map(([x, y], i) => {
      const next = diamond[(i + 1) % diamond.length]
      return Math.hypot(next[0] - centre[0] - (x - centre[0]), next[1] - centre[1] - (y - centre[1]))
    })
    expect(after).toEqual(before)
  })

  it('registers every chosen centre at the grid origin through the bridge', () => {
    const uv = lShape.map(([x, y]) => [(x + 60) / 120, (y + 60) / 120] as PointMM)
    const box = { x: -60, y: -60, w: 120, h: 120 }
    for (const method of METHODS) {
      const placed = centreOutline(RELEASED, uv, box, method)
      const recentered = centreOfOutline(RELEASED.grid, placed.points, method)
      expect(recentered[0], method).toBeCloseTo(0, method === 'maximum-clearance' ? 0 : 6)
      expect(recentered[1], method).toBeCloseTo(0, method === 'maximum-clearance' ? 0 : 6)
    }
  })

  it('rejects a non-polygon instead of manufacturing a centre', () => {
    expect(() => centreOfOutline(RELEASED.grid, [[0, 0], [1, 1]], 'box')).toThrow(
      'at least three points',
    )
  })
})
