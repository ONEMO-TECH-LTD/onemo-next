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
  await page.goto(new URL('/cutout-lab?admin=1', baseUrl).href, { waitUntil: 'networkidle' })
  const status = page.locator('p').filter({ hasText: 'Status:' })
  await page.locator('input[type=file]').first().setInputFiles(fixture)
  await status.filter({ hasText: /image ready/ }).waitFor()
  await page.getByRole('button', { name: /^🤖 AI$/ }).click()
  await page.getByRole('button', { name: /Add/ }).click()
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  assert(box)
  await draw(page, [
    { x: box.x + box.width * 0.43, y: box.y + box.height * 0.47 },
    { x: box.x + box.width * 0.58, y: box.y + box.height * 0.54 },
  ])
  await status.filter({ hasText: /shape recognised/ }).waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: /Vector/ }).click()
  const preset = page.getByRole('combobox', { name: 'vector preset' })
  const beforePreset = await preset.inputValue()
  assert.equal(beforePreset, 'CLASSIC')
  await page.getByRole('button', { name: /^✋ Edit$/ }).click()
  await page.screenshot({ path: `${evidenceDir}/KAI-10285-ai-base-before-erase.png`, fullPage: true })
  const before = await canvas.evaluate((node) => [...node.getContext('2d').getImageData(0, 0, node.width, node.height).data])

  await page.getByRole('button', { name: /Paint erase/ }).click()
  await draw(page, [
    { x: box.x + box.width * 0.48, y: box.y + box.height * 0.48 },
    { x: box.x + box.width * 0.52, y: box.y + box.height * 0.52 },
  ])
  await status.filter({ hasText: /erased — auto-tuned/ }).waitFor({ timeout: 60_000 })
  await page.waitForTimeout(750)
  const after = await canvas.evaluate((node) => [...node.getContext('2d').getImageData(0, 0, node.width, node.height).data])
  const dims = await canvas.evaluate((node) => ({ width: node.width, height: node.height }))
  let changedOutside = 0
  let changedTotal = 0
  for (let y = 0; y < dims.height; y++) {
    for (let x = 0; x < dims.width; x++) {
      const i = (y * dims.width + x) * 4
      const changed = before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2] || before[i + 3] !== after[i + 3]
      if (!changed) continue
      changedTotal++
      const insideGenerousEraseRegion = x > dims.width * 0.35 && x < dims.width * 0.65 && y > dims.height * 0.35 && y < dims.height * 0.65
      if (!insideGenerousEraseRegion) changedOutside++
    }
  }
  await page.getByRole('button', { name: /Vector/ }).click()
  const afterPreset = await preset.inputValue()
  const knob = page.locator('input[type=number]').last()
  const afterVector = {}
  for (const name of ['detail', 'offset', 'simplify', 'smooth', 'radius']) {
    await page.getByRole('button', { name, exact: true }).click()
    afterVector[name] = await knob.inputValue()
  }
  await page.screenshot({ path: `${evidenceDir}/KAI-10285-ai-base-after-erase.png`, fullPage: true })
  console.log(JSON.stringify({ beforePreset, afterPreset, afterVector, changedTotal, changedOutside, dims }))
} catch (error) {
  writeFileSync(`${evidenceDir}/KAI-10285-ai-base-probe-error.txt`, String(error?.stack ?? error))
  throw error
} finally {
  await browser.close()
}
