// The seven real cut-outs, put through the ACTUAL engine — bridge in, variants out.
//
// The outlines come from an independent tracer (trace-corpus.mjs: its own PNG decode, its own alpha
// mask, its own boundary walk). The engine is not consulted about them, so agreement between this
// table and anything the shell draws is evidence rather than a tautology.
//
//   node trace-corpus.mjs && npx tsx corpus.ts

import { readFileSync } from 'node:fs'
import { solveShape, flapLimits } from '../../../src/lib/grid-engine/bridge'
import { RELEASED } from '../../../src/lib/grid-engine/spec'
import type { PointMM } from '../../../src/lib/grid-engine/engine'

interface Traced {
  name: string
  sha256: string
  points: Array<[number, number]>
}

const corpus: Traced[] = JSON.parse(
  readFileSync(new URL('./corpus-outlines.json', import.meta.url), 'utf8'),
)

const [tight, lenient] = flapLimits(RELEASED)
console.log(
  `released spec: pitch ${RELEASED.grid.basePitchMM}mm · padding ${RELEASED.grid.paddingMM}mm · ` +
    `ceiling ${RELEASED.grid.positionsPerAxis}x${RELEASED.grid.positionsPerAxis} · flap switch ${tight}|${lenient}\n`,
)

let totalCandidates = 0
let totalHeld = 0
const started = process.hrtime.bigint()

for (const shape of corpus) {
  const outline = shape.points as PointMM[]
  const result = solveShape(RELEASED, outline)
  const held = result.variants.filter((v) => v.holds)
  totalCandidates += result.candidatesTested
  totalHeld += held.length

  console.log(`=== ${shape.name}  (${shape.points.length} pts, sha ${shape.sha256}) ===`)
  console.log(`    ${result.candidatesTested} grid-given candidates -> ${held.length} lawful`)
  for (const v of held) {
    const f = v.flapMM
    const worst = Math.max(f.left, f.right, f.top, f.bottom)
    const passes = worst <= tight ? `${tight}mm` : worst <= lenient ? `${lenient}mm` : 'over'
    console.log(
      `      ${v.cols}x${v.rows} @${v.pitchMM}  size ${v.bindingMM}mm binding ` +
        `(${v.widthMM.toFixed(0)}x${v.heightMM.toFixed(0)})  ${v.magnetCount} magnets  ` +
        `${v.classification}  flap ${f.left.toFixed(0)}/${f.right.toFixed(0)}/${f.top.toFixed(0)}/${f.bottom.toFixed(0)} ` +
        `spread ${v.flapSpreadMM.toFixed(0)}  coverage ${passes}`,
    )
  }
  console.log(
    `    both populations at one size: ${
      result.coupledSizesMM.length ? result.coupledSizesMM.join(', ') + 'mm' : 'NONE'
    }\n`,
  )
}

const ms = Number(process.hrtime.bigint() - started) / 1e6
console.log(
  `TOTAL: ${totalHeld} lawful variants from ${totalCandidates} candidates across seven cut-outs, ` +
    `${ms.toFixed(0)}ms (${(ms / corpus.length).toFixed(0)}ms per shape).`,
)
