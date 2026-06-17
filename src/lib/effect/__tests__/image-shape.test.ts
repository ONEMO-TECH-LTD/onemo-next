// image-shape proofs (Run 10) — mask derivation by every route + the full pure chain into a
// fitted vector path (mask → traceContourRaw → ringToVPath), no browser required.

import { describe, test, expect } from 'vitest'
import { maskFromImageData } from '../image-shape'
import { traceContourRaw } from '../contour'
import { ringToVPath, flattenPath, signedArea } from '@/lib/vector-core'

/** Synthetic image: `paint(x,y)` returns [r,g,b,a] per pixel. */
function makeImage(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = paint(x, y)
    const i = (y * w + x) * 4
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a
  }
  return { data, width: w, height: h }
}
const inSquare = (x: number, y: number) => x >= 15 && x < 45 && y >= 15 && y < 45

describe('effect — image-shape mask derivation', () => {
  test('alpha route: transparency defines the shape', () => {
    const img = makeImage(60, 60, (x, y) => (inSquare(x, y) ? [200, 30, 30, 255] : [0, 0, 0, 0]))
    const { mask } = maskFromImageData(img)
    expect(mask[30 * 60 + 30]).toBe(1)
    expect(mask[5 * 60 + 5]).toBe(0)
    expect(mask.reduce((s, v) => s + v, 0)).toBe(30 * 30)
  })

  test('Otsu route: dark logo on light paper', () => {
    const img = makeImage(60, 60, (x, y) => (inSquare(x, y) ? [20, 20, 20, 255] : [240, 240, 240, 255]))
    const { mask } = maskFromImageData(img)
    expect(mask[30 * 60 + 30]).toBe(1)
    expect(mask[5 * 60 + 5]).toBe(0)
  })

  test('Otsu route inverted: LIGHT logo on dark background (border rule picks the shape side)', () => {
    const img = makeImage(60, 60, (x, y) => (inSquare(x, y) ? [245, 245, 245, 255] : [15, 15, 15, 255]))
    const { mask } = maskFromImageData(img)
    expect(mask[30 * 60 + 30]).toBe(1) // the light square IS the shape
    expect(mask[5 * 60 + 5]).toBe(0) // the dark border side is background
  })

  test('full pure chain: image → mask → trace → fitted vector path with sane geometry', () => {
    const img = makeImage(60, 60, (x, y) => (inSquare(x, y) ? [20, 20, 20, 255] : [240, 240, 240, 255]))
    const { mask, width, height } = maskFromImageData(img)
    const ring = traceContourRaw(mask, width, height)
    expect(ring).not.toBeNull()
    const path = ringToVPath(ring!.map(([x, y]) => ({ x, y })), 30, 0.35)
    expect(path.anchors.length).toBeGreaterThanOrEqual(4)
    expect(path.anchors.length).toBeLessThan(20) // minimal anchors, not a point cloud
    const flat = flattenPath(path, 0.1)
    expect(Math.abs(signedArea(flat))).toBeGreaterThan(28 * 28) // ~the square's area survives
    expect(Math.abs(signedArea(flat))).toBeLessThan(32 * 32)
  })
})
