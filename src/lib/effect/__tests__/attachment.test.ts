// attachment validator fixtures (§8.5b) — PURE mm computation (no three / no canvas).
// Encodes WHY: (1) the magnet grid is the fixed 54mm pitch (§9a); (2) anchors only count INSIDE the
// silhouette (footprint containment, §5.5); (3) gates — stability (≥2 grip points) + anti-flap (no
// silhouette vertex >1 pitch from an anchor); (4) velcro = full panel, always valid; (5) the verdict is
// deterministic + float-free (rides in the payload, §11). All on FINAL-physical-mm (§11-A3).

import { describe, it, expect } from 'vitest'
import type { Contour } from '../types'
import {
  validateAttachment,
  pointInPolygon,
  MAGNET_GRID_PITCH_MM,
} from '../attachment'

const square = (s: number): Contour => ({ outer: { pts: [[0, 0], [s, 0], [s, s], [0, s]] }, holes: [] })

describe('pointInPolygon — footprint-containment primitive', () => {
  const sq = [[0, 0], [100, 0], [100, 100], [0, 100]] as [number, number][]
  it('is true for an interior point', () => expect(pointInPolygon([50, 50], sq)).toBe(true))
  it('is false for an exterior point', () => expect(pointInPolygon([150, 50], sq)).toBe(false))
  it('is false well outside on every side', () => {
    expect(pointInPolygon([-10, 50], sq)).toBe(false)
    expect(pointInPolygon([50, -10], sq)).toBe(false)
    expect(pointInPolygon([50, 110], sq)).toBe(false)
  })
})

describe('validateAttachment — magnet (54mm grid, §9a)', () => {
  it('uses the canonical 54mm pitch', () => expect(MAGNET_GRID_PITCH_MM).toBe(54))

  it('PASSES a large effect: ≥2 contained anchors, every anchor inside the silhouette, no flap', () => {
    const r = validateAttachment(square(140), 'magnet')
    expect(r.ok).toBe(true)
    expect(r.system).toBe('magnet')
    expect(r.anchors.length).toBeGreaterThanOrEqual(2)
    // footprint containment: EVERY returned anchor is inside the silhouette
    for (const a of r.anchors) expect(pointInPolygon(a, square(140).outer.pts)).toBe(true)
    expect(r.issues).toEqual([])
    expect(r.locators).toEqual([])
  })

  it('FAILS a tiny effect (stability gate): too few grip points, with the reason surfaced', () => {
    const r = validateAttachment(square(30), 'magnet')
    expect(r.ok).toBe(false)
    expect(r.anchors.length).toBeLessThan(2)
    expect(r.issues.join(' ')).toContain('too_few_anchors')
  })

  it('is size-dependent: a larger effect yields strictly more contained anchors (§9a)', () => {
    const small = validateAttachment(square(60), 'magnet')
    const large = validateAttachment(square(200), 'magnet')
    expect(large.anchors.length).toBeGreaterThan(small.anchors.length)
  })

  it('FAILS the anti-flap gate: a far protrusion >1 pitch from any anchor → edge_too_far + locators (§11-A9)', () => {
    // A 120×120 body (holds ≥2 grid anchors) with a thin spike up to y=300: the spike vertices sit far
    // from every CONTAINED (body) anchor → the edge_too_far gate fires and `locators` mark the flap points
    // — the exact failure data sub-step 2's §11-A9 UI renders, so it must be a TESTED output (QA finding).
    const spiky: Contour = {
      outer: { pts: [[0, 0], [120, 0], [120, 120], [60, 120], [60, 300], [40, 300], [40, 120], [0, 120]] },
      holes: [],
    }
    const r = validateAttachment(spiky, 'magnet')
    expect(r.anchors.length).toBeGreaterThanOrEqual(2) // NOT a too-few-anchors failure — the body grips fine
    expect(r.ok).toBe(false)
    expect(r.issues.join(' ')).toContain('edge_too_far')
    expect(r.locators.length).toBeGreaterThan(0)
  })
})

describe('validateAttachment — velcro', () => {
  it('is always valid (full back panel), no grid anchors', () => {
    const r = validateAttachment(square(30), 'velcro') // even a tiny effect: velcro just needs a back panel
    expect(r.ok).toBe(true)
    expect(r.system).toBe('velcro')
    expect(r.anchors).toEqual([])
    expect(r.issues).toEqual([])
  })
})

describe('validateAttachment — verdict hash', () => {
  it('is DETERMINISTIC + float-free (16-hex), same geometry+system → same result_hash', () => {
    const a = validateAttachment(square(140), 'magnet')
    const b = validateAttachment(square(140), 'magnet')
    expect(a.result_hash).toBe(b.result_hash)
    expect(a.result_hash).toMatch(/^[0-9a-f]{16}$/)
  })
  it('differs by system + by geometry', () => {
    expect(validateAttachment(square(140), 'magnet').result_hash)
      .not.toBe(validateAttachment(square(140), 'velcro').result_hash)
    expect(validateAttachment(square(140), 'magnet').result_hash)
      .not.toBe(validateAttachment(square(200), 'magnet').result_hash)
  })
})
