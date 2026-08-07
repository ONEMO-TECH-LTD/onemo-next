// cutout-ai — brush microservice (ARCHITECTURE.md law 6). The accepted mask is the BASE and is
// never discarded by a touch-up: Add = model-snapped region under the stroke UNIONED into the base
// (the ear-gap fix — brushing a missed tip fills it, the rest stays); Erase = model-snapped region
// SUBTRACTED. Full re-detect is a separate explicit action. Pure state over an injected segment fn.

import { CENTRAL_PROMPT } from './registry'
import type { Mask, Point } from './types'

/** The one dependency: a guided/auto segment call (the active model sub, wherever it runs). */
export type SegmentFn = (points: Point[], auto: boolean) => Promise<Mask>

const union = (base: Uint8Array, add: Uint8Array) => { for (let i = 0; i < base.length; i++) if (add[i]) base[i] = 1 }
const subtract = (base: Uint8Array, rem: Uint8Array) => { for (let i = 0; i < base.length; i++) if (rem[i]) base[i] = 0 }
// The SOFT matte channel must merge with the SAME algebra as the binary (Dan 2026-08-06: repeated
// strokes composited with a STALE soft matte — first generation clean, repeats artifacted).
const softOf = (m: Mask): Uint8Array => m.soft ?? Uint8Array.from(m.data, (v) => (v ? 255 : 0))
const unionSoft = (base: Mask, add: Mask): Uint8Array => {
  const a = softOf(base), b = softOf(add), out = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = Math.max(a[i], b[i])
  return out
}
const subtractSoft = (base: Mask, rem: Mask): Uint8Array => {
  const a = softOf(base), b = softOf(rem), out = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = Math.min(a[i], 255 - b[i])
  return out
}

/** Thin a dense stroke trail to at most `max` prompt points (SAM degrades on huge point sets). */
export const thinStroke = (pts: Point[], max = 32): Point[] =>
  pts.length <= max ? pts : pts.filter((_, i) => i % Math.ceil(pts.length / max) === 0)

export class BrushSession {
  private base: Mask | null = null
  constructor(private segment: SegmentFn) {}

  /** Current accepted mask (a live reference — copy before mutating outside). */
  get mask(): Mask | null { return this.base }

  reset(): void { this.base = null }

  /** Seed/replace the base with an externally produced mask (the selected flow: u2net's auto cut
   *  is the base; EdgeSAM strokes union/subtract into it). */
  setBase(mask: Mask): void { this.base = mask }

  /** Explicit full auto re-detect — the ONLY operation that replaces the base. */
  async redetect(): Promise<Mask> {
    this.base = await this.segment(CENTRAL_PROMPT, true)
    return this.base
  }

  /** Add-stroke: model-snap the region under the stroke, union into the base. Never replaces. */
  async addStroke(stroke: Point[]): Promise<Mask> {
    const pts = thinStroke(stroke).map((p) => ({ ...p, label: 1 as const }))
    const region = await this.segment(pts, false)
    if (!this.base) { this.base = region; return this.base }
    this.base.soft = unionSoft(this.base, region)
    union(this.base.data, region.data)
    return this.base
  }

  /** Erase-stroke: model-snap the region under the stroke, subtract from the base.
   *  CORRIDOR BOUND (E2, meta-verified 2026-08-07): the model region is clipped to a corridor
   *  around the stroke before subtracting — an edge-crossing stroke used to make the model snap
   *  to the WHOLE object and the subtract emptied the base ('No silhouette found', cut killed).
   *  An erase gesture is local by intent; the corridor keeps it local by construction. */
  async eraseStroke(stroke: Point[], brushN = 0.03): Promise<Mask> {
    if (!this.base) return { data: new Uint8Array(0), w: 0, h: 0 }
    const pts = thinStroke(stroke).map((p) => ({ ...p, label: 1 as const }))
    let region = await this.segment(pts, false)
    clipToCorridor(region, pts)
    // SWATH FALLBACK (meta R9-1): positive-label prompts on a stroke ENTERING from background
    // make the model segment the BACKGROUND — background ∩ base = ∅ and the carve-inward gesture
    // erased nothing. If the model region barely touches the base, erase what is literally under
    // the brush instead: the stroke swath ∩ base. Erase always carves what you brushed.
    let overlap = 0
    for (let i = 0; i < region.data.length; i++) if (region.data[i] && this.base.data[i]) overlap++
    if (overlap < 16) region = strokeSwath(region.w, region.h, pts, brushN)
    this.base.soft = subtractSoft(this.base, region)
    subtract(this.base.data, region.data)
    return this.base
  }
}

/** Rasterize the stroke polyline as a swath mask (radius = brushN × width, floor 6px). */
function strokeSwath(w: number, h: number, pts: Point[], brushN: number): Mask {
  const data = new Uint8Array(w * h)
  const r = Math.max(6, Math.round(brushN * w))
  const P = pts.map((p) => ({ x: p.x * w, y: p.y * h }))
  const r2 = r * r
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of P) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  const bx0 = Math.max(0, Math.floor(x0 - r)), by0 = Math.max(0, Math.floor(y0 - r))
  const bx1 = Math.min(w - 1, Math.ceil(x1 + r)), by1 = Math.min(h - 1, Math.ceil(y1 + r))
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[Math.min(i + 1, P.length - 1)]
      const dx = b.x - a.x, dy = b.y - a.y
      const L2 = dx * dx + dy * dy
      const t = L2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2)) : 0
      const px = a.x + t * dx - x, py = a.y + t * dy - y
      if (px * px + py * py <= r2) { data[y * w + x] = 1; break }
    }
  }
  return { data, w, h }
}

/** Zero every region pixel farther than ~12% of the long side from the stroke polyline
 *  (normalized points → mask space). Bbox-limited; ≤32 thinned points keeps it cheap. */
function clipToCorridor(region: Mask, pts: Point[]): void {
  const { w, h, data } = region
  if (!pts.length) return
  const r = Math.max(24, Math.round(Math.max(w, h) * 0.12))
  const P = pts.map((p) => ({ x: p.x * w, y: p.y * h }))
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of P) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  const bx0 = Math.max(0, Math.floor(x0 - r)), by0 = Math.max(0, Math.floor(y0 - r))
  const bx1 = Math.min(w - 1, Math.ceil(x1 + r)), by1 = Math.min(h - 1, Math.ceil(y1 + r))
  const r2 = r * r
  const distOk = (x: number, y: number): boolean => {
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[Math.min(i + 1, P.length - 1)]
      const dx = b.x - a.x, dy = b.y - a.y
      const L2 = dx * dx + dy * dy
      const t = L2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2)) : 0
      const px = a.x + t * dx - x, py = a.y + t * dy - y
      if (px * px + py * py <= r2) return true
    }
    return false
  }
  for (let y = 0; y < h; y++) {
    const inY = y >= by0 && y <= by1
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (!data[p]) continue
      if (!inY || x < bx0 || x > bx1 || !distOk(x, y)) {
        data[p] = 0
        if (region.soft) region.soft[p] = 0
      }
    }
  }
}
