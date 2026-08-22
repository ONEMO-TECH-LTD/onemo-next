// Observe the v3.5.1 Law tab served from a checkout of 2c043257 on :4031; writes law-*.png beside this file.
import { chromium } from '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/node_modules/playwright/index.mjs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const out = dirname(fileURLToPath(import.meta.url))
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
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/law-${label}.png`, fullPage: false })
  const pressed = await page.locator('.gl-seg button[aria-pressed="true"]').allInnerTexts()
  console.log(`[${label}] pressed=${JSON.stringify(pressed)} snap=${JSON.stringify(await text('.gl-snap'))} steps=${JSON.stringify(await text('.gl-steps button'))}`)
  console.log(`[${label}] notes=${(await text('.gl-magic-note')).replace(/\s+/g, ' ').slice(0, 600)}`)
}
await snapshot('free-squircle72')
await page.getByRole('button', { name: 'B2', exact: true }).click(); await settled(); await snapshot('B2-squircle')
await page.getByRole('button', { name: 'Free', exact: true }).click(); await settled()
await page.getByRole('button', { name: 'Weight', exact: true }).click(); await settled(); await snapshot('free-squircle72-weight')
await page.getByRole('button', { name: 'Box', exact: true }).click()
await page.selectOption('select', 'diamond')
await page.getByRole('button', { name: 'B1', exact: true }).click(); await settled(); await snapshot('B1-diamond-box')
console.log('errors=' + JSON.stringify(errors))
await browser.close()
