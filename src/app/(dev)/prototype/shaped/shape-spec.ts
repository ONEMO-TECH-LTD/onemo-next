export const SHAPED_ENGINE_VERSION = 'codex-redo-0.1.0'

export interface BinaryMask {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type MaskEditTool = 'erase' | 'restore'

export interface ShapeMaskEdit {
  id: string
  tool: MaskEditTool
  x: number
  y: number
  radius: number
  at: number
}

export interface ShapeSpecDraft {
  sourceRef: string
  approvedMaskRef: string
  editOps: ShapeMaskEdit[]
  generator: {
    adapterId: string
    modelVersion: string
    clientVersion: string
  }
  dimensionsMm: {
    targetMinDimensionMm: number
    bodyThicknessMm: number
    edgeProfile: 'rounded'
    edgeRadiusMm: number
  }
}

export interface ShapeMeshStats {
  contourPoints: number
  triangles: number
  widthMm: number
  heightMm: number
  bodyThicknessMm: number
  edgeRadiusMm: number
}

export const DEFAULT_SHAPE_SPEC_DIMENSIONS = {
  targetMinDimensionMm: 70,
  bodyThicknessMm: 1.6,
  edgeProfile: 'rounded' as const,
  edgeRadiusMm: 0.8,
}

export function createShapeSpecDraft({
  sourceRef,
  approvedMaskRef,
  editOps,
  adapterId,
  modelVersion,
}: {
  sourceRef: string
  approvedMaskRef: string
  editOps: ShapeMaskEdit[]
  adapterId: string
  modelVersion: string
}): ShapeSpecDraft {
  return {
    sourceRef,
    approvedMaskRef,
    editOps,
    generator: {
      adapterId,
      modelVersion,
      clientVersion: SHAPED_ENGINE_VERSION,
    },
    dimensionsMm: DEFAULT_SHAPE_SPEC_DIMENSIONS,
  }
}
