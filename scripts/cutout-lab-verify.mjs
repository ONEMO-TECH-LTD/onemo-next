// s62 cutout-lab verification — real browser, real HTTPS bench, real models.
// Gates: (1) page loads + model loads, (2) upload → auto-detect → v5.3.1 outline appears,
// (3) EAR-GAP: an Add stroke on a region OUTSIDE the selection FILLS INTO it (union) — the
// selection must GROW, never collapse to the stroked region.
import { chromium } from 'playwright'

const URL = 'https://localhost:3997/cutout-lab'
const log = (...a) => console.log('[verify]', ...a)

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] })
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()) })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(URL, { waitUntil: 'domcontentloaded' })
log('page open')

// 1 — model loads (slim77 default, webgpu on this Mac)
await page.waitForFunction(() => document.body.innerText.includes('ready — upload an image') || document.body.innerText.includes('done'), null, { timeout: 120000 })
log('model loaded:', (await page.locator('text=●').first().textContent()).trim())

// synthetic test image: dark head-like disc + a SEPARATE small "ear tip" blob (the gap), light bg
const fileBuf = await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 800; c.height = 800
  const x = c.getContext('2d')
  x.fillStyle = '#cfd8dc'; x.fillRect(0, 0, 800, 800)          // light background
  x.fillStyle = '#1a1c2c'
  x.beginPath(); x.arc(400, 460, 210, 0, 7); x.fill()          // the main object
  x.beginPath(); x.moveTo(330, 270); x.lineTo(370, 130); x.lineTo(420, 270); x.closePath(); x.fill() // attached ear
  x.beginPath(); x.moveTo(480, 260); x.lineTo(530, 120); x.lineTo(575, 265); x.closePath(); x.fill() // DETACHED-look ear (thin joint)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  return Array.from(new Uint8Array(await blob.arrayBuffer()))
})
await page.setInputFiles('input[type=file]', { name: 'test.png', mimeType: 'image/png', buffer: Buffer.from(fileBuf) })
log('uploaded — waiting for auto-detect + finishing')
await page.waitForFunction(() => document.body.innerText.includes('✨ done'), null, { timeout: 120000 })

const count = async () => await page.evaluate(() => {
  // count green (kept) pixels on the selection canvas
  const cv = document.querySelectorAll('canvas')[0]
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
  let g = 0
  // green overlay composited over ANY base pixel: G clearly dominates R and B (relative, no abs threshold)
  for (let i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 20 && d[i + 1] > d[i + 2] + 15) g++
  return { g, total: d.length / 4 }
})
const before = await count()
log('auto-detect kept px:', before.g, '/', before.total, `(${(100 * before.g / before.total).toFixed(1)}%)`)
if (before.g < before.total * 0.02) { console.log('FAIL: auto-detect produced (near) empty selection'); await browser.close(); process.exit(1) }

const stats = await page.evaluate(() => document.body.innerText.match(/model load\n([\dms—]+).*?encode \/ image\n([\dms—]+).*?recognize\n([\dms—]+)/is)?.slice(1))
log('timings load/encode/recognize:', stats)

// 3 — EAR-GAP union test: Add-stroke over the top-right ear area (likely outside/edge of selection)
const box = await page.locator('canvas').first().boundingBox()
const px = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy })
const a = px(0.62, 0.22), b = px(0.66, 0.30) // over the detached ear
await page.mouse.move(a.x, a.y); await page.mouse.down()
for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8)
await page.mouse.up()
log('add-stroke sent — waiting')
await page.waitForFunction(() => document.body.innerText.includes('✨ done'), null, { timeout: 60000 })
const after = await count()
log('after add-stroke kept px:', after.g, `(${(100 * after.g / after.total).toFixed(1)}%)`)

// The union law: selection must not shrink below ~95% of what it was (fill adds, never replaces)
const ok = after.g >= before.g * 0.95
log(ok ? 'UNION OK — selection retained + grew/held' : `UNION FAIL — collapsed ${before.g} → ${after.g}`)

// screenshot evidence
await page.screenshot({ path: '/tmp/claude-501/cutout-lab-verify.png', fullPage: false })
log('screenshot: /tmp/claude-501/cutout-lab-verify.png')
await browser.close()
process.exit(ok ? 0 : 1)
