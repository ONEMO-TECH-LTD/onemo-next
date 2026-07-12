import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { DurableFileInstaller, sha256 } from '../durable-file-installer'

describe('DurableFileInstaller', () => {
  it('installs bytes through sibling temp rename and verifies the installed hash', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-install-'))
    const file = path.join(dir, 'authoring-v1.json')
    const installer = new DurableFileInstaller()

    const result = await installer.writeFileAtomic(file, '{"ok":true}\n')

    await expect(fs.readFile(file, 'utf8')).resolves.toBe('{"ok":true}\n')
    expect(result).toEqual({
      path: file,
      sha256: sha256('{"ok":true}\n'),
      bytes: '{"ok":true}\n'.length,
    })
    await expect(fs.readdir(dir)).resolves.toEqual(['authoring-v1.json'])
  })

  it('deletes by renaming to a transaction tombstone and verifies tombstone bytes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-delete-'))
    const file = path.join(dir, 'authoring-v1.json')
    await fs.writeFile(file, '{"delete":true}\n')
    const installer = new DurableFileInstaller()

    const result = await installer.deleteFileAtomic(file)

    await expect(fs.readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readFile(result.tombstonePath, 'utf8')).resolves.toBe('{"delete":true}\n')
    expect(result.sha256).toBe(sha256('{"delete":true}\n'))
  })

  it('refuses when the same-device assertion fails before install', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-device-'))
    const file = path.join(dir, 'authoring-v1.json')
    const installer = new DurableFileInstaller({
      assertSameDevice: async () => {
        throw Object.assign(new Error('different device'), { code: 'DURABILITY_UNSUPPORTED' })
      },
    })

    await expect(installer.writeFileAtomic(file, '{}\n'))
      .rejects.toMatchObject({ code: 'DURABILITY_UNSUPPORTED' })
    await expect(fs.readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('surfaces unsupported directory fsync through an injectable seam', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-fsync-'))
    const file = path.join(dir, 'authoring-v1.json')
    await fs.writeFile(file, '{"before":true}\n', { mode: 0o644 })
    const installer = new DurableFileInstaller({
      syncDirectory: async () => {
        throw Object.assign(new Error('fsync unsupported'), { code: 'DURABILITY_UNSUPPORTED' })
      },
    })

    await expect(installer.writeFileAtomic(file, '{}\n'))
      .rejects.toMatchObject({ code: 'DURABILITY_UNSUPPORTED' })
    await expect(fs.readFile(file, 'utf8')).resolves.toBe('{"before":true}\n')
    expect((await fs.stat(file)).mode & 0o777).toBe(0o644)
  })

  it('preserves the existing destination mode when replacing source bytes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-mode-'))
    const file = path.join(dir, 'Button.tsx')
    await fs.writeFile(file, 'before\n', { mode: 0o644 })
    await fs.chmod(file, 0o644)

    await new DurableFileInstaller().writeFileAtomic(file, 'after\n')

    await expect(fs.readFile(file, 'utf8')).resolves.toBe('after\n')
    expect((await fs.stat(file)).mode & 0o777).toBe(0o644)
  })

  it('preserves destination mode even when the process umask is more restrictive', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-mode-umask-'))
    const file = path.join(dir, 'Button.tsx')
    await fs.writeFile(file, 'before\n')
    await fs.chmod(file, 0o666)
    const previousUmask = process.umask(0o077)
    try {
      await new DurableFileInstaller().writeFileAtomic(file, 'after\n')
    } finally {
      process.umask(previousUmask)
    }

    await expect(fs.readFile(file, 'utf8')).resolves.toBe('after\n')
    expect((await fs.stat(file)).mode & 0o777).toBe(0o666)
  })

  it('refuses a symlink destination without changing its target', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-link-'))
    const target = path.join(dir, 'target.tsx')
    const link = path.join(dir, 'Button.tsx')
    await fs.writeFile(target, 'outside\n')
    await fs.symlink(target, link)

    await expect(new DurableFileInstaller().writeFileAtomic(link, 'changed\n'))
      .rejects.toMatchObject({ code: 'DURABLE_DESTINATION_SYMLINK' })
    await expect(fs.readFile(target, 'utf8')).resolves.toBe('outside\n')
  })

  it('reports recoverable uncertainty when directory sync fails after rename', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-uncertain-'))
    const file = path.join(dir, 'Button.tsx')
    await fs.writeFile(file, 'before\n', { mode: 0o644 })
    let syncCalls = 0
    const installer = new DurableFileInstaller({
      syncDirectory: async () => {
        syncCalls += 1
        if (syncCalls === 3) throw new Error('post-rename sync failed')
      },
    })

    await expect(installer.writeFileAtomic(file, 'after\n'))
      .rejects.toMatchObject({ code: 'DURABLE_INSTALL_UNCERTAIN' })
    await expect(fs.readFile(file, 'utf8')).resolves.toBe('after\n')
    expect((await fs.stat(file)).mode & 0o777).toBe(0o644)
  })

  it('reports recoverable uncertainty when tombstone directory sync fails', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-delete-uncertain-'))
    const file = path.join(dir, 'Button.tsx')
    await fs.writeFile(file, 'before\n')
    let syncCalls = 0
    const installer = new DurableFileInstaller({
      syncDirectory: async () => {
        syncCalls += 1
        if (syncCalls === 3) throw new Error('post-tombstone sync failed')
      },
    })

    await expect(installer.deleteFileAtomic(file))
      .rejects.toMatchObject({ code: 'DURABLE_DELETE_UNCERTAIN' })
    await expect(fs.readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await fs.readdir(dir)).some((entry) => entry.endsWith('.tombstone'))).toBe(true)
  })
})
