import { promises as fs } from 'node:fs'
import path from 'node:path'

import { AuthoringSidecarStore, PROJECT_AUTHORING_SIDECAR } from './authoring-store'
import type { AuthoringGraphV1, StoreId } from './authoring-types'
import { DurableFileInstaller, sha256 } from './durable-file-installer'
import { RuntimeRootRegistry } from './runtime-root-registry'

export type SingleRootTransactionRecord = {
  transactionId: string
  storeId: StoreId
  coordinator: { storeId: StoreId; relativeTransactionPath: string }
  participants: StoreId[]
  status: 'prepared' | 'committed' | 'rolled-back'
  beforeRevision: number
  afterRevision: number
  beforeSidecarHash: string | null
  afterSidecarHash: string
}

export class SingleRootAuthoringTransaction {
  private readonly installer = new DurableFileInstaller()

  constructor(
    private readonly input: {
      transactionId: string
      storeId: StoreId
      registry: RuntimeRootRegistry
      store: AuthoringSidecarStore
    },
  ) {}

  async commit(update: {
    expectedRevision: number
    sourceFiles?: string[]
    expectedSourceHashes?: Record<string, string>
    mutate: (graph: AuthoringGraphV1) => AuthoringGraphV1
  }): Promise<AuthoringGraphV1> {
    const before = await this.input.store.loadOrCreate()
    if (before.revision !== update.expectedRevision) {
      throw Object.assign(new Error(`expected revision ${update.expectedRevision}, found ${before.revision}`), {
        status: 409,
        code: 'AUTHORING_REVISION_STALE',
      })
    }
    if (update.expectedSourceHashes) {
      await this.input.store.verifyExpectedSourceHashes(update.expectedSourceHashes)
    }
    const sourceFiles = update.sourceFiles ?? Object.keys(update.expectedSourceHashes ?? before.sourceHashes)
    const sourceHashes = sourceFiles.length > 0
      ? await this.input.store.computeSourceHashes(sourceFiles)
      : before.sourceHashes
    const afterCandidate = update.mutate({
      ...before,
      revision: before.revision + 1,
      sourceHashes,
    })
    const after = {
      ...afterCandidate,
      revision: before.revision + 1,
      sourceHashes: {
        ...afterCandidate.sourceHashes,
        ...sourceHashes,
      },
    }
    const beforeHash = await this.readSidecarHash()
    const afterHash = sha256(JSON.stringify(after, null, 2) + '\n')

    const prepared = this.record('prepared', before, after, beforeHash, afterHash)
    await this.writeParticipant(prepared)
    try {
      await this.input.store.save(after)
      const committed = this.record('committed', before, after, beforeHash, afterHash)
      await this.writeParticipant(committed)
      return after
    } catch (error) {
      await this.rollbackPrepared(beforeHash === null ? null : before, prepared)
      throw error
    }
  }

  async rollbackPrepared(preimage: AuthoringGraphV1 | null, record: SingleRootTransactionRecord): Promise<void> {
    if (record.status !== 'prepared') return
    if (preimage) await this.input.store.save(preimage)
    await this.writeParticipant({ ...record, status: 'rolled-back' })
  }

  private record(
    status: SingleRootTransactionRecord['status'],
    before: AuthoringGraphV1,
    after: AuthoringGraphV1,
    beforeSidecarHash: string | null,
    afterSidecarHash: string,
  ): SingleRootTransactionRecord {
    const relativeTransactionPath = `src/app/(dev)/react-figma-components/.onemo/transactions/${this.input.transactionId}/participant.json`
    return {
      transactionId: this.input.transactionId,
      storeId: this.input.storeId,
      coordinator: { storeId: this.input.storeId, relativeTransactionPath },
      participants: [this.input.storeId],
      status,
      beforeRevision: before.revision,
      afterRevision: after.revision,
      beforeSidecarHash,
      afterSidecarHash,
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

  private async readSidecarHash(): Promise<string | null> {
    const abs = await this.input.registry.resolveStorePath(this.input.storeId, PROJECT_AUTHORING_SIDECAR)
    try {
      return sha256(await fs.readFile(abs))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
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
  const relRoot = input.transactionsRoot ?? 'src/app/(dev)/react-figma-components/.onemo/transactions'
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
      } else if (record.status === 'prepared') {
        decisions.push({ transactionId, decision: 'rollback-prepared', record })
      } else if (record.status === 'committed') {
        decisions.push({ transactionId, decision: 'finish-committed', record })
      } else if (record.status === 'rolled-back') {
        decisions.push({ transactionId, decision: 'ignore-rolled-back', record })
      } else {
        decisions.push({ transactionId, decision: 'invalid-record', reason: `unknown status: ${String(record.status)}` })
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
  preimages?: Record<string, AuthoringGraphV1 | null>
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
      await tx.rollbackPrepared(input.preimages?.[decision.transactionId] ?? null, decision.record)
      results.push({ transactionId: decision.transactionId, action: 'rolled-back-prepared' })
    } else if (decision.decision === 'finish-committed') {
      await writeSingleRootParticipantRecord({
        registry: input.registry,
        storeId: input.storeId,
        record: decision.record,
        installer: new DurableFileInstaller(),
      })
      results.push({ transactionId: decision.transactionId, action: 'finished-committed' })
    } else {
      results.push({ transactionId: decision.transactionId, action: 'ignored-rolled-back' })
    }
  }
  return results
}

export const recoverSingleRootTransactions = executeSingleRootRecovery

async function writeSingleRootParticipantRecord(input: {
  registry: RuntimeRootRegistry
  storeId: StoreId
  record: SingleRootTransactionRecord
  installer: DurableFileInstaller
}) {
  const abs = await input.registry.resolveStorePath(input.storeId, input.record.coordinator.relativeTransactionPath)
  await input.installer.writeJsonAtomic(abs, input.record)
}
