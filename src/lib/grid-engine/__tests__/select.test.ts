import { describe, expect, it } from 'vitest'
import { propose, measureWrap } from '../select'
import type { Candidate } from '../candidates'
import { RELEASED } from '../spec'

const box: Array<[number, number]> = [
  [-60, -60],
  [60, -60],
  [60, 60],
  [-60, 60],
]

function cand(
  id: string,
  band: 1 | 2 | 3 | 4,
  sizeMM: number,
  sites: Array<{ x: number; y: number }>,
): Candidate {
  return {
    id,
    band,
    sizeMM,
    anchor: 'bbox',
    registration: { x: 'point', y: 'point' },
    origin: [0, 0],
    family: sites.length === 1 ? 'single' : 'run',
    population: 'base',
    stepCol: 0,
    stepRow: 0,
    sites: sites.map((s, i) => ({ col: i, row: 0, x: s.x, y: s.y })),
  }
}

describe('measureWrap — per-side flap', () => {
  it('reports overhang beyond the padded magnet box', () => {
    const wrap = measureWrap(box, [{ x: 0, y: 0 }], 12)
    expect(wrap).toBeTruthy()
    expect(wrap!.top).toBeCloseTo(48)
    expect(wrap!.bottom).toBeCloseTo(48)
    expect(wrap!.left).toBeCloseTo(48)
    expect(wrap!.right).toBeCloseTo(48)
    expect(wrap!.total).toBeCloseTo(192)
  })
})

describe('propose — lexicographic laws', () => {
  it('gravity guard: a seat that leaves more than 28mm above loses', () => {
    const high = cand('high', 1, 60, [{ x: 0, y: -36 }])
    const low = cand('low', 1, 60, [{ x: 0, y: 36 }])
    const face = propose(RELEASED, { candidates: [low, high] }, 1, box)
    expect(face[0]!.id).toBe('high')
  })

  it('vertical hold: a seat that leaves more than 40mm below loses', () => {
    const held = cand('held', 2, 84, [
      { x: 0, y: -24 },
      { x: 0, y: 24 },
    ])
    const hanging = cand('hang', 2, 84, [
      { x: 0, y: -48 },
      { x: 0, y: 0 },
    ])
    const face = propose(RELEASED, { candidates: [hanging, held] }, 2, box)
    expect(face[0]!.id).toBe('held')
  })

  it('strip law: two islands farther than 96mm lose to one connected pair', () => {
    const islands = cand('islands', 3, 144, [
      { x: -48, y: -48 },
      { x: -48, y: 0 },
      { x: 48, y: 0 },
      { x: 48, y: 48 },
    ])
    const strip = cand('strip', 3, 144, [
      { x: 0, y: -48 },
      { x: 0, y: 0 },
      { x: 0, y: 48 },
    ])
    const face = propose(RELEASED, { candidates: [islands, strip] }, 3, box)
    expect(face[0]!.id).toBe('strip')
  })

  it('symmetry law: a mirror shape prefers a mirror arrangement', () => {
    const diag = cand('diag', 2, 96, [
      { x: -24, y: -24 },
      { x: 24, y: 24 },
    ])
    const vert = cand('vert', 2, 96, [
      { x: 0, y: -24 },
      { x: 0, y: 24 },
    ])
    const face = propose(RELEASED, { candidates: [diag, vert] }, 2, box)
    expect(face[0]!.id).toBe('vert')
  })

  it('sparse cap: a pair flung past 96mm loses to a 96mm pair', () => {
    const flung = cand('135', 2, 108, [
      { x: -48, y: -48 },
      { x: 48, y: 48 },
    ])
    const sparse = cand('96', 2, 108, [
      { x: 0, y: -48 },
      { x: 0, y: 48 },
    ])
    const face = propose(RELEASED, { candidates: [flung, sparse] }, 2, box)
    expect(face[0]!.id).toBe('96')
  })

  it('masses: a pair that spans the height beats a single in one lobe', () => {
    const one = cand('one', 2, 96, [{ x: 0, y: -24 }])
    const pair = cand('pair', 2, 96, [
      { x: 0, y: -24 },
      { x: 0, y: 24 },
    ])
    const face = propose(RELEASED, { candidates: [one, pair] }, 2, box)
    expect(face[0]!.id).toBe('pair')
  })

  it('mass axis: the pair closer to the shape centre wins', () => {
    const off = cand('off', 2, 96, [
      { x: 24, y: -24 },
      { x: 24, y: 24 },
    ])
    const mid = cand('mid', 2, 96, [
      { x: 0, y: -24 },
      { x: 0, y: 24 },
    ])
    const face = propose(RELEASED, { candidates: [off, mid] }, 2, box)
    expect(face[0]!.id).toBe('mid')
  })

  it('tightness: less total per-side wrap wins', () => {
    const loose = cand('loose', 1, 72, [{ x: 0, y: 0 }])
    const snug = cand('snug', 1, 48, [{ x: 0, y: 0 }])
    const face = propose(RELEASED, { candidates: [loose, snug] }, 1, box)
    expect(face[0]!.id).toBe('snug')
  })

  it('evenness: a left-heavy pair loses to a balanced one at the same wrap', () => {
    const left = cand('left', 2, 96, [
      { x: -12, y: -24 },
      { x: -12, y: 24 },
    ])
    const mid = cand('mid', 2, 96, [
      { x: 0, y: -24 },
      { x: 0, y: 24 },
    ])
    const face = propose(RELEASED, { candidates: [left, mid] }, 2, box)
    expect(face[0]!.id).toBe('mid')
  })

  it('fewer magnets win when earlier laws tie', () => {
    const three = cand('three', 3, 144, [
      { x: 0, y: -24 },
      { x: 0, y: 0 },
      { x: 0, y: 24 },
    ])
    const pair = cand('pair', 3, 144, [
      { x: 0, y: -24 },
      { x: 0, y: 24 },
    ])
    const face = propose(RELEASED, { candidates: [three, pair] }, 3, box)
    expect(face[0]!.id).toBe('pair')
  })

  it('smaller size wins when the hold is the same', () => {
    const big = cand('big', 2, 108, [
      { x: 0, y: -24 },
      { x: 0, y: 24 },
    ])
    const small = cand('small', 2, 84, [
      { x: 0, y: -24 },
      { x: 0, y: 24 },
    ])
    const face = propose(RELEASED, { candidates: [big, small] }, 2, box)
    expect(face[0]!.id).toBe('small')
  })
})
