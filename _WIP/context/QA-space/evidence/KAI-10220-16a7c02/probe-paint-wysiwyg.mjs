import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await context.newPage()
const status = page.locator('p').filter({ hasText: 'Status:' })
const canvas = page.locator('canvas').first()
const fixture = '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.codex/worktrees/s62-pixel-v1-050d557e/public/assets/test-artwork.png'

try {
  await page.goto('http://127.0.0.1:3220/cutout-lab?admin=1', { waitUntil: 'networkidle' })
  await page.locator('input[type=file]').first().setInputFiles(fixture)
  await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
  let box = await canvas.boundingBox()
  assert(box)
  await page.getByRole('button', { name: /Add/ }).click()
  await page.mouse.move(box.x + box.width * 0.43, box.y + box.height * 0.47)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.54, { steps: 8 })
  await page.mouse.up()
  await status.filter({ hasText: /shape recognised/ }).waitFor({ timeout: 60_000 })

  await page.getByRole('button', { name: /Edit/ }).click()
  await page.getByRole('button', { name: /Frame/ }).click()
  const eastGrip = page.locator('svg rect[style*="-resize"]').nth(4)
  const grip = await eastGrip.boundingBox()
  assert(grip)
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + box.width, grip.y + grip.height / 2)
  await page.mouse.up()
  await page.waitForTimeout(500)

  const geometry = await canvas.evaluate((node) => ({
    viewWidth: node.width,
    viewHeight: node.height,
    displayWidth: node.parentElement?.getBoundingClientRect().width ?? 0,
  }))
  const workingImageWidth = 1024
  const brush = 15
  const swath = 1
  const depositedInternalWidth = brush * (workingImageWidth / geometry.displayWidth) * swath
  const renderedInternalWidth = brush * (geometry.viewWidth / geometry.displayWidth) * swath
  const ratio = renderedInternalWidth / depositedInternalWidth
  console.log(JSON.stringify({ ...geometry, workingImageWidth, depositedInternalWidth, renderedInternalWidth, ratio }))
  assert.equal(geometry.viewWidth, workingImageWidth, `Paint ink/cursor scale with view-box width ${geometry.viewWidth}, but the deposited mask still scales with image width ${workingImageWidth}`)
} finally {
  await context.close()
  await browser.close()
}
