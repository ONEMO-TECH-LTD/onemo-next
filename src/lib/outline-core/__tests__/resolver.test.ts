// outline-core resolver golden fixtures (A1a) — per-node corner radii (engine filletCorners math),
// flatten, winding normalization, and self-intersection detection. Encodes WHY:
//   - resolve happens BEFORE flatten (AMEND-F2); per-node radii disable downstream global rounding
//   - convex corners with radius round; sharp / locked / concave pass through
//   - manufacturing winding is normalized (outer CCW, hole CW)
//   - a self-intersecting ring is flagged BLOCK with geometry locators

import { describe, it, expect } from 'vitest'
import type { OutlineDocument, OutlineNode, OutlineRing, OutlineStyle, Vec2Px } from '../types'
import {
  applyCornerRadii,
  flattenPath,
  normalizeRing,
  resolveOutlineDocument,
  repairSimplePolygon,
  signedArea,
  validateSelfIntersection,
} from '../resolver'

function node(id: string, x: number, y: number, corner: OutlineNode['corner'] = { mode: 'inherit' }): OutlineNode {
  return { id, p: [x, y], role: 'corner', corner }
}

function ringOf(id: string, role: OutlineRing['role'], nodes: OutlineNode[], parentRingId?: string): OutlineRing {
  return role === 'outer'
    ? { id, role, closed: true, nodes }
    : { id, role, parentRingId: parentRingId!, closed: true, nodes }
}

function makeDoc(rings: OutlineRing[], style: OutlineStyle): OutlineDocument {
  return {
    version: 1,
    image: { widthPx: 200, heightPx: 200, sourceHash: 'src', orientation: 'baked' },
    mode: 'semi_auto',
    rings,
    style,
    commands: [],
    baseSnapshot: { rings, style },
  }
}

const square = (corner?: OutlineNode['corner']) => [
  node('n1', 0, 0, corner), node('n2', 100, 0, corner),
  node('n3', 100, 100, corner), node('n4', 0, 100, corner),
]

function area(pts: Vec2Px[]): number {
  return Math.abs(signedArea(pts))
}

describe('applyCornerRadii — per-node fillet (engine arc math)', () => {
  it('radius 0 → corners pass through unchanged', () => {
    const out = applyCornerRadii(square(), 0)
    expect(out).toHaveLength(4)
  })

  it('global radius rounds every convex corner into an arc (area shrinks slightly)', () => {
    const out = applyCornerRadii(square({ mode: 'inherit' }), 12)
    expect(out.length).toBeGreaterThan(4) // arcs added points
    const a = area(out)
    expect(a).toBeLessThan(10000) // rounded corners remove material
    expect(a).toBeGreaterThan(9000) // but only at the corners
  })

  it('mode "sharp" keeps that corner; the rest round', () => {
    const nodes = square({ mode: 'inherit' })
    nodes[0].corner = { mode: 'sharp' }
    const out = applyCornerRadii(nodes, 12)
    // the sharp vertex (0,0) survives verbatim
    expect(out.some((p) => p[0] === 0 && p[1] === 0)).toBe(true)
  })

  it('mode "manual" rounds only that corner', () => {
    const nodes = square({ mode: 'sharp' })
    nodes[1].corner = { mode: 'manual', outlineCornerRadiusPx: 20 }
    const out = applyCornerRadii(nodes, 0)
    // three sharp vertices survive; the manual corner (100,0) is replaced by an arc
    expect(out.some((p) => p[0] === 100 && p[1] === 0)).toBe(false)
    expect(out.some((p) => p[0] === 0 && p[1] === 0)).toBe(true)
  })

  it('locked inherit corner ignores the global "round all"', () => {
    const nodes = square({ mode: 'inherit' })
    nodes[2].corner = { mode: 'inherit', locked: true }
    const out = applyCornerRadii(nodes, 12)
    expect(out.some((p) => p[0] === 100 && p[1] === 100)).toBe(true) // locked corner kept sharp
  })
})

describe('flatten + normalize', () => {
  it('flatten removes collinear midpoints', () => {
    const withMid: Vec2Px[] = [[0, 0], [50, 0], [100, 0], [100, 100], [0, 100]]
    const flat = flattenPath(withMid, 0.1)
    expect(flat.some((p) => p[0] === 50 && p[1] === 0)).toBe(false)
  })

  it('normalizeRing forces outer CCW and hole CW', () => {
    const cw: Vec2Px[] = [[0, 0], [0, 100], [100, 100], [100, 0]] // clockwise
    expect(signedArea(normalizeRing(cw, 'outer'))).toBeGreaterThan(0)
    expect(signedArea(normalizeRing(cw, 'hole'))).toBeLessThan(0)
  })
})

describe('validateSelfIntersection', () => {
  it('detects a bowtie crossing', () => {
    const bowtie: Vec2Px[] = [[0, 0], [100, 100], [100, 0], [0, 100]]
    expect(validateSelfIntersection(bowtie, 'r1').length).toBeGreaterThan(0)
  })
  it('passes a simple square', () => {
    const sq: Vec2Px[] = [[0, 0], [100, 0], [100, 100], [0, 100]]
    expect(validateSelfIntersection(sq, 'r1')).toHaveLength(0)
  })
})

describe('repairSimplePolygon — clean the auto-generated outline', () => {
  it('removes a self-intersection (bowtie → simple)', () => {
    const bowtie: Vec2Px[] = [[0, 0], [100, 100], [100, 0], [0, 100]]
    const fixed = repairSimplePolygon(bowtie)
    expect(fixed.length).toBeGreaterThanOrEqual(3)
    expect(validateSelfIntersection(fixed, 'r')).toHaveLength(0)
  })
  it('merges near-coincident anchors (the overlapping-handle artifact)', () => {
    const pts: Vec2Px[] = [[0, 0], [100, 0], [101, 1], [100, 100], [0, 100]] // 2nd+3rd ~coincident
    const fixed = repairSimplePolygon(pts, 5)
    expect(fixed.length).toBeLessThan(pts.length)
    expect(validateSelfIntersection(fixed, 'r')).toHaveLength(0)
  })
  it('leaves a clean polygon untouched', () => {
    const sq: Vec2Px[] = [[0, 0], [100, 0], [100, 100], [0, 100]]
    expect(repairSimplePolygon(sq)).toHaveLength(4)
  })
})

describe('resolveOutlineDocument', () => {
  it('is deterministic and disables downstream corner rounding', () => {
    const doc = makeDoc([ringOf('r1', 'outer', square())], { globalOutlineCornerRadiusPx: 10, smoothing: 0 })
    const a = resolveOutlineDocument(doc, { flattenTolerancePx: 0.1 })
    const b = resolveOutlineDocument(doc, { flattenTolerancePx: 0.1 })
    expect(a.flattenedRingsPx).toEqual(b.flattenedRingsPx)
    expect(a.policy.downstream_corner_rounding).toBe('disabled')
    expect(a.policy.corner_radii_applied).toBe(true)
    expect(a.outlineDocumentHash).toMatch(/^[0-9a-f]{16}$/)
    expect(a.issues).toHaveLength(0)
  })

  it('flags a self-intersecting outer ring as BLOCK with locators', () => {
    const bowtieNodes = [node('n1', 0, 0, { mode: 'sharp' }), node('n2', 100, 100, { mode: 'sharp' }), node('n3', 100, 0, { mode: 'sharp' }), node('n4', 0, 100, { mode: 'sharp' })]
    const doc = makeDoc([ringOf('r1', 'outer', bowtieNodes)], { globalOutlineCornerRadiusPx: 0, smoothing: 0 })
    const res = resolveOutlineDocument(doc, { flattenTolerancePx: 0.1 })
    expect(res.issues.some((i) => i.code === 'SELF_INTERSECTION' && i.severity === 'block')).toBe(true)
    expect(res.locators.length).toBeGreaterThan(0)
  })

  it('smoothing applies a Catmull-Rom resample (more points + the flag)', () => {
    const sharp = makeDoc([ringOf('r1', 'outer', square({ mode: 'sharp' }))], { globalOutlineCornerRadiusPx: 0, smoothing: 0 })
    const smooth = makeDoc([ringOf('r1', 'outer', square({ mode: 'sharp' }))], { globalOutlineCornerRadiusPx: 0, smoothing: 0.8 })
    const rs = resolveOutlineDocument(sharp, { flattenTolerancePx: 0.05 })
    const rm = resolveOutlineDocument(smooth, { flattenTolerancePx: 0.05 })
    expect(rs.policy.smoothing_applied).toBe(false)
    expect(rm.policy.smoothing_applied).toBe(true)
    expect(rm.resolvedRingsPx[0].length).toBeGreaterThan(rs.resolvedRingsPx[0].length)
  })

  it('normalizes an outer ring to CCW in the flattened output', () => {
    const cwSquare = [node('n1', 0, 0, { mode: 'sharp' }), node('n2', 0, 100, { mode: 'sharp' }), node('n3', 100, 100, { mode: 'sharp' }), node('n4', 100, 0, { mode: 'sharp' })]
    const doc = makeDoc([ringOf('r1', 'outer', cwSquare)], { globalOutlineCornerRadiusPx: 0, smoothing: 0 })
    const res = resolveOutlineDocument(doc, { flattenTolerancePx: 0.1 })
    expect(signedArea(res.flattenedRingsPx[0])).toBeGreaterThan(0)
  })
})
