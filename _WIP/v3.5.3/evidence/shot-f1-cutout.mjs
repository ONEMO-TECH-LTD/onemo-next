// F1 fixture 5 on a real cutout: pick the first library cutout, walk B1–B4, read the solve time and ladder.
import { chromium } from '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/node_modules/playwright/index.mjs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const out = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
const settled = () => page.waitForFunction(() => !document.querySelector('.gl-solving'), null, { timeout: 240000 })
await page.goto('http://localhost:4031/effect-creator/grid-origin', { waitUntil: 'load', timeout: 180000 })
await page.evaluate(() => { localStorage.setItem('magnetic-grid.compare.v1.surface', '2'); localStorage.setItem('magnetic-grid.compare.v1.flap', '0') })
await page.reload({ waitUntil: 'load', timeout: 180000 })
await page.waitForSelector('.gl-vp svg', { state: 'visible', timeout: 120000 }); await settled()
await page.getByRole('button', { name: 'Cutouts', exact: true }).click()
const sel = page.locator('select').first()
const options = await sel.locator('option').allInnerTexts()
const name = options.find((o) => !o.startsWith('—'))
console.log('cutout=' + name + ' of ' + (options.length - 1))
await sel.selectOption({ label: name }); await page.waitForSelector('.gl-vp svg', { state: 'visible', timeout: 120000 }); await settled()
const text = async (s) => (await page.locator(s).allInnerTexts()).join(' | ')
for (const [i, b] of ['B1', 'B2', 'B3', 'B4'].entries()) {
  await page.getByRole('button', { name: b, exact: true }).click(); await settled(); await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/F1-cutout-${b}.png` })
  console.log(`[cutout/${b}] snap="${(await text('.gl-snap')).replace(/\s+/g, ' ')}" chips=${JSON.stringify(await text('.gl-steps button'))} perf="${(await text('.gl-perf')).replace(/\s+/g, ' ')}"`)
  if (i === 0) { /* the first band request performs the whole even-size solve; later bands read storage */ }
}
await page.locator('label.gl-toggle input[type=checkbox]').first().check(); await settled(); await page.waitForTimeout(600)   // Auto flap
for (const b of ['B1', 'B2', 'B3', 'B4']) { await page.getByRole('button', { name: b, exact: true }).click(); await settled(); await page.waitForTimeout(400); console.log(`[cutout-auto/${b}] snap="${(await text('.gl-snap')).replace(/\s+/g, ' ')}" wrap="${(await text('.gl-magic-note')).match(/Wrap (lawful|refused)[^|]*/)?.[0]?.trim()}" perf="${(await text('.gl-perf')).replace(/\s+/g, ' ')}"`) }
await page.screenshot({ path: `${out}/F1-cutout-auto-B4.png` })
console.log('errors=' + JSON.stringify(errors))
await browser.close()
