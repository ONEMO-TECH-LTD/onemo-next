import { constants, promises as fs } from 'node:fs'
import path from 'node:path'

import { createHash, randomUUID } from 'node:crypto'

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
  private readonly probedDirectories = new Set<string>()

  constructor(private readonly options: DurableFileInstallerOptions = {}) {}

  async writeFileAtomic(absPath: string, bytes: Buffer | string, options: { mode?: number } = {}): Promise<DurableWriteResult> {
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8')
    const dir = path.dirname(absPath)
    await fs.mkdir(dir, { recursive: true })
    const destination = await this.destinationState(absPath)
    const mode = options.mode ?? destination.mode ?? 0o600
    await this.ensureCapabilities(dir)

    const temp = siblingArtifactPath(absPath, 'tmp')
    let handle: import('node:fs/promises').FileHandle | null = null
    let didInstall = false
    try {
      handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | requireNoFollowFlag(), mode)
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
      didInstall = true
      try {
        await this.syncDirectory(dir)
      } catch (error) {
        throw namedError('DURABLE_INSTALL_UNCERTAIN', `destination installed but directory sync failed for ${absPath}`, error)
      }

      const installedBytes = await fs.readFile(absPath)
      const installedSha = sha256(installedBytes)
      if (installedSha !== plannedSha) {
        throw namedError('DURABLE_INSTALL_HASH_MISMATCH', `installed hash mismatch for ${absPath}`)
      }
      return { path: absPath, sha256: installedSha, bytes: installedBytes.length }
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined)
      if (!didInstall) {
        await fs.rm(temp, { force: true }).catch(() => undefined)
        await this.syncDirectory(dir).catch(() => undefined)
      }
      throw error
    }
  }

  async writeJsonAtomic(absPath: string, value: unknown): Promise<DurableWriteResult> {
    return this.writeFileAtomic(absPath, JSON.stringify(value, null, 2) + '\n')
  }

  async deleteFileAtomic(absPath: string): Promise<DurableDeleteResult> {
    const dir = path.dirname(absPath)
    await this.destinationState(absPath, true)
    await this.ensureCapabilities(dir)
    const before = await fs.readFile(absPath)
    const tombstone = siblingArtifactPath(absPath, 'tombstone')
    await this.assertSameDevice(absPath, tombstone)
    await fs.rename(absPath, tombstone)
    try {
      await this.syncDirectory(dir)
    } catch (error) {
      throw namedError('DURABLE_DELETE_UNCERTAIN', `tombstone installed but directory sync failed for ${absPath}`, error)
    }
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

  private async destinationState(absPath: string, required = false): Promise<{ mode: number | null }> {
    try {
      const stat = await fs.lstat(absPath)
      if (stat.isSymbolicLink()) {
        throw namedError('DURABLE_DESTINATION_SYMLINK', `symlink destination refused: ${absPath}`)
      }
      if (!stat.isFile()) throw namedError('DURABLE_DESTINATION_NOT_FILE', `destination is not a file: ${absPath}`)
      return { mode: stat.mode & 0o777 }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && !required) return { mode: null }
      throw error
    }
  }

  private async ensureCapabilities(dir: string): Promise<void> {
    if (this.probedDirectories.has(dir)) return
    const before = path.join(dir, `.onemo-durability-probe.${process.pid}.${randomUUID()}.before`)
    const after = `${before}.after`
    let handle: import('node:fs/promises').FileHandle | null = null
    try {
      handle = await fs.open(before, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | requireNoFollowFlag(), 0o600)
      await handle.writeFile('probe')
      await handle.sync()
      await handle.close()
      handle = null
      await this.assertSameDevice(before, after)
      await fs.rename(before, after)
      await this.syncDirectory(dir)
      await fs.rm(after)
      await this.syncDirectory(dir)
      this.probedDirectories.add(dir)
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined)
      await fs.rm(before, { force: true }).catch(() => undefined)
      await fs.rm(after, { force: true }).catch(() => undefined)
      if ((error as { code?: string }).code === 'DURABILITY_UNSUPPORTED') throw error
      throw namedError('DURABILITY_UNSUPPORTED', `durability capability probe failed for ${dir}`, error)
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

function requireNoFollowFlag() {
  if (typeof constants.O_NOFOLLOW !== 'number') {
    throw namedError('DURABILITY_UNSUPPORTED', 'O_NOFOLLOW is unavailable on this platform')
  }
  return constants.O_NOFOLLOW
}

function siblingArtifactPath(absPath: string, suffix: string) {
  return path.join(path.dirname(absPath), `.onemo-${path.basename(absPath)}.${process.pid}.${randomUUID()}.${suffix}`)
}

function namedError(code: string, message: string, cause?: unknown) {
  return Object.assign(new Error(message), { status: 422, code, cause })
}
