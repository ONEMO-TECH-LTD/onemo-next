// KAI-8974/F3b live census — anchor counts on the REAL editor shapes (daisy + uploaded ellipse),
// fab-qa's metric: daisy reopened with ~34+ anchors, ~18 would carry it.
import { chromium } from 'playwright-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
{
  const topEdit = page.locator('button[title="Editor"]')
  if (await topEdit.count()) await topEdit.click()
  else await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
}
await page.waitForSelector('button[aria-label="Close"]')
await sleep(300)

const anchorCount = async () => {
  // Points toggle shows the skeleton; anchors render as circle.node (handles only on selection)
  const shown = await page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle').length)
  if (shown === 0) {
    const pts = page.locator('button[aria-label="Points"]')
    if (await pts.count()) await pts.click()
    else { const b = await page.locator('[class*="canvas"] svg').boundingBox(); await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2) }
    await sleep(250)
  }
  const n = await page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle').length)
  return n
}

// daisy via the real chip
await page.locator('button[aria-label^="Daisy"]').first().click()
await sleep(400)
const daisy = await anchorCount()
const minPair = await page.evaluate(() => {
  const cs = [...document.querySelectorAll('[class*="canvas"] svg circle')].map((c) => [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))])
  let min = Infinity
  for (let i = 0; i < cs.length; i++) {
    const b = cs[(i + 1) % cs.length]
    const d = Math.hypot(cs[i][0] - b[0], cs[i][1] - b[1])
    if (d < min) min = d
  }
  return Math.round(min * 10) / 10
})
console.log(`DAISY anchors: ${daisy}, min adjacent pair: ${minPair}px  (fab-qa returner: 5px/10px doubles)`)
await page.screenshot({ path: '/tmp/f3b-daisy-anchors.png' })

// a Magic-class trace via image upload (ellipse) — the other over-emission family
if (!(await page.locator('[class*="chipRow"]').count())) {
  await page.locator('[class*="overlay"] button[aria-label="Shape"]').click()
  await sleep(200)
}
await page.evaluate(async () => {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 640
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 640, 640)
  ctx.fillStyle = '#101418'; ctx.beginPath(); ctx.ellipse(320, 320, 240, 180, 0, 0, Math.PI * 2); ctx.fill()
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'e.png', { type: 'image/png' }))
  const inputs = [...document.querySelectorAll('input[type=file]')]
  const si = inputs.find((i) => (i.getAttribute('accept') || '').includes('svg'))
  si.files = dt.files; si.dispatchEvent(new Event('change', { bubbles: true }))
})
await sleep(700)
const ell = await anchorCount()
console.log(`UPLOADED-ELLIPSE anchors: ${ell}  (was 29 pre-compaction)`)
await page.screenshot({ path: '/tmp/f3b-ellipse-anchors.png' })

console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'zero page errors')
await browser.close()
