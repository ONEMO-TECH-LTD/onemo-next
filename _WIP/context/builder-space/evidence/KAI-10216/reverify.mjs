import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const evidenceDir = resolve('_WIP/context/builder-space/evidence/KAI-10216/playwright-reconciled')
const detail = process.env.CUTOUT_V1_DETAIL ?? '25'
mkdirSync(evidenceDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, acceptDownloads: true })
const page = await context.newPage()
const consoleProblems = []
page.on('console', (message) => {
  if (message.type() === 'warning' || message.type() === 'error') {
    consoleProblems.push(`${message.type()}: ${message.text()}`)
  }
})

try {
  await page.goto('http://127.0.0.1:4001/cutout-lab', { waitUntil: 'networkidle' })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('input[type=file]').first().setInputFiles(resolve('public/assets/test-artwork.png'))
  await page.getByText(/image ready/).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /Detect/ }).click()
  await page.getByText(/done \(cut: u2netp\)/).waitFor({ timeout: 180_000 })
  await page.getByRole('button', { name: /Vector/ }).click()
  await page.locator('input[type=number]').fill(detail)
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Preview/ }).click()
  await page.getByText('Preview — same result, cut out').waitFor({ timeout: 30_000 })
  await page.screenshot({ path: resolve(evidenceDir, 'upload-detect-edit-preview.png'), fullPage: true })

  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByRole('button', { name: /Save/ }).click()
  const download = await downloadPromise
  await download.saveAs(resolve(evidenceDir, 'cutout.png'))

  console.log(JSON.stringify({
    status: await page.getByText(/done \(cut: u2netp\)/).textContent(),
    detail: await page.locator('input[type=number]').inputValue(),
    preview: await page.getByText('Preview — same result, cut out').isVisible(),
    viewport: page.viewportSize(),
    cleanStart: 'new context; cookies empty; localStorage/sessionStorage cleared; route reloaded',
    interactions: ['Upload test-artwork.png', 'Detect', 'Vector', `Detail ${detail}`, 'Preview', 'Save'],
    browser: browser.version(),
    userAgent: await page.evaluate(() => navigator.userAgent),
    devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
    consoleProblems,
  }))
} finally {
  await context.close()
  await browser.close()
}
