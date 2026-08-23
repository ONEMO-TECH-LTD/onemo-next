import { chromium } from 'playwright'
const BASE = 'http://localhost:3072/grid-engine'
const SHOTS = '.scratch/shots'
const SHAPES = ['BAT-WOMAN.png', 'PILL.png', 'BUTTERFLY.png']

const browser = await chromium.launch({ headless: false, args: ['--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)) })
page.on('crash', () => errors.push('PAGE CRASHED'))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
await page.screenshot({ path: `${SHOTS}/00-loaded.png` })
console.log('LOADED title=', await page.title())

const engineText = async () => {
  try {
    const row = page.locator('span:has-text("Engine")').first().locator('..')
    return (await row.innerText()).replace(/\n/g, ' | ')
  } catch { return '(no Engine row)' }
}

for (const shape of SHAPES) {
  const label = shape.replace('.png', '')
  console.log(`\n=== ${label} ===`)
  try {
    await page.selectOption('select[aria-label="Load a saved cut-out"]', shape, { timeout: 15000 })
  } catch (e) { console.log('selectOption failed:', String(e).slice(0, 200)); continue }
  for (let i = 0; i < 12; i += 1) {
    await page.waitForTimeout(1000)
    if (page.isClosed()) break
    const t = await engineText()
    if (t.includes('B')) break
  }
  if (page.isClosed()) { console.log('page closed during', label); break }
  const text = await engineText()
  console.log('engine row:', JSON.stringify(text))
  const chips = (await page.locator('button').allInnerTexts()).filter((c) => /^B\d+·\d+·\d+pt/.test(c))
  console.log('offer chips:', JSON.stringify(chips))
  await page.screenshot({ path: `${SHOTS}/${label}.png` })
  if (chips.length) {
    const chip = page.locator('button', { hasText: chips[0] }).first()
    const title = await chip.getAttribute('title')
    await chip.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${SHOTS}/${label}-picked.png` })
    console.log('picked:', chips[0])
    console.log('title evidence:', JSON.stringify(title))
  }
}
console.log('\n=== PAGE ERRORS ===', errors.length ? JSON.stringify(errors.slice(0, 6), null, 1) : 'none')
if (!page.isClosed()) await page.screenshot({ path: `${SHOTS}/99-final.png` })
await browser.close()
