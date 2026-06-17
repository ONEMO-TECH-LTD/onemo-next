// tool-symmetry.test.ts — PERMANENT clean-shape symmetry gate (DEC-v5-03 / Phase 3 T8).
//
// The regression class the duck-only QA never caught: a 4-fold-symmetric input (a square) must stay
// 4-fold-symmetric under EVERY tool. The old fairPath flatten-and-refit wrapper dropped the seam corner
// and skewed clean shapes (4→3 anchors, 22–230px asymmetry). With the library-direct tools (DEC-v5-03)
// each op applies to the model's anchors, so symmetry is preserved. This gate fails loudly if any tool
// ever re-introduces uneven per-corner application on a clean shape.
import { describe, it, expect } from 'vitest'
import { resolve, GLOBAL_OFF, type OutlineSource, type GlobalAdjustments } from '../outline-resolve'
import { flattenShape } from '@/lib/vector-core'

const CX = 300, CY = 300 // centre of the 100..500 square
function squareSource(): OutlineSource {
  return { shape: { paths: [{ anchors: [
    { p: { x: 100, y: 100 }, hIn: null, hOut: null, corner: true, id: 'c0' },
    { p: { x: 500, y: 100 }, hIn: null, hOut: null, corner: true, id: 'c1' },
    { p: { x: 500, y: 500 }, hIn: null, hOut: null, corner: true, id: 'c2' },
    { p: { x: 100, y: 500 }, hIn: null, hOut: null, corner: true, id: 'c3' },
  ] }] }, klass: 'generated', mmPerPx: 0.1, maskHeightPx: 1000 } as OutlineSource
}
// max distance from each flattened point to the NEAREST point of the SAME ring rotated 90° about centre.
// ~0 ⇒ the result is 4-fold symmetric ⇒ the tool hit every corner equally.
function asymmetry(shape: { paths: { anchors: { p: { x: number; y: number } }[] }[] }): number {
  const pts = flattenShape(shape as never, 0.5)[0].map((p) => ({ x: p.x, y: p.y }))
  const rot = pts.map((p) => ({ x: CX - (p.y - CY), y: CY + (p.x - CX) })) // +90° about centre
  let maxd = 0
  for (const r of rot) {
    let nd = Infinity
    for (const p of pts) { const d = Math.hypot(p.x - r.x, p.y - r.y); if (d < nd) nd = d }
    if (nd > maxd) maxd = nd
  }
  return maxd
}
const G = (o: Partial<GlobalAdjustments>): GlobalAdjustments => ({ ...GLOBAL_OFF, ...o })
const localAll = (key: 'radius' | 'curve', v: number) => ({ c0: { [key]: v }, c1: { [key]: v }, c2: { [key]: v }, c3: { [key]: v } })

describe('TOOL SYMMETRY — every tool keeps a square 4-fold symmetric (≤3px = applied equally)', () => {
  const cases: [string, () => ReturnType<typeof resolve>][] = [
    ['Radius 60', () => resolve(squareSource(), { global: G({}), local: localAll('radius', 60) })],
    ['Curve 100', () => resolve(squareSource(), { global: G({}), local: localAll('curve', 1) })],
    ['Smooth 80', () => resolve(squareSource(), { global: G({ smooth: 80 }), local: {} })],
    ['Simplify 60', () => resolve(squareSource(), { global: G({ simplify: 60 }), local: {} })],
    ['Straighten 80', () => resolve(squareSource(), { global: G({ straighten: 80 }), local: {} })],
  ]
  for (const [name, run] of cases) {
    it(name, () => {
      const out = run()
      const a = asymmetry(out)
      expect(a, `${name} asymmetry ${a.toFixed(2)}px — a clean square must stay 4-fold symmetric`).toBeLessThan(3)
    })
  }
})
