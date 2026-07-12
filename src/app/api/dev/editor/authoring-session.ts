import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'

import { assertAcceptedSourceProjection, assertStagedTypeScriptSemantics, compileCreateComponentFromSelection, compileG2VariantCommand, projectVariantRegistry, type CompilePlan } from './authoring-compiler'
import { parseCreateComponentFromSelectionCommand, parseG2VariantCommand, type CreateComponentFromSelectionCommand, type G2VariantCommand } from './authoring-commands'
import { AuthoringHistoryStore } from './authoring-history'
import { readExactAuthoringSourceSnapshot } from './authoring-import'
import { assertAuthoringGraphV1 } from './authoring-schema'
import { AuthoringSidecarStore, createEmptyAuthoringGraph } from './authoring-store'
import { SingleRootAuthoringTransaction } from './authoring-transaction'
import type { AuthoringGraphV1, StoreId } from './authoring-types'
import { sha256 } from './durable-file-installer'
import { RuntimeRootRegistry } from './runtime-root-registry'
import { legacySourceProjectionFingerprint, sourceProjectionFingerprint, type SourceProjection } from './source-projection'

const COMPONENT_ROOT = 'src/app/(dev)/react-figma-components/'

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
    assertEnvironmentFingerprint(graph.environmentFingerprint, snapshot.environmentFingerprint)
    return {
      graph,
      componentId: component[0]!.id,
      projection: snapshot.projection,
      sourceHashes: graph.sourceHashes,
      variantProps: Object.fromEntries(projectVariantRegistry(graph, component[0]!, snapshot.projection)
        .map((variant) => [variant.id, variant.props])),
      canUndo: await this.latestUndoableAuthoringCommand(graph.revision) !== null,
    }
  }

  async createComponentFromSelection(input: {
    command: CreateComponentFromSelectionCommand
    transactionId: string
    expectedRevision: number
    expectedSourceHashes: Record<string, string>
    expectedEnvironmentFingerprint: string
  }): Promise<{ graph: AuthoringGraphV1; componentId: string; componentFile: string }> {
    const { existing, snapshot, before, expectedBeforeHashes } = await this.readCreateComponentContext(input.command)
    if (input.expectedEnvironmentFingerprint !== snapshot.environmentFingerprint) {
      throw namedError('ENVIRONMENT_FINGERPRINT_STALE', 'compiler environment changed after create preview', 409)
    }
    if (before.revision !== input.expectedRevision) {
      throw namedError('AUTHORING_REVISION_STALE', `expected revision ${input.expectedRevision}, found ${before.revision}`, 409)
    }
    assertExactHashSet(input.expectedSourceHashes, expectedBeforeHashes)

    const plan = await compileCreateComponentFromSelection({
      graph: before,
      command: input.command,
      consumerSource: snapshot.sources[input.command.file]!,
      sourceHashes: expectedBeforeHashes,
      environmentFingerprint: snapshot.environmentFingerprint,
      projectRoot: this.input.registry.get(this.input.storeId).canonicalRealPath,
      compilerOptions: snapshot.compilerOptions,
      dependencySources: snapshot.sources,
    })
    const committedCommand = {
      ...input.command,
      createdComponentId: plan.componentId,
      componentFile: plan.componentFile,
    }
    const historyPatches = await this.history.planCommand({
      command: committedCommand,
      sourceFiles: Object.keys(plan.graph.sourceHashes),
      sourcePreimages: plan.sourcePatches.map((patch) => ({ file: patch.file, bytes: patch.before })),
      graphPreimage: JSON.stringify(before, null, 2) + '\n',
      revision: before.revision + 1,
    })
    const committed = await new SingleRootAuthoringTransaction({
      transactionId: input.transactionId,
      storeId: this.input.storeId,
      registry: this.input.registry,
      store: this.input.store,
    }).commit({
      expectedRevision: input.expectedRevision,
      requireMissingSidecar: existing === null,
      expectedSourceHashes: input.expectedSourceHashes,
      expectedEnvironmentHashes: snapshot.environmentHashes,
      expectedEnvironmentFingerprint: snapshot.environmentFingerprint,
      sourceFiles: Object.keys(plan.graph.sourceHashes),
      sourcePatches: plan.sourcePatches,
      metadataPatches: historyPatches,
      command: committedCommand,
      mutate: () => plan.graph,
    })
    return { graph: committed, componentId: plan.componentId, componentFile: plan.componentFile }
  }

  async previewComponentFromSelection(command: CreateComponentFromSelectionCommand): Promise<{
    expectedRevision: number
    sourceHashes: Record<string, string>
    environmentFingerprint: string
    componentId: string
    componentFile: string
    expectedComponentHash: string
  }> {
    const { snapshot, before, expectedBeforeHashes } = await this.readCreateComponentContext(command)
    const plan = await compileCreateComponentFromSelection({
      graph: before,
      command,
      consumerSource: snapshot.sources[command.file]!,
      sourceHashes: expectedBeforeHashes,
      environmentFingerprint: snapshot.environmentFingerprint,
      projectRoot: this.input.registry.get(this.input.storeId).canonicalRealPath,
      compilerOptions: snapshot.compilerOptions,
      dependencySources: snapshot.sources,
    })
    return {
      expectedRevision: before.revision,
      sourceHashes: expectedBeforeHashes,
      environmentFingerprint: snapshot.environmentFingerprint,
      componentId: plan.componentId,
      componentFile: plan.componentFile,
      expectedComponentHash: plan.graph.sourceHashes[plan.componentFile]!,
    }
  }

  private async readCreateComponentContext(command: CreateComponentFromSelectionCommand) {
    const existing = await this.input.store.load()
    const snapshot = await readExactAuthoringSourceSnapshot({
      storeId: this.input.storeId,
      file: command.file,
      registry: this.input.registry,
    })
    const before = existing ?? createEmptyAuthoringGraph({
      storeId: this.input.storeId,
      rootKind: 'project',
      environmentFingerprint: snapshot.environmentFingerprint,
    })
    assertMatchingHashOverlap(before.sourceHashes, snapshot.sourceHashes)
    if (existing) assertEnvironmentFingerprint(before.environmentFingerprint, snapshot.environmentFingerprint)
    return {
      existing,
      snapshot,
      before,
      expectedBeforeHashes: { ...before.sourceHashes, ...snapshot.sourceHashes },
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
    assertExactHashSet(input.expectedSourceHashes, before.sourceHashes)
    assertExpectedHashes(before.sourceHashes, snapshot.sourceHashes)
    assertEnvironmentFingerprint(before.environmentFingerprint, snapshot.environmentFingerprint)
    const acceptedGraph = upgradeLegacyProjectionFingerprint(before, component.id, snapshot.projection)
    const plan = await compileG2VariantCommand({
      graph: acceptedGraph,
      command: input.command,
      source: snapshot.sources[component.source.file]!,
      projectRoot: this.input.registry.get(this.input.storeId).canonicalRealPath,
      compilerOptions: snapshot.compilerOptions,
      cssSources: Object.fromEntries(Object.entries(snapshot.sources).filter(([file]) => file.endsWith('.css'))),
      dependencySources: Object.fromEntries(Object.entries(snapshot.sources).filter(([file]) => file !== component.source.file)),
    })
    const historyPatches = await this.history.planCommand({
      command: input.command,
      sourceFiles: Object.keys(before.sourceHashes),
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
      expectedEnvironmentHashes: snapshot.environmentHashes,
      expectedEnvironmentFingerprint: snapshot.environmentFingerprint,
      sourceFiles: Object.keys(before.sourceHashes),
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
    const definition = component[0]!
    const snapshot = await readExactAuthoringSourceSnapshot({
      storeId: this.input.storeId,
      file: input.file,
      registry: this.input.registry,
    })
    assertExactHashSet(input.expectedSourceHashes, snapshot.sourceHashes)
    assertStagedTypeScriptSemantics(
      definition.source.file,
      snapshot.sources[definition.source.file]!,
      this.input.registry.get(this.input.storeId).canonicalRealPath,
      snapshot.compilerOptions,
      Object.fromEntries(Object.entries(snapshot.sources).filter(([file]) => file !== definition.source.file)),
    )
    projectVariantRegistry(before, definition, snapshot.projection)
    assertAcceptedSourceProjection(definition, snapshot.projection)
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
      expectedEnvironmentHashes: snapshot.environmentHashes,
      expectedEnvironmentFingerprint: snapshot.environmentFingerprint,
      sourceFiles: Object.keys(snapshot.sourceHashes),
      metadataPatches: historyPatches,
      command,
      mutate: () => before,
    })
    return { kind: 'revalidated', graph }
  }

  async rebaseEnvironment(input: {
    file: string
    expectedRevision: number
    expectedSourceHashes: Record<string, string>
    expectedEnvironmentFingerprint: string
  }): Promise<{ kind: 'environment-rebased'; graph: AuthoringGraphV1 }> {
    const before = await this.requireGraph()
    if (before.revision !== input.expectedRevision) {
      throw namedError('AUTHORING_REVISION_STALE', `expected revision ${input.expectedRevision}, found ${before.revision}`, 409)
    }
    const component = Object.values(before.components).filter((candidate) => candidate.source.file === input.file)
    if (component.length !== 1) throw namedError('COMPONENT_SOURCE_AMBIGUOUS', `expected one component for ${input.file}`, 422)
    const definition = component[0]!
    const snapshot = await readExactAuthoringSourceSnapshot({
      storeId: this.input.storeId,
      file: input.file,
      registry: this.input.registry,
    })
    assertExactHashSet(input.expectedSourceHashes, snapshot.sourceHashes)
    assertExpectedHashes(before.sourceHashes, snapshot.sourceHashes)
    if (input.expectedEnvironmentFingerprint !== snapshot.environmentFingerprint) {
      throw namedError('ENVIRONMENT_FINGERPRINT_STALE', 'compiler environment changed after preview', 409)
    }
    if (before.environmentFingerprint === snapshot.environmentFingerprint) {
      throw namedError('ENVIRONMENT_REBASE_NOT_REQUIRED', 'compiler environment already matches the accepted baseline', 409)
    }
    assertStagedTypeScriptSemantics(
      definition.source.file,
      snapshot.sources[definition.source.file]!,
      this.input.registry.get(this.input.storeId).canonicalRealPath,
      snapshot.compilerOptions,
      Object.fromEntries(Object.entries(snapshot.sources).filter(([file]) => file !== definition.source.file)),
    )
    const acceptedGraph = upgradeLegacyProjectionFingerprint(before, definition.id, snapshot.projection)
    const acceptedDefinition = acceptedGraph.components[definition.id]!
    projectVariantRegistry(acceptedGraph, acceptedDefinition, snapshot.projection)
    assertAcceptedSourceProjection(acceptedDefinition, snapshot.projection)
    const command = { kind: 'environment-rebase', file: input.file }
    const historyPatches = await this.history.planCommand({
      command,
      sourceFiles: Object.keys(snapshot.sourceHashes),
      sourcePreimages: [],
      graphPreimage: JSON.stringify(before, null, 2) + '\n',
      revision: before.revision + 1,
    })
    const graph = await new SingleRootAuthoringTransaction({
      transactionId: `g2-environment-rebase-${randomUUID()}`,
      storeId: this.input.storeId,
      registry: this.input.registry,
      store: this.input.store,
    }).commit({
      expectedRevision: input.expectedRevision,
      expectedSourceHashes: input.expectedSourceHashes,
      expectedEnvironmentHashes: snapshot.environmentHashes,
      expectedEnvironmentFingerprint: snapshot.environmentFingerprint,
      sourceFiles: Object.keys(snapshot.sourceHashes),
      metadataPatches: historyPatches,
      command,
      mutate: () => ({ ...acceptedGraph, environmentFingerprint: snapshot.environmentFingerprint }),
    })
    return { kind: 'environment-rebased', graph }
  }

  async undo(input: {
    expectedRevision: number
    expectedSourceHashes: Record<string, string>
  }): Promise<{ graph: AuthoringGraphV1; undoneCommand: unknown; restoredFiles: string[] }> {
    const before = await this.requireGraph()
    if (before.revision !== input.expectedRevision) {
      throw namedError('AUTHORING_REVISION_STALE', `expected revision ${input.expectedRevision}, found ${before.revision}`, 409)
    }
    const latest = await this.latestUndoableAuthoringCommand(before.revision)
    if (!latest) throw namedError('UNDO_EMPTY', 'no authoring command to undo', 404)
    const latestCommand = parseG2VariantCommand(latest.record.command)
    const createCommand = parseCommittedCreateComponentCommand(latest.record.command)
    if (!latestCommand && !createCommand) {
      throw namedError('UNDO_HISTORY_INVALID', 'latest undo command is not supported', 409)
    }
    const componentId = latestCommand?.componentId ?? createCommand!.createdComponentId
    const component = before.components[componentId]
    if (!component) throw namedError('COMPONENT_MISSING', `component not found: ${componentId}`, 404)
    const snapshot = await readExactAuthoringSourceSnapshot({
      storeId: this.input.storeId,
      file: component.source.file,
      registry: this.input.registry,
    })
    assertEnvironmentFingerprint(before.environmentFingerprint, snapshot.environmentFingerprint)

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
      return { file: preimage.file, before: current, after: await this.history.readPreimage(preimage) }
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
      expectedEnvironmentHashes: snapshot.environmentHashes,
      expectedEnvironmentFingerprint: snapshot.environmentFingerprint,
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

  private async latestUndoableAuthoringCommand(expectedRevision: number) {
    return this.history.latestUndoableCommand(expectedRevision, (command) =>
      parseG2VariantCommand(command) !== null || parseCommittedCreateComponentCommand(command) !== null)
  }
}

type CommittedCreateComponentCommand = CreateComponentFromSelectionCommand & {
  createdComponentId: string
  componentFile: string
}

function parseCommittedCreateComponentCommand(value: unknown): CommittedCreateComponentCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const { createdComponentId, componentFile, ...request } = record
  const command = parseCreateComponentFromSelectionCommand(request)
  if (!command || typeof createdComponentId !== 'string' || !createdComponentId ||
    typeof componentFile !== 'string' || componentFile !== `${COMPONENT_ROOT}${command.name}.tsx`) return null
  return { ...command, createdComponentId, componentFile }
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

function assertMatchingHashOverlap(expected: Record<string, string>, actual: Record<string, string>): void {
  const changedPaths = Object.keys(actual)
    .filter((file) => expected[file] !== undefined && expected[file] !== actual[file])
    .sort()
  if (changedPaths.length > 0) {
    throw Object.assign(new Error(`source hash mismatch: ${changedPaths.join(', ')}`), {
      code: 'SOURCE_HASH_STALE', status: 409, changedPaths,
    })
  }
}

function assertEnvironmentFingerprint(expected: string, actual: string): void {
  if (expected === actual) return
  throw Object.assign(new Error('compiler environment fingerprint changed'), {
    code: 'ENVIRONMENT_FINGERPRINT_STALE', status: 409,
  })
}

function upgradeLegacyProjectionFingerprint(
  graph: AuthoringGraphV1,
  componentId: string,
  projection: SourceProjection,
): AuthoringGraphV1 {
  const component = graph.components[componentId]!
  const current = sourceProjectionFingerprint(projection)
  if (component.projectionFingerprint === current) return graph
  if (component.projectionFingerprint !== legacySourceProjectionFingerprint(projection)) {
    throw namedError('SOURCE_PROJECTION_DRIFT', 'current source projection differs from the accepted authoring baseline', 422)
  }
  return {
    ...graph,
    components: {
      ...graph.components,
      [componentId]: { ...component, projectionFingerprint: current },
    },
  }
}

function namedError(code: string, message: string, status: number): Error {
  return Object.assign(new Error(message), { code, status })
}
