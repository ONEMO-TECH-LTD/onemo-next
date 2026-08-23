// Observe the Law tab served from the build worktree on :4031; writes <step>-*.png beside this file.
// usage: node shot-law-tab.mjs <step-label>
import { chromium } from '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/node_modules/playwright/index.mjs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const out = dirname(fileURLToPath(import.meta.url))
const step = process.argv[2] ?? 'step'
const url = 'http://localhost:4031/effect-creator/grid-origin'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
const settled = () => page.waitForFunction(() => !document.querySelector('.gl-solving'), null, { timeout: 180000 })
await page.goto(url, { waitUntil: 'load', timeout: 180000 })
await page.evaluate(() => { localStorage.setItem('magnetic-grid.compare.v1.surface', '2'); localStorage.setItem('magnetic-grid.compare.v1.flap', '0') })
await page.reload({ waitUntil: 'load', timeout: 180000 })
await page.waitForSelector('.gl-vp svg', { state: 'visible', timeout: 120000 })
await settled()
const text = async (sel) => (await page.locator(sel).allInnerTexts()).join(' | ')
const snapshot = async (label) => {
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/${step}-${label}.png`, fullPage: false })
  const notes = (await text('.gl-magic-note')).replace(/\s+/g, ' ')
  const wrap = notes.match(/Wrap (lawful|refused)[^|]*/)?.[0] ?? '(no wrap note)'
  const dots = await page.locator('.gl-vp svg circle[fill="var(--pass)"][r="0.9"]').count()
  console.log(`[${step}/${label}] pressed=${JSON.stringify(await page.locator('.gl-seg button[aria-pressed="true"]').allInnerTexts())} wrap="${wrap.trim()}" truthDots=${dots} snap=${JSON.stringify(await text('.gl-snap'))}`)
}
const setSize = async (mm) => { await page.locator('.gl-slider input[type=number]').first().fill(String(mm)); await page.locator('.gl-slider input[type=number]').first().press('Enter'); await settled() }
await snapshot('free-squircle72-masses')
await page.getByRole('button', { name: 'Weight', exact: true }).click(); await settled(); await snapshot('free-squircle72-weight')
await page.getByRole('button', { name: 'Box', exact: true }).click(); await settled()
await page.selectOption('select', 'square'); await settled()
await setSize(24); await snapshot('free-square24')
await setSize(26); await snapshot('free-square26')
await page.selectOption('select', 'diamond'); await settled()
await setSize(34); await snapshot('free-diamond34')
await setSize(36); await snapshot('free-diamond36')
console.log('errors=' + JSON.stringify(errors))
await browser.close()
