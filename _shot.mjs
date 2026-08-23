import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1600, height: 1050 } })
const errs = []
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message))
await p.goto('http://localhost:3011/effect-creator/grid-lab', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(3500)
await p.screenshot({ path: 'output/playwright/v1-origin-20july.png' })
console.log('errors:', errs.length ? errs.slice(0,3) : 'none')
await b.close()
