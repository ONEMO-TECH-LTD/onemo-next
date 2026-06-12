// Full screen/state/menu capture for Dan's Figma annotation board — desktop + 390pt.
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = 'http://localhost:' + (process.env.PORT ?? '3006') + '/effect-creator/v3'
const OUT = '/tmp/figma-export'
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const shots = []
const snap = async (page, name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); shots.push(name) }

const upload = async (page) => {
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
}

// ───────── DESKTOP 1280×860
const d = await browser.newPage({ viewport: { width: 1280, height: 860 } })
await d.goto(base, { waitUntil: 'networkidle' })
await snap(d, 'D01-hero-empty')
await upload(d); await sleep(400)
await snap(d, 'D02-hero-clean')
// Trim takeover
await d.locator('button[aria-label="Trim"]').click(); await sleep(300)
await snap(d, 'D03-trim-carousel')
await d.locator('button[aria-label="Cancel trim"]').click(); await sleep(250)
// Magic progress + Cancel (capture the shimmer, then cancel)
try {
  await d.locator('button[aria-label="Magic"]').click(); await sleep(900)
  await snap(d, 'D04-magic-progress-cancel')
  const cancel = d.locator('button:has-text("Cancel")')
  if (await cancel.count()) { await cancel.first().click(); await sleep(400) }
} catch { console.log('magic frame skipped') }
// dirty hero (trim commit)
await d.locator('button[aria-label="Trim"]').click(); await sleep(250)
await d.locator('[class*="swatch"]').nth(1).click(); await sleep(200)
await d.locator('button[aria-label="Done — keep this color"]').click(); await sleep(350)
await snap(d, 'D05-hero-dirty-reset')
// Editor — Shape clean
await d.locator('button[title="Editor"]').click(); await d.waitForSelector('button[aria-label="Close"]'); await sleep(350)
await snap(d, 'D06-editor-shape-clean')
// Shape dirty (Heart)
await d.locator('button[aria-label="Heart"]').click(); await sleep(400)
await snap(d, 'D07-editor-shape-dirty-heart')
// Generator chip (Daisy ✦ steppers)
await d.locator('button[aria-label^="Daisy"]').first().click(); await sleep(450)
await snap(d, 'D08-editor-generator-daisy')
// Adjust mode — Radius
await d.locator('[class*="overlay"] button[aria-label="Adjust"]').click(); await sleep(250)
await snap(d, 'D09-editor-adjust-row')
await d.locator('button[aria-label="Radius"]').first().click(); await sleep(300)
await snap(d, 'D10-editor-adjust-radius-ruler')
// Tune takeover
await d.locator('button[aria-label^="Tune"]').first().click(); await sleep(350)
await snap(d, 'D11-editor-tune-takeover')
// Points mode (double-tap)
const svgB = await d.locator('[class*="canvas"] svg').boundingBox()
await d.mouse.dblclick(svgB.x + svgB.width / 2, svgB.y + svgB.height * 0.5); await sleep(350)
await snap(d, 'D12-editor-points-mode')
// anchor selected → node bar + handles
const a0 = await d.locator('[class*="canvas"] svg circle[class*="node"]').first().boundingBox()
if (a0) { await d.mouse.click(a0.x + a0.width / 2, a0.y + a0.height / 2); await sleep(350); await snap(d, 'D13-editor-points-anchor-nodebar') }
// Image mode + dial
await d.locator('[class*="overlay"] button[aria-label="Image"]').click(); await sleep(300)
await snap(d, 'D14-editor-image-row')
await d.locator('button[aria-label="Bright"]').first().click(); await sleep(300)
await snap(d, 'D15-editor-image-bright-ruler')
// Preview
await d.locator('[class*="topbar"] button[aria-label="Preview"]').click(); await sleep(350)
await snap(d, 'D16-editor-preview')
await d.locator('[class*="topbar"] button[aria-label="Edit"]').click(); await sleep(250)
// discard confirm (dirty ✕)
await d.locator('button[aria-label="Close"]').click(); await sleep(300)
await snap(d, 'D17-editor-discard-confirm')

// ───────── MOBILE 390×844
const m = await browser.newPage({ viewport: { width: 390, height: 844 } })
await m.goto(base, { waitUntil: 'networkidle' })
await snap(m, 'M01-hero-empty-390')
await upload(m); await sleep(400)
await snap(m, 'M02-hero-clean-390')
await m.locator('button[aria-label="Trim"]').click(); await sleep(300)
await m.evaluate(() => { const r = document.querySelector('[aria-label="Trim — back material color"] [class*="row"]'); if (r) r.scrollLeft = r.scrollWidth })
await sleep(250)
await snap(m, 'M03-trim-390-scrolled')
await m.locator('button[aria-label="Cancel trim"]').click(); await sleep(250)
await m.locator('button[title="Editor"]').click(); await m.waitForSelector('button[aria-label="Close"]'); await sleep(350)
await snap(m, 'M04-editor-shape-390')
await m.locator('button[aria-label="Heart"]').click(); await sleep(400)
await m.locator('[class*="overlay"] button[aria-label="Adjust"]').click(); await sleep(300)
await snap(m, 'M05-editor-adjust-390')
await m.locator('[class*="overlay"] button[aria-label="Image"]').click(); await sleep(300)
await snap(m, 'M06-editor-image-390')
const svgM = await m.locator('[class*="canvas"] svg').boundingBox()
await m.mouse.dblclick(svgM.x + svgM.width / 2, svgM.y + svgM.height * 0.5); await sleep(350)
await snap(m, 'M07-editor-points-390')

console.log('captured: ' + shots.length + '\n' + shots.join('\n'))
await browser.close()
