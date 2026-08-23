// Wrap measurement on the 1 mm ruler — one signed clearance per lattice node, measured once.
//
// The supplied segments (outer ring + holes) are the sole geometry. Every node gets one
// per-anchor record: nearest distance to the complete boundary, material membership, and the
// ruled signed clearance. Seat legality, the belt and the belt's required flap are all read
// from those same records; no distance is recomputed and nothing below the ruler decides.

import type { ContactWitness, Contour, Pt, WrapMeasurement } from '../spec'
import { nearestOutlineMM, pointInMaterial, splitPerimeter } from './seat'

/** The private Compute result: populations and the policy-facing measurement from one pass. */
export interface WrapResult { seated: Pt[]; belt: Pt[]; wrapMeasurement: WrapMeasurement }

export function measureWrap(
  contour: Contour, lattice: ReadonlyArray<Pt>, pitchMM: number, spotRadiusMM: number,
): WrapResult {
  const refused = (seated: Pt[], reason: 'invalid-boundary' | 'empty-belt'): WrapResult => ({
    seated, belt: [],
    wrapMeasurement: { status: 'refused', requiredFlapMM: null, witnesses: [], refusal: { code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason } },
  })
  if (contour.outer.pts.length < 3) return refused([], 'invalid-boundary')
  const records = lattice
    .map((node) => {
      const nearest = nearestOutlineMM(contour, node)
      const rawClearanceMM = pointInMaterial(contour, node) ? nearest.distMM - spotRadiusMM : -(nearest.distMM + spotRadiusMM)
      // The one conversion to the ruler: [-0.5, 0.5) reads 0, [0.5, 1.5) reads 1, [-1.5, -0.5) reads -1.
      return { node, clearanceMM: Math.floor(rawClearanceMM + 0.5), pointsMM: nearest.pointsMM }
    })
    .filter((record) => record.clearanceMM >= 0)
  const seated = records.map((record) => record.node)
  const beltNodes = new Set(seated.length <= 4 ? seated : splitPerimeter(seated, pitchMM).belt)
  const belt = records.filter((record) => beltNodes.has(record.node))
  if (!belt.length) return refused(seated, 'empty-belt')
  const witnesses: ContactWitness[] = belt.flatMap((record) =>
    record.pointsMM.map((outlinePointMM) => ({ beltAnchorMM: record.node, outlinePointMM, clearanceMM: record.clearanceMM })))
  return {
    seated,
    belt: belt.map((record) => record.node),
    wrapMeasurement: {
      status: 'measured',
      requiredFlapMM: Math.max(...belt.map((record) => record.clearanceMM)),
      witnesses,
      refusal: null,
    },
  }
}
