// KAI-8972 / P1a self-verify probe — image-shape upload must route through THE one fit
// (geometry-truth.vectoriseTrace). Differential behavior assert: the shared fit carries corner
// integrity, the deleted inline fit did not — so an uploaded TRIANGLE must land with true corner
// anchors (Radius ruler appears in Adjust), while an uploaded ELLIPSE stays all-curves (tier-2
// hint appears). Plus: committed path is true curves, zero page errors.
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

  // hero photo upload
  await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#cdbfa5'; ctx.fillRect(0, 0, 1200, 900)
    ctx.fillStyle = '#2b2f3c'; ctx.beginPath(); ctx.ellipse(600, 450, 260, 300, 0, 0, Math.PI * 2); ctx.fill()
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'photo.png', { type: 'image/png' }))
    const input = document.querySelector('input[type=file][accept="image/*"]')
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForSelector('button[aria-label="Editor"]:not([disabled])', { timeout: 30000 })

  // open the editor → Shape sheet (pre-Magic opens there already)
  {
  const topEdit = page.locator('button[title="Editor"]')
  if (await topEdit.count()) await topEdit.click()
  else await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
}
  await page.waitForSelector('button[aria-label="Close"]')
  await sleep(300)

  // upload a SHAPE image through the editor's Upload chip input
  const uploadShapeImage = (kind) => page.evaluate(async (which) => {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 640
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 640, 640)
    ctx.fillStyle = '#101418'
    if (which === 'triangle') {
      ctx.beginPath(); ctx.moveTo(320, 80); ctx.lineTo(560, 540); ctx.lineTo(80, 540); ctx.closePath(); ctx.fill()
    } else {
      ctx.beginPath(); ctx.ellipse(320, 320, 240, 180, 0, 0, Math.PI * 2); ctx.fill()
    }
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], `${which}.png`, { type: 'image/png' }))
    const inputs = [...document.querySelectorAll('input[type=file]')]
    const shapeInput = inputs.find((i) => (i.getAttribute('accept') || '').includes('svg'))
    if (!shapeInput) throw new Error('shape upload input not found (is the Shape sheet open?)')
    shapeInput.files = dt.files
    shapeInput.dispatchEvent(new Event('change', { bubbles: true }))
  }, kind)

  const pathInfo = () => page.evaluate(() => {
    const d = document.querySelector('[class*="canvas"] svg [class*="path"]')?.getAttribute('d') ?? ''
    return { curves: (d.match(/C/g) ?? []).length, lines: (d.match(/L/g) ?? []).length, len: d.length }
  })

  const radiusState = async () => {
    // Adjust mode → radius sub is the default; TickBar present ⇔ shape has corner anchors
    await page.locator('[class*="overlay"] button[aria-label="Adjust"]').click()
    await sleep(250)
    // KAI-9019: the inapplicable state is now a GREYED ruler (disabledControl), not a hint
    const bar = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Radius"][aria-valuenow]')].filter((el) => !el.closest('[class*="disabledControl"]')).length)
    const hint = await page.evaluate(() => document.querySelector('[class*="disabledControl"] [aria-label="Radius"]') ? 'greyed ruler (inapplicable)' : '')
    // back to Shape sheet for the next upload
    await page.locator('[class*="overlay"] button[aria-label="Shape"]').click()
    await sleep(200)
    return { hasRuler: bar > 0, hint: hint.slice(0, 50) }
  }

  // ── triangle: the shared fit must pin its 3 sharp vertices as TRUE corners
  await uploadShapeImage('triangle')
  await sleep(700)
  const tri = await pathInfo()
  if (tri.curves < 2) fail(`triangle landed without true curves (C=${tri.curves}, d len ${tri.len})`)
  const triRadius = await radiusState()
  if (!triRadius.hasRuler) fail(`uploaded TRIANGLE has no corner anchors — Radius shows the hint ("${triRadius.hint}") — the shared fit (corner integrity) is NOT in the upload path`)
  console.log(`triangle: C=${tri.curves} L=${tri.lines}, Radius ruler PRESENT (corners pinned) ✓`)

  // ── ellipse: all-curves, no false corners — Radius greys with the hint
  const dBefore = await page.evaluate(() => document.querySelector('[class*="canvas"] svg [class*="path"]')?.getAttribute('d') ?? '')
  await uploadShapeImage('ellipse')
  await sleep(700)
  const dAfter = await page.evaluate(() => document.querySelector('[class*="canvas"] svg [class*="path"]')?.getAttribute('d') ?? '')
  const toast = await page.evaluate(() => document.body.innerText.match(/No clear shape|could not be read/)?.[0] ?? null)
  console.log(`ellipse upload: d changed=${dBefore !== dAfter} toast=${toast}`)
  const ell = await pathInfo()
  console.log(`ellipse path: C=${ell.curves} L=${ell.lines} len=${ell.len}`)
  if (dBefore === dAfter) fail('second upload did NOT land (path unchanged)' + (toast ? ` — toast: ${toast}` : ''))
  if (ell.curves < 4) fail(`ellipse landed without curves (C=${ell.curves})`)
  const ellRadius = await radiusState()
  if (ellRadius.hasRuler) fail('uploaded ELLIPSE grew corner anchors — false corners from the shared fit')
  console.log(`ellipse: C=${ell.curves} L=${ell.lines}, Radius greys with hint ("${ellRadius.hint}…") ✓`)

  await page.screenshot({ path: '/tmp/p1a-ellipse-landed.png' })
  await page.locator('button[aria-label="Close"]').click()
  if (errs.length) fail('page errors:\n' + errs.join('\n'))
  console.log('\nP1a PROBE: ALL PASS (zero page errors)')
  await browser.close()
}

main().catch((e) => { console.error('probe error:', e); process.exit(1) })
