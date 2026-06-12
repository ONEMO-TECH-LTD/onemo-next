// KAI-9032 self-verify — Tune on a picked vector shape must edit IN PLACE, never convert it
// back to the Magic cut. Repro: Magic (spec gains rawTracePx) → pick Heart → Tune commit →
// the shape must remain heart-class (bbox ≈ heart), not the photo-subject fit.
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

// Magic (headless = flood-fill fallback; watchdog 90s) — wait for the shimmer to appear,
// then for it to fully leave (it intercepts pointer events while running)
await page.locator('button[aria-label="Magic"]').click()
await page.waitForSelector('[class*="shimmer"]', { timeout: 15000 }).catch(() => {})
const t0 = Date.now()
while (Date.now() - t0 < 90000) {
  if (!(await page.locator('[class*="shimmer"]').count())) break
  await sleep(1500)
}
if (await page.locator('[class*="shimmer"]').count()) fail('Magic never completed within 90s (headless watchdog)')
await sleep(1000)

// open the editor on the magic cut
await page.locator('button[title="Editor"]').click()
await page.waitForSelector('button[aria-label="Close"]')
await sleep(400)
const bbox = () => page.evaluate(() => {
  const el = document.querySelector('[class*="canvas"] svg path[class*="path"]')
  if (!el) return null
  const b = el.getBBox(); return { w: Math.round(b.width), h: Math.round(b.height) }
})
const bMagic = await bbox()
if (!bMagic) fail('no committed path after Magic')

// ── leg 1: Tune the MAGIC cut itself — must keep tracking the raw trace (quality source)
await page.screenshot({ path: '/tmp/kai9032-diag-postopen.png' })
const tuneDrag = async (frac) => {
  // clicking the ACTIVE mode pill toggles its sheet closed — only click Adjust when its row is absent
  if (!(await page.locator('[class*="shapeSheet"] button[aria-label="Detail"]').count())) {
    await page.locator('[class*="overlay"] button[aria-label="Adjust"]').click({ timeout: 8000 }).catch(() => {})
    await sleep(300)
  }
  await page.locator('[class*="shapeSheet"] button[aria-label="Detail"]').first().click({ timeout: 8000 }).catch(async () => {
    await page.screenshot({ path: '/tmp/kai9032-diag-tune.png' })
    const labels = await page.evaluate(() => [...document.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label')).join(','))
    fail('Detail chip not clickable; labels: ' + labels)
  })
  await sleep(350)
  const r = await page.locator('[aria-label="Detail"][aria-valuenow]').first().boundingBox()
  if (!r) fail('Detail ruler not found in the Tune takeover')
  await page.mouse.move(r.x + r.width * 0.5, r.y + r.height / 2)
  await page.mouse.down()
  await page.mouse.move(r.x + r.width * frac, r.y + r.height / 2, { steps: 8 })
  await page.mouse.up()
  await sleep(600)
}
await tuneDrag(0.62)
const bMagicTuned = await bbox()
const close = (a, b, tol) => Math.abs(a.w - b.w) <= tol && Math.abs(a.h - b.h) <= tol
if (!close(bMagicTuned, bMagic, 60)) fail(`Tune on the magic cut stopped tracking the raw trace (${bMagicTuned.w}x${bMagicTuned.h} vs ${bMagic.w}x${bMagic.h})`)
console.log(`magic-cut Tune re-fairs the raw trace (${bMagic.w}x${bMagic.h} → ${bMagicTuned.w}x${bMagicTuned.h})`)

// ── leg 2: pick Heart, Tune again — must edit the heart IN PLACE (the KAI-9032 conversion bug)
await page.locator('[class*="overlay"] button[aria-label="Shape"]').click(); await sleep(300)
await page.locator('button[aria-label="Heart"]').click(); await sleep(450)
const bHeart = await bbox()
if (close(bMagic, bHeart, 30)) fail('probe assumption broken: magic fit ≈ heart bbox — discriminator too weak')
await tuneDrag(0.65)
const bTuned = await bbox()
console.log(`bbox magic ${bMagic.w}x${bMagic.h} · heart ${bHeart.w}x${bHeart.h} · tuned ${bTuned.w}x${bTuned.h}`)
if (close(bTuned, bMagic, 30) && !close(bTuned, bHeart, 60)) fail('TUNE CONVERTED the heart back into the Magic cut (KAI-9032)')
if (!close(bTuned, bHeart, 60)) fail(`tuned shape drifted from heart-class (${bTuned.w}x${bTuned.h} vs ${bHeart.w}x${bHeart.h})`)
console.log('tune edited the heart IN PLACE — no identity conversion')

if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nKAI-9032 PROBE: ALL PASS (zero page errors)')
await browser.close()
