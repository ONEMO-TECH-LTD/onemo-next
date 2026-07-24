import { createHash } from 'node:crypto'
import { cpus, platform, release } from 'node:os'
import { performance } from 'node:perf_hooks'
import { gridJsonBytes } from '../src/lib/effect/grid-byte-oracle'
import {
  DENSE_REAL_AI_GRID_CONTOUR,
  REAL_AI_GRID_CORPUS,
} from '../src/lib/effect/grid-s0-corpus'
import { resolveUserLadderRecipe, resolveUserPlanRecipe } from '../src/lib/effect/grid-user'

type ProfileName = 'canonical-ladder' | 'dense-live-plan' | 'small-contour-plan'

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) * fraction)]
}

function measuredProfile(name: ProfileName) {
  if (name === 'canonical-ladder') {
    return {
      fixture: {
        operation: 'ladder',
        recipe: { kind: 'standard', shape: 'circle' },
      },
      run: () => resolveUserLadderRecipe({ kind: 'standard', shape: 'circle' }),
    } as const
  }
  if (name === 'small-contour-plan') {
    return {
      fixture: {
        operation: 'plan',
        sourceKind: 'standard',
        shape: 'square',
        widthMM: 70,
        heightMM: 70,
        attachment: 'magnetic',
      },
      run: () => resolveUserPlanRecipe(
        { kind: 'standard', shape: 'square', widthMM: 70, heightMM: 70 },
        'magnetic',
      ),
    } as const
  }
  return {
    fixture: {
      operation: 'plan',
      sourceKind: REAL_AI_GRID_CORPUS.sourceKind,
      sourceAsset: REAL_AI_GRID_CORPUS.sourceAsset,
      simplifiedNodes: REAL_AI_GRID_CORPUS.spec.diagnostics.simplifiedNodes,
      profileNodes: DENSE_REAL_AI_GRID_CONTOUR.outer.pts.length,
      densification: '8 exact collinear segments per manufacturing edge',
      attachment: 'magnetic',
    },
    run: () => resolveUserPlanRecipe(
      { kind: 'final-contour', contourMM: DENSE_REAL_AI_GRID_CONTOUR },
      'magnetic',
    ),
  } as const
}

const requested = process.argv[2]
if (requested !== 'canonical-ladder' && requested !== 'dense-live-plan' && requested !== 'small-contour-plan') {
  throw new Error('Usage: npm run grid:profile -- canonical-ladder|dense-live-plan|small-contour-plan')
}

const profile = measuredProfile(requested)

function measure(run: () => unknown) {
  const cpuStarted = process.cpuUsage()
  const wallStarted = performance.now()
  const result = run()
  const wallMs = performance.now() - wallStarted
  const cpu = process.cpuUsage(cpuStarted)
  return {
    result,
    wallMs,
    cpuMs: (cpu.user + cpu.system) / 1000,
  }
}

const cold = measure(profile.run)
const authorityBytes = gridJsonBytes(cold.result)

const warmWallMs: number[] = []
const warmCpuMs: number[] = []
for (let index = 0; index < 5; index += 1) {
  const sample = measure(profile.run)
  const bytes = gridJsonBytes(sample.result)
  if (bytes !== authorityBytes) throw new Error(`${requested} changed between profile samples.`)
  warmWallMs.push(sample.wallMs)
  warmCpuMs.push(sample.cpuMs)
}

const report = {
  schemaVersion: 1,
  measuredAt: new Date().toISOString(),
  profile: requested,
  execution: 'same-process direct User door',
  warmSamples: 5,
  fixture: profile.fixture,
  output: {
    jsonBytes: authorityBytes.length,
    sha256: createHash('sha256').update(authorityBytes).digest('hex'),
  },
  coldTimingMs: {
    wall: cold.wallMs,
    cpu: cold.cpuMs,
  },
  warmTimingMs: {
    wallSamples: warmWallMs,
    cpuSamples: warmCpuMs,
    wallMedian: percentile(warmWallMs, 0.5),
    cpuMedian: percentile(warmCpuMs, 0.5),
    wallP95: percentile(warmWallMs, 0.95),
    cpuP95: percentile(warmCpuMs, 0.95),
  },
  runtime: {
    node: process.version,
    platform: platform(),
    release: release(),
    cpu: cpus()[0]?.model ?? 'unknown',
  },
}

console.error(JSON.stringify(report, null, 2))
