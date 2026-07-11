import { promises as fs } from 'node:fs'

import { compileAuthoringCommand, projectVariantProjectionIntoGraph, type AuthoringVariantCommand } from './authoring-compiler'
import { AuthoringHistoryStore } from './authoring-history'
import { AuthoringSidecarStore, PROJECT_AUTHORING_SIDECAR } from './authoring-store'
import { SingleRootAuthoringTransaction } from './authoring-transaction'
import type { AuthoringGraphV1, EntityId, StoreId, VariantFrame } from './authoring-types'
import { DurableFileInstaller } from './durable-file-installer'
import { RuntimeRootRegistry } from './runtime-root-registry'
import { sourceProjectionFromTsxSource } from './source-projection'

export const PROJECT_AUTHORING_STORE_ID = 'project-main'

export type AuthoringCanvasComponent = {
  id: EntityId
  displayName: string
  source: { file: string; exportName: string }
  variants: Array<{
    id: EntityId
    displayName: string
    frame: VariantFrame['frame']
    kind: VariantFrame['kind']
    primary: boolean
  }>
}

export type AuthoringCanvasState = {
  storeId: StoreId
  sidecarPath: string
  revision: number
  sourceHashes: Record<string, string>
  graph: AuthoringGraphV1
  component: AuthoringCanvasComponent | null
}

export type ExecuteAuthoringCommandResult = {
  revision: number
  graph: AuthoringGraphV1
  sourcePatches: Array<{ file: string }>
  semanticAssertions: string[]
}

export async function createProjectAuthoringSession(input: {
  rootPath?: string
  storeId?: StoreId
} = {}): Promise<ProjectAuthoringSession> {
  const storeId = input.storeId ?? PROJECT_AUTHORING_STORE_ID
  const registry = await RuntimeRootRegistry.create([
    { storeId, kind: 'project', rootPath: input.rootPath ?? process.cwd() },
  ])
  const store = new AuthoringSidecarStore({ storeId, rootKind: 'project', registry })
  return new ProjectAuthoringSession({ storeId, registry, store })
}

export class ProjectAuthoringSession {
  private readonly installer = new DurableFileInstaller()
  private readonly history: AuthoringHistoryStore

  constructor(private readonly input: {
    storeId: StoreId
    registry: RuntimeRootRegistry
    store: AuthoringSidecarStore
  }) {
    this.history = new AuthoringHistoryStore(input.registry, input.storeId)
  }

  async loadCanvas(file: string | null): Promise<AuthoringCanvasState> {
    const graph = await this.input.store.loadOrCreate(file ? [file] : [])
    const projected = file ? await this.withSourceProjection(graph, file) : graph
    return {
      storeId: this.input.storeId,
      sidecarPath: PROJECT_AUTHORING_SIDECAR,
      revision: graph.revision,
      sourceHashes: graph.sourceHashes,
      graph: projected,
      component: file ? componentCanvasState(projected, file) : null,
    }
  }

  async executeCommand(input: {
    command: AuthoringVariantCommand
    expectedRevision: number
    expectedSourceHashes?: Record<string, string>
  }): Promise<ExecuteAuthoringCommandResult> {
    const projectionFiles = projectionFilesForCommand(input.command)
    const sourceMutatingFiles = sourceMutatingFilesForCommand(input.command)
    const graph = await this.input.store.loadOrCreate(projectionFiles)
    if (sourceMutatingFiles.length > 0 && !input.expectedSourceHashes) {
      throw namedError('SOURCE_HASH_PRECONDITION_REQUIRED', 'expectedSourceHashes required for source-mutating authoring command', 400)
    }
    if (input.expectedSourceHashes) {
      await this.input.store.verifyExpectedSourceHashes(input.expectedSourceHashes)
    }
    const source = projectionFiles.length === 1 ? await this.readStoreFile(projectionFiles[0]!) : undefined
    const projectedGraph = projectionFiles.length === 1
      ? await this.withSourceProjection(graph, projectionFiles[0]!, source)
      : graph
    const component = projectionFiles.length === 1 ? componentCanvasState(projectedGraph, projectionFiles[0]!) : null
    const plan = compileAuthoringCommand({
      storeId: this.input.storeId,
      graph: projectedGraph,
      source,
      command: input.command,
      exportName: component?.source.exportName,
    })
    const preimages = new Map<string, string>()
    const preimageBlobs: Array<{ file: string; sha256: string; path: string }> = []
    try {
      for (const patch of plan.sourcePatches) {
        preimages.set(patch.file, patch.before)
        const blob = await this.history.putBlob(patch.before)
        preimageBlobs.push({ file: patch.file, ...blob })
        await this.writeStoreFile(patch.file, patch.after)
      }
      const tx = new SingleRootAuthoringTransaction({
        transactionId: `authoring-${Date.now()}`,
        storeId: this.input.storeId,
        registry: this.input.registry,
        store: this.input.store,
      })
      const committed = await tx.commit({
        expectedRevision: input.expectedRevision,
        sourceFiles: projectionFiles,
        mutate: () => plan.graph,
      })
      await this.history.appendJournal({
        type: 'authoring-command',
        command: input.command,
        sourcePatches: plan.sourcePatches.map((patch) => ({ file: patch.file })),
        preimages: preimageBlobs,
        revision: committed.revision,
      })
      return {
        revision: committed.revision,
        graph: committed,
        sourcePatches: plan.sourcePatches.map((patch) => ({ file: patch.file })),
        semanticAssertions: plan.semanticAssertions,
      }
    } catch (error) {
      for (const [file, bytes] of preimages) {
        await this.writeStoreFile(file, bytes)
      }
      throw error
    }
  }

  private async withSourceProjection(graph: AuthoringGraphV1, file: string, source?: string): Promise<AuthoringGraphV1> {
    const bytes = source ?? await this.readStoreFile(file)
    const projection = sourceProjectionFromTsxSource({ file, source: bytes })
    return projectVariantProjectionIntoGraph({ graph, storeId: this.input.storeId, projection })
  }

  private async readStoreFile(file: string): Promise<string> {
    const abs = await this.input.registry.resolveStorePath(this.input.storeId, file)
    return fs.readFile(abs, 'utf8')
  }

  private async writeStoreFile(file: string, bytes: string): Promise<void> {
    const abs = await this.input.registry.resolveStorePath(this.input.storeId, file)
    await this.installer.writeFileAtomic(abs, bytes)
  }
}

function projectionFilesForCommand(command: AuthoringVariantCommand): string[] {
  return [command.file]
}

function sourceMutatingFilesForCommand(command: AuthoringVariantCommand): string[] {
  if (command.kind === 'move-variant-frame') return []
  return [command.file]
}

function componentCanvasState(graph: AuthoringGraphV1, file: string): AuthoringCanvasComponent | null {
  const component = Object.values(graph.components).find((candidate) => candidate.source.file === file)
  if (!component) return null
  return {
    id: component.id,
    displayName: component.displayName,
    source: { file: component.source.file, exportName: component.source.exportName },
    variants: Object.values(graph.variants)
      .filter((variant) => variant.componentId === component.id)
      .sort((a, b) => a.frame.x - b.frame.x || a.displayName.localeCompare(b.displayName))
      .map((variant) => ({
        id: variant.id,
        displayName: variant.displayName,
        frame: variant.frame,
        kind: variant.kind,
        primary: variant.id === component.primaryVariantId,
      })),
  }
}

function namedError(code: string, message: string, status: number) {
  return Object.assign(new Error(message), { code, status })
}
