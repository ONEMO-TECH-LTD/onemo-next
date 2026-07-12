import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'

import { assertStagedTypeScriptSemantics, projectVariantRegistry } from './authoring-compiler'
import { compilerEnvironmentFingerprint, EMPTY_ENVIRONMENT_FINGERPRINT, isGeneratedCompilerEnvironmentFile } from './authoring-environment'
import { AuthoringHistoryStore, type AuthoringCommandHistoryRecord } from './authoring-history'
import { readExactAuthoringSourceSnapshot, type ExactAuthoringSourceSnapshot } from './authoring-import'
import { migrateAuthoringGraphV1 } from './authoring-migrations'
import { assertAuthoringGraphV1, isSha256, isStoreRelativePath } from './authoring-schema'
import { AuthoringSidecarStore } from './authoring-store'
import { discoverSingleRootRecoveryDecisions, SingleRootAuthoringTransaction, type SingleRootTransactionRecord } from './authoring-transaction'
import type { StoreId } from './authoring-types'
import { sha256 } from './durable-file-installer'
import { RuntimeRootRegistry } from './runtime-root-registry'
import { sourceProjectionFingerprint, sourceProjectionFromSource } from './source-projection'

const VALIDATION_ONLY_FINGERPRINT = '0'.repeat(64)

export async function migrateAuthoringSidecarOnLoad(input: {
  storeId: StoreId
  registry: RuntimeRootRegistry
  store: AuthoringSidecarStore
}): Promise<void> {
  const raw = await input.store.loadRawSnapshot()
  if (!raw || graphVersion(raw.value) === 2) return
  if (graphVersion(raw.value) !== 1) {
    throw namedError('AUTHORING_MIGRATION_INPUT_INVALID', 'authoring sidecar schema version is unsupported', 422)
  }
  const history = new AuthoringHistoryStore(input.registry, input.storeId)
  await new SingleRootAuthoringTransaction({
    transactionId: `schema-v1-v2-${randomUUID()}`,
    storeId: input.storeId,
    registry: input.registry,
    store: input.store,
  }).commitLegacyMigration(async (legacy) => {
    if (graphVersion(legacy) === 2) return null
    const validatedLegacy = validateLegacyGraphShape(legacy)
    if (validatedLegacy.graph.storeId !== input.storeId || validatedLegacy.graph.root.kind !== input.registry.get(input.storeId).kind) {
      throw namedError('AUTHORING_MIGRATION_INPUT_INVALID', 'legacy sidecar store identity does not match the registered root', 409)
    }
    const components = validatedLegacy.graph.components
    const sourceHashes = validatedLegacy.authoredSourceHashes
    const projectionFingerprints: Record<string, string> = {}
    const currentSourceHashes: Record<string, string> = {}
    const environmentHashes: Record<string, string> = {}
    const snapshots = new Map<string, ExactAuthoringSourceSnapshot>()
    for (const [componentId, value] of Object.entries(components)) {
      const source = value.source
      const snapshot = await readExactAuthoringSourceSnapshot({
        storeId: input.storeId,
        file: source.file,
        registry: input.registry,
      })
      if (snapshot.projection.compatibility === 'unsupported' || snapshot.projection.exportName !== source.exportName) {
        throw namedError('AUTHORING_MIGRATION_PROJECTION_UNSUPPORTED', `cannot re-derive component projection: ${componentId}`, 422)
      }
      Object.assign(currentSourceHashes, snapshot.sourceHashes)
      Object.assign(environmentHashes, snapshot.environmentHashes)
      projectionFingerprints[componentId] = sourceProjectionFingerprint(snapshot.projection)
      snapshots.set(componentId, snapshot)
    }
    if (validatedLegacy.hadEnvironmentFingerprint) {
      assertExactHashes(sourceHashes, currentSourceHashes, 'AUTHORING_MIGRATION_SOURCE_STALE')
    } else {
      assertHashSubset(sourceHashes, currentSourceHashes, 'AUTHORING_MIGRATION_SOURCE_STALE')
    }
    const environmentFingerprint = compilerEnvironmentFingerprint(environmentHashes)
    if (validatedLegacy.hadEnvironmentFingerprint && environmentFingerprint !== validatedLegacy.graph.environmentFingerprint) {
      throw namedError('AUTHORING_MIGRATION_ENVIRONMENT_STALE', 'compiler environment changed before schema migration', 409)
    }
    const graph = migrateAuthoringGraphV1({
      graph: legacy,
      projectionFingerprints,
      sourceHashes: currentSourceHashes,
      environmentFingerprint,
    })
    const projectRoot = input.registry.get(input.storeId).canonicalRealPath
    for (const [componentId, snapshot] of snapshots) {
      const component = graph.components[componentId]!
      assertStagedTypeScriptSemantics(
        component.source.file,
        snapshot.sources[component.source.file]!,
        projectRoot,
        snapshot.compilerOptions,
        snapshot.sources,
      )
      projectVariantRegistry(graph, component, snapshot.projection)
    }
    const historicalSources = new Map<string, string>()
    for (const snapshot of snapshots.values()) {
      for (const file of Object.keys(snapshot.sourceHashes)) {
        const bytes = snapshot.sources[file]
        if (bytes !== undefined) historicalSources.set(file, bytes)
      }
    }
    const committedTransactions = await committedTransactionRecords(input.storeId, input.registry)
    const metadataPatches = await history.planSchemaMigration({
      command: { kind: 'schema-migration', from: 1, to: 2 },
      sourceFiles: Object.keys(currentSourceHashes),
      graphPreimage: Buffer.from(JSON.stringify(graph, null, 2) + '\n'),
      revision: graph.revision + 1,
      migrateGraphPreimage: (record, bytes) => migrateHistoryGraphPreimage({
        record, bytes, storeId: input.storeId, registry: input.registry, history, snapshots, historicalSources,
      }),
      rewindUndo: (record) => rewindUndoFromTransaction({
        record,
        transaction: committedTransactions.get(record.revision),
        storeId: input.storeId,
        registry: input.registry,
        historicalSources,
      }),
    })
    return {
      graph,
      update: {
        expectedRevision: graph.revision,
        expectedSourceHashes: currentSourceHashes,
        expectedEnvironmentHashes: environmentHashes,
        expectedEnvironmentFingerprint: environmentFingerprint,
        sourceFiles: Object.keys(currentSourceHashes),
        metadataPatches,
        command: { kind: 'schema-migration', from: 1, to: 2 },
      },
    }
  })
}

async function committedTransactionRecords(
  storeId: StoreId,
  registry: RuntimeRootRegistry,
): Promise<Map<number, SingleRootTransactionRecord>> {
  const records = new Map<number, SingleRootTransactionRecord>()
  for (const decision of await discoverSingleRootRecoveryDecisions({ storeId, registry })) {
    if (decision.decision !== 'ignore-committed') continue
    if (records.has(decision.record.afterRevision)) {
      throw namedError('AUTHORING_MIGRATION_HISTORY_INVALID', `duplicate committed revision: ${decision.record.afterRevision}`, 409)
    }
    records.set(decision.record.afterRevision, decision.record)
  }
  return records
}

async function rewindUndoFromTransaction(input: {
  record: { undoneJournalIndex: number; restoredFiles: string[]; revision: number }
  transaction: SingleRootTransactionRecord | undefined
  storeId: StoreId
  registry: RuntimeRootRegistry
  historicalSources: Map<string, string>
}): Promise<void> {
  if (input.record.restoredFiles.length === 0) return
  const command = input.transaction?.command
  if (!input.transaction || !command || typeof command !== 'object' || Array.isArray(command) ||
      (command as Record<string, unknown>).kind !== 'undo' ||
      (command as Record<string, unknown>).undoneJournalIndex !== input.record.undoneJournalIndex) {
    throw namedError(
      'AUTHORING_MIGRATION_HISTORY_SOURCE_UNAVAILABLE',
      `committed undo transaction evidence is unavailable at revision ${input.record.revision}`,
      409,
    )
  }
  const expected = [...input.record.restoredFiles].sort()
  const actual = input.transaction.files.map((image) => image.file).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw namedError('AUTHORING_MIGRATION_HISTORY_INVALID', `undo transaction files disagree at revision ${input.record.revision}`, 409)
  }
  for (const image of input.transaction.files) {
    if (!image.before) {
      input.historicalSources.delete(image.file)
      continue
    }
    const abs = await input.registry.resolveStorePath(input.storeId, image.before.path)
    const bytes = await fs.readFile(abs)
    if (sha256(bytes) !== image.before.sha256) {
      throw namedError('AUTHORING_MIGRATION_HISTORY_INVALID', `undo transaction blob hash mismatch: ${image.before.path}`, 409)
    }
    input.historicalSources.set(image.file, bytes.toString('utf8'))
  }
}

async function migrateHistoryGraphPreimage(input: {
  record: AuthoringCommandHistoryRecord
  bytes: string
  storeId: StoreId
  registry: RuntimeRootRegistry
  history: AuthoringHistoryStore
  snapshots: Map<string, ExactAuthoringSourceSnapshot>
  historicalSources: Map<string, string>
}): Promise<string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(input.bytes) as unknown
  } catch (error) {
    throw namedError('AUTHORING_MIGRATION_HISTORY_INVALID', `history graph preimage is not JSON: ${(error as Error).message}`, 422)
  }
  for (const preimage of input.record.preimages) {
    const bytes = await input.history.readPreimage(preimage)
    if (bytes === null) input.historicalSources.delete(preimage.file)
    else input.historicalSources.set(preimage.file, bytes)
  }
  if (graphVersion(parsed) === 2) {
    assertAuthoringGraphV1(parsed)
    return input.bytes
  }
  const graph = requireRecord(parsed, 'legacy history graph preimage')
  const validatedLegacy = validateLegacyGraphShape(graph)
  if (validatedLegacy.graph.storeId !== input.storeId || validatedLegacy.graph.root.kind !== input.registry.get(input.storeId).kind) {
    throw namedError('AUTHORING_MIGRATION_HISTORY_INVALID', 'legacy history graph store identity is invalid', 422)
  }
  const sourceHashes = validatedLegacy.authoredSourceHashes
  for (const [file, expectedHash] of Object.entries(sourceHashes)) {
    const historical = input.historicalSources.get(file)
    if (historical === undefined || sha256(historical) !== expectedHash) {
      throw namedError('AUTHORING_MIGRATION_HISTORY_SOURCE_UNAVAILABLE', `historical source bytes are unavailable: ${file}`, 409)
    }
  }
  const expandedSourceHashes: Record<string, string> = {}
  for (const snapshot of input.snapshots.values()) {
    for (const file of Object.keys(snapshot.sourceHashes)) {
      const historical = input.historicalSources.get(file)
      if (historical === undefined) {
        throw namedError('AUTHORING_MIGRATION_HISTORY_SOURCE_UNAVAILABLE', `historical source bytes are unavailable: ${file}`, 409)
      }
      expandedSourceHashes[file] = sha256(historical)
    }
  }
  const components = validatedLegacy.graph.components
  const cssSources = Object.fromEntries([...input.historicalSources].filter(([file]) => file.endsWith('.css')))
  const projectionFingerprints: Record<string, string> = {}
  for (const [componentId, value] of Object.entries(components)) {
    const source = value.source
    const sourceBytes = input.historicalSources.get(source.file)
    if (sourceBytes === undefined) {
      throw namedError('AUTHORING_MIGRATION_HISTORY_SOURCE_UNAVAILABLE', `historical component source is unavailable: ${source.file}`, 409)
    }
    const projection = await sourceProjectionFromSource({ file: source.file, source: sourceBytes, cssSources })
    if (projection.compatibility === 'unsupported' || projection.exportName !== source.exportName) {
      throw namedError('AUTHORING_MIGRATION_HISTORY_INVALID', `historical component projection cannot be re-derived: ${componentId}`, 422)
    }
    projectionFingerprints[componentId] = sourceProjectionFingerprint(projection)
  }
  const environmentHashes = Object.assign({}, ...[...input.snapshots.values()].map((snapshot) => snapshot.environmentHashes))
  const environmentFingerprint = compilerEnvironmentFingerprint(environmentHashes)
  const migrated = migrateAuthoringGraphV1({
    graph,
    projectionFingerprints,
    sourceHashes: expandedSourceHashes,
    environmentFingerprint,
  })
  const projectRoot = input.registry.get(input.storeId).canonicalRealPath
  for (const [componentId, component] of Object.entries(migrated.components)) {
    const snapshot = input.snapshots.get(componentId)
    if (!snapshot) throw namedError('AUTHORING_MIGRATION_HISTORY_SOURCE_UNAVAILABLE', `compiler snapshot is unavailable: ${componentId}`, 409)
    const source = input.historicalSources.get(component.source.file)!
    const dependencies = { ...snapshot.sources, ...Object.fromEntries(input.historicalSources) }
    assertStagedTypeScriptSemantics(component.source.file, source, projectRoot, snapshot.compilerOptions, dependencies)
    const projection = await sourceProjectionFromSource({ file: component.source.file, source, cssSources })
    projectVariantRegistry(migrated, component, projection)
  }
  return JSON.stringify(migrated, null, 2) + '\n'
}

function graphVersion(value: unknown): unknown {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>).schemaVersion
    : undefined
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw namedError('AUTHORING_MIGRATION_INPUT_INVALID', `${label} must be an object`, 422)
  }
  return value as Record<string, unknown>
}

function validateLegacyGraphShape(graph: unknown): {
  graph: ReturnType<typeof migrateAuthoringGraphV1>
  authoredSourceHashes: Record<string, string>
  hadEnvironmentFingerprint: boolean
} {
  const record = requireRecord(graph, 'legacy authoring graph')
  const components = requireRecord(record.components, 'legacy components')
  const rawSourceHashes = requireRecord(record.sourceHashes, 'legacy sourceHashes')
  const sourceHashes: Record<string, string> = {}
  for (const [file, hash] of Object.entries(rawSourceHashes)) {
    if (!isStoreRelativePath(file) || !isSha256(hash)) {
      throw namedError('AUTHORING_MIGRATION_INPUT_INVALID', `legacy source hash is invalid: ${file}`, 422)
    }
    sourceHashes[file] = hash
  }
  const authoredSourceHashes = Object.fromEntries(
    Object.entries(sourceHashes).filter(([file]) => !isGeneratedCompilerEnvironmentFile(file)),
  )
  const hadEnvironmentFingerprint = Object.hasOwn(record, 'environmentFingerprint')
  if (hadEnvironmentFingerprint && !isSha256(record.environmentFingerprint)) {
    throw namedError('AUTHORING_MIGRATION_INPUT_INVALID', 'legacy environment fingerprint is invalid', 422)
  }
  const projectionFingerprints = Object.fromEntries(
    Object.keys(components).map((componentId) => [componentId, VALIDATION_ONLY_FINGERPRINT]),
  )
  return {
    graph: migrateAuthoringGraphV1({
      graph,
      projectionFingerprints,
      sourceHashes: authoredSourceHashes,
      environmentFingerprint: hadEnvironmentFingerprint
        ? record.environmentFingerprint as string
        : EMPTY_ENVIRONMENT_FINGERPRINT,
    }),
    authoredSourceHashes,
    hadEnvironmentFingerprint,
  }
}

function assertExactHashes(expected: Record<string, string>, actual: Record<string, string>, code: string): void {
  const paths = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
  const changedPaths = paths.filter((file) => expected[file] !== actual[file])
  if (changedPaths.length > 0) {
    throw Object.assign(new Error(`migration source hash mismatch: ${changedPaths.join(', ')}`), {
      code, status: 409, changedPaths,
    })
  }
}

function assertHashSubset(expected: Record<string, string>, actual: Record<string, string>, code: string): void {
  const changedPaths = Object.keys(expected).filter((file) => actual[file] !== expected[file]).sort()
  if (changedPaths.length > 0) {
    throw Object.assign(new Error(`migration source hash mismatch: ${changedPaths.join(', ')}`), {
      code, status: 409, changedPaths,
    })
  }
}

function namedError(code: string, message: string, status: number): Error {
  return Object.assign(new Error(message), { code, status })
}
