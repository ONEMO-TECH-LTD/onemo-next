import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { classifySourceFileForImport, importSourceFileToAuthoringStore } from '../authoring-import'
import { AuthoringSidecarStore, PROJECT_AUTHORING_SIDECAR } from '../authoring-store'
import { RuntimeRootRegistry } from '../runtime-root-registry'

const SOURCE_FILE = 'src/app/(dev)/react-figma-components/Button.tsx'
const CSS_FILE = 'src/app/(dev)/react-figma-components/Button.module.css'
const singleAxisSource = `
export function Button({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {
  return <button data-variant={variant}>Button</button>
}
`.trimStart()

async function makeImportStore(source = singleAxisSource, css?: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-import-'))
  await fs.mkdir(path.dirname(path.join(root, SOURCE_FILE)), { recursive: true })
  await fs.writeFile(path.join(root, SOURCE_FILE), source)
  if (css !== undefined) await fs.writeFile(path.join(root, CSS_FILE), css)
  const registry = await RuntimeRootRegistry.create([
    { storeId: 'project-main', kind: 'project', rootPath: root },
  ])
  const store = new AuthoringSidecarStore({ storeId: 'project-main', rootKind: 'project', registry })
  return { root, registry, store }
}

describe('source import integration', () => {
  it('classifies, hashes, and transactionally persists stable bootstrap identity from the same bytes', async () => {
    const { root, registry, store } = await makeImportStore()
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    expect(classified.projection.compatibility).toBe('legacy-single-axis')
    expect(classified.sourceHashes).toEqual({ [SOURCE_FILE]: expect.stringMatching(/^[a-f0-9]{64}$/) })
    const sourceBefore = await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')

    const result = await importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      registry,
      store,
    })

    expect(result.kind).toBe('imported')
    if (result.kind !== 'imported') return
    expect(result.graph.revision).toBe(1)
    expect(Object.values(result.graph.variants).map((variant) => variant.displayName))
      .toEqual(['Primary', 'Secondary'])
    expect(await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).toBe(sourceBefore)
    expect(await fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR), 'utf8')).toContain('legacy-single-axis')
    expect(await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'),
      'utf8',
    )).toContain('import-legacy-component')
    const reloaded = await new AuthoringSidecarStore({ storeId: 'project-main', rootKind: 'project', registry }).load()
    expect(Object.keys(reloaded!.variants)).toEqual(Object.keys(result.graph.variants))
  })

  it('hashes the exact CSS dependency used by the shared strict parser', async () => {
    const source = `
import styles from './Button.module.css'
export function Button({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {
  return <button className={styles.base} data-variant={variant}>Button</button>
}
`.trimStart()
    const { registry, store } = await makeImportStore(source, '.base { color: red; }\n')
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })

    expect(classified.projection.compatibility).toBe('legacy-single-axis')
    expect(Object.keys(classified.sourceHashes).sort()).toEqual([CSS_FILE, SOURCE_FILE].sort())
    const result = await importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      registry,
      store,
    })
    expect(result.kind).toBe('imported')
    if (result.kind === 'imported') expect(result.graph.sourceHashes).toEqual(classified.sourceHashes)
  })

  it('refuses source drift before creating a sidecar', async () => {
    const { root, registry, store } = await makeImportStore()
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    await fs.writeFile(path.join(root, SOURCE_FILE), singleAxisSource.replace('Button</button>', 'Changed</button>'))

    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      registry,
      store,
    })).rejects.toMatchObject({ code: 'SOURCE_HASH_STALE', changedPaths: [SOURCE_FILE] })
    expect(await store.load()).toBeNull()
  })

  it('holds actual multi-axis source without writing metadata', async () => {
    const source = `
export function Button({ variant = 'Primary', size = 'sm' }: {
  variant?: 'Primary' | 'Secondary'
  size?: 'sm' | 'lg'
}) { return <button>{variant}{size}</button> }
`.trimStart()
    const { root, registry, store } = await makeImportStore(source)
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })

    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      registry,
      store,
    })).resolves.toMatchObject({ kind: 'hold', compatibility: 'legacy-multi-axis' })
    expect(await store.load()).toBeNull()
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('classifies a missing CSS dependency as unsupported without writing metadata', async () => {
    const source = `import styles from './Button.module.css'
export function Button() { return <button className={styles.base} /> }
`
    const { root, registry, store } = await makeImportStore(source)
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })

    expect(classified.projection).toMatchObject({
      compatibility: 'unsupported',
      unsupportedReason: expect.stringContaining(`source dependency unavailable: ${CSS_FILE}`),
    })
    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      registry,
      store,
    })).resolves.toMatchObject({ kind: 'unsupported' })
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
