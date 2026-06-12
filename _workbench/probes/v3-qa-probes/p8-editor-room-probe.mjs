// P8 live gate — the shape editor room (plan A2/A3): top-bar anatomy + dirty states + discard
// protection · chip restructure (basics first, no Pebble, ✦ groups, Magic ✦ trail) · double-tap
// Frame⇄Points · REAL Curve (tension commit) · universal Tune on a PRESET (the D3 gate) ·
// Blend lives in Image (ruler-from-0) · Scale/Blend gone from Adjust.
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
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#cdbfa5'; ctx.fillRect(0, 0, 1200, 900)
  ctx.fillStyle = '#2b2f3c'; ctx.beginPath(); ctx.ellipse(600, 450, 260, 300, 0, 0, Math.PI * 2); ctx.fill()
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.png', { type: 'image/png' }))
  const input = document.querySelector('input[type=file][accept="image/*"]')
  input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForSelector('button[aria-label="Editor"]:not([disabled])', { timeout: 30000 })
await page.locator('button[title="Editor"]').click()
await page.waitForSelector('button[aria-label="Close"]')
await sleep(400)

// ── 1: topbar anatomy — Points MODE button present+off (Dan KAI-9022), no RESET clean, Done un-accented
const bar0 = await page.evaluate(() => {
  const pts = document.querySelector('[class*="topbar"] button[aria-label="Points"]')
  return {
    points: !!pts,
    pointsOn: pts?.getAttribute('aria-pressed') === 'true',
    reset: !!document.querySelector('[class*="topbar"] button[title="Reset"]'),
    doneAccent: !!document.querySelector('[class*="topbar"] button[aria-label="Done"][class*="Primary"]'),
  }
})
if (!bar0.points) fail('Points mode button missing from the topbar (Dan ruling KAI-9022)')
if (bar0.pointsOn) fail('Points mode ON at open — frame must be the default')
if (bar0.reset) fail('editor RESET visible while clean')
if (bar0.doneAccent) fail('Done accented while clean')
console.log('topbar: Points button present (off, frame default) · RESET hidden clean · Done quiet')

// ── 2: chips — Square first, no Pebble, Magic ✦ trail, Upload present
const chips = await page.evaluate(() => [...document.querySelectorAll('[class*="chipLabel"]')].map((c) => c.textContent))
if (chips[0] !== 'Upload') fail(`first chip is ${chips[0]} — Upload leads (KAI-9024)`)
if (chips[1] !== 'Square') fail(`second chip is ${chips[1]} — basics follow Upload`)
if (chips.includes('Pebble')) fail('Pebble survived (Dan: dupe of blob)')
if (chips.includes('Magic ✦')) fail('Magic ✦ trail chip survived (KAI-9023: Magic lives in the dock)')
if (!(await page.locator('[class*="overlay"] [class*="bar"] button[aria-label="Magic"]').count())) fail('Magic missing from the editor dock (KAI-9023)')
if (!chips.includes('Form ✦') || !chips.includes('Daisy ✦')) fail('generative chips not ✦-marked')
console.log(`chips: [${chips.slice(0, 3).join(' · ')} … ${chips.slice(-3).join(' · ')}] — order + marks correct`)

// ── 3: dirty states — pick Heart → RESET appears + Done accents
await page.locator('button[aria-label="Heart"]').click()
await sleep(350)
const bar1 = await page.evaluate(() => {
  const reset = document.querySelector('[class*="topbar"] button[title="Reset"]')
  const cs = reset ? getComputedStyle(reset) : null
  return {
    reset: !!reset,
    // KAI-9003: an icon button like its siblings (glyph + label)
    affordance: reset ? !!reset.querySelector('svg') : false,
    doneAccent: !!document.querySelector('[class*="topbar"] button[aria-label="Done"][class*="Primary"]'),
  }
})
if (!bar1.reset) fail('RESET did not appear when dirty')
if (!bar1.affordance) fail('RESET is not an icon button (KAI-9003)')
if (!bar1.doneAccent) fail('Done did not accent when dirty (UX-3)')
console.log('dirty: RESET icon button appears · Done accents')
await page.screenshot({ path: '/tmp/p8-01-editor-dirty-anatomy.png' })

// ── 4a: the explicit MODE button toggles Frame ⇄ Points (KAI-9022)
{
  const btn = page.locator('[class*="topbar"] button[aria-label="Points"]')
  await btn.click(); await sleep(300)
  const n = await page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle[class*="node"]').length)
  if (n === 0) fail('Points button did not enter point view')
  await btn.click(); await sleep(300)
  const n2 = await page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle[class*="node"]').length)
  if (n2 > 0) fail('Points button did not return to Frame')
  console.log(`mode button: Frame ⇄ Points toggles (${n} anchors shown)`)
}

// ── 4b: KAI-9013 — double-tap OUTSIDE the shape fill (the Dan case on Magic cuts) also toggles
{
  const svgB2 = await page.locator('[class*="canvas"] svg').boundingBox()
  await page.mouse.dblclick(svgB2.x + svgB2.width * 0.06, svgB2.y + svgB2.height * 0.06)
  await sleep(300)
  const n = await page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle[class*="node"]').length)
  if (n === 0) fail('double-tap outside the fill did not enter Points (KAI-9013)')
  await page.mouse.dblclick(svgB2.x + svgB2.width * 0.06, svgB2.y + svgB2.height * 0.06)
  await sleep(300)
  const n2 = await page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle[class*="node"]').length)
  if (n2 > 0) fail('second outside double-tap did not return to Frame')
  console.log('double-tap outside the fill toggles (the Magic-cut case)')
}

// ── 4: double-tap = Frame ⇄ Points
const svgB = await page.locator('[class*="canvas"] svg').boundingBox()
// anchors = node-class circles only — the frame's padlock chip + rotate handle are circles too (P-polish)
const anchors = () => page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle[class*="node"]').length)
if (await anchors() > 0) fail('anchors visible in FRAME default')
await page.mouse.dblclick(svgB.x + svgB.width / 2, svgB.y + svgB.height / 2)
await sleep(300)
const nPts = await anchors()
if (nPts === 0) fail('double-tap did not enter Points')
await page.mouse.dblclick(svgB.x + svgB.width / 2, svgB.y + svgB.height / 2)
await sleep(300)
if (await anchors() > 0) fail('double-tap did not return to Frame')
console.log(`frame⇄points: double-tap toggles (${nPts} anchors in Points)`)

// ── 5: REAL Curve — select an anchor, bend, commit changes the path
await page.mouse.dblclick(svgB.x + svgB.width / 2, svgB.y + svgB.height / 2)
await sleep(250)
const aPos = await page.evaluate(() => {
  const c = document.querySelectorAll('[class*="canvas"] svg circle')[0]
  const r = c.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})
await page.mouse.click(aPos.x, aPos.y)
await sleep(250)
await page.locator('[class*="overlay"] button[aria-label="Adjust"]').click()
await sleep(250)
// KAI-9020: selecting Adjust auto-enters point view
if ((await page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle[class*="node"]').length)) === 0) {
  fail('Adjust did not auto-switch to point view (KAI-9020)')
}
await page.locator('[class*="overlay"] button[aria-label="Curve"]').click()
await sleep(200)
const curveBar = page.locator('[aria-label="Curve"][aria-valuenow]')
if (!(await curveBar.count())) fail('Curve ruler absent with a selected anchor')
const dBefore = await page.evaluate(() => document.querySelector('[class*="canvas"] svg [class*="path"]')?.getAttribute('d'))
const cb = await curveBar.boundingBox()
await page.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height / 2)
await page.mouse.down()
await page.mouse.move(cb.x + cb.width * 0.85, cb.y + cb.height / 2, { steps: 8 })
await page.mouse.up()
await sleep(350)
const dAfter = await page.evaluate(() => document.querySelector('[class*="canvas"] svg [class*="path"]')?.getAttribute('d'))
if (dBefore === dAfter) fail('Curve commit did not change the geometry')
console.log('Curve: REAL — tension commit changed the path')
await page.screenshot({ path: '/tmp/p8-02-curve-bent.png' })

// ── 6: KAI-9017/9016 — ONE row, full toolset (Radius·Curve·Detail·Smooth·Snap·Angle·Line),
// no Tune ✦ submenu, Scale/Blend dead; Detail re-derives a PRESET (D3 universal gate)
const adjustChips = await page.evaluate(() => [...document.querySelectorAll('[class*="shapeSheet"] [class*="chipRow"] [class*="chipLabel"]')].map((c) => c.textContent))
if (adjustChips.includes('Scale') || adjustChips.includes('Blend')) fail(`Adjust still carries ${adjustChips}`)
if (adjustChips.some((c) => /Tune/.test(c))) fail('Tune ✦ submenu chip survived (KAI-9016: full row, no subs)')
for (const need of ['Detail', 'Smooth', 'Snap', 'Angle', 'Line']) {
  if (!adjustChips.includes(need)) fail(`Adjust row missing ${need} (KAI-9017 one-row toolset)`)
}
await page.locator('[class*="overlay"] button[aria-label="Detail"]').click()
await sleep(250)
const detailBar = page.locator('[aria-label="Detail"][aria-valuenow]')
if (!(await detailBar.count())) fail('Tune Detail ruler absent on a PRESET shape (D3 universal gate)')
const db = await detailBar.boundingBox()
await page.mouse.move(db.x + db.width * 0.5, db.y + db.height / 2)
await page.mouse.down()
await page.mouse.move(db.x + db.width * 0.3, db.y + db.height / 2, { steps: 6 })
await page.mouse.up()
await sleep(400)
const dTuned = await page.evaluate(() => document.querySelector('[class*="canvas"] svg [class*="path"]')?.getAttribute('d'))
if (dTuned === dAfter) fail('universal Tune commit did not re-derive the preset')
console.log(`Adjust: one row [${adjustChips.join('·')}] · Detail re-derived a PRESET (D3 gate)`)

// ── 7: Blend lives in Image (ruler-from-0); UX-2 discard protection on dirty ✕
// UX-2 on the GEOMETRY-dirty session: ✕ asks (Keep editing / Discard) — keep editing, then leave
await page.locator('[class*="overlay"] button[aria-label="Close"]').click()
await sleep(250)
if (!(await page.locator('[class*="discardBar"]').count())) fail('discard confirm bar not shown on dirty ✕')
if (!(await page.locator('[class*="keepBtn"]').count())) fail('Keep-editing button missing from the confirm bar')
await page.locator('[class*="keepBtn"]').click(); await sleep(200)
console.log('UX-2: geometry-dirty ✕ asks; Keep editing holds the session')

await (async () => { // KAI-9027: image mode is entered from the hero (Filters)
  if (await page.locator('button[aria-label="Close"]').count()) {
    await page.locator('button[aria-label="Close"]').click(); await sleep(250)
    const d = page.locator('[class*="discardBtn"]'); if (await d.count()) { await d.click(); await sleep(300) }
  }
  await page.locator('button[aria-label="Filters"]').click(); await sleep(350)
})()
await sleep(250)
if (!(await page.locator('[class*="overlay"] button[aria-label="Blend"]').count())) fail('Blend chip missing from Image mode')
// KAI-9020 symmetry: Image mode never shows anchors
if ((await page.evaluate(() => document.querySelectorAll('[class*="canvas"] svg circle[class*="node"]').length)) > 0) {
  fail('anchors survived the switch to Image mode')
}
// fx-only ✕ discards silently (the accepted F2 contract) — close out
await page.locator('[class*="overlay"] button[aria-label="Close"]').click()
await sleep(300)
if (await page.locator('button[aria-label="Close"]').count()) fail('fx-only ✕ did not close the session')
console.log('Blend lives in Image (via hero Filters) · anchors never in image mode · fx-only ✕ closes silently')

if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nP8 PROBE: ALL PASS (zero page errors)')
await browser.close()
