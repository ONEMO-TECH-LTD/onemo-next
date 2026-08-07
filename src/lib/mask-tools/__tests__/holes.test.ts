import { describe, expect, it } from 'vitest'
import { fillEnclosedHoles } from '../index'
import type { Mask } from '@/lib/cutout-ai/types'

// The real hole guard (wiring audit 2026-08-07): v5.3.1's postProcessMask never filled interior
// holes; fillEnclosedHoles does — and by border-flood construction it can only touch TRULY
// enclosed regions, so model concavities (reachable from the edge) are safe by design.
const grid = (rows: string[]) => {
  const h = rows.length, w = rows[0].length
  const data = new Uint8Array(w * h)
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') data[y * w + x] = 1 }))
  return { data, w, h } as Mask
}
const count = (m: { data: Uint8Array }) => m.data.reduce((a, v) => a + v, 0)

describe('fillEnclosedHoles — the no-holes law', () => {
  it('fills a fully-enclosed interior hole (the robot-leg dropout class)', () => {
    const m = grid(['#####', '#####', '##.##', '#####', '#####'])
    const out = fillEnclosedHoles(m)
    expect(out.data[2 * 5 + 2]).toBe(1) // the enclosed 0 is now solid
    expect(count(out)).toBe(25)
  })
  it('NEVER fills a concavity open to the border (model precision preserved)', () => {
    // a C-shape: the bite opens to the right edge → reachable from the border → untouched
    const m = grid(['#####', '#...#', '#..##', '#...#', '#####'].map((r) => r)) // interior open? build explicit bay
    const bay = grid(['######', '#....#', '#.##.#', '#.#..#', '#....#', '######'])
    // carve a bay open to the right border on row 3
    bay.data[3 * 6 + 5] = 0
    const before = count(bay)
    const out = fillEnclosedHoles(bay)
    expect(count(out)).toBe(before) // border-reachable interior 0s stay 0
  })
  it('returns the SAME object when there are no enclosed holes (verbatim passthrough)', () => {
    const m = grid(['###', '###', '###'])
    expect(fillEnclosedHoles(m)).toBe(m)
  })
  it('fills soft matte to 255 on filled pixels, leaves existing soft untouched', () => {
    const m = grid(['###', '#.#', '###'])
    m.soft = new Uint8Array([200, 200, 200, 200, 0, 200, 200, 200, 200])
    const out = fillEnclosedHoles(m)
    expect(out.soft![4]).toBe(255) // the hole
    expect(out.soft![0]).toBe(200) // untouched
  })
})
