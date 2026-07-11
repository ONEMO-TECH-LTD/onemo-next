import { promises as fs } from 'node:fs'

import { sha256 } from './durable-file-installer'
import { authoringMetadataPath } from './authoring-paths'
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
    const abs = await this.registry.resolveStorePath(this.storeId, ref.path)
    const bytes = await fs.readFile(abs)
    if (sha256(bytes) !== ref.sha256) {
      throw namedError('HISTORY_BLOB_HASH_MISMATCH', `blob hash mismatch for ${ref.sha256}`)
    }
    return bytes.toString('utf8')
  }

  async readJournal(): Promise<Array<{ index: number; record: unknown }>> {
    const rel = this.historyPath('journal.ndjson')
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
