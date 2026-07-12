import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PROJECT_AUTHORING_SIDECAR } from '../editor/authoring-store'
import { authoringMetadataPath } from '../editor/authoring-paths'
import { sha256 } from '../editor/durable-file-installer'
import { legacySourceProjectionFingerprint, sourceProjectionFingerprint, sourceProjectionFromSource } from '../editor/source-projection'
import { linkTestNodeModules } from '../editor/__tests__/test-project-root'
import { handleGet, handlePost } from './handler'
import { GET } from './route'

const SOURCE_FILE = 'src/app/(dev)/react-figma-components/Button.tsx'
const singleAxisSource = `export function Button({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {
  return <button>{variant}</button>
}
`

async function makeRoot(source = singleAxisSource) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-import-route-'))
  await fs.mkdir(path.dirname(path.join(root, SOURCE_FILE)), { recursive: true })
  await linkTestNodeModules(root)
  await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      types: ['react'],
    },
    include: ['src/**/*.ts', 'src/**/*.tsx'],
  }))
  await fs.writeFile(path.join(root, SOURCE_FILE), source)
  return root
}

function request(method: 'GET' | 'POST', body?: unknown) {
  return new Request(`http://localhost/api/dev/editor-authoring?file=${encodeURIComponent(SOURCE_FILE)}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  })
}

function componentRequest() {
  return new Request(`http://localhost/api/dev/editor-authoring?mode=component&file=${encodeURIComponent(SOURCE_FILE)}`)
}

function componentStatusRequest() {
  return new Request(`http://localhost/api/dev/editor-authoring?mode=component-status&file=${encodeURIComponent(SOURCE_FILE)}`)
}

describe('editor-authoring G1 import route', () => {
  beforeEach(() => vi.stubEnv('NODE_ENV', 'development'))
  afterEach(() => vi.unstubAllEnvs())

  it('classifies exact hashes then persists through the production import caller', async () => {
    const root = await makeRoot()
    const classifiedResponse = await handleGet(request('GET'), root)
    const classified = await classifiedResponse.json()
    expect(classifiedResponse.status).toBe(200)
    expect(classified).toMatchObject({ projection: { compatibility: 'legacy-single-axis' } })

    const importedResponse = await handlePost(request('POST', {
      kind: 'import-source',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000001',
    }), root)
    const imported = await importedResponse.json()

    expect(importedResponse.status).toBe(200)
    expect(imported).toMatchObject({ kind: 'imported', graph: { revision: 1 } })
    expect(await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).toBe(singleAxisSource)
    expect(await fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR), 'utf8')).toContain('legacy-single-axis')
  })

  it('returns an import preview without turning a missing graph into an HTTP failure', async () => {
    const root = await makeRoot()

    const previewResponse = await handleGet(componentStatusRequest(), root)
    expect(previewResponse.status).toBe(200)
    await expect(previewResponse.json()).resolves.toMatchObject({
      authoringState: 'import-preview',
      projection: { compatibility: 'legacy-single-axis' },
      sourceHashes: { [SOURCE_FILE]: expect.stringMatching(/^[a-f0-9]{64}$/) },
    })

    const directResponse = await handleGet(componentRequest(), root)
    expect(directResponse.status).toBe(409)
    await expect(directResponse.json()).resolves.toMatchObject({ code: 'AUTHORING_GRAPH_MISSING' })
  })

  it('transactionally migrates a V1 sidecar from exact current source before component load', async () => {
    const root = await makeRoot()
    const environmentFile = '.next/dev/types/routes.d.ts'
    const environmentPath = path.join(root, environmentFile)
    await fs.mkdir(path.dirname(environmentPath), { recursive: true })
    const legacyEnvironmentBytes = 'declare type GeneratedRoute = "/legacy"\n'
    await fs.writeFile(environmentPath, legacyEnvironmentBytes)
    const tsconfigPath = path.join(root, 'tsconfig.json')
    const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf8'))
    tsconfig.include.push('.next/dev/types/**/*.d.ts')
    await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig))
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000005',
    }), root)
    let loaded = await (await handleGet(componentRequest(), root)).json()
    const componentId = loaded.componentId as string
    const secondary = Object.values(loaded.graph.variants as Record<string, { id: string; displayName: string }>)
      .find((variant) => variant.displayName === 'Secondary')!
    await handlePost(request('POST', {
      kind: 'execute-command',
      command: {
        kind: 'move-variant', commandId: 'before-schema-migration-move', componentId,
        variantId: secondary.id, frame: { x: 400, y: 20, width: 320, height: 180 },
      },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    loaded = await (await handleGet(componentRequest(), root)).json()
    await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'create-variant', commandId: 'before-schema-migration-create', componentId, displayName: 'Created' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    loaded = await (await handleGet(componentRequest(), root)).json()
    await handlePost(request('POST', {
      kind: 'undo', expectedRevision: loaded.graph.revision, expectedSourceHashes: loaded.sourceHashes,
    }), root)
    loaded = await (await handleGet(componentRequest(), root)).json()
    await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'create-variant', commandId: 'after-source-undo-create', componentId, displayName: 'After Undo' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    const sourcePath = path.join(root, SOURCE_FILE)
    const sourceBefore = await fs.readFile(sourcePath)
    const sidecarPath = path.join(root, PROJECT_AUTHORING_SIDECAR)
    const legacy = JSON.parse(await fs.readFile(sidecarPath, 'utf8')) as Record<string, unknown>
    legacy.schemaVersion = 1
    const legacySourceHashes = legacy.sourceHashes as Record<string, string>
    legacy.sourceHashes = {
      [SOURCE_FILE]: legacySourceHashes[SOURCE_FILE]!,
      [environmentFile]: sha256(legacyEnvironmentBytes),
    }
    delete legacy.environmentFingerprint
    for (const component of Object.values(legacy.components as Record<string, Record<string, unknown>>)) {
      delete component.projectionFingerprint
    }
    await fs.writeFile(sidecarPath, JSON.stringify(legacy, null, 2) + '\n')
    const journalPath = path.join(root, authoringMetadataPath('project', 'history/journal.ndjson'))
    const journal = (await fs.readFile(journalPath, 'utf8')).trimEnd().split('\n').map((line) => JSON.parse(line))
    for (const record of journal) {
      if (record.type !== 'authoring-command') continue
      const graphRef = record.graphPreimage as { sha256: string; path: string }
      const graph = JSON.parse(await fs.readFile(path.join(root, graphRef.path), 'utf8')) as Record<string, unknown>
      graph.schemaVersion = 1
      for (const component of Object.values(graph.components as Record<string, Record<string, unknown>>)) {
        delete component.projectionFingerprint
      }
      const graphSourceHashes = graph.sourceHashes as Record<string, string>
      graph.sourceHashes = {
        ...(graphSourceHashes[SOURCE_FILE] ? { [SOURCE_FILE]: graphSourceHashes[SOURCE_FILE] } : {}),
        [environmentFile]: sha256(legacyEnvironmentBytes),
      }
      delete graph.environmentFingerprint
      const graphBytes = Buffer.from(JSON.stringify(graph, null, 2) + '\n')
      const graphHash = sha256(graphBytes)
      const graphPath = authoringMetadataPath('project', `history/blobs/${graphHash}`)
      await fs.writeFile(path.join(root, graphPath), graphBytes)
      record.graphPreimage = { sha256: graphHash, path: graphPath }
    }
    await fs.writeFile(journalPath, journal.map((record) => JSON.stringify(record)).join('\n') + '\n')
    const transactionsPath = path.join(root, authoringMetadataPath('project', 'transactions'))
    const transactionsBefore = await fs.readdir(transactionsPath)
    await fs.writeFile(environmentPath, 'declare type GeneratedRoute = "/current"\n')

    const response = await handleGet(componentRequest(), root)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ graph: { schemaVersion: 2, revision: 6 } })
    await expect(fs.readFile(sourcePath)).resolves.toEqual(sourceBefore)
    const persisted = JSON.parse(await fs.readFile(sidecarPath, 'utf8'))
    expect(persisted).toMatchObject({ schemaVersion: 2, revision: 6 })
    expect(persisted.sourceHashes).not.toHaveProperty(environmentFile)
    expect(persisted.sourceHashes).toHaveProperty('tsconfig.json', expect.stringMatching(/^[a-f0-9]{64}$/))
    expect(persisted.environmentFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(Object.values(persisted.components)[0]).toMatchObject({ projectionFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(await fs.readdir(transactionsPath)).toHaveLength(transactionsBefore.length + 1)
    const migratedJournal = (await fs.readFile(journalPath, 'utf8')).trimEnd().split('\n').map((line) => JSON.parse(line))
    expect(migratedJournal.at(-1)?.command).toEqual({ kind: 'schema-migration', from: 1, to: 2 })
    for (const record of migratedJournal) {
      if (record.type !== 'authoring-command') continue
      await expect(fs.readFile(path.join(root, record.graphPreimage.path), 'utf8').then(JSON.parse))
        .resolves.toMatchObject({ schemaVersion: 2 })
    }
    const migrated = await (await handleGet(componentRequest(), root)).json()
    expect(migrated.canUndo).toBe(true)
    const undo = await handlePost(request('POST', {
      kind: 'undo', expectedRevision: migrated.graph.revision, expectedSourceHashes: migrated.sourceHashes,
    }), root)
    expect(undo.status).toBe(200)
    await expect(undo.json()).resolves.toMatchObject({
      undoneCommand: { kind: 'create-variant', commandId: 'after-source-undo-create' },
      graph: { revision: 7 },
    })
  }, 20_000)

  it('refuses V1 migration without rewriting sidecar evidence when tracked source drifted', async () => {
    const root = await makeRoot()
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000006',
    }), root)
    const sidecarPath = path.join(root, PROJECT_AUTHORING_SIDECAR)
    const legacy = JSON.parse(await fs.readFile(sidecarPath, 'utf8')) as Record<string, unknown>
    legacy.schemaVersion = 1
    for (const component of Object.values(legacy.components as Record<string, Record<string, unknown>>)) {
      delete component.projectionFingerprint
    }
    const legacyBytes = Buffer.from(JSON.stringify(legacy, null, 2) + '\n')
    await fs.writeFile(sidecarPath, legacyBytes)
    await fs.appendFile(path.join(root, SOURCE_FILE), '\n// external drift\n')
    const transactionsPath = path.join(root, authoringMetadataPath('project', 'transactions'))
    const transactionsBefore = (await fs.readdir(transactionsPath)).sort()

    const response = await handleGet(componentRequest(), root)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHORING_MIGRATION_SOURCE_STALE' })
    await expect(fs.readFile(sidecarPath)).resolves.toEqual(legacyBytes)
    expect((await fs.readdir(transactionsPath)).sort()).toEqual(transactionsBefore)
  }, 20_000)

  it('refuses invalid ambient regeneration during V1 migration without durable writes', async () => {
    const root = await makeRoot()
    const environmentFile = '.next/dev/types/routes.d.ts'
    const environmentPath = path.join(root, environmentFile)
    await fs.mkdir(path.dirname(environmentPath), { recursive: true })
    const legacyEnvironmentBytes = 'declare type GeneratedRoute = "/legacy"\n'
    await fs.writeFile(environmentPath, legacyEnvironmentBytes)
    const tsconfigPath = path.join(root, 'tsconfig.json')
    const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf8'))
    tsconfig.include.push('.next/dev/types/**/*.d.ts')
    await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig))
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000007',
    }), root)
    const sidecarPath = path.join(root, PROJECT_AUTHORING_SIDECAR)
    const legacy = JSON.parse(await fs.readFile(sidecarPath, 'utf8')) as Record<string, unknown>
    legacy.schemaVersion = 1
    ;(legacy.sourceHashes as Record<string, string>)[environmentFile] = sha256(legacyEnvironmentBytes)
    delete legacy.environmentFingerprint
    for (const component of Object.values(legacy.components as Record<string, Record<string, unknown>>)) {
      delete component.projectionFingerprint
    }
    const legacyBytes = Buffer.from(JSON.stringify(legacy, null, 2) + '\n')
    await fs.writeFile(sidecarPath, legacyBytes)
    await fs.writeFile(environmentPath, 'type Broken =\n')
    const transactionsPath = path.join(root, authoringMetadataPath('project', 'transactions'))
    const transactionsBefore = (await fs.readdir(transactionsPath)).sort()

    const response = await handleGet(componentRequest(), root)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ code: 'STAGED_TYPECHECK_FAILED' })
    await expect(fs.readFile(sidecarPath)).resolves.toEqual(legacyBytes)
    expect((await fs.readdir(transactionsPath)).sort()).toEqual(transactionsBefore)
  }, 20_000)

  it('revalidates changed source authority without hiding the latest variant undo', async () => {
    const root = await makeRoot()
    const ambientFile = 'src/authoring-e2e.d.ts'
    await fs.writeFile(path.join(root, ambientFile), 'declare type AuthoringAmbient = "before"\n')
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000001',
    }), root)

    let loaded = await (await handleGet(componentRequest(), root)).json()
    const created = await (await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'create-variant', commandId: 'before-revalidate', componentId: loaded.componentId, displayName: 'Created' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)).json()
    expect(Object.keys(created.graph.variants)).toHaveLength(3)

    await fs.writeFile(path.join(root, ambientFile), 'declare type AuthoringAmbient = "after"\n')
    const staleResponse = await handleGet(componentStatusRequest(), root)
    expect(staleResponse.status).toBe(200)
    const stale = await staleResponse.json()
    expect(stale).toMatchObject({
      authoringState: 'source-stale',
      expectedRevision: 2,
      changedPaths: [ambientFile],
      sourceHashes: { [ambientFile]: expect.stringMatching(/^[a-f0-9]{64}$/) },
    })

    const revalidatedResponse = await handlePost(request('POST', {
      kind: 'revalidate-source',
      file: SOURCE_FILE,
      expectedRevision: stale.expectedRevision,
      expectedSourceHashes: stale.sourceHashes,
    }), root)
    expect(revalidatedResponse.status).toBe(200)
    await expect(revalidatedResponse.json()).resolves.toMatchObject({ kind: 'revalidated', graph: { revision: 3 } })

    loaded = await (await handleGet(componentRequest(), root)).json()
    expect(loaded.canUndo).toBe(true)
    const undo = await handlePost(request('POST', {
      kind: 'undo',
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    expect(undo.status).toBe(200)
    const undone = await undo.json()
    expect(undone).toMatchObject({
      graph: { revision: 4 },
      undoneCommand: { kind: 'create-variant', commandId: 'before-revalidate' },
    })
    expect(Object.keys(undone.graph.variants)).toHaveLength(2)
  }, 20_000)

  it('rebases generated compiler-environment drift without changing authored authority or semantic undo', async () => {
    const root = await makeRoot()
    const environmentFile = '.next/dev/types/routes.d.ts'
    await fs.mkdir(path.dirname(path.join(root, environmentFile)), { recursive: true })
    await fs.writeFile(path.join(root, environmentFile), 'declare type GeneratedRoute = "/before"\n')
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true, noEmit: true, target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', types: ['react'],
      },
      include: ['src/**/*.ts', 'src/**/*.tsx', '.next/dev/types/**/*.d.ts'],
    }))
    const classified = await (await handleGet(request('GET'), root)).json()
    expect(classified.sourceHashes).not.toHaveProperty(environmentFile)
    expect(classified.environmentFingerprint).toMatch(/^[a-f0-9]{64}$/)
    const imported = await (await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000002',
    }), root)).json()
    const acceptedEnvironment = imported.graph.environmentFingerprint

    const loadedBeforeCreate = await (await handleGet(componentRequest(), root)).json()
    await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'create-variant', commandId: 'before-environment-rebase', componentId: loadedBeforeCreate.componentId, displayName: 'Created' },
      expectedRevision: loadedBeforeCreate.graph.revision,
      expectedSourceHashes: loadedBeforeCreate.sourceHashes,
    }), root)
    const beforeDrift = await (await handleGet(componentRequest(), root)).json()
    const authoredBytes = await fs.readFile(path.join(root, SOURCE_FILE))
    await fs.writeFile(path.join(root, environmentFile), 'type Broken =\n')

    let staleResponse = await handleGet(componentStatusRequest(), root)
    expect(staleResponse.status).toBe(200)
    let stale = await staleResponse.json()
    expect(stale).toMatchObject({
      authoringState: 'environment-stale',
      expectedRevision: beforeDrift.graph.revision,
      sourceHashes: beforeDrift.sourceHashes,
      environmentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(stale.environmentFingerprint).not.toBe(acceptedEnvironment)

    const sidecarPath = path.join(root, PROJECT_AUTHORING_SIDECAR)
    const journalPath = path.join(root, authoringMetadataPath('project', 'history/journal.ndjson'))
    const transactionsPath = path.join(root, authoringMetadataPath('project', 'transactions'))
    const beforeSidecar = await fs.readFile(sidecarPath)
    const beforeJournal = await fs.readFile(journalPath)
    const beforeTransactions = (await fs.readdir(transactionsPath)).sort()
    const invalidResponse = await handlePost(request('POST', {
      kind: 'environment-rebase', file: SOURCE_FILE,
      expectedRevision: stale.expectedRevision,
      expectedSourceHashes: stale.sourceHashes,
      expectedEnvironmentFingerprint: stale.environmentFingerprint,
    }), root)
    expect(invalidResponse.status).toBe(422)
    await expect(invalidResponse.json()).resolves.toMatchObject({ code: 'STAGED_TYPECHECK_FAILED' })
    await expect(fs.readFile(sidecarPath)).resolves.toEqual(beforeSidecar)
    await expect(fs.readFile(journalPath)).resolves.toEqual(beforeJournal)
    expect((await fs.readdir(transactionsPath)).sort()).toEqual(beforeTransactions)

    await fs.writeFile(path.join(root, environmentFile), 'declare type GeneratedRoute = "/after"\n')
    staleResponse = await handleGet(componentStatusRequest(), root)
    stale = await staleResponse.json()

    const rebasedResponse = await handlePost(request('POST', {
      kind: 'environment-rebase', file: SOURCE_FILE,
      expectedRevision: stale.expectedRevision,
      expectedSourceHashes: stale.sourceHashes,
      expectedEnvironmentFingerprint: stale.environmentFingerprint,
    }), root)
    expect(rebasedResponse.status).toBe(200)
    const rebased = await rebasedResponse.json()
    expect(rebased).toMatchObject({ kind: 'environment-rebased', graph: { revision: beforeDrift.graph.revision + 1 } })
    expect(rebased.graph.sourceHashes).toEqual(beforeDrift.graph.sourceHashes)
    expect(rebased.graph.environmentFingerprint).toBe(stale.environmentFingerprint)
    await expect(fs.readFile(path.join(root, SOURCE_FILE))).resolves.toEqual(authoredBytes)

    const loaded = await (await handleGet(componentRequest(), root)).json()
    expect(loaded.canUndo).toBe(true)
    const undo = await handlePost(request('POST', {
      kind: 'undo', expectedRevision: loaded.graph.revision, expectedSourceHashes: loaded.sourceHashes,
    }), root)
    expect(undo.status).toBe(200)
    await expect(undo.json()).resolves.toMatchObject({
      undoneCommand: { kind: 'create-variant', commandId: 'before-environment-rebase' },
    })
  }, 20_000)

  it('refuses type-invalid source revalidation before sidecar, history, or transaction writes', async () => {
    const root = await makeRoot()
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000001',
    }), root)
    const loaded = await (await handleGet(componentRequest(), root)).json()
    await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'create-variant', commandId: 'before-invalid-revalidation', componentId: loaded.componentId, displayName: 'Created' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)

    const sourcePath = path.join(root, SOURCE_FILE)
    const validSource = await fs.readFile(sourcePath, 'utf8')
    expect(validSource).toContain('"variant":"Secondary"')
    const invalidSource = validSource.replace('"variant":"Secondary"', '"variant":1')
    await fs.writeFile(sourcePath, invalidSource)
    const sidecarPath = path.join(root, PROJECT_AUTHORING_SIDECAR)
    const journalPath = path.join(root, authoringMetadataPath('project', 'history/journal.ndjson'))
    const transactionsPath = path.join(root, authoringMetadataPath('project', 'transactions'))
    const beforeSidecar = await fs.readFile(sidecarPath)
    const beforeJournal = await fs.readFile(journalPath)
    const beforeTransactions = (await fs.readdir(transactionsPath)).sort()

    const stale = await (await handleGet(componentStatusRequest(), root)).json()
    expect(stale).toMatchObject({ authoringState: 'source-stale', expectedRevision: 2 })
    const response = await handlePost(request('POST', {
      kind: 'revalidate-source',
      file: SOURCE_FILE,
      expectedRevision: stale.expectedRevision,
      expectedSourceHashes: stale.sourceHashes,
    }), root)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ code: 'STAGED_TYPECHECK_FAILED' })
    await expect(fs.readFile(sourcePath, 'utf8')).resolves.toBe(invalidSource)
    await expect(fs.readFile(sidecarPath)).resolves.toEqual(beforeSidecar)
    await expect(fs.readFile(journalPath)).resolves.toEqual(beforeJournal)
    expect((await fs.readdir(transactionsPath)).sort()).toEqual(beforeTransactions)
  }, 20_000)

  it('refuses type-valid structural drift before sidecar, history, or transaction writes', async () => {
    const root = await makeRoot()
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000003',
    }), root)
    const sourcePath = path.join(root, SOURCE_FILE)
    const changedSource = singleAxisSource.replace(
      'return <button>{variant}</button>',
      'return <section><button>{variant}</button></section>',
    )
    await fs.writeFile(sourcePath, changedSource)
    const stale = await (await handleGet(componentStatusRequest(), root)).json()
    expect(stale).toMatchObject({ authoringState: 'source-stale', expectedRevision: 1 })
    const sidecarPath = path.join(root, PROJECT_AUTHORING_SIDECAR)
    const journalPath = path.join(root, authoringMetadataPath('project', 'history/journal.ndjson'))
    const transactionsPath = path.join(root, authoringMetadataPath('project', 'transactions'))
    const beforeSidecar = await fs.readFile(sidecarPath)
    const beforeJournal = await fs.readFile(journalPath)
    const beforeTransactions = (await fs.readdir(transactionsPath)).sort()

    const response = await handlePost(request('POST', {
      kind: 'revalidate-source', file: SOURCE_FILE,
      expectedRevision: stale.expectedRevision,
      expectedSourceHashes: stale.sourceHashes,
    }), root)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ code: 'SOURCE_PROJECTION_DRIFT' })
    await expect(fs.readFile(sourcePath, 'utf8')).resolves.toBe(changedSource)
    await expect(fs.readFile(sidecarPath)).resolves.toEqual(beforeSidecar)
    await expect(fs.readFile(journalPath)).resolves.toEqual(beforeJournal)
    expect((await fs.readdir(transactionsPath)).sort()).toEqual(beforeTransactions)
  }, 20_000)

  it('refuses CSS cascade-order drift before sidecar, history, or transaction writes', async () => {
    const root = await makeRoot(`import styles from './Button.module.css'
export function Button() { return <button className={styles.base} /> }
`)
    const cssFile = 'src/app/(dev)/react-figma-components/Button.module.css'
    const cssPath = path.join(root, cssFile)
    await fs.writeFile(cssPath, '.base{}.base:hover{margin:0;margin-left:1px}\n')
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000008',
    }), root)
    await fs.writeFile(cssPath, '.base{}.base:hover{margin-left:1px;margin:0}\n')
    const stale = await (await handleGet(componentStatusRequest(), root)).json()
    expect(stale).toMatchObject({ authoringState: 'source-stale', changedPaths: [cssFile] })
    const sidecarPath = path.join(root, PROJECT_AUTHORING_SIDECAR)
    const journalPath = path.join(root, authoringMetadataPath('project', 'history/journal.ndjson'))
    const transactionsPath = path.join(root, authoringMetadataPath('project', 'transactions'))
    const beforeSidecar = await fs.readFile(sidecarPath)
    const beforeJournal = await fs.readFile(journalPath)
    const beforeTransactions = (await fs.readdir(transactionsPath)).sort()

    const response = await handlePost(request('POST', {
      kind: 'revalidate-source', file: SOURCE_FILE,
      expectedRevision: stale.expectedRevision,
      expectedSourceHashes: stale.sourceHashes,
    }), root)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ code: 'SOURCE_PROJECTION_DRIFT' })
    await expect(fs.readFile(sidecarPath)).resolves.toEqual(beforeSidecar)
    await expect(fs.readFile(journalPath)).resolves.toEqual(beforeJournal)
    expect((await fs.readdir(transactionsPath)).sort()).toEqual(beforeTransactions)
  }, 20_000)

  it.each([
    {
      label: 'base declaration',
      transactionId: '00000000-0000-4000-8000-000000000009',
      before: '.base { color: red }\n',
      after: '.base { color: blue }\n',
    },
    {
      label: 'nested media declaration',
      transactionId: '00000000-0000-4000-8000-000000000010',
      before: '.base { color: red }\n@media (min-width: 600px) { .base { padding: 8px } }\n',
      after: '.base { color: red }\n@media (min-width: 600px) { .base { padding: 16px } }\n',
    },
  ])('refuses $label drift before sidecar, history, or transaction writes', async ({ transactionId, before, after }) => {
    const root = await makeRoot(`import styles from './Button.module.css'
export function Button() { return <button className={styles.base} /> }
`)
    const cssFile = 'src/app/(dev)/react-figma-components/Button.module.css'
    const cssPath = path.join(root, cssFile)
    await fs.writeFile(cssPath, before)
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId,
    }), root)
    await fs.writeFile(cssPath, after)
    const stale = await (await handleGet(componentStatusRequest(), root)).json()
    expect(stale).toMatchObject({ authoringState: 'source-stale', changedPaths: [cssFile] })
    const sidecarPath = path.join(root, PROJECT_AUTHORING_SIDECAR)
    const journalPath = path.join(root, authoringMetadataPath('project', 'history/journal.ndjson'))
    const transactionsPath = path.join(root, authoringMetadataPath('project', 'transactions'))
    const beforeSidecar = await fs.readFile(sidecarPath)
    const beforeJournal = await fs.readFile(journalPath)
    const beforeTransactions = (await fs.readdir(transactionsPath)).sort()

    const response = await handlePost(request('POST', {
      kind: 'revalidate-source', file: SOURCE_FILE,
      expectedRevision: stale.expectedRevision,
      expectedSourceHashes: stale.sourceHashes,
    }), root)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ code: 'SOURCE_PROJECTION_DRIFT' })
    await expect(fs.readFile(cssPath, 'utf8')).resolves.toBe(after)
    await expect(fs.readFile(sidecarPath)).resolves.toEqual(beforeSidecar)
    await expect(fs.readFile(journalPath)).resolves.toEqual(beforeJournal)
    expect((await fs.readdir(transactionsPath)).sort()).toEqual(beforeTransactions)
  }, 20_000)

  it('upgrades a legacy projection fingerprint only while authored hashes still match', async () => {
    const source = `import styles from './Button.module.css'
export function Button() { return <button className={styles.base} /> }
`
    const cssFile = 'src/app/(dev)/react-figma-components/Button.module.css'
    const beforeCss = '.base { color: red }\n'
    const root = await makeRoot(source)
    const cssPath = path.join(root, cssFile)
    await fs.writeFile(cssPath, beforeCss)
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000011',
    }), root)
    const projection = await sourceProjectionFromSource({
      file: SOURCE_FILE,
      source,
      cssSources: { [cssFile]: beforeCss },
    })
    const sidecarPath = path.join(root, PROJECT_AUTHORING_SIDECAR)
    const legacy = JSON.parse(await fs.readFile(sidecarPath, 'utf8')) as Record<string, unknown>
    const components = legacy.components as Record<string, { id: string; primaryVariantId: string; projectionFingerprint: string }>
    const component = Object.values(components)[0]!
    component.projectionFingerprint = legacySourceProjectionFingerprint(projection)
    await fs.writeFile(sidecarPath, JSON.stringify(legacy, null, 2) + '\n')
    const legacySidecar = await fs.readFile(sidecarPath)

    await fs.writeFile(cssPath, '.base { color: blue }\n')
    const stale = await (await handleGet(componentStatusRequest(), root)).json()
    const refused = await handlePost(request('POST', {
      kind: 'revalidate-source', file: SOURCE_FILE,
      expectedRevision: stale.expectedRevision,
      expectedSourceHashes: stale.sourceHashes,
    }), root)
    expect(refused.status).toBe(422)
    await expect(refused.json()).resolves.toMatchObject({ code: 'SOURCE_PROJECTION_DRIFT' })
    await expect(fs.readFile(sidecarPath)).resolves.toEqual(legacySidecar)

    await fs.writeFile(cssPath, beforeCss)
    const loaded = await (await handleGet(componentRequest(), root)).json()
    const moved = await handlePost(request('POST', {
      kind: 'execute-command',
      command: {
        kind: 'move-variant', commandId: 'upgrade-css-fingerprint', componentId: component.id,
        variantId: component.primaryVariantId, frame: { x: 10, y: 20, width: 320, height: 180 },
      },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    expect(moved.status).toBe(200)
    const persisted = JSON.parse(await fs.readFile(sidecarPath, 'utf8')) as typeof legacy
    expect((persisted.components as typeof components)[component.id]!.projectionFingerprint)
      .toBe(sourceProjectionFingerprint(projection))
  }, 20_000)

  it('accepts formatting-only source drift while preserving the accepted projection', async () => {
    const root = await makeRoot()
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000004',
    }), root)
    const sourcePath = path.join(root, SOURCE_FILE)
    const formattedSource = singleAxisSource.replace(
      'return <button>{variant}</button>',
      'return (\n    <button>\n      {variant}\n    </button>\n  )',
    )
    await fs.writeFile(sourcePath, formattedSource)
    const stale = await (await handleGet(componentStatusRequest(), root)).json()
    expect(stale).toMatchObject({ authoringState: 'source-stale', expectedRevision: 1 })

    const response = await handlePost(request('POST', {
      kind: 'revalidate-source', file: SOURCE_FILE,
      expectedRevision: stale.expectedRevision,
      expectedSourceHashes: stale.sourceHashes,
    }), root)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ kind: 'revalidated', graph: { revision: 2 } })
    await expect(fs.readFile(sourcePath, 'utf8')).resolves.toBe(formattedSource)
  }, 20_000)

  it('rejects malformed and extra request fields before filesystem access', async () => {
    const response = await handlePost(request('POST', {
      kind: 'import-source',
      file: SOURCE_FILE,
      expectedSourceHashes: { [SOURCE_FILE]: 'not-a-hash' },
      extra: true,
    }), '/path/that/must/not/be-read')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'invalid authoring request' })
  })

  it('rejects malformed JSON as a 400 before filesystem access', async () => {
    const response = await handlePost(new Request('http://localhost/api/dev/editor-authoring', {
      method: 'POST',
      body: '{',
      headers: { 'content-type': 'application/json' },
    }), '/path/that/must/not/be-read')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'invalid authoring request' })
  })

  it('returns a named 409 and no sidecar when source changed after classification', async () => {
    const root = await makeRoot()
    const classified = await (await handleGet(request('GET'), root)).json()
    await fs.writeFile(path.join(root, SOURCE_FILE), singleAxisSource.replace('variant}</button>', 'changed}</button>'))

    const response = await handlePost(request('POST', {
      kind: 'import-source',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000001',
    }), root)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'SOURCE_HASH_STALE', changedPaths: [SOURCE_FILE] })
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('holds multi-axis source without writing a sidecar', async () => {
    const root = await makeRoot(`export function Button({ variant = 'Primary', size = 'sm' }: {
  variant?: 'Primary' | 'Secondary'; size?: 'sm' | 'lg'
}) { return <button>{variant}{size}</button> }
`)
    const classified = await (await handleGet(request('GET'), root)).json()
    const response = await handlePost(request('POST', {
      kind: 'import-source',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000001',
    }), root)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ kind: 'hold', compatibility: 'legacy-multi-axis' })
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps the production handlers dev-only', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const response = await GET(request('GET'))
    expect(response.status).toBe(403)
  })

  it('loads and persists create, rename, and move through the strict G2 command route', async () => {
    const root = await makeRoot()
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', {
      kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes,
      expectedEnvironmentFingerprint: classified.environmentFingerprint,
      transactionId: '00000000-0000-4000-8000-000000000001',
    }), root)

    let loaded = await (await handleGet(componentRequest(), root)).json()
    const componentId = loaded.componentId as string
    const create = await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'create-variant', commandId: 'route-create', componentId, displayName: 'New Variant' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    expect(create.status).toBe(200)
    const created = await create.json()
    expect(created.sourceChanged).toBe(true)
    const variant = Object.values(created.graph.variants as Record<string, { id: string; displayName: string }>).find((entry) => entry.displayName === 'New Variant')!
    const frameBeforeMove = (created.graph.variants as Record<string, { frame: { x: number; y: number } }>)[variant.id]!.frame

    loaded = await (await handleGet(componentRequest(), root)).json()
    const rename = await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'rename-variant', commandId: 'route-rename', componentId, variantId: variant.id, displayName: 'Renamed' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    expect(rename.status).toBe(200)
    await expect(rename.json()).resolves.toMatchObject({ sourceChanged: false })

    loaded = await (await handleGet(componentRequest(), root)).json()
    const move = await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'move-variant', commandId: 'route-move', componentId, variantId: variant.id, frame: { x: 80, y: 40, width: 320, height: 180 } },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    expect(move.status).toBe(200)
    await expect(move.json()).resolves.toMatchObject({ sourceChanged: false, graph: { revision: 4, variants: { [variant.id]: { id: variant.id, displayName: 'Renamed', frame: { x: 80, y: 40 } } } } })

    loaded = await (await handleGet(componentRequest(), root)).json()
    expect(loaded.canUndo).toBe(true)
    const undo = await handlePost(request('POST', {
      kind: 'undo',
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    expect(undo.status).toBe(200)
    await expect(undo.json()).resolves.toMatchObject({
      graph: { revision: 5, variants: { [variant.id]: { frame: frameBeforeMove } } },
      undoneCommand: { kind: 'move-variant', commandId: 'route-move' },
    })
  }, 20_000)

  it('rejects malformed G2 command keys and geometry before filesystem access', async () => {
    const response = await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'move-variant', commandId: 'bad', componentId: 'component_x', variantId: 'variant_x', frame: { x: 0, y: 0, width: Number.NaN, height: 1 }, extra: true },
      expectedRevision: 1,
      expectedSourceHashes: { [SOURCE_FILE]: 'a'.repeat(64) },
    }), '/path/that/must/not-be-read')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'invalid authoring request' })

    const invalidName = await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'create-variant', commandId: 'bad id', componentId: 'component_x', displayName: '   ' },
      expectedRevision: 1,
      expectedSourceHashes: { [SOURCE_FILE]: 'a'.repeat(64) },
    }), '/path/that/must/not-be-read')
    expect(invalidName.status).toBe(400)

    const invalidUndo = await handlePost(request('POST', {
      kind: 'undo',
      expectedRevision: 1,
      expectedSourceHashes: { [SOURCE_FILE]: 'a'.repeat(64) },
      extra: true,
    }), '/path/that/must/not-be-read')
    expect(invalidUndo.status).toBe(400)

    const invalidRevalidation = await handlePost(request('POST', {
      kind: 'revalidate-source',
      file: SOURCE_FILE,
      expectedRevision: 1,
      expectedSourceHashes: {},
    }), '/path/that/must/not-be-read')
    expect(invalidRevalidation.status).toBe(400)
  })
})
