import type { ShapePoint, ShapeProfile } from '../types'

export const SHAPED_EFFECT_RULES = {
  minOuterDimensionMm: 70,
  requiredAttachmentSquareMm: 70,
  insetMm: 8,
  thicknessMm: 1.6,
  mmToWorld: 0.001,
}

export interface ShapeMetrics {
  widthMm: number
  heightMm: number
  thicknessMm: number
  insetMm: number
  requiredAttachmentSquareMm: number
  innerWidthMm: number
  innerHeightMm: number
  scaleMm: number
  centerX: number
  centerY: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  outerPass: boolean
  attachmentPass: boolean
}

export const DEFAULT_SHAPE_POINTS: ShapePoint[] = [
  { x: 0.48, y: 0.06 },
  { x: 0.66, y: 0.1 },
  { x: 0.83, y: 0.23 },
  { x: 0.9, y: 0.43 },
  { x: 0.82, y: 0.65 },
  { x: 0.68, y: 0.84 },
  { x: 0.48, y: 0.94 },
  { x: 0.31, y: 0.86 },
  { x: 0.14, y: 0.66 },
  { x: 0.08, y: 0.43 },
  { x: 0.16, y: 0.22 },
  { x: 0.31, y: 0.1 },
]

export function createShapeProfile(
  points: ShapePoint[] = DEFAULT_SHAPE_POINTS,
  source: ShapeProfile['source'] = 'preset',
  edgeColors: string[] = []
): ShapeProfile {
  return {
    points: normalizeShapePoints(points),
    edgeColors,
    source,
    updatedAt: new Date().toISOString(),
  }
}

export function normalizeShapePoints(points: ShapePoint[]) {
  return points.map((point) => ({
    x: clamp(point.x, 0.01, 0.99),
    y: clamp(point.y, 0.01, 0.99),
  }))
}

export function createShapeMetrics(points: ShapePoint[]): ShapeMetrics {
  const normalized = normalizeShapePoints(points)
  const xs = normalized.map((point) => point.x)
  const ys = normalized.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const widthNorm = Math.max(maxX - minX, 0.001)
  const heightNorm = Math.max(maxY - minY, 0.001)
  const scaleMm = SHAPED_EFFECT_RULES.minOuterDimensionMm / Math.min(widthNorm, heightNorm)
  const widthMm = widthNorm * scaleMm
  const heightMm = heightNorm * scaleMm
  const innerWidthMm = Math.max(widthMm - SHAPED_EFFECT_RULES.insetMm * 2, 0)
  const innerHeightMm = Math.max(heightMm - SHAPED_EFFECT_RULES.insetMm * 2, 0)

  return {
    widthMm,
    heightMm,
    thicknessMm: SHAPED_EFFECT_RULES.thicknessMm,
    insetMm: SHAPED_EFFECT_RULES.insetMm,
    requiredAttachmentSquareMm: SHAPED_EFFECT_RULES.requiredAttachmentSquareMm,
    innerWidthMm,
    innerHeightMm,
    scaleMm,
    centerX: minX + widthNorm / 2,
    centerY: minY + heightNorm / 2,
    minX,
    minY,
    maxX,
    maxY,
    outerPass: Math.min(widthMm, heightMm) >= SHAPED_EFFECT_RULES.minOuterDimensionMm - 0.01,
    attachmentPass:
      innerWidthMm >= SHAPED_EFFECT_RULES.requiredAttachmentSquareMm
      && innerHeightMm >= SHAPED_EFFECT_RULES.requiredAttachmentSquareMm,
  }
}

export function shapePointToWorld(point: ShapePoint, metrics: ShapeMetrics) {
  return {
    x: (point.x - metrics.centerX) * metrics.scaleMm * SHAPED_EFFECT_RULES.mmToWorld,
    y: (metrics.centerY - point.y) * metrics.scaleMm * SHAPED_EFFECT_RULES.mmToWorld,
  }
}

export function worldToShapeUv(x: number, y: number, metrics: ShapeMetrics) {
  return {
    u: clamp(metrics.centerX + x / (metrics.scaleMm * SHAPED_EFFECT_RULES.mmToWorld), 0, 1),
    v: clamp(metrics.centerY - y / (metrics.scaleMm * SHAPED_EFFECT_RULES.mmToWorld), 0, 1),
  }
}

export function createCutlineSvg(profile: ShapeProfile, metrics = createShapeMetrics(profile.points)) {
  const path = profile.points.map((point, index) => {
    const xMm = (point.x - metrics.centerX) * metrics.scaleMm
    const yMm = (point.y - metrics.centerY) * metrics.scaleMm
    return `${index === 0 ? 'M' : 'L'} ${round(xMm)} ${round(yMm)}`
  }).join(' ')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(metrics.widthMm)}mm" height="${round(metrics.heightMm)}mm" viewBox="${round(-metrics.widthMm / 2)} ${round(-metrics.heightMm / 2)} ${round(metrics.widthMm)} ${round(metrics.heightMm)}">`,
    `  <path id="cutline" d="${path} Z" fill="none" stroke="#000" stroke-width="0.2" vector-effect="non-scaling-stroke"/>`,
    '</svg>',
  ].join('\n')
}

export function createRegistrationJson(profile: ShapeProfile, metrics = createShapeMetrics(profile.points)) {
  return {
    schema: 'onemo.shaped-effect.registration.v0',
    source: profile.source,
    dimensions: {
      width_mm: round(metrics.widthMm),
      height_mm: round(metrics.heightMm),
      thickness_mm: round(metrics.thicknessMm),
      cutline_inset_mm: round(metrics.insetMm),
      required_attachment_square_mm: round(metrics.requiredAttachmentSquareMm),
      inner_width_after_inset_mm: round(metrics.innerWidthMm),
      inner_height_after_inset_mm: round(metrics.innerHeightMm),
      outer_min_dimension_pass: metrics.outerPass,
      attachment_square_pass: metrics.attachmentPass,
    },
    cutline_points_mm: profile.points.map((point) => ({
      x: round((point.x - metrics.centerX) * metrics.scaleMm),
      y: round((point.y - metrics.centerY) * metrics.scaleMm),
    })),
    cutline_points_normalized: profile.points.map((point) => ({
      x: round(point.x, 5),
      y: round(point.y, 5),
    })),
    output_roles: ['cutline_svg', 'registration_json', 'qa_preview'],
    generated_at: new Date().toISOString(),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number, precision = 3) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}
