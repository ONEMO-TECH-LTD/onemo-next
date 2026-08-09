import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

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
const clearButton = page.getByRole('button', { name: /Clear/ })
const undoButton = page.getByRole('button', { name: /Undo/ })
const redoButton = page.getByRole('button', { name: /Redo/ })
const historyHeading = page.getByRole('heading', { name: 'Cutout Lab' })
const canvas = page.locator('canvas').first()

const historyTick = async () => Number(await historyHeading.getAttribute('data-hist'))
const waitForHistory = async (tick) => page.waitForFunction(
  (value) => Number(document.querySelector('h1[data-hist]')?.getAttribute('data-hist')) === value,
  tick,
)
const upload = async (file = fixturePath) => {
  await page.locator('input[type=file]').first().setInputFiles(file)
  await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
}
const tap = async (point) => {
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.up()
}
const download = async () => {
  const pending = page.waitForEvent('download', { timeout: 60_000 })
  await saveButton.click()
  const result = await pending
  return readFileSync(await result.path())
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

try {
  await page.goto(new URL('/cutout-lab', baseUrl).href, { waitUntil: 'networkidle' })
  await upload()
  await page.getByRole('button', { name: /^✋ Edit$/ }).click()
  await page.getByRole('button', { name: /Paint shape/ }).click()
  const box = await canvas.boundingBox()
  assert(box, 'working canvas must be visible')
  const point = (x, y) => ({ x: box.x + box.width * x, y: box.y + box.height * y })

  // One-point Paint is visible, accepted, and becomes non-undoable snapshot zero.
  const firstTick = await historyTick()
  await tap(point(0.50, 0.52))
  await status.filter({ hasText: /painted shape created/ }).waitFor({ timeout: 60_000 })
  await waitForHistory(firstTick + 1)
  assert.equal(await saveButton.isDisabled(), false, 'one-point Paint must create a savable cut')
  assert.equal(await undoButton.isDisabled(), true, 'standalone Paint must be non-undoable snapshot zero')
  await page.waitForTimeout(1_000)
  const beforeCorrupt = await download()

  // A corrupt replacement changes no accepted artwork, history, cut, or output.
  const beforeCorruptTick = await historyTick()
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from('not a png'),
  })
  await status.filter({ hasText: /could not open image.*current artwork kept/ }).waitFor({ timeout: 30_000 })
  assert.equal(await historyTick(), beforeCorruptTick, 'corrupt replacement must not reset or append history')
  assert.equal(await saveButton.isDisabled(), false, 'corrupt replacement must retain the accepted cut')
  const afterCorrupt = await download()
  assert.deepEqual(afterCorrupt, beforeCorrupt, 'corrupt replacement must retain exact output bytes')

  // Three rapidly accepted Paint gestures settle once each in capture order.
  await page.evaluate(() => {
    window.__cutoutStatuses = []
    const line = [...document.querySelectorAll('p')].find((node) => node.textContent?.includes('Status:'))
    new MutationObserver(() => window.__cutoutStatuses.push(line?.textContent ?? '')).observe(line, { childList: true, subtree: true, characterData: true })
  })
  const burstTick = await historyTick()
  await tap(point(0.48, 0.52))
  await page.getByRole('button', { name: /Paint erase/ }).click()
  await tap(point(0.48, 0.52))
  await page.getByRole('button', { name: /Paint shape/ }).click()
  await tap(point(0.56, 0.52))
  await waitForHistory(burstTick + 3)
  const terminals = await page.evaluate(() => window.__cutoutStatuses.filter((entry) => /added — auto-tuned|erased — auto-tuned/.test(entry)))
  assert.deepEqual(
    terminals.slice(-3).map((entry) => entry.includes('erased') ? 'erase' : 'add'),
    ['add', 'erase', 'add'],
    'burst Paint gestures must complete once each in capture order',
  )

  // Pointer cancellation routes through the existing commit path exactly once.
  const cancelTick = await historyTick()
  const cancelPoint = point(0.60, 0.50)
  await page.mouse.move(cancelPoint.x, cancelPoint.y)
  await page.mouse.down()
  await canvas.dispatchEvent('pointercancel', { pointerId: 1, clientX: cancelPoint.x, clientY: cancelPoint.y })
  await page.mouse.up()
  await waitForHistory(cancelTick + 1)
  await page.waitForTimeout(250)
  assert.equal(await historyTick(), cancelTick + 1, 'pointer cancellation must commit exactly once')

  // A committed node drag becomes the base for the next node adjustment.
  await page.getByRole('button', { name: /Nodes/ }).click()
  // The last SVG target is topmost, so dense edge-finished anchors cannot intercept its drag.
  const nodeTarget = page.locator('svg circle[fill="transparent"]').last()
  const nodeBox = await nodeTarget.boundingBox()
  assert(nodeBox, 'node drag target must be visible')
  const beforeNode = { x: Number(await nodeTarget.getAttribute('cx')), y: Number(await nodeTarget.getAttribute('cy')) }
  const nodeTick = await historyTick()
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(nodeBox.x + nodeBox.width / 2 + 14, nodeBox.y + nodeBox.height / 2 + 8)
  await page.mouse.up()
  await waitForHistory(nodeTick + 1)
  const moved = { x: Number(await nodeTarget.getAttribute('cx')), y: Number(await nodeTarget.getAttribute('cy')) }
  await page.getByRole('button', { name: /^curve$/ }).click()
  const knob = page.locator('input[type=number]').first()
  const adjustmentTick = await historyTick()
  await knob.fill(String(Number(await knob.inputValue()) + 3))
  await waitForHistory(adjustmentTick + 1)
  const adjusted = { x: Number(await nodeTarget.getAttribute('cx')), y: Number(await nodeTarget.getAttribute('cy')) }
  assert(
    Math.hypot(adjusted.x - moved.x, adjusted.y - moved.y) < 0.01
      && Math.hypot(adjusted.x - beforeNode.x, adjusted.y - beforeNode.y) > 1,
    'node adjustment must retain the committed drag instead of reverting to its pre-drag base',
  )

  const overlayCancelTick = await historyTick()
  const adjustedBox = await nodeTarget.boundingBox()
  assert(adjustedBox, 'adjusted node target must remain visible')
  await page.mouse.move(adjustedBox.x + adjustedBox.width / 2, adjustedBox.y + adjustedBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(adjustedBox.x + adjustedBox.width / 2 + 6, adjustedBox.y + adjustedBox.height / 2 + 4)
  await nodeTarget.evaluate((node) => node.closest('svg')?.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 })))
  await page.mouse.up()
  await waitForHistory(overlayCancelTick + 1)
  await page.waitForTimeout(250)
  assert.equal(await historyTick(), overlayCancelTick + 1, 'overlay pointer cancellation must commit exactly once')

  // Long edit -> Clear -> Undo restores; Redo clears without adding history.
  await clearButton.click()
  await status.filter({ hasText: /cleared/ }).waitFor()
  assert.equal(await saveButton.isDisabled(), true, 'Clear must remove the edited cut')
  await undoButton.click()
  await status.filter({ hasText: /restored previous cut/ }).waitFor({ timeout: 60_000 })
  assert.equal(await saveButton.isDisabled(), false, 'Undo must restore the long-edited cut')
  const restoredTick = await historyTick()
  await redoButton.click()
  await status.filter({ hasText: /restored next cut/ }).waitFor({ timeout: 60_000 })
  assert.equal(await historyTick(), restoredTick + 1, 'Redo must move the cursor without appending a snapshot')
  assert.equal(await saveButton.isDisabled(), true, 'Redo must restore Clear')

  // Force restore preparation to fail; the accepted Clear state and history cursor stay intact.
  await page.evaluate(() => {
    const proto = HTMLCanvasElement.prototype
    const original = proto.getContext
    proto.getContext = function (...args) {
      if (!this.isConnected) {
        proto.getContext = original
        throw new Error('forced restore prepare failure')
      }
      return original.apply(this, args)
    }
    const undo = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Undo'))
    undo?.click()
  })
  await status.filter({ hasText: /history restore failed.*current state kept/ }).waitFor({ timeout: 60_000 })
  assert.equal(await saveButton.isDisabled(), true, 'failed restore must leave the current Clear state unchanged')
  assert.equal(await undoButton.isDisabled(), false, 'failed restore must roll the history cursor back')

  // Detect and standalone GrabCut each become the same non-undoable first snapshot after Upload.
  await upload({ name: 'detect.png', mimeType: 'image/png', buffer: fixture })
  await page.getByRole('button', { name: /^🤖 AI$/ }).click()
  await page.getByRole('button', { name: /Detect/ }).click()
  await status.filter({ hasText: /done \(cut: u2netp\)/ }).waitFor({ timeout: 180_000 })
  assert.equal(await undoButton.isDisabled(), true, 'Detect must be non-undoable snapshot zero')

  await upload({ name: 'grabcut.png', mimeType: 'image/png', buffer: fixture })
  await page.getByRole('button', { name: /Add/ }).click()
  const grabBox = await canvas.boundingBox()
  assert(grabBox, 'GrabCut canvas must be visible')
  await page.mouse.move(grabBox.x + grabBox.width * 0.42, grabBox.y + grabBox.height * 0.52)
  await page.mouse.down()
  await page.mouse.move(grabBox.x + grabBox.width * 0.58, grabBox.y + grabBox.height * 0.52, { steps: 8 })
  await page.mouse.up()
  await status.filter({ hasText: /shape recognised/ }).waitFor({ timeout: 60_000 })
  assert.equal(await undoButton.isDisabled(), true, 'standalone GrabCut must be non-undoable snapshot zero')

  // Replacement invalidates an active/queued tool generation; stale work cannot republish or overwrite status.
  await page.getByRole('button', { name: /^✋ Edit$/ }).click()
  await page.getByRole('button', { name: /Paint shape/ }).click()
  const replacementBox = await canvas.boundingBox()
  assert(replacementBox, 'replacement-cancellation canvas must be visible')
  await tap({ x: replacementBox.x + replacementBox.width * 0.45, y: replacementBox.y + replacementBox.height * 0.48 })
  await tap({ x: replacementBox.x + replacementBox.width * 0.50, y: replacementBox.y + replacementBox.height * 0.48 })
  await tap({ x: replacementBox.x + replacementBox.width * 0.55, y: replacementBox.y + replacementBox.height * 0.48 })
  await upload({ name: 'tool-cancel-replacement.png', mimeType: 'image/png', buffer: fixture })
  await page.waitForTimeout(1_000)
  assert.equal(await saveButton.isDisabled(), true, 'replacement must receive no active or queued tool cut')
  assert.equal(await undoButton.isDisabled(), true, 'replacement must receive no active or queued tool history')
  assert.match(await status.textContent(), /image ready/, 'stale tool completion must not overwrite replacement status')

  assert.deepEqual(consoleProblems, [], 'flow/history/tool journey must have no console errors or warnings')
  if (process.env.CUTOUT_V1_EVIDENCE) await page.screenshot({ path: process.env.CUTOUT_V1_EVIDENCE, fullPage: true })
  console.log(JSON.stringify({
    viewport,
    corruptOutputSha256: sha256(afterCorrupt),
    burstOrder: terminals.slice(-3),
  }))
} finally {
  await context.close()
  await browser.close()
}
