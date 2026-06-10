// export module proofs (Run 7) — mm truth, winding determinism, dialect round-trip, loud failure.

import { describe, test, expect } from 'vitest'
import { toManufacturingSVG, normalizeWinding, parsePathD } from '../index'
import { getShape, unitShape } from '@/lib/shape-library'
import { flattenPath, signedArea, cubicPoint, segments, transformShape } from '@/lib/vector-core'

describe('export — mm-true SVG', () => {
  test('document is mm-true: width/height carry mm units, viewBox = physical mm box', () => {
    const heart = getShape('heart', 1200, 900)
    const svg = toManufacturingSVG(heart, { mmPerPx: 0.1, widthPx: 1200, heightPx: 900 })
    expect(svg).toContain('width="120mm"')
    expect(svg).toContain('height="90mm"')
    expect(svg).toContain('viewBox="0 0 120 90"')
    expect(svg).toContain('nominal dimensions')
    // geometry scaled into the mm frame: all coords within the 120×90 box
    const d = svg.match(/d="([^"]+)"/)![1]
    const nums = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [parseFloat(m[1]), parseFloat(m[2])])
    for (const [x, y] of nums) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(120)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(90)
    }
  })

  test('true curves survive: heart exports 6 C commands, zero polyline fallback', () => {
    const heart = getShape('heart', 1200, 900)
    const svg = toManufacturingSVG(heart, { mmPerPx: 0.1, widthPx: 1200, heightPx: 900 })
    const d = svg.match(/d="([^"]+)"/)![1]
    expect((d.match(/C /g) || []).length).toBe(6)
    expect(d.includes(' L ')).toBe(false)
  })

  test('winding normalization is deterministic: outer ring forced CCW (negative y-down area)', () => {
    const circle = unitShape('circle')
    const reversed = { paths: [{ anchors: [...circle.paths[0].anchors].reverse().map((a) => ({ p: a.p, hIn: a.hOut, hOut: a.hIn, corner: a.corner })) }] }
    for (const candidate of [circle, reversed]) {
      const norm = normalizeWinding(candidate)
      expect(signedArea(flattenPath(norm.paths[0], 0.01))).toBeLessThan(0)
    }
  })

  test('round-trip: parse own output and recover the exact geometry', () => {
    const heart = getShape('heart', 1200, 900)
    const svg = toManufacturingSVG(heart, { mmPerPx: 0.1, widthPx: 1200, heightPx: 900 })
    const d = svg.match(/d="([^"]+)"/)![1]
    const parsed = parsePathD(d)
    expect(parsed).toHaveLength(1)
    // compare sampled curve points between the normalized mm original and the parse-back
    const orig = normalizeWinding(transformShape(heart, (p) => ({ x: p.x * 0.1, y: p.y * 0.1 }))).paths[0]
    const back = parsed[0]
    const so = segments(orig), sb = segments(back)
    expect(sb).toHaveLength(so.length)
    let maxErr = 0
    for (let i = 0; i < so.length; i++) {
      for (let t = 0; t <= 10; t++) {
        const a = so[i], b = sb[i]
        const pa = a.c1 && a.c2 ? cubicPoint(a.a, a.c1, a.c2, a.b, t / 10) : { x: a.a.x + (a.b.x - a.a.x) * (t / 10), y: a.a.y + (a.b.y - a.a.y) * (t / 10) }
        const pb = b.c1 && b.c2 ? cubicPoint(b.a, b.c1, b.c2, b.b, t / 10) : { x: b.a.x + (b.b.x - b.a.x) * (t / 10), y: b.a.y + (b.b.y - b.a.y) * (t / 10) }
        maxErr = Math.max(maxErr, Math.hypot(pa.x - pb.x, pa.y - pb.y))
      }
    }
    expect(maxErr).toBeLessThan(0.001) // 1 micron at mm scale — serialization precision only
  })

  test('profiles: laser = stroke-only cut line · cricut = filled silhouette', () => {
    const sq = getShape('square', 1000, 1000)
    const laser = toManufacturingSVG(sq, { mmPerPx: 0.07, widthPx: 1000, heightPx: 1000 })
    expect(laser).toContain('fill="none"')
    expect(laser).toContain('stroke=')
    const cricut = toManufacturingSVG(sq, { mmPerPx: 0.07, widthPx: 1000, heightPx: 1000, profile: 'cricut' })
    expect(cricut).toContain('fill="#000000"')
    expect(cricut).toContain('stroke="none"')
  })

  test('parser fails LOUDLY outside the dialect (no silent mangles)', () => {
    expect(() => parsePathD('M 0 0 A 5 5 0 0 1 10 10 Z')).toThrow(/unsupported command/)
    expect(() => parsePathD('garbage')).toThrow()
  })
})
