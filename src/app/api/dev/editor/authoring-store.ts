import { promises as fs } from 'node:fs'

import { assertAuthoringGraphV1 } from './authoring-schema'
import { EMPTY_ENVIRONMENT_FINGERPRINT } from './authoring-environment'
import { authoringMetadataPath } from './authoring-paths'
import type { AuthoringGraphV1, RootKind, StoreId } from './authoring-types'
import { sha256 } from './durable-file-installer'
import { RuntimeRootRegistry } from './runtime-root-registry'

export const PROJECT_AUTHORING_SIDECAR = authoringMetadataPath('project', 'authoring-v1.json')

export type AuthoringStoreOptions = {
  storeId: StoreId
  rootKind: RootKind
  registry: RuntimeRootRegistry
}

export class AuthoringSidecarStore {
  private readonly sidecarPath: string
  private migration: Promise<void> | null = null

  constructor(private readonly options: AuthoringStoreOptions) {
    const registeredKind = options.registry.get(options.storeId).kind
    if (registeredKind !== options.rootKind) {
      throw namedError('STORE_KIND_MISMATCH', `registered root kind ${registeredKind} does not match ${options.rootKind}`, 409)
    }
    this.sidecarPath = authoringMetadataPath(options.rootKind, 'authoring-v1.json')
  }

  get relativeSidecarPath(): string {
    return this.sidecarPath
  }

  async load(): Promise<AuthoringGraphV1 | null> {
    return (await this.loadSnapshot())?.graph ?? null
  }

  async loadSnapshot(): Promise<{ graph: AuthoringGraphV1; bytes: Buffer } | null> {
    let raw = await this.loadRawSnapshot()
    if (!raw) return null
    if (graphVersion(raw.value) === 1) {
      await this.migrateLegacySidecar()
      raw = await this.loadRawSnapshot()
      if (!raw) throw namedError('AUTHORING_MIGRATION_SOURCE_MISSING', 'sidecar disappeared after schema migration', 409)
    }
    return this.validateCurrentSnapshot(raw)
  }

  async loadCurrentSnapshot(): Promise<{ graph: AuthoringGraphV1; bytes: Buffer } | null> {
    const raw = await this.loadRawSnapshot()
    if (!raw) return null
    if (graphVersion(raw.value) !== 2) {
      throw namedError('AUTHORING_MIGRATION_REQUIRED', 'authoring sidecar requires schema migration before this transaction', 409)
    }
    return this.validateCurrentSnapshot(raw)
  }

  private validateCurrentSnapshot(raw: { value: unknown; bytes: Buffer }): { graph: AuthoringGraphV1; bytes: Buffer } {
    const graph = assertAuthoringGraphV1(raw.value)
    if (graph.storeId !== this.options.storeId) {
      throw namedError('STORE_ID_MISMATCH', `sidecar storeId ${graph.storeId} does not match ${this.options.storeId}`, 409)
    }
    if (graph.root.kind !== this.options.rootKind) {
      throw namedError('STORE_KIND_MISMATCH', `sidecar root kind ${graph.root.kind} does not match ${this.options.rootKind}`, 409)
    }
    return { graph, bytes: raw.bytes }
  }

  async loadRawSnapshot(): Promise<{ value: unknown; bytes: Buffer } | null> {
    const abs = await this.options.registry.resolveStorePath(this.options.storeId, this.sidecarPath)
    let bytes: Buffer
    try {
      bytes = await fs.readFile(abs)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
    try {
      return { value: JSON.parse(bytes.toString('utf8')) as unknown, bytes }
    } catch (error) {
      throw namedError('AUTHORING_SIDECAR_INVALID', 'authoring sidecar is not valid JSON', 409, error)
    }
  }

  async loadOrCreate(sourceFiles: string[] = []): Promise<AuthoringGraphV1> {
    return (await this.load()) ?? createEmptyAuthoringGraph({
      storeId: this.options.storeId,
      rootKind: this.options.rootKind,
      sourceHashes: await this.computeSourceHashes(sourceFiles),
    })
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

  private async migrateLegacySidecar(): Promise<void> {
    if (!this.migration) {
      this.migration = import('./authoring-sidecar-migration')
        .then(({ migrateAuthoringSidecarOnLoad }) => migrateAuthoringSidecarOnLoad({
          storeId: this.options.storeId,
          registry: this.options.registry,
          store: this,
        }))
        .finally(() => { this.migration = null })
    }
    await this.migration
  }
}

export function createEmptyAuthoringGraph(input: {
  storeId: StoreId
  rootKind: RootKind
  sourceHashes?: Record<string, string>
  environmentFingerprint?: string
}): AuthoringGraphV1 {
  return {
    schemaVersion: 2,
    storeId: input.storeId,
    revision: 0,
    root: { kind: input.rootKind },
    sourceHashes: input.sourceHashes ?? {},
    environmentFingerprint: input.environmentFingerprint ?? EMPTY_ENVIRONMENT_FINGERPRINT,
    components: {},
    variants: {},
    sourceProperties: {},
    interactions: {},
    interactionOverrides: {},
    instances: {},
    folders: {},
  }
}

function namedError(code: string, message: string, status: number, cause?: unknown) {
  return Object.assign(new Error(message), { status, code, cause })
}

function graphVersion(value: unknown): unknown {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>).schemaVersion
    : undefined
}
