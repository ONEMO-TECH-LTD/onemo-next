import { chromium } from 'playwright'
const BASE = 'http://localhost:3072/grid-engine'
const SHOTS = '.scratch/shots'
const SHAPES = ['BAT-WOMAN.png', 'PILL.png', 'BUTTERFLY.png', 'DUCK.png']

const browser = await chromium.launch({ headless: false })
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1200 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)) })

await page.goto(BASE, { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(2500)

for (const shape of SHAPES) {
  const label = shape.replace('.png', '')
  console.log(`\n=== ${label} ===`)
  await page.selectOption('select[aria-label="Load a saved cut-out"]', shape, { timeout: 15000 })
  await page.waitForTimeout(3000)
  const solve = page.locator('button', { hasText: /^solve$/ }).first()
  console.log('solve button present:', await solve.count() > 0)
  await solve.click({ timeout: 15000 })
  // the solve is synchronous-ish; give it room
  for (let i = 0; i < 30; i += 1) {
    await page.waitForTimeout(1000)
    const n = await page.locator('button').filter({ hasText: /^B\d+·/ }).count()
    const none = await page.locator('text=/^B\\d+: none$/').count()
    if (n > 0 || none > 0) break
  }
  const chips = (await page.locator('button').allInnerTexts()).filter((c) => /^B\d+·/.test(c.trim()))
  const nones = (await page.locator('span').allInnerTexts()).filter((c) => /^B\d+: none$/.test(c.trim()))
  console.log('offer chips:', JSON.stringify(chips))
  console.log('empty bands:', JSON.stringify(nones))
  await page.screenshot({ path: `${SHOTS}/solve-${label}.png` })
  if (chips.length) {
    const chip = page.locator('button').filter({ hasText: chips[0] }).first()
    console.log('title evidence:', JSON.stringify(await chip.getAttribute('title')))
    await chip.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${SHOTS}/solve-${label}-picked.png` })
  }
}
console.log('\n=== PAGE ERRORS ===', errors.length ? JSON.stringify(errors.slice(0, 6), null, 1) : 'none')
await browser.close()
