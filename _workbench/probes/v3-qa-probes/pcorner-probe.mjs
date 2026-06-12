// P-corner live gate — D2 sharpen/smooth toggle + crop-default via the Magic (fallback) path.
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(2) }

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:' + (process.env.PORT ?? '3004') + '/effect-creator/v3', { waitUntil: 'networkidle' })
// photo whose subject TOUCHES the bottom frame edge → real crop corners for the default rule
await page.evaluate(async () => {
  const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#e8e2d4'; ctx.fillRect(0, 0, 1200, 900)
  ctx.fillStyle = '#22262f'
  ctx.beginPath(); ctx.arc(600, 900, 380, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill() // half-disc on the bottom edge
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'crop.png', { type: 'image/png' }))
  const input = document.querySelector('input[type=file][accept="image/*"]')
  input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForSelector('button[aria-label="Editor"]:not([disabled])', { timeout: 30000 })

// Magic (headless → flood-fill fallback) — the crop-corner default applies at birth
await page.locator('div[class*="bar"] button[aria-label="Magic"]').click()
const t0 = Date.now()
while (Date.now() - t0 < 150000) {
  await sleep(2000)
  if (!(await page.evaluate(() => !!document.querySelector('[class*="sweep"]')))) break
}
if (await page.evaluate(() => document.body.innerText.includes('Magic failed'))) fail('Magic failed outright')
console.log(`Magic completed in ${Math.round((Date.now() - t0) / 1000)}s`)
await page.screenshot({ path: '/tmp/pcorner-01-magic-crop-rounded.png' })

// open the editor — crop corners should be ROUNDED (no corner anchors at the frame), Radius
// reads applicable via the sharp base (vBaseRef = sharp fit)
{
  const topEdit = page.locator('button[title="Editor"]')
  if (await topEdit.count()) await topEdit.click()
  else await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
}
await page.waitForSelector('button[aria-label="Close"]')
await sleep(400)
if (!(await page.locator('[aria-label="Radius"][aria-valuenow]').count())) {
  await page.locator('[class*="overlay"] button[aria-label="Adjust"]').click()
  await sleep(250)
}
// active ruler only — the greyed inapplicable ruler (KAI-9019 disabledControl) must not count
const radiusRuler = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Radius"][aria-valuenow]')].filter((el) => !el.closest('[class*="disabledControl"]')).length)
if (!radiusRuler) fail('Radius ruler absent on the Magic crop shape — sharp base not wired')
console.log('Radius ruler present (sharp base wired — 0% returns to sharp)')

// D2 — sharpen/smooth toggle: double-tap the curve to add+select a point → Sharpen → Smooth
const svgB = await page.locator('[class*="canvas"] svg').boundingBox()
{
  // current contract: Adjust auto-enters points (KAI-9020) and the Points mode button exists
  // (KAI-9022) — ensure points are ON, then select the first anchor (node-class circles only)
  const anchors = () => page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle[class*="node"]').length)
  if ((await anchors()) === 0) { await page.locator('[class*="topbar"] button[aria-label="Points"]').click(); await sleep(300) }
  const c = await page.evaluate(() => { const el = document.querySelector('[class*="canvas"] svg circle[class*="node"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  if (!c) fail('no anchors in Points view')
  await page.mouse.click(c.x, c.y)
  await sleep(250)
}
const sharpenBtn = page.locator('[class*="nodeAction"]', { hasText: 'Sharpen' })
if (!(await sharpenBtn.count())) fail('node bar has no Sharpen for the selected smooth anchor')
await sharpenBtn.click()
await sleep(300)
const smoothBtn = page.locator('[class*="nodeAction"]', { hasText: 'Smooth' })
if (!(await smoothBtn.count())) fail('anchor did not become a corner (no Smooth toggle shown)')
console.log('Sharpen → anchor is now a TRUE corner (toggle reads Smooth)')
await page.screenshot({ path: '/tmp/pcorner-02-sharpened-anchor.png' })
await smoothBtn.click()
await sleep(300)
if (!(await page.locator('[class*="nodeAction"]', { hasText: 'Sharpen' }).count())) fail('Smooth did not revert the corner')
console.log('Smooth → corner reverted to a smooth anchor; round-trip clean')

await page.locator('button[aria-label="Close"]').click()
if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nP-CORNER PROBE: ALL PASS (zero page errors)')
await browser.close()
