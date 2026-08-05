// s62 cutout-lab model sweep — every model sub loaded fresh + upload + auto-detect, live bench.
import { chromium } from 'playwright'

const URL = 'https://localhost:3997/cutout-lab'
const KEYS = ['slim77', 'slim50', 'mobilesam', 'edgesam', 'sam2tiny']

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] })
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => document.body.innerText.includes('ready — upload an image'), null, { timeout: 180000 })

const fileBuf = await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 800; c.height = 800
  const x = c.getContext('2d')
  x.fillStyle = '#cfd8dc'; x.fillRect(0, 0, 800, 800)
  x.fillStyle = '#1a1c2c'
  x.beginPath(); x.arc(400, 460, 210, 0, 7); x.fill()
  x.beginPath(); x.moveTo(330, 270); x.lineTo(370, 130); x.lineTo(420, 270); x.closePath(); x.fill()
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  return Array.from(new Uint8Array(await blob.arrayBuffer()))
})
const buf = Buffer.from(fileBuf)

const kept = () => page.evaluate(() => {
  const cv = document.querySelectorAll('canvas')[0]
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
  let g = 0
  for (let i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 20 && d[i + 1] > d[i + 2] + 15) g++
  return (100 * g / (d.length / 4)).toFixed(1) + '%'
})
const stat = (label) => page.evaluate((l) => {
  const cells = [...document.querySelectorAll('div')].filter((el) => el.textContent.trim().toUpperCase() === l)
  return cells.length ? cells[cells.length - 1].nextElementSibling?.textContent : '—'
}, label)

for (const key of KEYS) {
  try {
    await page.selectOption('select', key)
    await page.waitForFunction(() => document.body.innerText.includes('ready — upload an image') || document.body.innerText.includes('⚠️'), null, { timeout: 300000 })
    if ((await page.textContent('body')).includes('⚠️')) { console.log(key, 'LOAD FAIL:', (await page.textContent('body')).match(/⚠️[^\n]*/)?.[0]); continue }
    await page.setInputFiles('input[type=file]', { name: 'test.png', mimeType: 'image/png', buffer: buf })
    await page.waitForFunction(() => document.body.innerText.includes('✨ done') || document.body.innerText.includes('⚠️'), null, { timeout: 300000 })
    const body = await page.textContent('body')
    if (body.includes('⚠️')) { console.log(key, 'RUN FAIL:', body.match(/⚠️[^\n]*/)?.[0]); continue }
    console.log(key.padEnd(10), 'kept', await kept(), '· load', await stat('MODEL LOAD'), '· encode', await stat('ENCODE / IMAGE'), '· recognize', await stat('RECOGNIZE'))
  } catch (e) { console.log(key, 'ERROR:', e.message.split('\n')[0]) }
}
await browser.close()
