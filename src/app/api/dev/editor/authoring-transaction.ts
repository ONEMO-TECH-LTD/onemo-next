import { promises as fs } from 'node:fs'

import { CrossProcessAuthoringStoreLock } from './authoring-lock'
import { compilerEnvironmentFingerprint } from './authoring-environment'
import { authoringMetadataPath } from './authoring-paths'
import { assertAuthoringGraphV1, isSha256, isStoreRelativePath } from './authoring-schema'
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

export type TransactionGraphPatch = {
  kind: 'replace-graph'
  before: TransactionBlobRef | null
  after: TransactionBlobRef
}

export type TransactionGraphInverse = {
  kind: 'replace-graph'
  before: TransactionBlobRef
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
  metadata: TransactionFileImage[]
  graphPatches: [TransactionGraphPatch]
  inverse: [TransactionGraphInverse]
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
export type MetadataPatch = { file: string; before: string | Buffer | null; after: string | Buffer | null }

export type AuthoringTransactionHooks = {
  afterPrepare?: () => Promise<void> | void
  afterSourceInstall?: () => Promise<void> | void
  afterMetadataInstall?: () => Promise<void> | void
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
    if (!isTransactionId(input.transactionId)) invalidRecord('transactionId is not a safe path segment')
    this.rootKind = input.registry.get(input.storeId).kind
    this.lock = input.lock ?? new CrossProcessAuthoringStoreLock(input.registry, input.storeId)
    this.installer = input.installer ?? new DurableFileInstaller()
  }

  async commit(update: {
    expectedRevision: number
    requireMissingSidecar?: boolean
    sourceFiles?: string[]
    expectedSourceHashes?: Record<string, string>
    expectedEnvironmentHashes?: Record<string, string>
    expectedEnvironmentFingerprint?: string
    sourcePatches?: SourcePatch[]
    metadataPatches?: MetadataPatch[]
    command?: unknown
    mutate: (graph: AuthoringGraphV1) => AuthoringGraphV1
  }): Promise<AuthoringGraphV1> {
    return this.withLock(() => this.commitLocked(update))
  }

  private async commitLocked(update: {
    expectedRevision: number
    requireMissingSidecar?: boolean
    sourceFiles?: string[]
    expectedSourceHashes?: Record<string, string>
    expectedEnvironmentHashes?: Record<string, string>
    expectedEnvironmentFingerprint?: string
    sourcePatches?: SourcePatch[]
    metadataPatches?: MetadataPatch[]
    command?: unknown
    mutate: (graph: AuthoringGraphV1) => AuthoringGraphV1
  }): Promise<AuthoringGraphV1> {
    await this.assertNoUnresolvedRecovery()
    const sidecarSnapshot = await this.input.store.loadSnapshot()
    if (update.requireMissingSidecar && sidecarSnapshot) {
      throw namedError('AUTHORING_SIDECAR_EXISTS', 'transaction requires a missing authoring sidecar', 409)
    }
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
    const metadataPatches = update.metadataPatches ?? []
    const expectedSourceHashes = update.expectedSourceHashes ?? {}
    this.validatePatchPaths(sourcePatches, metadataPatches)
    const sourceFiles = unique([
      ...(update.sourceFiles ?? Object.keys(expectedSourceHashes)),
      ...sourcePatches.map((patch) => patch.file),
      ...Object.keys(expectedSourceHashes),
    ])
    const missingHashPreconditions = sourceFiles.filter((file) => !isSha256(expectedSourceHashes[file]))
    if (missingHashPreconditions.length > 0) {
      throw Object.assign(new Error(`source hash precondition required: ${missingHashPreconditions.join(', ')}`), {
        status: 422,
        code: 'SOURCE_HASH_PRECONDITION_REQUIRED',
        changedPaths: missingHashPreconditions,
      })
    }
    const currentSources = await this.readSourceFiles(sourceFiles)
    this.verifyExpectedHashes(expectedSourceHashes, currentSources)
    const expectedEnvironmentHashes = update.expectedEnvironmentHashes ?? {}
    const currentEnvironment = await this.readEnvironmentFiles(Object.keys(expectedEnvironmentHashes))
    this.verifyExpectedEnvironment(
      expectedEnvironmentHashes,
      update.expectedEnvironmentFingerprint,
      currentEnvironment,
    )
    this.verifyPatchPreimages(sourcePatches, currentSources)
    const currentMetadata = await this.readOptionalFiles(metadataPatches.map((patch) => patch.file))
    this.verifyMetadataPreimages(metadataPatches, currentMetadata)
    await this.assertTransactionIdAvailable()
    const patchByFile = new Map(sourcePatches.map((patch) => [patch.file, patch]))
    const touchedSourceHashes = Object.fromEntries(sourceFiles.map((file) => [
      file,
      sha256(patchByFile.get(file)?.after ?? currentSources.get(file)!),
    ]))
    const sourceHashes = { ...before.sourceHashes, ...touchedSourceHashes }
    const afterCandidate = update.mutate({
      ...before,
      revision: before.revision + 1,
      sourceHashes: { ...sourceHashes },
    })
    const after = assertAuthoringGraphV1({
      ...afterCandidate,
      revision: before.revision + 1,
      sourceHashes,
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
    const metadata = await Promise.all(metadataPatches.map(async (patch) => {
      const current = currentMetadata.get(patch.file) ?? null
      const mode = current === null ? 0o600 : await this.fileMode(patch.file)
      return {
        file: patch.file,
        before: patch.before === null ? null : await this.putTransactionBlob(patch.before, mode),
        after: patch.after === null ? null : await this.putTransactionBlob(patch.after, mode),
      }
    }))
    const prepared = this.record('prepared', update.command ?? null, before, after, files, sidecar, metadata)
    const coordinator = this.coordinator('prepared')
    await this.writeParticipant(prepared)
    await this.writeCoordinator(coordinator)
    let committedDecision = false
    try {
      await this.input.hooks?.afterPrepare?.()
      for (const image of files) await this.installImage(image, 'after')
      await this.input.hooks?.afterSourceInstall?.()
      await this.installImage(sidecar, 'after')
      for (const image of metadata) await this.installImage(image, 'after')
      await this.input.hooks?.afterMetadataInstall?.()
      await this.verifyInstalledImages([...files, sidecar, ...metadata], 'after')
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
        await this.restoreImages([...files, sidecar, ...metadata])
        await this.writeCoordinator({ ...coordinator, status: 'rolled-back' })
        await this.writeParticipant({ ...prepared, status: 'rolled-back' })
      } catch (rollbackError) {
        throw namedError('RECOVERY_REQUIRED', `transaction rollback needs recovery: ${this.input.transactionId}`, 500, { error, rollbackError })
      }
      throw error
    }
  }

  async recover(): Promise<ExecutableRecoveryAction> {
    return this.withRecoveryLock(async () => {
      const participantAbs = await this.input.registry.resolveStorePath(this.input.storeId, this.transactionPath('participant.json'))
      const record = assertParticipantRecord(
        JSON.parse(await fs.readFile(participantAbs, 'utf8')),
        this.input.transactionId,
        this.input.storeId,
        this.rootKind,
        this.input.store.relativeSidecarPath,
      )
      const coordinatorAbs = await this.input.registry.resolveStorePath(this.input.storeId, this.transactionPath('coordinator.json'))
      const coordinator = await readCoordinator(coordinatorAbs, this.input.transactionId, this.input.storeId, this.rootKind)
      const images = [...record.files, record.sidecar, ...record.metadata]
      if (coordinator?.status === 'committed' && record.status === 'committed') return 'ignored-committed'
      if (coordinator?.status === 'rolled-back' && record.status === 'rolled-back') return 'ignored-rolled-back'
      if (coordinator?.status !== 'committed' && (coordinator?.status === 'rolled-back' || record.status === 'rolled-back')) {
        await this.verifyRecoveryCompatible(images)
        await this.restoreImages(images)
        if (coordinator?.status !== 'rolled-back') {
          await this.writeCoordinator({ ...this.coordinator('prepared'), status: 'rolled-back' })
        }
        if (record.status !== 'rolled-back') await this.writeParticipant({ ...record, status: 'rolled-back' })
        return 'finished-rolled-back'
      }
      await this.verifyRecoveryCompatible(images)
      if (!coordinator || coordinator.status === 'prepared') {
        await this.restoreImages(images)
        await this.writeCoordinator({ ...this.coordinator('prepared'), status: 'rolled-back' })
        await this.writeParticipant({ ...record, status: 'rolled-back' })
        return 'rolled-back-prepared'
      } else {
        for (const image of images) await this.installImage(image, 'after')
        await this.verifyInstalledImages(images, 'after')
        await this.writeParticipant({ ...record, status: 'committed' })
        return 'finished-committed'
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
    metadata: TransactionFileImage[],
  ): SingleRootTransactionRecord {
    if (!sidecar.after) invalidRecord('prepared sidecar must have an after-image')
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
      metadata,
      graphPatches: [{ kind: 'replace-graph', before: sidecar.before, after: sidecar.after }],
      inverse: [{ kind: 'replace-graph', before: sidecar.after, after: sidecar.before }],
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
    assertParticipantRecord(record, this.input.transactionId, this.input.storeId, this.rootKind, this.input.store.relativeSidecarPath)
    await writeSingleRootParticipantRecord({
      registry: this.input.registry,
      storeId: this.input.storeId,
      record,
      installer: this.installer,
    })
  }

  private async writeCoordinator(record: SingleRootCoordinatorRecord): Promise<void> {
    assertCoordinatorRecord(record, this.input.transactionId, this.input.storeId, this.rootKind)
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

  private async assertTransactionIdAvailable(): Promise<void> {
    const abs = await this.input.registry.resolveStorePath(
      this.input.storeId,
      authoringMetadataPath(this.rootKind, `transactions/${this.input.transactionId}`),
    )
    try {
      await fs.lstat(abs)
      throw namedError('TRANSACTION_ID_EXISTS', `transaction already exists: ${this.input.transactionId}`, 409)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
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

  private async readEnvironmentFiles(files: string[]): Promise<Map<string, Buffer>> {
    try {
      return await this.readSourceFiles(files)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      throw Object.assign(new Error('compiler environment input disappeared before transaction prepare'), {
        status: 409,
        code: 'ENVIRONMENT_FINGERPRINT_STALE',
        changedPaths: files,
      })
    }
  }

  private async readOptionalFiles(files: string[]): Promise<Map<string, Buffer | null>> {
    const snapshots = new Map<string, Buffer | null>()
    for (const file of unique(files)) {
      const abs = await this.input.registry.resolveStorePath(this.input.storeId, file)
      try {
        snapshots.set(file, await fs.readFile(abs))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        snapshots.set(file, null)
      }
    }
    return snapshots
  }

  private verifyExpectedHashes(expected: Record<string, string>, current: Map<string, Buffer>): void {
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

  private verifyExpectedEnvironment(
    expected: Record<string, string>,
    expectedFingerprint: string | undefined,
    current: Map<string, Buffer>,
  ): void {
    if (expectedFingerprint === undefined) return
    const actual = Object.fromEntries([...current].map(([file, bytes]) => [file, sha256(bytes)]))
    const changedPaths = Object.keys(expected).filter((file) => actual[file] !== expected[file]).sort()
    if (changedPaths.length > 0 || compilerEnvironmentFingerprint(actual) !== expectedFingerprint) {
      throw Object.assign(new Error('compiler environment changed before transaction prepare'), {
        status: 409,
        code: 'ENVIRONMENT_FINGERPRINT_STALE',
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

  private verifyMetadataPreimages(patches: MetadataPatch[], current: Map<string, Buffer | null>): void {
    if (new Set(patches.map((patch) => patch.file)).size !== patches.length) {
      throw namedError('DUPLICATE_METADATA_PATCH', 'metadata patch files must be unique', 422)
    }
    const changedPaths = patches
      .filter((patch) => {
        const actual = current.get(patch.file) ?? null
        if (patch.before === null || actual === null) return patch.before !== null || actual !== null
        return sha256(actual) !== sha256(patch.before)
      })
      .map((patch) => patch.file)
    if (changedPaths.length > 0) {
      throw Object.assign(new Error(`metadata preimage mismatch: ${changedPaths.join(', ')}`), {
        status: 409,
        code: 'METADATA_PREIMAGE_STALE',
        changedPaths,
      })
    }
  }

  private validatePatchPaths(sourcePatches: SourcePatch[], metadataPatches: MetadataPatch[]): void {
    const metadataRoot = authoringMetadataPath(this.rootKind, '')
    const historyRoot = authoringMetadataPath(this.rootKind, 'history/')
    const invalidSource = sourcePatches.find((patch) => patch.file.startsWith(metadataRoot))
    if (invalidSource) throw namedError('SOURCE_PATCH_PATH_INVALID', `source patch targets authoring metadata: ${invalidSource.file}`, 422)
    const invalidMetadata = metadataPatches.find((patch) => !patch.file.startsWith(historyRoot))
    if (invalidMetadata) throw namedError('METADATA_PATCH_PATH_INVALID', `metadata patch is outside history: ${invalidMetadata.file}`, 422)
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
      } else if (((await fs.lstat(abs)).mode & 0o777) !== ref.mode) {
        throw namedError('TRANSACTION_INSTALL_MODE_MISMATCH', `installed mode mismatch: ${image.file}`, 409)
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
      let currentMode: number | null
      try {
        const stat = await fs.lstat(abs)
        currentMode = stat.mode & 0o777
        currentHash = sha256(await fs.readFile(abs))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        currentHash = null
        currentMode = null
      }
      const allowed = [image.before, image.after]
        .map((ref) => ref ? `${ref.sha256}:${ref.mode}` : 'missing')
      const current = currentHash === null ? 'missing' : `${currentHash}:${currentMode}`
      if (!allowed.includes(current)) conflicts.push(image.file)
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
    return this.withLease(() => this.lock.acquire(), operation)
  }

  private async assertNoUnresolvedRecovery(): Promise<void> {
    const decisions = await discoverSingleRootRecoveryDecisions({
      storeId: this.input.storeId,
      registry: this.input.registry,
    })
    const unresolved = decisions.filter((decision) =>
      decision.decision !== 'ignore-committed' && decision.decision !== 'ignore-rolled-back')
    if (unresolved.length > 0) {
      throw Object.assign(new Error(`unresolved authoring recovery: ${unresolved.map((entry) => entry.transactionId).join(', ')}`), {
        code: 'RECOVERY_REQUIRED',
        status: 409,
        transactionIds: unresolved.map((entry) => entry.transactionId),
      })
    }
  }

  private async withRecoveryLock<T>(operation: () => Promise<T>): Promise<T> {
    return this.withLease(() => this.lock.acquireForRecovery(), operation)
  }

  private async withLease<T>(
    acquire: () => Promise<{ release: () => Promise<void> }>,
    operation: () => Promise<T>,
  ): Promise<T> {
    const lease = await acquire()
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
  | { transactionId: string; decision: 'ignore-committed'; record: SingleRootTransactionRecord }
  | { transactionId: string; decision: 'finish-rolled-back'; record: SingleRootTransactionRecord }
  | { transactionId: string; decision: 'ignore-rolled-back'; record: SingleRootTransactionRecord }
  | { transactionId: string; decision: 'invalid-record'; reason: string }

export type RecoveryExecutionResult =
  | { transactionId: string; action: 'rolled-back-prepared' }
  | { transactionId: string; action: 'finished-committed' }
  | { transactionId: string; action: 'ignored-committed' }
  | { transactionId: string; action: 'finished-rolled-back' }
  | { transactionId: string; action: 'ignored-rolled-back' }
  | { transactionId: string; action: 'invalid-record'; reason: string }

type ExecutableRecoveryAction = Exclude<RecoveryExecutionResult['action'], 'invalid-record'>

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
  const kind = input.registry.get(input.storeId).kind
  const sidecarPath = authoringMetadataPath(kind, 'authoring-v1.json')
  for (const entry of entries) {
    const transactionId = entry.name
    if (entry.isSymbolicLink()) {
      decisions.push({ transactionId, decision: 'invalid-record', reason: 'symlink transaction directory refused' })
      continue
    }
    if (!entry.isDirectory()) {
      decisions.push({ transactionId, decision: 'invalid-record', reason: 'transaction entry is not a directory' })
      continue
    }
    try {
      const participantPath = await input.registry.resolveStorePath(
        input.storeId,
        `${relRoot}/${transactionId}/participant.json`,
      )
      const record = assertParticipantRecord(
        JSON.parse(await fs.readFile(participantPath, 'utf8')),
        transactionId,
        input.storeId,
        kind,
        sidecarPath,
      )
      const coordinatorPath = await input.registry.resolveStorePath(
        input.storeId,
        `${relRoot}/${transactionId}/coordinator.json`,
      )
      const coordinator = await readCoordinator(coordinatorPath, transactionId, input.storeId, kind)
      if (coordinator?.status === 'committed' && record.status === 'committed') {
          decisions.push({ transactionId, decision: 'ignore-committed', record })
      } else if (coordinator?.status === 'committed') {
          decisions.push({ transactionId, decision: 'finish-committed', record })
      } else if (coordinator?.status === 'rolled-back' && record.status === 'rolled-back') {
          decisions.push({ transactionId, decision: 'ignore-rolled-back', record })
      } else if (coordinator?.status === 'rolled-back' || record.status === 'rolled-back') {
          decisions.push({ transactionId, decision: 'finish-rolled-back', record })
      } else if (!coordinator || coordinator.status === 'prepared') {
          decisions.push({ transactionId, decision: 'rollback-prepared', record })
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
    } else {
      const tx = new SingleRootAuthoringTransaction({
        transactionId: decision.transactionId,
        storeId: input.storeId,
        registry: input.registry,
        store: input.store,
      })
      const action = await tx.recover()
      results.push({ transactionId: decision.transactionId, action })
    }
  }
  return results
}

export const recoverSingleRootTransactions = executeSingleRootRecovery

async function readCoordinator(
  abs: string,
  transactionId: string,
  storeId: StoreId,
  kind: RootKind,
): Promise<SingleRootCoordinatorRecord | null> {
  try {
    return assertCoordinatorRecord(JSON.parse(await fs.readFile(abs, 'utf8')), transactionId, storeId, kind)
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

function assertParticipantRecord(
  value: unknown,
  transactionId: string,
  storeId: StoreId,
  kind: RootKind,
  sidecarPath: string,
): SingleRootTransactionRecord {
  const record = requireRecord(value, 'participant')
  requireExactKeys(record, [
    'schemaVersion', 'transactionId', 'storeId', 'coordinator', 'participants', 'status', 'command',
    'beforeRevision', 'afterRevision', 'files', 'sidecar', 'metadata', 'graphPatches', 'inverse',
  ], 'participant')
  if (record.schemaVersion !== 1 || record.transactionId !== transactionId || record.storeId !== storeId) {
    invalidRecord('participant identity mismatch')
  }
  if (!isTransactionId(transactionId)) invalidRecord('transactionId is not a safe path segment')
  if (!isSingleStoreList(record.participants, storeId)) invalidRecord('participant store list is invalid')
  if (!isStatus(record.status)) invalidRecord('participant status is invalid')
  if (!isRevision(record.beforeRevision) || record.afterRevision !== record.beforeRevision + 1) {
    invalidRecord('participant revision step is invalid')
  }
  const coordinator = requireRecord(record.coordinator, 'participant.coordinator')
  requireExactKeys(coordinator, ['storeId', 'relativeTransactionPath'], 'participant.coordinator')
  const expectedCoordinator = authoringMetadataPath(kind, `transactions/${transactionId}/coordinator.json`)
  if (coordinator.storeId !== storeId || coordinator.relativeTransactionPath !== expectedCoordinator) {
    invalidRecord('participant coordinator pointer is invalid')
  }
  if (!Array.isArray(record.files)) invalidRecord('participant files must be an array')
  const files = record.files.map((image, index) => assertFileImage(image, transactionId, kind, `participant.files.${index}`))
  if (new Set(files.map((image) => image.file)).size !== files.length) invalidRecord('participant files contain duplicates')
  const sidecar = assertFileImage(record.sidecar, transactionId, kind, 'participant.sidecar')
  if (sidecar.file !== sidecarPath || sidecar.after === null) invalidRecord('participant sidecar image is invalid')
  assertGraphReplaceList(record.graphPatches, transactionId, kind, 'participant.graphPatches', sidecar.before, sidecar.after)
  assertGraphReplaceList(record.inverse, transactionId, kind, 'participant.inverse', sidecar.after, sidecar.before)
  if (files.some((image) => image.file === sidecar.file)) invalidRecord('participant sidecar is duplicated as a source file')
  if (!Array.isArray(record.metadata)) invalidRecord('participant metadata must be an array')
  const metadata = record.metadata.map((image, index) => assertFileImage(image, transactionId, kind, `participant.metadata.${index}`))
  if (new Set(metadata.map((image) => image.file)).size !== metadata.length) invalidRecord('participant metadata contains duplicates')
  const allFiles = [...files, sidecar, ...metadata].map((image) => image.file)
  if (new Set(allFiles).size !== allFiles.length) invalidRecord('participant image paths overlap')
  const historyRoot = authoringMetadataPath(kind, 'history/')
  if (metadata.some((image) => !image.file.startsWith(historyRoot))) invalidRecord('participant metadata is outside history')
  const metadataRoot = authoringMetadataPath(kind, '')
  if (files.some((image) => image.file.startsWith(metadataRoot))) invalidRecord('participant source image targets authoring metadata')
  return record as unknown as SingleRootTransactionRecord
}

function assertCoordinatorRecord(
  value: unknown,
  transactionId: string,
  storeId: StoreId,
  kind: RootKind,
): SingleRootCoordinatorRecord {
  const record = requireRecord(value, 'coordinator')
  requireExactKeys(record, ['schemaVersion', 'transactionId', 'storeId', 'participants', 'participantPaths', 'status'], 'coordinator')
  if (record.schemaVersion !== 1 || record.transactionId !== transactionId || record.storeId !== storeId) {
    invalidRecord('coordinator identity mismatch')
  }
  if (!isTransactionId(transactionId)) invalidRecord('transactionId is not a safe path segment')
  if (!isSingleStoreList(record.participants, storeId) || !isStatus(record.status)) invalidRecord('coordinator state is invalid')
  if (!Array.isArray(record.participantPaths) || record.participantPaths.length !== 1) {
    invalidRecord('coordinator participant paths are invalid')
  }
  const pointer = requireRecord(record.participantPaths[0], 'coordinator.participantPaths.0')
  requireExactKeys(pointer, ['storeId', 'path'], 'coordinator.participantPaths.0')
  const expected = authoringMetadataPath(kind, `transactions/${transactionId}/participant.json`)
  if (pointer.storeId !== storeId || pointer.path !== expected) invalidRecord('coordinator participant pointer is invalid')
  return record as unknown as SingleRootCoordinatorRecord
}

function assertFileImage(value: unknown, transactionId: string, kind: RootKind, label: string): TransactionFileImage {
  const image = requireRecord(value, label)
  requireExactKeys(image, ['file', 'before', 'after'], label)
  if (!isStoreRelativePath(image.file)) invalidRecord(`${label}.file is invalid`)
  const before = image.before === null ? null : assertBlobRef(image.before, transactionId, kind, `${label}.before`)
  const after = image.after === null ? null : assertBlobRef(image.after, transactionId, kind, `${label}.after`)
  if (before === null && after === null) invalidRecord(`${label} has no image`)
  return { file: image.file, before, after }
}

function assertBlobRef(value: unknown, transactionId: string, kind: RootKind, label: string): TransactionBlobRef {
  const ref = requireRecord(value, label)
  requireExactKeys(ref, ['sha256', 'path', 'mode'], label)
  if (!isSha256(ref.sha256) || !isStoreRelativePath(ref.path)) invalidRecord(`${label} hash/path is invalid`)
  if (!Number.isSafeInteger(ref.mode) || (ref.mode as number) < 0 || (ref.mode as number) > 0o777) {
    invalidRecord(`${label}.mode is invalid`)
  }
  const expected = authoringMetadataPath(kind, `transactions/${transactionId}/blobs/${ref.sha256}`)
  if (ref.path !== expected) invalidRecord(`${label}.path does not match its hash`)
  return ref as unknown as TransactionBlobRef
}

function assertGraphReplaceList(
  value: unknown,
  transactionId: string,
  kind: RootKind,
  label: string,
  expectedBefore: TransactionBlobRef | null,
  expectedAfter: TransactionBlobRef | null,
): void {
  if (!Array.isArray(value) || value.length !== 1) invalidRecord(`${label} must contain one replace-graph entry`)
  const entry = requireRecord(value[0], `${label}.0`)
  requireExactKeys(entry, ['kind', 'before', 'after'], `${label}.0`)
  if (entry.kind !== 'replace-graph') invalidRecord(`${label}.0 kind is invalid`)
  const before = entry.before === null ? null : assertBlobRef(entry.before, transactionId, kind, `${label}.0.before`)
  const after = entry.after === null ? null : assertBlobRef(entry.after, transactionId, kind, `${label}.0.after`)
  if (!sameBlobRef(before, expectedBefore) || !sameBlobRef(after, expectedAfter)) {
    invalidRecord(`${label}.0 does not match the sidecar image`)
  }
}

function sameBlobRef(left: TransactionBlobRef | null, right: TransactionBlobRef | null): boolean {
  return left === null || right === null
    ? left === right
    : left.sha256 === right.sha256 && left.path === right.path && left.mode === right.mode
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidRecord(`${label} must be an object`)
  return value as Record<string, unknown>
}

function requireExactKeys(value: Record<string, unknown>, keys: string[], label: string): void {
  const expected = new Set(keys)
  if (Object.keys(value).some((key) => !expected.has(key)) || keys.some((key) => !Object.hasOwn(value, key))) {
    invalidRecord(`${label} keys are invalid`)
  }
}

function isStatus(value: unknown): value is SingleRootTransactionRecord['status'] {
  return value === 'prepared' || value === 'committed' || value === 'rolled-back'
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isSingleStoreList(value: unknown, storeId: StoreId): boolean {
  return Array.isArray(value) && value.length === 1 && value[0] === storeId
}

function isTransactionId(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value)
}

function invalidRecord(message: string): never {
  throw namedError('TRANSACTION_RECORD_INVALID', message, 409)
}
