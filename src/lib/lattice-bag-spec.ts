import type { Pt } from './effect/types'

export const LATTICE_PITCH_MM = 48
export const DISK_DIAMETER_MM = 24
export const DISK_RADIUS_MM = DISK_DIAMETER_MM / 2
export const MAX_BAG_DISKS = 1000

export const BAG_BANDS = [
  { id: 'B1', minMM: 24, maxMM: 71 },
  { id: 'B2', minMM: 72, maxMM: 119 },
  { id: 'B3', minMM: 120, maxMM: 167 },
  { id: 'B4', minMM: 168, maxMM: 216 },
] as const

export const AUTO_LAYOUTS = [
  { label: 'Vertical', axis: 'x' },
  { label: 'Horizontal', axis: 'y' },
  { label: 'Diagonal ↘', axis: 'descendingDiagonal' },
  { label: 'Diagonal ↗', axis: 'ascendingDiagonal' },
] as const

export const BAG_SOLVER_SPEC = {
  fitEpsilonMM: 0.001,
  contactToleranceMM: 0.05,
  opposingContactDotMax: -0.25,
  peripheryReachMM: 48,
  maximumUnsupportedSpanMM: DISK_DIAMETER_MM,
  clipperScale: 1000,
  maximumSolveSizeMM: 100_000,
  solveGrowthFactor: 1.25,
  maxRotationRad: Math.PI / 4,
  rotationStepRad: 5 * Math.PI / 180,
  coreSampleSteps: 32,
  ovalErrorMax: 0.09,
  diamondErrorMax: 0.09,
  portraitAspectMax: 0.82,
  landscapeAspectMin: 1.22,
  classifiedRectangleAspect: 0.72,
  classifiedFallbackBias: 0.05,
  viewPaddingMM: 42,
  imageTraceMaxPixels: 512,
  tracePointLimit: 180,
} as const

export type BagBandId = typeof BAG_BANDS[number]['id']
export type BagMode = 'auto' | 'classified' | 'bands'

export interface BagContact {
  disk: Pt
  outline: Pt
  clearanceMM: number
  inward: Pt
}

export interface PreparedBag {
  outline: Pt[]
}

export type BagShapeClass =
  | 'Square'
  | 'Portrait rectangle'
  | 'Landscape rectangle'
  | 'Circle / oval'
  | 'Diamond'

export const CLASSIFIED_COUNTS: Record<BagShapeClass, readonly number[]> = {
  Square: [1, 4, 9, 16],
  'Portrait rectangle': [1, 2, 6, 8],
  'Landscape rectangle': [1, 2, 6, 8],
  'Circle / oval': [1, 4, 9, 16],
  Diamond: [1, 4, 9, 16],
}

export interface BagFit {
  seats: Pt[]
  outline: Pt[]
  centre: Pt
  materialCentre: Pt
  sizeMM: number
  centreShiftMM: number
  minimumClearanceMM: number
  contacts: BagContact[]
  opposingContactPairs: number
  peripheryGaps: Pt[]
  uncoveredPeripheryMM: number
  maximumUnsupportedSpanMM: number
  option: string
  rotation: number
}

export interface BagBandResult {
  id: BagBandId
  minMM: number
  maxMM: number
  candidates: BagFit[]
}

export interface BagView {
  bounds: { minX: number; minY: number; width: number; height: number }
  gridAxis: number[]
  gridRadius: number
  latticeOrigin: Pt
  ghostSeats: Array<{ point: Pt; inside: boolean }>
}

export interface BagLayout {
  seats: Pt[]
  label: string
}

export interface GridTransform {
  x: number
  y: number
  rotation: number
}
