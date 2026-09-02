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
const canvas = page.locator('canvas').first()
const pngInfo = (bytes) => ({
  width: bytes.readUInt32BE(16),
  height: bytes.readUInt32BE(20),
  colorType: bytes[25],
  sha256: createHash('sha256').update(bytes).digest('hex'),
})
const numberAttr = async (locator, name) => Number(await locator.getAttribute(name))
const downloadCutout = async () => {
  const pending = page.waitForEvent('download', { timeout: 60_000 })
  await saveButton.click()
  const download = await pending
  return readFileSync(await download.path())
}
const upload = async (file) => {
  await page.locator('input[type=file]').first().setInputFiles(file)
  await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
}
const detect = async () => {
  await page.getByRole('button', { name: /^🤖 AI$/ }).click()
  await page.getByRole('button', { name: /Detect/ }).click()
  await status.filter({ hasText: /done \(cut: u2netp\)/ }).waitFor({ timeout: 180_000 })
}
const setDetail = async (value) => {
  await page.getByRole('button', { name: /Vector/ }).click()
  await page.locator('input[type=number]').fill(String(value))
  await page.waitForTimeout(500)
}
const enterPreview = async () => {
  const button = page.getByRole('button', { name: /Preview|Editing view/ })
  if ((await button.textContent())?.includes('Preview')) await button.click()
  await page.getByText('Preview — same result, cut out').waitFor()
}
const draw = async (points) => {
  await page.mouse.move(points[0].x, points[0].y)
  await page.mouse.down()
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 4 })
  await page.mouse.up()
}

try {
  await context.clearCookies()
  await page.goto(new URL('/cutout-lab?admin=1', baseUrl).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload({ waitUntil: 'networkidle' })

  // Primary Detect, Preview, Save, and same-byte replacement are one real-route oracle.
  await upload(fixturePath)
  await detect()
  await setDetail(25)
  // Cancellation: rapid accepted edits supersede/coalesce in-flight display work and the final Save settles.
  await page.locator('input[type=number]').fill('24')
  await page.locator('input[type=number]').fill('25')
  await enterPreview()
  const firstPng = await downloadCutout()
  const firstInfo = pngInfo(firstPng)
  assert.deepEqual(firstInfo, {
    width: 1725,
    height: 777,
    colorType: 6,
    sha256: '9a21d00e71d06849279017b1b719c9884e1e5270f3b3d066c691b564453ae018',
  }, '1280x720 original-resolution clean-start Detail-25 Save must retain its exact RGBA result')

  await upload({ name: 'replacement.png', mimeType: 'image/png', buffer: fixture })
  assert.equal(await saveButton.isDisabled(), true, 'replacement must clear the prior cut')
  await detect()
  await setDetail(25)
  await enterPreview()
  const replacementPng = await downloadCutout()
  assert.deepEqual(replacementPng, firstPng, 'same-byte replacement must produce the exact same output')
  await page.getByRole('button', { name: /Editing view/ }).click()

  // Frame: expose all eight resize targets; the east side keeps its opposite edge fixed.
  await page.getByRole('button', { name: /^✋ Edit$/ }).click()
  await page.getByRole('button', { name: /Frame/ }).click()
  const outline = page.locator('svg rect').first()
  const frameGrips = page.locator('svg rect[style*="-resize"]')
  assert.equal(await frameGrips.count(), 8, 'Frame must expose all eight resize targets')
  const eastGrip = frameGrips.nth(4)
  const beforeFrame = {
    x: await numberAttr(outline, 'x'), y: await numberAttr(outline, 'y'),
    width: await numberAttr(outline, 'width'), height: await numberAttr(outline, 'height'),
  }
  const eastBox = await eastGrip.boundingBox()
  assert(eastBox, 'east frame grip must be visible')
  await page.mouse.move(eastBox.x + eastBox.width / 2, eastBox.y + eastBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(eastBox.x + eastBox.width / 2 + 24, eastBox.y + eastBox.height / 2)
  await page.mouse.up()
  const afterFrame = {
    x: await numberAttr(outline, 'x'), y: await numberAttr(outline, 'y'),
    width: await numberAttr(outline, 'width'), height: await numberAttr(outline, 'height'),
  }
  assert(Math.abs(afterFrame.x - beforeFrame.x) < 0.01, 'east grip must anchor the west edge')
  assert(afterFrame.width > beforeFrame.width, 'east grip must enlarge the frame')
  assert(afterFrame.height > beforeFrame.height, 'locked aspect must scale both axes')
  assert(Math.abs((afterFrame.y + afterFrame.height / 2) - (beforeFrame.y + beforeFrame.height / 2)) < 0.01, 'east grip must keep the vertical centre fixed')
  assert.equal(await undoButton.isDisabled(), false, 'frame commit must enter history')
  await undoButton.click()
  await page.waitForFunction((width) => Number(document.querySelector('svg rect')?.getAttribute('width')) < width - 1, afterFrame.width)
  const undoFrameWidth = await numberAttr(outline, 'width')
  assert.equal(await redoButton.isDisabled(), false, 'frame undo must enable redo')
  await redoButton.click()
  await page.waitForFunction((width) => Number(document.querySelector('svg rect')?.getAttribute('width')) > width + 1, undoFrameWidth)

  // Nodes: the real overlay exposes finger-sized targets and moves the anchor with its handles.
  await page.getByRole('button', { name: /Nodes/ }).click()
  const nodeTargets = page.locator('svg circle[fill="transparent"]')
  assert(await nodeTargets.count() >= 3, 'Nodes must expose at least three editable anchors')
  const firstNode = nodeTargets.first()
  const beforeNode = { x: await numberAttr(firstNode, 'cx'), y: await numberAttr(firstNode, 'cy') }
  const nodeBox = await firstNode.boundingBox()
  assert(nodeBox, 'node drag target must be visible')
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(nodeBox.x + nodeBox.width / 2 + 10, nodeBox.y + nodeBox.height / 2 + 6)
  await page.mouse.up()
  const movedNode = page.locator('svg circle[fill="transparent"]').first()
  assert.notDeepEqual({ x: await numberAttr(movedNode, 'cx'), y: await numberAttr(movedNode, 'cy') }, beforeNode, 'node drag must move the selected anchor')

  // Paint + pointer-leave cancellation: leaving the canvas settles the captured gesture exactly once.
  await page.getByRole('button', { name: /Paint shape/ }).click()
  const canvasBox = await canvas.boundingBox()
  assert(canvasBox, 'paint canvas must be visible')
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.82, canvasBox.y + canvasBox.height * 0.48)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.90, canvasBox.y + canvasBox.height * 0.48, { steps: 4 })
  await page.mouse.move(canvasBox.x + canvasBox.width + 10, canvasBox.y + canvasBox.height * 0.48)
  await status.filter({ hasText: /added — auto-tuned|SEPARATE region/ }).waitFor({ timeout: 60_000 })
  await page.mouse.up()
  assert.equal(await saveButton.isDisabled(), false, 'Paint must preserve a savable cut')

  // GrabCut: execute the real lazy OpenCV brush path, not a mocked seam.
  await page.getByRole('button', { name: /AI/ }).click()
  await page.getByRole('button', { name: /Add/ }).click()
  await draw([
    { x: canvasBox.x + canvasBox.width * 0.48, y: canvasBox.y + canvasBox.height * 0.48 },
    { x: canvasBox.x + canvasBox.width * 0.56, y: canvasBox.y + canvasBox.height * 0.52 },
  ])
  await status.filter({ hasText: /added — snapped|nothing new|shape recognised/ }).waitFor({ timeout: 60_000 })
  await enterPreview()
  const editedInfo = pngInfo(await downloadCutout())
  assert.deepEqual(editedInfo, {
    width: 1833,
    height: 815,
    colorType: 6,
    sha256: '4b003b17e5b6a61665bb0d99c6a44f59e7ca8d3f466c8afed191631edc2e43f9',
  }, 'fixed-viewport original-resolution real OpenCV edit must retain its exact RGBA result')
  await page.getByRole('button', { name: /Editing view/ }).click()

  // A corner drag keeps its opposite corner fixed.
  await page.getByRole('button', { name: /^✋ Edit$/ }).click()
  await page.getByRole('button', { name: /Frame/ }).click()
  const beforeCorner = {
    x: await numberAttr(outline, 'x'), y: await numberAttr(outline, 'y'),
    width: await numberAttr(outline, 'width'), height: await numberAttr(outline, 'height'),
  }
  const southEastGrip = frameGrips.nth(7)
  const southEastBox = await southEastGrip.boundingBox()
  assert(southEastBox, 'south-east frame grip must be visible')
  await page.mouse.move(southEastBox.x + southEastBox.width / 2, southEastBox.y + southEastBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(southEastBox.x + southEastBox.width / 2 + 18, southEastBox.y + southEastBox.height / 2 + 12)
  await page.mouse.up()
  const afterCorner = {
    x: await numberAttr(outline, 'x'), y: await numberAttr(outline, 'y'),
    width: await numberAttr(outline, 'width'), height: await numberAttr(outline, 'height'),
  }
  assert(Math.abs(afterCorner.x - beforeCorner.x) < 0.01, 'south-east grip must anchor the north-west x')
  assert(Math.abs(afterCorner.y - beforeCorner.y) < 0.01, 'south-east grip must anchor the north-west y')
  assert(afterCorner.width > beforeCorner.width, 'south-east grip must enlarge the frame width')
  assert(afterCorner.height > beforeCorner.height, 'south-east grip must enlarge the frame height')

  // Clear is a history state; Undo restores it and Redo clears it again.
  await clearButton.click()
  await status.filter({ hasText: /cleared/ }).waitFor()
  assert.equal(await saveButton.isDisabled(), true, 'Clear must remove the cut')
  await undoButton.click()
  await page.waitForFunction(() => !document.querySelector('button')?.disabled)
  await saveButton.waitFor({ state: 'visible' })
  assert.equal(await saveButton.isDisabled(), false, 'Undo must restore the cleared cut')
  await redoButton.click()
  await page.waitForFunction(() => [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Save'))?.disabled === true)

  // Forced Silueta fallback: fail only u2netp in an isolated cold context and observe the real worker fallback.
  const fallbackContext = await browser.newContext({ viewport })
  let u2netFailures = 0
  let siluetaRequests = 0
  await fallbackContext.route('**/seg-models/u2netp.onnx', async (route) => { u2netFailures += 1; await route.abort('failed') })
  fallbackContext.on('request', (request) => { if (request.url().includes('/seg-models/silueta.onnx')) siluetaRequests += 1 })
  const fallbackPage = await fallbackContext.newPage()
  await fallbackPage.goto(new URL('/cutout-lab?admin=1', baseUrl).href, { waitUntil: 'networkidle' })
  await fallbackPage.locator('input[type=file]').first().setInputFiles(fixturePath)
  await fallbackPage.locator('p').filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
  await fallbackPage.getByRole('button', { name: /Detect/ }).click()
  await fallbackPage.locator('p').filter({ hasText: /done \(cut: silueta\)/ }).waitFor({ timeout: 180_000 })
  assert(u2netFailures > 0, 'forced fallback must fail the primary u2netp request')
  assert(siluetaRequests > 0, 'forced fallback must lazily request Silueta')
  await fallbackContext.close()

  assert.deepEqual(consoleProblems, [], 'real-route preservation journey must have no console errors or warnings')
  console.log(JSON.stringify({ viewport, firstInfo, editedInfo, replacementSha256: pngInfo(replacementPng).sha256, u2netFailures, siluetaRequests }))
} finally {
  await context.close()
  await browser.close()
}
