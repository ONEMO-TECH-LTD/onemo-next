import { randomUUID } from 'node:crypto'

import { compileG2VariantCommand, type CompilePlan } from './authoring-compiler'
import type { G2VariantCommand } from './authoring-commands'
import { AuthoringHistoryStore } from './authoring-history'
import { readExactAuthoringSourceSnapshot } from './authoring-import'
import { AuthoringSidecarStore } from './authoring-store'
import { SingleRootAuthoringTransaction } from './authoring-transaction'
import type { AuthoringGraphV1, StoreId } from './authoring-types'
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
  }> {
    const graph = await this.requireGraph()
    const component = Object.values(graph.components).filter((candidate) => candidate.source.file === file)
    if (component.length !== 1) throw namedError('COMPONENT_SOURCE_AMBIGUOUS', `expected one component for ${file}`, 422)
    const snapshot = await readExactAuthoringSourceSnapshot({ storeId: this.input.storeId, file, registry: this.input.registry })
    assertExpectedHashes(graph.sourceHashes, snapshot.sourceHashes)
    return { graph, componentId: component[0]!.id, projection: snapshot.projection, sourceHashes: snapshot.sourceHashes }
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
      cssSources: Object.fromEntries(Object.entries(snapshot.sources).filter(([file]) => file !== component.source.file)),
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

  private async requireGraph(): Promise<AuthoringGraphV1> {
    const graph = await this.input.store.load()
    if (!graph) throw namedError('AUTHORING_GRAPH_MISSING', 'import the component source before authoring', 409)
    return graph
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
