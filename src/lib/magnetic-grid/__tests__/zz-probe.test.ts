import { describe, it, expect } from 'vitest'
import { computeGrid, solveBands } from '../engine'
import { SOLVER_DEFAULTS, type Contour } from '../spec'

const square = (s: number): Contour => ({ outer: { pts: [[0,0],[s,0],[s,s],[0,s]] }, holes: [] })

describe('timing probe', () => {
  it('cost', () => {
    const t0 = Date.now()
    const r = computeGrid(square(120), 120, SOLVER_DEFAULTS)
    const one = Date.now() - t0
    const t1 = Date.now()
    const bands = solveBands((mm: number) => square(mm), SOLVER_DEFAULTS)
    const all = Date.now() - t1
    expect(`ONE_SIZE=${one}ms layouts=${r.layouts.length} FULL=${(all/1000).toFixed(1)}s rungs=${bands.bands.map((b:any)=>b.rungs.length).join('/')}`).toBe('SHOW')
  }, 900000)
})
