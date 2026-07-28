import { chromium, firefox, webkit } from 'playwright'

const browserTypes = { chromium, firefox, webkit }

function browserTypeFor(profile) {
  const browserType = browserTypes[profile.engine]
  if (!browserType) throw new Error(`Unsupported Playwright engine: ${profile.engine}.`)
  return browserType
}

/**
 * @param {{ id: string, endpointEnv?: string }} profile
 * @param {Record<string, string | undefined>} env
 */
export function resolveCloudEndpoint(profile, env = process.env) {
  const endpointEnv = profile.endpointEnv
  if (!endpointEnv) throw new Error(`Cloud profile ${profile.id} has no endpointEnv.`)
  const endpoint = env[endpointEnv]
  if (!endpoint) {
    throw new Error(
      `Cloud profile ${profile.id} requires ${endpointEnv}; no paid provider is configured.`,
    )
  }
  return endpoint
}

/**
 * @param {{ id: string, provider: string, engine: string, endpointEnv?: string }} profile
 * @param {Record<string, string | undefined>} env
 */
export async function openBrowserProfile(profile, env = process.env) {
  const browserType = browserTypeFor(profile)
  if (profile.provider === 'local-playwright') return browserType.launch()
  if (profile.provider === 'playwright-websocket') {
    return browserType.connect(resolveCloudEndpoint(profile, env))
  }
  throw new Error(`Unsupported browser provider: ${profile.provider}.`)
}
