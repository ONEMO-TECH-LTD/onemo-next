import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const url = process.env.CUTOUT_V1_BASE_URL ?? 'http://127.0.0.1:3220/cutout-lab?admin=1'
const fixture = '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.codex/worktrees/s62-pixel-v1-050d557e/public/assets/test-artwork.png'
const evidenceDir = '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.codex/worktrees/s62-pixel-v1-050d557e/_WIP/context/QA-space/evidence/KAI-10220-16a7c02'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await context.newPage()
const consoleProblems = []
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`)
})

const status = page.locator('p').filter({ hasText: 'Status:' })
const canvas = page.locator('canvas').first()
const draw = async (points) => {
  await page.mouse.move(points[0].x, points[0].y)
  await page.mouse.down()
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 8 })
  await page.mouse.up()
}
const selectSmooth = async () => {
  await page.getByRole('button', { name: /Vector/ }).click()
  await page.getByRole('button', { name: 'smooth', exact: true }).click()
  return page.locator('input[type=number]')
}

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.locator('input[type=file]').first().setInputFiles(fixture)
  await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })

  let box = await canvas.boundingBox()
  assert(box)
  await page.getByRole('button', { name: /Add/ }).click()
  await draw([
    { x: box.x + box.width * 0.43, y: box.y + box.height * 0.47 },
    { x: box.x + box.width * 0.58, y: box.y + box.height * 0.54 },
  ])
  await status.filter({ hasText: /shape recognised/ }).waitFor({ timeout: 60_000 })

  let knob = await selectSmooth()
  await knob.fill('37')
  assert.equal(await knob.inputValue(), '37')
  await page.getByRole('button', { name: /Edit/ }).click()
  knob = await selectSmooth()
  assert.equal(await knob.inputValue(), '37', 'tab clicks changed the Cutout recipe')

  await page.getByRole('button', { name: /Edit/ }).click()
  await page.getByRole('button', { name: /Paint shape/ }).click()
  const swath = page.getByRole('slider', { name: 'Paint swath width' })
  assert.equal(await swath.inputValue(), '1', 'Paint swath default is not 1x')
  box = await canvas.boundingBox()
  assert(box)
  await draw([
    { x: box.x + box.width * 0.35, y: box.y + box.height * 0.35 },
    { x: box.x + box.width * 0.35, y: box.y + box.height * 0.65 },
    { x: box.x + box.width * 0.65, y: box.y + box.height * 0.65 },
    { x: box.x + box.width * 0.65, y: box.y + box.height * 0.35 },
  ])
  await status.filter({ hasText: /auto-tuned|painted shape created/ }).waitFor({ timeout: 60_000 })
  knob = await selectSmooth()
  assert.equal(await knob.inputValue(), '0', 'accepted Paint did not select the clean recipe')
  await page.screenshot({ path: `${evidenceDir}/qa-paint-clean-recipe.png`, fullPage: true })

  await knob.fill('23')
  await page.getByRole('button', { name: /Clear/ }).click()
  await status.filter({ hasText: /cleared/ }).waitFor({ timeout: 10_000 })
  await page.getByRole('button', { name: /AI/ }).click()
  await page.getByRole('button', { name: /Add/ }).click()
  box = await canvas.boundingBox()
  assert(box)
  await draw([
    { x: box.x + box.width * 0.43, y: box.y + box.height * 0.47 },
    { x: box.x + box.width * 0.58, y: box.y + box.height * 0.54 },
  ])
  await status.filter({ hasText: /shape recognised/ }).waitFor({ timeout: 60_000 })
  knob = await selectSmooth()
  assert.equal(await knob.inputValue(), '37', 'accepted GrabCut did not restore the prior Cutout recipe')
  await page.screenshot({ path: `${evidenceDir}/qa-cutout-restored-recipe.png`, fullPage: true })

  await page.getByRole('button', { name: /Undo/ }).click()
  await status.filter({ hasText: /restored previous cut/ }).waitFor({ timeout: 60_000 })
  knob = await selectSmooth()
  assert.equal(await knob.inputValue(), '23', 'Undo did not restore Paint source recipe truth')
  await page.getByRole('button', { name: /Redo/ }).click()
  await status.filter({ hasText: /restored next cut/ }).waitFor({ timeout: 60_000 })
  knob = await selectSmooth()
  assert.equal(await knob.inputValue(), '37', 'Redo did not restore Cutout source recipe truth')
  await page.screenshot({ path: `${evidenceDir}/qa-source-history-redo.png`, fullPage: true })

  assert.deepEqual(consoleProblems, [])
  console.log(JSON.stringify({
    url: page.url(), swath: 1, paintSmooth: 0, tunedPaintSmooth: 23,
    restoredCutoutSmooth: 37, undoPaintSmooth: 23, redoCutoutSmooth: 37,
    consoleProblems,
  }))
} finally {
  await context.close()
  await browser.close()
}
