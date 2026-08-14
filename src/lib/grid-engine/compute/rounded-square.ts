import type { VAnchor, VShape } from '@/lib/vector-core'

import { contourFromShape } from './geometry-truth'
import type { Contour } from './types'

function finiteDimension(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`)
  }
  return value
}

function finiteRadius(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Rounded-square radius must be a non-negative finite number.')
  }
  return value
}

/** One radius-parameterised circular-arc rounded rectangle in source/vector coordinates. */
export function roundedSquareShape(
  width: number,
  height: number,
  radius: number,
  originX = 0,
  originY = 0,
): VShape {
  const w = finiteDimension(width, 'Rounded-square width')
  const h = finiteDimension(height, 'Rounded-square height')
  const r = Math.min(finiteRadius(radius), w / 2, h / 2)
  if (r === 0) {
    return { paths: [{ anchors: [
      { p: { x: originX, y: originY }, corner: true },
      { p: { x: originX + w, y: originY }, corner: true },
      { p: { x: originX + w, y: originY + h }, corner: true },
      { p: { x: originX, y: originY + h }, corner: true },
    ] }] }
  }

  const k = (4 / 3) * Math.tan(Math.PI / 8) * r
  const x0 = originX, x1 = originX + w
  const y0 = originY, y1 = originY + h
  const anchors: VAnchor[] = [
    { p: { x: x0 + r, y: y0 }, hIn: { x: x0 + r - k, y: y0 }, hOut: null, corner: false },
    { p: { x: x1 - r, y: y0 }, hIn: null, hOut: { x: x1 - r + k, y: y0 }, corner: false },
    { p: { x: x1, y: y0 + r }, hIn: { x: x1, y: y0 + r - k }, hOut: null, corner: false },
    { p: { x: x1, y: y1 - r }, hIn: null, hOut: { x: x1, y: y1 - r + k }, corner: false },
    { p: { x: x1 - r, y: y1 }, hIn: { x: x1 - r + k, y: y1 }, hOut: null, corner: false },
    { p: { x: x0 + r, y: y1 }, hIn: null, hOut: { x: x0 + r - k, y: y1 }, corner: false },
    { p: { x: x0, y: y1 - r }, hIn: { x: x0, y: y1 - r + k }, hOut: null, corner: false },
    { p: { x: x0, y: y0 + r }, hIn: null, hOut: { x: x0, y: y0 + r - k }, corner: false },
  ]
  return { paths: [{ anchors }] }
}

/** The same construction materialised in physical millimetres for grid recipes/workers. */
export function roundedSquareContourMM(
  widthMM: number,
  heightMM: number,
  radiusMM: number,
): Contour {
  const contour = contourFromShape(
    roundedSquareShape(widthMM, heightMM, radiusMM),
    { mmPerPx: 1, maskHeightPx: heightMM },
  )
  if (!contour) throw new Error('Rounded-square geometry did not produce a contour.')
  return contour
}
