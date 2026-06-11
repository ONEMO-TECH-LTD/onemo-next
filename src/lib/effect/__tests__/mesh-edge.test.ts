// 3D edge proofs (KAI-8951): the rim is an OUTWARD convex lip (never an inward groove), caps keep
// the FULL contour extent (no crease ring), and the silhouette tracks the contour everywhere.

import { describe, test, expect } from 'vitest'
import { buildShapedGeometry } from '../mesh'
import { flattenPath } from '@/lib/vector-core'
import { getShape, unitShape } from '@/lib/shape-library'
import type { Contour, Pt } from '../types'

const OPTS = { thicknessMM: 1, edgeRadiusMM: 0.15, edgeSegments: 14, mmPerPx: 0.1, imgW: 600, imgH: 600 }

function circleContour(rMM: number, n = 720): Contour {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n
    pts.push([30 + rMM * Math.cos(t), 30 + rMM * Math.sin(t)])
  }
  return { outer: { pts }, holes: [] }
}

describe('mesh — outward rounded lip (KAI-8951)', () => {
  const R = 20 // contour radius (mm); geometry is centered, so radial distance is from origin
  const r = OPTS.edgeRadiusMM
  const { geometry } = buildShapedGeometry(circleContour(R), OPTS)
  const pos = geometry.getAttribute('position')
  const groups = geometry.groups // [front(cap), edge, back] — by addGroup order: edge first in buffer
  const edgeGroup = groups.find((g) => g.materialIndex === 1)!
  const frontGroup = groups.find((g) => g.materialIndex === 0)!

  test('the lip rolls OUTWARD: edge band stays in [contour, contour + r] — a groove is impossible', () => {
    let minRad = Infinity, maxRad = -Infinity, crest = -Infinity
    for (let i = edgeGroup.start; i < edgeGroup.start + edgeGroup.count; i++) {
      const rad = Math.hypot(pos.getX(i), pos.getY(i))
      if (rad < minRad) minRad = rad
      if (rad > maxRad) maxRad = rad
      if (Math.abs(pos.getZ(i)) <= OPTS.thicknessMM / 2 - OPTS.edgeRadiusMM + 1e-6) crest = Math.max(crest, rad) // the wall band
    }
    expect(minRad).toBeGreaterThanOrEqual(R - 1e-3) // NOTHING dips inside the contour (no groove)
    expect(maxRad).toBeLessThanOrEqual(R + r + 1e-3) // bulge bounded by the lip radius
    expect(crest).toBeGreaterThan(R + r * 0.9) // the convex crest exists at mid-wall
  })

  test('caps keep the FULL contour extent (the old inset crease ring is gone)', () => {
    let maxRad = -Infinity
    for (let i = frontGroup.start; i < frontGroup.start + frontGroup.count; i++) {
      maxRad = Math.max(maxRad, Math.hypot(pos.getX(i), pos.getY(i)))
    }
    expect(maxRad).toBeGreaterThan(R - 1e-3) // was R − r before (the groove's crease line)
    expect(maxRad).toBeLessThanOrEqual(R + 1e-3)
  })

  test('the lip is tangent to the faces: edge band z-extent equals the body thickness', () => {
    let minZ = Infinity, maxZ = -Infinity
    for (let i = edgeGroup.start; i < edgeGroup.start + edgeGroup.count; i++) {
      minZ = Math.min(minZ, pos.getZ(i)); maxZ = Math.max(maxZ, pos.getZ(i))
    }
    expect(maxZ).toBeCloseTo(OPTS.thicknessMM / 2, 5)
    expect(minZ).toBeCloseTo(-OPTS.thicknessMM / 2, 5)
  })
})

describe('mesh — vector-true tessellation cost (KAI-8951 report)', () => {
  test('display-grade flatten cost on the heart: points and vertex estimate, reported', () => {
    const heart = getShape('heart', 800, 600) // editor-px space, k = 0.0875 → mm
    const k = 0.0875
    const manufacturing = flattenPath(heart.paths[0], Math.max(0.05, 0.05 / k)).length
    const display = flattenPath(heart.paths[0], Math.max(0.01, 0.004 / k)).length
    const profileSamples = 2 * (OPTS.edgeSegments + 1) + 2
    const vertsDisplay = display * (profileSamples - 1) * 6 + display * 6 // edge quads + ~caps
    console.log(`[KAI-8951 cost] heart contour: ${manufacturing} pts @0.05mm → ${display} pts @0.004mm; est. mesh verts ≈ ${vertsDisplay}`)
    expect(display).toBeGreaterThan(manufacturing) // finer, as designed
    expect(vertsDisplay).toBeLessThan(600_000) // sanity ceiling for mobile (one static mesh)
    // smoothness: the display flatten's chord sagitta is ≤0.004mm by construction (adaptive flatten proof in kernel)
    expect(unitShape('heart').paths[0].anchors).toHaveLength(6) // source stays the true vector
  })
})
