import { describe, expect, it } from 'vitest'
import { canonicalExact, rational } from '../compute/exact-real'
import { contourBoundaryTruth, prepareContour } from '../compute'
import { measureFrozenMeshCentreEvidence, measureFullOuterCentreEvidence } from '../compute/centre-evidence'
import { inspectFixedSize, solveBands } from '../engine'
import { evaluateCandidateLaws, reduceBandLadders } from '../logic'
import type {
  CandidateLawEvaluation,
  ComparisonEngineConfig,
  Contour,
  EvaluationPolicy,
  NormalizedBoundary,
  RootedCandidateGeometry,
} from '../spec'

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
  it('keeps Box and Weight off the frozen-mesh transition path used by mesh-derived modes', () => {
    const fullOuter = measureFullOuterCentreEvidence(square, rational(24))
    const mesh = measureFrozenMeshCentreEvidence(square, rational(24), rational(12), rational(16))
    expect(fullOuter.status).toBe('measured')
    expect(mesh.status).toBe('measured')
    if (fullOuter.status !== 'measured' || mesh.status !== 'measured') return
    expect(fullOuter.transitionAnchors).toHaveLength(0)
    expect(fullOuter.evidence.core).toBeNull()
    expect(fullOuter.evidence.deepest).toEqual([])
    expect(mesh.transitionAnchors.length).toBeGreaterThan(0)
  })

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
    expect(result.bands.map((band) => band.rungs.map((rung) => rung.magnetCount))).toEqual([[1], [2, 4], [8], [12]])
    const counts = result.bands.flatMap((band) => band.rungs.map((rung) => rung.magnetCount))
    expect(new Set(counts).size).toBe(counts.length)
    expect(result.bands.flatMap((band) => band.rungs).map((rung) => canonicalExact(rung.scale.exact)))
      .toEqual([24, 72, 72, 120, 168].map((value) => canonicalExact(rational(value))))

    // Count 2 is a distinct first-lawful vertical placement at the exact B2 boundary:
    // parity is true, both perimeter anchors bind at flap 0, and earlier B1 sites prove absence/unlawfulness.
    const count2 = result.bands[1].rungs.find((rung) => rung.magnetCount === 2)
    expect(count2).toBeDefined()
    expect(count2!.firstLawful.priorEvidenceIds.length).toBeGreaterThan(0)
    expect(count2!.firstLawful.contact.allowance).toEqual(rational(0))
    expect(count2!.layouts).toHaveLength(1)
    expect(count2!.layouts[0].anchors).toHaveLength(2)
    expect(count2!.layouts[0].belt).toHaveLength(2)
    expect(count2!.layouts[0].requiredFlap).toEqual(rational(0))
    expect(count2!.layouts[0].contacts).toHaveLength(2)
    const inspected = inspectFixedSize({ contour: normalized(square), sizeMM: 72, config })
    expect(inspected.candidates).toContainEqual(expect.objectContaining({
      magnetCount: 2,
      parityTrue: true,
      orientation: 'vertical',
      requiredFlap: rational(0),
      concessions: [],
    }))
  })

  it('retains a lower count when a higher-count placement fails Wrap at the same scale', () => {
    const policy: EvaluationPolicy = { ...config, policyIdentity: 'policy' }
    const lower = evaluateCandidateLaws(rootedCandidate(2, rational(0), 'lower'), policy)
    const higher = evaluateCandidateLaws(rootedCandidate(4, rational(1), 'higher'), policy)
    expect(lower.status).toBe('lawful')
    expect(higher.status === 'refused' && higher.refusal.code).toBe('WRAP_EXCEEDS_ALLOWANCE')
    const reduced = reduceBandLadders([], [lower, higher])
    expect(reduced.bands[1].rungs.map((rung) => rung.magnetCount)).toEqual([2])
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

const rootedCandidate = (count: number, requiredFlap: ReturnType<typeof rational>, id: string): RootedCandidateGeometry => {
  const point = { x: rational(0), y: rational(0), approximateMM: [0, 0] as const }
  const evidence = { id: 'evidence', box: point, core: null, weight: point, deepest: [], islands: [], masses: [] }
  return {
    band: 2,
    scale: { exact: rational(72), approximateMM: 72 },
    phase: point,
    xParity: 'node',
    yParity: 'node',
    parityEvidence: {
      x: { lineCount: 1, centreRelation: 'node' },
      y: { lineCount: 1, centreRelation: 'node' },
    },
    centre: { target: point, policy: { mode: 'box' }, evidenceId: evidence.id },
    centreEvidence: evidence,
    seated: Array.from({ length: count }, () => point),
    belt: Array.from({ length: count }, () => point),
    seatedCount: count,
    beltCount: count,
    requiredFlap,
    requiredFlapApproxMM: Number(requiredFlap.numerator) / Number(requiredFlap.denominator),
    orientation: count === 2 ? 'vertical' : 'two-dimensional',
    measuredId: id,
    geometryLayoutId: `layout-${id}`,
    regimeId: 'regime',
    contacts: [{
      scale: { exact: rational(72), approximateMM: 72 },
      boundaryTruth: { rule: 'supplied-final-contour', contourIdentity: 'contour' },
      beltAnchorId: `anchor-${id}`,
      outlineElementId: 'outline',
      outlineElementKind: 'segment',
      allowance: requiredFlap,
      equation: { kind: 'polynomial', polynomial: ['1'], rootIndex: 0 },
      tangency: point,
      regimeId: 'regime',
      certificateId: `contact-${id}`,
    }],
    seatedExtremeCorners: Array.from({ length: count }, () => false),
    beltExtremeCorners: Array.from({ length: count }, () => false),
    centreErrorMM: 0,
    centreTrue: true,
  }
}
