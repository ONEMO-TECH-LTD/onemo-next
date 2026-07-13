import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const fixtureName = 'AuthoringE2EButton'
const extractedName = 'AuthoringE2EExtracted'
const run = promisify(execFile)

test.describe('React Figma component authoring', () => {
  test.afterAll(async () => {
    await run(process.execPath, ['tests/e2e/restore-authoring-fixture.mjs'])
  })

  test('extracts a component, reloads once, authors a variant, returns Home, persists, and undoes', async ({ page, request }) => {
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
    await expect(page.getByLabel('New component name')).toHaveCount(0)
    await expect(page.locator('[data-component-phase-deferred="blank-create"]')).toContainText('not available in this phase')
    await fixtureButton.click({ button: 'right' })
    const componentMenu = page.getByRole('menu')
    await expect(componentMenu.getByRole('button', { name: 'Insert into selection — not available in this phase' })).toBeDisabled()
    await expect(componentMenu.getByRole('button', { name: 'Rename — not available in this phase' })).toBeDisabled()
    await page.mouse.click(800, 500)
    await expect(componentMenu).toHaveCount(0)
    editorDocumentRequests.length = 0
    tokenResponses.length = 0
    await fixtureButton.dblclick()
    await expect(page.locator('[data-authoring-import]')).toContainText(`${fixtureName} · legacy-single-axis · 2 variants`, { timeout: 30_000 })
    const importButton = page.getByRole('button', { name: 'Import source' })
    const isImportPost = (route: import('@playwright/test').Route) =>
      route.request().method() === 'POST' && (route.request().postData() ?? '').includes('"kind":"import-source"')
    const invalidJson = async (route: import('@playwright/test').Route) => {
      if (isImportPost(route)) await route.fulfill({ status: 200, contentType: 'application/json', body: '{' })
      else await route.continue()
    }
    await page.route('**/api/dev/editor-authoring', invalidJson)
    await importButton.click()
    await expect(page.locator('[data-authoring-import] [role="alert"]')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('react-figma:authoring-import-resume-v1'))).toBeNull()
    await page.unroute('**/api/dev/editor-authoring', invalidJson)

    const abortImport = async (route: import('@playwright/test').Route) => {
      if (isImportPost(route)) await route.abort('failed')
      else await route.continue()
    }
    await page.route('**/api/dev/editor-authoring', abortImport)
    await importButton.click()
    await expect(page.locator('[data-authoring-import] [role="alert"]')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('react-figma:authoring-import-resume-v1'))).toBeNull()
    await page.unroute('**/api/dev/editor-authoring', abortImport)
    expect(failedRequests.some((entry) => entry.includes('/api/dev/editor-authoring'))).toBe(true)
    expect(consoleErrors.some((entry) => entry.includes('net::ERR_FAILED'))).toBe(true)
    failedRequests.length = 0
    consoleErrors.length = 0

    // Introduce and compile the selection route only after the cold import-refusal probes. Its
    // route-tree reload is setup; it settles before the measured create-component reload begins.
    editorDocumentRequests.length = 0
    const selectionRouteDir = path.join(process.cwd(), 'src/app/(dev)/authoring-e2e')
    await mkdir(selectionRouteDir, { recursive: true })
    await writeFile(path.join(selectionRouteDir, 'page.tsx'), `export function AuthoringE2EPage() {\n  return (\n    <main>\n      <section data-name="Extract this card">Extract this card</section>\n    </main>\n  )\n}\n\nexport default AuthoringE2EPage\n`)
    await expect.poll(async () => (await request.get('/authoring-e2e')).status(), { timeout: 30_000 }).toBe(200)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(
      () => componentsRail.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))),
      { timeout: 30_000 },
    ).toBe(true)
    await page.getByTitle('File').click()
    const selectionPage = page.getByText('/authoring-e2e', { exact: true })
    await expect(selectionPage).toBeVisible({ timeout: 30_000 })
    await selectionPage.click()
    await expect(frame).toHaveAttribute('src', '/authoring-e2e')
    const selection = frame.contentFrame().getByText('Extract this card', { exact: true })
    await expect(selection).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-layer-row]').filter({ hasText: 'Extract this card' })).toBeVisible({ timeout: 30_000 })
    await selection.click()
    const createComponentButton = page.getByTitle('Create component')
    await createComponentButton.click()
    const createDialog = page.getByRole('dialog', { name: 'Create component' })
    await expect(createDialog).toBeVisible()
    await createDialog.getByLabel('Name').fill(extractedName)
    await page.waitForLoadState('networkidle')
    // The explicit route-registration reload above is harness setup, not part of the measured
    // authoring flow. Start the create/reload evidence window only after that setup is quiescent.
    failedResponses.length = 0
    failedRequests.length = 0
    await page.evaluate(() => { (window as Window & { __e2eCreateOriginDocument?: boolean }).__e2eCreateOriginDocument = true })
    editorDocumentRequests.length = 0
    tokenResponses.length = 0
    const createReload = page.waitForEvent('domcontentloaded', { timeout: 30_000 })
    await createDialog.getByRole('button', { name: 'Create', exact: true }).click()
    await createReload
    const authoringCanvas = page.locator('[data-authoring-canvas]')
    await expect.poll(() => editorDocumentRequests.length, { timeout: 30_000 }).toBe(1)
    expect(await page.evaluate(() => (window as Window & { __e2eCreateOriginDocument?: boolean }).__e2eCreateOriginDocument))
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
    await expect(page.locator('[data-component-current]')).toHaveText(extractedName)
    await page.waitForLoadState('networkidle')
    const expectedReloadAborts = failedRequests.splice(0)
    expect(expectedReloadAborts.every((failure) =>
      failure.startsWith(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3045') && failure.endsWith(' net::ERR_ABORTED'),
    )).toBe(true)
    expect(editorDocumentRequests).toHaveLength(1)
    await expect(page.locator('[data-variant-label]').filter({ hasText: 'Primary · Primary' })).toHaveCount(0)
    expect(await page.locator('[data-variant-id]').evaluateAll((frames) => frames.map((frame) => {
      const style = getComputedStyle(frame)
      return { borderStyle: style.borderStyle, outlineStyle: style.outlineStyle }
    }))).toEqual([{ borderStyle: 'none', outlineStyle: 'solid' }])
    const breadcrumb = page.locator('[data-component-breadcrumb]')
    const breadcrumbBeforeZoom = await breadcrumb.boundingBox()
    await page.getByTitle('Zoom in').click()
    await expect.poll(() => breadcrumb.boundingBox()).toEqual(breadcrumbBeforeZoom)
    await page.getByTitle('Zoom out').click()
    await page.getByRole('button', { name: 'Create variant' }).click()
    await expect(page.getByText('Variant 2', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(authoringCanvas).toHaveAttribute('data-authoring-busy', 'false', { timeout: 30_000 })
    expect(editorDocumentRequests).toHaveLength(1)
    expect(await page.locator('[data-variant-id]').evaluateAll((frames) => frames.map((frame) => {
      const style = getComputedStyle(frame)
      return { borderStyle: style.borderStyle, outlineStyle: style.outlineStyle }
    }))).toEqual(expect.arrayContaining([
      { borderStyle: 'none', outlineStyle: 'solid' },
      { borderStyle: 'none', outlineStyle: 'none' },
    ]))

    const created = page.locator('[data-variant-id]').filter({ hasText: 'Variant 2' })
    await created.click()
    await created.getByText('Variant 2', { exact: true }).click()
    const enterInput = page.getByRole('textbox', { name: 'Rename Variant 2' })
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
    await expect.poll(() => tokenResponses.length, { timeout: 30_000 }).toBe(editorDocumentRequests.length)
    const expectedPersistenceReloadAborts = failedRequests.splice(0)
    expect(expectedPersistenceReloadAborts.every((failure) =>
      failure.startsWith(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3045') && failure.endsWith(' net::ERR_ABORTED'),
    )).toBe(true)
    expect(editorDocumentRequests).toHaveLength(2)
    await expect.poll(
      () => componentsRail.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))),
      { timeout: 20_000 },
    ).toBe(true)
    await componentsRail.click()
    await expect(page.getByRole('textbox', { name: 'Search components' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: extractedName, exact: true }).dblclick()
    await expect(authoringCanvas).toBeVisible({ timeout: 30_000 })
    await expect.poll(() => movedVariant.evaluate((node) => ({
      x: Number.parseFloat((node as HTMLElement).style.left),
      y: Number.parseFloat((node as HTMLElement).style.top),
    }))).toEqual(geometryAfterMove)
    await expect(authoringCanvas).toHaveAttribute('data-authoring-busy', 'false')
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
