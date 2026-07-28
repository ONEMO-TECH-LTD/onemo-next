import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  GRID_ENGINE_CACHE_VERSION,
  GRID_ENGINE_POLICY_SIGNATURE,
  resolveGridPlan,
  stdShapeContour,
  type GridPattern,
  type GridPlanOptions,
  type ResolvedGridPlan,
} from '../../src/lib/effect/grid-core'
import { DENSE_REAL_AI_GRID_CONTOUR } from '../../src/lib/effect/grid-s0-corpus'
import { MANUFACTURING_TOLERANCE_MM } from '../../src/lib/effect/geometry-truth'
import type { Contour, Pt } from '../../src/lib/effect/types'

type WholeIndex = [number, number]
type Basis = { firstMM: Pt; secondMM: Pt; rule: string }

interface Fixture {
  id: string
  contourMM: Contour
}

const ROOT = new URL('../../', import.meta.url)
const GRID_CORE = new URL('src/lib/effect/grid-core.ts', ROOT)
const ARTIFACT_PATH = 'docs/s59-grid-remediation/s59-KAI-9779-manufacturing-readiness.json'
const SIZES_MM = [40, 70, 91, 118, 143, 166, 214, 262, 310] as const
const PATTERN_OPTIONS: ReadonlyArray<GridPlanOptions & { mode: GridPattern }> = [
  { mode: 'standard', pitchMM: 48 },
  { mode: 'standard', pitchMM: 96 },
  { mode: 'diamond', pitchMM: 48 },
  { mode: 'diamond', pitchMM: 96 },
  { mode: 'quincunx', pitchMM: 96 },
]

const holedContour: Contour = {
  outer: { pts: [[0, 0], [214, 0], [214, 214], [0, 214]] },
  holes: [{ pts: [[95, 95], [95, 119], [119, 119], [119, 95]] }],
}

function fail(message: string): never {
  throw new Error(message)
}

function basisFor(pattern: GridPattern, pitchMM: number): Basis {
  if (pattern === 'standard') {
    return {
      firstMM: [pitchMM, 0],
      secondMM: [0, pitchMM],
      rule: 'axis-aligned pitch lattice',
    }
  }
  if (pattern === 'diamond') {
    return {
      firstMM: [pitchMM, pitchMM],
      secondMM: [pitchMM, -pitchMM],
      rule: 'one checkerboard parity of the pitch lattice',
    }
  }
  return {
    firstMM: [pitchMM, 0],
    secondMM: [pitchMM / 2, pitchMM / 2],
    rule: 'main pitch lattice plus the legal half-pitch diagonal offset',
  }
}

function originIndex(anchors: ResolvedGridPlan['grid']['anchors']): number {
  let best = 0
  for (let index = 1; index < anchors.length; index++) {
    const [x, y] = anchors[index].p
    const [bx, by] = anchors[best].p
    if (x < bx || (x === bx && y < by)) best = index
  }
  return best
}

function projectAnchors(plan: ResolvedGridPlan) {
  if (!plan.pattern) fail('A grid-bearing plan must name its pattern.')
  if (plan.grid.anchors.length < 2) fail('A lattice projection requires at least two anchors.')

  const basis = basisFor(plan.pattern, plan.pitchMM)
  const originAnchorIndex = originIndex(plan.grid.anchors)
  const originMM = plan.grid.anchors[originAnchorIndex].p
  const [ax, ay] = basis.firstMM
  const [bx, by] = basis.secondMM
  const determinant = ax * by - ay * bx
  if (Math.abs(determinant) < Number.EPSILON) fail(`Degenerate ${plan.pattern} basis.`)

  let maxRoundTripErrorMM = 0
  const anchors = plan.grid.anchors.map((anchor, anchorIndex) => {
    const dx = anchor.p[0] - originMM[0]
    const dy = anchor.p[1] - originMM[1]
    const rawFirst = (dx * by - dy * bx) / determinant
    const rawSecond = (ax * dy - ay * dx) / determinant
    const index: WholeIndex = [Math.round(rawFirst), Math.round(rawSecond)]
    const roundTripMM: Pt = [
      originMM[0] + index[0] * ax + index[1] * bx,
      originMM[1] + index[0] * ay + index[1] * by,
    ]
    const errorMM = Math.hypot(roundTripMM[0] - anchor.p[0], roundTripMM[1] - anchor.p[1])
    if (errorMM > MANUFACTURING_TOLERANCE_MM) {
      fail(`${plan.pattern} anchor ${anchorIndex} misses its lattice by ${errorMM}mm.`)
    }
    maxRoundTripErrorMM = Math.max(maxRoundTripErrorMM, errorMM)
    return {
      index,
      positionMM: anchor.p,
      diameterMM: anchor.dia,
    }
  })

  return { originMM, basis, originAnchorIndex, anchors, maxRoundTripErrorMM }
}

function standardFixtures(): Fixture[] {
  const fixtures: Fixture[] = []
  for (const sizeMM of SIZES_MM) {
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      fixtures.push({ id: `${shape}-${sizeMM}`, contourMM: stdShapeContour(shape, sizeMM, sizeMM) })
    }
    fixtures.push({
      id: `rect-${sizeMM}`,
      contourMM: stdShapeContour('rect', sizeMM, Math.round(sizeMM * 0.65)),
    })
  }
  fixtures.push(
    { id: 'final-contour-holed', contourMM: holedContour },
    { id: 'final-contour-real-ai-dense', contourMM: DENSE_REAL_AI_GRID_CONTOUR },
  )
  return fixtures
}

function makeSpecimen(id: string, contourMM: Contour, options: GridPlanOptions) {
  const plan = resolveGridPlan(contourMM, options)
  if (!plan.grid.ok) fail(`${id} is not an accepted manufacturing plan: ${plan.grid.issues.join(' | ')}`)
  const lattice = projectAnchors(plan)
  return {
    id,
    spec: {
      schemaVersion: 1,
      manufacturedContourSource: 'effectContourMM',
      manufacturedContourMM: plan.effectContourMM,
      attachment: plan.grid.attachment,
      twinRequired: plan.grid.twinRequired,
      pattern: plan.pattern,
      pitchMM: plan.pitchMM,
      lattice: {
        originMM: lattice.originMM,
        basisMM: [lattice.basis.firstMM, lattice.basis.secondMM],
        indexEncoding: 'signed whole-number pair',
        rule: lattice.basis.rule,
      },
      anchorColumns: ['indexFirst', 'indexSecond', 'xMM', 'yMM', 'diameterMM'],
      anchors: lattice.anchors.map((anchor) => [
        anchor.index[0],
        anchor.index[1],
        anchor.positionMM[0],
        anchor.positionMM[1],
        anchor.diameterMM,
      ]),
      marginsMM: {
        base: plan.baseMarginMM,
        resolved: plan.resolvedMarginMM,
        grown: plan.grewMM,
      },
    },
  }
}

function buildArtifact() {
  const fixtures = standardFixtures()
  let plans = 0
  let projectedPlans = 0
  let projectedAnchors = 0
  let invalidPlans = 0
  let singleAnchorPlans = 0
  let zeroAnchorPlans = 0
  let maxRoundTripErrorMM = 0
  const byPattern: Record<GridPattern, { plans: number; anchors: number; maxErrorMM: number }> = {
    standard: { plans: 0, anchors: 0, maxErrorMM: 0 },
    diamond: { plans: 0, anchors: 0, maxErrorMM: 0 },
    quincunx: { plans: 0, anchors: 0, maxErrorMM: 0 },
  }
  const corpusHash = createHash('sha256')

  for (const fixture of fixtures) {
    for (const patternOptions of PATTERN_OPTIONS) {
      for (const attachment of ['magnetic', 'twinfix'] as const) {
        for (const density of ['light', 'standard'] as const) {
          for (const center of ['centroid', 'bbox'] as const) {
            const options = { ...patternOptions, attachment, density, center }
            const plan = resolveGridPlan(fixture.contourMM, options)
            plans++
            corpusHash.update(JSON.stringify({ fixture: fixture.id, options, plan }))
            if (!plan.grid.ok) invalidPlans++
            if (plan.pattern !== patternOptions.mode) {
              fail(`${fixture.id} requested ${patternOptions.mode} but resolved ${plan.pattern}.`)
            }
            if (plan.grid.anchors.length === 0) {
              zeroAnchorPlans++
              continue
            }
            if (plan.grid.anchors.length === 1) {
              singleAnchorPlans++
              continue
            }
            const projected = projectAnchors(plan)
            projectedPlans++
            projectedAnchors += projected.anchors.length
            maxRoundTripErrorMM = Math.max(maxRoundTripErrorMM, projected.maxRoundTripErrorMM)
            const stats = byPattern[plan.pattern]
            stats.plans++
            stats.anchors += projected.anchors.length
            stats.maxErrorMM = Math.max(stats.maxErrorMM, projected.maxRoundTripErrorMM)
          }
        }
      }
    }
  }

  let noGridPlans = 0
  for (const fixture of fixtures) {
    const plan = resolveGridPlan(fixture.contourMM, { attachment: 'velcro' })
    if (plan.pattern !== null || plan.grid.anchors.length !== 0) {
      fail(`${fixture.id} Velcro plan unexpectedly exposes a grid.`)
    }
    noGridPlans++
  }

  const specimens = [
    makeSpecimen('standard-square', stdShapeContour('square', 118, 118), {
      attachment: 'magnetic', mode: 'standard', density: 'standard', pitchMM: 48,
    }),
    makeSpecimen('diamond-square', stdShapeContour('square', 214, 214), {
      attachment: 'twinfix', mode: 'diamond', density: 'standard', pitchMM: 48,
    }),
    makeSpecimen('quincunx-square', stdShapeContour('square', 214, 214), {
      attachment: 'magnetic', mode: 'quincunx', density: 'standard', pitchMM: 96,
    }),
    makeSpecimen('standard-holed', holedContour, {
      attachment: 'magnetic', mode: 'standard', density: 'standard', pitchMM: 48,
    }),
  ]

  const mutationPlan = resolveGridPlan(stdShapeContour('square', 166, 166), {
    attachment: 'magnetic', mode: 'standard', density: 'standard', pitchMM: 48,
  })
  const mutationOrigin = originIndex(mutationPlan.grid.anchors)
  const mutationIndex = mutationPlan.grid.anchors.findIndex((_, index) => index !== mutationOrigin)
  const mutatedPlan: ResolvedGridPlan = structuredClone(mutationPlan)
  mutatedPlan.grid.anchors[mutationIndex].p[0] += MANUFACTURING_TOLERANCE_MM * 2
  let mutationRejected = false
  try {
    projectAnchors(mutatedPlan)
  } catch {
    mutationRejected = true
  }
  if (!mutationRejected) fail('The off-lattice mutation did not fail the round-trip gate.')

  return {
    schemaVersion: 1,
    verdict: 'READY',
    verdictScope: 'ResolvedGridPlan manufacturing-spec projection for grid-bearing standard, rectangular, arbitrary final-contour, and holed final-contour families.',
    source: {
      manufacturedContour: 'effectContourMM',
      reason: 'The engine fits anchors against the margin-resolved effect contour; designContourMM remains the unexpanded artwork boundary.',
      toleranceImport: 'MANUFACTURING_TOLERANCE_MM from src/lib/effect/geometry-truth.ts',
      toleranceMM: MANUFACTURING_TOLERANCE_MM,
      gridCoreSha256: createHash('sha256').update(readFileSync(GRID_CORE)).digest('hex'),
    },
    engine: {
      cacheVersion: GRID_ENGINE_CACHE_VERSION,
      policySignature: GRID_ENGINE_POLICY_SIGNATURE,
    },
    fieldMap: {
      eligibility: 'Emit a manufacturing spec only for grid.ok plans with at least two anchors; single-anchor and Velcro/no-grid outcomes remain classified boundaries.',
      manufacturedContourMM: 'effectContourMM outer ring plus holes, in real millimetres',
      attachment: 'grid.attachment; twinRequired identifies the mirrored Twin-fix counterpart',
      pattern: 'plan.pattern: standard, diamond, or quincunx',
      pitchAndBasisMM: 'plan.pitchMM plus the explicit two-vector pattern basis',
      originMM: 'lexicographically smallest delivered anchor, in engine millimetres',
      anchorRows: '[indexFirst, indexSecond, xMM, yMM, diameterMM]; indices are signed whole-number pairs and positions preserve grid.anchors[].p exactly',
      marginsMM: 'baseMarginMM, resolvedMarginMM, and grewMM',
      engineVersion: 'GRID_ENGINE_CACHE_VERSION plus GRID_ENGINE_POLICY_SIGNATURE',
    },
    coverage: {
      projectionNote: 'Every multi-anchor result is projected, including engine-rejected plans; the four emitted specimens are accepted grid.ok plans.',
      fixtures: fixtures.length,
      plans,
      projectedPlans,
      projectedAnchors,
      invalidPlans,
      classifiedExclusions: { zeroAnchorPlans, singleAnchorPlans, noGridPlans },
      byPattern,
      maxRoundTripErrorMM,
      corpusSha256: corpusHash.digest('hex'),
      offLatticeMutationRejected: mutationRejected,
    },
    specimens,
    gaps: [
      {
        id: 'live-export-not-wired-to-grid-plan',
        blockingForThisProjection: false,
        finding: 'The live mm-SVG exporter consumes the vector shape, not ResolvedGridPlan; save/order payload wiring remains dormant.',
      },
      {
        id: 'multi-ring-shape-producer',
        blockingForThisProjection: false,
        finding: 'ResolvedGridPlan preserves supplied holes, but contourFromShape currently warns and drops secondary VShape paths before they reach the grid engine.',
      },
      {
        id: 'size-list-product-solver-mismatch',
        blockingForThisProjection: false,
        finding: 'Report-only deferred finding; this task does not change the ladder or engine.',
      },
      {
        id: 'non-monotonic-anchor-counts',
        blockingForThisProjection: false,
        finding: 'Observed signed density/selection behaviour; this task does not reinterpret it as a spec-projection failure.',
      },
      {
        id: 'catalog-hold-metric',
        blockingForThisProjection: false,
        finding: 'The catalog metric defect remains a separate task; no catalog is regenerated here.',
      },
    ],
  }
}

function main() {
  const artifact = buildArtifact()
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`
  const verifyAt = process.argv.indexOf('--verify')
  if (verifyAt >= 0) {
    const path = process.argv[verifyAt + 1] ?? ARTIFACT_PATH
    const actual = JSON.parse(readFileSync(new URL(path, ROOT), 'utf8')) as unknown
    if (JSON.stringify(actual) !== JSON.stringify(artifact)) {
      fail(`Tracked artifact does not match current engine output: ${path}`)
    }
  }
  if (process.argv.includes('--print-artifact')) process.stdout.write(serialized)
  else {
    const c = artifact.coverage
    console.log(`READY · ${c.projectedPlans}/${c.plans} multi-anchor plans projected · ${c.projectedAnchors} anchors · max error ${c.maxRoundTripErrorMM}mm`)
    console.log(`Exclusions · zero ${c.classifiedExclusions.zeroAnchorPlans} · single ${c.classifiedExclusions.singleAnchorPlans} · no-grid ${c.classifiedExclusions.noGridPlans}`)
    console.log(`Corpus SHA-256 · ${c.corpusSha256}`)
    console.log(`Mutation rejected · ${c.offLatticeMutationRejected}`)
  }
}

try {
  main()
} catch (error) {
  console.error(`FAIL · ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
