import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const testNodeModules = path.dirname(path.dirname(require.resolve('typescript/package.json')))

export async function linkTestNodeModules(projectRoot: string): Promise<void> {
  await fs.symlink(testNodeModules, path.join(projectRoot, 'node_modules'), 'dir')
}
