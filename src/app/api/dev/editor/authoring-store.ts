import { promises as fs } from 'node:fs'

import { assertAuthoringGraphV1 } from './authoring-schema'
import { authoringMetadataPath } from './authoring-paths'
import type { AuthoringGraphV1, RootKind, StoreId } from './authoring-types'
import { DurableFileInstaller, sha256 } from './durable-file-installer'
import { RuntimeRootRegistry } from './runtime-root-registry'

export const PROJECT_AUTHORING_SIDECAR = authoringMetadataPath('project', 'authoring-v1.json')

export type AuthoringStoreOptions = {
  storeId: StoreId
  rootKind: RootKind
  registry: RuntimeRootRegistry
  installer?: DurableFileInstaller
  sidecarPath?: string
}

export class AuthoringSidecarStore {
  private readonly installer: DurableFileInstaller
  private readonly sidecarPath: string

  constructor(private readonly options: AuthoringStoreOptions) {
    this.installer = options.installer ?? new DurableFileInstaller()
    this.sidecarPath = options.sidecarPath ?? PROJECT_AUTHORING_SIDECAR
  }

  get relativeSidecarPath(): string {
    return this.sidecarPath
  }

  async load(): Promise<AuthoringGraphV1 | null> {
    return (await this.loadSnapshot())?.graph ?? null
  }

  async loadSnapshot(): Promise<{ graph: AuthoringGraphV1; bytes: Buffer } | null> {
    const abs = await this.options.registry.resolveStorePath(this.options.storeId, this.sidecarPath)
    let bytes: Buffer
    try {
      bytes = await fs.readFile(abs)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
    const parsed = JSON.parse(bytes.toString('utf8')) as unknown
    const graph = assertAuthoringGraphV1(parsed)
    if (graph.storeId !== this.options.storeId) {
      throw namedError('STORE_ID_MISMATCH', `sidecar storeId ${graph.storeId} does not match ${this.options.storeId}`, 409)
    }
    if (graph.root.kind !== this.options.rootKind) {
      throw namedError('STORE_KIND_MISMATCH', `sidecar root kind ${graph.root.kind} does not match ${this.options.rootKind}`, 409)
    }
    return { graph, bytes }
  }

  async loadOrCreate(sourceFiles: string[] = []): Promise<AuthoringGraphV1> {
    return (await this.load()) ?? createEmptyAuthoringGraph({
      storeId: this.options.storeId,
      rootKind: this.options.rootKind,
      sourceHashes: await this.computeSourceHashes(sourceFiles),
    })
  }

  async commit(update: {
    expectedRevision: number
    sourceFiles?: string[]
    expectedSourceHashes?: Record<string, string>
    mutate?: (graph: AuthoringGraphV1) => AuthoringGraphV1
  }): Promise<AuthoringGraphV1> {
    const current = await this.loadOrCreate(update.sourceFiles ?? [])
    if (current.revision !== update.expectedRevision) {
      throw namedError('AUTHORING_REVISION_STALE', `expected revision ${update.expectedRevision}, found ${current.revision}`, 409)
    }
    if (update.expectedSourceHashes) {
      await this.verifyExpectedSourceHashes(update.expectedSourceHashes)
    }

    const base: AuthoringGraphV1 = {
      ...current,
      revision: current.revision + 1,
      sourceHashes: await this.computeSourceHashes(update.sourceFiles ?? Object.keys(current.sourceHashes)),
    }
    const next = assertAuthoringGraphV1(update.mutate ? update.mutate(base) : base)
    await this.save(next)
    return next
  }

  async save(graph: AuthoringGraphV1): Promise<void> {
    const checked = assertAuthoringGraphV1(graph)
    const abs = await this.options.registry.resolveStorePath(this.options.storeId, this.sidecarPath)
    await this.installer.writeJsonAtomic(abs, checked)
  }

  async computeSourceHashes(files: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {}
    for (const file of files) {
      const abs = await this.options.registry.resolveStorePath(this.options.storeId, file)
      out[file] = sha256(await fs.readFile(abs))
    }
    return out
  }

  async verifyExpectedSourceHashes(expected: Record<string, string>): Promise<void> {
    const actual = await this.computeSourceHashes(Object.keys(expected))
    const changed = Object.entries(expected)
      .filter(([file, hash]) => actual[file] !== hash)
      .map(([file]) => file)
    if (changed.length > 0) {
      throw Object.assign(new Error(`source hash mismatch: ${changed.join(', ')}`), {
        status: 409,
        code: 'SOURCE_HASH_STALE',
        changedPaths: changed,
      })
    }
  }
}

export function createEmptyAuthoringGraph(input: {
  storeId: StoreId
  rootKind: RootKind
  sourceHashes?: Record<string, string>
}): AuthoringGraphV1 {
  return {
    schemaVersion: 1,
    storeId: input.storeId,
    revision: 0,
    root: { kind: input.rootKind },
    sourceHashes: input.sourceHashes ?? {},
    components: {},
    variants: {},
    sourceProperties: {},
    interactions: {},
    interactionOverrides: {},
    instances: {},
    folders: {},
  }
}

function namedError(code: string, message: string, status: number) {
  return Object.assign(new Error(message), { status, code })
}
