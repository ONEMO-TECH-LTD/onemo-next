import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.CUTOUT_V1_BASE_URL
assert(baseUrl)
const fixture = resolve('public/assets/test-artwork.png')
const evidenceDir = new URL('../evidence/', import.meta.url).pathname
const viewport = { width: 1280, height: 720 }
const snapshot = 'b2734220e08d33fc05a34a6e2325c0d52d70afe1'
const variant = process.env.KAI_10285_GESTURE === 'loop' ? 'loop' : 'boundary'

const draw = async (page, points) => {
  await page.mouse.move(points[0].x, points[0].y)
  await page.mouse.down()
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 8 })
  await page.mouse.up()
}

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport })
  const consoleProblems = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`)
  })
  await page.goto(new URL('/cutout-lab?admin=1', baseUrl).href, { waitUntil: 'networkidle' })
  const status = page.locator('p').filter({ hasText: 'Status:' })
  const canvas = page.locator('canvas').first()
  const canvasState = async (name) => canvas.evaluate(async (node, key) => {
    const pixels = node.getContext('2d').getImageData(0, 0, node.width, node.height).data
    window.__qaCanvas ??= {}
    window.__qaCanvas[key] = new Uint8Array(pixels)
    const digest = await crypto.subtle.digest('SHA-256', pixels)
    const png = await new Promise((resolveBlob) => node.toBlob(resolveBlob, 'image/png'))
    if (!png) throw new Error('canvas PNG encoding failed')
    const pngDigest = await crypto.subtle.digest('SHA-256', await png.arrayBuffer())
    return {
      width: node.width,
      height: node.height,
      sha256: [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''),
      pngSha256: [...new Uint8Array(pngDigest)].map((value) => value.toString(16).padStart(2, '0')).join(''),
    }
  }, name)
  const stableCanvasState = async (name) => {
    let previous = null
    let stableReads = 0
    for (let attempt = 0; attempt < 24; attempt++) {
      const current = await canvasState(name)
      if (current.sha256 === previous?.sha256) stableReads++
      else stableReads = 0
      if (stableReads >= 2) return { ...current, settleReads: attempt + 1 }
      previous = current
      await page.waitForTimeout(250)
    }
    throw new Error(`canvas did not settle for ${name}`)
  }
  const canvasDiff = async (left, right) => page.evaluate(([a, b]) => {
    const x = window.__qaCanvas[a], y = window.__qaCanvas[b]
    let changedPixels = 0
    for (let i = 0; i < x.length; i += 4) {
      if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2] || x[i + 3] !== y[i + 3]) changedPixels++
    }
    return changedPixels
  }, [left, right])
  const canvasRegionDiff = async (left, right, region) => page.evaluate(({ a, b, region: r }) => {
    const x = window.__qaCanvas[a], y = window.__qaCanvas[b]
    const canvas = document.querySelector('canvas')
    const [x0, y0, x1, y1] = [Math.floor(canvas.width * r[0]), Math.floor(canvas.height * r[1]), Math.ceil(canvas.width * r[2]), Math.ceil(canvas.height * r[3])]
    let changedPixels = 0
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const i = (py * canvas.width + px) * 4
      if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2] || x[i + 3] !== y[i + 3]) changedPixels++
    }
    return { changedPixels, totalPixels: (x1 - x0) * (y1 - y0) }
  }, { a: left, b: right, region })
  const saveSha256 = async () => {
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: /Save/ }).click()
    const path = await (await pending).path()
    assert(path)
    return createHash('sha256').update(readFileSync(path)).digest('hex')
  }

  await page.locator('input[type=file]').first().setInputFiles(fixture)
  await status.filter({ hasText: /image ready/ }).waitFor()
  await page.getByRole('button', { name: /^🤖 AI$/ }).click()
  await page.getByRole('button', { name: /Add/ }).click()
  const box = await canvas.boundingBox()
  assert(box)
  await draw(page, [
    { x: box.x + box.width * 0.43, y: box.y + box.height * 0.47 },
    { x: box.x + box.width * 0.58, y: box.y + box.height * 0.54 },
  ])
  await status.filter({ hasText: /shape recognised/ }).waitFor({ timeout: 60_000 })

  await page.getByRole('button', { name: /Vector/ }).click()
  const preset = page.getByRole('combobox', { name: 'vector preset' })
  const acceptedPreset = await preset.inputValue()
  await page.getByRole('button', { name: /^✋ Edit$/ }).click()
  await page.getByRole('button', { name: /Paint erase/ }).click()
  const eraseBox = await canvas.boundingBox()
  assert(eraseBox)
  const erasePoints = variant === 'loop'
    ? [
        { x: eraseBox.x + eraseBox.width * 0.48, y: eraseBox.y + eraseBox.height * 0.44 },
        { x: eraseBox.x + eraseBox.width * 0.76, y: eraseBox.y + eraseBox.height * 0.46 },
        { x: eraseBox.x + eraseBox.width * 0.76, y: eraseBox.y + eraseBox.height * 0.70 },
        { x: eraseBox.x + eraseBox.width * 0.52, y: eraseBox.y + eraseBox.height * 0.70 },
        { x: eraseBox.x + eraseBox.width * 0.50, y: eraseBox.y + eraseBox.height * 0.47 },
      ]
    : [
        { x: eraseBox.x + eraseBox.width * 0.74, y: eraseBox.y + eraseBox.height * 0.45 },
        { x: eraseBox.x + eraseBox.width * 0.985, y: eraseBox.y + eraseBox.height * 0.45 },
      ]
  await page.mouse.move(0, 0)
  const before = await stableCanvasState('before')
  await page.screenshot({ path: `${evidenceDir}/KAI-10285-${variant}-base-b2734220.png`, fullPage: true })
  await draw(page, erasePoints)
  await status.filter({ hasText: variant === 'loop' ? /inside stays solid/ : /erased — auto-tuned/ }).waitFor({ timeout: 60_000 })
  await page.waitForTimeout(3_000)
  if (variant === 'loop') {
    await page.mouse.move(0, 0)
    const erased = await stableCanvasState('erased')
    await page.getByRole('button', { name: /Vector/ }).click()
    const erasedPreset = await preset.inputValue()
    await page.screenshot({ path: `${evidenceDir}/KAI-10285-loop-rejected-b2734220.png`, fullPage: true })
    const result = {
      snapshot, variant,
      acceptedPreset, erasedPreset,
      before, erased,
      changedAfterErase: await canvasDiff('before', 'erased'),
      loopInteriorDiff: await canvasRegionDiff('before', 'erased', [0.58, 0.52, 0.70, 0.64]),
      undoDisabled: await page.getByRole('button', { name: /Undo/ }).isDisabled(),
      consoleProblems,
    }
    writeFileSync(`${evidenceDir}/KAI-10285-loop-erase-b2734220.json`, `${JSON.stringify(result, null, 2)}\n`)
    console.log(JSON.stringify(result))
  } else {
  await page.getByRole('button', { name: /Vector/ }).click()
  await page.mouse.move(0, 0)
  const erased = await stableCanvasState('erased')
  const erasedOutputSha256 = await saveSha256()
  const erasedPreset = await preset.inputValue()
  await page.screenshot({ path: `${evidenceDir}/KAI-10285-${variant}-erase-b2734220.png`, fullPage: true })

  await page.getByRole('button', { name: /Undo/ }).click()
  await status.filter({ hasText: /restored previous cut/ }).waitFor({ timeout: 60_000 })
  await page.waitForTimeout(3_000)
  const undone = await stableCanvasState('undone')
  await page.getByRole('button', { name: /Redo/ }).click()
  await status.filter({ hasText: /restored next cut/ }).waitFor({ timeout: 60_000 })
  await page.waitForTimeout(3_000)
  const redone = await stableCanvasState('redone')
  const redoneOutputSha256 = await saveSha256()

  const result = {
    snapshot, variant,
    acceptedPreset, erasedPreset,
    before, erased, undone, redone,
    erasedOutputSha256, redoneOutputSha256,
    changedAfterUndo: await canvasDiff('before', 'undone'),
    changedAfterRedo: await canvasDiff('erased', 'redone'),
    loopInteriorDiff: variant === 'loop' ? await canvasRegionDiff('before', 'erased', [0.58, 0.52, 0.70, 0.64]) : null,
    consoleProblems,
  }
  writeFileSync(`${evidenceDir}/KAI-10285-${variant}-erase-b2734220.json`, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result))
  }
} finally {
  await browser.close()
}
