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
writeFileSync(entry, "export { grabCutRefine } from '@/lib/cutout-grabcut'\nexport { smoothMask } from '@/lib/effect/mask'\n")
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
const polishedExpected = {
  standalone: { area: 85_023, maskSha256: '2c05d44f0d9bb450c3e22bc6ef34e3d02b9ce4a91da6cfe0f924598611cad03e', softSha256: 'f08d4616100ea3b230be98a9da72f6e922d00e8e562a1abcab4a2deb9fa4bcb6' },
  refineAdd: { area: 91_703, maskSha256: 'fe20db63cf73aed02d2d63017e9bea28a0597175d957c2e5d2ee9a11c3ca98b2', softSha256: '39bebc8273aca4b21d87da63fce6554e4d023dc9dbf66bd7a12c4389f85636b6' },
}
const routeExpected = {
  chromium: { width: 1267, height: 443, colorType: 6, sha256: '9f50b1e21c42b964b054ece5490e369759e35fb1445d3f3ec8ad196de5428627' },
  webkit: { width: 1266, height: 443, colorType: 6, sha256: 'ef70064555075e5189a0942b8240d7356ee2efb7fe3f8b5b511ae89143f424fb' },
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

    // Load the sole retained provider, then invoke the real production module and freeze raw/final masks.
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
      const polish = async (mask) => {
        const data = GrabCutProbe.smoothMask(mask.data, mask.w, mask.h, 3)
        const soft = data.map((value) => value * 255)
        return { area: data.reduce((sum, value) => sum + (value ? 1 : 0), 0), maskSha256: await hash(data), softSha256: await hash(soft) }
      }
      const results = [standalone, refineAdd, refineErase, repeat].map((result) => ({ label: result.label, elapsedMs: result.elapsedMs, area: result.area, sha256: result.sha256 }))
      return { results, polished: { standalone: await polish(standalone.mask), refineAdd: await polish(refineAdd.mask) } }
    }, fixtureUrl)
    assert.deepEqual(masks.results.map(({ label, area, sha256 }) => [label, area, sha256]), rawExpected, `${browserName}: raw GrabCut masks changed`)
    assert(masks.results.every(({ elapsedMs }) => elapsedMs < 5_000), `${browserName}: GrabCut left the current practical latency envelope`)
    assert.deepEqual(masks.polished, polishedExpected, `${browserName}: radius-3 completed matte changed`)
    await page.close()

    // Real route proof: upload and scratch+erase stay provider-cold; standalone loads it once and saves the polished output.
    const context = await browser.newContext({ viewport, acceptDownloads: true })
    const scriptRequests = []
    const consoleProblems = []
    context.on('request', (request) => { if (request.resourceType() === 'script') scriptRequests.push(request.url()) })
    const routePage = await context.newPage()
    routePage.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`) })
    await routePage.goto(new URL('/cutout-lab', baseUrl).href, { waitUntil: 'networkidle' })
    const baseline = scriptRequests.length
    const status = routePage.locator('p').filter({ hasText: 'Status:' })
    await routePage.locator('input[type=file]').first().setInputFiles(fixturePath)
    await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
    assert.equal(scriptRequests.slice(baseline).filter(isProviderRequest).length, 0, `${browserName}: upload must not load OpenCV`)
    await routePage.getByRole('button', { name: /^🤖 AI$/ }).click()
    await routePage.getByRole('button', { name: /Erase/ }).click()
    const box = await routePage.locator('canvas').first().boundingBox()
    assert(box, `${browserName}: route canvas must be visible`)
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
    const preview = routePage.getByRole('button', { name: /Preview|Editing view/ })
    if ((await preview.textContent())?.includes('Preview')) await preview.click()
    await routePage.getByText('Preview — same result, cut out').waitFor()
    const pending = routePage.waitForEvent('download')
    await routePage.getByRole('button', { name: /Save/ }).click()
    const routeOutput = pngInfo(readFileSync(await (await pending).path()))
    assert.deepEqual(routeOutput, routeExpected[browserName], `${browserName}: completed GrabCut output changed`)
    assert.deepEqual(consoleProblems, [], `${browserName}: GrabCut route must have no console problems`)
    await context.close()
    return { browserName, providerLoad, masks: masks.results, polished: masks.polished, routeElapsedMs, routeOutput, opencvRequests: opencvRequests.length }
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
