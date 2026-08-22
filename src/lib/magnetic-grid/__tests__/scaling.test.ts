import { describe, expect, it } from 'vitest'
import { canonicalExact, rational } from '../compute/exact-real'
import { contourBoundaryTruth, prepareContour } from '../compute'
import { inspectFixedSize, solveBands } from '../engine'
import type { ComparisonEngineConfig, Contour, NormalizedBoundary } from '../spec'

const square: Contour = { outer: { pts: [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]] }, holes: [] }
const diamond: Contour = { outer: { pts: [[0, .5], [.5, 0], [0, -.5], [-.5, 0]] }, holes: [] }
const normalized = (contour: Contour): NormalizedBoundary => {
  const truth = contourBoundaryTruth(contour), prepared = prepareContour(contour, truth)
  return { boundary: prepared.boundary, truth, normalizedLongestSideMM: 1, displayContour: contour }
}
const config: ComparisonEngineConfig = {
  flap: { mode: 'fixed', allowance: rational(0) }, coverage: 'perimeter', magnetPlan: 'all6', centrePolicy: { mode: 'box' },
}

describe('v3.5.1 exact scaling', () => {
  it('solves the irrational diamond contact event and carries predecessor evidence', () => {
    const result = solveBands({ contour: normalized(diamond), config })
    const rung = result.bands.find((band) => band.band === 3)?.rungs.find((candidate) => candidate.magnetCount === 4)
    expect(rung).toBeDefined()
    expect(rung!.scale.exact).toEqual({ polynomial: ['1', '-192', '8064'], isolating: [rational(129), rational(130)], rootIndex: 1 })
    expect(rung!.layouts.length).toBeGreaterThan(0)
    expect(rung!.layouts.every((layout) => layout.contacts.length > 0)).toBe(true)
    expect(rung!.firstLawful.contact.allowance).toEqual(rational(0))
    expect(rung!.firstLawful.priorEvidenceIds.length).toBeGreaterThan(0)
  })

  it('owns strictly increasing square counts once across B1-B4', () => {
    const result = solveBands({ contour: normalized(square), config })
    expect(result.bands.map((band) => band.rungs.map((rung) => rung.magnetCount))).toEqual([[1], [4], [8], [12]])
    const counts = result.bands.flatMap((band) => band.rungs.map((rung) => rung.magnetCount))
    expect(new Set(counts).size).toBe(counts.length)
    expect(result.bands.flatMap((band) => band.rungs).map((rung) => canonicalExact(rung.scale.exact)))
      .toEqual([24, 72, 120, 168].map((value) => canonicalExact(rational(value))))
  })

  it('keeps Wrap belt-scoped, Coverage population-only and MagnetPlan diameter-only', () => {
    const perimeter = solveBands({ contour: normalized(square), config })
    const full = solveBands({ contour: normalized(square), config: { ...config, coverage: 'full' } })
    const all8 = solveBands({ contour: normalized(square), config: { ...config, magnetPlan: 'all8' } })
    expect(perimeter.bands.map((band) => band.rungs.map((rung) => rung.magnetCount))).toEqual([[1], [4], [8], [12]])
    expect(full.bands.map((band) => band.rungs.map((rung) => rung.magnetCount))).toEqual([[1], [4], [9], [16]])
    expect(perimeter.bands.flatMap((band) => band.rungs).map((rung) => rung.layouts.map((layout) => layout.belt.map(canonicalExactPoint))))
      .toEqual(full.bands.flatMap((band) => band.rungs).map((rung) => rung.layouts.map((layout) => layout.belt.map(canonicalExactPoint))))
    expect(perimeter.bands.flatMap((band) => band.rungs).map((rung) => rung.layouts.map((layout) => layout.anchors.map((anchor) => canonicalExactPoint(anchor.centre)))))
      .toEqual(all8.bands.flatMap((band) => band.rungs).map((rung) => rung.layouts.map((layout) => layout.anchors.map((anchor) => canonicalExactPoint(anchor.centre)))))
  })

  it('fails closed on forged display/boundary provenance', () => {
    const contour = normalized(square)
    const forged = { ...contour, displayContour: diamond }
    expect(solveBands({ contour: forged, config }).status).toBe('refused')
  })

  it('measures forced-phase Centre concessions and keeps corners8 neutral', () => {
    const result = inspectFixedSize({
      contour: normalized(square), sizeMM: 72, forcedPhaseMM: [1, 2],
      config: { ...config, magnetPlan: 'corners8' },
    })
    expect(result.candidates.some((candidate) => candidate.centreErrorMM > 0 && candidate.concessions.includes('CENTRE'))).toBe(true)
    expect(result.candidates.some((candidate) => candidate.anchors.some((anchor) => anchor.diameterMM === 8))).toBe(true)
  })
})

const canonicalExactPoint = (point: { x: Parameters<typeof canonicalExact>[0]; y: Parameters<typeof canonicalExact>[0] }) =>
  `${canonicalExact(point.x)}:${canonicalExact(point.y)}`
