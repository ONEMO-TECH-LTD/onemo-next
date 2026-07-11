import { promises as fs } from 'node:fs'
import path from 'node:path'

import { CrossProcessAuthoringStoreLock } from './authoring-lock'
import { authoringMetadataPath } from './authoring-paths'
import { assertAuthoringGraphV1 } from './authoring-schema'
import { AuthoringSidecarStore, createEmptyAuthoringGraph } from './authoring-store'
import type { AuthoringGraphV1, RootKind, StoreId } from './authoring-types'
import { DurableFileInstaller, sha256 } from './durable-file-installer'
import { RuntimeRootRegistry } from './runtime-root-registry'

export type TransactionBlobRef = {
  sha256: string
  path: string
  mode: number
}

export type TransactionFileImage = {
  file: string
  before: TransactionBlobRef | null
  after: TransactionBlobRef | null
}

export type SingleRootTransactionRecord = {
  schemaVersion: 1
  transactionId: string
  storeId: StoreId
  coordinator: { storeId: StoreId; relativeTransactionPath: string }
  participants: StoreId[]
  status: 'prepared' | 'committed' | 'rolled-back'
  command: unknown
  beforeRevision: number
  afterRevision: number
  files: TransactionFileImage[]
  sidecar: TransactionFileImage
}

export type SingleRootCoordinatorRecord = {
  schemaVersion: 1
  transactionId: string
  storeId: StoreId
  participants: StoreId[]
  participantPaths: Array<{ storeId: StoreId; path: string }>
  status: 'prepared' | 'committed' | 'rolled-back'
}

export type SourcePatch = { file: string; before: string | Buffer; after: string | Buffer }

export type AuthoringTransactionHooks = {
  afterPrepare?: () => Promise<void> | void
  afterSourceInstall?: () => Promise<void> | void
  afterCoordinatorCommit?: () => Promise<void> | void
}

export class SingleRootAuthoringTransaction {
  private readonly installer: DurableFileInstaller
  private readonly lock: CrossProcessAuthoringStoreLock
  private readonly rootKind: RootKind

  constructor(
    private readonly input: {
      transactionId: string
      storeId: StoreId
      registry: RuntimeRootRegistry
      store: AuthoringSidecarStore
      hooks?: AuthoringTransactionHooks
      lock?: CrossProcessAuthoringStoreLock
      installer?: DurableFileInstaller
    },
  ) {
    this.rootKind = input.registry.get(input.storeId).kind
    this.lock = input.lock ?? new CrossProcessAuthoringStoreLock(input.registry, input.storeId)
    this.installer = input.installer ?? new DurableFileInstaller()
  }

  async commit(update: {
    expectedRevision: number
    sourceFiles?: string[]
    expectedSourceHashes?: Record<string, string>
    sourcePatches?: SourcePatch[]
    command?: unknown
    mutate: (graph: AuthoringGraphV1) => AuthoringGraphV1
  }): Promise<AuthoringGraphV1> {
    return this.withLock(() => this.commitLocked(update))
  }

  private async commitLocked(update: {
    expectedRevision: number
    sourceFiles?: string[]
    expectedSourceHashes?: Record<string, string>
    sourcePatches?: SourcePatch[]
    command?: unknown
    mutate: (graph: AuthoringGraphV1) => AuthoringGraphV1
  }): Promise<AuthoringGraphV1> {
    const sidecarSnapshot = await this.input.store.loadSnapshot()
    const before = sidecarSnapshot?.graph ?? createEmptyAuthoringGraph({
      storeId: this.input.storeId,
      rootKind: this.rootKind,
    })
    if (before.revision !== update.expectedRevision) {
      throw Object.assign(new Error(`expected revision ${update.expectedRevision}, found ${before.revision}`), {
        status: 409,
        code: 'AUTHORING_REVISION_STALE',
      })
    }
    const sourcePatches = update.sourcePatches ?? []
    const sourceFiles = unique([
      ...(update.sourceFiles ?? Object.keys(update.expectedSourceHashes ?? before.sourceHashes)),
      ...sourcePatches.map((patch) => patch.file),
      ...Object.keys(update.expectedSourceHashes ?? {}),
    ])
    const currentSources = await this.readSourceFiles(sourceFiles)
    this.verifyExpectedHashes(update.expectedSourceHashes, currentSources)
    this.verifyPatchPreimages(sourcePatches, currentSources)
    const patchByFile = new Map(sourcePatches.map((patch) => [patch.file, patch]))
    const sourceHashes = Object.fromEntries(sourceFiles.map((file) => [
      file,
      sha256(patchByFile.get(file)?.after ?? currentSources.get(file)!),
    ]))
    const afterCandidate = update.mutate({
      ...before,
      revision: before.revision + 1,
      sourceHashes,
    })
    const after = assertAuthoringGraphV1({
      ...afterCandidate,
      revision: before.revision + 1,
      sourceHashes: {
        ...afterCandidate.sourceHashes,
        ...sourceHashes,
      },
    })
    const afterSidecarBytes = Buffer.from(JSON.stringify(after, null, 2) + '\n')
    const files = await Promise.all(sourcePatches.map(async (patch) => ({
      file: patch.file,
      before: await this.putTransactionBlob(patch.before, await this.fileMode(patch.file)),
      after: await this.putTransactionBlob(patch.after, await this.fileMode(patch.file)),
    })))
    const sidecar = {
      file: this.input.store.relativeSidecarPath,
      before: sidecarSnapshot ? await this.putTransactionBlob(sidecarSnapshot.bytes, await this.fileMode(this.input.store.relativeSidecarPath)) : null,
      after: await this.putTransactionBlob(afterSidecarBytes, sidecarSnapshot ? await this.fileMode(this.input.store.relativeSidecarPath) : 0o600),
    }
    const prepared = this.record('prepared', update.command ?? null, before, after, files, sidecar)
    const coordinator = this.coordinator('prepared')
    await this.writeParticipant(prepared)
    await this.writeCoordinator(coordinator)
    let committedDecision = false
    try {
      await this.input.hooks?.afterPrepare?.()
      for (const image of files) await this.installImage(image, 'after')
      await this.input.hooks?.afterSourceInstall?.()
      await this.installImage(sidecar, 'after')
      await this.verifyInstalledImages([...files, sidecar], 'after')
      const committedCoordinator = { ...coordinator, status: 'committed' as const }
      try {
        await this.writeCoordinator(committedCoordinator)
        committedDecision = true
      } catch (error) {
        if (await this.coordinatorMatches(committedCoordinator)) {
          committedDecision = true
          throw namedError('RECOVERY_REQUIRED', `coordinator commit durability is uncertain: ${this.input.transactionId}`, 500, error)
        }
        throw error
      }
      await this.input.hooks?.afterCoordinatorCommit?.()
      const committed = { ...prepared, status: 'committed' as const }
      await this.writeParticipant(committed)
      return after
    } catch (error) {
      if (committedDecision) {
        throw namedError('RECOVERY_REQUIRED', `committed transaction needs recovery: ${this.input.transactionId}`, 500, error)
      }
      try {
        await this.restoreImages([...files, sidecar])
        await this.writeCoordinator({ ...coordinator, status: 'rolled-back' })
        await this.writeParticipant({ ...prepared, status: 'rolled-back' })
      } catch (rollbackError) {
        throw namedError('RECOVERY_REQUIRED', `transaction rollback needs recovery: ${this.input.transactionId}`, 500, { error, rollbackError })
      }
      throw error
    }
  }

  async recover(record: SingleRootTransactionRecord, decision: 'rollback' | 'finish-commit'): Promise<void> {
    await this.withLock(async () => {
      const images = [...record.files, record.sidecar]
      await this.verifyRecoveryCompatible(images)
      if (decision === 'rollback') {
        await this.restoreImages(images)
        await this.writeCoordinator({ ...this.coordinator('prepared'), status: 'rolled-back' })
        await this.writeParticipant({ ...record, status: 'rolled-back' })
      } else {
        for (const image of images) await this.installImage(image, 'after')
        await this.verifyInstalledImages(images, 'after')
        await this.writeParticipant({ ...record, status: 'committed' })
      }
    })
  }

  private record(
    status: SingleRootTransactionRecord['status'],
    command: unknown,
    before: AuthoringGraphV1,
    after: AuthoringGraphV1,
    files: TransactionFileImage[],
    sidecar: TransactionFileImage,
  ): SingleRootTransactionRecord {
    const relativeTransactionPath = this.transactionPath('coordinator.json')
    return {
      schemaVersion: 1,
      transactionId: this.input.transactionId,
      storeId: this.input.storeId,
      coordinator: { storeId: this.input.storeId, relativeTransactionPath },
      participants: [this.input.storeId],
      status,
      command,
      beforeRevision: before.revision,
      afterRevision: after.revision,
      files,
      sidecar,
    }
  }

  private coordinator(status: SingleRootCoordinatorRecord['status']): SingleRootCoordinatorRecord {
    return {
      schemaVersion: 1,
      transactionId: this.input.transactionId,
      storeId: this.input.storeId,
      participants: [this.input.storeId],
      participantPaths: [{ storeId: this.input.storeId, path: this.transactionPath('participant.json') }],
      status,
    }
  }

  private async writeParticipant(record: SingleRootTransactionRecord) {
    await writeSingleRootParticipantRecord({
      registry: this.input.registry,
      storeId: this.input.storeId,
      record,
      installer: this.installer,
    })
  }

  private async writeCoordinator(record: SingleRootCoordinatorRecord): Promise<void> {
    const abs = await this.input.registry.resolveStorePath(this.input.storeId, this.transactionPath('coordinator.json'))
    await this.installer.writeJsonAtomic(abs, record)
  }

  private async coordinatorMatches(expected: SingleRootCoordinatorRecord): Promise<boolean> {
    const abs = await this.input.registry.resolveStorePath(this.input.storeId, this.transactionPath('coordinator.json'))
    try {
      return JSON.stringify(JSON.parse(await fs.readFile(abs, 'utf8'))) === JSON.stringify(expected)
    } catch {
      return false
    }
  }

  private async readSourceFiles(files: string[]): Promise<Map<string, Buffer>> {
    const snapshots = new Map<string, Buffer>()
    for (const file of files) {
      const abs = await this.input.registry.resolveStorePath(this.input.storeId, file)
      snapshots.set(file, await fs.readFile(abs))
    }
    return snapshots
  }

  private verifyExpectedHashes(expected: Record<string, string> | undefined, current: Map<string, Buffer>): void {
    if (!expected) return
    const changedPaths = Object.entries(expected)
      .filter(([file, hash]) => sha256(current.get(file)!) !== hash)
      .map(([file]) => file)
    if (changedPaths.length > 0) {
      throw Object.assign(new Error(`source hash mismatch: ${changedPaths.join(', ')}`), {
        status: 409,
        code: 'SOURCE_HASH_STALE',
        changedPaths,
      })
    }
  }

  private verifyPatchPreimages(patches: SourcePatch[], current: Map<string, Buffer>): void {
    if (new Set(patches.map((patch) => patch.file)).size !== patches.length) {
      throw namedError('DUPLICATE_SOURCE_PATCH', 'source patch files must be unique', 422)
    }
    const changedPaths = patches
      .filter((patch) => sha256(current.get(patch.file)!) !== sha256(patch.before))
      .map((patch) => patch.file)
    if (changedPaths.length > 0) {
      throw Object.assign(new Error(`source preimage mismatch: ${changedPaths.join(', ')}`), {
        status: 409,
        code: 'SOURCE_PREIMAGE_STALE',
        changedPaths,
      })
    }
  }

  private async putTransactionBlob(bytes: Buffer | string, mode: number): Promise<TransactionBlobRef> {
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
    const digest = sha256(data)
    const rel = this.transactionPath(`blobs/${digest}`)
    const abs = await this.input.registry.resolveStorePath(this.input.storeId, rel)
    try {
      const existing = await fs.readFile(abs)
      if (sha256(existing) !== digest) throw namedError('TRANSACTION_BLOB_COLLISION', `blob collision: ${digest}`, 409)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await this.installer.writeFileAtomic(abs, data, { mode: 0o600 })
    }
    return { sha256: digest, path: rel, mode }
  }

  private async readTransactionBlob(ref: TransactionBlobRef): Promise<Buffer> {
    const abs = await this.input.registry.resolveStorePath(this.input.storeId, ref.path)
    const bytes = await fs.readFile(abs)
    if (sha256(bytes) !== ref.sha256) throw namedError('TRANSACTION_BLOB_HASH_MISMATCH', `blob hash mismatch: ${ref.path}`, 409)
    return bytes
  }

  private async fileMode(file: string): Promise<number> {
    const abs = await this.input.registry.resolveStorePath(this.input.storeId, file)
    return (await fs.lstat(abs)).mode & 0o777
  }

  private async installImage(image: TransactionFileImage, side: 'before' | 'after'): Promise<void> {
    const ref = image[side]
    const abs = await this.input.registry.resolveStorePath(this.input.storeId, image.file)
    if (ref) {
      await this.installer.writeFileAtomic(abs, await this.readTransactionBlob(ref), { mode: ref.mode })
      return
    }
    try {
      await this.installer.deleteFileAtomic(abs)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  private async verifyInstalledImages(images: TransactionFileImage[], side: 'before' | 'after'): Promise<void> {
    for (const image of images) {
      const ref = image[side]
      const abs = await this.input.registry.resolveStorePath(this.input.storeId, image.file)
      if (!ref) {
        try {
          await fs.access(abs)
          throw namedError('TRANSACTION_DELETE_VERIFY_FAILED', `file still exists: ${image.file}`, 409)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      } else if (sha256(await fs.readFile(abs)) !== ref.sha256) {
        throw namedError('TRANSACTION_INSTALL_HASH_MISMATCH', `installed hash mismatch: ${image.file}`, 409)
      }
    }
  }

  private async restoreImages(images: TransactionFileImage[]): Promise<void> {
    for (const image of [...images].reverse()) await this.installImage(image, 'before')
    await this.verifyInstalledImages(images, 'before')
  }

  private async verifyRecoveryCompatible(images: TransactionFileImage[]): Promise<void> {
    const conflicts: string[] = []
    for (const image of images) {
      const abs = await this.input.registry.resolveStorePath(this.input.storeId, image.file)
      let currentHash: string | null
      try {
        currentHash = sha256(await fs.readFile(abs))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        currentHash = null
      }
      const allowed = new Set([image.before?.sha256 ?? null, image.after?.sha256 ?? null])
      if (!allowed.has(currentHash)) conflicts.push(image.file)
    }
    if (conflicts.length > 0) {
      throw Object.assign(new Error(`recovery conflict: ${conflicts.join(', ')}`), {
        code: 'RECOVERY_CONFLICT',
        status: 409,
        changedPaths: conflicts,
      })
    }
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const lease = await this.lock.acquire()
    let result: T | undefined
    let operationError: unknown
    try {
      result = await operation()
    } catch (error) {
      operationError = error
    }
    let releaseError: unknown
    try {
      await lease.release()
    } catch (error) {
      releaseError = error
    }
    if (operationError !== undefined) throw attachReleaseFailure(operationError, releaseError)
    if (releaseError !== undefined) throw releaseError
    return result!
  }

  private transactionPath(suffix: string): string {
    return authoringMetadataPath(this.rootKind, `transactions/${this.input.transactionId}/${suffix}`)
  }
}

export type RecoveryDecision =
  | { transactionId: string; decision: 'rollback-prepared'; record: SingleRootTransactionRecord }
  | { transactionId: string; decision: 'finish-committed'; record: SingleRootTransactionRecord }
  | { transactionId: string; decision: 'ignore-rolled-back'; record: SingleRootTransactionRecord }
  | { transactionId: string; decision: 'invalid-record'; reason: string }

export type RecoveryExecutionResult =
  | { transactionId: string; action: 'rolled-back-prepared' }
  | { transactionId: string; action: 'finished-committed' }
  | { transactionId: string; action: 'ignored-rolled-back' }
  | { transactionId: string; action: 'invalid-record'; reason: string }

export async function discoverSingleRootRecoveryDecisions(input: {
  storeId: StoreId
  registry: RuntimeRootRegistry
  transactionsRoot?: string
}): Promise<RecoveryDecision[]> {
  const relRoot = input.transactionsRoot ?? authoringMetadataPath(input.registry.get(input.storeId).kind, 'transactions')
  const absRoot = await input.registry.resolveStorePath(input.storeId, relRoot)
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(absRoot, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const decisions: RecoveryDecision[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const transactionId = entry.name
    const participantPath = path.join(absRoot, transactionId, 'participant.json')
    try {
      const record = JSON.parse(await fs.readFile(participantPath, 'utf8')) as SingleRootTransactionRecord
      if (record.transactionId !== transactionId) {
        decisions.push({ transactionId, decision: 'invalid-record', reason: 'transactionId mismatch' })
      } else {
        const coordinator = await readCoordinator(path.join(absRoot, transactionId, 'coordinator.json'))
        if (coordinator && coordinator.transactionId !== transactionId) {
          decisions.push({ transactionId, decision: 'invalid-record', reason: 'coordinator transactionId mismatch' })
        } else if (coordinator?.status === 'committed') {
          decisions.push({ transactionId, decision: 'finish-committed', record })
        } else if (coordinator?.status === 'rolled-back' || record.status === 'rolled-back') {
          decisions.push({ transactionId, decision: 'ignore-rolled-back', record })
        } else if (!coordinator || coordinator.status === 'prepared') {
          decisions.push({ transactionId, decision: 'rollback-prepared', record })
        } else {
          decisions.push({ transactionId, decision: 'invalid-record', reason: `unknown coordinator status: ${String(coordinator.status)}` })
        }
      }
    } catch (error) {
      decisions.push({ transactionId, decision: 'invalid-record', reason: (error as Error).message })
    }
  }
  return decisions.sort((a, b) => a.transactionId.localeCompare(b.transactionId))
}

export async function executeSingleRootRecovery(input: {
  storeId: StoreId
  registry: RuntimeRootRegistry
  store: AuthoringSidecarStore
}): Promise<RecoveryExecutionResult[]> {
  const decisions = await discoverSingleRootRecoveryDecisions(input)
  const results: RecoveryExecutionResult[] = []
  for (const decision of decisions) {
    if (decision.decision === 'invalid-record') {
      results.push({ transactionId: decision.transactionId, action: 'invalid-record', reason: decision.reason })
    } else if (decision.decision === 'rollback-prepared') {
      const tx = new SingleRootAuthoringTransaction({
        transactionId: decision.transactionId,
        storeId: input.storeId,
        registry: input.registry,
        store: input.store,
      })
      await tx.recover(decision.record, 'rollback')
      results.push({ transactionId: decision.transactionId, action: 'rolled-back-prepared' })
    } else if (decision.decision === 'finish-committed') {
      const tx = new SingleRootAuthoringTransaction({
        transactionId: decision.transactionId,
        storeId: input.storeId,
        registry: input.registry,
        store: input.store,
      })
      await tx.recover(decision.record, 'finish-commit')
      results.push({ transactionId: decision.transactionId, action: 'finished-committed' })
    } else {
      results.push({ transactionId: decision.transactionId, action: 'ignored-rolled-back' })
    }
  }
  return results
}

export const recoverSingleRootTransactions = executeSingleRootRecovery

async function readCoordinator(abs: string): Promise<SingleRootCoordinatorRecord | null> {
  try {
    return JSON.parse(await fs.readFile(abs, 'utf8')) as SingleRootCoordinatorRecord
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function writeSingleRootParticipantRecord(input: {
  registry: RuntimeRootRegistry
  storeId: StoreId
  record: SingleRootTransactionRecord
  installer: DurableFileInstaller
}) {
  const kind = input.registry.get(input.storeId).kind
  const rel = authoringMetadataPath(kind, `transactions/${input.record.transactionId}/participant.json`)
  const abs = await input.registry.resolveStorePath(input.storeId, rel)
  await input.installer.writeJsonAtomic(abs, input.record)
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function namedError(code: string, message: string, status: number, cause?: unknown) {
  return Object.assign(new Error(message), { code, status, cause })
}

function attachReleaseFailure(primary: unknown, releaseError: unknown): unknown {
  if (releaseError === undefined) return primary
  if (primary instanceof Error) return Object.assign(primary, { releaseError })
  return namedError('AUTHORING_COMMIT_FAILED', 'authoring commit and lock release both failed', 500, { primary, releaseError })
}
