import { describe, expect, it } from 'vitest'
import { insertNode, deleteNode } from '../index'
import type { VShape } from '@/lib/vector-core'

// A square with corner anchors (straight edges, no handles) — the shape-builder wiring for the
// node tool: insert adds an anchor ON the tapped edge; delete removes one (min-3 guard).
const square = (): VShape => ({ paths: [{ anchors: [
  { p: { x: 0, y: 0 }, hIn: null, hOut: null, corner: true },
  { p: { x: 100, y: 0 }, hIn: null, hOut: null, corner: true },
  { p: { x: 100, y: 100 }, hIn: null, hOut: null, corner: true },
  { p: { x: 0, y: 100 }, hIn: null, hOut: null, corner: true },
] }] })

describe('node ops — the shape-builder node tool (Dan 2026-08-07)', () => {
  it('insertNode adds an anchor ON the tapped edge (top-edge midpoint)', () => {
    const r = insertNode(square(), 50, 0, 12)
    expect(r).not.toBeNull()
    expect(r!.shape.paths[0].anchors).toHaveLength(5)
    const inserted = r!.shape.paths[0].anchors[r!.ai]
    expect(inserted.p.x).toBeCloseTo(50, 0)
    expect(inserted.p.y).toBeCloseTo(0, 0)
  })
  it('insertNode returns null when the tap is far from every edge (tolerance guard)', () => {
    expect(insertNode(square(), 50, 50, 12)).toBeNull() // dead centre, >12px from any edge
  })
  it('deleteNode removes the anchor', () => {
    const next = deleteNode(square(), 0, 1)
    expect(next).not.toBeNull()
    expect(next!.paths[0].anchors).toHaveLength(3)
  })
  it('deleteNode refuses to drop below 3 anchors (a shape must survive)', () => {
    const tri: VShape = { paths: [{ anchors: square().paths[0].anchors.slice(0, 3) }] }
    expect(deleteNode(tri, 0, 0)).toBeNull()
  })
})
