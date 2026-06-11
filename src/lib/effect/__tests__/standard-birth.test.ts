// KAI-8975/P2 — standard product birth, directly regression-tested. This is how the 562de4b bug
// (born as the centered 72% library square → zoomed photo, wrong physical size) escaped green
// gates: tests proved payload math on a plausible library construct, never that the standard
// product shape IS the full photo. The shape-library 'square' remains a generic vector fixture
// elsewhere — it is NOT a product-birth fixture.
import { describe, it, expect } from 'vitest'
import { standardBirthShape, EFFECT_BUILD_CONFIG } from '../prepare-effect'
import { contourFromShape } from '../geometry-truth'
import { shapeBBox } from '@/lib/vector-core'
import { getShape } from '@/lib/shape-library'

describe('standard birth (KAI-8975/P2)', () => {
  const W = 1200, H = 900
  const birth = standardBirthShape(W, H)

  it('the born vector is the FULL image: bounds = (0,0)–(W,H)', () => {
    const bb = shapeBBox(birth.vectorShape, 0.1)
    expect(bb.minX).toBeCloseTo(0, 1)
    expect(bb.minY).toBeCloseTo(0, 1)
    expect(bb.maxX).toBeCloseTo(W, 1)
    expect(bb.maxY).toBeCloseTo(H, 1)
  })

  it('mm dimensions use the REAL image: 1200x900 → 70 x 52.5 mm', () => {
    const contour = contourFromShape(birth.vectorShape, { mmPerPx: birth.mmPerPx, maskHeightPx: H })!
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [x, y] of contour.outer.pts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    expect(maxX - minX).toBeCloseTo(70, 1)
    expect(maxY - minY).toBeCloseTo(52.5, 1)
  })

  it('the 8mm corner radius is applied AFTER full-image birth (true arcs, 8mm absolute)', () => {
    expect(birth.radiusPx).toBe(Math.round(EFFECT_BUILD_CONFIG.squareCornerMM / birth.mmPerPx))
    const anchors = birth.vectorShape.paths[0].anchors
    expect(anchors.length).toBeGreaterThan(4) // filleted — arcs replaced the sharp rect corners
    for (const a of anchors) {
      // no anchor sits AT a sharp image corner — every corner is rounded away
      for (const [cx, cy] of [[0, 0], [W, 0], [W, H], [0, H]] as const) {
        expect(Math.hypot(a.p.x - cx, a.p.y - cy)).toBeGreaterThan(birth.radiusPx * 0.25)
      }
    }
  })

  it('the radius clamps to the inscribable max on tiny images (never inverts the shape)', () => {
    const tiny = standardBirthShape(40, 20)
    expect(tiny.radiusPx).toBeLessThanOrEqual(10) // floor(min(40,20)/2)
  })

  it('DOCUMENTS THE 562de4b CLASS: the shape-library square is NOT product birth (centered, 72%)', () => {
    const lib = shapeBBox(getShape('square', W, H), 0.1)
    expect(lib.maxX - lib.minX).toBeLessThan(W * 0.8) // 72% side — a SEED for choose-a-shape
    expect(lib.minX).toBeGreaterThan(0) // centered, not full-bleed
  })
})
