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

    await componentsRail.click()
    await expect(page.getByRole('textbox', { name: 'Search components' })).toBeVisible({ timeout: 20_000 })
    const fixtureButton = page.getByRole('button', { name: fixtureName, exact: true })
    await expect(fixtureButton).toBeVisible({ timeout: 30_000 })
    await page.evaluate(() => { (window as Window & { __e2eImportOriginDocument?: boolean }).__e2eImportOriginDocument = true })
    editorDocumentRequests.length = 0
    tokenResponses.length = 0
    await fixtureButton.dblclick()
    await expect(page.locator('[data-authoring-import]')).toContainText(`${fixtureName} · legacy-single-axis · 2 variants`, { timeout: 30_000 })
    const importReload = page.waitForEvent('domcontentloaded', { timeout: 30_000 })
    await page.getByRole('button', { name: 'Import source' }).click()
    await importReload
    const authoringCanvas = page.locator('[data-authoring-canvas]')
    await expect.poll(() => editorDocumentRequests.length, { timeout: 30_000 }).toBe(1)
    expect(await page.evaluate(() => (window as Window & { __e2eImportOriginDocument?: boolean }).__e2eImportOriginDocument))
      .toBeUndefined()
    const environmentRebase = page.getByRole('button', { name: 'Rebase environment' })
    await Promise.race([
      authoringCanvas.waitFor({ state: 'visible', timeout: 30_000 }),
      environmentRebase.waitFor({ state: 'visible', timeout: 30_000 }),
    ])
    await expect(page.getByRole('button', { name: 'Revalidate source' })).toHaveCount(0)
    if (await environmentRebase.isVisible()) await environmentRebase.click()
    await expect(authoringCanvas).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('main')).toHaveAttribute('data-authoring-resume-phase', 'resumed')
    expect(editorDocumentRequests).toHaveLength(1)
    await expect(page.locator('[data-variant-label]').filter({ hasText: 'Primary · Primary' })).toHaveCount(0)
    expect(await page.locator('[data-variant-id]').evaluateAll((frames) => frames.map((frame) => {
      const style = getComputedStyle(frame)
      return { borderStyle: style.borderStyle, outlineStyle: style.outlineStyle }
    }))).toEqual(expect.arrayContaining([
      { borderStyle: 'none', outlineStyle: 'solid' },
      { borderStyle: 'none', outlineStyle: 'none' },
    ]))
    const breadcrumb = page.locator('[data-component-breadcrumb]')
    const breadcrumbBeforeZoom = await breadcrumb.boundingBox()
    await page.getByTitle('Zoom in').click()
    await expect.poll(() => breadcrumb.boundingBox()).toEqual(breadcrumbBeforeZoom)
    await page.getByTitle('Zoom out').click()
    await page.getByRole('button', { name: 'Create variant' }).click()
    await expect(page.getByText('Variant 3', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => {
      const before = await authoringCanvas.evaluate((node) => {
        const element = node as HTMLElement & { __e2eCanvasInstance?: string }
        return element.__e2eCanvasInstance ??= crypto.randomUUID()
      })
      await new Promise((resolve) => setTimeout(resolve, 300))
      const after = await authoringCanvas.evaluate((node) => {
        const element = node as HTMLElement & { __e2eCanvasInstance?: string }
        return element.__e2eCanvasInstance ??= crypto.randomUUID()
      })
      return before === after && await authoringCanvas.getAttribute('data-authoring-busy') === 'false'
    }, { timeout: 30_000 }).toBe(true)
    expect(editorDocumentRequests).toHaveLength(1)

    const created = page.locator('[data-variant-id]').filter({ hasText: 'Variant 3' })
    await created.click()
    await created.getByText('Variant 3', { exact: true }).click()
    const enterInput = page.getByRole('textbox', { name: 'Rename Variant 3' })
    await enterInput.fill('Enter Rename')
    await enterInput.press('Enter')
    await expect(page.getByText('Enter Rename', { exact: true })).toBeVisible({ timeout: 30_000 })

    const createdVariant = page.locator('[data-variant-id]').filter({ hasText: 'Enter Rename' })
    await createdVariant.click()
    await createdVariant.getByText('Enter Rename', { exact: true }).click()
    let renameInput = page.getByRole('textbox', { name: 'Rename Enter Rename' })
    await renameInput.fill('Cancelled Rename')
    await renameInput.press('Escape')
    await expect(page.getByText('Enter Rename', { exact: true })).toBeVisible()
    await expect(page.getByText('Cancelled Rename', { exact: true })).toHaveCount(0)

    const createdVariantId = await createdVariant.getAttribute('data-variant-id')
    expect(createdVariantId).not.toBeNull()
    await createdVariant.getByText('Enter Rename', { exact: true }).click()
    renameInput = page.getByRole('textbox', { name: 'Rename Enter Rename' })
    await renameInput.fill('Blur Rename')
    await page.locator(`[data-variant-id]:not([data-variant-id="${createdVariantId}"])`).first().click()
    await expect(page.getByText('Blur Rename', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(authoringCanvas).toHaveAttribute('data-authoring-busy', 'false')
    const movedVariant = page.locator(`[data-variant-id="${createdVariantId}"]`)
    const geometryBeforeMove = await movedVariant.evaluate((node) => ({
      x: Number.parseFloat((node as HTMLElement).style.left),
      y: Number.parseFloat((node as HTMLElement).style.top),
    }))
    const movedVariantBox = await movedVariant.boundingBox()
    if (!movedVariantBox) throw new Error('Created variant has no rendered drag bounds')
    const moveResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname === '/api/dev/editor-authoring' &&
      response.request().method() === 'POST' &&
      (response.request().postData() ?? '').includes('"kind":"move-variant"'),
    { timeout: 30_000 })
    await page.mouse.move(movedVariantBox.x + 20, movedVariantBox.y + 20)
    await page.mouse.down()
    await page.mouse.move(movedVariantBox.x + 68, movedVariantBox.y + 44, { steps: 4 })
    await page.mouse.up()
    const moveResponse = await moveResponsePromise
    expect(moveResponse.status(), await moveResponse.text()).toBe(200)
    const geometryAfterMove = { x: geometryBeforeMove.x + 48, y: geometryBeforeMove.y + 24 }
    await expect.poll(() => movedVariant.evaluate((node) => ({
      x: Number.parseFloat((node as HTMLElement).style.left),
      y: Number.parseFloat((node as HTMLElement).style.top),
    }))).toEqual(geometryAfterMove)
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

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toHaveAttribute('data-authoring-resume-phase', 'none')
    await expect(page.locator('[data-authoring-resume-error]')).toHaveCount(0)
    expect(editorDocumentRequests).toHaveLength(2)
    await expect.poll(
      () => componentsRail.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))),
      { timeout: 20_000 },
    ).toBe(true)
    await componentsRail.click()
    await expect(page.getByRole('textbox', { name: 'Search components' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: fixtureName, exact: true }).dblclick()
    await expect(authoringCanvas).toBeVisible({ timeout: 30_000 })
    await expect.poll(() => movedVariant.evaluate((node) => ({
      x: Number.parseFloat((node as HTMLElement).style.left),
      y: Number.parseFloat((node as HTMLElement).style.top),
    }))).toEqual(geometryAfterMove)
    await page.keyboard.press('Meta+z')
    await expect.poll(() => movedVariant.evaluate((node) => ({
      x: Number.parseFloat((node as HTMLElement).style.left),
      y: Number.parseFloat((node as HTMLElement).style.top),
    }), { timeout: 30_000 })).toEqual(geometryBeforeMove)

    expect(editorDocumentRequests).toHaveLength(2)

    expect(consoleErrors, `Failed responses: ${failedResponses.join(', ')}`).toEqual([])
    expect(consoleWarnings).toEqual([])
    expect(pageErrors).toEqual([])
    expect(tokenResponses, `Editor documents: ${editorDocumentRequests.join(', ')}`)
      .toEqual(editorDocumentRequests.map(() => 200))
    expect(failedResponses).toEqual([])
    expect(failedRequests).toEqual([])
  })
})
