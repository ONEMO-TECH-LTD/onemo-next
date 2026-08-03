/**
 * KAI-9836 — executable approximation inventory.
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.json scripts/grid-remediation/kai-9836-approximation-audit.ts
 *
 * Green means every bounded approximation stays inside the imported physical
 * tolerance and every known unbounded approximation remains explicitly owned.
 * It does NOT turn the KAI-9839 generator characterizations into passing law.
 */

import { vecFromGenerator } from '@/app/(dev)/effect-creator/v5.3.1/user/editor/producers'
import { fitShapeToBox } from '@/lib/export/svg-import'
import {
  DEFAULT_CIRCLE_TESSELLATION_CALIBRATION,
} from '@/lib/effect/effect-calibration'
import {
  DEFAULT_LAW,
  resolveGridPlan,
  semanticLadder,
  stdShapeContour,
} from '@/lib/effect/grid-core'
import {
  contourFromShape,
  MANUFACTURING_TOLERANCE_MM,
} from '@/lib/effect/geometry-truth'
import { distanceToPreparedContour, prepareExactContour } from '@/lib/effect/grid-prepared'
import { insetRingMM } from '@/lib/effect/offset'
import { getShape } from '@/lib/shape-library'
import { cubicPoint, segments, type VShape } from '@/lib/vector-core'

type Point = [number, number]

function normalized(points: Point[]): Point[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of points) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const scale = 2 / Math.max(maxX - minX, maxY - minY, Number.EPSILON)
  return points.map(([x, y]) => [(x - cx) * scale, (y - cy) * scale])
}

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state |= 0
    state = (state + 0x6D2B79F5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function generatorTruth(
  kind: 'form' | 'blob' | 'daisy' | 'pinwheel',
  count: number,
): { params: Record<string, number>; points: Point[] } {
  const points: Point[] = []
  if (kind === 'form') {
    const lobes = 7, depth = 0.48, epsilon = 0.006
    for (let i = 0; i < count; i++) {
      const angle = 2 * Math.PI * i / count
      const cosine = Math.cos(lobes * angle / 2)
      const radius = 1 - depth + depth * Math.pow(cosine * cosine + epsilon, 0.4)
      points.push([radius * Math.cos(angle), radius * Math.sin(angle)])
    }
    return { params: { lobes, pinch: 100 }, points: normalized(points) }
  }
  if (kind === 'blob') {
    const seed = 41, random = mulberry32(seed), waviness = 0.28
    const a1 = (0.5 + 0.5 * random()) * waviness, p1 = random() * 2 * Math.PI
    const a2 = (0.4 + 0.6 * random()) * waviness * 0.7, p2 = random() * 2 * Math.PI
    const a3 = (0.3 + 0.7 * random()) * waviness * 0.45, p3 = random() * 2 * Math.PI
    for (let i = 0; i < count; i++) {
      const angle = 2 * Math.PI * i / count
      const radius = 1
        + a1 * Math.sin(2 * angle + p1)
        + a2 * Math.sin(3 * angle + p2)
        + a3 * Math.sin(5 * angle + p3)
      points.push([radius * Math.cos(angle), radius * Math.sin(angle)])
    }
    return { params: { seed, waviness: 100 }, points: normalized(points) }
  }
  if (kind === 'daisy') {
    const petals = 11, depth = 0.38
    for (let i = 0; i < count; i++) {
      const angle = 2 * Math.PI * i / count
      const radius = 1 - depth + depth * (0.5 + 0.5 * Math.cos(petals * angle)) * 2
      points.push([radius * Math.cos(angle), radius * Math.sin(angle)])
    }
    return { params: { petals, depth: 100 }, points: normalized(points) }
  }
  const blades = 8, depth = 0.42, swirl = 1.4
  for (let i = 0; i < count; i++) {
    const angle = 2 * Math.PI * i / count
    const lobe = 0.5 + 0.5 * Math.cos(blades * angle)
    const radius = 1 - depth + depth * lobe * 2
    const theta = angle + swirl * (1 - lobe)
    points.push([radius * Math.cos(theta), radius * Math.sin(theta)])
  }
  return { params: { blades, swirl: 100 }, points: normalized(points) }
}

function vectorFlattenErrorMM(shape: VShape, mmPerPx: number, maskPx: number): number {
  const contour = contourFromShape(shape, { mmPerPx, maskHeightPx: maskPx })
  if (!contour) throw new Error('manufacturing contour did not materialize')
  const prepared = prepareExactContour(contour)
  let maxErrorMM = 0
  for (const segment of segments(shape.paths[0])) for (let i = 0; i < 4096; i++) {
    const t = i / 4096
    const point = segment.c1 && segment.c2
      ? cubicPoint(segment.a, segment.c1, segment.c2, segment.b, t)
      : {
          x: segment.a.x + (segment.b.x - segment.a.x) * t,
          y: segment.a.y + (segment.b.y - segment.a.y) * t,
        }
    maxErrorMM = Math.max(
      maxErrorMM,
      distanceToPreparedContour(
        [point.x * mmPerPx, (maskPx - point.y) * mmPerPx],
        prepared,
      ),
    )
  }
  return maxErrorMM
}

function generatorErrorMM(
  kind: 'form' | 'blob' | 'daisy' | 'pinwheel',
): number {
  const maskPx = 1000
  const longestMM = 180
  const mmPerPx = longestMM / (maskPx * 0.7)
  const truth = generatorTruth(kind, 8192)
  const vector = vecFromGenerator(
    kind,
    truth.params,
    { widthPx: maskPx, heightPx: maskPx },
    mmPerPx,
  )
  const contour = contourFromShape(vector, { mmPerPx, maskHeightPx: maskPx })
  if (!contour) throw new Error(`${kind} manufacturing contour did not materialize`)
  const prepared = prepareExactContour(contour)
  let maxErrorMM = 0
  for (const [x, y] of truth.points) {
    maxErrorMM = Math.max(
      maxErrorMM,
      distanceToPreparedContour(
        [(maskPx / 2 + x * maskPx * 0.35) * mmPerPx,
          (maskPx / 2 - y * maskPx * 0.35) * mmPerPx],
        prepared,
      ),
    )
  }
  return maxErrorMM
}

function roundOffsetSagittaMM(radiusMM: number): number {
  const ring = insetRingMM([[0, 0], [100, 0], [100, 100], [0, 100]], radiusMM)
  if (!ring) throw new Error('round-offset audit did not materialize')
  const arc = ring.filter(([x, y]) =>
    x <= 0 && y <= 0 &&
    Math.abs(Math.hypot(x, y) - radiusMM) <= 0.002,
  )
  if (arc.length < 2) throw new Error('round-offset audit did not contain an arc')
  let maxErrorMM = 0
  for (let i = 1; i < arc.length; i++) {
    const midpoint: Point = [
      (arc[i - 1][0] + arc[i][0]) / 2,
      (arc[i - 1][1] + arc[i][1]) / 2,
    ]
    maxErrorMM = Math.max(maxErrorMM, radiusMM - Math.hypot(...midpoint))
  }
  return maxErrorMM
}

function svgImportBBoxOvershootMM(): number {
  const shape: VShape = {
    paths: [{
      anchors: [
        {
          p: { x: 0, y: 0 },
          hOut: { x: 0.13, y: 2 },
          corner: false,
        },
        {
          p: { x: 1, y: 0 },
          hIn: { x: 0.91, y: -0.5 },
          corner: false,
        },
        { p: { x: 1, y: -1 }, corner: true },
        { p: { x: 0, y: -1 }, corner: true },
      ],
    }],
  }
  const fitted = fitShapeToBox(shape, 1000, 1000)
  const first = fitted.paths[0].anchors[0]
  const second = fitted.paths[0].anchors[1]
  let minY = Math.min(...fitted.paths[0].anchors.map(({ p }) => p.y))
  let maxY = Math.max(...fitted.paths[0].anchors.map(({ p }) => p.y))
  for (let i = 0; i <= 100_000; i++) {
    const point = cubicPoint(first.p, first.hOut!, second.hIn!, second.p, i / 100_000)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  const targetPx = 720
  const placementMM = 310
  return (maxY - minY - targetPx) * (placementMM / targetPx)
}

function optimalSizingTable() {
  return Object.fromEntries(
    (['square', 'circle', 'triangle', 'diamondShape'] as const).map((shape) => {
      const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
      const rungs = semanticLadder(contourAt)
      const table = rungs.map((rung) => {
        const plan = resolveGridPlan(contourAt(rung.sizeMM), {
          mode: 'standard',
          density: 'light',
          paddingMM: DEFAULT_LAW.paddingMM,
          maxGrowMM: 0,
        })
        if (rung.points >= 2 && !plan.grid.ok) {
          throw new Error(
            `${shape} ${rung.label} ${rung.sizeMM}mm publishes ${plan.grid.uncoveredMM}mm uncovered`,
          )
        }
        return {
          label: rung.label,
          sizeMM: rung.sizeMM,
          points: rung.points,
          uncoveredMM: plan.grid.uncoveredMM,
        }
      })
      return [shape, table]
    }),
  )
}

const maskPx = 100
const diameterMM = 310
const flattenErrorMM = vectorFlattenErrorMM(
  getShape('circle', maskPx, maskPx),
  diameterMM / (maskPx * 0.72),
  maskPx,
)
if (flattenErrorMM > MANUFACTURING_TOLERANCE_MM) {
  throw new Error(
    `manufacturing flatten error ${flattenErrorMM}mm exceeds ${MANUFACTURING_TOLERANCE_MM}mm`,
  )
}

const offsetSagittaMM = roundOffsetSagittaMM(70)
if (offsetSagittaMM > MANUFACTURING_TOLERANCE_MM) {
  throw new Error(
    `round-offset sagitta ${offsetSagittaMM}mm exceeds ${MANUFACTURING_TOLERANCE_MM}mm`,
  )
}

const svgImportOvershootMM = svgImportBBoxOvershootMM()
if (svgImportOvershootMM <= MANUFACTURING_TOLERANCE_MM) {
  throw new Error('SVG import bbox characterization is stale; reclassify it before clearing')
}

const optimalSizing = optimalSizingTable()

const generatorErrors = Object.fromEntries(
  (['form', 'blob', 'daisy', 'pinwheel'] as const)
    .map((kind) => [kind, generatorErrorMM(kind)]),
)
for (const [kind, errorMM] of Object.entries(generatorErrors)) {
  if (errorMM <= MANUFACTURING_TOLERANCE_MM) {
    throw new Error(`KAI-9839 ${kind} characterization is stale; reclassify it before clearing`)
  }
}

console.log(JSON.stringify({
  authorityMM: MANUFACTURING_TOLERANCE_MM,
  optimalSizing,
  dispositions: {
    manufacturingFlatten: {
      type: 'B',
      maxErrorMM: flattenErrorMM,
      outcome: 'refined against the imported physical tolerance',
    },
    circleVisualFloor: {
      type: 'B',
      minimumPoints: DEFAULT_CIRCLE_TESSELLATION_CALIBRATION.minimumPoints,
      outcome: 'same output, moved from an inline literal to named calibration',
    },
    manufacturingRoundOffset: {
      type: 'B',
      maxErrorMM: offsetSagittaMM,
      outcome: 'Clipper arc tolerance now derives from the imported physical tolerance',
    },
    proceduralGenerators: {
      type: 'C',
      followUp: 'KAI-9839',
      maxErrorMM: generatorErrors,
    },
    svgImportBBox: {
      type: 'C',
      followUp: 'KAI-9841',
      witnessOvershootMM: svgImportOvershootMM,
      mechanism: 'source-space 0.1 flatten has no physical bound for uploaded SVG units',
    },
    deepestPointSampling: {
      type: 'C',
      followUp: 'KAI-9840',
      consumer: 'single-anchor fallback only',
    },
  },
}, null, 2))
