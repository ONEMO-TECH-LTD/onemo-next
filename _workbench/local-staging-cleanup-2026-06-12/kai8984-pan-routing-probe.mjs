// KAI-8984 self-verify probe — the FIRST drag inside the shape after switching to Image·Position
// must pan the PHOTO, not move the outline (stale-closure routing). Asserts: photo transform
// appears · outline path unchanged · editor Undo stays disabled (a pure pan is not a shape commit).
import { chromium } from 'playwright-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(2) }

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:' + (process.env.PORT ?? '3004') + '/effect-creator/v3', { waitUntil: 'networkidle' })
await page.evaluate(async () => {
  const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#cdbfa5'; ctx.fillRect(0, 0, 1200, 900)
  ctx.fillStyle = '#2b2f3c'; ctx.beginPath(); ctx.ellipse(600, 450, 260, 300, 0, 0, Math.PI * 2); ctx.fill()
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.png', { type: 'image/png' }))
  const input = document.querySelector('input[type=file][accept="image/*"]')
  input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForSelector('button[aria-label="Editor"]:not([disabled])', { timeout: 30000 })

// the EXACT repro: open editor (Shape mode) → Image → Position → first drag, nothing in between
// that would re-create the pointer handler (no shape change, no zoom, no preview toggle)
{
  const topEdit = page.locator('button[title="Editor"]')
  if (await topEdit.count()) await topEdit.click()
  else await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
}
await page.waitForSelector('button[aria-label="Close"]')
await sleep(300)
await (async () => { // KAI-9027: image mode is entered from the hero (Filters)
  if (await page.locator('button[aria-label="Close"]').count()) {
    await page.locator('button[aria-label="Close"]').click(); await sleep(250)
    const d = page.locator('[class*="discardBtn"]'); if (await d.count()) { await d.click(); await sleep(300) }
  }
  await page.locator('button[aria-label="Filters"]').click(); await sleep(350)
})()
await sleep(150)
{
  const pos = page.locator('[class*="overlay"] button[aria-label="Position"]')
  if (await pos.count()) { await pos.click(); await sleep(150) } // P9: position became a pure gesture
}

const snap = () => page.evaluate(() => ({
  outlineD: document.querySelector('[class*="canvas"] svg [class*="path"]')?.getAttribute('d') ?? '',
  photoT: document.querySelector('[class*="canvas"] svg image')?.parentElement?.getAttribute('transform') ?? null,
  undoDisabled: document.querySelector('[class*="overlay"] button[aria-label="Undo"]')?.disabled ?? null,
}))
const before = await snap()
if (before.photoT) fail('photo already transformed before the drag (probe assumption broken)')

// FIRST drag inside the shape
const svgB = await page.locator('[class*="canvas"] svg').boundingBox()
await page.mouse.move(svgB.x + svgB.width / 2, svgB.y + svgB.height / 2)
await page.mouse.down()
await page.mouse.move(svgB.x + svgB.width / 2 + 130, svgB.y + svgB.height / 2 + 60, { steps: 12 })
await page.mouse.up()
await sleep(300)
const after = await snap()

if (!after.photoT) fail('FIRST drag after mode switch did NOT pan the photo (the stale-closure bug)')
if (after.outlineD !== before.outlineD) fail('the drag MOVED THE OUTLINE — shape changed on an image-mode pan')
if (after.undoDisabled !== true) fail(`a pure pan registered as a shape commit (editor Undo enabled)`)
console.log(`first drag panned the photo (${after.photoT.slice(0, 38)}…), outline unchanged, Undo still disabled`)

// regression guard: shape-mode drag-inside still moves the shape (the routing went the other way)
await page.locator('button[aria-label="Close"]').click()
await sleep(300)
{
  const topEdit = page.locator('button[title="Editor"]')
  if (await topEdit.count()) await topEdit.click()
  else await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
}
await page.waitForSelector('button[aria-label="Close"]')
await sleep(300)
const b2 = await snap()
await page.mouse.move(svgB.x + svgB.width / 2, svgB.y + svgB.height / 2)
await page.mouse.down()
await page.mouse.move(svgB.x + svgB.width / 2 - 90, svgB.y + svgB.height / 2 - 40, { steps: 10 })
await page.mouse.up()
await sleep(300)
const a2 = await snap()
if (a2.outlineD === b2.outlineD) fail('shape-mode drag-inside no longer moves the shape (over-fix)')
if (a2.photoT) fail('shape-mode drag panned the photo (routing inverted)')
console.log('shape-mode drag still moves the shape — routing correct both ways')

await page.locator('button[aria-label="Close"]').click()
if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nKAI-8984 PROBE: ALL PASS (zero page errors)')
await browser.close()
