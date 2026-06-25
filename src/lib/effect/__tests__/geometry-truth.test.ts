// geometry-truth tests — P1 gate (REBUILD-PLAN-v2 §E·P1): fit/contour/feasibility parity on
// fixtures + hash identity. These encode the seam's contract, not implementation details:
// ONE pipeline, deterministic, fail-loud nulls, verdict parity with the legacy gate's classes.

import { describe, it, expect } from 'vitest'
import { contourFromShape, assertContourCuttable, vectorShapeHash, MANUFACTURING_TOLERANCE_MM } from '../geometry-truth'
import { vectoriseTrace } from './geometry-truth.legacy' // R4: retired trace-fit, test-only
import { fairingFromDetail, BEN_DEFAULT_DETAIL } from '@/lib/outline-core'
import { getShape } from '@/lib/shape-library'
import { flattenShape, type VShape } from '@/lib/vector-core'
import { filletShape } from '@/lib/vector-core/__tests__/fillet-fixtures' // test fixture (moved out of production path.ts)
import type { Pt } from '../types'

const FAIRING = fairingFromDetail(BEN_DEFAULT_DETAIL)

/** dense traced-ring fixture: a wobbly blob in mask px, y-up (the generation-side input). */
function blobTrace(n = 600, r = 200, cx = 300, cy = 300): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r * (1 + 0.08 * Math.sin(5 * a) + 0.02 * Math.sin(23 * a)) // organic + trace jitter
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)])
  }
  return pts
}

describe('[legacy/R4-quarantined] vectoriseTrace — trace→vector fit (NOT the active pipeline; KAI-9084)', () => {
  it('fits a dense trace into true curves and is deterministic (generation ≡ editor)', () => {
    const v1 = vectoriseTrace(blobTrace(), 600, FAIRING)
    const v2 = vectoriseTrace(blobTrace(), 600, FAIRING)
    expect(v1).not.toBeNull()
    expect(v1!.paths[0].anchors.length).toBeGreaterThan(3)
    // identical input → byte-identical truth: the single-pipeline guarantee
    expect(vectorShapeHash(v1!)).toBe(vectorShapeHash(v2!))
    // a fitted organic ring is curves, not a polyline: handles must exist
    expect(v1!.paths[0].anchors.some((a) => a.hIn || a.hOut)).toBe(true)
  })

  it('fails loud (null) on a too-sparse trace — no silent fallback door', () => {
    expect(vectoriseTrace(blobTrace(10), 600, FAIRING)).toBeNull()
    expect(vectoriseTrace([], 600, FAIRING)).toBeNull()
  })

  it('owns the y-flip: a y-up trace lands in y-down editor space', () => {
    const H = 600
    const v = vectoriseTrace(blobTrace(), H, FAIRING)!
    const ring = flattenShape(v, 0.5)[0]
    const cy = ring.reduce((s, p) => s + p.y, 0) / ring.length
    expect(cy).toBeCloseTo(H - 300, -1) // blob centred at mask-y 300 → editor-y H−300
  })
})

describe('contourFromShape — the one manufacturing flatten', () => {
  it('square+fillet → mm contour at manufacturing tolerance with mesh winding (CCW in y-up mm)', () => {
    const v = filletShape(getShape('square', 500, 500), 60)
    const c = contourFromShape(v, { mmPerPx: 0.14, maskHeightPx: 500 })!
    expect(c.outer.pts.length).toBeGreaterThan(16) // arcs flattened, not 4 corners
    // winding parity with spec.geometryMM's canon: outer CCW in y-up mm = POSITIVE signed area
    // (prepare-effect's standard square [[0,0],[w,0],[w,h],[0,h]] in y-up is CCW-positive; the
    // editor chain — y-down flatten → flip → reverse — lands the same sign; so must this one)
    let area = 0
    const pts = c.outer.pts
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]
      area += ax * by - bx * ay
    }
    expect(area).toBeGreaterThan(0)
    // chord error stays within the manufacturing tolerance budget: every point's distance from
    // the square's rounded boundary is bounded by tolerance (spot-check via radius band at corners)
    expect(MANUFACTURING_TOLERANCE_MM).toBe(0.05)
  })

  it('fails loud (null) on a degenerate shape', () => {
    const line: VShape = { paths: [{ anchors: [{ p: { x: 0, y: 0 }, corner: true }, { p: { x: 10, y: 0 }, corner: true }] }] }
    expect(contourFromShape(line, { mmPerPx: 1, maskHeightPx: 100 })).toBeNull()
  })
})

describe('assertContourCuttable — feasibility verdict parity (legacy gate classes)', () => {
  it('passes a clean shape', () => {
    const v = filletShape(getShape('square', 500, 500), 60)
    const c = contourFromShape(v, { mmPerPx: 1, maskHeightPx: 500 })!
    expect(assertContourCuttable(c).ok).toBe(true)
  })

  it('rejects a self-intersecting ring (bowtie crossing)', () => {
    const c = { outer: { pts: [[0, 0], [100, 100], [100, 0], [0, 100]] as Pt[] }, holes: [] }
    expect(assertContourCuttable(c)).toEqual({ ok: false, reason: 'self-intersection' })
  })

  it('rejects a collapsed/degenerate ring', () => {
    const c = { outer: { pts: [[0, 0], [0.2, 0], [0.4, 0.1]] as Pt[] }, holes: [] }
    expect(assertContourCuttable(c)).toEqual({ ok: false, reason: 'degenerate' })
  })
})

describe('vectorShapeHash — the vector F1 bond key', () => {
  it('is stable across calls and sensitive to every identity component', () => {
    const base = filletShape(getShape('square', 500, 500), 60)
    const h = vectorShapeHash(base)
    expect(vectorShapeHash(filletShape(getShape('square', 500, 500), 60))).toBe(h) // deterministic
    expect(vectorShapeHash(filletShape(getShape('square', 500, 500), 61))).not.toBe(h) // geometry
    const moved: VShape = { paths: [{ anchors: base.paths[0].anchors.map((a, i) => (i === 0 ? { ...a, p: { x: a.p.x + 0.01, y: a.p.y } } : a)) }] }
    expect(vectorShapeHash(moved)).not.toBe(h) // sub-pixel anchor move (≥ micro-px) changes identity
    const cornerFlip: VShape = { paths: [{ anchors: base.paths[0].anchors.map((a, i) => (i === 0 ? { ...a, corner: !a.corner } : a)) }] }
    expect(vectorShapeHash(cornerFlip)).not.toBe(h) // corner/smooth class is identity
  })

  it('hashes handle ABSENCE explicitly (line vs cubic differ)', () => {
    const square = getShape('square', 500, 500)
    const withHandle: VShape = {
      paths: [{ anchors: square.paths[0].anchors.map((a, i) => (i === 0 ? { ...a, hOut: { x: a.p.x + 5, y: a.p.y } } : a)) }],
    }
    expect(vectorShapeHash(withHandle)).not.toBe(vectorShapeHash(square))
  })
})
