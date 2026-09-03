// The interaction the performance card exists to display: a solve still running when the shape
// changes. Its row must name the shape and band the request was MADE for. Reading the current
// selection at response time is what produced BOT's answer labelled BUTTERFLY (2026-09-03).
import { describe, expect, it } from 'vitest'
import { createPerfLog } from './perf-log'

const model = (effSize: number, count: number) => ({ effSize, grid: { anchors: Array.from({ length: count }, (_, i) => i) } })

describe('the bench performance log', () => {
  it('labels an in-flight solve with the request it answers, not the selection that replaced it', () => {
    const log = createPerfLog()
    log.asked(1, 'BOT.png', 4)          // slow request
    log.asked(2, 'BUTTERFLY.png', 1)    // the shape changed while 1 was still running
    const first = log.arrived(1, model(213.75, 7), 2480)
    expect(first, 'the slow answer must keep its own identity').toMatchObject({
      shape: 'BOT.png', band: 4, sizeMM: 213.75, count: 7, cold: true,
    })
    const second = log.arrived(2, model(66.69, 1), 510)
    expect(second).toMatchObject({ shape: 'BUTTERFLY.png', band: 1, sizeMM: 66.69, count: 1, cold: true })
  })

  it('marks cold only the first solve of a shape and band', () => {
    const log = createPerfLog()
    log.asked(1, 'DUCK.png', 3); log.asked(2, 'DUCK.png', 3); log.asked(3, 'DUCK.png', 5)
    expect(log.arrived(1, model(146.11, 4), 1700)!.cold).toBe(true)
    expect(log.arrived(2, model(146.11, 4), 80)!.cold).toBe(false)
    expect(log.arrived(3, model(245.31, 9), 4300)!.cold).toBe(true)
  })

  it('releases every request, including superseded ones that deliver nothing', () => {
    const log = createPerfLog()
    for (let id = 1; id <= 5; id++) log.asked(id, 'BOT.png', id)
    expect(log.pending).toBe(5)
    expect(log.arrived(3, null, 120), 'no model, no row').toBeNull()
    expect(log.arrived(1, undefined, 120)).toBeNull()
    for (const id of [2, 4, 5]) log.arrived(id, model(100, 2), 200)
    expect(log.pending, 'a stale answer must not leave its record behind').toBe(0)
  })

  it('an unknown id yields no row', () => {
    const log = createPerfLog()
    expect(log.arrived(99, model(100, 2), 50)).toBeNull()
  })
})
