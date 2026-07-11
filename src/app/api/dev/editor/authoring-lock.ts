import { randomUUID } from 'node:crypto'
import { constants, promises as fs } from 'node:fs'
import path from 'node:path'

import { syncDirectoryDurable } from './durable-file-installer'
import { authoringMetadataPath } from './authoring-paths'
import { RuntimeRootRegistry } from './runtime-root-registry'
import type { RootKind, StoreId } from './authoring-types'

export function authoringStoreLockPath(kind: RootKind): string {
  return authoringMetadataPath(kind, 'locks/store.lock')
}

export type AuthoringStoreLockLease = {
  token: string
  release: () => Promise<void>
}

export class CrossProcessAuthoringStoreLock {
  constructor(
    private readonly registry: RuntimeRootRegistry,
    private readonly storeId: StoreId,
    private readonly syncDirectory: (dir: string) => Promise<void> = syncDirectoryDurable,
  ) {}

  async acquire(): Promise<AuthoringStoreLockLease> {
    const lockPath = authoringStoreLockPath(this.registry.get(this.storeId).kind)
    const abs = await this.registry.resolveStorePath(this.storeId, lockPath)
    const dir = path.dirname(abs)
    await fs.mkdir(dir, { recursive: true })
    await this.registry.resolveStorePath(this.storeId, lockPath)
    const token = randomUUID()
    let handle: import('node:fs/promises').FileHandle | null = null
    let created = false
    try {
      handle = await fs.open(
        abs,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | requireNoFollowFlag(),
        0o600,
      )
      created = true
      await handle.writeFile(JSON.stringify({ schemaVersion: 1, storeId: this.storeId, token, pid: process.pid }) + '\n')
      await handle.sync()
      await handle.close()
      handle = null
      await this.syncDirectory(dir)
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined)
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw namedError('AUTHORING_STORE_LOCKED', `authoring store is locked: ${this.storeId}`, 409)
      }
      if (created) {
        await fs.rm(abs, { force: true }).catch(() => undefined)
        await this.syncDirectory(dir).catch(() => undefined)
      }
      throw error
    }

    let released = false
    return {
      token,
      release: async () => {
        if (released) return
        let ownershipHandle: import('node:fs/promises').FileHandle
        try {
          ownershipHandle = await fs.open(abs, constants.O_RDONLY | requireNoFollowFlag())
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw namedError('AUTHORING_LOCK_MISSING', `authoring lock disappeared: ${this.storeId}`, 409, error)
          }
          throw error
        }
        let raw: string
        try {
          raw = await ownershipHandle.readFile('utf8')
        } finally {
          await ownershipHandle.close()
        }
        let record: { token?: unknown }
        try {
          record = JSON.parse(raw) as { token?: unknown }
        } catch (error) {
          throw namedError('AUTHORING_LOCK_RECORD_INVALID', `authoring lock record is invalid: ${this.storeId}`, 409, error)
        }
        if (record.token !== token) {
          throw namedError('AUTHORING_LOCK_OWNERSHIP_LOST', `authoring lock ownership changed: ${this.storeId}`, 409)
        }
        await fs.unlink(abs)
        released = true
        try {
          await this.syncDirectory(dir)
        } catch (error) {
          throw namedError('AUTHORING_LOCK_RELEASE_UNCERTAIN', `authoring lock removed but directory sync failed: ${this.storeId}`, 500, error)
        }
      },
    }
  }
}

function requireNoFollowFlag(): number {
  if (typeof constants.O_NOFOLLOW !== 'number') {
    throw namedError('DURABILITY_UNSUPPORTED', 'O_NOFOLLOW is unavailable on this platform', 422)
  }
  return constants.O_NOFOLLOW
}

function namedError(code: string, message: string, status: number, cause?: unknown) {
  return Object.assign(new Error(message), { code, status, cause })
}
