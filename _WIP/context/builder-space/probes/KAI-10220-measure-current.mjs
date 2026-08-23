import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium, webkit } from 'playwright'

const root = resolve(import.meta.dirname, '../../../..')
const generated = resolve(import.meta.dirname, 'generated')
const providerLabel = process.env.OPENCV_PROVIDER_LABEL ?? 'installed'
const providerInput = resolve(process.env.OPENCV_PROVIDER_PATH ?? resolve(root, 'node_modules/@techstark/opencv-js/dist/opencv.js'))
const bundle = resolve(generated, `${providerLabel}-grabcut.js`)
const providerBundle = resolve(generated, `${providerLabel}-opencv.js`)
mkdirSync(generated, { recursive: true })
execFileSync(resolve(root, 'node_modules/.bin/esbuild'), [
  resolve(import.meta.dirname, 'grabcut-probe-entry.ts'),
  '--bundle', '--platform=browser', '--format=iife', '--global-name=GrabCutProbe',
  '--external:fs', '--external:crypto',
  `--alias:@techstark/opencv-js=${resolve(import.meta.dirname, 'opencv-global-shim.ts')}`,
  `--alias:@=${resolve(root, 'src')}`, `--outfile=${bundle}`,
], { stdio: 'inherit' })
execFileSync(resolve(root, 'node_modules/.bin/esbuild'), [
  providerInput,
  '--bundle', '--platform=browser', '--format=iife', '--global-name=OpenCvModule',
  '--external:fs', '--external:crypto', '--external:node:fs', '--external:node:crypto', `--outfile=${providerBundle}`,
], { stdio: 'inherit' })

const fixture = readFileSync(resolve(root, 'public/assets/test-artwork.png'))
const fixtureUrl = `data:image/png;base64,${fixture.toString('base64')}`
const originalProvider = readFileSync(providerInput)
const provider = readFileSync(providerBundle)
const providerGzip = gzipSync(provider)
const server = createServer((request, response) => {
  if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end('<!doctype html><html><head></head><body></body></html>')
    return
  }
  if (request.url !== '/opencv.js') { response.writeHead(404).end(); return }
  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Encoding': 'gzip',
    'Content-Length': providerGzip.length,
    'Content-Type': 'text/javascript',
  })
  response.end(providerGzip)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
const providerUrl = `http://127.0.0.1:${address.port}/opencv.js`
const browserType = process.env.OPENCV_BROWSER === 'webkit' ? webkit : chromium
const browser = await browserType.launch({ headless: true, args: browserType === chromium ? ['--js-flags=--expose-gc'] : [] })

async function freshPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('console', (message) => console.error(`[${providerLabel}] ${message.type()}: ${message.text()}`))
  page.on('pageerror', (error) => console.error(`[${providerLabel}] pageerror: ${error.message}`))
  await page.addInitScript((providerUrl) => {
    window.__opencvProbeUrl = providerUrl
    window.__wasmMemories = []
    const remember = (result) => {
      const instance = result?.instance ?? result
      const memories = Object.values(instance?.exports ?? {}).filter((value) => value instanceof WebAssembly.Memory)
      for (const memory of memories) if (!window.__wasmMemories.includes(memory)) window.__wasmMemories.push(memory)
      return result
    }
    const instantiate = WebAssembly.instantiate.bind(WebAssembly)
    WebAssembly.instantiate = async (...args) => remember(await instantiate(...args))
    if (WebAssembly.instantiateStreaming) {
      const instantiateStreaming = WebAssembly.instantiateStreaming.bind(WebAssembly)
      WebAssembly.instantiateStreaming = async (...args) => remember(await instantiateStreaming(...args))
    }
  }, providerUrl)
  await page.goto(`http://127.0.0.1:${address.port}/`)
  const providerLoad = await page.evaluate(async (url) => {
    let active = true
    let previous = performance.now()
    let maxFrameGapMs = 0
    const frame = (now) => {
      if (active) {
        maxFrameGapMs = Math.max(maxFrameGapMs, now - previous)
        previous = now
        requestAnimationFrame(frame)
      }
    }
    requestAnimationFrame(frame)
    const started = performance.now()
    const script = document.createElement('script')
    script.src = url
    const loaded = new Promise((resolve, reject) => {
      script.onload = resolve
      script.onerror = () => reject(new Error('OpenCV provider failed to load'))
    })
    document.head.append(script)
    await loaded
    let cv = window.OpenCvModule?.default ?? window.OpenCvModule
    if (typeof cv === 'function' && !cv.Mat) cv = cv()
    window.__cvResolved = await cv
    const elapsedMs = performance.now() - started
    await new Promise((resolve) => requestAnimationFrame(resolve))
    active = false
    return {
      elapsedMs, maxFrameGapMs,
      heapAfter: performance.memory?.usedJSHeapSize ?? null,
      wasmBytes: window.__wasmMemories.reduce((sum, memory) => sum + memory.buffer.byteLength, 0),
    }
  }, providerUrl)
  await page.addScriptTag({ path: bundle })
  return { page, providerLoad }
}

const run = async (page, mode) => page.evaluate(async ({ fixtureUrl, mode }) => {
  const image = new Image()
  image.src = fixtureUrl
  await image.decode()
  const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight))
  const w = Math.round(image.naturalWidth * scale)
  const h = Math.round(image.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0, w, h)
  const hash = async (data) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))]
    .map((v) => v.toString(16).padStart(2, '0')).join('')
  const area = (mask) => mask.data.reduce((sum, value) => sum + (value ? 1 : 0), 0)
  const maskPng = (mask) => {
    const out = document.createElement('canvas'); out.width = mask.w; out.height = mask.h
    const image = new ImageData(mask.w, mask.h)
    for (let i = 0; i < mask.data.length; i++) {
      const offset = i * 4
      image.data[offset] = 255; image.data[offset + 1] = 255; image.data[offset + 2] = 255
      image.data[offset + 3] = mask.data[i] ? 255 : 0
    }
    out.getContext('2d').putImageData(image, 0, 0)
    return out.toDataURL('image/png')
  }
  const polish = async (mask) => {
    const variants = []
    for (const radius of [1, 2, 3, 4]) {
      const data = GrabCutProbe.smoothMask(mask.data, mask.w, mask.h, radius)
      const soft = data.map((value) => value * 255)
      let changed = 0
      for (let i = 0; i < data.length; i++) if (data[i] !== mask.data[i]) changed++
      variants.push({
        radius, changed, area: data.reduce((sum, value) => sum + (value ? 1 : 0), 0),
        sha256: await hash(data), softSha256: await hash(soft), png: maskPng({ ...mask, data }),
      })
    }
    return { rawPng: maskPng(mask), variants }
  }
  const wasmBytes = () => window.__wasmMemories.reduce((sum, memory) => sum + memory.buffer.byteLength, 0)
  const measure = async (label, op) => {
    console.log(`probe-start:${label}`)
    let active = true
    let previous = performance.now()
    let maxFrameGapMs = 0
    const frame = (now) => {
      if (active) {
        maxFrameGapMs = Math.max(maxFrameGapMs, now - previous)
        previous = now
        requestAnimationFrame(frame)
      }
    }
    requestAnimationFrame(frame)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const heapBefore = performance.memory?.usedJSHeapSize ?? null
    const wasmBefore = wasmBytes()
    const started = performance.now()
    const mask = await op()
    console.log(`probe-end:${label}`)
    const elapsedMs = performance.now() - started
    await new Promise((resolve) => requestAnimationFrame(resolve))
    active = false
    return {
      label, elapsedMs, maxFrameGapMs,
      heapBefore, heapAfter: performance.memory?.usedJSHeapSize ?? null,
      wasmBefore, wasmAfter: wasmBytes(),
      area: area(mask), sha256: await hash(mask.data), w: mask.w, h: mask.h,
    }
  }

  const standaloneStroke = [
    { x: w * 0.43, y: h * 0.47 },
    { x: w * 0.51, y: h * 0.51 },
    { x: w * 0.58, y: h * 0.54 },
  ]
  if (mode === 'scratch-erase') {
    return [await measure('scratch-erase', () => GrabCutProbe.grabCutRefine(canvas, null, standaloneStroke, w * 0.025, true))]
  }
  const results = []
  let base
  let refineAdd
  results.push(await measure('standalone-cold', async () => {
    base = await GrabCutProbe.grabCutRefine(canvas, null, standaloneStroke, w * 0.025, false)
    return base
  }))
  results.push(await measure('refine-add-warm', async () => {
    refineAdd = await GrabCutProbe.grabCutRefine(canvas, base, [
      { x: w * 0.59, y: h * 0.45 }, { x: w * 0.64, y: h * 0.47 },
    ], w * 0.02, false)
    return refineAdd
  }))
  results.push(await measure('refine-erase-warm', () => GrabCutProbe.grabCutRefine(canvas, base, [
    { x: w * 0.42, y: h * 0.67 }, { x: w * 0.48, y: h * 0.68 },
  ], w * 0.018, true)))
  results.push(await measure('standalone-repeat', () => GrabCutProbe.grabCutRefine(canvas, null, standaloneStroke, w * 0.025, false)))
  if (typeof window.__cvResolved.setRNGSeed === 'function') {
    for (const seed of [-1, 0, 1, 12345]) {
      window.__cvResolved.setRNGSeed(seed)
      results.push(await measure(`standalone-seed-${seed}`, () => GrabCutProbe.grabCutRefine(canvas, null, standaloneStroke, w * 0.025, false)))
    }
  }
  return { results, standalonePolish: await polish(base), refineAddPolish: await polish(refineAdd) }
}, { fixtureUrl, mode })

try {
  const { page: scratchPage, providerLoad: scratchProviderLoad } = await freshPage()
  const scratch = await run(scratchPage, 'scratch-erase')
  const scratchTransfer = await scratchPage.evaluate((url) => performance.getEntriesByName(url).map((entry) => ({
    transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize,
  })), providerUrl)
  await scratchPage.close()
  const { page: maskPage, providerLoad: maskProviderLoad } = await freshPage()
  const masks = await run(maskPage, 'masks')
  const maskTransfer = await maskPage.evaluate((url) => performance.getEntriesByName(url).map((entry) => ({
    transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize,
  })), providerUrl)
  await maskPage.close()
  const evidence = resolve(import.meta.dirname, '../evidence/KAI-10220')
  mkdirSync(evidence, { recursive: true })
  const writeDataUrl = (name, value) => writeFileSync(resolve(evidence, name), Buffer.from(value.split(',')[1], 'base64'))
  writeDataUrl(`${providerLabel}-raw-standalone-mask.png`, masks.standalonePolish.rawPng)
  for (const variant of masks.standalonePolish.variants) writeDataUrl(`${providerLabel}-smooth-r${variant.radius}-standalone-mask.png`, variant.png)
  writeDataUrl(`${providerLabel}-raw-refine-add-mask.png`, masks.refineAddPolish.rawPng)
  for (const variant of masks.refineAddPolish.variants) writeDataUrl(`${providerLabel}-smooth-r${variant.radius}-refine-add-mask.png`, variant.png)
  for (const variant of masks.standalonePolish.variants) delete variant.png
  for (const variant of masks.refineAddPolish.variants) delete variant.png
  delete masks.standalonePolish.rawPng
  delete masks.refineAddPolish.rawPng
  const bytes = readFileSync(bundle)
  console.log(JSON.stringify({
    source: 'src/lib/cutout-grabcut/index.ts',
    provider: {
      label: providerLabel,
      packageBytes: originalProvider.length,
      packageSha256: createHash('sha256').update(originalProvider).digest('hex'),
      probeEmittedBytes: provider.length, probeGzipBytes: providerGzip.length,
      probeSha256: createHash('sha256').update(provider).digest('hex'),
      scratchProviderLoad, maskProviderLoad, scratchTransfer, maskTransfer,
    },
    bundle: { bytes: statSync(bundle).size, sha256: createHash('sha256').update(bytes).digest('hex') },
    scratch,
    masks,
  }, null, 2))
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
