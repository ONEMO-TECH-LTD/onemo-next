import type { PointMM } from '../engine'

export const CENTRE_METHODS = [
  'box',
  'oriented-box',
  'area',
  'perimeter',
  'vertices',
  'maximum-clearance',
] as const

export type CentreMethod = (typeof CENTRE_METHODS)[number]
export type OperationalBand = 2 | 3
export type AxisRegistration = 'point' | 'gap'
export type PopulationPitchMM = 48 | 96

export interface GridEngineSpec {
  basePitchMM: number
  sparseFactor: number
  paddingMM: number
  positionsPerAxis: number
  bands: readonly OperationalBand[]
  centreMethods: readonly CentreMethod[]
}

export interface SolveRequest {
  outline: ReadonlyArray<PointMM>
  spec: GridEngineSpec
  flapLimitsMM: readonly [number, number]
}

export type UnsupportedOutlineReason =
  | 'fewer-than-three-vertices'
  | 'zero-area'
  | 'self-intersection'
  | 'non-finite-coordinate'

export interface UnsupportedOutlineResult {
  status: 'unsupported-outline'
  reason: UnsupportedOutlineReason
}

