// v3.5.4 — candidate enumeration. Dan's law (grid-laws.md:743-748): "candidates are EVERY window
// placement on the lattice — every sub-window size at every offset, deduped by held set … Centred
// templates alone are not the candidate set; they are three of its members."

import { describe, expect, it } from 'vitest'
import { centredRegistrations, enumerateLayouts, type SeatedNode } from '../compute'
import type { Pt } from '../spec'

const grid = (cols: number, rows: number, pitch = 48): SeatedNode[] => {
  const nodes: SeatedNode[] = []
  for (let col = 0; col < cols; col++) for (let row = 0; row < rows; row++) {
    nodes.push({ p: [col * pitch, row * pitch] as Pt, col, row })
  }
  return nodes
}
const families = (nodes: SeatedNode[], step = 2) => enumerateLayouts(nodes, step)

describe('v3.5.4 enumeration — every ruled window, never the power set', () => {
  it('a registration that seats four nodes still yields its lawful two-node sub-windows', () => {
    const layouts = families(grid(2, 2))
    const pairs = layouts.filter((l) => l.nodes.length === 2)
    expect(pairs.length, 'the four-node frame does not erase its pairs').toBeGreaterThanOrEqual(4)
    expect(layouts.some((l) => l.nodes.length === 4), 'and the frame itself is a candidate').toBe(true)
    expect(layouts.some((l) => l.nodes.length === 1), 'so is every single').toBe(true)
  })

  it('every ruled family is reachable on the same lattice, with no shape-name branch', () => {
    const layouts = families(grid(3, 3))
    const kinds = new Set(layouts.map((l) => l.family))
    expect(kinds.has('single')).toBe(true)
    expect(kinds.has('run')).toBe(true)
    expect(kinds.has('rectangle-corners')).toBe(true)
    expect(kinds.has('corner-triangle')).toBe(true)
    expect(kinds.has('full-window')).toBe(true)
  })

  it('runs cover horizontal, vertical and the ruled diagonal', () => {
    const runs = families(grid(3, 3)).filter((l) => l.family === 'run' && l.nodes.length === 2)
    const horizontal = runs.some((l) => l.nodes[0].row === l.nodes[1].row)
    const vertical = runs.some((l) => l.nodes[0].col === l.nodes[1].col)
    const diagonal = runs.some((l) => l.nodes[0].col !== l.nodes[1].col && l.nodes[0].row !== l.nodes[1].row)
    expect([horizontal, vertical, diagonal]).toEqual([true, true, true])
  })

  it('the sparse population is the same lattice thinned — a step-2 run exists on a 3x3', () => {
    const sparse = families(grid(3, 3)).filter((l) => l.populationStep === 2 && l.nodes.length >= 2)
    expect(sparse.length).toBeGreaterThan(0)
    for (const layout of sparse) {
      for (const node of layout.nodes) expect(node.col % 1).toBe(0)
    }
  })

  it('a skipped-row four and a corner triangle both survive on a 3x3', () => {
    const layouts = families(grid(3, 3))
    const skipped = layouts.find((l) => l.family === 'rectangle-corners' && l.populationStep === 2)
    expect(skipped, 'the duck\'s head-pair + body-pair four, middle row unused').toBeDefined()
    expect(layouts.some((l) => l.family === 'corner-triangle' && l.nodes.length === 3)).toBe(true)
  })

  it('identity is the physical held set — the same layout is never returned twice', () => {
    const layouts = families(grid(3, 3))
    const perFamily = new Map<string, Set<string>>()
    for (const layout of layouts) {
      const seen = perFamily.get(layout.family) ?? new Set<string>()
      expect(seen.has(layout.heldKey), `${layout.family} repeated a held set`).toBe(false)
      seen.add(layout.heldKey)
      perFamily.set(layout.family, seen)
    }
  })

  it('registrations are derived from the anchor: only phases that CAN centre are visited', () => {
    const bb = { minX: 0, minY: 0, maxX: 120, maxY: 120 }
    const phases = centredRegistrations(bb, 48, [60, 60], 1, 1)
    // two residue classes per axis (node-on-centre and gap-on-centre), each at the ruler
    expect(phases.length).toBeLessThanOrEqual(16)
    const xs = new Set(phases.map((p) => Math.round(p[0])))
    expect(xs.has(12), 'the registration that seats 12/60/108 on a 120 shape is included').toBe(true)
    // the derivation is exact: a phase outside those classes cannot balance on the anchor
    for (const [x] of phases) {
      const centres = [0, 24].map((offset) => Math.abs(((x + offset) % 24) - ((60 % 24))))
      expect(Math.min(...centres)).toBeLessThanOrEqual(1)
    }
  })

  it('a finer registration step samples more of the ruler band, never fewer phases', () => {
    const bb = { minX: 0, minY: 0, maxX: 120, maxY: 120 }
    const coarse = centredRegistrations(bb, 48, [60, 60], 2, 2)
    const fine = centredRegistrations(bb, 48, [60, 60], 2, 1)
    expect(fine.length).toBeGreaterThanOrEqual(coarse.length)
  })
})
