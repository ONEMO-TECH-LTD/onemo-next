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

type AuthoringLockRecord = {
  schemaVersion: 1
  storeId: StoreId
  token: string
  pid: number
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
      handle = await fs.open(abs, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR |
        requireNoFollowFlag() | requireExclusiveLockFlags(), 0o600)
      created = true
      await handle.writeFile(JSON.stringify({ schemaVersion: 1, storeId: this.storeId, token, pid: process.pid }) + '\n')
      await handle.sync()
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

    return this.lease(handle, abs, dir, token)
  }

  async acquireForRecovery(): Promise<AuthoringStoreLockLease> {
    try {
      return await this.acquire()
    } catch (error) {
      if ((error as { code?: unknown }).code !== 'AUTHORING_STORE_LOCKED') throw error
    }
    const abs = await this.lockAbsolutePath()
    const dir = path.dirname(abs)
    let handle: import('node:fs/promises').FileHandle
    try {
      handle = await fs.open(abs, constants.O_RDWR | requireNoFollowFlag() | requireExclusiveLockFlags())
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EAGAIN' || code === 'EWOULDBLOCK') {
        throw namedError('AUTHORING_STORE_LOCKED', `authoring store lock is held by another process: ${this.storeId}`, 409, error)
      }
      if (code === 'ENOENT') throw namedError('AUTHORING_LOCK_MISSING', `authoring lock disappeared: ${this.storeId}`, 409, error)
      throw error
    }
    let record: AuthoringLockRecord
    try {
      record = await this.readRecordFromHandle(handle)
      await this.assertCanonicalHandle(abs, handle)
    } catch (error) {
      await handle.close().catch(() => undefined)
      throw error
    }
    if (record.storeId !== this.storeId) {
      await handle.close()
      throw namedError('AUTHORING_LOCK_RECORD_INVALID', `authoring lock store mismatch: ${this.storeId}`, 409)
    }
    let ownerAlive: boolean
    try {
      ownerAlive = await processIsAlive(record.pid)
    } catch (error) {
      await handle.close().catch(() => undefined)
      throw error
    }
    if (ownerAlive) {
      await handle.close()
      throw namedError('AUTHORING_STORE_LOCKED', `authoring store is locked by live pid ${record.pid}: ${this.storeId}`, 409)
    }
    const token = randomUUID()
    try {
      await handle.truncate(0)
      await handle.writeFile(JSON.stringify({ schemaVersion: 1, storeId: this.storeId, token, pid: process.pid }) + '\n')
      await handle.sync()
      await this.syncDirectory(dir)
    } catch (error) {
      await handle.close().catch(() => undefined)
      throw namedError('AUTHORING_STALE_LOCK_CLAIM_UNCERTAIN', `stale lock ownership update is uncertain: ${this.storeId}`, 500, error)
    }
    return this.lease(handle, abs, dir, token)
  }

  private lease(
    handle: import('node:fs/promises').FileHandle,
    abs: string,
    dir: string,
    token: string,
  ): AuthoringStoreLockLease {
    let released = false
    return {
      token,
      release: async () => {
        if (released) return
        let record: AuthoringLockRecord
        try {
          record = await this.readRecordFromHandle(handle)
          await this.assertCanonicalHandle(abs, handle)
        } catch (error) {
          await handle.close().catch(() => undefined)
          released = true
          throw error
        }
        if (record.token !== token) {
          await handle.close().catch(() => undefined)
          released = true
          throw namedError('AUTHORING_LOCK_OWNERSHIP_LOST', `authoring lock ownership changed: ${this.storeId}`, 409)
        }
        await fs.unlink(abs)
        await handle.close()
        released = true
        try {
          await this.syncDirectory(dir)
        } catch (error) {
          throw namedError('AUTHORING_LOCK_RELEASE_UNCERTAIN', `authoring lock removed but directory sync failed: ${this.storeId}`, 500, error)
        }
      },
    }
  }

  private async lockAbsolutePath(): Promise<string> {
    return this.registry.resolveStorePath(
      this.storeId,
      authoringStoreLockPath(this.registry.get(this.storeId).kind),
    )
  }

  private async readRecordFromHandle(handle: import('node:fs/promises').FileHandle): Promise<AuthoringLockRecord> {
    const stat = await handle.stat()
    const bytes = Buffer.alloc(stat.size)
    await handle.read(bytes, 0, bytes.length, 0)
    const raw = bytes.toString('utf8')
    let value: unknown
    try {
      value = JSON.parse(raw)
    } catch (error) {
      throw namedError('AUTHORING_LOCK_RECORD_INVALID', `authoring lock record is invalid: ${this.storeId}`, 409, error)
    }
    if (!isLockRecord(value)) {
      throw namedError('AUTHORING_LOCK_RECORD_INVALID', `authoring lock record has invalid fields: ${this.storeId}`, 409)
    }
    return value
  }

  private async assertCanonicalHandle(abs: string, handle: import('node:fs/promises').FileHandle): Promise<void> {
    let canonical: import('node:fs').Stats
    try {
      canonical = await fs.lstat(abs)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw namedError('AUTHORING_LOCK_MISSING', `authoring lock disappeared: ${this.storeId}`, 409, error)
      }
      throw error
    }
    const opened = await handle.stat()
    if (canonical.dev !== opened.dev || canonical.ino !== opened.ino) {
      throw namedError('AUTHORING_LOCK_OWNERSHIP_LOST', `authoring lock inode changed: ${this.storeId}`, 409)
    }
  }
}

function isLockRecord(value: unknown): value is AuthoringLockRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<AuthoringLockRecord>
  const keys = Object.keys(value)
  return keys.length === 4 && keys.every((key) => ['schemaVersion', 'storeId', 'token', 'pid'].includes(key)) &&
    record.schemaVersion === 1 &&
    typeof record.storeId === 'string' && record.storeId.length > 0 &&
    typeof record.token === 'string' && record.token.length > 0 &&
    typeof record.pid === 'number' && Number.isSafeInteger(record.pid) && record.pid > 0
}

async function processIsAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ESRCH') return false
    if (code === 'EPERM') return true
    throw namedError('AUTHORING_LOCK_LIVENESS_UNKNOWN', `cannot determine lock owner liveness for pid ${pid}`, 409, error)
  }
}

function requireNoFollowFlag(): number {
  if (typeof constants.O_NOFOLLOW !== 'number') {
    throw namedError('DURABILITY_UNSUPPORTED', 'O_NOFOLLOW is unavailable on this platform', 422)
  }
  return constants.O_NOFOLLOW
}

function requireExclusiveLockFlags(): number {
  if (process.platform !== 'darwin') {
    throw namedError('DURABILITY_UNSUPPORTED', 'kernel exclusive file locks are unavailable on this platform', 422)
  }
  const O_EXLOCK = 0x00000020
  return O_EXLOCK | constants.O_NONBLOCK
}

function namedError(code: string, message: string, status: number, cause?: unknown) {
  return Object.assign(new Error(message), { code, status, cause })
}
