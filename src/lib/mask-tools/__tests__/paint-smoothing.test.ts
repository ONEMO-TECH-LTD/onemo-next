import { describe, expect, it } from 'vitest'

import { grabCutBrushGeometry } from '@/lib/cutout-grabcut'
import { autoTunePaintStroke, erasePaintMask, paintSmoothingRadius, polishMask, shouldClosePaintStroke, subtractMasks } from '@/lib/mask-tools'
import type { Mask } from '@/lib/mask-tools/types'

function rectangle(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Mask {
  const data = new Uint8Array(w * h)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * w + x] = 1
  return { data, w, h }
}

function smoothingInfluenceBand(base: Mask, raw: Mask, radius: number): Uint8Array {
  const band = new Uint8Array(base.data.length)
  for (let index = 0; index < base.data.length; index++) {
    if (!base.data[index] || raw.data[index]) continue
    const x = index % base.w, y = Math.floor(index / base.w)
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const px = x + dx, py = y + dy
      if (px >= 0 && px < base.w && py >= 0 && py < base.h) band[py * base.w + px] = 1
    }
  }
  return band
}

function openStrokeMask(w: number, h: number, stroke: { x: number; y: number }[], brushPx: number): Mask {
  const data = new Uint8Array(w * h)
  const radius = brushPx / 2
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5, py = y + 0.5
    for (let index = 1; index < stroke.length; index++) {
      const a = stroke[index - 1], b = stroke[index]
      const dx = b.x - a.x, dy = b.y - a.y
      const length2 = dx * dx + dy * dy
      const t = length2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / length2)) : 0
      if (Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)) <= radius) {
        data[y * w + x] = 1
        break
      }
    }
  }
  return { data, w, h }
}

describe('Paint shape-relative smoothing', () => {
  it('derives the radius from occupied area and bounds', () => {
    const small = rectangle(24, 24, 6, 6, 18, 18)
    const large = rectangle(48, 48, 12, 12, 36, 36)

    expect(paintSmoothingRadius(small, 1)).toBe(6)
    expect(paintSmoothingRadius(large, 1)).toBe(12)
  })

  it('has no brush input and keeps zero smoothing exact', () => {
    const mask = rectangle(24, 24, 6, 6, 18, 18)
    const unchanged = polishMask(mask, 0)

    expect(unchanged).not.toBe(mask)
    expect(unchanged.data).not.toBe(mask.data)
    expect(unchanged.data).toEqual(mask.data)
  })
})

describe('Paint boundary-local erase', () => {
  it('keeps erase strokes open even when the gesture nearly returns', () => {
    const stroke = [
      { x: 4, y: 4 }, { x: 28, y: 4 }, { x: 28, y: 28 }, { x: 4, y: 28 }, { x: 6, y: 6 },
    ]
    expect(shouldClosePaintStroke(stroke, 0)).toBe(false)
    expect(shouldClosePaintStroke(stroke, 0.35)).toBe(true)
  })

  it('preserves binary and soft alpha outside the affected boundary band', () => {
    const base = rectangle(32, 32, 4, 4, 28, 28)
    base.soft = Uint8Array.from(base.data, (value) => value * 211)
    const negative = rectangle(32, 32, 24, 12, 32, 20)
    const raw = subtractMasks(base, negative)
    const radius = paintSmoothingRadius(raw, 0.2)
    const band = smoothingInfluenceBand(base, raw, radius)
    const polished = polishMask(raw, 0.2)
    const result = erasePaintMask(base, negative, 0.2)

    expect(result).not.toBeNull()
    expect(result!.data).not.toEqual(base.data)
    for (let index = 0; index < base.data.length; index++) {
      if (band[index]) {
        expect(result!.data[index]).toBe(polished.data[index])
      } else {
        expect(result!.data[index]).toBe(base.data[index])
        expect(result!.soft?.[index]).toBe(base.soft[index])
      }
    }
  })

  it('uses the existing full polished result inside the local band', () => {
    const base = rectangle(40, 40, 4, 4, 36, 36)
    const negative = rectangle(40, 40, 30, 15, 40, 25)
    const raw = subtractMasks(base, negative)
    const polished = polishMask(raw, 0.2)
    const result = erasePaintMask(base, negative, 0.2)

    expect(result).not.toBeNull()
    for (let y = 12; y < 28; y++) for (let x = 27; x < 40; x++) {
      const index = y * 40 + x
      expect(result!.data[index]).toBe(polished.data[index])
    }
  })

  it('rejects internal holes, splits, empty/destructive cuts, and no-op strokes', () => {
    const base = rectangle(24, 24, 2, 2, 22, 22)
    expect(erasePaintMask(base, rectangle(24, 24, 8, 8, 16, 16), 0.2)).toBeNull()
    expect(erasePaintMask(base, rectangle(24, 24, 0, 11, 24, 13), 0)).toBeNull()
    expect(erasePaintMask(base, rectangle(24, 24, 0, 0, 24, 24), 0)).toBeNull()
    expect(erasePaintMask(base, rectangle(24, 24, 0, 0, 1, 1), 0.2)).toBeNull()
  })

  it('rejects the open near-returning boundary gesture that would detach the enclosed lobe', () => {
    const base = rectangle(64, 64, 8, 8, 56, 56)
    // Exact normalized U/near-return path from the rejected real-route regression fixture.
    const stroke = [
      { x: 30.72, y: 28.16 }, { x: 48.64, y: 29.44 }, { x: 48.64, y: 44.8 },
      { x: 33.28, y: 44.8 }, { x: 32, y: 30.08 },
    ]
    expect(shouldClosePaintStroke(stroke, 0)).toBe(false)
    expect(shouldClosePaintStroke(stroke, 0.35)).toBe(true)
    const negative = openStrokeMask(base.w, base.h, autoTunePaintStroke(stroke, 1), 5)
    expect(erasePaintMask(base, negative, 0.2)).toBeNull()
  })

  it('keeps one ordinary boundary notch as a real one-component carve', () => {
    const base = rectangle(24, 24, 2, 2, 22, 22)
    const result = erasePaintMask(base, rectangle(24, 24, 18, 8, 24, 16), 0.2)
    expect(result).not.toBeNull()
    expect(result!.data[12 * 24 + 20]).toBe(0)
    expect(result!.data[12 * 24 + 8]).toBe(1)
  })
})

describe('Paint gesture Autotune', () => {
  const jitteredLine = Array.from({ length: 21 }, (_, index) => ({ x: index * 5, y: index % 2 ? 2 : -2 }))

  it('keeps zero exact and removes micro-jitter at full strength', () => {
    expect(autoTunePaintStroke(jitteredLine, 0)).toEqual(jitteredLine)
    expect(autoTunePaintStroke(jitteredLine, 1)).toEqual([jitteredLine[0], jitteredLine[jitteredLine.length - 1]])
  })

  it('preserves a deliberate curve while reducing its sampled nodes', () => {
    const curve = Array.from({ length: 41 }, (_, index) => {
      const angle = (Math.PI / 2) * index / 40
      return { x: 100 * Math.cos(angle), y: 100 * Math.sin(angle) + (index % 2 ? 1 : -1) }
    })
    const tuned = autoTunePaintStroke(curve, 1)
    expect(tuned.length).toBeGreaterThan(2)
    expect(tuned.length).toBeLessThan(curve.length)
    expect(tuned[0]).toEqual(curve[0])
    expect(tuned[tuned.length - 1]).toEqual(curve[curve.length - 1])
  })

  it('provides stronger calibration headroom through 300%', () => {
    expect(autoTunePaintStroke(jitteredLine, 3).length).toBeLessThanOrEqual(autoTunePaintStroke(jitteredLine, 1).length)
  })
})

describe('one visible brush diameter', () => {
  it('maps the displayed diameter to GrabCut seed, halo, and corridor radii', () => {
    expect(grabCutBrushGeometry(20)).toEqual({
      seedRadiusPx: 10,
      haloRadiusPx: 30,
      corridorRadiusPx: 25,
    })
    expect(grabCutBrushGeometry(40)).toEqual({
      seedRadiusPx: 20,
      haloRadiusPx: 60,
      corridorRadiusPx: 50,
    })
  })
})
