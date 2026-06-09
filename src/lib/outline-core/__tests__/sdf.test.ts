// outline-core SDF blend golden fixtures (A2b) — the 0→100% square↔silhouette morph.
// Encodes WHY: endpoints are EXACT (t=0 = from, t=1 = to); the in-between is a valid closed ring
// whose area lies between the two; and it's deterministic (client/server parity).

import { describe, it, expect } from 'vitest'
import { resolveSdfBlend, type SdfBlendParams } from '../sdf'
import { signedArea } from '../resolver'
import type { Vec2Px } from '../types'

const smallSquare: Vec2Px[] = [[30, 30], [50, 30], [50, 50], [30, 50]] // area 400
const bigSquare: Vec2Px[] = [[10, 10], [90, 10], [90, 90], [10, 90]] // area 6400
const domain = { minX: 0, minY: 0, width: 100, height: 100 }

function area(ring: Vec2Px[]): number { return Math.abs(signedArea(ring)) }

const base: Omit<SdfBlendParams, 't'> = { fromRings: [smallSquare], toRings: [bigSquare], domain, grid: 120 }

describe('resolveSdfBlend — square↔silhouette morph', () => {
  it('t=0 returns the FROM rings exactly (endpoint bypass)', () => {
    expect(resolveSdfBlend({ ...base, t: 0 })).toEqual([smallSquare])
  })

  it('t=1 returns the TO rings exactly (endpoint bypass)', () => {
    expect(resolveSdfBlend({ ...base, t: 1 })).toEqual([bigSquare])
  })

  it('0<t<1 produces a valid closed ring with area between the two', () => {
    const out = resolveSdfBlend({ ...base, t: 0.5 })
    expect(out.length).toBeGreaterThan(0)
    expect(out[0].length).toBeGreaterThanOrEqual(3)
    const a = area(out[0])
    expect(a).toBeGreaterThan(area(smallSquare)) // bigger than the small one
    expect(a).toBeLessThan(area(bigSquare)) // smaller than the big one
  })

  it('the morph is monotonic in t (bigger t → bigger area, toward the larger shape)', () => {
    const a25 = area(resolveSdfBlend({ ...base, t: 0.25 })[0])
    const a75 = area(resolveSdfBlend({ ...base, t: 0.75 })[0])
    expect(a75).toBeGreaterThan(a25)
  })

  it('is deterministic (client/server parity)', () => {
    const a = resolveSdfBlend({ ...base, t: 0.4 })
    const b = resolveSdfBlend({ ...base, t: 0.4 })
    expect(a).toEqual(b)
  })

  it('EASES even when the FROM shape fills the whole frame (the real full-image-square bug)', () => {
    // Regression: a square that fills the raster domain used to have a degenerate SDF, so the blend
    // snapped to the silhouette for all 0<t<1 instead of easing. With domain padding it must ease.
    const frame: Vec2Px[] = [[0, 0], [100, 0], [100, 100], [0, 100]] // fills the domain → area 10000
    const inset: Vec2Px[] = [[25, 25], [75, 25], [75, 75], [25, 75]] // area 2500
    const a = (t: number) => area(resolveSdfBlend({ fromRings: [frame], toRings: [inset], domain, t, grid: 140 })[0])
    const a25 = a(0.25), a50 = a(0.5), a75 = a(0.75)
    // Monotonic toward the smaller inset as t→1, and genuinely in between (not snapped to either end).
    expect(a25).toBeGreaterThan(a50)
    expect(a50).toBeGreaterThan(a75)
    expect(a50).toBeLessThan(10000)
    expect(a50).toBeGreaterThan(2500)
  })

  it('handles a concave silhouette without throwing (the reason SDF beats vertex morph)', () => {
    const concave: Vec2Px[] = [[10, 10], [90, 10], [90, 90], [55, 90], [55, 45], [45, 45], [45, 90], [10, 90]] // U-shape
    const out = resolveSdfBlend({ fromRings: [smallSquare], toRings: [concave], domain, t: 0.5, grid: 140 })
    expect(out.length).toBeGreaterThan(0)
    expect(out[0].length).toBeGreaterThanOrEqual(3)
  })
})
