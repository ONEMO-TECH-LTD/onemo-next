// KAI-8982 D1 — Dan's 06-07 landing ruling, two-pass model: pass 1 = raw sharp truth; pass 2 =
// internal post-processing where ~90° corners ON the image frame edge (crop artifacts) get the
// SAME default radius automatically, while interior sharp corners (design intent) stay TRUE
// corner anchors. The sharp fit stays derivable by omitting the opts (Radius→0 = sharp).
import { describe, it, expect } from 'vitest'
import { vectoriseTrace } from './geometry-truth.legacy' // R4: retired trace-fit, test-only
import { fairingFromDetail } from '@/lib/outline-core'
import type { Pt } from '../types'

const FAIR = fairingFromDetail(60) // detail high enough that corners separate cleanly

/** half-disc, flat side ON the bottom frame edge (y-up y=0): two ~90° crop corners at the ends */
function halfDiscTouchingBottom(W = 512, H = 512): Pt[] {
  const out: Pt[] = []
  const cx = W / 2, r = 180
  for (let a = 0; a <= 180; a += 1.2) {
    const th = (a * Math.PI) / 180
    out.push([cx + r * Math.cos(th), 0 + r * Math.sin(th)])
  }
  // flat run back along the frame edge
  for (let x = cx - r; x <= cx + r; x += 4) out.push([x, 0])
  return out
}

/** boxy subject floating mid-frame: four interior ~90° corners, NOT on any frame edge */
function interiorBox(W = 512, H = 512): Pt[] {
  const out: Pt[] = []
  const x0 = 140, x1 = 380, y0 = 140, y1 = 360
  for (let x = x0; x <= x1; x += 4) out.push([x, y0])
  for (let y = y0; y <= y1; y += 4) out.push([x1, y])
  for (let x = x1; x >= x0; x -= 4) out.push([x, y1])
  for (let y = y1; y >= y0; y -= 4) out.push([x0, y])
  return out
}

const corners = (v: NonNullable<ReturnType<typeof vectoriseTrace>>) => v.paths[0].anchors.filter((a) => a.corner).length

describe('crop-corner default (KAI-8982 D1) [via legacy/R4 vectoriseTrace fixture — KAI-9084]', () => {
  it('SHARP fit (no opts): the half-disc keeps its two frame corners as TRUE anchors', () => {
    const v = vectoriseTrace(halfDiscTouchingBottom(), 512, FAIR)!
    expect(corners(v)).toBe(2)
  })

  it('pass-2 default: the SAME two crop corners are auto-rounded (no corner anchors remain)', () => {
    const v = vectoriseTrace(halfDiscTouchingBottom(), 512, FAIR, { defaultCornerRadiusPx: 14, maskWidthPx: 512 })!
    expect(corners(v)).toBe(0) // both crop corners became uniform arcs
    expect(v.paths[0].anchors.length).toBeGreaterThan(4) // fillet arcs added anchors — rounded, not collapsed
  })

  it('interior sharp corners are design intent — the default does NOT touch them', () => {
    const v = vectoriseTrace(interiorBox(), 512, FAIR, { defaultCornerRadiusPx: 14, maskWidthPx: 512 })!
    expect(corners(v)).toBe(4) // the floating box keeps all four true corners
  })
})
