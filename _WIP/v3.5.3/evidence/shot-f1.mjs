// F1 live gate capture: the Law tab served from the build worktree on :4031.
// usage: node shot-f1.mjs <label>   → writes <label>-*.png beside this file and prints one line per observation.
import { chromium } from '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/node_modules/playwright/index.mjs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const out = dirname(fileURLToPath(import.meta.url))
const label = process.argv[2] ?? 'F1'
const url = 'http://localhost:4031/effect-creator/grid-origin'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
const settled = () => page.waitForFunction(() => !document.querySelector('.gl-solving'), null, { timeout: 240000 })
await page.goto(url, { waitUntil: 'load', timeout: 180000 })
await page.evaluate(() => { localStorage.setItem('magnetic-grid.compare.v1.surface', '2'); localStorage.setItem('magnetic-grid.compare.v1.flap', '0') })
await page.reload({ waitUntil: 'load', timeout: 180000 })
await page.waitForSelector('.gl-vp svg', { state: 'visible', timeout: 120000 })
await settled()
const text = async (sel) => (await page.locator(sel).allInnerTexts()).join(' | ')
const observe = async (name) => {
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/${label}-${name}.png` })
  const notes = (await text('.gl-magic-note')).replace(/\s+/g, ' ')
  const wrap = notes.match(/Wrap (lawful|refused)[^|]*/)?.[0]?.trim() ?? '(no wrap note)'
  const perf = (await text('.gl-perf')).replace(/\s+/g, ' ')
  const dots = await page.locator('.gl-vp svg circle[fill="var(--pass)"][r="0.9"]').count()
  const magnets = await page.locator('.gl-vp svg g[opacity="0.5"]').count()
  console.log(`[${label}/${name}] snap="${(await text('.gl-snap')).replace(/\s+/g, ' ')}" chips=${JSON.stringify(await text('.gl-steps button'))} wrap="${wrap}" magnets=${magnets} dots=${dots} perf="${perf}"`)
}
const clickBand = async (b) => { await page.getByRole('button', { name: b, exact: true }).click(); await settled() }
const honesty = (await text('.gl-magic-note')).replace(/\s+/g, ' ')
console.log(`[${label}] honesty="${honesty.match(/Centre \+ Wrap[^|]*/)?.[0]?.slice(0, 160)}" tabs=${JSON.stringify(await page.locator('.gl-seg button[aria-pressed]').filter({ hasText: /Voting|Centre rules|v3\.5\.1/ }).allInnerTexts())}`)
for (const shape of ['square', 'squircle', 'diamond', 'circle']) {
  await page.selectOption('select', shape); await settled()
  for (const b of ['B1', 'B2', 'B3', 'B4']) { await clickBand(b); await observe(`${shape}-${b}`) }
  await clickBand('Free')
}
// co-lawful layout chips on the square B2 (2-magnet rung has vertical pair only; 4-magnet canonical)
await page.selectOption('select', 'square'); await settled(); await clickBand('B2')
const chips = page.locator('.gl-steps button')
for (let i = 0; i < Math.min(await chips.count(), 4); i++) { await chips.nth(i).click(); await settled(); await observe(`square-B2-chip${i + 1}`) }
console.log('errors=' + JSON.stringify(errors))
await browser.close()
