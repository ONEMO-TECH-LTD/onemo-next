// svg-import proofs (Run 8) — upload round-trip fidelity + loud rejection of everything outside
// the v1 dialect boundary (single plain outline; no layers, no transforms, no exotic commands).

import { describe, test, expect } from 'vitest'
import { toManufacturingSVG, vshapeFromSVG, fitShapeToBox, normalizeWinding } from '../index'
import { getShape } from '@/lib/shape-library'
import { segments, cubicPoint, shapeBBox, transformShape } from '@/lib/vector-core'

describe('export — SVG shape import', () => {
  test('round-trip: our own exported heart re-imports with identical geometry', () => {
    const heart = getShape('heart', 1200, 900)
    const svg = toManufacturingSVG(heart, { mmPerPx: 0.1, widthPx: 1200, heightPx: 900 })
    const back = vshapeFromSVG(svg)
    expect(back.paths).toHaveLength(1)
    // compare against the normalized mm original by sampling every segment
    const orig = normalizeWinding(transformShape(heart, (p) => ({ x: p.x * 0.1, y: p.y * 0.1 }))).paths[0]
    const so = segments(orig), sb = segments(back.paths[0])
    expect(sb).toHaveLength(so.length)
    let maxErr = 0
    for (let i = 0; i < so.length; i++) {
      for (let t = 0; t <= 10; t++) {
        const a = so[i], b = sb[i]
        const pa = a.c1 && a.c2 ? cubicPoint(a.a, a.c1, a.c2, a.b, t / 10) : { x: a.a.x + (a.b.x - a.a.x) * (t / 10), y: a.a.y + (a.b.y - a.a.y) * (t / 10) }
        const pb = b.c1 && b.c2 ? cubicPoint(b.a, b.c1, b.c2, b.b, t / 10) : { x: b.a.x + (b.b.x - b.a.x) * (t / 10), y: b.a.y + (b.b.y - b.a.y) * (t / 10) }
        maxErr = Math.max(maxErr, Math.hypot(pa.x - pb.x, pa.y - pb.y))
      }
    }
    expect(maxErr).toBeLessThan(0.001) // serialization precision only — true import, no re-fit
  })

  test('fitShapeToBox: uploaded outline lands centered at 72% of the short side', () => {
    const heart = getShape('heart', 1200, 900)
    const svg = toManufacturingSVG(heart, { mmPerPx: 0.1, widthPx: 1200, heightPx: 900 })
    const fitted = fitShapeToBox(vshapeFromSVG(svg), 1200, 900)
    const bb = shapeBBox(fitted, 0.01)
    expect((bb.minX + bb.maxX) / 2).toBeCloseTo(600, 4)
    expect((bb.minY + bb.maxY) / 2).toBeCloseTo(450, 4)
    expect(Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY)).toBeCloseTo(900 * 0.72, 3)
  })

  test('rejects LOUDLY: multiple paths (layers)', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 L 10 0 L 10 10 Z"/><path d="M 20 20 L 30 20 L 30 30 Z"/></svg>'
    expect(() => vshapeFromSVG(svg)).toThrow(/single outline/)
  })

  test('rejects LOUDLY: transforms, exotic commands, holes, non-SVG, empty', () => {
    expect(() => vshapeFromSVG('<svg><g transform="rotate(45)"><path d="M 0 0 L 10 0 L 10 10 Z"/></g></svg>')).toThrow(/Transformed/)
    expect(() => vshapeFromSVG('<svg><path d="M 0 0 A 5 5 0 0 1 10 10 Z"/></svg>')).toThrow(/can't import yet/)
    expect(() => vshapeFromSVG('<svg><path d="M 0 0 L 10 0 L 10 10 Z M 2 2 L 4 2 L 4 4 Z"/></svg>')).toThrow(/single outline/)
    expect(() => vshapeFromSVG('just some text')).toThrow(/not an SVG/)
    expect(() => vshapeFromSVG('<svg></svg>')).toThrow(/needs one path/)
  })
})
