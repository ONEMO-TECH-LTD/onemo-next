import { execFileSync } from 'node:child_process'

import {
  ATTACHMENTS,
  DENSITIES,
  MODES,
  PARITY_SIZES,
  PRESPLIT_COMMIT,
  PRESPLIT_ROOT,
  SHAPES,
  assertEqual,
  currentEnginePath,
  fail,
  finish,
  jsonSha256,
  loadEngine,
  preSplitEnginePath,
  type CorpusCase,
  type GridEngineModule,
} from './t1-contract'

function literalCorpus(engine: GridEngineModule): CorpusCase[] {
  const cases: CorpusCase[] = []
  for (const shape of SHAPES)
    for (const attachment of ATTACHMENTS)
      for (const density of DENSITIES)
        for (const mode of MODES)
          for (const sizeMM of PARITY_SIZES) {
            const key = [shape, attachment, density, mode, sizeMM].join('|')
            try {
              const contour = engine.stdShapeContour(shape, sizeMM)
              const plan = engine.resolveGridPlan(contour, { attachment, density, mode })
              cases.push({ key, value: JSON.stringify(plan) })
            } catch (error) {
              cases.push({
                key,
                value: `ERR:${String((error as Error)?.message ?? error)}`,
              })
            }
          }
  return cases
}

async function main(): Promise<void> {
  const preSplitHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: PRESPLIT_ROOT,
    encoding: 'utf8',
  }).trim()
  assertEqual(preSplitHead, PRESPLIT_COMMIT, 'pre-split worktree commit')

  const [current, preSplit] = await Promise.all([
    loadEngine(currentEnginePath()),
    loadEngine(preSplitEnginePath()),
  ])
  const currentCases = literalCorpus(current)
  const preSplitCases = literalCorpus(preSplit)
  assertEqual(currentCases.length, 960, 'current literal parity case count')
  assertEqual(preSplitCases.length, 960, 'pre-split literal parity case count')

  const differentKeys = currentCases
    .filter((entry, index) =>
      entry.key !== preSplitCases[index]?.key
      || entry.value !== preSplitCases[index]?.value,
    )
    .map((entry) => entry.key)
  assertEqual(differentKeys.length, 0, `literal parity differences (${differentKeys.slice(0, 10).join(', ')})`)

  const currentSha256 = jsonSha256(currentCases)
  const preSplitSha256 = jsonSha256(preSplitCases)
  assertEqual(currentSha256, preSplitSha256, 'literal parity corpus hash')
  finish('t2-literal-pre-split-parity', {
    normalisation: 'NONE',
    cases: currentCases.length,
    identical: currentCases.length,
    different: differentKeys.length,
    corpusSha256: currentSha256,
    preSplitCommit: PRESPLIT_COMMIT,
  })
}

main().catch((error) => fail('t2-literal-pre-split-parity', error))
