import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, webkit } from 'playwright'

const baseUrl = process.env.CUTOUT_V1_BASE_URL
assert(baseUrl, 'CUTOUT_V1_BASE_URL must name the already-running current-code server')

const fixturePath = resolve(process.env.CUTOUT_V1_FIXTURE ?? 'public/assets/test-artwork.png')
const fixture = readFileSync(fixturePath)
const viewport = { width: 1280, height: 720 }

async function upload(page, file = fixturePath) {
  await page.locator('input[type=file]').first().setInputFiles(file)
  await page.locator('p').filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
}

async function runBrowser(browserType) {
  const browser = await browserType.launch({ headless: true })
  const browserName = browserType.name()
  const modelRequests = []

  try {
    const context = await browser.newContext({ viewport })
    context.on('request', (request) => {
      if (request.url().includes('/seg-models/')) modelRequests.push(request.url())
    })

    let releasePrimary
    let primaryStartedResolve
    let primaryFinishedResolve
    const primaryStarted = new Promise((resolveStarted) => { primaryStartedResolve = resolveStarted })
    const primaryFinished = new Promise((resolveFinished) => { primaryFinishedResolve = resolveFinished })
    const primaryGate = new Promise((release) => { releasePrimary = release })
    const holdPrimary = async (route) => {
      primaryStartedResolve()
      await primaryGate
      try { await route.continue() } catch { /* replacement terminated the requesting worker */ }
      primaryFinishedResolve()
    }
    await context.route('**/seg-models/u2netp.onnx', holdPrimary)

    const page = await context.newPage()
    await page.goto(new URL('/cutout-lab?seg=ben2', baseUrl).href, { waitUntil: 'networkidle' })
    assert.equal(modelRequests.length, 0, `${browserName}: mount must not preload detector models`)
    await upload(page)
    assert.equal(modelRequests.length, 0, `${browserName}: upload must not preload detector models`)

    await page.getByRole('button', { name: /Detect/ }).click()
    await primaryStarted
    assert(modelRequests[0]?.endsWith('/seg-models/u2netp.onnx'), `${browserName}: stale ?seg must not replace the production primary`)

    await upload(page, { name: 'replacement.png', mimeType: 'image/png', buffer: fixture })
    assert.equal(await page.getByRole('button', { name: /Save/ }).isDisabled(), true, `${browserName}: replacement must invalidate the pending cut`)
    releasePrimary()
    await primaryFinished
    await page.waitForTimeout(1_000)
    assert.match(await page.locator('p').filter({ hasText: 'Status:' }).textContent(), /image ready/, `${browserName}: the replaced request must not publish stale output`)

    await context.unroute('**/seg-models/u2netp.onnx', holdPrimary)
    await page.getByRole('button', { name: /Detect/ }).click()
    await page.locator('p').filter({ hasText: /done \(cut: u2netp\)/ }).waitFor({ timeout: 180_000 })
    assert.equal(await page.getByRole('button', { name: /Save/ }).isDisabled(), false, `${browserName}: a clean request after cancellation must complete`)
    await page.getByRole('button', { name: /Clear/ }).click()
    await page.locator('p').filter({ hasText: /cleared/ }).waitFor()
    assert.equal(await page.getByRole('button', { name: /Save/ }).isDisabled(), true, `${browserName}: Clear must invalidate detector-derived output`)
    await context.close()

    const unmountContext = await browser.newContext({ viewport })
    let releaseUnmount
    let unmountStartedResolve
    let unmountFinishedResolve
    const unmountStarted = new Promise((resolveStarted) => { unmountStartedResolve = resolveStarted })
    const unmountFinished = new Promise((resolveFinished) => { unmountFinishedResolve = resolveFinished })
    const unmountGate = new Promise((release) => { releaseUnmount = release })
    await unmountContext.route('**/seg-models/u2netp.onnx', async (route) => {
      unmountStartedResolve()
      await unmountGate
      try { await route.continue() } catch { /* unmount terminated the requesting worker */ }
      unmountFinishedResolve()
    })
    const unmountPage = await unmountContext.newPage()
    await unmountPage.goto(new URL('/cutout-lab', baseUrl).href, { waitUntil: 'networkidle' })
    await upload(unmountPage)
    await unmountPage.getByRole('button', { name: /Detect/ }).click()
    await unmountStarted
    await unmountPage.goto('about:blank')
    releaseUnmount()
    await unmountFinished
    await unmountContext.close()

    const fallbackRequests = []
    const fallbackContext = await browser.newContext({ viewport })
    fallbackContext.on('request', (request) => {
      if (request.url().includes('/seg-models/')) fallbackRequests.push(request.url())
    })
    await fallbackContext.route('**/seg-models/u2netp.onnx', (route) => route.abort('failed'))
    await fallbackContext.route('**/seg-models/silueta.onnx', (route) => route.abort('failed'))
    const fallbackPage = await fallbackContext.newPage()
    await fallbackPage.goto(new URL('/cutout-lab', baseUrl).href, { waitUntil: 'networkidle' })
    await upload(fallbackPage)
    await fallbackPage.getByRole('button', { name: /Detect/ }).click()
    await fallbackPage.locator('p').filter({ hasText: /flood-fill fallback/ }).waitFor({ timeout: 180_000 })
    assert.deepEqual(
      fallbackRequests.map((url) => new URL(url).pathname),
      ['/seg-models/u2netp.onnx', '/seg-models/silueta.onnx'],
      `${browserName}: fallback must exhaust the fixed model chain in order`,
    )
    assert.equal(await fallbackPage.getByRole('button', { name: /Save/ }).isDisabled(), false, `${browserName}: visible flood-fill must remain a usable degraded cut`)
    await fallbackContext.close()

    const forbidden = [...modelRequests, ...fallbackRequests].filter((url) => /huggingface|transformers|xenova|edge.?sam/i.test(url))
    assert.deepEqual(forbidden, [], `${browserName}: detector traffic must stay inside the self-hosted production chain`)
    return { browserName, modelRequests: modelRequests.length, fallbackOrder: fallbackRequests.map((url) => new URL(url).pathname) }
  } finally {
    await browser.close()
  }
}

const results = []
for (const browserType of [chromium, webkit]) results.push(await runBrowser(browserType))
console.log(JSON.stringify({ viewport, results }))
