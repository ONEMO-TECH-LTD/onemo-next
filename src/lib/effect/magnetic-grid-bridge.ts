// Law bridge — pass-through contour adapter for the already-loaded comparison shape.

import type { Contour } from '@/lib/magnetic-grid/engine'

function float64Hex(value: number): string {
  const buffer = new ArrayBuffer(8)
  new DataView(buffer).setFloat64(0, value, false)
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export interface LawContourInput {
  contour: Contour
  contourIdentity: string
}

export function passThroughLawContour(contour: Contour): LawContourInput {
  const rings = [contour.outer, ...contour.holes]
  const contourIdentity = `ieee754-v1:${rings.map((ring) => ring.pts
    .map(([x, y]) => `${float64Hex(x)}${float64Hex(y)}`).join('')).join(':')}`
  return { contour, contourIdentity }
}
