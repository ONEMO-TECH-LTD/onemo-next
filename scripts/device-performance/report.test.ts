import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DENSE_REAL_AI_GRID_CONTOUR } from '../../src/lib/effect/grid-s0-corpus'
import {
  handleGridJob,
  type GridJob,
  type GridJobResult,
  type ResolvedGridPlan,
} from '../../src/lib/effect/grid'
import { resolveCloudEndpoint } from './core/browser-provider.mjs'
import {
  assertColdWarmReport,
  formatReportTable,
} from './core/report.mjs'

const scriptRoot = join(process.cwd(), 'scripts/device-performance')

function fixtureJob(scenario: { job?: GridJob; fixture?: string }): GridJob {
  if (scenario.job) return scenario.job
  if (scenario.fixture === 'dense-real-ai-corpus') {
    return {
      operation: 'plan',
      recipe: { kind: 'final-contour', contourMM: DENSE_REAL_AI_GRID_CONTOUR },
      options: { attachment: 'magnetic', source: 'magic' },
    }
  }
  throw new Error(`Scenario has no executable input: ${JSON.stringify(scenario)}`)
}

function planT2(plan: ResolvedGridPlan) {
  const quantize = (value: number) => (Math.round(value / 0.05) * 0.05).toFixed(2)
  const nodes = plan.grid.anchors.map(({ p: [x, y], dia }) => ({
    x: quantize(x),
    y: quantize(y),
    dia,
  }))
  const edges: string[] = []
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const distance = Math.hypot(
        Number(nodes[left].x) - Number(nodes[right].x),
        Number(nodes[left].y) - Number(nodes[right].y),
      )
      if (distance <= plan.pitchMM * 1.5 + 0.05) edges.push(`${left}-${right}`)
    }
  }
  return {
    anchorCount: nodes.length,
    flapCount: plan.grid.flaps.length,
    ok: plan.grid.ok,
    pitchMM: plan.pitchMM,
    pattern: plan.pattern,
    nodes,
    edges,
  }
}

function t2ForResult(result: GridJobResult) {
  return result.operation === 'ladder'
    ? {
        rungs: result.value.map(({ label, points, sizeMM, visible }) => ({
          label,
          points,
          sizeMM,
          visible,
        })),
      }
    : planT2(result.value)
}

describe('device-performance suite contract', () => {
  it('keeps scenario selection in data and the neutral core outside feature code', () => {
    const config = JSON.parse(readFileSync(join(scriptRoot, 'suite.config.json'), 'utf8'))
    expect(config.scenarios.map(({ id }: { id: string }) => id)).toEqual([
      'canonical-ladder',
      'dense-live-plan',
      'small-contour-plan',
    ])
    expect(config.profiles).toEqual([expect.objectContaining({
      id: 'webkit-iphone-13',
      provider: 'local-playwright',
      engine: 'webkit',
    })])
    expect(config.profiles[0]).not.toHaveProperty('cpuRate')
    expect(existsSync(join(scriptRoot, 'core/cdp.mjs'))).toBe(false)
    for (const file of ['core/browser-provider.mjs', 'core/report.mjs', 'run.mjs']) {
      const source = readFileSync(join(scriptRoot, file), 'utf8')
      expect(source).not.toMatch(/src\/lib\/effect|grid-(?:user|admin|core)/)
    }
  })

  it('fails loud until Dan supplies an approved real-device cloud endpoint', () => {
    const profile = {
      id: 'cloud-webkit',
      endpointEnv: 'DEVICE_PERF_CLOUD_WS_ENDPOINT',
    }
    expect(() => resolveCloudEndpoint(profile, {})).toThrow(
      /requires DEVICE_PERF_CLOUD_WS_ENDPOINT; no paid provider is configured/,
    )
    expect(resolveCloudEndpoint(profile, {
      DEVICE_PERF_CLOUD_WS_ENDPOINT: 'wss://approved.example/playwright',
    })).toBe('wss://approved.example/playwright')
  })

  it('locks the prominent unsupported CPU-emulation verdict', () => {
    const config = JSON.parse(readFileSync(join(scriptRoot, 'suite.config.json'), 'utf8'))
    expect(config.cpuEmulation).toEqual(expect.objectContaining({
      status: 'UNSUPPORTED',
      scope: 'Web Worker engine jobs',
      observedError: 'Emulation.setCPUThrottlingRate: Operation is only supported for pages, not workers',
      officialSource: expect.stringContaining('inspector_emulation_agent.cc'),
    }))
    expect(readFileSync(join(scriptRoot, 'run.mjs'), 'utf8')).not.toMatch(
      /setCPUThrottlingRate|launchCdp|workerThrottle/,
    )
  })

  it('requires separate cold and warm timings in every row', () => {
    const valid = {
      profiles: [{
        id: 'surface',
        scenarios: [{
          id: 'scenario',
          label: 'Scenario',
          cold: { elapsedMs: 100 },
          warm: { elapsedMs: 10 },
          baselineT1Pass: true,
          t2Pass: true,
        }],
      }],
    }
    expect(() => assertColdWarmReport(valid)).not.toThrow()
    expect(() => assertColdWarmReport({
      profiles: [{
        id: 'surface',
        scenarios: [{ ...valid.profiles[0].scenarios[0], warm: null }],
      }],
    })).toThrow(/missing warm timing/)
    expect(formatReportTable(valid)).toContain('| Cold ms')
    expect(formatReportTable(valid)).toContain('| Warm ms')
  })

  it('pins every baseline to the current neutral engine and rescue-free T2 schema', () => {
    const config = JSON.parse(readFileSync(join(scriptRoot, 'suite.config.json'), 'utf8'))
    const baselines = JSON.parse(readFileSync(join(scriptRoot, 'baselines.json'), 'utf8'))

    for (const scenario of config.scenarios) {
      const result = handleGridJob(fixtureJob(scenario))
      const sha256 = createHash('sha256').update(JSON.stringify(result.value)).digest('hex')
      expect(baselines.fixtures[scenario.id], scenario.id).toEqual({
        sha256,
        t2: t2ForResult(result),
      })
      expect(JSON.stringify(baselines.fixtures[scenario.id])).not.toMatch(/rescue/)
    }
  }, 20_000)
})
