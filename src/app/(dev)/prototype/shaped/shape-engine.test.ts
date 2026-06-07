import { describe, expect, it } from 'vitest'
import { applyBrushEdit } from './mask-utils'
import { buildShapedGeometryFromMask } from './shape-geometry'
import type { BinaryMask } from './shape-spec'

function rectangleMask(width = 80, height = 80): BinaryMask {
  const data = new Uint8ClampedArray(width * height)
  for (let y = 18; y < 62; y += 1) {
    for (let x = 12; x < 68; x += 1) {
      data[y * width + x] = 255
    }
  }
  return { width, height, data }
}

describe('shaped engine redo', () => {
  it('applies visible manual mask edits', () => {
    const mask = rectangleMask()
    const edited = applyBrushEdit(mask, 30, 30, 8, 'erase')
    expect(mask.data[30 * mask.width + 30]).toBe(255)
    expect(edited.data[30 * edited.width + 30]).toBe(0)
  })

  it('builds a 1.6mm rounded-edge mesh from an approved mask', () => {
    const build = buildShapedGeometryFromMask(rectangleMask())
    expect(build).not.toBeNull()
    expect(build?.stats.bodyThicknessMm).toBe(1.6)
    expect(build?.stats.edgeRadiusMm).toBe(0.8)
    expect(build?.geometry.groups).toHaveLength(3)
    expect(build?.stats.widthMm).toBeGreaterThan(70)
    expect(build?.stats.heightMm).toBe(70)
  })
})
