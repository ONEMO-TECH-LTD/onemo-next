import { describe, it, expect } from 'vitest'
import { vectoriseTrace } from './geometry-truth.legacy' // R4: retired trace-fit, test-only
import { fairingFromDetail, BEN_DEFAULT_DETAIL } from '@/lib/outline-core'
import type { Pt } from '@/lib/effect/types'

const F = fairingFromDetail(BEN_DEFAULT_DETAIL)
function trace(kind: 'smooth' | 'boxy' | 'star'): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < 800; i++) {
    const a = (i / 400) * Math.PI
    let r = 300
    if (kind === 'smooth') r = 300 * (1 + 0.05 * Math.sin(3 * a))
    if (kind === 'boxy') { const c = Math.cos(a), s = Math.sin(a); r = 280 / Math.max(Math.abs(c), Math.abs(s)) }
    if (kind === 'star') { const t = (a * 5 / (2 * Math.PI)) % 1; r = 180 + 140 * (t < 0.5 ? t * 2 : (1 - t) * 2) }
    pts.push([500 + r * Math.cos(a), 450 + r * Math.sin(a)])
  }
  return pts
}
const corners = (k: 'smooth' | 'boxy' | 'star') => {
  const v = vectoriseTrace(trace(k), 900, F)!
  const c = v.paths[0].anchors.filter((x) => x.corner).length
  console.log(`[census2] ${k}: ${v.paths[0].anchors.length} anchors, ${c} corners`)
  return c
}
describe('corner integrity (Dan directive) [via legacy/R4 vectoriseTrace fixture — KAI-9084]', () => {
  it('a boxy subject keeps its 4 sharp corners as TRUE corner anchors', () => { expect(corners('boxy')).toBe(4) })
  it('a 5-spike star keeps its 10 sharp features', () => { const c = corners('star'); expect(c).toBeGreaterThanOrEqual(8); expect(c).toBeLessThanOrEqual(12) })
  it('a smooth blob stays cornerless (smoothing repeats the silhouette)', () => { expect(corners('smooth')).toBe(0) })
})
