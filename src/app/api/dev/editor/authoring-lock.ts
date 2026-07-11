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
        const record = await this.readRecord(abs)
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

  async acquireForRecovery(): Promise<AuthoringStoreLockLease> {
    try {
      return await this.acquire()
    } catch (error) {
      if ((error as { code?: unknown }).code !== 'AUTHORING_STORE_LOCKED') throw error
    }
    const abs = await this.lockAbsolutePath()
    const record = await this.readRecord(abs)
    if (record.storeId !== this.storeId) {
      throw namedError('AUTHORING_LOCK_RECORD_INVALID', `authoring lock store mismatch: ${this.storeId}`, 409)
    }
    if (await processIsAlive(record.pid)) {
      throw namedError('AUTHORING_STORE_LOCKED', `authoring store is locked by live pid ${record.pid}: ${this.storeId}`, 409)
    }
    const confirmed = await this.readRecord(abs)
    if (confirmed.token !== record.token) {
      throw namedError('AUTHORING_LOCK_OWNERSHIP_LOST', `authoring lock changed during recovery: ${this.storeId}`, 409)
    }
    await fs.unlink(abs)
    try {
      await this.syncDirectory(path.dirname(abs))
    } catch (error) {
      throw namedError('AUTHORING_STALE_LOCK_RELEASE_UNCERTAIN', `stale lock removed but directory sync failed: ${this.storeId}`, 500, error)
    }
    return this.acquire()
  }

  private async lockAbsolutePath(): Promise<string> {
    return this.registry.resolveStorePath(
      this.storeId,
      authoringStoreLockPath(this.registry.get(this.storeId).kind),
    )
  }

  private async readRecord(abs: string): Promise<AuthoringLockRecord> {
    let handle: import('node:fs/promises').FileHandle
    try {
      handle = await fs.open(abs, constants.O_RDONLY | requireNoFollowFlag())
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw namedError('AUTHORING_LOCK_MISSING', `authoring lock disappeared: ${this.storeId}`, 409, error)
      }
      throw error
    }
    let raw: string
    try {
      raw = await handle.readFile('utf8')
    } finally {
      await handle.close()
    }
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

function namedError(code: string, message: string, status: number, cause?: unknown) {
  return Object.assign(new Error(message), { code, status, cause })
}
