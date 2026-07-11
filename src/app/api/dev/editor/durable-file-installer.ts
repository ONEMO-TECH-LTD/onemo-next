import { constants, promises as fs } from 'node:fs'
import path from 'node:path'

import { createHash } from 'node:crypto'

export type DurableWriteResult = {
  path: string
  sha256: string
  bytes: number
}

export type DurableDeleteResult = {
  path: string
  tombstonePath: string
  sha256: string
  bytes: number
}

export type DurableFileInstallerOptions = {
  syncDirectory?: (dir: string) => Promise<void>
  assertSameDevice?: (tempPath: string, destinationPath: string) => Promise<void>
}

export class DurableFileInstaller {
  constructor(private readonly options: DurableFileInstallerOptions = {}) {}

  async writeFileAtomic(absPath: string, bytes: Buffer | string): Promise<DurableWriteResult> {
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8')
    const dir = path.dirname(absPath)
    await fs.mkdir(dir, { recursive: true })

    const temp = path.join(dir, `.${path.basename(absPath)}.${process.pid}.${Date.now()}.tmp`)
    let handle: import('node:fs/promises').FileHandle | null = null
    try {
      handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollowFlag(), 0o600)
      await handle.writeFile(data)
      await handle.sync()
      await handle.close()
      handle = null

      const tempBytes = await fs.readFile(temp)
      const plannedSha = sha256(data)
      if (sha256(tempBytes) !== plannedSha) {
        throw namedError('DURABLE_TEMP_HASH_MISMATCH', `temp hash mismatch for ${absPath}`)
      }

      await this.assertSameDevice(temp, absPath)
      await fs.rename(temp, absPath)
      await this.syncDirectory(dir)

      const installed = await fs.readFile(absPath)
      const installedSha = sha256(installed)
      if (installedSha !== plannedSha) {
        throw namedError('DURABLE_INSTALL_HASH_MISMATCH', `installed hash mismatch for ${absPath}`)
      }
      return { path: absPath, sha256: installedSha, bytes: installed.length }
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined)
      await fs.rm(temp, { force: true }).catch(() => undefined)
      throw error
    }
  }

  async writeJsonAtomic(absPath: string, value: unknown): Promise<DurableWriteResult> {
    return this.writeFileAtomic(absPath, JSON.stringify(value, null, 2) + '\n')
  }

  async deleteFileAtomic(absPath: string): Promise<DurableDeleteResult> {
    const dir = path.dirname(absPath)
    const before = await fs.readFile(absPath)
    const tombstone = path.join(dir, `.${path.basename(absPath)}.${process.pid}.${Date.now()}.tombstone`)
    await this.assertSameDevice(absPath, tombstone)
    await fs.rename(absPath, tombstone)
    await this.syncDirectory(dir)
    const tombstoneBytes = await fs.readFile(tombstone)
    const digest = sha256(tombstoneBytes)
    if (digest !== sha256(before)) {
      throw namedError('DURABLE_TOMBSTONE_HASH_MISMATCH', `tombstone hash mismatch for ${absPath}`)
    }
    try {
      await fs.access(absPath)
      throw namedError('DURABLE_DELETE_VERIFY_FAILED', `delete target still exists: ${absPath}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return { path: absPath, tombstonePath: tombstone, sha256: digest, bytes: tombstoneBytes.length }
  }

  private async syncDirectory(dir: string) {
    if (this.options.syncDirectory) return this.options.syncDirectory(dir)
    return syncDirectory(dir)
  }

  private async assertSameDevice(tempPath: string, destinationPath: string) {
    if (this.options.assertSameDevice) return this.options.assertSameDevice(tempPath, destinationPath)
    const tempStat = await fs.stat(tempPath)
    const destDirStat = await fs.stat(path.dirname(destinationPath))
    if (tempStat.dev !== destDirStat.dev) {
      throw namedError('DURABILITY_UNSUPPORTED', `cross-device install refused for ${destinationPath}`)
    }
  }
}

export function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function syncDirectory(dir: string) {
  let handle: import('node:fs/promises').FileHandle | null = null
  try {
    handle = await fs.open(dir, constants.O_RDONLY)
    await handle.sync()
  } catch (error) {
    throw namedError('DURABILITY_UNSUPPORTED', `directory fsync unsupported for ${dir}`, error)
  } finally {
    if (handle) await handle.close().catch(() => undefined)
  }
}

function noFollowFlag() {
  return typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0
}

function namedError(code: string, message: string, cause?: unknown) {
  return Object.assign(new Error(message), { status: 422, code, cause })
}
