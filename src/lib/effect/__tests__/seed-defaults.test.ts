// seed-defaults.test.ts — sharp-wired seeding + auto-tune + value-reflection (DEC-v5-03 T5/T6/T7).
import { describe, it, expect } from 'vitest'
import { cornerRadiusAdjustments, autoTuneDefaults, representativeLocal, AUTO_TUNE } from '@/app/(dev)/effect-creator/v3/user/editor/seed-defaults'
import { resolve, mintIds, type OutlineSource } from '@/lib/effect/outline-resolve'
import type { VShape } from '@/lib/vector-core'

const sharpSquare = (): VShape => mintIds({ paths: [{ anchors: [
  { p: { x: 0, y: 0 }, hIn: null, hOut: null, corner: true },
  { p: { x: 400, y: 0 }, hIn: null, hOut: null, corner: true },
  { p: { x: 400, y: 400 }, hIn: null, hOut: null, corner: true },
  { p: { x: 0, y: 400 }, hIn: null, hOut: null, corner: true },
] }] })
const src = (shape: VShape, klass: OutlineSource['klass'] = 'stock'): OutlineSource =>
  ({ shape, klass, mmPerPx: 0.1, maskHeightPx: 1000 })

describe('T5 — sharp-wired stock seeding (rounding as a reversible adjustment, not baked)', () => {
  it('the source stays SHARP; rounding is a Radius adjustment that resolve applies + reverses', () => {
    const shape = sharpSquare()
    const adj = cornerRadiusAdjustments(shape, 40)
    // source is sharp: every anchor is a true corner
    expect(shape.paths[0].anchors.every((a) => a.corner)).toBe(true)
    // resolved (with the adjustment) is rounded — different geometry, corners now curved
    const rounded = resolve(src(shape), adj)
    expect(rounded).not.toBe(shape)
    expect(rounded.paths[0].anchors.length).toBeGreaterThan(4) // fillet split each corner into arc ends
    // OFF → exact source (reversible)
    expect(resolve(src(shape), { global: adj.global, local: {} })).toBe(shape)
  })
})

describe('T7 — value-reflection (the slider reads the geometry, never a lying 0)', () => {
  it('a sharp source with no rounding reads 0; a rounded stock source reads its real radius', () => {
    const shape = sharpSquare()
    expect(representativeLocal({ global: autoTuneDefaults().global, local: {} }, shape, 'radius')).toBe(0)
    expect(representativeLocal(cornerRadiusAdjustments(shape, 40), shape, 'radius')).toBe(40)
  })
})

describe('T6 — auto-tune defaults (organic by default, reversible)', () => {
  it('exposes the proposed starting values as a tunable constant on the global axes', () => {
    const d = autoTuneDefaults()
    expect(d.global.detail).toBe(AUTO_TUNE.detail)
    expect(d.global.straighten).toBe(AUTO_TUNE.straighten)
    expect(d.global.smooth).toBe(AUTO_TUNE.smooth)
    expect(d.local).toEqual({}) // rounding is delivered by global smooth, not per-corner radius
  })
})
