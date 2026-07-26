import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveCloudEndpoint } from './core/browser-provider.mjs'
import {
  assertColdWarmReport,
  formatReportTable,
} from './core/report.mjs'

const scriptRoot = join(process.cwd(), 'scripts/device-performance')

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
})
