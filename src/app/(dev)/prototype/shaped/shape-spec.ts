'use client'

export interface ShapePoint {
  x: number
  y: number
}

export interface ShapeRingPair {
  px: ShapePoint[]
  mm: ShapePoint[]
}

export interface ShapeValidationIssue {
  code: string
  subsystem: string
  severity: 'block' | 'warn' | 'info'
  measured?: number
  threshold?: number
  message: string
}

export interface ShapeSpecDraft {
  id: string
  source: {
    ref: string
    width_px: number
    height_px: number
    hash: string
  }
  approved_mask: {
    width_px: number
    height_px: number
    threshold: number
    foreground_mode: 'alpha' | 'border-background'
  }
  generator: {
    adapter_id: string
    client_version: string
    model_version: string
  }
  edit_ops: Array<{
    op: string
    value: number | string
  }>
  geometry_px: {
    outer: ShapePoint[]
    holes: ShapePoint[][]
    winding: 'outer_ccw_holes_cw'
    fill_rule: 'nonzero'
  }
  geometry_mm: {
    outer: ShapePoint[]
    holes: ShapePoint[][]
    winding: 'outer_ccw_holes_cw'
    fill_rule: 'nonzero'
  }
  dimensions_mm: {
    width: number
    height: number
    thickness_body: number
    edge_profile: 'rounded'
    edge_radius_mm: number
    source_px_to_shape_mm: number
  }
  paths_mm: {
    cutline: ShapePoint[]
    bleed: ShapePoint[]
    safe: ShapePoint[]
  }
  attachment_template: {
    hardware_type: 'magnet' | 'snap_button'
    grid_pitch_mm: number
    layout: 'silhouette_adaptive'
  }
  validation: ShapeValidationIssue[]
}

export interface ShapedPreviewSettings {
  targetMinDimensionMm: number
  threshold: number
  simplifyEpsilonMm: number
  maskResolution: number
}

export const SHAPED_DEFAULTS = {
  bodyThicknessMm: 1.6,
  edgeRadiusMm: 1,
  gridPitchMm: 54,
  targetMinDimensionMm: 70,
  simplifyEpsilonMm: 0.35,
  threshold: 36,
  maskResolution: 260,
} as const

export const INITIAL_SHAPED_SETTINGS: ShapedPreviewSettings = {
  targetMinDimensionMm: SHAPED_DEFAULTS.targetMinDimensionMm,
  threshold: SHAPED_DEFAULTS.threshold,
  simplifyEpsilonMm: SHAPED_DEFAULTS.simplifyEpsilonMm,
  maskResolution: SHAPED_DEFAULTS.maskResolution,
}
