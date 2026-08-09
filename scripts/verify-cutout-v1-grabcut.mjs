import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium, webkit } from 'playwright'

const baseUrl = process.env.CUTOUT_V1_BASE_URL
assert(baseUrl, 'CUTOUT_V1_BASE_URL must name the already-running current-code server')

const fixturePath = resolve(process.env.CUTOUT_V1_FIXTURE ?? 'public/assets/test-artwork.png')
const fixture = readFileSync(fixturePath)
const fixtureUrl = `data:image/png;base64,${fixture.toString('base64')}`
const providerPath = resolve('node_modules/@techstark/opencv-js/dist/opencv.js')
const providerSource = readFileSync(providerPath)
assert.equal(providerSource.length, 13_298_869, 'retained OpenCV provider bytes changed')
assert.equal(createHash('sha256').update(providerSource).digest('hex'), 'b873c8211421da7b9bf41ae157a923f05a46a0b8d3e5904c44c6f3ad6d39a1bd', 'retained OpenCV provider changed')
const chunksDir = resolve('.next/static/chunks')
const builtProviderChunk = readdirSync(chunksDir).find((name) => name.endsWith('.js') && readFileSync(join(chunksDir, name), 'utf8').includes('opencv-js'))
assert(builtProviderChunk, 'production build must contain one identifiable OpenCV chunk')
const isProviderRequest = (url) => /opencv/i.test(url) || new URL(url).pathname.endsWith(`/${builtProviderChunk}`)

const temp = mkdtempSync(join(tmpdir(), 'cutout-v1-grabcut-'))
const entry = join(temp, 'entry.ts')
const shim = join(temp, 'opencv-shim.ts')
const grabcutBundle = join(temp, 'grabcut.js')
const providerBundle = join(temp, 'opencv.js')
writeFileSync(entry, "export { grabCutRefine } from '@/lib/cutout-grabcut'\nexport { featherMask } from '@/lib/effect/mask'\nexport { finishMLResultEdges } from '@/lib/effect/segment-ml'\n")
writeFileSync(shim, 'export default (globalThis).__cvResolved\n')
execFileSync(resolve('node_modules/.bin/esbuild'), [
  entry, '--bundle', '--platform=browser', '--format=iife', '--global-name=GrabCutProbe',
  '--external:fs', '--external:crypto', `--alias:@techstark/opencv-js=${shim}`,
  `--alias:@=${resolve('src')}`, `--outfile=${grabcutBundle}`,
])
execFileSync(resolve('node_modules/.bin/esbuild'), [
  providerPath, '--bundle', '--platform=browser', '--format=iife', '--global-name=OpenCvModule',
  '--external:fs', '--external:crypto', `--outfile=${providerBundle}`,
])

const provider = readFileSync(providerBundle)
const providerGzip = gzipSync(provider)
const server = createServer((request, response) => {
  if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end('<!doctype html><html><body></body></html>')
    return
  }
  if (request.url === '/opencv.js') {
    response.writeHead(200, {
      'Cache-Control': 'no-store', 'Content-Encoding': 'gzip',
      'Content-Length': providerGzip.length, 'Content-Type': 'text/javascript',
    })
    response.end(providerGzip)
    return
  }
  response.writeHead(404).end()
})
await new Promise((settle) => server.listen(0, '127.0.0.1', settle))
const providerUrl = `http://127.0.0.1:${server.address().port}/opencv.js`
const viewport = { width: 1280, height: 720 }

const rawExpected = [
  ['standalone', 85_116, '24bbd40cf116cd5b1212a311272a1d6d02cb59926e44ce6f7a95268071a9b5ec'],
  ['refine-add', 91_633, '626749d204cd55537f0a366076dfd379a9cc6881d62a634c120a2326fcd7a254'],
  ['refine-erase', 85_116, '24bbd40cf116cd5b1212a311272a1d6d02cb59926e44ce6f7a95268071a9b5ec'],
  ['standalone-repeat', 86_220, '715a7d76b01d7c6289fda9b677ab869ac415540cdeecaf172f2ec4f70def7980'],
]
const finishedExpected = {
  grabcut: {
    sourceSha256: 'a8939efe687c90a18311925c4211dd68a8291877956f94485d072143ec47ff78',
    sourceAfterSha256: 'a8939efe687c90a18311925c4211dd68a8291877956f94485d072143ec47ff78',
    finishedSha256: '3449afa41c3f3086c08e43498e30897969f9049fe706d5a4fe0d4448ef1c6bbd',
    intermediatePixels: 21_788,
  },
  u2net: {
    sourceSha256: '4a72924c9c7e9b03c45314bf9b75230cb0d38fce5145e1008b31e2facd140fb7',
    sourceAfterSha256: '4a72924c9c7e9b03c45314bf9b75230cb0d38fce5145e1008b31e2facd140fb7',
    finishedSha256: 'f1d1785e1482f01582cdcadcbb935f1878dd4ae6f01a7d05806e49616d046dd4',
    intermediatePixels: 28_852,
  },
}
const routeExpected = {
  chromium: { width: 1263, height: 443, colorType: 6, sha256: '2a6bf8c18c27237dd46e43065648fcb3161c6143b73c77588867613ad73b1827' },
  webkit: { width: 1263, height: 443, colorType: 6, sha256: '824c2ff14aa03b55dfcefe8fa87063b115ccd3ca3c252e2b8db35ab49f60b75f' },
}
const originalRouteExpected = {
  chromium: { width: 1683, height: 591, colorType: 6, sha256: 'a76410cb6b7d04f08ae23b6de0e58b2780a70b9ff99a86997dae4582b5e0339f' },
  webkit: { width: 1684, height: 590, colorType: 6, sha256: 'd6b735de5372613eaf6d0c0ffe190b634e5e3c3fbc65c39b3a5e779f7f493b86' },
}

const pngInfo = (bytes) => ({
  width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25],
  sha256: createHash('sha256').update(bytes).digest('hex'),
})
const draw = async (page, points, steps) => {
  await page.mouse.move(points[0].x, points[0].y)
  await page.mouse.down()
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps })
  await page.mouse.up()
}

async function runBrowser(browserType) {
  const browserName = browserType.name()
  const browser = await browserType.launch({ headless: true })
  try {
    // Direct production-module proof: scratch+erase must settle without a provider, allocation, or request.
    const scratchPage = await browser.newPage({ viewport })
    await scratchPage.goto(providerUrl.replace('/opencv.js', '/'))
    await scratchPage.addScriptTag({ path: grabcutBundle })
    const scratch = await scratchPage.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024
      const mask = await GrabCutProbe.grabCutRefine(canvas, null, [{ x: 500, y: 500 }], 24, true)
      const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', mask.data))]
        .map((value) => value.toString(16).padStart(2, '0')).join('')
      return { area: mask.data.reduce((sum, value) => sum + (value ? 1 : 0), 0), sha256, w: mask.w, h: mask.h }
    })
    assert.deepEqual(scratch, { area: 0, sha256: '30e14955ebf1352266dc2ff8067e68104607e750abb9d3b36582b8af909fcb58', w: 1024, h: 1024 }, `${browserName}: scratch+erase must return the empty mask before OpenCV`)
    assert.equal((await scratchPage.evaluate((url) => performance.getEntriesByName(url).length, providerUrl)), 0, `${browserName}: scratch+erase must not request OpenCV`)
    await scratchPage.close()

    // Load the sole retained provider, then invoke the real production module and freeze raw masks
    // plus the common MLResult edge finish used after both non-AI and u2net segmentation.
    const page = await browser.newPage({ viewport })
    await page.addInitScript(() => {
      window.__wasmMemories = []
      const instantiate = WebAssembly.instantiate.bind(WebAssembly)
      WebAssembly.instantiate = async (...args) => {
        const result = await instantiate(...args)
        const instance = result?.instance ?? result
        for (const value of Object.values(instance?.exports ?? {})) {
          if (value instanceof WebAssembly.Memory && !window.__wasmMemories.includes(value)) window.__wasmMemories.push(value)
        }
        return result
      }
    })
    await page.goto(providerUrl.replace('/opencv.js', '/'))
    const providerLoad = await page.evaluate(async (url) => {
      let previous = performance.now(), maxFrameGapMs = 0, active = true
      const frame = (now) => { if (active) { maxFrameGapMs = Math.max(maxFrameGapMs, now - previous); previous = now; requestAnimationFrame(frame) } }
      requestAnimationFrame(frame)
      const started = performance.now()
      const script = document.createElement('script'); script.src = url
      await new Promise((settle, reject) => { script.onload = settle; script.onerror = reject; document.head.append(script) })
      let cv = window.OpenCvModule?.default ?? window.OpenCvModule
      if (typeof cv === 'function' && !cv.Mat) cv = cv()
      window.__cvResolved = await cv
      const elapsedMs = performance.now() - started
      await new Promise((settle) => requestAnimationFrame(settle)); active = false
      return { elapsedMs, maxFrameGapMs, heapBytes: performance.memory?.usedJSHeapSize ?? null, wasmBytes: window.__wasmMemories.reduce((sum, memory) => sum + memory.buffer.byteLength, 0) }
    }, providerUrl)
    assert(providerLoad.elapsedMs < 5_000, `${browserName}: provider load left the current practical envelope`)
    assert.equal(providerLoad.wasmBytes, 134_217_728, `${browserName}: retained provider WASM memory changed`)
    await page.addScriptTag({ path: grabcutBundle })
    const masks = await page.evaluate(async (fixtureUrl) => {
      const image = new Image(); image.src = fixtureUrl; await image.decode()
      const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight))
      const w = Math.round(image.naturalWidth * scale), h = Math.round(image.naturalHeight * scale)
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0, w, h)
      const hash = async (data) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map((value) => value.toString(16).padStart(2, '0')).join('')
      const area = (mask) => mask.data.reduce((sum, value) => sum + (value ? 1 : 0), 0)
      const measure = async (label, op) => { const started = performance.now(); const mask = await op(); return { label, elapsedMs: performance.now() - started, area: area(mask), sha256: await hash(mask.data), mask } }
      const stroke = [{ x: w * 0.43, y: h * 0.47 }, { x: w * 0.51, y: h * 0.51 }, { x: w * 0.58, y: h * 0.54 }]
      const standalone = await measure('standalone', () => GrabCutProbe.grabCutRefine(canvas, null, stroke, w * 0.025, false))
      const refineAdd = await measure('refine-add', () => GrabCutProbe.grabCutRefine(canvas, standalone.mask, [{ x: w * 0.59, y: h * 0.45 }, { x: w * 0.64, y: h * 0.47 }], w * 0.02, false))
      const refineErase = await measure('refine-erase', () => GrabCutProbe.grabCutRefine(canvas, standalone.mask, [{ x: w * 0.42, y: h * 0.67 }, { x: w * 0.48, y: h * 0.68 }], w * 0.018, true))
      const repeat = await measure('standalone-repeat', () => GrabCutProbe.grabCutRefine(canvas, null, stroke, w * 0.025, false))
      const finish = async (mask, alpha, adapterId) => {
        const texImage = new ImageData(mask.w, mask.h)
        for (let i = 0; i < alpha.length; i++) {
          texImage.data[i * 4] = 40
          texImage.data[i * 4 + 1] = 80
          texImage.data[i * 4 + 2] = 120
          texImage.data[i * 4 + 3] = alpha[i]
        }
        const source = {
          mask: mask.data, width: mask.w, height: mask.h, imageData: texImage,
          texImage, texMask: mask.data, texW: mask.w, texH: mask.h, adapterId,
        }
        const sourceSha256 = await hash(alpha)
        const finished = GrabCutProbe.finishMLResultEdges(source, 3)
        const finishedAlpha = new Uint8Array(alpha.length)
        for (let i = 0; i < finishedAlpha.length; i++) finishedAlpha[i] = finished.texImage.data[i * 4 + 3]
        return {
          sourceSha256,
          sourceAfterSha256: await hash(alpha),
          finishedSha256: await hash(finishedAlpha),
          intermediatePixels: finishedAlpha.reduce((sum, value) => sum + (value > 0 && value < 255 ? 1 : 0), 0),
        }
      }
      const grabCutAlpha = standalone.mask.data.map((value) => value ? 255 : 0)
      const u2netAlpha = GrabCutProbe.featherMask(standalone.mask.data, standalone.mask.w, standalone.mask.h, 1)
      const results = [standalone, refineAdd, refineErase, repeat].map((result) => ({ label: result.label, elapsedMs: result.elapsedMs, area: result.area, sha256: result.sha256 }))
      return {
        results,
        finished: {
          grabcut: await finish(standalone.mask, grabCutAlpha, 'grabcut'),
          u2net: await finish(standalone.mask, u2netAlpha, 'u2netp'),
        },
      }
    }, fixtureUrl)
    assert.deepEqual(masks.results.map(({ label, area, sha256 }) => [label, area, sha256]), rawExpected, `${browserName}: raw GrabCut masks changed`)
    assert(masks.results.every(({ elapsedMs }) => elapsedMs < 5_000), `${browserName}: GrabCut left the current practical latency envelope`)
    for (const [adapter, result] of Object.entries(masks.finished)) {
      assert.equal(result.sourceAfterSha256, result.sourceSha256, `${browserName}: ${adapter} source matte was mutated`)
      assert.notEqual(result.finishedSha256, result.sourceSha256, `${browserName}: ${adapter} skipped the shared edge finish`)
      assert(result.intermediatePixels > 0, `${browserName}: ${adapter} shared edge finish produced no continuous alpha`)
    }
    assert.deepEqual(masks.finished, finishedExpected, `${browserName}: shared u2net/GrabCut edge finish changed`)
    await page.close()

    // Real route proof: upload and scratch+erase stay provider-cold; standalone loads it once and saves the polished output.
    const context = await browser.newContext({ viewport, acceptDownloads: true })
    const scriptRequests = []
    const consoleProblems = []
    context.on('request', (request) => { if (request.resourceType() === 'script') scriptRequests.push(request.url()) })
    const routePage = await context.newPage()
    routePage.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`) })
    await routePage.goto(new URL('/cutout-lab?admin=1', baseUrl).href, { waitUntil: 'networkidle' })
    const baseline = scriptRequests.length
    const status = routePage.locator('p').filter({ hasText: 'Status:' })
    await routePage.locator('input[type=file]').first().setInputFiles(fixturePath)
    await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
    assert.equal(scriptRequests.slice(baseline).filter(isProviderRequest).length, 0, `${browserName}: upload must not load OpenCV`)
    await routePage.getByRole('button', { name: /^🤖 AI$/ }).click()
    await routePage.getByRole('button', { name: /Erase/ }).click()
    const box = await routePage.locator('canvas').first().boundingBox()
    assert(box, `${browserName}: route canvas must be visible`)
    const workingWidth = await routePage.locator('canvas').first().evaluate((canvas) => canvas.width)
    await draw(routePage, [{ x: box.x + box.width * 0.48, y: box.y + box.height * 0.48 }, { x: box.x + box.width * 0.56, y: box.y + box.height * 0.52 }], 4)
    await status.filter({ hasText: /nothing to erase yet/ }).waitFor({ timeout: 10_000 })
    assert.equal(scriptRequests.slice(baseline).filter(isProviderRequest).length, 0, `${browserName}: route scratch+erase must stay provider-cold`)
    await routePage.getByRole('button', { name: /Add/ }).click()
    const routeStarted = Date.now()
    await draw(routePage, [{ x: box.x + box.width * 0.43, y: box.y + box.height * 0.47 }, { x: box.x + box.width * 0.58, y: box.y + box.height * 0.54 }], 8)
    await status.filter({ hasText: /shape recognised/ }).waitFor({ timeout: 60_000 })
    const routeElapsedMs = Date.now() - routeStarted
    const opencvRequests = scriptRequests.slice(baseline).filter(isProviderRequest)
    assert.equal(opencvRequests.length, 1, `${browserName}: first real GrabCut must load exactly one provider`)
    assert(routeElapsedMs < 10_000, `${browserName}: real-route GrabCut left the current practical envelope`)
    const edgeFinish = routePage.getByRole('slider', { name: 'shared edge finish' })
    assert.equal(await edgeFinish.inputValue(), '8', `${browserName}: shared edge finish default changed`)
    const preview = routePage.getByRole('button', { name: /Preview|Editing view/ })
    if ((await preview.textContent())?.includes('Preview')) await preview.click()
    await routePage.getByText('Preview — same result, cut out').waitFor()
    const pending = routePage.waitForEvent('download')
    await routePage.getByRole('button', { name: /Save/ }).click()
    const routeOutput = pngInfo(readFileSync(await (await pending).path()))
    assert.deepEqual(routeOutput, routeExpected[browserName], `${browserName}: completed GrabCut output changed`)

    // Admin phone comparison: switch only the output-source raster to the original upload. The
    // accepted edit recipe/history stays fixed; switching back must reproduce the exact capped PNG.
    const outputToggle = routePage.getByRole('checkbox', { name: 'original resolution output' })
    assert.equal(await outputToggle.isChecked(), false, `${browserName}: output must default to the mobile cap`)
    await routePage.getByText('1536×1536', { exact: false }).waitFor()
    const historyBeforeOutputToggle = await routePage.getByRole('heading', { name: 'Cutout Lab' }).getAttribute('data-hist')
    await outputToggle.click()
    await status.filter({ hasText: /original upload output source: 2048×2048/ }).waitFor({ timeout: 60_000 })
    assert.equal(await outputToggle.isChecked(), true, `${browserName}: original-resolution mode did not commit`)
    assert.equal(await routePage.getByRole('heading', { name: 'Cutout Lab' }).getAttribute('data-hist'), historyBeforeOutputToggle, `${browserName}: output resolution changed the accepted recipe/history`)
    const fullPending = routePage.waitForEvent('download')
    await routePage.getByRole('button', { name: /Save/ }).click()
    const originalOutput = pngInfo(readFileSync(await (await fullPending).path()))
    assert.deepEqual(originalOutput, originalRouteExpected[browserName], `${browserName}: original-resolution output changed`)
    await outputToggle.click()
    await status.filter({ hasText: /capped output source: 1536×1536/ }).waitFor({ timeout: 60_000 })
    const restoredPending = routePage.waitForEvent('download')
    await routePage.getByRole('button', { name: /Save/ }).click()
    const restoredOutput = pngInfo(readFileSync(await (await restoredPending).path()))
    assert.deepEqual(restoredOutput, routeExpected[browserName], `${browserName}: capped output did not reproduce after the original-resolution comparison`)

    // Paint owns a freehand vector recipe; it must not inherit the sticker-cutout recipe.
    await routePage.getByRole('button', { name: /Editing view/ }).click()
    await routePage.getByRole('button', { name: /Vector/ }).click()
    for (const [control, unit, max] of [
      ['detail', 'px', '150'], ['offset', 'px', '160'], ['simplify', 'px', '30'],
      ['smooth', 'strength', '200'], ['radius', 'px', '260'],
    ]) {
      await routePage.getByRole('button', { name: control, exact: true }).click()
      const row = routePage.getByText(`${control} (${unit})`, { exact: true }).locator('..')
      const slider = row.locator('input[type=range]')
      assert.deepEqual(
        [await slider.getAttribute('min'), await slider.getAttribute('max'), await slider.getAttribute('step')],
        ['0', max, '1'],
        `${browserName}: ${control} must expose normalized ${unit} units`,
      )
    }
    await routePage.getByRole('button', { name: 'smooth', exact: true }).click()
    const vectorKnob = routePage.locator('input[type=number]')
    await vectorKnob.fill('37')
    assert.equal(await vectorKnob.inputValue(), '37', `${browserName}: cutout vector recipe did not accept calibration`)

    // Paint calibration: the full useful ranges must re-run the latest real Paint stroke live.
    await routePage.getByRole('button', { name: /Clear/ }).click()
    await routePage.getByRole('button', { name: /^✋ Edit$/ }).click()
    await routePage.getByRole('button', { name: /Paint shape/ }).click()
    const swath = routePage.getByRole('slider', { name: 'Paint swath width' })
    const smoothing = routePage.getByRole('slider', { name: 'Paint smoothing' })
    const loopClose = routePage.getByRole('slider', { name: 'Paint loop-close' })
    const capStyle = routePage.getByRole('combobox', { name: 'Paint cap style' })
    const joinStyle = routePage.getByRole('combobox', { name: 'Paint join style' })
    assert.equal(await swath.inputValue(), '1', `${browserName}: Paint swath must default to the brush width`)
    assert.equal(await capStyle.inputValue(), 'round', `${browserName}: Paint cap style default changed`)
    assert.equal(await joinStyle.inputValue(), 'round', `${browserName}: Paint join style default changed`)
    assert.deepEqual(await capStyle.locator('option').allTextContents(), ['round', 'butt', 'square'], `${browserName}: Paint cap styles incomplete`)
    assert.deepEqual(await joinStyle.locator('option').allTextContents(), ['round', 'bevel', 'miter'], `${browserName}: Paint join styles incomplete`)
    assert.deepEqual(
      await Promise.all([swath, smoothing, loopClose].map(async (slider) => [await slider.getAttribute('min'), await slider.getAttribute('max')])),
      [['0', '12'], ['0', '100'], ['0', '1']],
      `${browserName}: Paint calibration must expose the full useful ranges`,
    )
    const paintBox = await routePage.locator('canvas').first().boundingBox()
    assert(paintBox, `${browserName}: Paint canvas must be visible`)
    await draw(routePage, [
      { x: paintBox.x + paintBox.width * 0.35, y: paintBox.y + paintBox.height * 0.35 },
      { x: paintBox.x + paintBox.width * 0.35, y: paintBox.y + paintBox.height * 0.65 },
      { x: paintBox.x + paintBox.width * 0.65, y: paintBox.y + paintBox.height * 0.65 },
      { x: paintBox.x + paintBox.width * 0.65, y: paintBox.y + paintBox.height * 0.35 },
    ], 4)
    await status.filter({ hasText: /painted shape created/ }).waitFor({ timeout: 60_000 })
    await routePage.getByRole('button', { name: /Vector/ }).click()
    await routePage.getByRole('button', { name: 'smooth', exact: true }).click()
    assert.equal(await vectorKnob.inputValue(), '0', `${browserName}: Paint must start from an unmodified vector recipe`)
    await vectorKnob.fill('23')
    await routePage.getByRole('button', { name: /^✋ Edit$/ }).click()
    const canvasData = () => routePage.locator('canvas').first().evaluate(async (canvas) => {
      const blob = await new Promise((settle) => canvas.toBlob(settle))
      const bytes = await blob.arrayBuffer()
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((value) => value.toString(16).padStart(2, '0')).join('')
    })
    const tunePaint = async (slider, value, prior) => {
      await slider.fill(value)
      await status.filter({ hasText: /recalculating the latest Paint stroke/ }).waitFor({ timeout: 10_000 })
      await status.filter({ hasText: /latest Paint stroke recalculated/ }).waitFor({ timeout: 60_000 })
      const current = await canvasData()
      assert.notEqual(current, prior, `${browserName}: ${await slider.getAttribute('aria-label')} did not change the current hand-drawn shape`)
      return current
    }
    let paintedCanvas = await canvasData()
    paintedCanvas = await tunePaint(loopClose, '1', paintedCanvas)
    await routePage.getByRole('button', { name: /Vector/ }).click()
    await routePage.getByRole('button', { name: 'smooth', exact: true }).click()
    assert.equal(await vectorKnob.inputValue(), '0', `${browserName}: tuning Paint must reset the visible vector recipe`)
    await routePage.getByRole('button', { name: /^✋ Edit$/ }).click()
    paintedCanvas = await tunePaint(loopClose, '0.2', paintedCanvas)
    paintedCanvas = await tunePaint(swath, '12', paintedCanvas)
    paintedCanvas = await tunePaint(smoothing, '100', paintedCanvas)
    await capStyle.selectOption('square')
    await status.filter({ hasText: /latest Paint stroke recalculated/ }).waitFor({ timeout: 60_000 })
    assert.notEqual(await canvasData(), paintedCanvas, `${browserName}: Paint cap style did not change the current hand-drawn shape`)
    paintedCanvas = await canvasData()
    await joinStyle.selectOption('bevel')
    await status.filter({ hasText: /latest Paint stroke recalculated/ }).waitFor({ timeout: 60_000 })
    assert.notEqual(await canvasData(), paintedCanvas, `${browserName}: Paint join style did not change the current hand-drawn shape`)

    // Blend stays explicitly zero even when Frame pushes the shape beyond the artwork.
    await routePage.getByRole('button', { name: /^✋ Edit$/ }).click()
    await routePage.getByRole('button', { name: /Frame/ }).click()
    const eastFrameGrip = routePage.locator('svg rect[style*="-resize"]').nth(4)
    const eastFrameBox = await eastFrameGrip.boundingBox()
    assert(eastFrameBox, `${browserName}: east Frame grip must be visible`)
    await routePage.mouse.move(eastFrameBox.x + eastFrameBox.width / 2, eastFrameBox.y + eastFrameBox.height / 2)
    await routePage.mouse.down()
    await routePage.mouse.move(eastFrameBox.x + eastFrameBox.width / 2 + paintBox.width, eastFrameBox.y + eastFrameBox.height / 2)
    await routePage.mouse.up()

    // Paint ink/cursor stay truthful to the image-space mask width after the view box outgrows it.
    await routePage.getByRole('button', { name: /Paint shape/ }).click()
    await swath.fill('1')
    await routePage.evaluate(() => {
      const proto = CanvasRenderingContext2D.prototype
      const arc = proto.arc
      const stroke = proto.stroke
      let radius = 0
      window.__cutoutPaintWidthProbe = { ink: [], cursor: [] }
      proto.arc = function (...args) { radius = args[2]; return Reflect.apply(arc, this, args) }
      proto.stroke = function (...args) {
        const style = String(this.strokeStyle).replaceAll(' ', '')
        if (style === 'rgba(124,58,237,0.45)') window.__cutoutPaintWidthProbe.ink.push(this.lineWidth)
        else if (style.includes('124,58,237') || style === '#7c3aed') window.__cutoutPaintWidthProbe.cursor.push(radius * 2)
        return Reflect.apply(stroke, this, args)
      }
    })
    const outgrownPaintBox = await routePage.locator('canvas').first().boundingBox()
    assert(outgrownPaintBox, `${browserName}: outgrown Paint canvas must be visible`)
    const displayWidth = await routePage.locator('canvas').first().evaluate((canvas) => canvas.parentElement.getBoundingClientRect().width)
    const brushSize = Number(await routePage.locator('input[type=number]').inputValue())
    const expectedPaintWidth = brushSize * workingWidth / displayWidth
    await routePage.mouse.move(outgrownPaintBox.x + outgrownPaintBox.width * 0.45, outgrownPaintBox.y + outgrownPaintBox.height * 0.45)
    await routePage.mouse.down()
    await routePage.mouse.move(outgrownPaintBox.x + outgrownPaintBox.width * 0.55, outgrownPaintBox.y + outgrownPaintBox.height * 0.55)
    const paintedWidths = await routePage.evaluate(() => window.__cutoutPaintWidthProbe)
    await routePage.mouse.up()
    assert(Math.abs(paintedWidths.ink.at(-1) - expectedPaintWidth) < 0.01, `${browserName}: outgrown Paint ink diverged from deposited width`)
    assert(Math.abs(paintedWidths.cursor.at(-1) - expectedPaintWidth) < 0.01, `${browserName}: outgrown Paint cursor diverged from deposited width`)
    await swath.fill('0')
    await routePage.evaluate(() => { window.__cutoutPaintWidthProbe = { ink: [], cursor: [] } })
    await routePage.mouse.move(outgrownPaintBox.x + outgrownPaintBox.width * 0.60, outgrownPaintBox.y + outgrownPaintBox.height * 0.60)
    await routePage.mouse.down()
    await routePage.mouse.move(outgrownPaintBox.x + outgrownPaintBox.width * 0.65, outgrownPaintBox.y + outgrownPaintBox.height * 0.65)
    const zeroWidths = await routePage.evaluate(() => window.__cutoutPaintWidthProbe)
    await routePage.mouse.up()
    assert.deepEqual(zeroWidths, { ink: [], cursor: [] }, `${browserName}: zero swath must render no Paint ink or cursor`)

    await routePage.getByRole('button', { name: /Blend/ }).click()
    assert.equal(await routePage.locator('input[type=number]').inputValue(), '0', `${browserName}: Blend must not wake above zero on outgrowth`)

    // Returning to an accepted GrabCut restores the prior sticker-cutout recipe, not Paint's recipe.
    await routePage.getByRole('button', { name: /Clear/ }).click()
    await routePage.getByRole('button', { name: /^🤖 AI$/ }).click()
    await routePage.getByRole('button', { name: /Add/ }).click()
    const restoredBox = await routePage.locator('canvas').first().boundingBox()
    assert(restoredBox, `${browserName}: restored GrabCut canvas must be visible`)
    await draw(routePage, [{ x: restoredBox.x + restoredBox.width * 0.43, y: restoredBox.y + restoredBox.height * 0.47 }, { x: restoredBox.x + restoredBox.width * 0.58, y: restoredBox.y + restoredBox.height * 0.54 }], 8)
    await status.filter({ hasText: /shape recognised/ }).waitFor({ timeout: 60_000 })
    await routePage.getByRole('button', { name: /Vector/ }).click()
    await routePage.getByRole('button', { name: 'smooth', exact: true }).click()
    assert.equal(await vectorKnob.inputValue(), '37', `${browserName}: GrabCut did not restore the prior cutout vector recipe`)
    assert.deepEqual(consoleProblems, [], `${browserName}: GrabCut route must have no console problems`)
    await context.close()
    return { browserName, providerLoad, masks: masks.results, finished: masks.finished, routeElapsedMs, routeOutput, originalOutput, paintLiveCalibration: true, paintStrokeStyleCalibration: true, paintWidthProof: true, sourceOwnedVectorRecipes: true, opencvRequests: opencvRequests.length }
  } finally {
    await browser.close()
  }
}

try {
  const results = []
  for (const browserType of [chromium, webkit]) results.push(await runBrowser(browserType))
  console.log(JSON.stringify({
    viewport,
    provider: { packageBytes: providerSource.length, packageSha256: createHash('sha256').update(providerSource).digest('hex'), probeEmittedBytes: statSync(providerBundle).size, probeGzipBytes: providerGzip.length },
    results,
  }))
} finally {
  await new Promise((settle) => server.close(settle))
  rmSync(temp, { recursive: true, force: true })
}
