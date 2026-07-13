import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { classifySourceFileForImport, importSourceFileToAuthoringStore } from '../authoring-import'
import { EMPTY_ENVIRONMENT_FINGERPRINT } from '../authoring-environment'
import { ProjectAuthoringSession } from '../authoring-session'
import { AuthoringSidecarStore, createEmptyAuthoringGraph, PROJECT_AUTHORING_SIDECAR } from '../authoring-store'
import { DurableFileInstaller, sha256 } from '../durable-file-installer'
import { RuntimeRootRegistry } from '../runtime-root-registry'
import {
  AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE,
  AUTHORING_SOURCE_PROVENANCE_RESERVED,
} from '@/lib/editor-source-provenance'
import { linkTestNodeModules } from './test-project-root'

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
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
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
    const css = '.base { color: red; }\n'
    const { registry, store } = await makeImportStore(source, css)
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })

    expect(classified.projection.compatibility).toBe('legacy-single-axis')
    expect(Object.keys(classified.sourceHashes).sort()).toEqual([CSS_FILE, SOURCE_FILE].sort())
    expect(classified.sourceHashes[CSS_FILE]).toBe(sha256(css))
    const result = await importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      registry,
      store,
    })
    expect(result.kind).toBe('imported')
    if (result.kind === 'imported') {
      expect(result.graph.sourceHashes).toEqual(classified.sourceHashes)
      expect(result.graph.sourceHashes[CSS_FILE]).toBe(sha256(css))
    }
  })

  it('hashes a lawful parent-relative CSS module under one canonical store identity', async () => {
    const cssFile = 'src/app/(dev)/authoring-e2e/Card.module.css'
    const source = `import styles from '../authoring-e2e/Card.module.css'
export function Button() { return <button className={styles.card}>Button</button> }
`
    const { root, registry, store } = await makeImportStore(source)
    await fs.mkdir(path.dirname(path.join(root, cssFile)), { recursive: true })
    const css = '.card { color: red; }\n'
    await fs.writeFile(path.join(root, cssFile), css)

    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    expect(classified.projection).toMatchObject({ compatibility: 'native-v1', cssModule: cssFile })
    expect(Object.keys(classified.sourceHashes).sort()).toEqual([cssFile, SOURCE_FILE].sort())
    expect(classified.sourceHashes[cssFile]).toBe(sha256(css))

    const result = await importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      registry,
      store,
    })
    expect(result.kind).toBe('imported')
    if (result.kind === 'imported') {
      expect(result.graph.sourceHashes).toEqual(classified.sourceHashes)
      expect(result.graph.sourceHashes[cssFile]).toBe(sha256(css))
    }
  })

  it('keeps canonical CSS lookup behind the dot-segment and symlink jail with zero writes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-import-css-jail-'))
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-import-css-outside-'))
    const componentDir = path.dirname(path.join(root, SOURCE_FILE))
    await fs.mkdir(componentDir, { recursive: true })
    await fs.mkdir(path.join(root, 'src/app/(dev)/authoring-e2e'), { recursive: true })
    const registry = await RuntimeRootRegistry.create([{ storeId: 'project-main', kind: 'project', rootPath: root }])
    const store = new AuthoringSidecarStore({ storeId: 'project-main', rootKind: 'project', registry })
    const expectNoDurableWrites = async () => {
      await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(fs.readdir(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history')))
        .rejects.toMatchObject({ code: 'ENOENT' })
      await expect(fs.readdir(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')))
        .rejects.toMatchObject({ code: 'ENOENT' })
    }

    const outsideSpecifier = path.relative(componentDir, path.join(outside, 'Outside.module.css')).split(path.sep).join('/')
    await fs.writeFile(path.join(root, SOURCE_FILE), `import styles from '${outsideSpecifier}'\nexport function Button() { return <button className={styles.card} /> }\n`)
    const outsideProjection = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    expect(outsideProjection.projection).toMatchObject({
      compatibility: 'unsupported',
      unsupportedReason: expect.stringContaining('invalid store-relative path'),
    })
    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main', file: SOURCE_FILE,
      expectedSourceHashes: outsideProjection.sourceHashes,
      expectedEnvironmentFingerprint: outsideProjection.environmentFingerprint,
      registry, store,
    })).resolves.toMatchObject({ kind: 'unsupported' })
    await expectNoDurableWrites()

    await fs.writeFile(path.join(outside, 'Outside.module.css'), '.card {}\n')
    await fs.symlink(path.join(outside, 'Outside.module.css'), path.join(root, 'src/app/(dev)/authoring-e2e/Linked.module.css'))
    await fs.writeFile(path.join(root, SOURCE_FILE), `import styles from '../authoring-e2e/Linked.module.css'\nexport function Button() { return <button className={styles.card} /> }\n`)
    const symlinkProjection = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    expect(symlinkProjection.projection).toMatchObject({
      compatibility: 'unsupported',
      unsupportedReason: expect.stringContaining('symlink path component refused'),
    })
    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main', file: SOURCE_FILE,
      expectedSourceHashes: symlinkProjection.sourceHashes,
      expectedEnvironmentFingerprint: symlinkProjection.environmentFingerprint,
      registry, store,
    })).resolves.toMatchObject({ kind: 'unsupported' })
    await expectNoDurableWrites()
  })

  it('refuses source drift before creating a sidecar', async () => {
    const { root, registry, store } = await makeImportStore()
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    await fs.writeFile(path.join(root, SOURCE_FILE), singleAxisSource.replace('Button</button>', 'Changed</button>'))

    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      registry,
      store,
    })).rejects.toMatchObject({ code: 'SOURCE_HASH_STALE', changedPaths: [SOURCE_FILE] })
    expect(await store.load()).toBeNull()
  })

  it('named-refuses authored reserved provenance before production import evidence', async () => {
    const { root, registry, store } = await makeImportStore()
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    const forged = singleAxisSource.replace(
      '<button data-variant',
      `<button ${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}="${SOURCE_FILE}:999:1" data-variant`,
    )
    await fs.writeFile(path.join(root, SOURCE_FILE), forged)

    await expect(classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry }))
      .rejects.toMatchObject({ code: AUTHORING_SOURCE_PROVENANCE_RESERVED, status: 422 })
    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      registry,
      store,
    })).rejects.toMatchObject({ code: AUTHORING_SOURCE_PROVENANCE_RESERVED, status: 422 })

    await expect(fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).resolves.toBe(forged)
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readdir(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history')))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readdir(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses rather than replacing a persisted revision-zero sidecar', async () => {
    const { root, registry, store } = await makeImportStore()
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    const existing = createEmptyAuthoringGraph({
      storeId: 'project-main',
      rootKind: 'project',
      sourceHashes: classified.sourceHashes,
    })
    const sidecar = path.join(root, PROJECT_AUTHORING_SIDECAR)
    await new DurableFileInstaller().writeJsonAtomic(sidecar, existing)
    const before = await fs.readFile(sidecar)

    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      registry,
      store,
    })).rejects.toMatchObject({ code: 'AUTHORING_SIDECAR_EXISTS', status: 409 })

    await expect(fs.readFile(sidecar)).resolves.toEqual(before)
    await expect(fs.readdir(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')))
      .rejects.toMatchObject({ code: 'ENOENT' })
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
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
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
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      registry,
      store,
    })).resolves.toMatchObject({ kind: 'unsupported' })
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each([
    {
      label: 'missing',
      source: `export function Button({ variant }: { variant?: 'Primary' | 'Secondary' }) { return <button>{variant}</button> }\n`,
    },
    {
      label: 'dynamic',
      source: `const DEFAULT = 'Primary' as const\nexport function Button({ variant = DEFAULT }: { variant?: 'Primary' | 'Secondary' }) { return <button>{variant}</button> }\n`,
    },
    {
      label: 'outside the union',
      source: `export function Button({ variant = 'Tertiary' }: { variant?: 'Primary' | 'Secondary' }) { return <button>{variant}</button> }\n`,
    },
  ])('refuses a $label legacy-axis default without source, sidecar, or transaction drift', async ({ source }) => {
    const { root, registry, store } = await makeImportStore(source)
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })

    expect(classified.projection).toMatchObject({
      compatibility: 'unsupported',
      unsupportedReason: 'component axis default must be a static union member: variant',
    })
    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      registry,
      store,
    })).resolves.toMatchObject({ kind: 'unsupported' })
    await expect(fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).resolves.toBe(source)
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readdir(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses relative, path-alias, and symlinked project dependencies that escape the registered root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-import-jail-'))
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-import-outside-'))
    const componentDir = path.dirname(path.join(root, SOURCE_FILE))
    await fs.mkdir(componentDir, { recursive: true })
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await fs.writeFile(path.join(outside, 'tone.ts'), `export type Tone = 'Primary' | 'Secondary'\n`)
    const registry = await RuntimeRootRegistry.create([{ storeId: 'project-main', kind: 'project', rootPath: root }])

    const relativeSpecifier = path.relative(componentDir, path.join(outside, 'tone.ts')).split(path.sep).join('/')
    await fs.writeFile(path.join(root, SOURCE_FILE), `type Tone = import('${relativeSpecifier}').Tone\nexport function Button({ tone }: { tone?: Tone }) { return <button /> }\n`)
    await expect(classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry }))
      .rejects.toMatchObject({ code: 'SOURCE_DEPENDENCY_OUTSIDE_ROOT' })

    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { baseUrl: '.', paths: { '@outside/*': [`${path.relative(root, outside).split(path.sep).join('/')}/*`] }, moduleResolution: 'Bundler' },
    }))
    await fs.writeFile(path.join(root, SOURCE_FILE), `import type { Tone } from '@outside/tone'\nexport function Button({ tone }: { tone?: Tone }) { return <button /> }\n`)
    await expect(classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry }))
      .rejects.toMatchObject({ code: 'SOURCE_TSCONFIG_OUTSIDE_ROOT' })

    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] }, moduleResolution: 'Bundler' },
    }))
    await fs.symlink(path.join(outside, 'tone.ts'), path.join(root, 'src/tone.ts'))
    await fs.writeFile(path.join(root, SOURCE_FILE), `import type { Tone } from '@/tone'\nexport function Button({ tone }: { tone?: Tone }) { return <button /> }\n`)
    await expect(classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry }))
      .rejects.toMatchObject({ code: 'PATH_SYMLINK_REFUSED' })
  })

  it('hashes relevant tsconfig ambient declarations and enforces their drift through the semantic transaction', async () => {
    const source = `export function Button({ label }: { label?: AmbientLabel }) { return <button>{label}</button> }\n`
    const { root, registry, store } = await makeImportStore(source)
    const ambientFile = 'src/global.d.ts'
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await linkTestNodeModules(root)
    await fs.writeFile(path.join(root, ambientFile), `type AmbientLabel = 'Primary' | 'Secondary'\n`)
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', types: ['react'] },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    }))
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    expect(Object.keys(classified.sourceHashes).sort()).toEqual([SOURCE_FILE, ambientFile, 'tsconfig.json'].sort())
    const imported = await importSourceFileToAuthoringStore({
      storeId: 'project-main', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint, registry, store,
    })
    if (imported.kind !== 'imported') throw new Error(`expected import, received ${imported.kind}`)
    const session = new ProjectAuthoringSession({ storeId: 'project-main', registry, store })
    const loaded = await session.loadComponent(SOURCE_FILE)
    await expect(session.execute({
      command: { kind: 'create-variant', commandId: 'ambient-valid', componentId: loaded.componentId, displayName: 'New Variant' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    })).resolves.toMatchObject({ graph: { revision: 2 } })

    const afterCreate = await session.loadComponent(SOURCE_FILE)
    await fs.writeFile(path.join(root, ambientFile), `type AmbientLabel = number\n`)
    await expect(session.execute({
      command: { kind: 'create-variant', commandId: 'ambient-stale', componentId: loaded.componentId, displayName: 'Nope' },
      expectedRevision: afterCreate.graph.revision,
      expectedSourceHashes: afterCreate.sourceHashes,
    })).rejects.toMatchObject({ code: 'SOURCE_HASH_STALE', changedPaths: [ambientFile] })
  }, 15_000)

  it('hashes an exact local triple-slash declaration even when it is not a tsconfig root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-import-reference-'))
    const component = path.join(root, SOURCE_FILE)
    const ambient = path.join(root, 'ambient.d.ts')
    await fs.mkdir(path.dirname(component), { recursive: true })
    await fs.writeFile(ambient, `type ReferencedLabel = string\n`)
    const reference = path.relative(path.dirname(component), ambient).split(path.sep).join('/')
    await fs.writeFile(component, `/// <reference path="${reference}" />\nexport function Button({ label }: { label?: ReferencedLabel }) { return <button>{label}</button> }\n`)
    const registry = await RuntimeRootRegistry.create([{ storeId: 'project-main', kind: 'project', rootPath: root }])

    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    expect(Object.keys(classified.sourceHashes).sort()).toEqual([SOURCE_FILE, 'ambient.d.ts'].sort())
  })

  it('hashes a local tsconfig typeRoots package and loads it into staged semantics', async () => {
    const source = `export function Button({ label }: { label?: LocalAmbientLabel }) { return <button>{label}</button> }\n`
    const { root, registry, store } = await makeImportStore(source)
    const typeFile = 'types/local/index.d.ts'
    await fs.mkdir(path.dirname(path.join(root, typeFile)), { recursive: true })
    await linkTestNodeModules(root)
    await fs.writeFile(path.join(root, typeFile), `type LocalAmbientLabel = string\n`)
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true, noEmit: true, target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx',
        typeRoots: ['./types', './node_modules/@types'], types: ['react', 'local'],
      },
    }))
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    expect(Object.keys(classified.sourceHashes).sort()).toEqual([SOURCE_FILE, typeFile, 'tsconfig.json'].sort())
    const imported = await importSourceFileToAuthoringStore({
      storeId: 'project-main', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint, registry, store,
    })
    if (imported.kind !== 'imported') throw new Error(`expected import, received ${imported.kind}`)
    const session = new ProjectAuthoringSession({ storeId: 'project-main', registry, store })
    const loaded = await session.loadComponent(SOURCE_FILE)
    await expect(session.execute({
      command: { kind: 'create-variant', commandId: 'type-root-valid', componentId: loaded.componentId, displayName: 'New Variant' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    })).resolves.toMatchObject({ graph: { revision: 2 } })
  }, 15_000)

  it('hashes the complete config chain and refuses option-only drift before transaction prepare', async () => {
    const { root, registry, store } = await makeImportStore()
    await linkTestNodeModules(root)
    await fs.mkdir(path.join(root, 'config'), { recursive: true })
    const baseConfig = 'config/compiler.json'
    await fs.writeFile(path.join(root, baseConfig), JSON.stringify({
      compilerOptions: {
        strict: true, target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', types: ['react'],
      },
    }))
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: './config/compiler.json' }))
    const classified = await classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry })
    expect(Object.keys(classified.sourceHashes).sort()).toEqual([SOURCE_FILE, baseConfig, 'tsconfig.json'].sort())
    const imported = await importSourceFileToAuthoringStore({
      storeId: 'project-main', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint, registry, store,
    })
    if (imported.kind !== 'imported') throw new Error(`expected import, received ${imported.kind}`)
    const session = new ProjectAuthoringSession({ storeId: 'project-main', registry, store })
    const loaded = await session.loadComponent(SOURCE_FILE)
    const transactions = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')
    const beforeTransactions = await fs.readdir(transactions)

    await fs.writeFile(path.join(root, baseConfig), JSON.stringify({
      compilerOptions: {
        strict: false, target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', types: ['react'],
      },
    }))
    await expect(session.execute({
      command: { kind: 'create-variant', commandId: 'config-drift', componentId: loaded.componentId, displayName: 'Nope' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    })).rejects.toMatchObject({ code: 'SOURCE_HASH_STALE', changedPaths: [baseConfig] })
    expect(await fs.readdir(transactions)).toEqual(beforeTransactions)
  }, 15_000)

  it.each([
    {
      label: 'relative static import',
      source: `import type { Missing } from './missing'\nexport function Button({ value }: { value?: Missing }) { return <button /> }\n`,
      config: undefined,
    },
    {
      label: 'relative import type',
      source: `type Missing = import('./missing').Missing\nexport function Button({ value }: { value?: Missing }) { return <button /> }\n`,
      config: undefined,
    },
    {
      label: 'project path alias',
      source: `import type { Missing } from '@/missing'\nexport function Button({ value }: { value?: Missing }) { return <button /> }\n`,
      config: { compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] }, moduleResolution: 'Bundler' } },
    },
  ])('refuses an unresolved $label before classification or persistence', async ({ source, config }) => {
    const { root, registry, store } = await makeImportStore(source)
    if (config) await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify(config))

    await expect(classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry }))
      .rejects.toMatchObject({ code: 'SOURCE_DEPENDENCY_UNRESOLVED', status: 422 })
    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main', file: SOURCE_FILE, expectedSourceHashes: {},
      expectedEnvironmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT, registry, store,
    })).rejects.toMatchObject({ code: 'SOURCE_DEPENDENCY_UNRESOLVED', status: 422 })
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await store.load()).toBeNull()
    await expect(fs.readdir(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not misclassify an unresolved bare package import as project-owned source', async () => {
    const source = `import 'optional-external-package'\nexport function Button() { return <button /> }\n`
    const { registry } = await makeImportStore(source)

    await expect(classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry }))
      .resolves.toMatchObject({ projection: { compatibility: 'native-v1' } })
  })

  it('distinguishes baseUrl-owned imports from installed package specifiers', async () => {
    const { root, registry, store } = await makeImportStore()
    await linkTestNodeModules(root)
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { baseUrl: '.', moduleResolution: 'Bundler' },
    }))
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await fs.writeFile(path.join(root, 'src/existing.ts'), 'export type Existing = string\n')

    await fs.writeFile(path.join(root, SOURCE_FILE), `import type { Existing } from 'src/existing'\nexport function Button({ value }: { value?: Existing }) { return <button /> }\n`)
    await expect(classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry }))
      .resolves.toMatchObject({
        projection: { compatibility: 'native-v1' },
        sourceHashes: { 'src/existing.ts': expect.stringMatching(/^[a-f0-9]{64}$/) },
      })

    await fs.writeFile(path.join(root, SOURCE_FILE), `import type { Missing } from 'src/missing'\nexport function Button({ value }: { value?: Missing }) { return <button /> }\n`)
    await expect(classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry }))
      .rejects.toMatchObject({ code: 'SOURCE_DEPENDENCY_UNRESOLVED', status: 422 })
    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main', file: SOURCE_FILE, expectedSourceHashes: {},
      expectedEnvironmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT, registry, store,
    })).rejects.toMatchObject({ code: 'SOURCE_DEPENDENCY_UNRESOLVED', status: 422 })
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readdir(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')))
      .rejects.toMatchObject({ code: 'ENOENT' })

    await fs.mkdir(path.join(root, 'react'), { recursive: true })
    await fs.writeFile(path.join(root, SOURCE_FILE), `import type { MissingPackageSubpath } from 'react/definitely-missing'\nexport function Button({ value }: { value?: MissingPackageSubpath }) { return <button /> }\n`)
    await expect(classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry }))
      .resolves.toMatchObject({ projection: { compatibility: 'native-v1' } })
  })

  it.each(['absolute', 'relative'] as const)('refuses an %s outside-root baseUrl before any import evidence', async (kind) => {
    const source = `import type { Missing } from 'outside/missing'\nexport function Button({ value }: { value?: Missing }) { return <button /> }\n`
    const { root, registry, store } = await makeImportStore(source)
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-import-baseurl-outside-'))
    const baseUrl = kind === 'absolute' ? outside : path.relative(root, outside).split(path.sep).join('/')
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { baseUrl, moduleResolution: 'Bundler' } }))

    await expect(classifySourceFileForImport({ storeId: 'project-main', file: SOURCE_FILE, registry }))
      .rejects.toMatchObject({ code: 'SOURCE_TSCONFIG_OUTSIDE_ROOT', status: 422 })
    await expect(importSourceFileToAuthoringStore({
      storeId: 'project-main', file: SOURCE_FILE, expectedSourceHashes: {},
      expectedEnvironmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT, registry, store,
    })).rejects.toMatchObject({ code: 'SOURCE_TSCONFIG_OUTSIDE_ROOT', status: 422 })
    await expect(fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).resolves.toBe(source)
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readdir(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history')))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readdir(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })
})
