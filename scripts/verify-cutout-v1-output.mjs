import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, webkit } from 'playwright'

const baseUrl = process.env.CUTOUT_V1_BASE_URL
assert(baseUrl, 'CUTOUT_V1_BASE_URL must name the already-running current-code server')
const fixturePath = resolve(process.env.CUTOUT_V1_FIXTURE ?? 'public/assets/test-artwork.png')
const fixture = readFileSync(fixturePath)
const viewport = { width: 1280, height: 720 }
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport, acceptDownloads: true })
const page = await context.newPage()
const consoleProblems = []
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`)
})

const status = page.locator('p').filter({ hasText: 'Status:' })
const saveButton = page.getByRole('button', { name: /Save/ })
const previewButton = page.getByRole('button', { name: /Preview|Editing view/ })
const canvasPixels = (targetPage) => targetPage.evaluate(async () => {
  const c = document.querySelector('canvas')
  if (!c) throw new Error('Cutout canvas missing')
  const scratch = document.createElement('canvas'); scratch.width = c.width; scratch.height = c.height
  const scratchContext = scratch.getContext('2d', { willReadFrequently: true })
  scratchContext.drawImage(c, 0, 0)
  const pixels = scratchContext.getImageData(0, 0, scratch.width, scratch.height).data
  const digest = await crypto.subtle.digest('SHA-256', pixels)
  let transparent = 0
  let opaque = 0
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] === 0) transparent += 1
    if (pixels[i] === 255) opaque += 1
  }
  return { width: c.width, height: c.height, rgbaSha256: [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join(''), transparent, opaque }
})
const pngPixels = (targetPage, bytes) => targetPage.evaluate(async (base64) => {
  const raw = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const bitmap = await createImageBitmap(new Blob([raw], { type: 'image/png' }))
  const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height
  const context = c.getContext('2d', { willReadFrequently: true })
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const pixels = context.getImageData(0, 0, c.width, c.height).data
  const digest = await crypto.subtle.digest('SHA-256', pixels)
  let transparent = 0
  let opaque = 0
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] === 0) transparent += 1
    if (pixels[i] === 255) opaque += 1
  }
  return { width: c.width, height: c.height, rgbaSha256: [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join(''), transparent, opaque }
}, bytes.toString('base64'))
const installImage = (mode) => page.evaluate((nextMode) => {
  if (!window.__cutoutNativeImage) window.__cutoutNativeImage = window.Image
  class ProbeImage {
    onload = null
    onerror = null
    set src(value) {
      if (value && nextMode === 'reject') queueMicrotask(() => this.onerror?.())
    }
  }
  Object.defineProperty(window, 'Image', { configurable: true, value: ProbeImage })
}, mode)
const restoreImage = () => page.evaluate(() => {
  Object.defineProperty(window, 'Image', { configurable: true, value: window.__cutoutNativeImage })
})

let chromiumResult
try {
  await page.goto(new URL('/cutout-lab?admin=1', baseUrl).href, { waitUntil: 'networkidle' })
  await page.locator('input[type=file]').first().setInputFiles(fixturePath)
  await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /Detect/ }).click()
  await status.filter({ hasText: /done \(cut: u2netp\)/ }).waitFor({ timeout: 180_000 })
  await page.getByRole('button', { name: /Vector/ }).click()
  await page.locator('input[type=number]').fill('25')
  await page.waitForTimeout(500)

  await previewButton.click()
  await status.filter({ hasText: /preview ready/ }).waitFor({ timeout: 60_000 })
  await page.getByText('Preview — same result, cut out').waitFor()
  const preview = await canvasPixels(page)
  assert(preview.transparent > 0 && preview.opaque > 0, 'Preview must contain real transparent cutout pixels')
  if (process.env.CUTOUT_V1_EVIDENCE) await page.screenshot({ path: process.env.CUTOUT_V1_EVIDENCE, fullPage: true })
  const pendingDownload = page.waitForEvent('download', { timeout: 60_000 })
  await saveButton.click()
  const download = await pendingDownload
  const saved = await pngPixels(page, readFileSync(await download.path()))
  assert.deepEqual(saved, preview, 'Preview and Save must share exact original-resolution RGBA pixels and dimensions')

  await previewButton.click()
  await page.getByText('Live result — dimmed outside the shape').waitFor()
  await page.getByRole('button', { name: /Blend/ }).click()
  if (process.env.CUTOUT_V1_CONTROLS_EVIDENCE) await page.screenshot({ path: process.env.CUTOUT_V1_CONTROLS_EVIDENCE, fullPage: true })
  await page.locator('input[type=number]').fill('25')
  await page.waitForTimeout(1_000)
  const beforeFailure = await canvasPixels(page)

  await installImage('reject')
  await previewButton.click()
  await status.filter({ hasText: /preview failed.*SVG-filter image failed to load/ }).waitFor({ timeout: 30_000 })
  assert.match(await previewButton.textContent(), /Preview/, 'failed Preview must stay in editing mode')
  await page.getByText('Live result — dimmed outside the shape').waitFor()
  assert.deepEqual(await canvasPixels(page), beforeFailure, 'failed Preview must not replace display pixels with a substitute')
  await restoreImage()

  await page.evaluate(() => {
    window.__cutoutNativeToBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback) { callback(null) }
  })
  await saveButton.click()
  await status.filter({ hasText: /Save failed: PNG encoding failed/ }).waitFor({ timeout: 60_000 })
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = window.__cutoutNativeToBlob })

  await installImage('hang')
  await previewButton.click()
  await status.filter({ hasText: /preparing original-resolution preview/ }).waitFor()
  await restoreImage()
  await page.locator('input[type=file]').first().setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: fixture })
  await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
  await page.waitForTimeout(100)
  assert.match(await previewButton.textContent(), /Preview/, 'replacement must cancel pending Preview and remain in editing mode')
  assert.equal(await saveButton.isDisabled(), true, 'replacement must receive no stale full output')

  assert.deepEqual(consoleProblems, [], 'output journey must have no console errors or warnings')
  chromiumResult = { preview, saved, failedPreviewPreservedDisplay: true, visibleSaveFailure: true, cancelledPreviewSettled: true }
} finally {
  await context.close()
  await browser.close()
}

const webkitBrowser = await webkit.launch({ headless: true })
const webkitContext = await webkitBrowser.newContext({ viewport, acceptDownloads: true })
const webkitPage = await webkitContext.newPage()
const webkitProblems = []
webkitPage.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') webkitProblems.push(`${message.type()}: ${message.text()}`)
})
let webkitResult
try {
  const webkitStatus = webkitPage.locator('p').filter({ hasText: 'Status:' })
  await webkitPage.goto(new URL('/cutout-lab?admin=1', baseUrl).href, { waitUntil: 'networkidle' })
  await webkitPage.locator('input[type=file]').first().setInputFiles(fixturePath)
  await webkitStatus.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
  await webkitPage.getByRole('button', { name: /Detect/ }).click()
  await webkitStatus.filter({ hasText: /done \(cut: u2netp\)/ }).waitFor({ timeout: 180_000 })
  await webkitPage.getByRole('button', { name: /Vector/ }).click()
  await webkitPage.locator('input[type=number]').fill('25')
  await webkitPage.waitForTimeout(500)
  await webkitPage.evaluate(() => {
    const view = document.querySelector('canvas')
    const nativeDrawImage = CanvasRenderingContext2D.prototype.drawImage
    const nativeToBlob = HTMLCanvasElement.prototype.toBlob
    window.__cutoutNativeDrawImage = nativeDrawImage
    window.__cutoutNativeToBlob = nativeToBlob
    window.__cutoutPreviewSource = null
    window.__cutoutSaveUsedPreviewSource = false
    CanvasRenderingContext2D.prototype.drawImage = function drawImage(...args) {
      if (this.canvas === view && args[0] instanceof HTMLCanvasElement) window.__cutoutPreviewSource = args[0]
      return nativeDrawImage.apply(this, args)
    }
    HTMLCanvasElement.prototype.toBlob = function toBlob(...args) {
      if (this === window.__cutoutPreviewSource) window.__cutoutSaveUsedPreviewSource = true
      return nativeToBlob.apply(this, args)
    }
  })
  const webkitPreviewButton = webkitPage.getByRole('button', { name: /Preview|Editing view/ })
  await webkitPreviewButton.click()
  await webkitStatus.filter({ hasText: /preview ready/ }).waitFor({ timeout: 60_000 })
  await webkitPage.getByText('Preview — same result, cut out').waitFor()
  const pendingDownload = webkitPage.waitForEvent('download', { timeout: 60_000 })
  await webkitPage.getByRole('button', { name: /Save/ }).click()
  const download = await pendingDownload
  const decoderBrowser = await chromium.launch({ headless: true })
  const decoderPage = await decoderBrowser.newPage()
  let saved
  try {
    await decoderPage.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    saved = await pngPixels(decoderPage, readFileSync(await download.path()))
  } finally {
    await decoderBrowser.close()
  }
  const sourceWitness = await webkitPage.evaluate(() => {
    const view = document.querySelector('canvas')
    const source = window.__cutoutPreviewSource
    const result = {
      sameCanvas: window.__cutoutSaveUsedPreviewSource,
      viewWidth: view?.width ?? 0,
      viewHeight: view?.height ?? 0,
      sourceWidth: source?.width ?? 0,
      sourceHeight: source?.height ?? 0,
    }
    CanvasRenderingContext2D.prototype.drawImage = window.__cutoutNativeDrawImage
    HTMLCanvasElement.prototype.toBlob = window.__cutoutNativeToBlob
    return result
  })
  assert.equal(sourceWitness.sameCanvas, true, 'WebKit Preview and Save must use the same original-resolution output canvas')
  assert.deepEqual(
    { width: sourceWitness.viewWidth, height: sourceWitness.viewHeight },
    { width: saved.width, height: saved.height },
    'WebKit visible Preview dimensions must equal the saved PNG dimensions',
  )
  assert.deepEqual(
    { width: sourceWitness.sourceWidth, height: sourceWitness.sourceHeight },
    { width: saved.width, height: saved.height },
    'WebKit shared Preview/Save source dimensions must equal the saved PNG dimensions',
  )
  assert(saved.transparent > 0 && saved.opaque > 0, 'WebKit shared Preview/Save output must contain real transparent cutout pixels')
  assert.deepEqual(webkitProblems, [], 'WebKit output journey must have no console errors or warnings')
  webkitResult = { sourceWitness, saved }
} finally {
  await webkitContext.close()
  await webkitBrowser.close()
}

console.log(JSON.stringify({ viewport, chromium: chromiumResult, webkit: webkitResult }))
