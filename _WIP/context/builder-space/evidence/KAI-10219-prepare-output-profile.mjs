import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.CUTOUT_V1_BASE_URL
assert(baseUrl, 'CUTOUT_V1_BASE_URL must name the already-running current-code server')
const fixturePath = resolve(process.env.CUTOUT_V1_FIXTURE ?? 'public/assets/test-artwork.png')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await context.newPage()
const profiles = []
page.on('console', (message) => {
  if (message.type() === 'info' && message.text().startsWith('[cutout-prepare-output-profile]')) {
    profiles.push(JSON.parse(message.text().slice(message.text().indexOf('{'))))
  }
})

try {
  await page.goto(new URL('/cutout-lab', baseUrl).href, { waitUntil: 'networkidle' })
  await page.locator('input[type=file]').first().setInputFiles(fixturePath)
  const status = page.locator('p').filter({ hasText: 'Status:' })
  await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
  for (let run = 0; run < 3; run += 1) {
    await page.getByRole('button', { name: /Detect/ }).click()
    await status.filter({ hasText: /done \(cut: u2netp\)/ }).waitFor({ timeout: 180_000 })
    await page.waitForTimeout(250)
  }
  assert.equal(profiles.length, 3, 'each prepare must report its unused-output cost')
  console.log(JSON.stringify({ fixture: fixturePath, viewport: { width: 1280, height: 720 }, profiles }))
} finally {
  await context.close()
  await browser.close()
}
