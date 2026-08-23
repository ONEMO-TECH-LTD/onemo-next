import { chromium } from 'playwright'
import { resolve } from 'node:path'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
try {
  await page.goto('http://127.0.0.1:4001/cutout-lab', { waitUntil: 'networkidle' })
  await page.locator('input[type=file]').first().setInputFiles(resolve('public/assets/test-artwork.png'))
  await page.getByText(/image ready/).waitFor()
  await page.getByRole('button', { name: /Detect/ }).click()
  await page.getByText(/done \(cut: u2netp\)/).waitFor({ timeout: 180_000 })
  await page.getByRole('button', { name: /Edit/ }).click()
  await page.getByRole('button', { name: /Frame/ }).click()
  console.log(JSON.stringify(await page.evaluate(() => ({
    canvas: [...document.querySelectorAll('canvas')].map((e) => ({ box: e.getBoundingClientRect().toJSON(), width: e.width, height: e.height })),
    svg: [...document.querySelectorAll('svg')].map((e) => ({ box: e.getBoundingClientRect().toJSON(), viewBox: e.getAttribute('viewBox'), rects: [...e.querySelectorAll('rect')].map((r) => ({ x: r.getAttribute('x'), y: r.getAttribute('y'), width: r.getAttribute('width'), height: r.getAttribute('height') })) })),
    buttons: [...document.querySelectorAll('button')].map((e) => ({ text: e.textContent, disabled: e.disabled })),
  })), null, 2))
} finally {
  await browser.close()
}
