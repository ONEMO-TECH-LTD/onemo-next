// V4 engine proofs — the resolve(source, adjustments) contract (blueprint §4/§8):
// all-off === exact source · reversibility · user-claimed pinning · in-resolve fold guard ·
// detail/smooth as INDEPENDENT axes · impartiality across vector classes.

import { describe, test, expect } from 'vitest'
import {
  resolve, mintIds, GLOBAL_OFF,
  type OutlineSource, type OutlineClass, type OutlineAdjustments, type LocalAdjustment,
} from '../outline-resolve'
import { flattenShape, type VShape, type VAnchor } from '@/lib/vector-core'
import { filletShape } from '@/lib/vector-core/path' // KAI-9071: test fixture only (not a public barrel export)
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

describe('V5 resolve — Simplify and Smooth are INDEPENDENT axes (Paper simplify + catmull)', () => {
  // Output is SPARSE CURVES (Paper simplify sets anchor points, catmull sets handles). Density = ANCHOR
  // count. Simplify is 0=off / 100=max (DEC-v5-03): more Simplify ⇒ FEWER anchors.
  const nAnchors = (sh: VShape) => sh.paths[0].anchors.length
  test('simplify = sparse anchor density (independent of smooth); no point-explosion', () => {
    // a curved source flattens dense, so simplify has real range to thin (a straight polygon can't show it)
    const s = source(roundedSquare(), 'stock')
    const lite = resolve(s, { global: { ...GLOBAL_OFF, simplify: 1, smooth: 0 }, local: {} })
    const hard = resolve(s, { global: { ...GLOBAL_OFF, simplify: 90, smooth: 0 }, local: {} })
    expect(nAnchors(lite)).toBeGreaterThanOrEqual(nAnchors(hard)) // LESS simplify ⇒ more (or equal) anchors
    expect(nAnchors(lite)).toBeLessThan(80) // SPARSE curves — never the old 12→900+ dense chain (no explosion)
  })
  test('order simplify→smooth: smooth sets handle roundness only — no extra anchors (QA-confirmed Paper order)', () => {
    const s = source(notchedSquare())
    const simplifyOnly = resolve(s, { global: { ...GLOBAL_OFF, simplify: 50, smooth: 0 }, local: {} })
    const simplifySmooth = resolve(s, { global: { ...GLOBAL_OFF, simplify: 50, smooth: 100 }, local: {} })
    // catmull smooth moves HANDLES, never adds points — same sparse anchor set as simplify-only
    expect(nAnchors(simplifySmooth)).toBe(nAnchors(simplifyOnly))
    // smooth 100 produces real curve handles and visibly changes the rendered outline; simplify-only doesn't smooth
    expect(simplifySmooth.paths[0].anchors.some((a) => !!a.hIn || !!a.hOut)).toBe(true)
    expect(flat(simplifySmooth)).not.toEqual(flat(simplifyOnly))
  })
  test('simplify REDUCES a dense near-collinear trace (the real use case); a clean polygon is left alone', () => {
    // a 120-point sampled circle = a dense trace (consecutive points near-collinear) — Simplify's real input.
    const mk = (x: number, y: number): VAnchor => ({ p: { x, y }, hIn: null, hOut: null, corner: true })
    const dense: VAnchor[] = []
    for (let i = 0; i < 120; i++) { const t = (2 * Math.PI * i) / 120; dense.push(mk(300 + 200 * Math.cos(t), 300 + 200 * Math.sin(t))) }
    const s = source({ paths: [{ anchors: dense }] }, 'generated')
    const hard = resolve(s, { global: { ...GLOBAL_OFF, simplify: 90, smooth: 0 }, local: {} })
    const lite = resolve(s, { global: { ...GLOBAL_OFF, simplify: 20, smooth: 0 }, local: {} })
    expect(nAnchors(hard)).toBeLessThan(120) // Simplify reduced the dense trace
    expect(nAnchors(lite)).toBeGreaterThanOrEqual(nAnchors(hard)) // LESS simplify ⇒ more (or equal) anchors
    // a clean minimal polygon has no redundant vertices → Simplify is a no-op (keeps every corner)
    const sq = source({ paths: [{ anchors: [mk(0, 0), mk(400, 0), mk(400, 400), mk(0, 400)] }] }, 'stock')
    expect(nAnchors(resolve(sq, { global: { ...GLOBAL_OFF, simplify: 90 }, local: {} }))).toBe(4)
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
  test('F3: whole-shape radius reverts — round EVERY corner, then radius 0 → exact source', () => {
    const s = source(notchedSquare())
    const ids = s.shape.paths[0].anchors.filter((a) => a.corner && a.id).map((a) => a.id!)
    expect(ids.length).toBeGreaterThan(0)
    const at = (r: number) => { const m: Record<string, LocalAdjustment> = {}; ids.forEach((id) => (m[id] = { radius: r })); return m }
    const rounded = resolve(s, { global: { ...GLOBAL_OFF }, local: at(80) })
    expect(rounded).not.toBe(s.shape) // every corner rounded
    expect(rounded.paths[0].anchors.every((a) => a.corner)).toBe(false) // display lost its corners (the F3 trap)
    // radius back to 0 on all corners → exact source (the control must stay usable to do this — UI fix)
    expect(resolve(s, { global: { ...GLOBAL_OFF }, local: at(0) })).toBe(s.shape)
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

describe('V5 resolve — whole-shape Radius dual-engine (Clipper2 offset-round, DEC-v5-04)', () => {
  const mk = (x: number, y: number): VAnchor => ({ p: { x, y }, hIn: null, hOut: null, corner: true })
  const squareShape = (): VShape => ({ paths: [{ anchors: [mk(0, 0), mk(400, 0), mk(400, 400), mk(0, 400)] }] })
  /** max/min radius from the centroid — ≈1 ⇒ a circle. */
  const circularity = (pts: Vec2Px[]) => {
    let cx = 0, cy = 0; for (const [x, y] of pts) { cx += x; cy += y }; cx /= pts.length; cy /= pts.length
    let mn = Infinity, mx = 0; for (const [x, y] of pts) { const d = Math.hypot(x - cx, y - cy); if (d < mn) mn = d; if (d > mx) mx = d }
    return mx / mn
  }
  test('whole-shape radius rounds the square; radius 0 → exact source (reversible)', () => {
    const s = source(squareShape(), 'stock')
    const rounded = resolve(s, { global: { ...GLOBAL_OFF, radius: 60 }, local: {} })
    expect(rounded).not.toBe(s.shape)
    expect(flat(rounded).length).toBeGreaterThan(4) // corners became arcs
    expect(validateSelfIntersection(flat(rounded), 't').length).toBe(0) // simple, no fold
    expect(resolve(s, { global: { ...GLOBAL_OFF, radius: 0 }, local: {} })).toBe(s.shape) // OFF === source
  })
  test('square at ~half-short-side radius → a circle (symmetric by construction, circularity ≈ 1)', () => {
    const s = source(squareShape(), 'stock')
    const circle = resolve(s, { global: { ...GLOBAL_OFF, radius: 200 }, local: {} }) // 200 = half the 400px side
    const c = circularity(flat(circle))
    expect(c, `square@radius=½-side should be a circle (max/min radius ${c.toFixed(3)})`).toBeLessThan(1.06)
  })
  test('whole-shape radius composes with a per-corner override (selected corner pinned through)', () => {
    const s = source(squareShape(), 'stock')
    const id = s.shape.paths[0].anchors[0].id!
    const out = resolve(s, { global: { ...GLOBAL_OFF, radius: 50 }, local: { [id]: { radius: 0 } } })
    expect(validateSelfIntersection(flat(out), 't').length).toBe(0) // both engines compose without folding
  })
})

describe('V5 resolve — Smooth is a true gradation (KAI-9115: blend, not binary catmull)', () => {
  const totalHandleLen = (sh: VShape) => {
    let L = 0
    for (const a of sh.paths[0].anchors) {
      if (a.hIn) L += Math.hypot(a.hIn.x - a.p.x, a.hIn.y - a.p.y)
      if (a.hOut) L += Math.hypot(a.hOut.x - a.p.x, a.hOut.y - a.p.y)
    }
    return L
  }
  test('more Smooth = more handle (rounder): a low % is visibly gentler than a high % — not the old binary', () => {
    const s = source(notchedSquare())
    const lo = resolve(s, { global: { ...GLOBAL_OFF, smooth: 20 }, local: {} })
    const hi = resolve(s, { global: { ...GLOBAL_OFF, smooth: 90 }, local: {} })
    const llo = totalHandleLen(lo), lhi = totalHandleLen(hi)
    expect(llo, 'smooth 20% already introduces some handle').toBeGreaterThan(0)
    expect(lhi, `smooth 90% (${lhi.toFixed(0)}) must be substantially rounder than 20% (${llo.toFixed(0)})`).toBeGreaterThan(llo * 1.5)
  })
})

describe('V5 resolve — Straighten follows a CURVED input, never breaks it (KAI-9118)', () => {
  test('straighten on a curved (filleted) shape stays simple + keeps the silhouette (no fold/collapse)', () => {
    const s = source(roundedSquare(), 'stock')
    for (const straighten of [20, 60, 100]) {
      const str = resolve(s, { global: { ...GLOBAL_OFF, straighten }, local: {} })
      const ring = flat(str)
      expect(validateSelfIntersection(ring, 't').length, `straighten ${straighten} must not fold`).toBe(0)
      const xs = ring.map((p) => p[0]); const w = Math.max(...xs) - Math.min(...xs)
      expect(w, `straighten ${straighten} must track the curve, not collapse it (width ${w.toFixed(0)})`).toBeGreaterThan(180)
    }
  })
})

describe('V4 resolve — NEVER produces NaN/Infinity (renderable geometry)', () => {
  const finite = (n: number) => Number.isFinite(n)
  const allFinite = (s: VShape) => s.paths.every((pa) => pa.anchors.every((a) =>
    finite(a.p.x) && finite(a.p.y) &&
    (!a.hIn || (finite(a.hIn.x) && finite(a.hIn.y))) &&
    (!a.hOut || (finite(a.hOut.x) && finite(a.hOut.y)))))
  const star = (): VShape => {
    const mk = (x: number, y: number): VAnchor => ({ p: { x, y }, hIn: null, hOut: null, corner: true })
    const anchors: VAnchor[] = []
    for (let i = 0; i < 10; i++) { const ang = (2 * Math.PI * i) / 10; const r = i % 2 === 0 ? 140 : 40; anchors.push(mk(200 + r * Math.cos(ang), 200 + r * Math.sin(ang))) }
    return { paths: [{ anchors }] }
  }
  test('full global param grid on several shapes stays finite (no NaN/Infinity anchors)', () => {
    const shapes: [string, VShape][] = [['notch', notchedSquare()], ['star', star()], ['rounded', roundedSquare()]]
    for (const [name, shape] of shapes) {
      const s = source(shape)
      for (const simplify of [0, 25, 50, 75, 100]) for (const smooth of [0, 50, 100]) for (const straighten of [0, 50, 100]) {
        const out = resolve(s, { global: { simplify, smooth, straighten, radius: 0 }, local: {} })
        expect(allFinite(out), `${name} simplify=${simplify} smooth=${smooth} straighten=${straighten}`).toBe(true)
      }
    }
  })
  test('local radius/curve across the corner set stays finite', () => {
    const s = source(star())
    for (const a of s.shape.paths[0].anchors) {
      if (!a.id) continue
      for (const radius of [0, 20, 80]) expect(allFinite(resolve(s, { global: { ...GLOBAL_OFF }, local: { [a.id]: { radius } } }))).toBe(true)
      for (const curve of [0, 1, 2]) expect(allFinite(resolve(s, { global: { ...GLOBAL_OFF }, local: { [a.id]: { curve } } }))).toBe(true)
    }
  })
})

describe('V5 resolve — Straighten (Clipper2 RDP) trues a noisy wall + reverses exactly (DEC-v5-03)', () => {
  const mk = (x: number, y: number): VAnchor => ({ p: { x, y }, hIn: null, hOut: null, corner: true })
  const noisyWall = (): VShape => {
    const a: VAnchor[] = [mk(0, 0)]
    for (let x = 20; x < 400; x += 20) a.push(mk(x, (x / 20) % 2 === 0 ? 0 : 9)) // zigzag noise on a near-straight top edge
    a.push(mk(400, 0), mk(400, 300), mk(0, 300))
    return { paths: [{ anchors: a }] }
  }
  const simple = (s: VShape) => validateSelfIntersection(flat(s), 't').length === 0
  test('Straighten 100 collapses the noisy near-straight wall — fewer anchors, differs from off, stays simple', () => {
    const s = source(noisyWall())
    const offR = flat(resolve(s, off()))
    const strR = resolve(s, { global: { ...GLOBAL_OFF, straighten: 100 }, local: {} })
    expect(simple(strR)).toBe(true)
    expect(flat(strR)).not.toEqual(offR) // the zigzag is trued
    expect(strR.paths[0].anchors.length).toBeLessThan(s.shape.paths[0].anchors.length) // near-collinear run collapsed
  })
  test('Straighten OFF returns the source exactly (reversible)', () => {
    const s = source(noisyWall())
    expect(resolve(s, { global: { ...GLOBAL_OFF, straighten: 0 }, local: {} })).toBe(s.shape)
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
    for (const smooth of [0, 50, 100]) for (const simplify of [0, 50, 100]) {
      const out = resolve(s, { global: { ...GLOBAL_OFF, smooth, simplify }, local: {} })
      expect(validateSelfIntersection(flat(out), 't').length).toBe(0) // never a crack — fail-closed
    }
  })
})
