import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3045)
const baseURL = `http://localhost:${port}`

if (process.env.PLAYWRIGHT_BASE_URL) {
  throw new Error('PLAYWRIGHT_BASE_URL is unsupported: authoring E2E must own its fixture and dev-server lifecycle')
}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL,
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `node tests/e2e/run-authoring-server.mjs ${port}`,
    url: `${baseURL}/react-figma`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
})
