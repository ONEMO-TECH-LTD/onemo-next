// F1 hypothesis test — KAI-8970: the wedge is an HMR race (stale CSS-module mapping at editor
// mount → unstyled overlay → static/transparent → opaque absolute 3D layer paints over it).
// Method: churn the editor's CSS module on disk (comment-only) to force HMR while looping
// Reset→Edit mounts; detect wedge = computed position !== 'fixed' OR transparent background.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:3004/effect-creator/v3'
const CSS = '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s57-v3-rebuild/src/app/(dev)/effect-creator/v3/user/outline-editor.module.css'
const ITER = Number(process.env.ITER ?? 30)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const cssOrig = readFileSync(CSS, 'utf8')
let churnOn = true
let churn = null
const startChurn = () => {
  churn = setInterval(() => {
    // comment-only churn — forces the dev server to recompile the CSS module each tick
    writeFileSync(CSS, churnOn ? cssOrig + `\n/* hmr-probe ${Date.now()} */\n` : cssOrig)
    churnOn = !churnOn
  }, 650)
}
const restore = () => { if (churn) clearInterval(churn); writeFileSync(CSS, cssOrig) }
process.on('exit', restore)
process.on('SIGINT', () => process.exit(1))

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
  const logs = []
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console] ${m.text()}`) })
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
  await page.goto(URL, { waitUntil: 'networkidle' })

  await page.evaluate(async () => {
    const cv = document.createElement('canvas')
    cv.width = 1200; cv.height = 900
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#cdbfa5'; ctx.fillRect(0, 0, 1200, 900)
    ctx.fillStyle = '#2b2f3c'
    ctx.beginPath(); ctx.ellipse(600, 450, 260, 300, 0, 0, Math.PI * 2); ctx.fill()
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'probe.png', { type: 'image/png' }))
    const input = document.querySelector('input[type=file][accept="image/*"]')
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForSelector('button[aria-label="Editor"]:not([disabled])', { timeout: 30000 })
  startChurn()
  console.log('ready; HMR churn running every 650ms')

  const check = () => page.evaluate(() => {
    const close = document.querySelector('button[aria-label="Close"]')
    if (!close) return { mounted: false }
    const overlay = close.closest('[class*="overlay"]') ?? close.parentElement?.parentElement?.parentElement
    const cs = overlay ? getComputedStyle(overlay) : null
    const cr = close.getBoundingClientRect()
    const at = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2)
    return {
      mounted: true,
      position: cs?.position, bg: cs?.backgroundColor, z: cs?.zIndex,
      overlayClass: String(overlay?.className).slice(0, 60),
      closeRect: { x: cr.x, y: cr.y, w: cr.width, h: cr.height },
      closeHit: at ? (close === at || close.contains(at)) : false,
      atPoint: at ? `${at.tagName}.${String(at.className).slice(0, 50)}` : null,
    }
  })

  for (let i = 1; i <= ITER; i++) {
    const reset = page.locator('button[title="Reset"]')
    if (await reset.isEnabled().catch(() => false)) await reset.click()
    await sleep(i % 3 === 0 ? 0 : i % 3 === 1 ? 120 : 350)
    await page.locator('div[class*="bar"] button[aria-label="Edit"]').first().click().catch(() => {})
    await sleep(500)
    const d = await check()
    if (!d.mounted) { console.log(`iter ${i}: not mounted (Edit click missed?)`); continue }
    const wedged = d.position !== 'fixed' || d.bg === 'rgba(0, 0, 0, 0)' || !d.closeHit
    console.log(`iter ${i}: pos=${d.position} bg=${d.bg} closeHit=${d.closeHit} at=${d.atPoint} cls=${d.overlayClass}`)
    if (wedged) {
      console.log(`\n=== WEDGE REPRODUCED (iter ${i}) ===`)
      console.log(JSON.stringify(d, null, 2))
      console.log('--- errors ---\n' + (logs.slice(-20).join('\n') || '(none)'))
      await page.screenshot({ path: `/tmp/f1-hmr-wedge-${i}.png` })
      console.log(`screenshot: /tmp/f1-hmr-wedge-${i}.png`)
      restore()
      process.exit(2)
    }
    // close (programmatic — recovery path; we're testing the mount, not the close)
    await page.evaluate(() => document.querySelector('button[aria-label="Close"]')?.click())
    await sleep(200)
  }
  console.log(`\nNO WEDGE in ${ITER} HMR-churned mounts`)
  restore()
  await browser.close()
}

main().catch((e) => { console.error('probe error:', e); restore(); process.exit(1) })
