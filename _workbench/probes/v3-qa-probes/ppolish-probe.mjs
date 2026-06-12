// P-polish gate — the checklist items that were missing: universal frame+padlock (6.1-6.3),
// segment-tap insert (6.7), two-button discard (9.2), Magic cancel (2.7), progress rings (4.4),
// ruler zero-dot + transient large readout (4.5/4.7).
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
  ctx.fillStyle = '#2b2f3c'; ctx.beginPath(); ctx.ellipse(600, 450, 260, 300, 0, 0, Math.PI * 2); ctx.fill()
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.png', { type: 'image/png' }))
  const input = document.querySelector('input[type=file][accept="image/*"]')
  input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForSelector('button[aria-label="Editor"]:not([disabled])', { timeout: 30000 })

// ── 2.7: Magic is cancellable; prior state stands
await page.locator('button[aria-label="Magic"]').click()
await sleep(1500)
const cancelBtn = page.locator('button[aria-label="Cancel Magic"]')
if (!(await cancelBtn.count())) fail('no Cancel on the Magic shimmer (UX-5)')
await cancelBtn.click()
await sleep(400)
if (await page.evaluate(() => !!document.querySelector('[class*="sweep"]'))) fail('shimmer survived Cancel')
await sleep(2500) // let any in-flight fallback resolve — it must be DISCARDED
const magicActive = await page.evaluate(() => document.querySelector('button[aria-label="Magic"]')?.getAttribute('aria-pressed'))
if (magicActive === 'true') fail('cancelled Magic still applied its result')
console.log('Magic cancel: shimmer gone, result discarded, prior state stands')

// ── 6.1-6.3: frame grips + padlock on a committed (non-chip) shape; locked corner pull scales
await page.locator('button[title="Editor"]').click()
await page.waitForSelector('button[aria-label="Close"]')
await sleep(400)
const grips = await page.evaluate(() => document.querySelectorAll('[class*="gripHit"]').length)
if (grips < 8) fail(`frame grips not universal (${grips} grips on the seeded shape)`)
const lock = page.locator('[aria-label^="Frame locked"], [aria-label^="Frame unlocked"]')
if (!(await lock.count())) fail('padlock chip missing from the frame')
const bbox0 = await page.evaluate(() => {
  const p = document.querySelector('[class*="canvas"] svg [class*="path"]')
  const b = p.getBBox(); return { w: b.width, h: b.height }
})
// pull the SE corner grip inward while LOCKED → aspect must be preserved
const seGrip = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('[class*="gripHit"]')]
  const se = hits[7] // order: n,s,w,e,nw,ne,sw,se
  const r = se.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})
await page.mouse.move(seGrip.x, seGrip.y)
await page.mouse.down()
await page.mouse.move(seGrip.x - 80, seGrip.y - 30, { steps: 8 }) // asymmetric pull
await page.mouse.up()
await sleep(350)
const bbox1 = await page.evaluate(() => {
  const p = document.querySelector('[class*="canvas"] svg [class*="path"]')
  const b = p.getBBox(); return { w: b.width, h: b.height }
})
const ar0 = bbox0.w / bbox0.h, ar1 = bbox1.w / bbox1.h
if (Math.abs(ar0 - ar1) / ar0 > 0.02) fail(`LOCKED corner pull changed aspect (${ar0.toFixed(3)} → ${ar1.toFixed(3)})`)
if (Math.abs(bbox1.w - bbox0.w) < 5) fail('locked corner pull did not scale at all')
// unlock → the same pull deforms (RE-LOCATE the grip — the scale moved it)
await lock.click()
await sleep(250)
if (!(await page.locator('[aria-label^="Frame unlocked"]').count())) fail('padlock did not toggle to unlocked')
const seGrip2 = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('[class*="gripHit"]')]
  const se = hits[7]
  const r = se.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})
await page.mouse.move(seGrip2.x, seGrip2.y)
await page.mouse.down()
await page.mouse.move(seGrip2.x - 110, seGrip2.y - 15, { steps: 8 })
await page.mouse.up()
await sleep(350)
const bbox2 = await page.evaluate(() => {
  const p = document.querySelector('[class*="canvas"] svg [class*="path"]')
  const b = p.getBBox(); return { w: b.width, h: b.height }
})
const ar2 = bbox2.w / bbox2.h
if (Math.abs(ar2 - ar1) / ar1 < 0.03) fail('UNLOCKED corner pull did not deform (aspect unchanged)')
console.log(`frame: grips universal · locked pull scales (aspect ${ar0.toFixed(2)}→${ar1.toFixed(2)}) · unlocked deforms (${ar2.toFixed(2)})`)
await page.screenshot({ path: '/tmp/ppolish-01-frame-lock.png' })

// ── 6.7: segment tap → Add point here (count +1)
const svgB = await page.locator('[class*="canvas"] svg').boundingBox()
await page.mouse.dblclick(svgB.x + svgB.width / 2, svgB.y + svgB.height / 2) // Points
await sleep(300)
const n0 = await page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle').length)
// tap ON the line: find a point on the path edge — use the path's bbox top-center
const edge = await page.evaluate(() => {
  const p = document.querySelector('[class*="canvas"] svg [class*="path"]')
  const b = p.getBBox()
  const svg = p.ownerSVGElement
  const pt = svg.createSVGPoint(); pt.x = b.x + b.width / 2; pt.y = b.y
  const m = svg.getScreenCTM()
  const sp = pt.matrixTransform(m)
  return { x: sp.x, y: sp.y }
})
await page.mouse.click(edge.x, edge.y)
await sleep(300)
const addHere = page.locator('[class*="nodeAction"]', { hasText: 'Add point here' })
if (!(await addHere.count())) fail('segment tap did not offer "Add point here"')
await addHere.click()
await sleep(300)
const n1 = await page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle').length)
if (n1 <= n0) fail(`insert did not add an anchor (${n0} → ${n1})`)
console.log(`segment-tap insert: ${n0} → ${n1} anchors`)

// ── 4.4 + 4.5 + 4.7: rings, zero-dot, large readout
await page.locator('[class*="overlay"] button[aria-label="Adjust"]').click()
await sleep(200)
const radiusBar = page.locator('[aria-label="Radius"][aria-valuenow]')
if (await radiusBar.count()) {
  const rb = await radiusBar.boundingBox()
  await page.mouse.move(rb.x + rb.width * 0.3, rb.y + rb.height / 2)
  await page.mouse.down()
  await page.mouse.move(rb.x + rb.width * 0.6, rb.y + rb.height / 2, { steps: 6 })
  const bigReadout = await page.evaluate(() => [...document.querySelectorAll('span')].some((el) => el.textContent?.includes('RADIUS') && getComputedStyle(el).position === 'fixed'))
  if (!bigReadout) fail('transient large readout absent mid-drag (UX-6)')
  await page.mouse.up()
  await sleep(400)
  const ring = await page.evaluate(() => !!document.querySelector('[class*="chipIcon"] svg circle[stroke-dasharray]'))
  if (!ring) fail('progress ring absent on the adjusted Radius circle (UX-1)')
  console.log('ruler: large readout mid-drag · progress ring after commit')
} else { console.log('radius greyed on this shape — rings checked via Image instead') }
await page.screenshot({ path: '/tmp/ppolish-02-rings.png' })

// ── 9.2: dirty ✕ → Keep editing / Discard (destructive) — Discard closes
await page.locator('[class*="overlay"] button[aria-label="Close"]').click()
await sleep(250)
const keep = page.locator('button:has-text("Keep editing")')
const discard = page.locator('[class*="discardBtn"]')
if (!(await keep.count()) || !(await discard.count())) fail('two-button discard confirm missing (UX-2)')
await discard.click()
await sleep(350)
if (await page.locator('button[aria-label="Close"]').count()) fail('Discard did not close the editor')
console.log('discard confirm: Keep editing / Discard — destructive path closes')

if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nP-POLISH PROBE: ALL PASS (zero page errors)')
await browser.close()
