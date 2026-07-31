import { describe, expect, it } from 'vitest'
import {
  blendPixelsToPercent,
  blendPercentToPixels,
  buildArtworkFillDraws,
  resolveArtworkFrame,
  resolveArtworkSubjectDraw,
  type ArtworkFillDraw,
} from '../composite'

function rasterize(
  source: readonly (readonly number[])[],
  frame: ReturnType<typeof resolveArtworkFrame>,
  draws: readonly ArtworkFillDraw[],
): number[][] {
  const output = Array.from({ length: frame.height }, () => Array(frame.width).fill(0))
  for (const draw of draws) {
    for (let y = Math.floor(draw.dy); y < Math.ceil(draw.dy + draw.dh); y += 1) {
      for (let x = Math.floor(draw.dx); x < Math.ceil(draw.dx + draw.dw); x += 1) {
        if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) continue
        const u = draw.dw === 0 ? 0 : (x + 0.5 - draw.dx) / draw.dw
        const v = draw.dh === 0 ? 0 : (y + 0.5 - draw.dy) / draw.dh
        const sx = Math.min(draw.sx + draw.sw - 1, Math.max(draw.sx, Math.floor(draw.sx + u * draw.sw)))
        const sy = Math.min(draw.sy + draw.sh - 1, Math.max(draw.sy, Math.floor(draw.sy + v * draw.sh)))
        output[y][x] = source[sy][sx]
      }
    }
  }
  return output
}

describe('v5.3.1 framed 2D compositor', () => {
  it('keeps the initial source-frame operation byte-sized like composeFront', () => {
    const frame = resolveArtworkFrame(120, 80)
    expect(frame).toEqual({ originX: 0, originY: 0, width: 120, height: 80 })
    expect(buildArtworkFillDraws(120, 80, frame, 'clamp')).toEqual([
      { sx: 0, sy: 0, sw: 120, sh: 80, dx: 0, dy: 0, dw: 120, dh: 80 },
    ])
    expect(blendPercentToPixels(50, 1000)).toBe(20)
    expect(blendPixelsToPercent(20, 1000)).toBe(50)
    expect(blendPercentToPixels(0, 1000)).toBe(0)
    expect(blendPercentToPixels(100, 1000)).toBe(40)
  })

  it('resolves one integer frame beyond all four source edges', () => {
    expect(resolveArtworkFrame(2, 2, { minX: -1, minY: -1, maxX: 3, maxY: 3 }))
      .toEqual({ originX: -1, originY: -1, width: 4, height: 4 })
  })

  it('keeps the sharp subject registered to a non-zero source-space frame', () => {
    const frame = { originX: -7, originY: -11, width: 134, height: 102 }
    expect(resolveArtworkSubjectDraw(120, 80, frame))
      .toEqual({ dx: 7, dy: 11, dw: 120, dh: 80 })
  })

  it('clamps deterministic edge pixels into every exposed edge and corner with no void', () => {
    const source = [[1, 2], [3, 4]]
    const frame = resolveArtworkFrame(2, 2, { minX: -1, minY: -1, maxX: 3, maxY: 3 })
    const output = rasterize(source, frame, buildArtworkFillDraws(2, 2, frame, 'clamp'))

    expect(output).toEqual([
      [1, 1, 2, 2],
      [1, 1, 2, 2],
      [3, 3, 4, 4],
      [3, 3, 4, 4],
    ])
    expect(output.flat().filter(Boolean)).toHaveLength(16)
  })

  it('tiles deterministic source pixels into every exposed edge and corner with no void', () => {
    const source = [[1, 2], [3, 4]]
    const frame = resolveArtworkFrame(2, 2, { minX: -1, minY: -1, maxX: 3, maxY: 3 })
    const output = rasterize(source, frame, buildArtworkFillDraws(2, 2, frame, 'tile'))

    expect(output).toEqual([
      [4, 3, 4, 3],
      [2, 1, 2, 1],
      [4, 3, 4, 3],
      [2, 1, 2, 1],
    ])
    expect(output.flat().filter(Boolean)).toHaveLength(16)
  })
})
