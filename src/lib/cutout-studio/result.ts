import { contourFromShape, vectorShapeHash } from '@/lib/effect/geometry-truth'
import type { Contour } from '@/lib/effect/types'
import type { TraceOutlineSettings } from '@/lib/effect/trace-outline-controls'
import type { PaintConfig } from '@/lib/mask-tools'
import { transformShape, type VShape } from '@/lib/vector-core'

export interface CutoutArtworkIdentity {
  sha256: string
  byteLength: number
  mediaType: string
  widthPx: number
  heightPx: number
}

export interface CutoutMaskIdentity {
  sha256: string
  widthPx: number
  heightPx: number
  hasSoftAlpha: boolean
}

export interface CutoutResultInputs {
  version: 'cutout-inputs/v1'
  source: 'cutout' | 'paint'
  sourceAdapter: string
  vectorPreset: string | null
  vector: TraceOutlineSettings
  paint: PaintConfig
  edgeFinishPx: number
  blend: { blend: number }
  outputSource: 'original' | 'capped-1536'
}

export interface CutoutResult {
  version: 'cutout-result/v1'
  finalShape: VShape
  vectorShapeHash: string
  scale: {
    maskWidthPx: number
    maskHeightPx: number
    mmPerPx: number
  }
  contourMM: Contour
  artwork: CutoutArtworkIdentity
  mask: CutoutMaskIdentity
  inputs: CutoutResultInputs
}

export function buildCutoutResult(input: {
  finalShape: VShape
  maskWidthPx: number
  maskHeightPx: number
  mmPerPx: number
  artwork: CutoutArtworkIdentity
  mask: CutoutMaskIdentity
  inputs: CutoutResultInputs
}): CutoutResult {
  const finalShape = transformShape(input.finalShape, (point) => ({ ...point }))
  const contourMM = contourFromShape(finalShape, {
    mmPerPx: input.mmPerPx,
    maskHeightPx: input.maskHeightPx,
  })
  if (!contourMM) throw new Error('final Cutout shape is degenerate')
  return {
    version: 'cutout-result/v1',
    finalShape,
    vectorShapeHash: vectorShapeHash(finalShape),
    scale: {
      maskWidthPx: input.maskWidthPx,
      maskHeightPx: input.maskHeightPx,
      mmPerPx: input.mmPerPx,
    },
    contourMM,
    artwork: input.artwork,
    mask: input.mask,
    inputs: input.inputs,
  }
}
