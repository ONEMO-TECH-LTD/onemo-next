// F1 BLOCKER repro probe — KAI-8970 (invisible-editor wedge, fab-qa verdict F1).
// Replays the two occurrence chains on :3004 in a loop with timing jitter; the moment the editor
// mounts wedged (transparent overlay / clicks not landing on Close), dumps computed styles, rects,
// elementFromPoint, console+page errors, and a screenshot. Run from the primary clone root.
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:3004/effect-creator/v3'
const ITER = Number(process.env.ITER ?? 40)
const SHOT = '/tmp/f1-wedge'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
  const logs = []
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[console.${m.type()}] ${m.text()}`) })
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))

  await page.goto(URL, { waitUntil: 'networkidle' })

  // upload a synthetic photo (1200x900, distinct corners + center subject) through the real input
  await page.evaluate(async () => {
    const cv = document.createElement('canvas')
    cv.width = 1200; cv.height = 900
    const ctx = cv.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 1200, 900)
    g.addColorStop(0, '#d9cdb9'); g.addColorStop(1, '#8a9cb0')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1200, 900)
    ctx.fillStyle = '#2b2f3c'
    ctx.beginPath(); ctx.ellipse(600, 450, 260, 300, 0, 0, Math.PI * 2); ctx.fill()
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
    const file = new File([blob], 'probe.png', { type: 'image/png' })
    const dt = new DataTransfer(); dt.items.add(file)
    const input = document.querySelector('input[type=file][accept="image/*"]')
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForSelector('button[aria-label="Editor"]:not([disabled])', { timeout: 30000 })
  console.log('uploaded; prepared ready')

  // diagnosis snapshot of the editor overlay state
  const checkEditor = () => page.evaluate(() => {
    const close = document.querySelector('button[aria-label="Close"]')
    if (!close) return { mounted: false }
    const overlay = close.closest('[class*="overlay"]')
    const topbar = close.closest('[class*="topbar"]')
    const svg = overlay?.querySelector('[class*="canvas"] svg')
    const cs = overlay ? getComputedStyle(overlay) : null
    const cr = close.getBoundingClientRect()
    const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2
    const at = document.elementFromPoint(cx, cy)
    const photo = svg ? svg.querySelectorAll('image').length : -1
    return {
      mounted: true,
      overlayClass: overlay?.className ?? null,
      bg: cs?.backgroundColor, opacity: cs?.opacity, position: cs?.position, z: cs?.zIndex,
      display: cs?.display, visibility: cs?.visibility, transform: cs?.transform,
      overlayRect: overlay ? JSON.parse(JSON.stringify(overlay.getBoundingClientRect())) : null,
      topbarH: topbar ? topbar.getBoundingClientRect().height : -1,
      svgRect: svg ? JSON.parse(JSON.stringify(svg.getBoundingClientRect())) : null,
      photoImages: photo,
      closeRect: JSON.parse(JSON.stringify(cr)),
      atPoint: at ? { tag: at.tagName, cls: String(at.className).slice(0, 80), aria: at.getAttribute('aria-label') } : null,
      closeHit: at ? (close === at || close.contains(at)) : false,
      pathD: !!overlay?.querySelector('[class*="path"]'),
    }
  })

  const isWedged = (d) => d.mounted && (
    !d.closeHit ||
    d.bg === 'rgba(0, 0, 0, 0)' || d.bg === 'transparent' ||
    d.topbarH < 10 ||
    (d.overlayRect && d.overlayRect.width < 100)
  )

  const dump = async (label, d) => {
    console.log(`\n=== WEDGED at ${label} ===`)
    console.log(JSON.stringify(d, null, 2))
    const html = await page.evaluate(() => {
      const close = document.querySelector('button[aria-label="Close"]')
      const overlay = close?.closest('[class*="overlay"]')
      return overlay ? overlay.outerHTML.slice(0, 4000) : '(no overlay)'
    })
    console.log('--- overlay HTML (4k) ---\n' + html)
    console.log('--- console/page errors ---\n' + (logs.slice(-30).join('\n') || '(none)'))
    await page.screenshot({ path: `${SHOT}-${label}.png` })
    writeFileSync(`${SHOT}-${label}.json`, JSON.stringify({ d, logs }, null, 2))
    console.log(`screenshot: ${SHOT}-${label}.png`)
  }

  const closeEditor = async () => {
    const d = await checkEditor()
    if (!d.mounted) return
    // coordinate click first (the honest path) — programmatic fallback like fab-qa's recovery
    await page.mouse.click(d.closeRect.left + d.closeRect.width / 2, d.closeRect.top + d.closeRect.height / 2)
    await sleep(150)
    const d2 = await checkEditor()
    if (d2.mounted) {
      await page.evaluate(() => document.querySelector('button[aria-label="Close"]')?.click())
      await sleep(150)
    }
  }

  // session enrichment: commit a daisy + a stepper nudge + Done (fab-qa's occurrence state)
  await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
  await sleep(500)
  if (!(await page.locator('[class*="chipRow"]').count())) {
    await page.locator('[class*="overlay"] button[aria-label="Shape"]').click(); await sleep(200)
  }
  await page.locator('button[aria-label="Daisy"]').click(); await sleep(250)
  await page.locator('button[aria-label="More petals"]').click(); await sleep(250)
  await page.locator('button[aria-label="Done"]').click(); await sleep(600)
  console.log('session enriched: daisy committed via editor Done')

  const delays = [0, 30, 80, 150, 300]
  for (let i = 1; i <= ITER; i++) {
    const delay = delays[i % delays.length]
    // ── chain (b): global Reset → Edit at varying delay
    const reset = page.locator('button[title="Reset"]')
    if (await reset.isEnabled().catch(() => false)) { await reset.click(); await sleep(delay) }
    await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
    await sleep(450)
    let d = await checkEditor()
    if (!d.mounted) { console.log(`iter ${i} (delay ${delay}ms): editor NOT MOUNTED after Edit click`); await sleep(400); d = await checkEditor() }
    if (isWedged(d)) { await dump(`iter${i}-chainB`, d); process.exit(2) }
    console.log(`iter ${i} chainB delay=${delay}ms: ok bg=${d.bg} topbarH=${Math.round(d.topbarH)} closeHit=${d.closeHit} imgs=${d.photoImages}`)

    // ── chain (a) every 4th: chip-row drag (text selection) → tap-inside → mode-pill tap
    if (i % 4 === 0) {
      if (!(await page.locator('[class*="chipRow"]').count())) {
        await page.locator('[class*="overlay"] button[aria-label="Shape"]').click()
        await sleep(200)
      }
      const row = page.locator('[class*="chipRow"]').first()
      const rb = await row.boundingBox()
      if (rb) {
        await page.mouse.move(rb.x + 10, rb.y + rb.height / 2)
        await page.mouse.down()
        await page.mouse.move(rb.x + rb.width - 10, rb.y + rb.height / 2, { steps: 12 }) // selects label text
        await page.mouse.up()
      }
      const svgB = await page.locator('[class*="canvas"] svg').boundingBox()
      if (svgB) await page.mouse.click(svgB.x + svgB.width / 2, svgB.y + svgB.height / 2) // tap-inside
      await sleep(120)
      await (async () => { // KAI-9027: image mode is entered from the hero (Filters)
  if (await page.locator('button[aria-label="Close"]').count()) {
    await page.locator('button[aria-label="Close"]').click(); await sleep(250)
    const d = page.locator('[class*="discardBtn"]'); if (await d.count()) { await d.click(); await sleep(300) }
  }
  await page.locator('button[aria-label="Filters"]').click(); await sleep(350)
})() // mode-pill tap
      await sleep(250)
      d = await checkEditor()
      if (isWedged(d)) { await dump(`iter${i}-chainA`, d); process.exit(2) }
      console.log(`iter ${i} chainA: ok closeHit=${d.closeHit} sel="${await page.evaluate(() => String(getSelection())).then((s) => s.slice(0, 30))}"`)
      // wedge in (a) presented at the FOLLOWING mount — close + immediate reopen
      await closeEditor()
      await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click()
      await sleep(450)
      d = await checkEditor()
      if (isWedged(d)) { await dump(`iter${i}-chainA-reopen`, d); process.exit(2) }
    }
    await closeEditor()
    await sleep(100)
  }
  console.log(`\nNO WEDGE in ${ITER} iterations (chains A+B, delays ${delays.join('/')}ms)`)
  await browser.close()
}

main().catch((e) => { console.error('probe error:', e); process.exit(1) })
