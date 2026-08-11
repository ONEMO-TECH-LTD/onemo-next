import { describe, expect, it } from 'vitest'

import { grabCutBrushGeometry } from '@/lib/cutout-grabcut'
import { finishMask, ZERO_SETTINGS } from '@/components/cutout-studio/finish'
import { autoTunePaintStroke, paintSmoothingRadius, polishMask, subtractMasks } from '@/lib/mask-tools'
import type { Mask } from '@/lib/mask-tools/types'

function rectangle(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Mask {
  const data = new Uint8Array(w * h)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * w + x] = 1
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

describe('Paint eraser coordinate parity', () => {
  it('returns the resolved negative shape where the mask stroke was drawn, not vertically mirrored', () => {
    const negative = rectangle(40, 40, 8, 4, 24, 10)
    const finished = finishMask(negative, ZERO_SETTINGS)

    expect(finished).not.toBeNull()
    expect(finished!.bounds.minY).toBeLessThan(6)
    expect(finished!.bounds.maxY).toBeLessThan(12)
  })

  it('changes no accepted-main mask pixel outside the negative shape', () => {
    const base = rectangle(40, 40, 4, 4, 36, 36)
    const negative = rectangle(40, 40, 16, 12, 24, 28)
    const result = subtractMasks(base, negative)

    for (let i = 0; i < base.data.length; i++) {
      if (!negative.data[i]) expect(result.data[i]).toBe(base.data[i])
    }
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
