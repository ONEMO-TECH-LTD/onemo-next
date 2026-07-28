import {
  ATTACHMENTS,
  DENSITIES,
  MANUFACTURING_TOLERANCE_MM,
  USER_SHAPES,
  assertEqual,
  currentEnginePath,
  fail,
  finish,
  jsonSha256,
  loadEngine,
  projectOneLegalLattice,
  rangeInclusive,
  readArtifact,
  type Attachment,
  type ResolvedPlan,
} from './t1-contract'

interface ClassifiedCase {
  key: string
  classification: 'multi-anchor-pass' | 'violation' | 'single-anchor-exclusion' | 'no-grid-exclusion'
  reason?: string
  pitchMM: number
  pattern: ResolvedPlan['pattern']
  anchors: number
  originMM?: [number, number]
  basisMM?: number
  maxRoundTripErrorMM?: number
}

interface ExpectedSummary {
  cases: number
  multiAnchorPass: number
  violations: number
  singleAnchorExclusions: number
  noGridExclusions: number
  corpusSha256: string
}

function classify(key: string, attachment: Attachment, plan: ResolvedPlan): ClassifiedCase {
  const anchors = plan.grid.anchors.length
  if (attachment === 'velcro' || anchors === 0 || plan.pattern === null) {
    return {
      key,
      classification: 'no-grid-exclusion',
      reason: attachment === 'velcro' ? 'velcro-no-grid' : 'zero-anchor-no-grid',
      pitchMM: plan.pitchMM,
      pattern: plan.pattern,
      anchors,
    }
  }
  if (anchors === 1) {
    return {
      key,
      classification: 'single-anchor-exclusion',
      reason: 'single-anchor-has-no-grid-relation',
      pitchMM: plan.pitchMM,
      pattern: plan.pattern,
      anchors,
    }
  }
  const projection = projectOneLegalLattice(plan)
  if (!projection) {
    return {
      key,
      classification: 'violation',
      reason: 'cannot-round-trip-through-one-legal-lattice',
      pitchMM: plan.pitchMM,
      pattern: plan.pattern,
      anchors,
    }
  }
  return {
    key,
    classification: 'multi-anchor-pass',
    pitchMM: plan.pitchMM,
    pattern: plan.pattern,
    anchors,
    originMM: projection.originMM,
    basisMM: projection.basisMM,
    maxRoundTripErrorMM: projection.maxRoundTripErrorMM,
  }
}

async function main(): Promise<void> {
  const expected = readArtifact<{
    classifiedLatticeOracle: { generic: ExpectedSummary }
  }>('t1-expected.json').classifiedLatticeOracle.generic
  const engine = await loadEngine(currentEnginePath())
  const cases: ClassifiedCase[] = []

  for (const shape of USER_SHAPES)
    for (const attachment of ATTACHMENTS)
      for (const density of DENSITIES)
        for (const sizeMM of rangeInclusive(40, 310, 10)) {
          const key = ['surviving', shape, attachment, density, sizeMM].join('|')
          const contour = engine.stdShapeContour(shape, sizeMM)
          const plan = engine.resolveGridPlan(contour, { attachment, density })
          cases.push(classify(key, attachment, plan))
        }

  const summary: ExpectedSummary = {
    cases: cases.length,
    multiAnchorPass: cases.filter((entry) => entry.classification === 'multi-anchor-pass').length,
    violations: cases.filter((entry) => entry.classification === 'violation').length,
    singleAnchorExclusions: cases.filter((entry) => entry.classification === 'single-anchor-exclusion').length,
    noGridExclusions: cases.filter((entry) => entry.classification === 'no-grid-exclusion').length,
    corpusSha256: jsonSha256(cases.map((entry) => ({
      ...entry,
      key: entry.key.replace(/^surviving/, 'generic'),
    }))),
  }

  assertEqual(summary.cases, expected.cases, 'surviving lattice cases')
  assertEqual(summary.multiAnchorPass, expected.multiAnchorPass, 'surviving multi-anchor passes')
  assertEqual(summary.violations, 0, 'surviving lattice violations')
  assertEqual(summary.singleAnchorExclusions, expected.singleAnchorExclusions, 'surviving single-anchor exclusions')
  assertEqual(summary.noGridExclusions, expected.noGridExclusions, 'surviving no-grid exclusions')
  assertEqual(summary.corpusSha256, expected.corpusSha256, 'surviving lattice corpus hash')

  finish('t2-surviving-lattice-oracle', {
    toleranceMM: MANUFACTURING_TOLERANCE_MM,
    ...summary,
    note: 'Velcro/no-grid and single-anchor are classified exclusions, never passes.',
  })
}

main().catch((error) => fail('t2-surviving-lattice-oracle', error))
