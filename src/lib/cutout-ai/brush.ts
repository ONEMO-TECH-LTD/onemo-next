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

/** Thin a dense stroke trail to at most `max` prompt points (SAM degrades on huge point sets). */
export const thinStroke = (pts: Point[], max = 32): Point[] =>
  pts.length <= max ? pts : pts.filter((_, i) => i % Math.ceil(pts.length / max) === 0)

export class BrushSession {
  private base: Mask | null = null
  constructor(private segment: SegmentFn) {}

  /** Current accepted mask (a live reference — copy before mutating outside). */
  get mask(): Mask | null { return this.base }

  reset(): void { this.base = null }

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
    union(this.base.data, region.data)
    return this.base
  }

  /** Erase-stroke: model-snap the region under the stroke, subtract from the base. */
  async eraseStroke(stroke: Point[]): Promise<Mask> {
    if (!this.base) return { data: new Uint8Array(0), w: 0, h: 0 }
    const pts = thinStroke(stroke).map((p) => ({ ...p, label: 1 as const }))
    const region = await this.segment(pts, false)
    subtract(this.base.data, region.data)
    return this.base
  }
}
