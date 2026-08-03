import { getShape, type VectorShapeKind } from '../../src/lib/shape-library'
import { contourFromShape } from '../../src/lib/effect/geometry-truth'
import {
  DEFAULT_LAW,
  DEFAULT_MARGIN_MM,
  resolveGridPlan,
  scaleContour,
  semanticLadder,
  stdShapeContour,
  type GridDensity,
  type GridMode,
  type GridSource,
  type StandardLadderShape,
} from '../../src/lib/effect/grid'
import type { Contour, Pt } from '../../src/lib/effect/types'

const STANDARD_SHAPES: StandardLadderShape[] = ['square', 'circle', 'triangle', 'diamondShape']
const PRESETS: VectorShapeKind[] = [
  'squircle', 'square', 'circle', 'pill', 'heart', 'star', 'polygon', 'diamond', 'plus',
  'teardrop', 'leaf', 'lens', 'bolt', 'sparkle', 'pinched', 'asterisk', 'bowtie',
]
const DENSITIES = ['light', 'standard'] as const satisfies readonly GridDensity[]
const MODES = ['standard', 'standard'] as const satisfies readonly GridMode[]
const IMG = 1000

function presetUnitContour(preset: VectorShapeKind): Contour {
  const contour = contourFromShape(
    getShape(preset, IMG, IMG, { sides: 6, points: 5 }),
    { mmPerPx: 1, maskHeightPx: IMG },
  )
  if (!contour || contour.outer.pts.length < 3) throw new Error(`Preset ${preset} has no contour.`)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of contour.outer.pts) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  const longest = Math.max(maxX - minX, maxY - minY, 1)
  return {
    outer: { pts: contour.outer.pts.map(([x, y]) => [x / longest, y / longest] as Pt) },
    holes: [],
  }
}

function planSummary(contour: Contour, mode: GridMode, density: GridDensity, source: GridSource) {
  const plan = resolveGridPlan(contour, {
    attachment: 'magnetic',
    source,
    mode,
    density,
    paddingMM: DEFAULT_LAW.paddingMM,
    maxGrowMM: DEFAULT_MARGIN_MM,
    signedBaseMargin: true,
    diagnosticVelcro: true,
  })
  return {
    pattern: plan.pattern,
    pitchMM: plan.pitchMM,
    anchors: plan.grid.anchors.length,
    flaps: plan.grid.flaps.length,
    ok: plan.grid.ok,
  }
}

function standardShapeRows(shape: StandardLadderShape, mode: GridMode) {
  const rungs = semanticLadder(
    (sizeMM) => stdShapeContour(shape, sizeMM, sizeMM),
    DEFAULT_LAW,
    mode,
    { source: 'std' },
  )
  return rungs.map((rung) => ({
    label: rung.label,
    sizeMM: rung.sizeMM,
    points: rung.points,
    visible: rung.visible,
    densities: Object.fromEntries(DENSITIES.map((density) => [
      density,
      planSummary(stdShapeContour(shape, rung.sizeMM, rung.sizeMM), mode, density, 'std'),
    ])),
  }))
}

function presetRows(preset: VectorShapeKind, mode: GridMode) {
  const unit = presetUnitContour(preset)
  const referenceRungs = semanticLadder(
    (sizeMM) => stdShapeContour('square', sizeMM, sizeMM),
    DEFAULT_LAW,
    mode,
    { source: 'preset' },
  )
  return referenceRungs.map((rung) => ({
    label: rung.label,
    sizeMM: rung.sizeMM,
    points: rung.points,
    visible: rung.visible,
    densities: Object.fromEntries(DENSITIES.map((density) => [
      density,
      planSummary(scaleContour(unit, rung.sizeMM), mode, density, 'preset'),
    ])),
  }))
}

function standardSuitable(rows: ReturnType<typeof presetRows>) {
  const plans = rows.flatMap((row) => Object.values(row.densities))
  const multiAnchor = plans.filter((plan) => plan.anchors >= 2)
  const singleAnchor = plans.filter((plan) => plan.anchors === 1).length
  const failures = multiAnchor.filter((plan) =>
    plan.pattern !== 'standard' || !plan.ok || plan.flaps !== 0
  ).length
  return { suitable: failures === 0, multiAnchor: multiAnchor.length, singleAnchor, failures }
}

const standardShapes = Object.fromEntries(STANDARD_SHAPES.map((shape) => [
  shape,
  Object.fromEntries(MODES.map((mode) => [mode, standardShapeRows(shape, mode)])),
]))

const presets = Object.fromEntries(PRESETS.map((preset) => {
  const auto = presetRows(preset, 'standard')
  const standard = presetRows(preset, 'standard')
  return [preset, {
    classification: standardSuitable(standard),
    auto,
    standard,
  }]
}))

const visibleProductRows = STANDARD_SHAPES.flatMap((shape) =>
  standardShapeRows(shape, 'standard')
    .filter(({ visible }) => visible)
    .map((row) => ({ shape, ...row })))
const nonStandardProductRows = visibleProductRows.filter(({ densities }) =>
  Object.values(densities).some(({ pattern }) => pattern !== 'standard'))

const report = {
  schemaVersion: 1,
  measurement: {
    attachment: 'magnetic',
    densities: DENSITIES,
    modes: MODES,
    standardRungs: 'shape-specific',
    presetRungs: 'square-reference, matching the current page',
    presetSuitability: 'every multi-anchor standard plan is ok, zero-flap, and standard-pattern',
    oneAnchor: 'classified boundary; never counted as a pass',
  },
  productAutoGate: {
    visibleRungs: visibleProductRows.length,
    nonStandardRungs: nonStandardProductRows.length,
    offenders: nonStandardProductRows.map(({ shape, label, sizeMM }) =>
      `${shape}/${label}/${sizeMM}`),
  },
  standardShapes,
  presets,
}

console.log(JSON.stringify(report, null, 2))

if (process.argv.includes('--verify')) {
  if (visibleProductRows.length !== 18) {
    throw new Error(`Expected 18 visible product rungs; received ${visibleProductRows.length}.`)
  }
  if (nonStandardProductRows.length) {
    throw new Error(
      `Product Auto selected admin-only patterns on ${nonStandardProductRows.length}/18 rungs: `
      + report.productAutoGate.offenders.join(', '),
    )
  }
}
