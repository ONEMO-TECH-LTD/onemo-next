import { describe, expect, it, vi } from 'vitest'

const fakes = vi.hoisted(() => {
  const imageData = { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4) }
  const canvas = { width: 4, height: 4 }
  return { imageData, canvas }
})

vi.mock('../mask', () => ({
  loadImageData: vi.fn(async () => fakes.imageData),
  segment: vi.fn(() => ({
    mask: new Uint8Array(4 * 4).fill(1), width: 4, height: 4, imageData: fakes.imageData,
  })),
  adapterIdFor: vi.fn(() => 'flood-fill-fixture'),
  dilateMask: vi.fn((mask: Uint8Array) => mask),
  smoothMask: vi.fn((mask: Uint8Array) => mask),
  effectiveTextureDim: vi.fn(() => 4),
}))
vi.mock('../contour', () => ({
  traceContourRaw: vi.fn(() => [[0, 0], [4, 0], [4, 4], [0, 4]]),
}))
vi.mock('../composite', () => ({
  blendPixelsToPercent: vi.fn(() => 0),
  composeEffectArtwork: vi.fn(async () => ({ canvas: fakes.canvas })),
  blurCanvas: vi.fn(async () => fakes.canvas),
  imageDataToCanvas: vi.fn(() => fakes.canvas),
}))
vi.mock('@/lib/outline-core/math', () => ({
  rdpClosed: vi.fn((points: unknown) => points),
}))
vi.mock('../geometry-truth', () => ({
  MIN_FEATURE_MM: 0.4,
  contourFromShape: vi.fn(() => ({
    outer: { pts: [[0, 0], [4, 0], [4, 4], [0, 4]] }, holes: [],
  })),
}))

import { EFFECT_BUILD_CONFIG, prepareEffect } from '../prepare-effect'

describe('prepareEffect detector degradation', () => {
  it('reports the visible flood-fill state through the existing progress callback', async () => {
    const progress: string[] = []
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const prepared = await prepareEffect('fixture://cutout', 'shaped', EFFECT_BUILD_CONFIG, (state) => progress.push(state))

    expect(progress).toEqual(['fallback'])
    expect(prepared.spec.generator.adapter).toBe('flood-fill-fixture')
    expect(warn).toHaveBeenCalledWith(
      '[shaped] ML segmentation unavailable — falling back to flood-fill:',
      expect.any(Error),
    )
    warn.mockRestore()
  })
})
