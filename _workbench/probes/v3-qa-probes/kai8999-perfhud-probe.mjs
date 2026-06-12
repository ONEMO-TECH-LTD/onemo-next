// KAI-8999 self-verify — perf HUD: NOTHING renders un-armed; ?perf=1 mounts the live HUD.
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(2) }
const base = 'http://localhost:' + (process.env.PORT ?? '3006') + '/effect-creator/v3'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))

await page.goto(base, { waitUntil: 'networkidle' })
await sleep(500)
if (await page.locator('button[aria-label="Performance HUD"]').count()) fail('perf chip rendered WITHOUT ?perf=1')
console.log('clean load: zero perf chrome')

await page.goto(base + '?perf=1', { waitUntil: 'networkidle' })
await sleep(800)
if (!(await page.locator('button[aria-label="Performance HUD"]').count())) fail('?perf=1 did not mount the HUD')
const txt = await page.locator('button[aria-label="Performance HUD"]').textContent()
if (!/fps/.test(txt)) fail(`HUD mounted but not live (chip reads "${txt}")`)
console.log(`?perf=1: HUD live (${txt.trim()})`)
if (errs.length) fail('page errors:\n' + errs.join('\n'))
console.log('\nKAI-8999 PROBE: ALL PASS (zero page errors)')
await browser.close()
