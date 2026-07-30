import {
  DEFAULT_LAW,
  computeGrid,
  resolveGridPlan,
  semanticLadder,
  stdShapeContour,
} from '../../src/lib/effect/grid'
const SHAPES = ['square', 'circle', 'triangle', 'diamondShape'] as const
const RUNG_INSET_MM = DEFAULT_LAW.paddingMM + DEFAULT_LAW.frameMM

let constructionIdentityMismatch = 0
let constructionMismatch = 0
let offLatticeExtent = 0
let visibleRungs = 0

for (const shape of SHAPES) {
  const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
  const rungs = semanticLadder(contourAt, DEFAULT_LAW, 'auto')
  for (const rung of rungs.filter(({ visible }) => visible)) {
    visibleRungs++
    const plan = resolveGridPlan(contourAt(rung.sizeMM), {
      mode: 'auto',
      density: 'light',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
      construction: rung.construction,
    })
    const [[ax, ay], [bx, by]] = rung.construction.basisMM
    const constructedPoints = rung.construction.population.map(([first, second]) => [
      rung.construction.originMM[0] + first * ax + second * bx,
      rung.construction.originMM[1] + first * ay + second * by,
    ])
    const a1 = JSON.stringify(plan.grid.anchors.map(({ p }) => p))
      !== JSON.stringify(constructedPoints)
    const a2 = plan.grid.anchors.length !== rung.points
    const pitchMM = plan.pitchMM || 48
    const xs = plan.grid.anchors.map(({ p }) => p[0])
    const ys = plan.grid.anchors.map(({ p }) => p[1])
    const deliveredExtentMM = plan.grid.anchors.length
      ? Math.max(
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys),
        ) + 2 * RUNG_INSET_MM
      : 0
    const latticeSpanMM = rung.gridExtentMM - 2 * RUNG_INSET_MM
    const remainderMM = latticeSpanMM <= 0 ? 0 : latticeSpanMM % pitchMM
    const a3 = latticeSpanMM > 0
      && Math.abs(remainderMM) >= 0.5
      && Math.abs(remainderMM - pitchMM) >= 0.5

    if (a1) constructionIdentityMismatch++
    if (a2) constructionMismatch++
    if (a3) offLatticeExtent++
    console.log([
      shape,
      rung.label,
      rung.sizeMM,
      rung.gridExtentMM,
      rung.points,
      plan.pattern,
      plan.pitchMM,
      plan.grid.anchors.length,
      deliveredExtentMM,
      a1 ? 'A1' : '-',
      a2 ? 'A2' : '-',
      a3 ? 'A3' : '-',
    ].join('\t'))
    if (process.argv.includes('--anchors')) {
      console.log(JSON.stringify(plan.grid.anchors.map(({ p }) => p)))
    }
    if (process.argv.includes('--sizing')) {
      for (const pitchMM of [48, 96] as const) {
        const grid = computeGrid(contourAt(rung.sizeMM), {
          pitchMM,
          pattern: 'standard',
          paddingMM: RUNG_INSET_MM,
          perimeterOnly: true,
        })
        const gridXs = grid.anchors.map(({ p }) => p[0])
        const gridYs = grid.anchors.map(({ p }) => p[1])
        const extentMM = grid.anchors.length
          ? Math.max(
              Math.max(...gridXs) - Math.min(...gridXs),
              Math.max(...gridYs) - Math.min(...gridYs),
            ) + 2 * RUNG_INSET_MM
          : 0
        console.log(JSON.stringify({
          pitchMM,
          points: grid.anchors.length,
          extentMM,
          uncoveredMM: grid.uncoveredMM,
          anchors: grid.anchors.map(({ p }) => p),
        }))
        const belowGrid = computeGrid(contourAt(rung.sizeMM - 1), {
          pitchMM,
          pattern: 'standard',
          paddingMM: RUNG_INSET_MM,
          perimeterOnly: true,
        })
        console.log(JSON.stringify({
          belowPitchMM: pitchMM,
          belowPoints: belowGrid.anchors.length,
          belowUncoveredMM: belowGrid.uncoveredMM,
          belowAnchors: belowGrid.anchors.map(({ p }) => p),
        }))
        const lightGrid = computeGrid(contourAt(rung.sizeMM), {
          pitchMM,
          pattern: 'standard',
          paddingMM: RUNG_INSET_MM,
          perimeterOnly: true,
          sparseThin: true,
        })
        console.log(JSON.stringify({
          lightPitchMM: pitchMM,
          lightPoints: lightGrid.anchors.length,
          lightUncoveredMM: lightGrid.uncoveredMM,
          lightAnchors: lightGrid.anchors.map(({ p }) => p),
        }))
      }
    }
  }
}

console.log(JSON.stringify({
  visibleRungs,
  constructionIdentityMismatch,
  constructionMismatch,
  offLatticeExtent,
}, null, 2))

if (process.argv.includes('--verify')) {
  if (constructionIdentityMismatch || constructionMismatch || offLatticeExtent) {
    throw new Error(
      `Solver acceptance RED: A1=${constructionIdentityMismatch}, A2=${constructionMismatch}, A3=${offLatticeExtent}.`,
    )
  }
}

if (process.argv.includes('--monotonic')) {
  for (const shape of SHAPES) {
    const rungs = semanticLadder((sizeMM) => stdShapeContour(shape, sizeMM))
    const decreases: string[] = []
    for (let index = 1; index < rungs.length; index++) {
      if (rungs[index].gridExtentMM <= rungs[index - 1].gridExtentMM) {
        decreases.push(
          `${rungs[index - 1].sizeMM}:${rungs[index - 1].gridExtentMM}`
          + `->${rungs[index].sizeMM}:${rungs[index].gridExtentMM}`,
        )
      }
    }
    console.log(`MONOTONIC\t${shape}\t${decreases.length ? decreases.join(',') : 'yes'}`)
  }
}
