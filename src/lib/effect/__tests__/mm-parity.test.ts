// KAI-9089 — mm-producer parity: contourFromShape (the 3D / manufacturing contour) and
// toManufacturingSVG (the cut-line export) both derive mm geometry from the ONE VShape. They differ in
// y-orientation + winding, but the EXTENT (mm width/height) MUST agree — a parity assertion so the two
// producers can't silently diverge (the divergence MFG-2/MFG-3 flagged at helper level).

import { describe, it, expect } from 'vitest'
import { contourFromShape } from '../geometry-truth'
import { toManufacturingSVG, parsePathD } from '@/lib/export'
import type { VShape } from '@/lib/vector-core'

// a single-path 400×300 px rectangle (the current producers are single-path)
const rect: VShape = {
  paths: [{
    anchors: [
      { p: { x: 100, y: 100 }, hIn: null, hOut: null, corner: true },
      { p: { x: 500, y: 100 }, hIn: null, hOut: null, corner: true },
      { p: { x: 500, y: 400 }, hIn: null, hOut: null, corner: true },
      { p: { x: 100, y: 400 }, hIn: null, hOut: null, corner: true },
    ],
  }],
}

const ext = (pts: { x: number; y: number }[]) => {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

describe('KAI-9089 — mm-producer parity (contourFromShape vs toManufacturingSVG)', () => {
  it('both producers agree on the mm extent of a single-path shape', () => {
    const mmPerPx = 0.1, widthPx = 1200, heightPx = 900
    const contour = contourFromShape(rect, { mmPerPx, maskHeightPx: heightPx })
    expect(contour).toBeTruthy()
    const svg = toManufacturingSVG(rect, { mmPerPx, widthPx, heightPx })
    const d = svg.match(/d="([^"]+)"/)
    expect(d).toBeTruthy()
    const svgPts = parsePathD(d![1]).flatMap((p) => p.anchors.map((a) => a.p))
    const cb = ext(contour!.outer.pts.map(([x, y]) => ({ x, y })))
    const sb = ext(svgPts)
    // both = px-bbox × mmPerPx (400×300 px → 40×30 mm); y-flip + winding don't change the extent
    expect(Math.abs(cb.w - sb.w)).toBeLessThan(0.2)
    expect(Math.abs(cb.h - sb.h)).toBeLessThan(0.2)
    expect(cb.w).toBeGreaterThan(39); expect(cb.w).toBeLessThan(41) // ≈ 40 mm
    expect(cb.h).toBeGreaterThan(29); expect(cb.h).toBeLessThan(31) // ≈ 30 mm
  })
})
