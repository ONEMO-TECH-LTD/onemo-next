// KAI-8998 self-verify — at 390pt the Trim takeover must fit the viewport: bar within bounds,
// "Pick a custom color" reachable (scroll the row to the end) and fully on-screen, ✕/✓ visible.
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(2) }

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
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
await page.locator('button[aria-label="Trim"]').click()
await sleep(350)

const bar = await page.locator('[aria-label="Trim — back material color"]').boundingBox()
if (!bar) fail('trim bar not found')
if (bar.x < -0.5 || bar.x + bar.width > 390.5) fail(`bar exceeds the 390 viewport (${bar.x.toFixed(1)}..${(bar.x + bar.width).toFixed(1)})`)
const acts = await Promise.all(['Cancel trim', 'Done — keep this color'].map((l) => page.locator(`button[aria-label="${l}"]`).boundingBox()))
for (const a of acts) if (!a || a.x < -0.5 || a.x + a.width > 390.5) fail('✕/✓ action not fully visible at 390')

// scroll the swatch row to its end → the picker must be FULLY inside the viewport and clickable
await page.evaluate(() => {
  const row = document.querySelector('[aria-label="Trim — back material color"] [class*="row"]')
  row.scrollLeft = row.scrollWidth
})
await sleep(250)
const pk = await page.locator('button[aria-label="Pick a custom color"]').boundingBox()
if (!pk) fail('custom-color picker button not found')
if (pk.x < -0.5 || pk.x + pk.width > 390.5) fail(`picker still clips at 390 (${pk.x.toFixed(1)}..${(pk.x + pk.width).toFixed(1)})`)
console.log(`bar ${bar.x.toFixed(1)}..${(bar.x + bar.width).toFixed(1)} · picker ${pk.x.toFixed(1)}..${(pk.x + pk.width).toFixed(1)} — all within 390`)

// the picker must actually drive the native input (custom color commits + shows selected)
await page.locator('button[aria-label="Pick a custom color"]').click()
await page.evaluate(() => {
  const inp = document.querySelector('input[aria-label="Custom color picker"]')
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(inp, '#12ab34'); inp.dispatchEvent(new Event('change', { bubbles: true }))
})
await sleep(250)
const pickedSelected = await page.evaluate(() => document.querySelector('button[aria-label="Pick a custom color"]')?.className.includes('Selected'))
if (!pickedSelected) fail('custom color did not register as the selection')
await page.screenshot({ path: '/tmp/kai8998-trim-390.png' })
if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nKAI-8998 PROBE: ALL PASS (zero page errors)')
await browser.close()
