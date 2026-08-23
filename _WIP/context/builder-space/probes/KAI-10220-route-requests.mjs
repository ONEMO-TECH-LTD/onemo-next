import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, webkit } from 'playwright'

const baseUrl = process.env.CUTOUT_V1_BASE_URL
const fixture = resolve('public/assets/test-artwork.png')
const browserType = process.env.OPENCV_BROWSER === 'webkit' ? webkit : chromium
const browser = await browserType.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await context.newPage()
const requests = []
page.on('request', (request) => {
  if (request.resourceType() === 'script') requests.push(request.url())
})
const status = page.locator('p').filter({ hasText: 'Status:' })

try {
  await page.goto(new URL('/cutout-lab', baseUrl).href, { waitUntil: 'networkidle' })
  const baseline = requests.length
  await page.locator('input[type=file]').first().setInputFiles(fixture)
  await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
  const afterUpload = requests.length
  await page.getByRole('button', { name: /^🤖 AI$/ }).click()
  await page.getByRole('button', { name: /Erase/ }).click()
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.48)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.56, box.y + box.height * 0.52, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(2_000)
  const scratchStatus = await status.textContent()
  const afterScratchErase = requests.length
  await page.getByRole('button', { name: /Add/ }).click()
  await page.mouse.move(box.x + box.width * 0.43, box.y + box.height * 0.47)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.54, { steps: 8 })
  await page.mouse.up()
  await status.filter({ hasText: /shape recognised|nothing recognised/ }).waitFor({ timeout: 60_000 })
  const preview = page.getByRole('button', { name: /Preview|Editing view/ })
  if ((await preview.textContent())?.includes('Preview')) await preview.click()
  await page.getByText('Preview — same result, cut out').waitFor()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: /Save/ }).click()
  const bytes = readFileSync(await (await pending).path())
  const output = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: createHash('sha256').update(bytes).digest('hex') }
  console.log(JSON.stringify({ browser: browserType.name(), baseline, afterUpload, scratchStatus, afterScratchErase, final: requests.length, added: requests.slice(baseline), output }, null, 2))
} finally {
  await context.close()
  await browser.close()
}
