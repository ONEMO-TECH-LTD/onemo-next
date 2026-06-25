// outline-core resolver — live ring-math fixtures: flatten, winding normalization,
// self-intersection detection + repair. Encodes WHY:
//   - manufacturing winding is normalized (outer CCW, hole CW)
//   - a self-intersecting ring is flagged with geometry locators, and is repairable

import { describe, it, expect } from 'vitest'
import type { Vec2Px } from '../types'
import {
  flattenPath,
  normalizeRing,
  repairSimplePolygon,
  signedArea,
  validateSelfIntersection,
} from '../resolver'

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
