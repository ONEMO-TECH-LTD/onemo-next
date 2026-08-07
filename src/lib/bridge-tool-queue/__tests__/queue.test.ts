import { describe, expect, it } from 'vitest'
import { ToolQueue, ToolTimeout, withTimeout } from '../index'

const tick = () => new Promise<void>((r) => setTimeout(r, 0))
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

describe('bridge-tool-queue — v1 laws', () => {
  it('serializes: one op runs, the queued op runs right after — nothing dropped', async () => {
    const q = new ToolQueue()
    const order: string[] = []
    q.run(async () => { order.push('a-start'); await sleep(10); order.push('a-end') })
    q.run(async () => { order.push('b') })
    await sleep(30)
    expect(order).toEqual(['a-start', 'a-end', 'b'])
  })
  it('latest wins: a third tap replaces the queued second — never runs stale work', async () => {
    const q = new ToolQueue()
    const ran: string[] = []
    q.run(async () => { await sleep(10) })
    q.run(async () => { ran.push('second') })
    q.run(async () => { ran.push('third') })
    await sleep(30)
    expect(ran).toEqual(['third'])
  })
  it('an op error surfaces loudly and NEVER wedges the queue', async () => {
    const errs: unknown[] = []
    const q = new ToolQueue(undefined, (e) => errs.push(e))
    q.run(async () => { throw new Error('boom') })
    await tick(); await tick()
    let ran = false
    q.run(async () => { ran = true })
    await sleep(5)
    expect(errs).toHaveLength(1)
    expect(ran).toBe(true)
    expect(q.isBusy).toBe(false)
  })
  it('withTimeout converts a hang into a visible ToolTimeout', async () => {
    await expect(withTimeout(new Promise(() => {}), 10, 'hang')).rejects.toBeInstanceOf(ToolTimeout)
  })
})
