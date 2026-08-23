import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const pageUrl = 'http://127.0.0.1:3220/cutout-lab?admin=1'
const fixture = '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.codex/worktrees/s62-pixel-v1-050d557e/public/assets/test-artwork.png'
const evidence = '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.codex/worktrees/s62-pixel-v1-050d557e/_WIP/context/QA-space/reviews/KAI-10220-fee76892-evidence'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const consoleProblems = []
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`)
})

const status = page.locator('p').filter({ hasText: 'Status:' })
const canvas = page.locator('canvas').first()
const historyTick = async () => Number(await page.getByRole('heading', { name: 'Cutout Lab' }).getAttribute('data-hist'))
const canvasHash = async () => canvas.evaluate(async (element) => {
  const blob = await new Promise((resolve) => element.toBlob(resolve))
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
})
const draw = async (points) => {
  await page.mouse.move(points[0].x, points[0].y)
  await page.mouse.down()
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 5 })
  await page.mouse.up()
}
const tune = async (slider, value, priorHash) => {
  await slider.fill(String(value))
  await status.filter({ hasText: /recalculating the latest Paint stroke/ }).waitFor({ timeout: 10_000 })
  await status.filter({ hasText: /latest Paint stroke recalculated/ }).waitFor({ timeout: 60_000 })
  const currentHash = await canvasHash()
  assert.notEqual(currentHash, priorHash, `${await slider.getAttribute('aria-label')}=${value} must visibly change the accepted Paint result`)
  return currentHash
}

try {
  await page.goto(pageUrl, { waitUntil: 'networkidle' })
  await page.locator('input[type=file]').first().setInputFiles(fixture)
  await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })

  const edge = page.getByRole('slider', { name: 'shared edge finish' })
  assert.equal(await edge.inputValue(), '8', 'shared u2net/GrabCut edge default must be 8')
  await page.getByRole('button', { name: /^✋ Edit$/ }).click()
  await page.getByRole('button', { name: /Paint shape/ }).click()
  const box = await canvas.boundingBox()
  assert(box, 'Paint canvas must be visible')
  const point = (x, y) => ({ x: box.x + box.width * x, y: box.y + box.height * y })

  await draw([point(0.32, 0.32), point(0.32, 0.68), point(0.68, 0.68), point(0.68, 0.32)])
  await status.filter({ hasText: /painted shape created/ }).waitFor({ timeout: 60_000 })
  const swath = page.getByRole('slider', { name: 'Paint swath width' })
  const smoothing = page.getByRole('slider', { name: 'Paint smoothing' })
  const loopClose = page.getByRole('slider', { name: 'Paint loop-close' })
  assert.deepEqual(
    await Promise.all([swath, smoothing, loopClose].map(async (slider) => [await slider.getAttribute('min'), await slider.getAttribute('max')])),
    [['0', '12'], ['0', '100'], ['0', '1']],
  )

  const shapeTick = await historyTick()
  const shapeHashes = [await canvasHash()]
  shapeHashes.push(await tune(loopClose, 1, shapeHashes.at(-1)))
  shapeHashes.push(await tune(loopClose, 0.2, shapeHashes.at(-1)))
  shapeHashes.push(await tune(swath, 12, shapeHashes.at(-1)))
  shapeHashes.push(await tune(smoothing, 0, shapeHashes.at(-1)))
  assert.equal(await smoothing.inputValue(), '0', 'Paint smoothing zero must stay true zero-off')
  shapeHashes.push(await tune(smoothing, 100, shapeHashes.at(-1)))
  assert.equal(await page.getByRole('button', { name: /Undo/ }).isDisabled(), true, 'standalone Paint calibration must not add an Undo entry')
  await page.screenshot({ path: `${evidence}/qa-paint-shape-live.png`, fullPage: true })

  await page.getByRole('button', { name: /Paint erase/ }).click()
  await draw([point(0.50, 0.40), point(0.50, 0.60)])
  await status.filter({ hasText: /erased — auto-tuned/ }).waitFor({ timeout: 60_000 })
  const eraseTick = await historyTick()
  const eraseHashes = [await canvasHash()]
  eraseHashes.push(await tune(swath, 3, eraseHashes.at(-1)))
  eraseHashes.push(await tune(smoothing, 0, eraseHashes.at(-1)))
  await page.getByRole('button', { name: /Undo/ }).click()
  await status.filter({ hasText: /restored previous cut/ }).waitFor({ timeout: 60_000 })
  assert.equal(await page.getByRole('button', { name: /Undo/ }).isDisabled(), true, 'one Undo after calibrated erase must reach the original Paint snapshot')
  await page.getByRole('button', { name: /Redo/ }).click()
  await status.filter({ hasText: /restored next cut/ }).waitFor({ timeout: 60_000 })
  await page.screenshot({ path: `${evidence}/qa-paint-erase-live.png`, fullPage: true })

  await page.getByRole('button', { name: /Frame/ }).click()
  const eastGrip = page.locator('svg rect[style*="-resize"]').nth(4)
  const eastBox = await eastGrip.boundingBox()
  assert(eastBox, 'east Frame grip must be visible')
  await page.mouse.move(eastBox.x + eastBox.width / 2, eastBox.y + eastBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(eastBox.x + eastBox.width / 2 + box.width, eastBox.y + eastBox.height / 2)
  await page.mouse.up()
  await page.getByRole('button', { name: /Blend/ }).click()
  const blendAfterOutgrowth = await page.locator('input[type=number]').inputValue()
  assert.equal(blendAfterOutgrowth, '0', 'Blend must remain zero after Frame outgrowth')
  await page.screenshot({ path: `${evidence}/qa-blend-zero-outgrown.png`, fullPage: true })
  assert.deepEqual(consoleProblems, [])

  console.log(JSON.stringify({
    pageUrl,
    edgeDefault: await edge.inputValue(),
    ranges: { swath: [0, 12], smoothing: [0, 100], loopClose: [0, 1] },
    shapeHashes,
    shapeHistoryTick: shapeTick,
    eraseHashes,
    eraseHistoryTick: eraseTick,
    blendAfterOutgrowth,
    consoleProblems,
    screenshotSha256: Object.fromEntries(['qa-paint-shape-live.png', 'qa-paint-erase-live.png', 'qa-blend-zero-outgrown.png'].map((file) => [file, createHash('sha256').update(readFileSync(`${evidence}/${file}`)).digest('hex')])),
  }))
} finally {
  await context.close()
  await browser.close()
}
