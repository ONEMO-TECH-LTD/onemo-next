// THE CORPUS RUNNER — blueprint §1 ("runner") and §11.2: the seven real cut-outs through the
// complete solve, every centre method, operational bands 2/3, both guarded flap limits. Emits one
// JSON results file (complete families, canonically ordered by solve itself) plus a per-shape
// summary line so the run is inspectable while it goes.
//
//   npx tsx src/lib/grid-engine/runner/corpus-runner.ts <corpus.json> <out-dir>
//
// The corpus file maps shape name → traced outline points. Units cancel: solve publishes even
// millimetres via σ = m / longestSide, so a unit-normalised trace yields real manufactured sizes.
// One result file per shape, written the moment its solve completes and then released — a full
// outcome carries every family's boundary-chain evidence, and holding seven of them plus one
// combined stringify exhausted the heap on the first run.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { solve } from '../solver/solve'
import { CENTRE_METHODS } from '../solver/centres'
import type { PointMM, SolveRequest } from '../solver/contract'

const [corpusPath, outDir] = process.argv.slice(2)
if (!corpusPath || !outDir) {
  console.error('usage: corpus-runner <corpus.json> <out-dir>')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const corpus: Record<string, PointMM[]> = JSON.parse(readFileSync(corpusPath, 'utf8'))

const spec = {
  basePitchMM: 48,
  sparseFactor: 2,
  paddingMM: 12,
  positionsPerAxis: 9,
  bands: [2, 3] as const as Array<2 | 3>,
  centreMethods: [...CENTRE_METHODS],
}

// The persisted record keeps every manufactured number — size, layout, coordinates, clearances,
// binding, flap — and drops only the raw boundary-chain point lists (overhang zones' boundaries,
// extremity point runs), which are per-family copies of the traced outline: thousands of points ×
// hundreds of families made one shape's JSON string big enough to kill the process even at an 8GB
// heap. Counts and bboxes remain, so the record still says what was measured.
const compactPopulation = (p: Record<string, unknown>) => ({
  ...p,
  extremities: (p.extremities as Array<Record<string, unknown>>).map(
    ({ side, kind, sideOverhangMM }) => ({ side, kind, sideOverhangMM }),
  ),
  overhangZones: (p.overhangZones as Array<Record<string, unknown>>).map((z) => ({
    population: z.population,
    sidesCrossed: z.sidesCrossed,
    bboxMM: z.bboxMM,
    maxOverhangMM: z.maxOverhangMM,
    classification: z.classification,
    ...(z.exception !== undefined ? { exception: z.exception } : {}),
    containedExtremityCount: (z.containedExtremities as unknown[]).length,
    boundaryPointCount: (z.boundaryMM as unknown[]).length,
  })),
})

for (const [name, outline] of Object.entries(corpus)) {
  const request: SolveRequest = { outline, spec, flapLimitsMM: [12, 24] }
  const t0 = Date.now()
  const outcome = solve(request)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  const persisted =
    outcome.status !== 'solved'
      ? outcome
      : {
          ...outcome,
          families: outcome.families.map((f) => ({
            ...f,
            populations: {
              base: compactPopulation(f.populations.base as unknown as Record<string, unknown>),
              sparse: compactPopulation(f.populations.sparse as unknown as Record<string, unknown>),
            },
          })),
        }
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(persisted))
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
      `sizes ${sizes.length ? `${sizes.reduce((a, b) => Math.min(a, b))}–${sizes.reduce((a, b) => Math.max(a, b))}mm` : 'none'}, ` +
      `${optima} optimum, empty-bands ${outcome.emptyBands.length}, ${secs}s ` +
      `[${[...perMethod.entries()].map(([m, n]) => `${m}:${n}`).join(' ')}]`,
  )
}

console.log(`written: ${outDir}`)
