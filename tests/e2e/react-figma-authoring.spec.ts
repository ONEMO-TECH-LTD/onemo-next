import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const fixtureName = 'AuthoringE2EButton'
const run = promisify(execFile)

test.describe('React Figma component authoring', () => {
  test.afterAll(async () => {
    await run(process.execPath, ['tests/e2e/restore-authoring-fixture.mjs'])
  })

  test('Home restores the retained page canvas and inspector dimensions without navigation', async ({ page }) => {
    test.setTimeout(120_000)
    const consoleErrors: string[] = []
    const consoleWarnings: string[] = []
    const pageErrors: string[] = []
    const failedResponses: string[] = []
    const failedRequests: string[] = []
    const tokenResponses: number[] = []
    const editorDocumentRequests: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('console', (message) => { if (message.type() === 'warning') consoleWarnings.push(message.text()) })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (request.resourceType() === 'document' && url.pathname === '/react-figma') editorDocumentRequests.push(request.url())
    })
    page.on('response', (response) => {
      const url = new URL(response.url())
      if (url.pathname === '/api/dev/editor-tokens' && !url.search) tokenResponses.push(response.status())
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
    })
    page.on('requestfailed', (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? 'unknown failure'}`))

    await page.goto('/react-figma', { waitUntil: 'domcontentloaded' })
    const componentsRail = page.getByTitle('Components')
    await expect.poll(
      () => componentsRail.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))),
      { timeout: 20_000 },
    ).toBe(true)
    const frame = page.locator('iframe')
    const editorUrl = page.url()

    await expect(async () => {
      await componentsRail.click()
      await expect(page.getByRole('textbox', { name: 'Search components' })).toBeVisible({ timeout: 3_000 })
      await page.getByRole('button', { name: fixtureName, exact: true }).dblclick()
      await expect(page.locator('[data-authoring-import]')).toContainText(`${fixtureName} · legacy-single-axis · 2 variants`, { timeout: 15_000 })
    }).toPass({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Import source' }).click()
    const authoringCanvas = page.locator('[data-authoring-canvas]')
    const revalidateSource = page.getByRole('button', { name: 'Revalidate source' })
    await Promise.race([
      authoringCanvas.waitFor({ state: 'visible', timeout: 30_000 }),
      revalidateSource.waitFor({ state: 'visible', timeout: 30_000 }),
    ])
    if (await revalidateSource.isVisible()) await revalidateSource.click()
    await expect(authoringCanvas).toBeVisible({ timeout: 30_000 })
    const authoringHost = await page.locator('[data-screen-host]').evaluate((node) => ({ width: node.clientWidth, height: node.clientHeight }))
    expect(authoringHost.width).toBeGreaterThan(402)
    await frame.evaluate((node) => {
      const iframe = node as HTMLIFrameElement & { __e2eRetainedFrame?: boolean }
      iframe.__e2eRetainedFrame = true
      ;(iframe.contentDocument as Document & { __e2eRetainedDocument?: boolean }).__e2eRetainedDocument = true
    })

    await page.getByRole('button', { name: 'Home' }).click()
    expect(page.url()).toBe(editorUrl)
    await expect.poll(() => frame.evaluate((node) => (node as HTMLIFrameElement & { __e2eRetainedFrame?: boolean }).__e2eRetainedFrame)).toBe(true)
    await expect.poll(() => frame.evaluate((node) => ((node as HTMLIFrameElement).contentDocument as Document & { __e2eRetainedDocument?: boolean }).__e2eRetainedDocument)).toBe(true)
    await expect(page.getByTitle('Select frame')).toContainText('402 × 874')
    await expect.poll(() => page.getByRole('spinbutton', { name: 'width value' }).inputValue()).toBe('402')
    await expect.poll(() => page.getByRole('spinbutton', { name: 'height value' }).inputValue()).toBe('874')
    const restored = await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-screen-host]')
      const iframe = document.querySelector<HTMLIFrameElement>('iframe')
      return {
        host: host && { width: host.clientWidth, height: host.clientHeight },
        iframe: iframe && { width: iframe.clientWidth, height: iframe.clientHeight },
      }
    })
    expect(restored).toEqual({ host: { width: 402, height: 874 }, iframe: { width: 402, height: 874 } })

    expect(consoleErrors, `Failed responses: ${failedResponses.join(', ')}`).toEqual([])
    expect(consoleWarnings).toEqual([])
    expect(pageErrors).toEqual([])
    expect(tokenResponses, `Editor documents: ${editorDocumentRequests.join(', ')}`)
      .toEqual(editorDocumentRequests.map(() => 200))
    expect(failedResponses).toEqual([])
    expect(failedRequests).toEqual([])
  })
})
