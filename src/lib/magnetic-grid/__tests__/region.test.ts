// v3.5.4 — the ruled group region and its flap. The oracles come from Dan's own worked examples
// (grid-laws.md:381-469): "the 4x48mm grid points have 72mm square bounding box inside of it no
// flap must be recognised - the pair has 72x24 bounding box so on and so forth".

import { describe, expect, it } from 'vitest'
import { measureGroupRegion, measureOverhangs, regionExtents, regionInMaterial, type SeatedNode } from '../compute'
import type { Contour, Pt } from '../spec'

const node = (x: number, y: number, col: number, row: number): SeatedNode => ({ p: [x, y] as Pt, col, row })
const layout = (family: string, populationStep: number, nodes: SeatedNode[]) =>
  ({ family: family as 'single' | 'run' | 'rectangle-corners' | 'corner-triangle' | 'full-window', populationStep, nodes, heldKey: nodes.map((n) => n.p.join(',')).join('|') })
const box = (minX: number, minY: number, maxX: number, maxY: number): Contour =>
  ({ outer: { pts: [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]] }, holes: [] })

const PAD = 12

describe('v3.5.4 group region — Dan\'s own worked numbers', () => {
  it('a lone magnet contributes its padded cell: 24 x 24', () => {
    const region = regionExtents(measureGroupRegion(layout('single', 1, [node(36, 36, 0, 0)]), PAD))
    expect([region.maxX - region.minX, region.maxY - region.minY]).toEqual([24, 24])
  })

  it('a pair 48 mm apart is 72 x 24 — Dan\'s worked example', () => {
    const pair = layout('run', 1, [node(24, 36, 0, 0), node(72, 36, 1, 0)])
    const region = regionExtents(measureGroupRegion(pair, PAD))
    expect([region.maxX - region.minX, region.maxY - region.minY]).toEqual([72, 24])
  })

  it('four points 48 mm apart give the 72 mm square, and a 72 mm square shape has ZERO flap', () => {
    const four = layout('rectangle-corners', 1, [node(12, 12, 0, 0), node(60, 12, 1, 0), node(12, 60, 0, 1), node(60, 60, 1, 1)])
    const boxes = measureGroupRegion(four, PAD)
    const region = regionExtents(boxes)
    expect([region.maxX - region.minX, region.maxY - region.minY]).toEqual([72, 72])
    const shape = box(0, 0, 72, 72)
    expect(regionInMaterial(shape, boxes, 0.5), 'containment is CLOSED — the region may touch the outline').toBe(true)
    expect(measureOverhangs({ minX: 0, minY: 0, maxX: 72, maxY: 72 }, region)).toEqual([0, 0, 0, 0])
  })

  it('a three-point L keeps its L — no invented fourth corner', () => {
    const l = layout('corner-triangle', 1, [node(12, 12, 0, 0), node(60, 12, 1, 0), node(12, 60, 0, 1)])
    const boxes = measureGroupRegion(l, PAD)
    // two pair boxes (72x24 and 24x72), never the filled 72x72 square
    expect(boxes).toHaveLength(2)
    const areas = boxes.map((b) => (b.maxX - b.minX) * (b.maxY - b.minY)).sort((a, b) => a - b)
    expect(areas).toEqual([72 * 24, 72 * 24])
    // the missing corner cell is NOT part of the region: a shape without it still contains the L
    const lShape: Contour = { outer: { pts: [[0, 0], [72, 0], [72, 24], [24, 24], [24, 72], [0, 72]] }, holes: [] }
    expect(regionInMaterial(lShape, boxes, 0.5)).toBe(true)
    // adding the fourth corner would demand material the L shape does not have
    const filled = layout('rectangle-corners', 1, [...l.nodes, node(60, 60, 1, 1)])
    expect(regionInMaterial(lShape, measureGroupRegion(filled, PAD), 0.5)).toBe(false)
  })

  it('the ruled diagonal pair publishes the padded box of its two diagonal centres', () => {
    const diagonal = layout('run', 1, [node(24, 24, 0, 0), node(72, 72, 1, 1)])
    const region = regionExtents(measureGroupRegion(diagonal, PAD))
    expect([region.maxX - region.minX, region.maxY - region.minY]).toEqual([72, 72])
  })

  it('a sparse pair uses its own population step: two nodes 96 mm apart span 120 mm', () => {
    const sparse = layout('run', 2, [node(24, 36, 0, 0), node(120, 36, 2, 0)])
    const region = regionExtents(measureGroupRegion(sparse, PAD))
    expect(region.maxX - region.minX).toBe(120)
  })

  it('containment refuses a region that leaves the material, and holes are material too', () => {
    const pair = layout('run', 1, [node(24, 36, 0, 0), node(72, 36, 1, 0)])
    const boxes = measureGroupRegion(pair, PAD)
    expect(regionInMaterial(box(0, 0, 96, 72), boxes, 0.5)).toBe(true)
    expect(regionInMaterial(box(0, 0, 60, 72), boxes, 0.5), 'the region pokes out of a short shape').toBe(false)
    const holed: Contour = { outer: { pts: [[0, 0], [96, 0], [96, 72], [0, 72]] }, holes: [{ pts: [[40, 20], [56, 20], [56, 52], [40, 52]] }] }
    expect(regionInMaterial(holed, boxes, 0.5), 'a hole inside the region is not material').toBe(false)
  })

  it('flap is four subtractions from the region\'s outer extents, clamped at zero', () => {
    const region = { minX: 20, minY: 30, maxX: 80, maxY: 90 }
    expect(measureOverhangs({ minX: 0, minY: 10, maxX: 100, maxY: 100 }, region)).toEqual([20, 20, 20, 10])
    expect(measureOverhangs({ minX: 30, minY: 40, maxX: 70, maxY: 80 }, region), 'never negative').toEqual([0, 0, 0, 0])
  })
})
