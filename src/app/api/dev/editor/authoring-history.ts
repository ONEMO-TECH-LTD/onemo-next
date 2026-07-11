import { promises as fs } from 'node:fs'

import { DurableFileInstaller, sha256 } from './durable-file-installer'
import { RuntimeRootRegistry } from './runtime-root-registry'
import type { StoreId } from './authoring-types'

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
  sourceFiles?: string[]
  sourcePatches?: Array<{ file: string }>
  preimages?: AuthoringHistoryPreimageRef[]
  graphPreimage?: HistoryBlobRef
  revision?: number
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

export class AuthoringHistoryStore {
  private readonly installer = new DurableFileInstaller()

  constructor(
    private readonly registry: RuntimeRootRegistry,
    private readonly storeId: StoreId,
  ) {}

  async putBlob(bytes: Buffer | string): Promise<HistoryBlobRef> {
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8')
    const digest = sha256(data)
    const rel = `src/app/(dev)/react-figma-components/.onemo/history/blobs/${digest}`
    const abs = await this.registry.resolveStorePath(this.storeId, rel)
    try {
      const existing = await fs.readFile(abs)
      if (sha256(existing) !== digest) throw namedError('HISTORY_BLOB_COLLISION', `blob collision for ${digest}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await this.installer.writeFileAtomic(abs, data)
    }
    return { sha256: digest, path: rel }
  }

  async readBlob(ref: HistoryBlobRef): Promise<string> {
    const abs = await this.registry.resolveStorePath(this.storeId, ref.path)
    const bytes = await fs.readFile(abs)
    if (sha256(bytes) !== ref.sha256) {
      throw namedError('HISTORY_BLOB_HASH_MISMATCH', `blob hash mismatch for ${ref.sha256}`)
    }
    return bytes.toString('utf8')
  }

  async appendJournal(record: unknown): Promise<void> {
    const rel = 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'
    const abs = await this.registry.resolveStorePath(this.storeId, rel)
    let current = ''
    try {
      current = await fs.readFile(abs, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await this.installer.writeFileAtomic(abs, current + JSON.stringify(record) + '\n')
  }

  async readJournal(): Promise<Array<{ index: number; record: unknown }>> {
    const rel = 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'
    const abs = await this.registry.resolveStorePath(this.storeId, rel)
    let current = ''
    try {
      current = await fs.readFile(abs, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    return current
      .split('\n')
      .filter(Boolean)
      .map((line, index) => ({ index, record: JSON.parse(line) as unknown }))
  }

  async latestUndoableCommand(): Promise<IndexedAuthoringCommandHistoryRecord | null> {
    const journal = await this.readJournal()
    const undone = new Set<number>()
    for (const entry of journal) {
      if (isUndoRecord(entry.record)) undone.add(entry.record.undoneJournalIndex)
    }
    for (let index = journal.length - 1; index >= 0; index--) {
      const entry = journal[index]
      if (!entry || undone.has(entry.index) || !isCommandRecord(entry.record)) continue
      if (entry.record.graphPreimage) {
        return { index: entry.index, record: entry.record }
      }
    }
    return null
  }
}

function isCommandRecord(record: unknown): record is AuthoringCommandHistoryRecord {
  return !!record && typeof record === 'object' && (record as { type?: unknown }).type === 'authoring-command'
}

function isUndoRecord(record: unknown): record is AuthoringUndoHistoryRecord {
  return !!record &&
    typeof record === 'object' &&
    (record as { type?: unknown }).type === 'authoring-undo' &&
    typeof (record as { undoneJournalIndex?: unknown }).undoneJournalIndex === 'number'
}

function namedError(code: string, message: string) {
  return Object.assign(new Error(message), { status: 409, code })
}
