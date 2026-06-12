// KAI-9014 guard (formerly the F7 hint-leak probe — hints are DEAD now): the status line stays
// EMPTY in every ordinary state; only the discard confirm (a control) and the can't-cut warning
// (a failure state) may ever render there. The Shape sheet renders no hint text either.
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(2) }

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:' + (process.env.PORT ?? '3006') + '/effect-creator/v3', { waitUntil: 'networkidle' })
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
await page.locator('button[aria-label="Editor"]').click()
await page.waitForSelector('button[aria-label="Close"]')
await sleep(300)

const statusText = () => page.evaluate(() => document.querySelector('[class*="status"]')?.textContent?.trim() ?? '')
const mustBeEmpty = async (state) => {
  const t = await statusText()
  if (t !== '') fail(`helper text in ${state}: "${t}" (KAI-9014: none is sanctioned)`)
}
await mustBeEmpty('fresh open')
const svgB = await page.locator('[class*="canvas"] svg').boundingBox()
await page.mouse.click(svgB.x + svgB.width / 2, svgB.y + svgB.height / 2) // select all
await sleep(250)
await mustBeEmpty('all-corners selected')
await page.locator('[class*="topbar"] button[aria-label="Points"]').click(); await sleep(250)
await mustBeEmpty('points mode')
if (!(await page.locator('button[aria-label^="Daisy"]').count())) {
  await page.locator('[class*="overlay"] button[aria-label="Shape"]').click(); await sleep(200)
}
await page.locator('button[aria-label^="Daisy"]').first().click(); await sleep(350)
await mustBeEmpty('generator state')
const sheetHints = await page.evaluate(() => document.querySelectorAll('[class*="shapeHint"], [class*="toolHint"]').length)
if (sheetHints) fail('sheet hint elements survived the sweep')
console.log('status empty in all four states · zero hint elements — the no-helper-text rule holds')
if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nKAI-9014 GUARD: ALL PASS (zero page errors)')
await browser.close()
