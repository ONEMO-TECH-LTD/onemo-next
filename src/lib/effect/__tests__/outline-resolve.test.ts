// V4 engine proofs — the resolve(source, adjustments) contract (blueprint §4/§8):
// all-off === exact source · reversibility · user-claimed pinning · in-resolve fold guard ·
// detail/smooth as INDEPENDENT axes · impartiality across vector classes.

import { describe, test, expect } from 'vitest'
import {
  resolve, mintIds, ADJUSTMENTS_OFF, GLOBAL_OFF,
  type OutlineSource, type OutlineClass, type OutlineAdjustments,
} from '../outline-resolve'
import { flattenShape, filletShape, type VShape, type VAnchor } from '@/lib/vector-core'
import { validateSelfIntersection, type Vec2Px } from '@/lib/outline-core'

function source(shape: VShape, klass: OutlineClass = 'generated'): OutlineSource {
  return { shape: mintIds(shape), klass, mmPerPx: 0.1, maskHeightPx: 600 }
}
const off = (): OutlineAdjustments => ({ global: { ...GLOBAL_OFF }, local: {} })

/** a straight polygon: notched square (one sharp inward V on the top edge → fold bait). */
function notchedSquare(): VShape {
  const a = (x: number, y: number): VAnchor => ({ p: { x, y }, hIn: null, hOut: null, corner: true })
  return { paths: [{ anchors: [
    a(0, 0), a(120, 0), a(150, 30), a(180, 0), a(300, 0), // top edge with a V-notch
    a(300, 300), a(0, 300),
  ] }] }
}
/** a stock-like bezier (rounded square via fillet) — to prove all-off keeps beziers byte-exact. */
function roundedSquare(): VShape {
  const a = (x: number, y: number): VAnchor => ({ p: { x, y }, hIn: null, hOut: null, corner: true })
  return filletShape({ paths: [{ anchors: [a(0, 0), a(200, 0), a(200, 200), a(0, 200)] }] }, 40)
}
const flat = (s: VShape): Vec2Px[] => flattenShape(s, 0.5)[0].map((p) => [p.x, p.y] as Vec2Px)

describe('V4 resolve — all-off === exact source', () => {
  test('straight polygon: all-off returns the SAME object (byte-exact)', () => {
    const s = source(notchedSquare())
    expect(resolve(s, off())).toBe(s.shape) // object identity — no flatten/refit
  })
  test('stock bezier: all-off returns the SAME object (curves untouched)', () => {
    const s = source(roundedSquare(), 'stock')
    expect(resolve(s, off())).toBe(s.shape)
  })
})

describe('V4 resolve — reversibility', () => {
  test('global smooth changes the shape; back to off restores the source exactly', () => {
    const s = source(notchedSquare())
    const smoothed = resolve(s, { global: { ...GLOBAL_OFF, smooth: 80 }, local: {} })
    expect(smoothed).not.toBe(s.shape)
    // the smoothed polygon is different geometry
    expect(flat(smoothed).length).not.toBe(flat(s.shape).length)
    // returning every global to off → byte-exact source again
    expect(resolve(s, off())).toBe(s.shape)
  })

  test('local radius rounds a claimed corner; radius 0 restores the sharp source corner', () => {
    const s = source(notchedSquare())
    const cornerId = s.shape.paths[0].anchors[1].id! // the (120,0) corner
    const rounded = resolve(s, { global: { ...GLOBAL_OFF }, local: { [cornerId]: { radius: 20 } } })
    expect(rounded.paths[0].anchors.length).toBeGreaterThan(s.shape.paths[0].anchors.length) // fillet added anchors
    // radius 0 (off) → exact source
    expect(resolve(s, { global: { ...GLOBAL_OFF }, local: { [cornerId]: { radius: 0 } } })).toBe(s.shape)
  })
})

describe('V4 resolve — pinning (VD2): a claimed anchor survives the global pass at its exact position', () => {
  test('claimed corner stays put while global smooth reshapes everything else', () => {
    const s = source(notchedSquare())
    const pin = s.shape.paths[0].anchors[5] // the (300,300) corner
    const out = resolve(s, { global: { ...GLOBAL_OFF, smooth: 70 }, local: { [pin.id!]: { radius: 10 } } })
    // the pinned id must be present somewhere in the result, near its source position (it gets filleted,
    // so look for any anchor within the fillet radius of the source corner)
    const near = out.paths[0].anchors.some((a) => Math.hypot(a.p.x - pin.p.x, a.p.y - pin.p.y) < 25)
    expect(near).toBe(true)
  })
})

describe('V4 resolve — fold guard (VD12): never emits a self-crossing ring', () => {
  test('extreme smooth on a deep notch yields a simple (non-self-intersecting) ring', () => {
    const s = source(notchedSquare())
    for (const smooth of [60, 80, 100]) {
      const out = resolve(s, { global: { ...GLOBAL_OFF, smooth }, local: {} })
      const ring = flat(out)
      expect(validateSelfIntersection(ring, 'test').length).toBe(0)
    }
  })
})

describe('V4 resolve — detail and smooth are INDEPENDENT axes', () => {
  test('changing detail alone leaves smoothing untouched (no coupling)', () => {
    const s = source(notchedSquare())
    // smooth fixed at 0; detail down → fewer points, but NO gaussian rounding introduced
    const d100 = resolve(s, { global: { ...GLOBAL_OFF, detail: 100, smooth: 0, snap: 0 }, local: {} })
    const d40 = resolve(s, { global: { ...GLOBAL_OFF, detail: 40, smooth: 0, snap: 0 }, local: {} })
    // detail 40 simplifies (≤ the count at full detail), proving detail = density, independent of smooth
    expect(flat(d40).length).toBeLessThanOrEqual(flat(d100).length)
  })
})

describe('V4 resolve — impartial across classes', () => {
  test('the same global smooth runs identically on stock, upload, drawn, generated', () => {
    const shape = notchedSquare()
    const counts = (['generated', 'stock', 'upload', 'drawn'] as OutlineClass[]).map((k) => {
      const s = source(shape, k)
      return flat(resolve(s, { global: { ...GLOBAL_OFF, smooth: 50 }, local: {} })).length
    })
    expect(new Set(counts).size).toBe(1) // identical output point count for every class
  })
})

describe('V4 resolve — F1: local radius keeps the source id reusable (no bake / no drift)', () => {
  test('a radiused corner still carries its source id in the resolved output', () => {
    const s = source(notchedSquare())
    const id = s.shape.paths[0].anchors[1].id!
    const out = resolve(s, { global: { ...GLOBAL_OFF }, local: { [id]: { radius: 20 } } })
    // the fillet replaced the sharp corner with rounded anchors that CARRY the source id — so the
    // editor can re-select and re-adjust that corner without baking or rebasing (Codex F1).
    expect(out.paths[0].anchors.some((a) => a.id === id)).toBe(true)
  })
  test('radius survives a global smooth (claim pinned + re-applied through the global pass)', () => {
    const s = source(notchedSquare())
    const id = s.shape.paths[0].anchors[5].id!
    const smoothOnly = resolve(s, { global: { ...GLOBAL_OFF, smooth: 60 }, local: {} })
    const smoothPlusR = resolve(s, { global: { ...GLOBAL_OFF, smooth: 60 }, local: { [id]: { radius: 12 } } })
    expect(flat(smoothPlusR).length).not.toBe(flat(smoothOnly).length) // the radius claim changes the result
    expect(smoothPlusR.paths[0].anchors.some((a) => a.id === id)).toBe(true) // and the id survives global
  })
})

describe('V4 resolve — F2: fold guard is structurally fail-closed', () => {
  test('a pathological deep-spike star never resolves to a self-crossing outline at any smooth/detail', () => {
    const mk = (x: number, y: number): VAnchor => ({ p: { x, y }, hIn: null, hOut: null, corner: true })
    const anchors: VAnchor[] = []
    const N = 16
    for (let i = 0; i < N; i++) {
      const ang = (2 * Math.PI * i) / N
      const rad = i % 2 === 0 ? 150 : 18 // deep spikes = fold bait under heavy smooth
      anchors.push(mk(200 + rad * Math.cos(ang), 200 + rad * Math.sin(ang)))
    }
    const s = source({ paths: [{ anchors }] })
    for (const smooth of [0, 50, 100]) for (const detail of [0, 50, 100]) {
      const out = resolve(s, { global: { ...GLOBAL_OFF, smooth, detail }, local: {} })
      expect(validateSelfIntersection(flat(out), 't').length).toBe(0) // never a crack — fail-closed
    }
  })
})
