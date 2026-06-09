// outline-core livewire pathfinder golden fixtures (A3b) — the magnetic-lasso snap.
// Encodes WHY: the path must HUG low-cost cells (image edges) between anchors, not cut straight.

import { describe, it, expect } from 'vitest'
import { livewirePath, type CostGrid } from '../livewire'

function gridWithCheapL(): CostGrid {
  const W = 40, H = 40
  const cost = new Float32Array(W * H).fill(5) // expensive everywhere
  const cheap = (x: number, y: number) => { cost[y * W + x] = 0.05 } // a strong "edge"
  for (let x = 5; x <= 35; x++) cheap(x, 5) // top edge
  for (let y = 5; y <= 35; y++) cheap(35, y) // right edge
  return { cost, width: W, height: H }
}

describe('livewirePath — magnetic edge snap', () => {
  it('returns a path between the exact endpoints', () => {
    const g = gridWithCheapL()
    const path = livewirePath(g, [5, 5], [35, 35])
    expect(path[0]).toEqual([5, 5])
    expect(path[path.length - 1]).toEqual([35, 35])
  })

  it('SNAPS to the cheap L-edge instead of cutting the expensive diagonal', () => {
    const g = gridWithCheapL()
    const path = livewirePath(g, [5, 5], [35, 35])
    // The cheap route runs along the top then down the right → it must visit the top-right corner.
    expect(path.some(([x, y]) => x >= 32 && y <= 8)).toBe(true)
    // It must NOT sit on the bare diagonal mid-cell (20,20), which is expensive.
    expect(path.some(([x, y]) => x === 20 && y === 20)).toBe(false)
  })

  it('is deterministic (client/server parity)', () => {
    const g = gridWithCheapL()
    expect(livewirePath(g, [5, 5], [35, 35])).toEqual(livewirePath(g, [5, 5], [35, 35]))
  })

  it('returns a fully 8-connected path (no jumps) on a uniform grid', () => {
    const W = 60, H = 60
    const g: CostGrid = { cost: new Float32Array(W * H).fill(1), width: W, height: H }
    const path = livewirePath(g, [5, 5], [50, 50])
    expect(path[0]).toEqual([5, 5])
    expect(path[path.length - 1]).toEqual([50, 50])
    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs(path[i][0] - path[i - 1][0]), dy = Math.abs(path[i][1] - path[i - 1][1])
      expect(Math.max(dx, dy)).toBeLessThanOrEqual(1) // each step moves at most one cell — a real path
    }
  })
})
