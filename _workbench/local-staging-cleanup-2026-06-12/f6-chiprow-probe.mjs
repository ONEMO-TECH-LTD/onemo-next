// KAI-8978 / F6 self-verify probe — chip-row mouse drag must SCROLL (not select text), the row's
// tail (Upload chip) must become reachable, a post-drag click must not mis-fire a chip, and canvas
// drags must not select hint words.
import { chromium } from 'playwright-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(2) }

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
// narrow viewport so the chip row genuinely overflows (the desktop-tail repro)
const page = await browser.newPage({ viewport: { width: 760, height: 860 } })
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
{
  const topEdit = page.locator('button[title="Editor"]')
  if (await topEdit.count()) await topEdit.click()
  else await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
}
await page.waitForSelector('button[aria-label="Close"]')
await sleep(300)

const row = page.locator('[class*="chipRow"]').first()
const rb = await row.boundingBox()
const scrollState = () => page.evaluate(() => {
  const el = document.querySelector('[class*="chipRow"]')
  return { left: el.scrollLeft, max: el.scrollWidth - el.clientWidth }
})
const s0 = await scrollState()
if (s0.max < 40) fail(`chip row does not overflow at 760px (max scroll ${s0.max}) — repro invalid`)

// ── leg 1: mouse drag across the row → scrolls, selects nothing
const activeBefore = await page.evaluate(() => document.querySelector('[class*="chipActive"]')?.textContent ?? null)
await page.mouse.move(rb.x + rb.width - 30, rb.y + rb.height / 2)
await page.mouse.down()
await page.mouse.move(rb.x + 30, rb.y + rb.height / 2, { steps: 14 }) // drag left = scroll right
await page.mouse.up()
await sleep(200)
const sel = await page.evaluate(() => String(getSelection()))
const s1 = await scrollState()
const activeAfter = await page.evaluate(() => document.querySelector('[class*="chipActive"]')?.textContent ?? null)
if (sel.length) fail(`drag selected text: "${sel.slice(0, 40)}"`)
if (s1.left <= s0.left + 40) fail(`drag did not scroll the row (scrollLeft ${s0.left} → ${s1.left})`)
if (activeBefore !== activeAfter) fail(`the drag's trailing click mis-fired a chip (${activeBefore} → ${activeAfter})`)
console.log(`drag scrolled the row ${s0.left} → ${s1.left}px, zero selection, no chip mis-fire`)

// ── leg 2: the tail (Upload) becomes reachable — keep dragging, then click it
for (let i = 0; i < 6; i++) {
  const st = await scrollState()
  if (st.left >= st.max - 4) break
  await page.mouse.move(rb.x + rb.width - 30, rb.y + rb.height / 2)
  await page.mouse.down()
  await page.mouse.move(rb.x + 30, rb.y + rb.height / 2, { steps: 10 })
  await page.mouse.up()
  await sleep(150)
}
const upload = page.locator('[class*="chip"]', { hasText: 'Upload' }).last()
const ub = await upload.boundingBox()
if (!ub || ub.x < rb.x - 5 || ub.x + ub.width > rb.x + rb.width + 5) fail('Upload chip still outside the visible row after drag-scrolling to the end')
console.log(`Upload chip reachable at x=${Math.round(ub.x)} (row ends ${Math.round(rb.x + rb.width)})`)

// ── leg 3: canvas drag selects no hint words
const svgB = await page.locator('[class*="canvas"] svg').boundingBox()
await page.mouse.move(svgB.x + 40, svgB.y + svgB.height - 20)
await page.mouse.down()
await page.mouse.move(svgB.x + svgB.width - 40, svgB.y + svgB.height - 10, { steps: 10 })
await page.mouse.up()
await sleep(150)
const sel2 = await page.evaluate(() => String(getSelection()))
if (sel2.length) fail(`canvas drag selected text: "${sel2.slice(0, 40)}"`)
console.log('canvas drag: zero selection')

await page.screenshot({ path: '/tmp/f6-chiprow-tail-reachable.png' })
if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nF6 PROBE: ALL PASS (zero page errors)')
await browser.close()
