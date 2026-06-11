// KAI-8972 regression — the editor image-upload chain (mask → smoothMask → trace → THE one fit).
// Root cause pinned during the fix: Otsu on anti-aliased edges leaves ±sub-px boundary jitter that
// reads as >55° turns on the RDP skeleton — FALSE corner anchors on smooth uploads (8 on an
// ellipse). Magic never sees it because its pipeline smooths the mask before tracing; the upload
// chain must ride the SAME mask hygiene. Corner integrity must still survive it: a jittered
// triangle keeps its 3 true corners.
import { describe, it, expect } from 'vitest'
import { smoothMask } from '../mask'
import { traceContourRaw } from '../contour'
import { vectoriseTrace } from '../geometry-truth'
import { fairingFromDetail, BEN_DEFAULT_DETAIL } from '@/lib/outline-core'

const W = 512, H = 512

/** deterministic per-pixel hash noise — simulates Otsu splitting AA gradient pixels */
const jitter = (x: number, y: number) => ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 - 0.5) * 0.008

function ellipseMaskAA() {
  const mask = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.sqrt(((x - W / 2) / 192) ** 2 + ((y - H / 2) / 144) ** 2)
    mask[y * W + x] = r <= 1 + jitter(x, y) ? 1 : 0
  }
  return mask
}

function triangleMaskAA() {
  // triangle (256,40)-(472,440)-(40,440) via half-plane tests, with the same AA-class jitter
  const mask = new Uint8Array(W * H)
  const edges: Array<[number, number, number, number]> = [[256, 40, 472, 440], [472, 440, 40, 440], [40, 440, 256, 40]]
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let inside = true
    for (const [ax, ay, bx, by] of edges) {
      const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
      const len = Math.hypot(bx - ax, by - ay)
      if (cross / len < jitter(x, y) * 100) { inside = false; break } // signed distance + jitter
    }
    mask[y * W + x] = inside ? 1 : 0
  }
  return mask
}

function fitFromMask(mask: Uint8Array, smooth: boolean) {
  const m = smooth ? smoothMask(mask, W, H, 3) : mask
  const ring = traceContourRaw(m, W, H)!
  let area = 0
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; area += p[0] * q[1] - q[0] * p[1] }
  const oriented = area > 0 ? [...ring].reverse() : ring
  return vectoriseTrace(oriented.map(([x, y]) => [x, H - y] as [number, number]), H, fairingFromDetail(BEN_DEFAULT_DETAIL))!
}

const cornerCount = (v: ReturnType<typeof fitFromMask>) => v.paths[0].anchors.filter((a) => a.corner).length

describe('image-upload fit chain (KAI-8972)', () => {
  it('REPRO (the bug class): AA-jittered ellipse WITHOUT mask smoothing grows false corners', () => {
    expect(cornerCount(fitFromMask(ellipseMaskAA(), false))).toBeGreaterThan(0)
  })
  it('FIX: the same ellipse THROUGH smoothMask fits all-curves — zero false corners', () => {
    expect(cornerCount(fitFromMask(ellipseMaskAA(), true))).toBe(0)
  })
  it('corner integrity SURVIVES the smoothing: a jittered triangle keeps its 3 true corners', () => {
    const c = cornerCount(fitFromMask(triangleMaskAA(), true))
    expect(c).toBe(3)
  })
})
