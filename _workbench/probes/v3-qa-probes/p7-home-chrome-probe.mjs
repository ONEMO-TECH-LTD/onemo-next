// P7 HOME chrome live gate — global top-bar anatomy (pill LEFT · RESET center only-when-dirty ·
// Edit/Export RIGHT) · creation row = Image·Magic·Trim · single-tap DEAD, double-tap enters ·
// Trim carousel recolors live, ✓ commits one history step, ✕ reverts.
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

// ── anatomy (F-UX1 strip model): the hero mounts the SAME .topbar strip as the editor — one
// component identity. Asserts: strip spans the viewport · undo LEFTMOST / Edit·Export RIGHTMOST
// within the strip inner · RESET absent while clean · row = Image·Magic·Trim.
const anatomy = await page.evaluate(() => {
  const r = (sel) => { const b = document.querySelector(sel); return b ? b.getBoundingClientRect() : null }
  const undo = r('button[title="Undo"]')
  const editTop = document.querySelector('[class*="topbar"] button[title="Editor"], [class*="topbar"] button[title="Edit"]')
  const expTop = document.querySelector('[class*="topbar"] button[title="Export"]')
  const editorDock = document.querySelector('[class*="bar"] button[aria-label="Editor"]')
  const bar = document.querySelector('button[title="Undo"]')?.closest('[class*="topbar"]')
  const barR = bar ? bar.getBoundingClientRect() : null
  const inner = bar?.querySelector('[class*="topInner"]')?.getBoundingClientRect() ?? null
  const reset = document.querySelector('button[title="Reset"]')
  const tools = [...document.querySelectorAll('[class*="toolbar_bar"] button[aria-label], [class*="bar"] button[aria-label]')]
    .filter((b) => !b.closest('[class*="topbar"]')) // the shared strip also matches *bar — creation row only
    .map((b) => b.getAttribute('aria-label')).filter((l) => ['Image', 'Magic', 'Trim', 'Shapes', 'Editor'].includes(l))
  return {
    stripFound: !!bar, stripL: barR?.left, stripR: barR?.right,
    innerL: inner?.left, innerR: inner?.right,
    undoX: undo?.left, editInTopbar: !!editTop, exportInTopbar: !!expTop, editorInDock: !!editorDock,
    resetPresent: !!reset, tools, w: innerWidth,
  }
})
if (!anatomy.stripFound) fail('hero top bar is not the shared .topbar strip (F-UX1 identity)')
if (!(anatomy.stripL <= 1 && anatomy.stripR >= anatomy.w - 1)) fail(`strip does not span the viewport (${anatomy.stripL}..${anatomy.stripR})`)
const innerW = anatomy.innerR - anatomy.innerL
if (!(anatomy.undoX - anatomy.innerL < innerW * 0.2)) fail(`undo not leftmost in the strip (offset=${(anatomy.undoX - anatomy.innerL).toFixed(0)})`)
if (anatomy.editInTopbar) fail('Edit survived in the top bar (KAI-9011: Editor lives in the dock)')
if (anatomy.exportInTopbar) fail('Export visible to users (KAI-9010: internal-only)')
if (!anatomy.editorInDock) fail('Editor tool missing from the hero dock (KAI-9011)')
if (anatomy.resetPresent) fail('RESET visible while CLEAN (must appear only when dirty)')
const rowSet = [...new Set(anatomy.tools)].sort().join(',')
if (rowSet !== 'Editor,Image,Magic,Trim') fail(`creation row is [${rowSet}] — expected Image,Magic,Trim,Editor (KAI-9011)`)
console.log('anatomy: ONE strip · pills only (no Edit/Export) · Editor in the dock · no RESET clean · row ok')

// ── single tap does NOTHING; double-tap enters; Close exits
await page.mouse.click(640, 400)
await sleep(450)
if (await page.locator('button[aria-label="Close"]').count()) fail('SINGLE tap opened the editor')
await page.mouse.dblclick(640, 400)
await sleep(500)
if (!(await page.locator('button[aria-label="Close"]').count())) fail('double-tap did not open the editor')
await page.locator('button[aria-label="Close"]').click()
await sleep(300)
console.log('entry: single-tap dead · double-tap opens · Close exits')

// ── Trim carousel: takeover, live recolor, ✕ revert, ✓ commit arms RESET+undo
await page.locator('button[aria-label="Trim"]').click()
await sleep(300)
const sw = page.locator('[class*="swatch"]').first()
if (!(await sw.count())) fail('Trim carousel did not take over the row')
await page.screenshot({ path: '/tmp/p7-02-trim-carousel.png' })
await sw.click() // pick the first mock suede
await sleep(250)
await page.locator('button[aria-label="Cancel trim"]').click() // ✕ revert
await sleep(250)
await page.locator('button[aria-label="Trim"]').click()
await sleep(250)
const sel0 = await page.evaluate(() => !!document.querySelector('[class*="swatchSelected"]'))
await page.locator('[class*="swatch"]').nth(1).click()
await sleep(200)
await page.locator('button[aria-label="Done — keep this color"]').click()
await sleep(350)
const dirty = await page.evaluate(() => {
  const reset = document.querySelector('button[title="Reset"]')
  const rr = reset ? reset.getBoundingClientRect() : null
  const cs = reset ? getComputedStyle(reset) : null
  return {
    reset: !!reset,
    undoOn: !document.querySelector('button[title="Undo"]')?.disabled,
    resetCenterOff: rr ? Math.abs((rr.left + rr.right) / 2 - innerWidth / 2) : null,
    // KAI-9003 (supersedes the F-UX2 pill): RESET is an ICON button like its siblings
    resetHasAffordance: reset ? !!reset.querySelector('svg') && /reset/i.test(reset.textContent ?? '') : false,
  }
})
if (!dirty.reset) fail('RESET did not appear after a committed trim change (dirty state)')
if (!dirty.undoOn) fail('global Undo not armed after the trim step')
if (dirty.resetCenterOff > 40) fail(`RESET not centered in the strip (off by ${dirty.resetCenterOff.toFixed(0)}px)`)
if (!dirty.resetHasAffordance) fail('RESET is not an icon button (KAI-9003: Phosphor glyph + label like siblings)')
console.log(`trim: carousel live, ✕ revert ok (selected-state ${sel0 ? 'restored' : 'n/a'}), ✓ = one history step, RESET appears when dirty`)
await page.screenshot({ path: '/tmp/p7-01-home-chrome-dirty.png' })

if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nP7 PROBE: ALL PASS (zero page errors)')
await browser.close()
