import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.CUTOUT_V1_BASE_URL
assert(baseUrl)
const fixture = resolve('public/assets/test-artwork.png')
const evidenceDir = new URL('../evidence/', import.meta.url).pathname
const viewport = { width: 1280, height: 720 }

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
    return {
      width: node.width,
      height: node.height,
      sha256: [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''),
    }
  }, name)
  const canvasDiff = async (left, right) => page.evaluate(([a, b]) => {
    const x = window.__qaCanvas[a], y = window.__qaCanvas[b]
    let changedPixels = 0
    for (let i = 0; i < x.length; i += 4) {
      if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2] || x[i + 3] !== y[i + 3]) changedPixels++
    }
    return changedPixels
  }, [left, right])

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
  await page.getByRole('button', { name: /Nodes/ }).click()
  const nodeTargets = page.locator('svg circle[fill="transparent"]')
  const nodesBefore = await nodeTargets.count()
  const before = await canvasState('before')
  await page.screenshot({ path: `${evidenceDir}/KAI-10285-boundary-base-current.png`, fullPage: true })

  await page.getByRole('button', { name: /Paint erase/ }).click()
  await draw(page, [
    { x: box.x + box.width * 0.48, y: box.y + box.height * 0.44 },
    { x: box.x + box.width * 0.78, y: box.y + box.height * 0.70 },
  ])
  await status.filter({ hasText: /erased — auto-tuned/ }).waitFor({ timeout: 60_000 })
  await page.waitForTimeout(750)
  const erased = await canvasState('erased')
  await page.getByRole('button', { name: /Nodes/ }).click()
  const nodesAfter = await nodeTargets.count()
  await page.getByRole('button', { name: /Vector/ }).click()
  const erasedPreset = await preset.inputValue()
  await page.screenshot({ path: `${evidenceDir}/KAI-10285-boundary-erase-current.png`, fullPage: true })

  await page.getByRole('button', { name: /Undo/ }).click()
  await status.filter({ hasText: /restored previous cut/ }).waitFor({ timeout: 60_000 })
  await page.waitForTimeout(750)
  const undone = await canvasState('undone')
  await page.getByRole('button', { name: /Redo/ }).click()
  await status.filter({ hasText: /restored next cut/ }).waitFor({ timeout: 60_000 })
  await page.waitForTimeout(750)
  const redone = await canvasState('redone')

  const result = {
    acceptedPreset, erasedPreset, nodesBefore, nodesAfter,
    before, erased, undone, redone,
    changedAfterUndo: await canvasDiff('before', 'undone'),
    changedAfterRedo: await canvasDiff('erased', 'redone'),
    consoleProblems,
  }
  writeFileSync(`${evidenceDir}/KAI-10285-boundary-erase-current.json`, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result))
} finally {
  await browser.close()
}
