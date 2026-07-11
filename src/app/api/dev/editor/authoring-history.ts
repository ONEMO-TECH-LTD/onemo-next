import { promises as fs } from 'node:fs'

import { DurableFileInstaller, sha256 } from './durable-file-installer'
import { RuntimeRootRegistry } from './runtime-root-registry'
import type { StoreId } from './authoring-types'

export type HistoryBlobRef = {
  sha256: string
  path: string
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
}

function namedError(code: string, message: string) {
  return Object.assign(new Error(message), { status: 409, code })
}
