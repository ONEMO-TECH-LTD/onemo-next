import { promises as fs } from 'node:fs'

import { sha256 } from './durable-file-installer'
import { authoringMetadataPath } from './authoring-paths'
import { isSha256, isStoreRelativePath } from './authoring-schema'
import { RuntimeRootRegistry } from './runtime-root-registry'
import type { RootKind, StoreId } from './authoring-types'

export type HistoryBlobRef = {
  sha256: string
  path: string
}

export type AuthoringHistoryPreimageRef = HistoryBlobRef & {
  file: string
}

export type AuthoringCommandHistoryRecord = {
  type: 'authoring-command'
  command: unknown
  sourceFiles: string[]
  sourcePatches: Array<{ file: string }>
  preimages: AuthoringHistoryPreimageRef[]
  graphPreimage: HistoryBlobRef
  revision: number
}

export type AuthoringUndoHistoryRecord = {
  type: 'authoring-undo'
  undoneJournalIndex: number
  restoredFiles: string[]
  revision: number
}

export type IndexedAuthoringCommandHistoryRecord = {
  index: number
  record: AuthoringCommandHistoryRecord
}

type AuthoringHistoryRecord = AuthoringCommandHistoryRecord | AuthoringUndoHistoryRecord

export type PlannedHistoryPatch = {
  file: string
  before: Buffer | null
  after: Buffer
}

export class AuthoringHistoryStore {
  constructor(
    private readonly registry: RuntimeRootRegistry,
    private readonly storeId: StoreId,
  ) {}

  async planCommand(input: {
    command: unknown
    sourceFiles: string[]
    sourcePreimages: Array<{ file: string; bytes: Buffer | string }>
    graphPreimage: Buffer | string
    revision: number
  }): Promise<PlannedHistoryPatch[]> {
    const patches = new Map<string, PlannedHistoryPatch>()
    const graphPreimage = await this.planBlob(input.graphPreimage, patches)
    const preimages: AuthoringHistoryPreimageRef[] = []
    for (const preimage of input.sourcePreimages) {
      preimages.push({ file: preimage.file, ...await this.planBlob(preimage.bytes, patches) })
    }
    await this.planJournalAppend({
      type: 'authoring-command',
      command: input.command,
      sourceFiles: input.sourceFiles,
      sourcePatches: input.sourcePreimages.map((preimage) => ({ file: preimage.file })),
      preimages,
      graphPreimage,
      revision: input.revision,
    }, patches)
    return [...patches.values()]
  }

  async planUndo(input: {
    undoneJournalIndex: number
    restoredFiles: string[]
    revision: number
  }): Promise<PlannedHistoryPatch[]> {
    const patches = new Map<string, PlannedHistoryPatch>()
    await this.planJournalAppend({
      type: 'authoring-undo',
      undoneJournalIndex: input.undoneJournalIndex,
      restoredFiles: input.restoredFiles,
      revision: input.revision,
    }, patches)
    return [...patches.values()]
  }

  async readBlob(ref: HistoryBlobRef): Promise<string> {
    const validated = assertHistoryBlobRef(
      { sha256: ref.sha256, path: ref.path },
      this.registry.get(this.storeId).kind,
      'blob',
    )
    const abs = await this.registry.resolveStorePath(this.storeId, validated.path)
    let bytes: Buffer
    try {
      bytes = await fs.readFile(abs)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw namedError('HISTORY_BLOB_MISSING', `history blob is missing: ${validated.sha256}`, error)
      }
      throw error
    }
    if (sha256(bytes) !== validated.sha256) {
      throw namedError('HISTORY_BLOB_HASH_MISMATCH', `blob hash mismatch for ${validated.sha256}`)
    }
    return bytes.toString('utf8')
  }

  async readJournal(): Promise<Array<{ index: number; record: AuthoringHistoryRecord }>> {
    const rel = this.historyPath('journal.ndjson')
    const abs = await this.registry.resolveStorePath(this.storeId, rel)
    let current = ''
    try {
      current = await fs.readFile(abs, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const kind = this.registry.get(this.storeId).kind
    if (current.length === 0) return []
    if (!current.endsWith('\n')) invalidHistory('history journal is truncated')
    const lines = current.slice(0, -1).split('\n')
    if (lines.some((line) => line.length === 0)) invalidHistory('history journal contains a blank record')
    const entries = lines
      .map((line, index) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(line) as unknown
        } catch (error) {
          throw namedError('HISTORY_RECORD_INVALID', `history journal line ${index} is not valid JSON`, error)
        }
        return { index, record: assertHistoryRecord(parsed, kind, index) }
      })
    const undone = new Set<number>()
    for (const entry of entries) {
      if (entry.record.type !== 'authoring-undo') continue
      const target = entries[entry.record.undoneJournalIndex]
      if (!target || target.index >= entry.index || target.record.type !== 'authoring-command' || undone.has(target.index)) {
        throw namedError('HISTORY_RECORD_INVALID', `history undo at line ${entry.index} has an invalid target`)
      }
      undone.add(target.index)
    }
    return entries
  }

  async latestUndoableCommand(): Promise<IndexedAuthoringCommandHistoryRecord | null> {
    const journal = await this.readJournal()
    const undone = new Set<number>()
    for (const entry of journal) {
      if (entry.record.type === 'authoring-undo') undone.add(entry.record.undoneJournalIndex)
    }
    for (let index = journal.length - 1; index >= 0; index--) {
      const entry = journal[index]
      if (!entry || undone.has(entry.index) || entry.record.type !== 'authoring-command') continue
      return { index: entry.index, record: entry.record }
    }
    return null
  }

  private async planBlob(
    bytes: Buffer | string,
    patches: Map<string, PlannedHistoryPatch>,
  ): Promise<HistoryBlobRef> {
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8')
    const digest = sha256(data)
    const rel = this.historyPath(`blobs/${digest}`)
    const abs = await this.registry.resolveStorePath(this.storeId, rel)
    try {
      const existing = await fs.readFile(abs)
      if (sha256(existing) !== digest) throw namedError('HISTORY_BLOB_COLLISION', `blob collision for ${digest}`)
      patches.set(rel, { file: rel, before: existing, after: existing })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      patches.set(rel, { file: rel, before: null, after: data })
    }
    return { sha256: digest, path: rel }
  }

  private async planJournalAppend(
    record: AuthoringCommandHistoryRecord | AuthoringUndoHistoryRecord,
    patches: Map<string, PlannedHistoryPatch>,
  ): Promise<void> {
    const rel = this.historyPath('journal.ndjson')
    const abs = await this.registry.resolveStorePath(this.storeId, rel)
    let before: Buffer | null
    try {
      before = await fs.readFile(abs)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      before = null
    }
    const prefix = before ?? Buffer.alloc(0)
    const after = Buffer.concat([prefix, Buffer.from(JSON.stringify(record) + '\n')])
    patches.set(rel, { file: rel, before, after })
  }

  private historyPath(suffix: string): string {
    return authoringMetadataPath(this.registry.get(this.storeId).kind, `history/${suffix}`)
  }
}

function assertHistoryRecord(value: unknown, kind: RootKind, index: number): AuthoringHistoryRecord {
  const record = requireRecord(value, `history line ${index}`)
  if (record.type === 'authoring-command') return assertCommandRecord(record, kind, index)
  if (record.type === 'authoring-undo') return assertUndoRecord(record, index)
  throw namedError('HISTORY_RECORD_INVALID', `history line ${index} has an unknown type`)
}

function assertCommandRecord(record: Record<string, unknown>, kind: RootKind, index: number): AuthoringCommandHistoryRecord {
  requireExactKeys(record, ['type', 'command', 'sourceFiles', 'sourcePatches', 'preimages', 'graphPreimage', 'revision'], `history line ${index}`)
  const command = requireRecord(record.command, `history line ${index}.command`)
  if (typeof command.kind !== 'string' || command.kind.length === 0) invalidHistory(`history line ${index}.command.kind is invalid`)
  const sourceFiles = assertPathList(record.sourceFiles, `history line ${index}.sourceFiles`)
  if (!Array.isArray(record.sourcePatches)) invalidHistory(`history line ${index}.sourcePatches must be an array`)
  const sourcePatches = record.sourcePatches.map((value, patchIndex) => {
    const patch = requireRecord(value, `history line ${index}.sourcePatches.${patchIndex}`)
    requireExactKeys(patch, ['file'], `history line ${index}.sourcePatches.${patchIndex}`)
    if (!isStoreRelativePath(patch.file)) invalidHistory(`history line ${index}.sourcePatches.${patchIndex}.file is invalid`)
    return { file: patch.file }
  })
  if (!Array.isArray(record.preimages)) invalidHistory(`history line ${index}.preimages must be an array`)
  const preimages = record.preimages.map((value, preimageIndex) => {
    const preimage = requireRecord(value, `history line ${index}.preimages.${preimageIndex}`)
    requireExactKeys(preimage, ['file', 'sha256', 'path'], `history line ${index}.preimages.${preimageIndex}`)
    if (!isStoreRelativePath(preimage.file)) invalidHistory(`history line ${index}.preimages.${preimageIndex}.file is invalid`)
    return {
      file: preimage.file,
      ...assertHistoryBlobRef(
        { sha256: preimage.sha256, path: preimage.path },
        kind,
        `history line ${index}.preimages.${preimageIndex}`,
      ),
    }
  })
  const patchFiles = sourcePatches.map((patch) => patch.file)
  const preimageFiles = preimages.map((preimage) => preimage.file)
  if (new Set(sourceFiles).size !== sourceFiles.length || new Set(patchFiles).size !== patchFiles.length || new Set(preimageFiles).size !== preimageFiles.length) {
    invalidHistory(`history line ${index} contains duplicate file paths`)
  }
  if (patchFiles.length !== preimageFiles.length || patchFiles.some((file, fileIndex) => file !== preimageFiles[fileIndex])) {
    invalidHistory(`history line ${index} source patches and preimages disagree`)
  }
  if (!isRevision(record.revision)) invalidHistory(`history line ${index}.revision is invalid`)
  return {
    type: 'authoring-command',
    command,
    sourceFiles,
    sourcePatches,
    preimages,
    graphPreimage: assertHistoryBlobRef(record.graphPreimage, kind, `history line ${index}.graphPreimage`),
    revision: record.revision,
  }
}

function assertUndoRecord(record: Record<string, unknown>, index: number): AuthoringUndoHistoryRecord {
  requireExactKeys(record, ['type', 'undoneJournalIndex', 'restoredFiles', 'revision'], `history line ${index}`)
  if (!isIndex(record.undoneJournalIndex)) invalidHistory(`history line ${index}.undoneJournalIndex is invalid`)
  if (!isRevision(record.revision)) invalidHistory(`history line ${index}.revision is invalid`)
  return {
    type: 'authoring-undo',
    undoneJournalIndex: record.undoneJournalIndex,
    restoredFiles: assertPathList(record.restoredFiles, `history line ${index}.restoredFiles`),
    revision: record.revision,
  }
}

function assertHistoryBlobRef(value: unknown, kind: RootKind, label: string): HistoryBlobRef {
  const ref = requireRecord(value, label)
  requireExactKeys(ref, ['sha256', 'path'], label)
  if (!isSha256(ref.sha256) || !isStoreRelativePath(ref.path)) invalidHistory(`${label} hash/path is invalid`)
  const expected = authoringMetadataPath(kind, `history/blobs/${ref.sha256}`)
  if (ref.path !== expected) invalidHistory(`${label}.path does not match its hash`)
  return { sha256: ref.sha256, path: ref.path }
}

function assertPathList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => !isStoreRelativePath(entry))) invalidHistory(`${label} is invalid`)
  if (new Set(value).size !== value.length) invalidHistory(`${label} contains duplicates`)
  return value
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidHistory(`${label} must be an object`)
  return value as Record<string, unknown>
}

function requireExactKeys(value: Record<string, unknown>, keys: string[], label: string): void {
  const expected = new Set(keys)
  if (Object.keys(value).some((key) => !expected.has(key)) || keys.some((key) => !Object.hasOwn(value, key))) {
    invalidHistory(`${label} keys are invalid`)
  }
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function invalidHistory(message: string): never {
  throw namedError('HISTORY_RECORD_INVALID', message)
}

function namedError(code: string, message: string, cause?: unknown) {
  return Object.assign(new Error(message), { status: 409, code, cause })
}
