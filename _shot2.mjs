import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1600, height: 1050 } })
await p.goto('http://localhost:3011/effect-creator/grid-lab', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(2500)
// drive the effect-size slider up
const sliders = p.locator('input[type=range]')
const size = sliders.nth(0)
await size.evaluate((el) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(el, '200'); el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
})
await p.waitForTimeout(3000)
await p.screenshot({ path: 'output/playwright/v1-origin-200mm.png' })
console.log('done')
await b.close()
