import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'

import { AuthoringHistoryStore } from './authoring-history'
import { importProjectionToAuthoringGraph, type ProjectionImportResult } from './authoring-migrations'
import { AuthoringSidecarStore, createEmptyAuthoringGraph } from './authoring-store'
import { SingleRootAuthoringTransaction } from './authoring-transaction'
import type { StoreId } from './authoring-types'
import { sha256 } from './durable-file-installer'
import { parseComponentModelFromSource } from './lib'
import { RuntimeRootRegistry } from './runtime-root-registry'
import { extractSourceAnchorsFromTsx } from './source-anchor'
import { sourceProjectionFromModel, type SourceProjection, unsupportedSourceProjection } from './source-projection'

export type SourceImportClassification = {
  projection: SourceProjection
  sourceHashes: Record<string, string>
}

export async function classifySourceFileForImport(input: {
  storeId: StoreId
  file: string
  registry: RuntimeRootRegistry
}): Promise<SourceImportClassification> {
  const sources = new Map<string, Buffer>()
  const sourceAbs = await input.registry.resolveStorePath(input.storeId, input.file)
  sources.set(input.file, await fs.readFile(sourceAbs))
  const cssSources: Record<string, string> = {}
  let projection: SourceProjection

  for (;;) {
    try {
      const source = sources.get(input.file)!.toString('utf8')
      const model = await parseComponentModelFromSource({ file: input.file, source, cssSources })
      projection = sourceProjectionFromModel(input.file, model, extractSourceAnchorsFromTsx({
        file: input.file,
        source,
        exportName: model.name,
      }))
      break
    } catch (error) {
      const dependency = (error as { code?: unknown; dependency?: unknown }).code === 'SOURCE_DEPENDENCY_REQUIRED'
        ? (error as { dependency?: unknown }).dependency
        : undefined
      if (typeof dependency !== 'string' || sources.has(dependency)) {
        projection = unsupportedSourceProjection(input.file, (error as Error).message)
        break
      }
      try {
        const dependencyAbs = await input.registry.resolveStorePath(input.storeId, dependency)
        const dependencyBytes = await fs.readFile(dependencyAbs)
        sources.set(dependency, dependencyBytes)
        cssSources[dependency] = dependencyBytes.toString('utf8')
      } catch (dependencyError) {
        projection = unsupportedSourceProjection(input.file, `source dependency unavailable: ${dependency}: ${(dependencyError as Error).message}`)
        break
      }
    }
  }

  return {
    projection,
    sourceHashes: Object.fromEntries([...sources].map(([file, bytes]) => [file, sha256(bytes)])),
  }
}

export async function importSourceFileToAuthoringStore(input: {
  storeId: StoreId
  file: string
  expectedSourceHashes: Record<string, string>
  registry: RuntimeRootRegistry
  store: AuthoringSidecarStore
}): Promise<ProjectionImportResult> {
  if (input.registry.get(input.storeId).kind !== 'project') {
    throw namedError('IMPORT_ROOT_UNSUPPORTED', 'G1 source import supports the project root only', 422)
  }
  if (await input.store.load()) {
    throw namedError('AUTHORING_SIDECAR_EXISTS', 'source import requires a missing authoring sidecar', 409)
  }
  const classified = await classifySourceFileForImport(input)
  assertExpectedHashes(input.expectedSourceHashes, classified.sourceHashes)
  const imported = importProjectionToAuthoringGraph({
    storeId: input.storeId,
    projection: classified.projection,
    sourceHashes: classified.sourceHashes,
  })
  if (imported.kind !== 'imported') return imported

  const graphPreimage = createEmptyAuthoringGraph({
    storeId: input.storeId,
    rootKind: input.registry.get(input.storeId).kind,
    sourceHashes: classified.sourceHashes,
  })
  const history = new AuthoringHistoryStore(input.registry, input.storeId)
  const metadataPatches = await history.planCommand({
    command: { kind: 'import-legacy-component', file: input.file },
    sourceFiles: Object.keys(classified.sourceHashes),
    sourcePreimages: [],
    graphPreimage: JSON.stringify(graphPreimage, null, 2) + '\n',
    revision: 1,
  })
  const committed = await new SingleRootAuthoringTransaction({
    transactionId: `import-${randomUUID()}`,
    storeId: input.storeId,
    registry: input.registry,
    store: input.store,
  }).commit({
    expectedRevision: 0,
    expectedSourceHashes: input.expectedSourceHashes,
    sourceFiles: Object.keys(classified.sourceHashes),
    metadataPatches,
    command: { kind: 'import-legacy-component', file: input.file },
    mutate: () => imported.graph,
  })
  return { kind: 'imported', graph: committed }
}

function assertExpectedHashes(expected: Record<string, string>, actual: Record<string, string>): void {
  const paths = new Set([...Object.keys(expected), ...Object.keys(actual)])
  const changedPaths = [...paths].filter((file) => expected[file] !== actual[file]).sort()
  if (changedPaths.length > 0) {
    throw Object.assign(new Error(`source hash mismatch: ${changedPaths.join(', ')}`), {
      code: 'SOURCE_HASH_STALE',
      status: 409,
      changedPaths,
    })
  }
}

function namedError(code: string, message: string, status: number) {
  return Object.assign(new Error(message), { code, status })
}
