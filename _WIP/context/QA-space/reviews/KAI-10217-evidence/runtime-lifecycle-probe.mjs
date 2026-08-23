import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.env.CUTOUT_V1_BASE_URL
assert(baseUrl, 'CUTOUT_V1_BASE_URL must name the current-code server')
const fixture = 'public/assets/test-artwork.png'
const viewport = { width: 1280, height: 720 }
const phase = process.env.QA_LIFECYCLE_PHASE ?? 'all'

async function upload(page) {
  await page.locator('input[type=file]').first().setInputFiles(fixture)
  await page.locator('p').filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
}

async function detect(page) {
  await page.getByRole('button', { name: /Detect/ }).click()
}

async function waitForFloodFill(page, timeout) {
  await page.locator('p').filter({ hasText: /flood-fill fallback/ }).waitFor({ timeout })
  assert.equal(await page.getByRole('button', { name: /Save/ }).isDisabled(), false)
}

const browser = await chromium.launch({ headless: true })
try {
  let timeoutElapsedMs
  if (phase !== 'death') {
  const timeoutContext = await browser.newContext({ viewport })
  let releaseModel
  let modelStartedResolve
  const modelStarted = new Promise((resolve) => { modelStartedResolve = resolve })
  const modelGate = new Promise((resolve) => { releaseModel = resolve })
  await timeoutContext.route('**/seg-models/u2netp.onnx', async (route) => {
    modelStartedResolve()
    await modelGate
    try { await route.continue() } catch { /* watchdog terminated the requesting worker */ }
  })
  const timeoutPage = await timeoutContext.newPage()
  await timeoutPage.goto(new URL('/cutout-lab', baseUrl).href, { waitUntil: 'networkidle' })
  await upload(timeoutPage)
  await detect(timeoutPage)
  await modelStarted
  const timeoutStartedAt = Date.now()
  await waitForFloodFill(timeoutPage, 135_000)
  timeoutElapsedMs = Date.now() - timeoutStartedAt
  assert(timeoutElapsedMs >= 118_000, `watchdog fired too early: ${timeoutElapsedMs}ms`)
  releaseModel()
  await timeoutContext.close()
  console.log(JSON.stringify({ timeoutElapsedMs }))
  }

  let detectorWorkerUrl
  if (phase !== 'timeout') {
  const deathContext = await browser.newContext({ viewport })
  await deathContext.addInitScript(() => {
    const NativeWorker = window.Worker
    let forceOneDeath = true
    window.__qaWorkerUrls = []
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        window.__qaWorkerUrls.push(String(url))
        if (forceOneDeath && String(url).includes('ben_worker')) {
          forceOneDeath = false
          const crashUrl = URL.createObjectURL(new Blob([
            'throw new Error("qa-forced-worker-death")',
          ], { type: 'text/javascript' }))
          super(crashUrl, { type: 'module' })
          window.__qaDetectorWorkerUrl = String(url)
          return
        }
        super(url, options)
      }
    }
  })
  const deathPage = await deathContext.newPage()
  await deathPage.goto(new URL('/cutout-lab', baseUrl).href, { waitUntil: 'networkidle' })
  await upload(deathPage)
  await detect(deathPage)
  try {
    await waitForFloodFill(deathPage, 30_000)
  } catch (error) {
    console.error(JSON.stringify({
      status: await deathPage.locator('p').filter({ hasText: 'Status:' }).textContent(),
      workerUrls: await deathPage.evaluate(() => window.__qaWorkerUrls),
      detectorWorkerUrl: await deathPage.evaluate(() => window.__qaDetectorWorkerUrl),
    }))
    throw error
  }
  detectorWorkerUrl = await deathPage.evaluate(() => window.__qaDetectorWorkerUrl)
  assert(detectorWorkerUrl, 'the forced death must replace the product detector worker')
  await detect(deathPage)
  await deathPage.locator('p').filter({ hasText: /done \(cut: u2netp\)/ }).waitFor({ timeout: 180_000 })
  await deathContext.close()
  }

  console.log(JSON.stringify({ timeoutElapsedMs, workerDeathRecoveredTo: 'u2netp', detectorWorkerUrl }))
} finally {
  await browser.close()
}
