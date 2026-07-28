import {
  ATTACHMENTS,
  DENSITIES,
  GRID_ATTACHMENTS,
  MANUFACTURING_TOLERANCE_MM,
  USER_SHAPES,
  assertEqual,
  currentEnginePath,
  fail,
  finish,
  jsonSha256,
  legacyOnOneLattice,
  loadEngine,
  projectOneLegalLattice,
  rangeInclusive,
  readArtifact,
  type Attachment,
  type GridEngineModule,
  type ResolvedPlan,
} from './t1-contract'

interface ExpectedLattice {
  latticeReproduction: {
    generic: { cases: number; pass: number; violations: number }
    user: {
      cases: number
      pass: number
      violations: number
      densityDimensionIsDuplicated: boolean
    }
  }
  classifiedLatticeOracle: {
    generic: ExpectedClassified
    user: ExpectedClassified
  }
}

interface ExpectedClassified {
  cases: number | string
  multiAnchorPass: number | string
  violations: number | string
  singleAnchorExclusions: number | string
  noGridExclusions: number | string
  corpusSha256: string
}

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

interface ClassifiedSummary {
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

function summarize(cases: ClassifiedCase[]): ClassifiedSummary {
  return {
    cases: cases.length,
    multiAnchorPass: cases.filter((entry) => entry.classification === 'multi-anchor-pass').length,
    violations: cases.filter((entry) => entry.classification === 'violation').length,
    singleAnchorExclusions: cases.filter((entry) => entry.classification === 'single-anchor-exclusion').length,
    noGridExclusions: cases.filter((entry) => entry.classification === 'no-grid-exclusion').length,
    corpusSha256: jsonSha256(cases),
  }
}

function assertClassified(
  actual: ClassifiedSummary,
  expected: ExpectedClassified,
  label: string,
): void {
  const unresolved = Object.entries(expected).filter(([, value]) =>
    typeof value === 'string' && value === 'OBSERVE_ON_FIRST_RUN',
  )
  if (unresolved.length) {
    throw new Error(`${label} expected artifact is unresolved; observed ${JSON.stringify(actual)}.`)
  }
  assertEqual(actual.cases, expected.cases, `${label} cases`)
  assertEqual(actual.multiAnchorPass, expected.multiAnchorPass, `${label} multi-anchor passes`)
  assertEqual(actual.violations, expected.violations, `${label} violations`)
  assertEqual(actual.singleAnchorExclusions, expected.singleAnchorExclusions, `${label} single-anchor exclusions`)
  assertEqual(actual.noGridExclusions, expected.noGridExclusions, `${label} no-grid exclusions`)
  assertEqual(actual.corpusSha256, expected.corpusSha256, `${label} corpus hash`)
}

function runLegacyReproduction(engine: GridEngineModule): {
  generic: { cases: number; pass: number; violations: number }
  user: { cases: number; pass: number; violations: number }
} {
  if (!engine.resolveUserGridPlan) throw new Error('Current engine does not expose resolveUserGridPlan.')
  const out = {
    generic: { cases: 0, pass: 0, violations: 0 },
    user: { cases: 0, pass: 0, violations: 0 },
  }
  for (const shape of USER_SHAPES)
    for (const attachment of GRID_ATTACHMENTS)
      for (const density of DENSITIES)
        for (const sizeMM of rangeInclusive(40, 310, 10)) {
          const contour = engine.stdShapeContour(shape, sizeMM)
          const generic = engine.resolveGridPlan(contour, { attachment, density })
          const user = engine.resolveUserGridPlan(contour, attachment)
          for (const [door, plan] of [['generic', generic], ['user', user]] as const) {
            out[door].cases++
            if (legacyOnOneLattice(plan.grid.anchors.map((anchor) => anchor.p))) out[door].pass++
            else out[door].violations++
          }
        }
  return out
}

function runClassifiedGeneric(engine: GridEngineModule): ClassifiedCase[] {
  const cases: ClassifiedCase[] = []
  for (const shape of USER_SHAPES)
    for (const attachment of ATTACHMENTS)
      for (const density of DENSITIES)
        for (const sizeMM of rangeInclusive(40, 310, 10)) {
          const key = ['generic', shape, attachment, density, sizeMM].join('|')
          const contour = engine.stdShapeContour(shape, sizeMM)
          const plan = engine.resolveGridPlan(contour, { attachment, density })
          cases.push(classify(key, attachment, plan))
        }
  return cases
}

function runClassifiedUser(engine: GridEngineModule): ClassifiedCase[] {
  if (!engine.resolveUserGridPlan) throw new Error('Current engine does not expose resolveUserGridPlan.')
  const cases: ClassifiedCase[] = []
  for (const shape of USER_SHAPES)
    for (const attachment of ATTACHMENTS)
      // The User door has no density input. Do not double-count the same job under two labels.
      for (const sizeMM of rangeInclusive(40, 310, 10)) {
        const key = ['user', shape, attachment, sizeMM].join('|')
        const contour = engine.stdShapeContour(shape, sizeMM)
        const plan = engine.resolveUserGridPlan(contour, attachment)
        cases.push(classify(key, attachment, plan))
      }
  return cases
}

async function main(): Promise<void> {
  const expected = readArtifact<ExpectedLattice>('t1-expected.json')
  const engine = await loadEngine(currentEnginePath())

  const reproduction = runLegacyReproduction(engine)
  assertEqual(reproduction.generic.cases, expected.latticeReproduction.generic.cases, 'reproduction generic cases')
  assertEqual(reproduction.generic.pass, expected.latticeReproduction.generic.pass, 'reproduction generic passes')
  assertEqual(reproduction.generic.violations, expected.latticeReproduction.generic.violations, 'reproduction generic violations')
  assertEqual(reproduction.user.cases, expected.latticeReproduction.user.cases, 'reproduction user cases')
  assertEqual(reproduction.user.pass, expected.latticeReproduction.user.pass, 'reproduction user passes')
  assertEqual(reproduction.user.violations, expected.latticeReproduction.user.violations, 'reproduction user violations')

  const genericCases = runClassifiedGeneric(engine)
  const userCases = runClassifiedUser(engine)
  const classified = {
    generic: summarize(genericCases),
    user: summarize(userCases),
  }
  assertClassified(classified.generic, expected.classifiedLatticeOracle.generic, 'classified generic')
  assertClassified(classified.user, expected.classifiedLatticeOracle.user, 'classified user')

  finish('t1-bounded-lattice-oracle', {
    toleranceMM: MANUFACTURING_TOLERANCE_MM,
    reproduction: {
      ...reproduction,
      note: 'Historical 448-case reproduction; User density is deliberately duplicated only here.',
    },
    classified: {
      ...classified,
      note: 'Velcro/no-grid and single-anchor are exclusions, never passes. User density is not duplicated.',
    },
  })
}

main().catch((error) => fail('t1-bounded-lattice-oracle', error))
