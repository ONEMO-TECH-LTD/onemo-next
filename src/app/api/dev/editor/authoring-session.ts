import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'

import { compileG2VariantCommand, projectVariantRegistry, type CompilePlan } from './authoring-compiler'
import { parseG2VariantCommand, type G2VariantCommand } from './authoring-commands'
import { AuthoringHistoryStore } from './authoring-history'
import { readExactAuthoringSourceSnapshot } from './authoring-import'
import { assertAuthoringGraphV1 } from './authoring-schema'
import { AuthoringSidecarStore } from './authoring-store'
import { SingleRootAuthoringTransaction } from './authoring-transaction'
import type { AuthoringGraphV1, StoreId } from './authoring-types'
import { sha256 } from './durable-file-installer'
import { RuntimeRootRegistry } from './runtime-root-registry'

export class ProjectAuthoringSession {
  private readonly history: AuthoringHistoryStore

  constructor(private readonly input: {
    storeId: StoreId
    registry: RuntimeRootRegistry
    store: AuthoringSidecarStore
  }) {
    if (input.registry.get(input.storeId).kind !== 'project') {
      throw namedError('AUTHORING_ROOT_UNSUPPORTED', 'G2 session supports the project root only', 422)
    }
    this.history = new AuthoringHistoryStore(input.registry, input.storeId)
  }

  async loadComponent(file: string): Promise<{
    graph: AuthoringGraphV1
    componentId: string
    projection: Awaited<ReturnType<typeof readExactAuthoringSourceSnapshot>>['projection']
    sourceHashes: Record<string, string>
    variantProps: Record<string, Record<string, string | number | boolean | null>>
    canUndo: boolean
  }> {
    const graph = await this.requireGraph()
    const component = Object.values(graph.components).filter((candidate) => candidate.source.file === file)
    if (component.length !== 1) throw namedError('COMPONENT_SOURCE_AMBIGUOUS', `expected one component for ${file}`, 422)
    const snapshot = await readExactAuthoringSourceSnapshot({ storeId: this.input.storeId, file, registry: this.input.registry })
    assertExpectedHashes(graph.sourceHashes, snapshot.sourceHashes)
    return {
      graph,
      componentId: component[0]!.id,
      projection: snapshot.projection,
      sourceHashes: snapshot.sourceHashes,
      variantProps: Object.fromEntries(projectVariantRegistry(graph, component[0]!, snapshot.projection)
        .map((variant) => [variant.id, variant.props])),
      canUndo: await this.latestUndoableG2Command(graph.revision) !== null,
    }
  }

  async execute(input: {
    command: G2VariantCommand
    expectedRevision: number
    expectedSourceHashes: Record<string, string>
  }): Promise<{ graph: AuthoringGraphV1; plan: CompilePlan }> {
    const before = await this.requireGraph()
    const component = before.components[input.command.componentId]
    if (!component) throw namedError('COMPONENT_MISSING', `component not found: ${input.command.componentId}`, 404)
    const snapshot = await readExactAuthoringSourceSnapshot({
      storeId: this.input.storeId,
      file: component.source.file,
      registry: this.input.registry,
    })
    assertExactHashSet(input.expectedSourceHashes, snapshot.sourceHashes)
    const plan = await compileG2VariantCommand({
      graph: before,
      command: input.command,
      source: snapshot.sources[component.source.file]!,
      projectRoot: this.input.registry.get(this.input.storeId).canonicalRealPath,
      compilerOptions: snapshot.compilerOptions,
      cssSources: Object.fromEntries(Object.entries(snapshot.sources).filter(([file]) => file.endsWith('.css'))),
      dependencySources: Object.fromEntries(Object.entries(snapshot.sources).filter(([file]) => file !== component.source.file)),
    })
    const historyPatches = await this.history.planCommand({
      command: input.command,
      sourceFiles: Object.keys(snapshot.sourceHashes),
      sourcePreimages: plan.sourcePatches.map((patch) => ({ file: patch.file, bytes: patch.before })),
      graphPreimage: JSON.stringify(before, null, 2) + '\n',
      revision: input.expectedRevision + 1,
    })
    const committed = await new SingleRootAuthoringTransaction({
      transactionId: `g2-${randomUUID()}`,
      storeId: this.input.storeId,
      registry: this.input.registry,
      store: this.input.store,
    }).commit({
      expectedRevision: input.expectedRevision,
      expectedSourceHashes: input.expectedSourceHashes,
      sourceFiles: Object.keys(snapshot.sourceHashes),
      sourcePatches: plan.sourcePatches,
      metadataPatches: historyPatches,
      command: input.command,
      mutate: () => plan.graph,
    })
    return { graph: committed, plan }
  }

  async revalidateSource(input: {
    file: string
    expectedRevision: number
    expectedSourceHashes: Record<string, string>
  }): Promise<{ kind: 'revalidated'; graph: AuthoringGraphV1 }> {
    const before = await this.requireGraph()
    if (before.revision !== input.expectedRevision) {
      throw namedError('AUTHORING_REVISION_STALE', `expected revision ${input.expectedRevision}, found ${before.revision}`, 409)
    }
    const component = Object.values(before.components).filter((candidate) => candidate.source.file === input.file)
    if (component.length !== 1) throw namedError('COMPONENT_SOURCE_AMBIGUOUS', `expected one component for ${input.file}`, 422)
    const snapshot = await readExactAuthoringSourceSnapshot({
      storeId: this.input.storeId,
      file: input.file,
      registry: this.input.registry,
    })
    assertExactHashSet(input.expectedSourceHashes, snapshot.sourceHashes)
    projectVariantRegistry(before, component[0]!, snapshot.projection)
    const command = { kind: 'revalidate-source', file: input.file }
    const historyPatches = await this.history.planCommand({
      command,
      sourceFiles: Object.keys(snapshot.sourceHashes),
      sourcePreimages: [],
      graphPreimage: JSON.stringify(before, null, 2) + '\n',
      revision: before.revision + 1,
    })
    const graph = await new SingleRootAuthoringTransaction({
      transactionId: `g2-revalidate-${randomUUID()}`,
      storeId: this.input.storeId,
      registry: this.input.registry,
      store: this.input.store,
    }).commit({
      expectedRevision: input.expectedRevision,
      expectedSourceHashes: input.expectedSourceHashes,
      sourceFiles: Object.keys(snapshot.sourceHashes),
      metadataPatches: historyPatches,
      command,
      mutate: () => before,
    })
    return { kind: 'revalidated', graph }
  }

  async undo(input: {
    expectedRevision: number
    expectedSourceHashes: Record<string, string>
  }): Promise<{ graph: AuthoringGraphV1; undoneCommand: unknown; restoredFiles: string[] }> {
    const before = await this.requireGraph()
    if (before.revision !== input.expectedRevision) {
      throw namedError('AUTHORING_REVISION_STALE', `expected revision ${input.expectedRevision}, found ${before.revision}`, 409)
    }
    const latest = await this.latestUndoableG2Command(before.revision)
    if (!latest) throw namedError('UNDO_EMPTY', 'no authoring command to undo', 404)

    const sourceBytes = new Map<string, Buffer>()
    for (const file of latest.record.sourceFiles) {
      const abs = await this.input.registry.resolveStorePath(this.input.storeId, file)
      sourceBytes.set(file, await fs.readFile(abs))
    }
    const currentHashes = Object.fromEntries([...sourceBytes].map(([file, bytes]) => [file, sha256(bytes)]))
    assertExactHashSet(input.expectedSourceHashes, currentHashes)

    let graphPreimage: AuthoringGraphV1
    try {
      graphPreimage = assertAuthoringGraphV1(JSON.parse(await this.history.readBlob(latest.record.graphPreimage)) as unknown)
    } catch (error) {
      if ((error as { code?: string }).code) throw error
      throw namedError('UNDO_GRAPH_PREIMAGE_INVALID', 'undo graph preimage is invalid', 409)
    }
    const sourcePatches = await Promise.all(latest.record.preimages.map(async (preimage) => {
      const current = sourceBytes.get(preimage.file)
      if (!current) throw namedError('UNDO_HISTORY_INVALID', `undo preimage is outside its source set: ${preimage.file}`, 409)
      return { file: preimage.file, before: current, after: await this.history.readBlob(preimage) }
    }))
    const historyPatches = await this.history.planUndo({
      undoneJournalIndex: latest.index,
      restoredFiles: sourcePatches.map((patch) => patch.file),
      revision: before.revision + 1,
    })
    const committed = await new SingleRootAuthoringTransaction({
      transactionId: `g2-undo-${randomUUID()}`,
      storeId: this.input.storeId,
      registry: this.input.registry,
      store: this.input.store,
    }).commit({
      expectedRevision: input.expectedRevision,
      expectedSourceHashes: input.expectedSourceHashes,
      sourceFiles: latest.record.sourceFiles,
      sourcePatches,
      metadataPatches: historyPatches,
      command: { kind: 'undo', undoneJournalIndex: latest.index },
      mutate: () => graphPreimage,
    })
    return {
      graph: committed,
      undoneCommand: latest.record.command,
      restoredFiles: sourcePatches.map((patch) => patch.file),
    }
  }

  private async requireGraph(): Promise<AuthoringGraphV1> {
    const graph = await this.input.store.load()
    if (!graph) throw namedError('AUTHORING_GRAPH_MISSING', 'import the component source before authoring', 409)
    return graph
  }

  private async latestUndoableG2Command(expectedRevision: number) {
    return this.history.latestUndoableCommand(expectedRevision, (command) => parseG2VariantCommand(command) !== null)
  }
}

function assertExactHashSet(expected: Record<string, string>, actual: Record<string, string>): void {
  const expectedPaths = Object.keys(expected).sort()
  const actualPaths = Object.keys(actual).sort()
  if (JSON.stringify(expectedPaths) !== JSON.stringify(actualPaths)) {
    throw Object.assign(new Error('expected source hash set does not match parsed dependencies'), {
      code: 'SOURCE_HASH_SET_MISMATCH',
      status: 409,
      changedPaths: [...new Set([...expectedPaths, ...actualPaths])],
    })
  }
  assertExpectedHashes(expected, actual)
}

function assertExpectedHashes(expected: Record<string, string>, actual: Record<string, string>): void {
  const changedPaths = Object.keys(actual).filter((file) => expected[file] !== actual[file]).sort()
  if (changedPaths.length > 0) {
    throw Object.assign(new Error(`source hash mismatch: ${changedPaths.join(', ')}`), {
      code: 'SOURCE_HASH_STALE', status: 409, changedPaths,
    })
  }
}

function namedError(code: string, message: string, status: number): Error {
  return Object.assign(new Error(message), { code, status })
}
