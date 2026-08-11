import { describe, expect, it } from 'vitest'
import { contourFromShape, vectorShapeHash } from '@/lib/effect/geometry-truth'
import type { VShape } from '@/lib/vector-core'
import { buildCutoutResult } from '../result'

const shape: VShape = {
  paths: [{
    anchors: [
      { p: { x: 10, y: 20 }, corner: true },
      { p: { x: 90, y: 20 }, corner: true },
      { p: { x: 90, y: 80 }, corner: true },
      { p: { x: 10, y: 80 }, corner: true },
    ],
  }],
}

describe('Cutout result boundary', () => {
  it('publishes the exact vector truth, scale, contour, identities, and regeneration inputs without Grid policy', () => {
    const result = buildCutoutResult({
      finalShape: shape,
      maskWidthPx: 100,
      maskHeightPx: 100,
      mmPerPx: 0.7,
      artwork: { sha256: 'artwork-sha', byteLength: 123, mediaType: 'image/png', widthPx: 2048, heightPx: 2048 },
      mask: { sha256: 'mask-sha', widthPx: 100, heightPx: 100, hasSoftAlpha: true },
      inputs: {
        version: 'cutout-inputs/v1',
        source: 'cutout',
        sourceAdapter: 'u2netp',
        vectorPreset: 'PURE',
        vector: { detail: 100, offset: 1, offsetJoin: 'sharp', simplify: 15, smooth: 0, radius: 0, curve: 0, straighten: 0 },
        paint: { autoTuneStrength: 1, polishStrength: 0, closeFrac: 0.35 },
        edgeFinishPx: 8,
        blend: { blend: 0 },
        outputSource: 'original',
      },
    })

    expect(result.version).toBe('cutout-result/v1')
    expect(result.finalShape).toEqual(shape)
    expect(result.finalShape).not.toBe(shape)
    expect(result.vectorShapeHash).toBe(vectorShapeHash(shape))
    expect(result.contourMM).toEqual(contourFromShape(shape, { mmPerPx: 0.7, maskHeightPx: 100 }))
    expect(result.scale).toEqual({ maskWidthPx: 100, maskHeightPx: 100, mmPerPx: 0.7 })
    expect(result.artwork.sha256).toBe('artwork-sha')
    expect(result.mask.sha256).toBe('mask-sha')
    expect(result.inputs.outputSource).toBe('original')
    expect(result).not.toHaveProperty('grid')
  })

  it('fails loudly instead of publishing a contour for a degenerate shape', () => {
    expect(() => buildCutoutResult({
      finalShape: { paths: [] },
      maskWidthPx: 1,
      maskHeightPx: 1,
      mmPerPx: 1,
      artwork: { sha256: 'artwork-sha', byteLength: 1, mediaType: 'image/png', widthPx: 1, heightPx: 1 },
      mask: { sha256: 'mask-sha', widthPx: 1, heightPx: 1, hasSoftAlpha: false },
      inputs: {
        version: 'cutout-inputs/v1', source: 'paint', sourceAdapter: 'brushed', vectorPreset: 'ZERO',
        vector: { detail: 100, offset: 0, offsetJoin: 'sharp', simplify: 0, smooth: 0, radius: 0, curve: 0, straighten: 0 },
        paint: { autoTuneStrength: 1, polishStrength: 0, closeFrac: 0.35 },
        edgeFinishPx: 8, blend: { blend: 0 }, outputSource: 'original',
      },
    })).toThrow('final Cutout shape is degenerate')
  })
})
