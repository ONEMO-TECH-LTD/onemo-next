import { describe, it, expect } from 'vitest'
import { classifyBands } from '../grid-magnet'
import { safeSegments } from '../units/segment'
import { legalRegionBoxMM, legalUnionBoxMM } from '../units/classifier'
import { RELEASED_PADDING_MM } from '../grid-magnet-spec'
import type { Contour, Pt } from '../types'

// A SHAPE'S BAND MUST NOT CHANGE WHEN YOU FLIP IT (QA F2, 2026-08-30).
//
// The classifier's box came off the 2mm segmentation mesh and called itself exact. It is exact on
// a square only because the clearance field is linear along a straight edge. QA proved the general
// case false: a 7-point polygon read 239.18mm (no band) and its horizontal mirror 238.81mm (B5),
// with mirrored disagreement up to 5.97mm across 1,000 shapes. The ruler is now the Clipper2
// inward-offset region that seating and wrap already use.
//
// This drives classifyBands, NOT the primitive directly — an earlier version of this test called
// the primitive and stayed green when the classifier was pointed back at the mesh.

const ring = (pts: Pt[]): Contour => ({ outer: { pts }, holes: [] })

/** Deterministic radial polygon, normalised so its longest side is 1 — the engine's own stencil. */
const stencil = (n: number, seed: number): ((mm: number) => Contour) => {
  let z = seed >>> 0
  const rnd = () => ((z = (1664525 * z + 1013904223) >>> 0) / 4294967296)
  const raw: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = 0.55 + 0.45 * rnd()
    raw.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1])
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const unit = raw.map(([x, y]) => [x / span, y / span] as Pt)
  return (mm: number) => ring(unit.map(([x, y]) => [x * mm, y * mm] as Pt))
}
const mirrored = (s: (mm: number) => Contour) => (mm: number) =>
  ring(s(mm).outer.pts.map(([x, y]) => [-x, y] as Pt))
const turned = (s: (mm: number) => Contour) => (mm: number) =>
  ring(s(mm).outer.pts.map(([x, y]) => [-y, x] as Pt))

const table = (s: (mm: number) => Contour) =>
  classifyBands(s, { pitchMM: 48, paddingMM: RELEASED_PADDING_MM })
    .map((r) => `B${r.bandId}:${r.legalWidthMM.toFixed(3)}x${r.legalHeightMM.toFixed(3)}`)

describe('the classifier reads a transform-invariant ruler', () => {
  it('ARITHMETIC GOLDEN: the ruler subtracts only the radius, never arc tolerance', () => {
    const square = (mm: number): Contour => ring([[0, 0], [mm, 0], [mm, mm], [0, mm]])
    for (const [outline, legal] of [[144, 120], [193, 169], [195, 171], [197, 173]]) {
      const box = legalRegionBoxMM(square(outline), RELEASED_PADDING_MM)!
      expect(box.maxX - box.minX, `${outline}mm width`).toBeCloseTo(legal, 6)
      expect(box.maxY - box.minY, `${outline}mm height`).toBeCloseTo(legal, 6)
    }
  })
  it('MIRROR: the per-band table is identical for a shape and its mirror', () => {
    const bad: string[] = []
    for (let k = 0; k < 40; k++) {
      const s = stencil(5 + (k % 11), 20260830 + k * 7919)
      const a = table(s), b = table(mirrored(s))
      // a mirror swaps nothing about extent: width and height are unchanged
      if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`shape ${k}: ${a[3] ?? '-'} vs ${b[3] ?? '-'}`)
    }
    expect(bad, 'mirroring changed the classifier table').toEqual([])
  }, 120_000)

  it('QUARTER TURN: the table transposes exactly, never drifts', () => {
    const bad: string[] = []
    for (let k = 0; k < 25; k++) {
      const s = stencil(5 + (k % 11), 990000 + k * 104729)
      const a = classifyBands(s, { pitchMM: 48, paddingMM: RELEASED_PADDING_MM })
      const t = classifyBands(turned(s), { pitchMM: 48, paddingMM: RELEASED_PADDING_MM })
      if (a.length !== t.length) { bad.push(`shape ${k}: band count ${a.length} vs ${t.length}`); continue }
      for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i].legalWidthMM - t[i].legalHeightMM) > 1e-6
          || Math.abs(a[i].legalHeightMM - t[i].legalWidthMM) > 1e-6)
          bad.push(`shape ${k} B${a[i].bandId}: ${a[i].legalWidthMM.toFixed(3)}x${a[i].legalHeightMM.toFixed(3)}`
            + ` vs turned ${t[i].legalWidthMM.toFixed(3)}x${t[i].legalHeightMM.toFixed(3)}`)
      }
    }
    expect(bad, 'a quarter turn moved the legal box').toEqual([])
  }, 120_000)

  it('MUTATION GOLDEN: the 2mm mesh box genuinely has the defect that was reverted', () => {
    // Proves the two gates above are not vacuous: the old ruler really does disagree under mirror,
    // so pointing the classifier back at it would break them.
    let worst = 0
    for (let k = 0; k < 40; k++) {
      const s = stencil(5 + (k % 11), 20260830 + k * 7919)
      const a = legalUnionBoxMM(safeSegments(s(200), RELEASED_PADDING_MM, 'light'))
      const b = legalUnionBoxMM(safeSegments(mirrored(s)(200), RELEASED_PADDING_MM, 'light'))
      if (a && b) worst = Math.max(worst, Math.abs((a.maxX - a.minX) - (b.maxX - b.minX)))
    }
    expect(worst, 'the mesh box is mirror-invariant after all — then the revert was unnecessary')
      .toBeGreaterThan(0.5)
    // and the exact ruler is not merely different, it is invariant
    const s = stencil(7, 20260830)
    const p = legalRegionBoxMM(s(200), RELEASED_PADDING_MM)!
    const q = legalRegionBoxMM(mirrored(s)(200), RELEASED_PADDING_MM)!
    expect(q.maxX - q.minX).toBeCloseTo(p.maxX - p.minX, 6)
  }, 120_000)
})
