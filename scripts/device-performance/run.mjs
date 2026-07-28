import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { devices } from 'playwright'
import { createServer } from 'vite'
import { openBrowserProfile } from './core/browser-provider.mjs'
import {
  assertColdWarmReport,
  formatReportTable,
} from './core/report.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(scriptDir, '..', '..')
const config = JSON.parse(await readFile(join(scriptDir, 'suite.config.json'), 'utf8'))
const baselines = JSON.parse(await readFile(join(scriptDir, 'baselines.json'), 'utf8'))
const requestedProfile = process.env.DEVICE_PERF_PROFILE
const selectedProfiles = requestedProfile
  ? config.profiles.filter(({ id }) => id === requestedProfile)
  : config.profiles

if (!selectedProfiles.length) throw new Error(`Unknown DEVICE_PERF_PROFILE: ${requestedProfile}.`)

const vite = await createServer({
  root: repoRoot,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await vite.listen()
const fixtureBaseUrl = vite.resolvedUrls?.local?.[0]
if (!fixtureBaseUrl) throw new Error('Vite did not publish a fixture URL.')

async function withTerminationGuard(label, operation) {
  let timer
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} exceeded the 60s termination guard.`)),
          60_000,
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function runScenario(page, scenario) {
  const cold = await withTerminationGuard(`${scenario.id} cold`, page.evaluate(
    ({ scenarioId }) => window.__ONEMO_DEVICE_PERF__.run(scenarioId, 'cold'),
    { scenarioId: scenario.id },
  ))
  const warm = await withTerminationGuard(`${scenario.id} warm`, page.evaluate(
    ({ scenarioId }) => window.__ONEMO_DEVICE_PERF__.run(scenarioId, 'warm'),
    { scenarioId: scenario.id },
  ))
  const baseline = baselines.fixtures[scenario.id]
  if (!baseline) throw new Error(`Missing baseline for ${scenario.id}.`)
  return {
    id: scenario.id,
    label: scenario.label,
    cold,
    warm,
    directWorkerByteEqual: cold.directWorkerByteEqual && warm.directWorkerByteEqual,
    baselineT1Pass: cold.sha256 === baseline.sha256 && warm.sha256 === baseline.sha256,
    expectedSha256: baseline.sha256,
    t2Pass: (
      JSON.stringify(cold.t2) === JSON.stringify(baseline.t2)
      && JSON.stringify(warm.t2) === JSON.stringify(baseline.t2)
    ),
  }
}

async function runProfile(profile) {
  const descriptor = devices[profile.device]
  if (!descriptor) throw new Error(`Unknown Playwright device descriptor: ${profile.device}.`)
  let browser
  try {
    browser = await openBrowserProfile(profile)
    const context = await browser.newContext(descriptor)
    const page = await context.newPage()
    await page.goto(new URL(config.fixturePath, fixtureBaseUrl).href)
    await page.waitForFunction(() => window.__ONEMO_DEVICE_PERF__?.status === 'READY')
    const scenarios = []
    for (const scenario of config.scenarios) {
      console.error(`[device-perf] ${profile.id} · ${scenario.id}`)
      scenarios.push(await runScenario(page, scenario))
    }
    await context.close()
    return {
      id: profile.id,
      provider: profile.provider,
      engine: profile.engine,
      engineVersion: browser.version(),
      device: profile.device,
      truth: profile.truth,
      surface: new URL(config.fixturePath, fixtureBaseUrl).href,
      scenarios,
    }
  } finally {
    await browser?.close()
  }
}

try {
  const profiles = []
  for (const profile of selectedProfiles) profiles.push(await runProfile(profile))

  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    statement: 'Local WebKit verifies correctness and timing only. CPU device-class emulation is unsupported. Real-device launch truth requires the pending cloud adapter.',
    profiles,
    cpuEmulation: config.cpuEmulation,
    cloudAdapter: config.cloudAdapter,
  }
  assertColdWarmReport(report)

  const failures = profiles.flatMap((profile) => profile.scenarios.flatMap((scenario) => [
    !scenario.directWorkerByteEqual && `${profile.id}/${scenario.id}: worker differs from direct engine`,
    !scenario.t2Pass && `${profile.id}/${scenario.id}: T2 product outcome differs`,
  ].filter(Boolean)))
  const outputDir = join(repoRoot, 'output', 'playwright', 'device-performance')
  await mkdir(outputDir, { recursive: true })
  const reportJson = `${JSON.stringify(report, null, 2)}\n`
  await writeFile(join(outputDir, 'latest.json'), reportJson)
  await writeFile(join(outputDir, `report-${report.measuredAt.replaceAll(/[:.]/g, '-')}.json`), reportJson)
  console.log(formatReportTable(report))
  console.log(`\nCPU emulation: ${config.cpuEmulation.status}`)
  console.log(`Reason: ${config.cpuEmulation.observedError}`)
  console.log(`Source: ${config.cpuEmulation.officialSource}`)
  console.log(`Real-device launch truth: ${config.cloudAdapter.status}`)
  console.log(`Report: ${join(outputDir, 'latest.json')}`)
  if (failures.length) throw new Error(`Device performance suite failed:\n- ${failures.join('\n- ')}`)
} finally {
  await vite.close()
}
