// KAI-8976 / F4 self-verify probe — undo must restore a TRUTHFUL Detail readout (fab-qa: geometry
// reverted but the ruler stayed at 89%). Needs a Magic-class spec (rawTracePx) — headless BEN
// falls back to flood-fill via the TD-E watchdog; both paths produce a 'shaped' spec with Tune.
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
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#e8e2d4'; ctx.fillRect(0, 0, 1200, 900)
  ctx.fillStyle = '#22262f'; ctx.beginPath(); ctx.ellipse(600, 450, 280, 320, 0, 0, Math.PI * 2); ctx.fill()
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.png', { type: 'image/png' }))
  const input = document.querySelector('input[type=file][accept="image/*"]')
  input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForSelector('button[aria-label="Editor"]:not([disabled])', { timeout: 30000 })

// Magic — tolerate the headless ML fallback (watchdog up to 90s); shimmer must appear then clear
console.log('pressing Magic (fallback-tolerant, budget 150s)…')
await page.locator('div[class*="bar"] button[aria-label="Magic"]').click()
const t0 = Date.now()
let shaped = false
while (Date.now() - t0 < 150000) {
  await sleep(2000)
  const state = await page.evaluate(() => ({
    shimmer: !!document.querySelector('[class*="sweep"]'),
    toast: document.body.innerText.match(/Magic failed|simple background cut/)?.[0] ?? null,
  }))
  if (!state.shimmer) { shaped = !(await page.evaluate(() => document.body.innerText.includes('Magic failed'))); break }
}
if (!shaped) fail('Magic never completed (even via fallback) — cannot drive Tune headless')
console.log(`Magic completed in ${Math.round((Date.now() - t0) / 1000)}s (real or fallback cut)`)

// open the editor — shaped spec opens in Adjust mode with the Tune family available
{
  const topEdit = page.locator('button[title="Editor"]')
  if (await topEdit.count()) await topEdit.click()
  else await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
}
await page.waitForSelector('button[aria-label="Close"]', { timeout: 5000 })
await sleep(400)
{
  const tune = page.locator('[class*="overlay"] button[aria-label="Tune ✦"]')
  if (await tune.count()) { await tune.click(); await sleep(200) } // final build: Detail under Tune ✦
}
const detailChip = page.locator('[class*="overlay"] button[aria-label="Detail"]')
if (!(await detailChip.count())) fail('Detail dial absent')
await detailChip.click()
await sleep(250)

const bar = page.locator('[aria-label="Detail"][aria-valuenow]')
const D0 = Number(await bar.getAttribute('aria-valuenow'))
console.log(`initial Detail readout: ${D0}%`)

// drag to a far value and commit
const bb = await bar.boundingBox()
await page.mouse.move(bb.x + bb.width * 0.5, bb.y + bb.height / 2)
await page.mouse.down()
await page.mouse.move(bb.x + bb.width * 0.89, bb.y + bb.height / 2, { steps: 10 })
await page.mouse.up()
await sleep(600) // commit re-fit
const D1 = Number(await bar.getAttribute('aria-valuenow'))
if (Math.abs(D1 - D0) < 10) fail(`Detail drag did not commit a distinct value (D0=${D0} D1=${D1})`)
console.log(`committed Detail: ${D1}%`)
const dCommitted = await page.evaluate(() => document.querySelector('[class*="canvas"] svg [class*="path"]')?.getAttribute('d')?.length ?? 0)

// UNDO (editor topbar) — geometry must revert AND the readout must read D0 again, not D1
await page.locator('[class*="overlay"] button[aria-label="Undo"]').click()
await sleep(500)
const D2 = Number(await bar.getAttribute('aria-valuenow'))
const dUndone = await page.evaluate(() => document.querySelector('[class*="canvas"] svg [class*="path"]')?.getAttribute('d')?.length ?? 0)
console.log(`after undo: readout=${D2}% (geometry d-len ${dCommitted} → ${dUndone})`)
if (D2 === D1) fail(`STALE READOUT — undo reverted geometry but Detail still reads ${D1}% (the F4 bug)`)
if (D2 !== D0) fail(`readout after undo is ${D2}, expected the pre-commit ${D0}`)
if (dUndone === dCommitted) fail('undo did not change the geometry (probe assumption broken)')

// REDO symmetry — readout follows forward too
await page.locator('[class*="overlay"] button[aria-label="Redo"]').click()
await sleep(500)
const D3 = Number(await bar.getAttribute('aria-valuenow'))
if (D3 !== D1) fail(`redo readout ${D3}, expected ${D1}`)
console.log(`redo restores ${D3}% — symmetric`)

await page.screenshot({ path: '/tmp/f4-after-undo-truthful-readout.png' })
if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nF4 PROBE: ALL PASS (zero page errors)')
await browser.close()
