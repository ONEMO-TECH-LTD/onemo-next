// KAI-9033 self-verify — the v1-recovery sharp⇄round capability: whole-shape Smooth at 0% lands
// a sharp/angular fit (more structure, raw-trace character); 100% lands a visibly rounder fit
// (fewer anchors). Driven on a Magic cut through the unified Adjust row.
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
  ctx.fillStyle = '#2b3550'; ctx.beginPath(); ctx.ellipse(600, 450, 260, 300, 0, 0, Math.PI * 2); ctx.fill()
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.png', { type: 'image/png' }))
  const input = document.querySelector('input[type=file][accept="image/*"]')
  input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForSelector('button[aria-label="Editor"]:not([disabled])', { timeout: 30000 })
await page.locator('button[aria-label="Magic"]').click()
await page.waitForSelector('[class*="shimmer"]', { timeout: 15000 }).catch(() => {})
const t0 = Date.now()
while (Date.now() - t0 < 90000) { if (!(await page.locator('[class*="shimmer"]').count())) break; await sleep(1500) }
await sleep(1000)
await page.locator('button[title="Editor"]').click()
await page.waitForSelector('button[aria-label="Close"]')
await sleep(400)

const stats = () => page.evaluate(() => {
  const d = document.querySelector('[class*="canvas"] svg path[class*="path"]')?.getAttribute('d') ?? ''
  return { curves: (d.match(/C/g) ?? []).length, d: d.slice(0, 60) }
})
const smoothTo = async (frac) => {
  if (!(await page.locator('[class*="shapeSheet"] button[aria-label="Smooth"]').count())) {
    await page.locator('[class*="overlay"] button[aria-label="Adjust"]').click(); await sleep(300)
  }
  await page.locator('[class*="shapeSheet"] button[aria-label="Smooth"]').click(); await sleep(300)
  const r = await page.locator('[aria-label="Smooth"][aria-valuenow]').first().boundingBox()
  if (!r) fail('Smooth ruler not found')
  await page.mouse.move(r.x + r.width * 0.5, r.y + r.height / 2)
  await page.mouse.down()
  await page.mouse.move(r.x + r.width * frac, r.y + r.height / 2, { steps: 10 })
  await page.mouse.up()
  await sleep(700)
  return Number(await page.locator('[aria-label="Smooth"][aria-valuenow]').first().getAttribute('aria-valuenow'))
}

const sharpVal = await smoothTo(0.02) // drag to the sharp end
const sharp = await stats()
if (sharpVal > 8) fail(`Smooth did not reach the sharp end (reads ${sharpVal})`)
const roundVal = await smoothTo(0.98) // then the round end
const round = await stats()
if (roundVal < 92) fail(`Smooth did not reach the round end (reads ${roundVal})`)
console.log(`sharp end (${Math.round(sharpVal)}%): ${sharp.curves} curve segs · round end (${Math.round(roundVal)}%): ${round.curves}`)
if (sharp.d === round.d) fail('Smooth 0% and 100% produced the SAME path — the dial has no range')
if (!(sharp.curves > round.curves)) fail(`sharp end (${sharp.curves}) does not carry more structure than round (${round.curves}) — v1 sharp⇄round semantics missing`)
console.log('whole-shape sharp ⇄ round recovered (v1 parity): 0% = angular/raw, 100% = round')
if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nKAI-9033 PROBE: ALL PASS (zero page errors)')
await browser.close()
