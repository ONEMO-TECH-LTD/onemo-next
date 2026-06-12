// KAI-8971 / F2 self-verify probe — ✕ must revert image-fx + photo position; Done with fx-only
// edits must push ONE global history step (Undo no longer greyed). Drives :3004 with real gestures.
import { chromium } from 'playwright-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:' + (process.env.PORT ?? '3004') + '/effect-creator/v3'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(2) }

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    const cv = document.createElement('canvas')
    cv.width = 1200; cv.height = 900
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#cdbfa5'; ctx.fillRect(0, 0, 1200, 900)
    ctx.fillStyle = '#2b2f3c'; ctx.beginPath(); ctx.ellipse(600, 450, 260, 300, 0, 0, Math.PI * 2); ctx.fill()
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'probe.png', { type: 'image/png' }))
    const input = document.querySelector('input[type=file][accept="image/*"]')
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForSelector('button[aria-label="Editor"]:not([disabled])', { timeout: 30000 })

  const openEditor = async () => {
    {
  const topEdit = page.locator('button[title="Editor"]')
  if (await topEdit.count()) await topEdit.click()
  else await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
}
    await page.waitForSelector('button[aria-label="Close"]', { timeout: 5000 })
    await sleep(300)
  }
  const enterBright = async () => {
    await (async () => { // KAI-9027: image mode is entered from the hero (Filters)
  if (await page.locator('button[aria-label="Close"]').count()) {
    await page.locator('button[aria-label="Close"]').click(); await sleep(250)
    const d = page.locator('[class*="discardBtn"]'); if (await d.count()) { await d.click(); await sleep(300) }
  }
  await page.locator('button[aria-label="Filters"]').click(); await sleep(350)
})()
    await sleep(200)
    await page.locator('[class*="overlay"] button[aria-label="Bright"]').click()
    await sleep(200)
  }
  const brightBar = () => page.locator('[aria-label="brightness"]')
  const readBright = async () => Number(await brightBar().getAttribute('aria-valuenow'))
  const dragBright = async (frac) => {
    const bb = await brightBar().boundingBox()
    await page.mouse.move(bb.x + bb.width * 0.5, bb.y + bb.height / 2)
    await page.mouse.down()
    await page.mouse.move(bb.x + bb.width * frac, bb.y + bb.height / 2, { steps: 8 })
    await page.mouse.up() // release = onCommit → setImageFx
    await sleep(250)
  }
  const photoTransform = () => page.evaluate(() => {
    const img = document.querySelector('[class*="canvas"] svg image')
    return img?.parentElement?.getAttribute('transform') ?? null
  })

  // ── Part 1: ✕ reverts image-fx + photo position ─────────────────────────────
  await openEditor()
  await enterBright()
  const before = await readBright()
  if (before !== 50) fail(`fresh session Bright should read 50% (neutral on the 0-100 scale, KAI-9028), got ${before}`)
  await dragBright(0.9) // commit a strong brightness
  const committed = await readBright()
  if (committed <= 60) fail(`drag did not commit a fx change (aria-valuenow ${committed})`)
  console.log(`bright committed at ${committed}%`)
  // contrast + warmth too (one imageFx object, but assert each field end-to-end per admin)
  const driveBar = async (chip, barLabel, frac) => {
    await page.locator(`[class*="overlay"] button[aria-label="${chip}"]`).click()
    await sleep(150)
    const bb2 = await page.locator(`[aria-label="${barLabel}"]`).boundingBox()
    await page.mouse.move(bb2.x + bb2.width * 0.5, bb2.y + bb2.height / 2)
    await page.mouse.down()
    await page.mouse.move(bb2.x + bb2.width * frac, bb2.y + bb2.height / 2, { steps: 6 })
    await page.mouse.up()
    await sleep(200)
    return Number(await page.locator(`[aria-label="${barLabel}"]`).getAttribute('aria-valuenow'))
  }
  const cCommit = await driveBar('Contrast', 'contrast', 0.85)
  if (cCommit <= 60) fail(`contrast commit failed (${cCommit})`)
  const wCommit = await driveBar('Warmth', 'warmth', 0.7)
  if (wCommit <= 10) fail(`warmth commit failed (${wCommit})`)
  console.log(`contrast committed at ${cCommit}, warmth at ${wCommit}`)
  // change the photo position via THE GESTURE (P9: position is a direct drag in Image mode —
  // the Position button died; KAI-8984 fixed the routing that once blocked this)
  const svgB2 = await page.locator('[class*="canvas"] svg').boundingBox()
  await page.mouse.move(svgB2.x + svgB2.width / 2, svgB2.y + svgB2.height / 2)
  await page.mouse.down()
  await page.mouse.move(svgB2.x + svgB2.width / 2 + 120, svgB2.y + svgB2.height / 2 + 50, { steps: 10 })
  await page.mouse.up()
  await sleep(250)
  const panT = await photoTransform()
  if (!panT) fail('photo pan gesture did not register a transform')
  console.log(`photo panned by gesture (transform: ${panT.slice(0, 40)}…)`)
  await page.screenshot({ path: '/tmp/f2-01-before-cancel-fx-committed.png' })
  // ✕ Close — the discard boundary
  await page.locator('button[aria-label="Close"]').click()
  await sleep(400)
  // reopen → the readout layer must show the PRE-SESSION state (visible = committed)
  await openEditor()
  const tAfter = await photoTransform()
  if (tAfter) fail(`✕ leaked photo position — transform survived: ${tAfter}`)
  await enterBright()
  const after = await readBright()
  if (after !== 50) fail(`✕ leaked image-fx — Bright reads ${after} after discard (expected neutral 50)`)
  const readBar = async (chip, barLabel) => {
    await page.locator(`[class*="overlay"] button[aria-label="${chip}"]`).click()
    await sleep(150)
    return Number(await page.locator(`[aria-label="${barLabel}"]`).getAttribute('aria-valuenow'))
  }
  const cAfter = await readBar('Contrast', 'contrast')
  if (cAfter !== 50) fail(`✕ leaked contrast (${cAfter})`)
  const wAfter = await readBar('Warmth', 'warmth')
  if (wAfter !== 0) fail(`✕ leaked warmth (${wAfter})`)
  console.log('✕ revert: PASS — Bright 50%, Contrast 50%, Warmth 0 (neutral on the uniform scale), photo position restored')
  await page.screenshot({ path: '/tmp/f2-02-after-cancel-reverted.png' })

  // ── Part 2: Done with fx-only edits = ONE global undo step ──────────────────
  await page.locator('[class*="overlay"] button[aria-label="Bright"]').click()
  await sleep(150)
  await dragBright(0.88)
  const c2 = await readBright()
  if (c2 <= 60) fail(`second fx commit did not register (${c2})`)
  await page.locator('button[aria-label="Done"]').click()
  await sleep(500)
  const undoBtn = page.locator('button[title="Undo"]')
  if (await undoBtn.isDisabled()) fail('Done with fx-only edits left global Undo GREYED (the F2 sibling)')
  console.log('global Undo enabled after fx-only Done: PASS')
  await undoBtn.click()
  await sleep(400)
  await openEditor()
  await enterBright()
  const undone = await readBright()
  if (undone !== 50) fail(`global Undo did not revert the fx session (Bright ${undone} — expected neutral 50)`)
  console.log('global Undo reverts the fx session: PASS')
  await page.locator('button[aria-label="Close"]').click()

  if (errs.length) fail('page errors during probe:\n' + errs.join('\n'))
  console.log('\nF2 PROBE: ALL PASS (zero page errors)')
  await browser.close()
}

main().catch((e) => { console.error('probe error:', e); process.exit(1) })
