// Neutral centre measurements from the characterized v3.5 region evidence.

import type { CentreMeasurements, CentreRegionRef, Contour, Pt, RegionMeasurement } from '../spec'
import { bbox } from './seat'

/** Area centroid of a polygon (shoelace) — the material's weight centre. */
export function centroidOf(pts: ReadonlyArray<Pt>): Pt {
  let a2 = 0, sx = 0, sy = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cross = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    a2 += cross
    sx += (pts[j][0] + pts[i][0]) * cross
    sy += (pts[j][1] + pts[i][1]) * cross
  }
  if (Math.abs(a2) < 1e-9) {
    let mx = 0, my = 0
    for (const p of pts) { mx += p[0]; my += p[1] }
    return [mx / pts.length, my / pts.length]
  }
  return [sx / (3 * a2), sy / (3 * a2)]
}

export function centreMeasurements(contour: Contour, regions: readonly RegionMeasurement[]): CentreMeasurements {
  const bounds = bbox(contour.outer.pts)
  return {
    box: [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2],
    core: coreCentre(regions, [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]),
    weight: centroidOf(contour.outer.pts),
    regions,
    masses: allMasses(regions),
    midY: (bounds.minY + bounds.maxY) / 2,
  }
}

export function coreCentre(regions: readonly RegionMeasurement[], fallback: Pt): Pt {
  if (!regions.length) return fallback
  let area = 0, x = 0, y = 0
  for (const region of regions) {
    area += region.areaMM2
    x += region.meanMM[0] * region.areaMM2
    y += region.meanMM[1] * region.areaMM2
  }
  return [x / area, y / area]
}

export function allMasses(regions: readonly RegionMeasurement[]): readonly CentreRegionRef[] {
  const measured: CentreRegionRef[] = []
  for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
    const region = regions[regionIndex]
    if (region.masses.length) {
      for (let massIndex = 0; massIndex < region.masses.length; massIndex++) {
        measured.push({ region: region.masses[massIndex], regionIndex, massIndex })
      }
    } else measured.push({ region, regionIndex, massIndex: null })
  }
  return measured
}
