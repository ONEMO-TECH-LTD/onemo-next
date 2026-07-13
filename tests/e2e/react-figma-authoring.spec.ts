import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const fixtureName = 'AuthoringE2EButton'
const fixtureFile = 'src/app/(dev)/react-figma-components/AuthoringE2EButton.tsx'
const extractedName = 'AuthoringE2EExtracted'
const canonicalName = 'AuthoringE2ECanonical'
const e2eBaseUrl = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3045}`
const run = promisify(execFile)

test.describe('React Figma component authoring', () => {
  test.afterAll(async () => {
    await run(process.execPath, ['tests/e2e/restore-authoring-fixture.mjs'])
  })

  test('keeps the editor live when pointer-up clears pan before the queued view update runs', async ({ page }) => {
    test.setTimeout(60_000)
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const editorDocumentRequests: string[] = []
    const tokenResponses: number[] = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (request.resourceType() === 'document' && url.pathname === '/react-figma') editorDocumentRequests.push(request.url())
    })
    page.on('response', (response) => {
      const url = new URL(response.url())
      if (url.pathname === '/api/dev/editor-tokens' && !url.search) tokenResponses.push(response.status())
    })

    await page.goto('/react-figma', { waitUntil: 'domcontentloaded' })
    const canvas = page.locator('main')
    await expect(async () => {
      await expect.poll(
        () => canvas.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))),
        { timeout: 10_000 },
      ).toBe(true)
      await expect.poll(() => tokenResponses.length, { timeout: 10_000 }).toBe(editorDocumentRequests.length)
      expect(tokenResponses).toEqual(editorDocumentRequests.map(() => 200))
      await page.evaluate(() => { (window as Window & { __panProofDocument?: boolean }).__panProofDocument = true })
      const documentCount = editorDocumentRequests.length
      const transformBefore = await canvas.locator(':scope > div').filter({ has: page.locator('[data-screen-host]') }).getAttribute('style')

      await canvas.evaluate((node) => {
        const target = node as HTMLElement
        const setPointerCapture = target.setPointerCapture
        target.setPointerCapture = () => undefined
        const event = (type: string, x: number, y: number) => target.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: x,
          clientY: y,
          pointerId: 71,
          pointerType: 'mouse',
        }))
        event('pointerdown', 700, 400)
        event('pointermove', 702, 401)
        event('pointerup', 702, 401)
        target.setPointerCapture = setPointerCapture
      })
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

      expect(await page.evaluate(() => (window as Window & { __panProofDocument?: boolean }).__panProofDocument)).toBe(true)
      expect(editorDocumentRequests).toHaveLength(documentCount)
      expect(await canvas.locator(':scope > div').filter({ has: page.locator('[data-screen-host]') }).getAttribute('style')).not.toBe(transformBefore)
    }).toPass({ timeout: 45_000, intervals: [250, 500, 1_000] })
    await expect(canvas).toBeVisible()
    await expect(page.getByText(/Application error|Runtime TypeError|Cannot read properties of null/i)).toHaveCount(0)
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('opens the same existing project component from double-click and context-menu Edit', async ({ page }) => {
    test.setTimeout(90_000)
    const editorDocumentRequests: string[] = []
    const componentStatusFiles: string[] = []
    const tokenResponses: number[] = []
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (request.resourceType() === 'document' && url.pathname === '/react-figma') editorDocumentRequests.push(request.url())
      if (url.pathname === '/api/dev/editor-authoring' && url.searchParams.get('mode') === 'component-status') {
        componentStatusFiles.push(url.searchParams.get('file') ?? '')
      }
    })
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', (response) => {
      const url = new URL(response.url())
      if (url.pathname === '/api/dev/editor-tokens' && !url.search) tokenResponses.push(response.status())
    })

    await page.goto('/react-figma', { waitUntil: 'domcontentloaded' })
    const componentEntry = page.getByRole('button', { name: fixtureName, exact: true })
    await expect(async () => {
      await expect.poll(() => tokenResponses.length, { timeout: 10_000 }).toBe(editorDocumentRequests.length)
      expect(tokenResponses).toEqual(editorDocumentRequests.map(() => 200))
      await page.getByRole('button', { name: 'Components', exact: true }).click({ timeout: 5_000 })
      await expect(page.getByRole('textbox', { name: 'Search components' })).toBeVisible({ timeout: 5_000 })
      await expect(componentEntry).toBeVisible({ timeout: 15_000 })
    }).toPass({ timeout: 45_000, intervals: [250, 500, 1_000] })

    // Source import is setup for the already-present project component, not component creation.
    await componentEntry.dblclick()
    const importSource = page.getByRole('button', { name: 'Import source' })
    const authoringCanvas = page.locator('[data-authoring-canvas]')
    const entryState = await Promise.race([
      importSource.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'import' as const),
      authoringCanvas.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'loaded' as const),
    ])
    if (entryState === 'import') {
      const reload = page.waitForEvent('domcontentloaded', { timeout: 30_000 })
      await importSource.click()
      await reload
    }
    await expect(authoringCanvas).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Home' }).click()
    await page.getByRole('button', { name: 'Components', exact: true }).click()
    await expect(componentEntry).toBeVisible({ timeout: 20_000 })

    editorDocumentRequests.length = 0
    tokenResponses.length = 0
    componentStatusFiles.length = 0
    await componentEntry.dblclick()
    await expect(authoringCanvas).toBeVisible({ timeout: 30_000 })
    const breadcrumb = page.locator('[data-component-breadcrumb]')
    await expect(breadcrumb).toHaveAttribute('data-component-file', fixtureFile)
    await expect(page.locator('[data-component-current]')).toHaveText(fixtureName)
    const doubleClickIdentity = await authoringCanvas.getAttribute('data-component-id')
    expect(doubleClickIdentity).toMatch(/^component_[a-f0-9]{16}$/)
    expect(editorDocumentRequests).toEqual([])
    expect(new Set(componentStatusFiles)).toEqual(new Set([fixtureFile]))
    await expect(page.locator('[data-components-canvas]')).toHaveCount(0)

    await page.getByRole('button', { name: 'Home' }).click()
    componentStatusFiles.length = 0
    await componentEntry.click({ button: 'right' })
    await page.getByRole('menu').getByRole('button', { name: 'Edit component' }).click()
    await expect(authoringCanvas).toBeVisible({ timeout: 30_000 })
    await expect(breadcrumb).toHaveAttribute('data-component-file', fixtureFile)
    await expect(page.locator('[data-component-current]')).toHaveText(fixtureName)
    expect(await authoringCanvas.getAttribute('data-component-id')).toBe(doubleClickIdentity)
    expect(editorDocumentRequests).toEqual([])
    expect(new Set(componentStatusFiles)).toEqual(new Set([fixtureFile]))
    await expect(page.locator('[data-components-canvas]')).toHaveCount(0)
    expect(await breadcrumb.evaluate((node) => {
      const main = node.closest('main')!.getBoundingClientRect()
      const nav = node.getBoundingClientRect()
      const home = node.querySelector<HTMLElement>('[data-component-home]')!
      const separator = node.querySelector<SVGElement>('[data-component-breadcrumb-separator]')!
      const current = node.querySelector<HTMLElement>('[data-component-current]')!
      const homeBox = home.getBoundingClientRect()
      const separatorBox = separator.getBoundingClientRect()
      const currentBox = current.getBoundingClientRect()
      const navStyle = getComputedStyle(node)
      const homeStyle = getComputedStyle(home)
      const currentStyle = getComputedStyle(current)
      return {
        inset: { top: nav.top - main.top, left: nav.left - main.left },
        nav: { height: nav.height, border: navStyle.borderTopWidth, padding: navStyle.paddingTop },
        chips: [homeBox.height, currentBox.height],
        radius: [homeStyle.borderRadius, currentStyle.borderRadius],
        borders: [homeStyle.borderTopWidth, currentStyle.borderTopWidth],
        type: { size: homeStyle.fontSize, weight: homeStyle.fontWeight },
        padding: [homeStyle.paddingLeft, homeStyle.paddingRight, currentStyle.paddingLeft, currentStyle.paddingRight],
        gaps: [separatorBox.left - homeBox.right, currentBox.left - separatorBox.right],
        icons: [
          home.querySelector('svg')!.getBoundingClientRect().width,
          separatorBox.width,
          current.querySelector('svg')!.getBoundingClientRect().width,
        ],
      }
    })).toEqual({
      inset: { top: 12, left: 12 },
      nav: { height: 30, border: '0px', padding: '0px' },
      chips: [30, 30],
      radius: ['8px', '8px'],
      borders: ['0px', '0px'],
      type: { size: '12px', weight: '600' },
      padding: ['10px', '10px', '10px', '10px'],
      gaps: [10, 10],
      icons: [12, 10, 12],
    })
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('offers canonical extraction when the project component inventory is empty', async ({ page }) => {
    test.setTimeout(60_000)
    const componentStatusFiles: string[] = []
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    await page.route('**/api/dev/editor-components', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ components: [] }) })
    })
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/dev/editor-authoring' && url.searchParams.get('mode') === 'component-status') {
        componentStatusFiles.push(url.searchParams.get('file') ?? '')
      }
    })
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto('/react-figma', { waitUntil: 'domcontentloaded' })
    const emptyInventory = page.locator('[data-empty-component-inventory]')
    const extraction = emptyInventory.getByRole('button', { name: 'Create component from selection', exact: true })
    await expect(async () => {
      await page.getByRole('button', { name: 'Components', exact: true }).click({ timeout: 5_000 })
      await expect(emptyInventory).toBeVisible({ timeout: 5_000 })
      await expect(extraction).toBeEnabled({ timeout: 10_000 })
    }).toPass({ timeout: 45_000, intervals: [250, 500, 1_000] })

    await extraction.click()
    const dialog = page.getByRole('dialog', { name: 'Create component' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Name')).toHaveValue('Component')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
    expect(componentStatusFiles).toEqual([])
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('opens the independent blank-component shell from the Components owner without writing', async ({ page }) => {
    test.setTimeout(60_000)
    const authoringWrites: string[] = []
    const legacyWrites: string[] = []
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/dev/editor-authoring' && request.method() !== 'GET') authoringWrites.push(request.postData() ?? '')
      if (url.pathname === '/api/dev/editor-write') legacyWrites.push(request.postData() ?? '')
    })
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto('/react-figma', { waitUntil: 'domcontentloaded' })
    const components = page.getByRole('button', { name: 'Components', exact: true })
    const newComponent = page.getByTitle('New Component')
    await expect(async () => {
      await components.click({ timeout: 5_000 })
      await expect(page.getByRole('textbox', { name: 'Search components' })).toBeVisible({ timeout: 5_000 })
      await expect(newComponent).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 45_000, intervals: [250, 500, 1_000] })

    await newComponent.click()
    const dialog = page.getByRole('dialog', { name: 'New Component' })
    const title = dialog.getByRole('textbox', { name: 'Title' })
    const create = dialog.getByRole('button', { name: 'Create', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Components can be edited in their own canvas. Double-click on any instance to add visual variants and interactions.')
    await expect(title).toHaveValue('')
    await expect(create).toBeDisabled()
    await title.fill('   ')
    await expect(create).toBeDisabled()
    await title.fill('FreshCard')
    await expect(create).toBeEnabled()
    await expect(dialog.getByRole('textbox', { name: /Project|Global|Category/i })).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'Create component' })).toHaveCount(0)
    await create.click()
    await expect(dialog.getByRole('status')).toHaveText('Blank component creation is pending measured behavior.')
    expect(authoringWrites).toEqual([])
    expect(legacyWrites).toEqual([])
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)

    expect(authoringWrites).toEqual([])
    expect(legacyWrites).toEqual([])
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
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

    // Compile the committed real-page fixture before opening the editor. This is route-fixture
    // setup, not product-data prewarming; the measured browser flow remains fully cold.
    expect((await request.get('/authoring-e2e')).status()).toBe(200)
    await page.goto('/react-figma', { waitUntil: 'domcontentloaded' })
    const componentsRail = page.getByTitle('Components')
    const frame = page.locator('iframe')
    const currentFrameIsWired = () => frame.evaluate((node) => {
      const doc = (node as HTMLIFrameElement).contentDocument as (Document & { __engineWired?: boolean }) | null
      return doc?.readyState === 'complete' && doc.__engineWired === true
    })
    const editorUrl = page.url()
    const fixtureButton = page.getByRole('button', { name: fixtureName, exact: true })
    const componentMenu = page.getByRole('menu')
    const importPreview = page.locator('[data-authoring-import]')
    await expect(async () => {
      expect(editorDocumentRequests.length).toBeGreaterThan(0)
      await expect.poll(() => tokenResponses.length, { timeout: 10_000 }).toBe(editorDocumentRequests.length)
      expect(tokenResponses).toEqual(editorDocumentRequests.map(() => 200))
      await expect.poll(
        () => componentsRail.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))),
        { timeout: 10_000 },
      ).toBe(true)
      await expect.poll(currentFrameIsWired, { timeout: 10_000 }).toBe(true)
      await componentsRail.click({ timeout: 5_000 })
      await expect(page.getByRole('textbox', { name: 'Search components' })).toBeVisible({ timeout: 5_000 })
      await expect(fixtureButton).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('dialog', { name: 'New Component' })).toHaveCount(0)
      await expect(page.getByTitle('New Component')).toBeVisible()
      await fixtureButton.click({ button: 'right', timeout: 5_000 })
      await expect(componentMenu.getByRole('button', { name: 'Insert into selection — not available in this phase' })).toBeDisabled()
      await expect(componentMenu.getByRole('button', { name: 'Rename — not available in this phase' })).toBeDisabled()
      await page.keyboard.press('Escape')
      await expect(componentMenu).toHaveCount(0)
      const stableDocumentCount = editorDocumentRequests.length
      await fixtureButton.dblclick({ timeout: 5_000 })
      await expect(importPreview).toContainText(`${fixtureName} · legacy-single-axis · 2 variants`, { timeout: 10_000 })
      expect(editorDocumentRequests).toHaveLength(stableDocumentCount)
      await expect.poll(() => tokenResponses.length, { timeout: 10_000 }).toBe(editorDocumentRequests.length)
      expect(tokenResponses).toEqual(editorDocumentRequests.map(() => 200))
      expect(editorDocumentRequests).toHaveLength(stableDocumentCount)
      await expect(importPreview).toBeVisible()
    }).toPass({ timeout: 45_000, intervals: [250, 500, 1_000] })
    editorDocumentRequests.length = 0
    tokenResponses.length = 0
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

    // The failure-safe fixture wrapper installs this real CSS-module page before Next starts, so
    // route registration cannot inject HMR reloads into the measured authoring flow.
    editorDocumentRequests.length = 0
    const createDialog = page.getByRole('dialog', { name: 'Create component' })
    await expect(async () => {
      if (await createDialog.isVisible()) await page.keyboard.press('Escape')
      const stableDocumentCount = editorDocumentRequests.length
      await page.getByTitle('File').click({ timeout: 5_000 })
      const selectionPage = page.getByText('/authoring-e2e', { exact: true })
      await expect(selectionPage).toBeVisible({ timeout: 5_000 })
      await selectionPage.click()
      await expect(frame).toHaveAttribute('src', '/authoring-e2e')
      const selection = frame.contentFrame().getByText('Extract this card', { exact: true })
      await expect(selection).toBeVisible({ timeout: 10_000 })
      await expect.poll(() => selection.evaluate((node) => {
        const style = getComputedStyle(node)
        return { background: style.backgroundColor, color: style.color, width: style.width }
      })).toEqual({ background: 'rgb(21, 88, 74)', color: 'rgb(245, 255, 252)', width: '240px' })
      await expect(selection).toHaveAttribute('data-src', /^src\/app\/\(dev\)\/authoring-e2e\/page\.tsx:\d+:\d+$/)
      await selection.click()
      await page.getByTitle('Create component').click()
      await expect(createDialog).toBeVisible({ timeout: 5_000 })
      await createDialog.getByLabel('Name').fill(extractedName)
      await expect(frame).toHaveAttribute('src', '/authoring-e2e')
      await expect.poll(() => tokenResponses.length, { timeout: 10_000 }).toBe(editorDocumentRequests.length)
      expect(tokenResponses).toEqual(editorDocumentRequests.map(() => 200))
      expect(editorDocumentRequests).toHaveLength(stableDocumentCount)
    }).toPass({ timeout: 45_000, intervals: [250, 500, 1_000] })
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
    const extractedSource = await readFile(path.join(
      process.cwd(),
      'src/app/(dev)/react-figma-components/AuthoringE2EExtracted.tsx',
    ), 'utf8')
    expect(extractedSource).toContain("from '../authoring-e2e/AuthoringE2ECard.module.css'")
    const sidecar = JSON.parse(await readFile(path.join(
      process.cwd(),
      'src/app/(dev)/react-figma-components/.onemo/authoring-v1.json',
    ), 'utf8')) as { sourceHashes: Record<string, string> }
    expect(sidecar.sourceHashes['src/app/(dev)/authoring-e2e/AuthoringE2ECard.module.css'])
      .toMatch(/^[a-f0-9]{64}$/)
    expect(Object.keys(sidecar.sourceHashes).some((file) => file.includes('/../'))).toBe(false)
    await expect(page.locator('main')).toHaveAttribute('data-authoring-resume-phase', 'resumed')
    await expect(page.locator('[data-component-current]')).toHaveText(extractedName)
    await expect.poll(() => tokenResponses.length, { timeout: 30_000 }).toBe(editorDocumentRequests.length)
    expect(tokenResponses).toEqual(editorDocumentRequests.map(() => 200))
    const expectedReloadAborts = failedRequests.splice(0)
    expect(expectedReloadAborts.every((failure) =>
      failure.startsWith(e2eBaseUrl) && failure.endsWith(' net::ERR_ABORTED'),
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
      failure.startsWith(e2eBaseUrl) && failure.endsWith(' net::ERR_ABORTED'),
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
    await authoringCanvas.click({ position: { x: 8, y: 8 } })
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

  test('presents a source refusal in product language with its code confined to diagnostics', async ({ page, request }) => {
    test.setTimeout(60_000)
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const failedRequests: string[] = []
    const refusalResponses: number[] = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('requestfailed', (browserRequest) => {
      failedRequests.push(`${browserRequest.url()} ${browserRequest.failure()?.errorText ?? 'unknown failure'}`)
    })
    page.on('response', (response) => {
      const url = new URL(response.url())
      if (url.pathname === '/api/dev/editor-authoring' && url.searchParams.get('mode') === 'create-component-preview') {
        refusalResponses.push(response.status())
      }
    })

    expect((await request.get('/authoring-e2e')).status()).toBe(200)
    await page.goto('/react-figma', { waitUntil: 'domcontentloaded' })
    const frame = page.locator('iframe')
    const createDialog = page.getByRole('dialog', { name: 'Create component' })
    await expect(async () => {
      await page.getByTitle('File').click({ timeout: 5_000 })
      await page.getByText('/authoring-e2e', { exact: true }).click({ timeout: 5_000 })
      await expect(frame).toHaveAttribute('src', '/authoring-e2e')
      const selection = frame.contentFrame().getByText('Refuse component creation', { exact: true })
      await expect(selection).toBeVisible({ timeout: 10_000 })
      await selection.click()
      await page.getByTitle('Create component').click()
      await expect(createDialog).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000, intervals: [250, 500, 1_000] })

    let previewRequests = 0
    await page.route('**/api/dev/editor-authoring?**', async (route) => {
      const url = new URL(route.request().url())
      if (route.request().method() === 'GET' && url.searchParams.get('mode') === 'create-component-preview') {
        previewRequests++
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'raw internal source detail',
            code: 'CREATE_COMPONENT_SOURCE_UNSUPPORTED',
          }),
        })
        return
      }
      await route.continue()
    })
    await createDialog.getByRole('button', { name: 'Create', exact: true }).click()

    const alert = createDialog.getByRole('alert')
    await expect(alert).toHaveText('This selection can’t become a component yet. Choose a self-contained page element and try again.')
    await expect(alert).not.toContainText('CREATE_COMPONENT_SOURCE_UNSUPPORTED')
    const diagnostics = createDialog.locator('[data-create-component-diagnostics]')
    await expect(diagnostics).toContainText('Technical details')
    await diagnostics.locator('summary').click()
    await expect(diagnostics.locator('code')).toHaveText('CREATE_COMPONENT_SOURCE_UNSUPPORTED')
    expect(previewRequests).toBe(1)
    expect(refusalResponses).toEqual([422])
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([
      'Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)',
    ])
    expect(failedRequests).toEqual([])
  })

  test('retries preview and execute refusals with fresh requests in the same usable dialog', async ({ page, request }) => {
    test.setTimeout(90_000)
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const failedRequests: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('requestfailed', (browserRequest) => {
      failedRequests.push(`${browserRequest.url()} ${browserRequest.failure()?.errorText ?? 'unknown failure'}`)
    })

    expect((await request.get('/authoring-e2e')).status()).toBe(200)
    await page.goto('/react-figma', { waitUntil: 'domcontentloaded' })
    const frame = page.locator('iframe')
    const createDialog = page.getByRole('dialog', { name: 'Create component' })
    await expect(async () => {
      await page.getByTitle('File').click({ timeout: 5_000 })
      await page.getByText('/authoring-e2e', { exact: true }).click({ timeout: 5_000 })
      await expect(frame).toHaveAttribute('src', '/authoring-e2e')
      const selection = frame.contentFrame().getByText('Refuse component creation', { exact: true })
      await expect(selection).toBeVisible({ timeout: 10_000 })
      await selection.click()
      await page.getByTitle('Create component').click()
      await expect(createDialog).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000, intervals: [250, 500, 1_000] })

    const previewCommandIds: string[] = []
    const refusePreview = async (route: import('@playwright/test').Route) => {
      const url = new URL(route.request().url())
      if (route.request().method() === 'GET' && url.searchParams.get('mode') === 'create-component-preview') {
        previewCommandIds.push(url.searchParams.get('commandId') ?? '')
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'raw preview detail', code: 'CREATE_COMPONENT_SOURCE_UNSUPPORTED' }),
        })
        return
      }
      await route.continue()
    }
    await page.route('**/api/dev/editor-authoring?**', refusePreview)
    await createDialog.evaluate((node) => node.setAttribute('data-retry-proof', 'preview'))
    const createButton = createDialog.getByRole('button', { name: 'Create', exact: true })
    await createButton.click()
    await expect(createDialog.getByRole('alert')).toContainText('can’t become a component yet')
    await expect(createButton).toBeEnabled()
    await createButton.click()
    await expect.poll(() => previewCommandIds.length).toBe(2)
    expect(new Set(previewCommandIds).size).toBe(2)
    expect(previewCommandIds.every(Boolean)).toBe(true)
    await expect(createDialog).toHaveAttribute('data-retry-proof', 'preview')
    await expect(createButton).toBeEnabled()
    await page.unroute('**/api/dev/editor-authoring?**', refusePreview)

    await createDialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(createDialog).toHaveCount(0)
    await page.getByTitle('Create component').click()
    await expect(createDialog).toBeVisible()
    await createDialog.evaluate((node) => node.setAttribute('data-retry-proof', 'execute'))

    const executeCommandIds: string[] = []
    const executeTransactionIds: string[] = []
    const refuseExecute = async (route: import('@playwright/test').Route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as {
          kind?: string
          transactionId?: string
          command?: { commandId?: string }
        }
        if (body.kind === 'execute-create-component') {
          executeCommandIds.push(body.command?.commandId ?? '')
          executeTransactionIds.push(body.transactionId ?? '')
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'raw stale detail', code: 'SOURCE_PREIMAGE_STALE' }),
          })
          return
        }
      }
      await route.continue()
    }
    await page.route('**/api/dev/editor-authoring**', refuseExecute)
    const executeButton = createDialog.getByRole('button', { name: 'Create', exact: true })
    await executeButton.click()
    await expect(createDialog.getByRole('alert')).toContainText('The page changed while the component was being created.')
    await expect(executeButton).toBeEnabled()
    expect(await page.evaluate(() => sessionStorage.getItem('react-figma:authoring-import-resume-v1'))).toBeNull()
    await executeButton.click()
    await expect.poll(() => executeTransactionIds.length).toBe(2)
    expect(new Set(executeCommandIds).size).toBe(2)
    expect(new Set(executeTransactionIds).size).toBe(2)
    expect(executeCommandIds.every(Boolean)).toBe(true)
    expect(executeTransactionIds.every(Boolean)).toBe(true)
    await expect(createDialog).toHaveAttribute('data-retry-proof', 'execute')
    await expect(executeButton).toBeEnabled()
    expect(await page.evaluate(() => sessionStorage.getItem('react-figma:authoring-import-resume-v1'))).toBeNull()
    expect(consoleErrors).toEqual([
      'Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)',
      'Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)',
      'Failed to load resource: the server responded with a status of 409 (Conflict)',
      'Failed to load resource: the server responded with a status of 409 (Conflict)',
    ])
    expect(pageErrors).toEqual([])
    expect(failedRequests).toEqual([])
  })

  test('creates and persists a component from a real CSS-module page element', async ({ page, request }) => {
    test.setTimeout(90_000)
    const consoleErrors: string[] = []
    const consoleWarnings: string[] = []
    const pageErrors: string[] = []
    const failedResponses: string[] = []
    const failedRequests: string[] = []
    const editorDocumentRequests: string[] = []
    const tokenResponses: number[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
      if (message.type() === 'warning') consoleWarnings.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('request', (browserRequest) => {
      const url = new URL(browserRequest.url())
      if (browserRequest.resourceType() === 'document' && url.pathname === '/react-figma') {
        editorDocumentRequests.push(browserRequest.url())
      }
    })
    page.on('response', (response) => {
      const url = new URL(response.url())
      if (url.pathname === '/api/dev/editor-tokens' && !url.search) tokenResponses.push(response.status())
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
    })
    page.on('requestfailed', (browserRequest) => {
      failedRequests.push(`${browserRequest.url()} ${browserRequest.failure()?.errorText ?? 'unknown failure'}`)
    })

    expect((await request.get('/authoring-e2e')).status()).toBe(200)
    await page.goto('/react-figma', { waitUntil: 'domcontentloaded' })
    const frame = page.locator('iframe')
    const createDialog = page.getByRole('dialog', { name: 'Create component' })
    await expect(async () => {
      if (await createDialog.isVisible()) await page.keyboard.press('Escape')
      const stableDocumentCount = editorDocumentRequests.length
      await page.getByTitle('File').click({ timeout: 5_000 })
      await page.getByText('/authoring-e2e', { exact: true }).click({ timeout: 5_000 })
      await expect(frame).toHaveAttribute('src', '/authoring-e2e')
      const selection = frame.contentFrame().getByText('Extract canonical CSS card', { exact: true })
      await expect(selection).toBeVisible({ timeout: 10_000 })
      await expect(selection).toHaveAttribute('data-src', /^src\/app\/\(dev\)\/authoring-e2e\/page\.tsx:\d+:\d+$/)
      await expect.poll(() => selection.evaluate((node) => getComputedStyle(node).backgroundColor))
        .toBe('rgb(21, 88, 74)')
      await selection.click()
      await page.getByTitle('Create component').click()
      await expect(createDialog).toBeVisible({ timeout: 5_000 })
      await createDialog.getByLabel('Name').fill(canonicalName)
      await expect.poll(() => tokenResponses.length, { timeout: 10_000 }).toBe(editorDocumentRequests.length)
      expect(tokenResponses).toEqual(editorDocumentRequests.map(() => 200))
      expect(editorDocumentRequests).toHaveLength(stableDocumentCount)
    }).toPass({ timeout: 45_000, intervals: [250, 500, 1_000] })

    failedResponses.length = 0
    failedRequests.length = 0
    editorDocumentRequests.length = 0
    tokenResponses.length = 0
    const createReload = page.waitForEvent('domcontentloaded', { timeout: 30_000 })
    await createDialog.getByRole('button', { name: 'Create', exact: true }).click()
    await createReload
    const authoringCanvas = page.locator('[data-authoring-canvas]')
    const environmentRebase = page.getByRole('button', { name: 'Rebase environment' })
    await Promise.race([
      authoringCanvas.waitFor({ state: 'visible', timeout: 30_000 }),
      environmentRebase.waitFor({ state: 'visible', timeout: 30_000 }),
    ])
    if (await environmentRebase.isVisible()) await environmentRebase.click()
    await expect(authoringCanvas).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('main')).toHaveAttribute('data-authoring-resume-phase', 'resumed')
    await expect(page.locator('[data-component-current]')).toHaveText(canonicalName)
    await expect.poll(() => editorDocumentRequests.length, { timeout: 30_000 }).toBe(1)
    await expect.poll(() => tokenResponses.length, { timeout: 30_000 }).toBe(1)
    expect(tokenResponses).toEqual([200])

    const componentFile = path.join(
      process.cwd(),
      'src/app/(dev)/react-figma-components/AuthoringE2ECanonical.tsx',
    )
    const componentSource = await readFile(componentFile, 'utf8')
    expect(componentSource).toContain("from '../authoring-e2e/AuthoringE2ECard.module.css'")
    const cssFile = path.join(process.cwd(), 'src/app/(dev)/authoring-e2e/AuthoringE2ECard.module.css')
    const cssBytes = await readFile(cssFile)
    const expectedCssHash = createHash('sha256').update(cssBytes).digest('hex')
    const sidecar = JSON.parse(await readFile(path.join(
      process.cwd(),
      'src/app/(dev)/react-figma-components/.onemo/authoring-v1.json',
    ), 'utf8')) as { sourceHashes: Record<string, string> }
    expect(sidecar.sourceHashes['src/app/(dev)/authoring-e2e/AuthoringE2ECard.module.css'])
      .toBe(expectedCssHash)
    expect(Object.keys(sidecar.sourceHashes).some((file) => file.includes('/../'))).toBe(false)

    const expectedReloadAborts = failedRequests.splice(0)
    expect(expectedReloadAborts.every((failure) =>
      failure.startsWith(e2eBaseUrl) && failure.endsWith(' net::ERR_ABORTED'),
    )).toBe(true)
    expect(consoleErrors).toEqual([])
    expect(consoleWarnings).toEqual([])
    expect(pageErrors).toEqual([])
    expect(failedResponses).toEqual([])
    expect(failedRequests).toEqual([])
  })
})
