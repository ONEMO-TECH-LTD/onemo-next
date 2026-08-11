// THE CORPUS RUNNER — blueprint §1 ("runner") and §11.2: the seven real cut-outs through the
// complete solve, every centre method, operational bands 2/3, both guarded flap limits. Emits one
// JSON results file (complete families, canonically ordered by solve itself) plus a per-shape
// summary line so the run is inspectable while it goes.
//
//   npx tsx src/lib/grid-engine/runner/corpus-runner.ts <corpus.json> <out.json>
//
// The corpus file maps shape name → traced outline points. Units cancel: solve publishes even
// millimetres via σ = m / longestSide, so a unit-normalised trace yields real manufactured sizes.

import { readFileSync, writeFileSync } from 'node:fs'
import { solve } from '../solver/solve'
import { CENTRE_METHODS } from '../solver/centres'
import type { PointMM, SolveRequest } from '../solver/contract'

const [corpusPath, outPath] = process.argv.slice(2)
if (!corpusPath || !outPath) {
  console.error('usage: corpus-runner <corpus.json> <out.json>')
  process.exit(1)
}

const corpus: Record<string, PointMM[]> = JSON.parse(readFileSync(corpusPath, 'utf8'))

const spec = {
  basePitchMM: 48,
  sparseFactor: 2,
  paddingMM: 12,
  positionsPerAxis: 9,
  bands: [2, 3] as const as Array<2 | 3>,
  centreMethods: [...CENTRE_METHODS],
}

const results: Record<string, unknown> = {}
for (const [name, outline] of Object.entries(corpus)) {
  const request: SolveRequest = { outline, spec, flapLimitsMM: [12, 24] }
  const t0 = Date.now()
  const outcome = solve(request)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  results[name] = outcome
  if (outcome.status !== 'solved') {
    console.log(`${name}: ${outcome.status} (${secs}s)`)
    continue
  }
  const perBand = new Map<number, number>()
  const perMethod = new Map<string, number>()
  for (const f of outcome.families) {
    perBand.set(f.band, (perBand.get(f.band) ?? 0) + 1)
    perMethod.set(f.centreMethod, (perMethod.get(f.centreMethod) ?? 0) + 1)
  }
  const sizes = outcome.families.map((f) => f.publishedEvenMM)
  const optima = outcome.families.filter((f) => f.classification === 'optimum').length
  console.log(
    `${name}: ${outcome.families.length} families (b2 ${perBand.get(2) ?? 0} / b3 ${perBand.get(3) ?? 0}), ` +
      `sizes ${sizes.length ? `${Math.min(...sizes)}–${Math.max(...sizes)}mm` : 'none'}, ` +
      `${optima} optimum, empty-bands ${outcome.emptyBands.length}, ${secs}s ` +
      `[${[...perMethod.entries()].map(([m, n]) => `${m}:${n}`).join(' ')}]`,
  )
}

writeFileSync(outPath, JSON.stringify(results))
console.log(`written: ${outPath}`)
