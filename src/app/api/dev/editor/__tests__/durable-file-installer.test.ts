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
    const installer = new DurableFileInstaller({
      syncDirectory: async () => {
        throw Object.assign(new Error('fsync unsupported'), { code: 'DURABILITY_UNSUPPORTED' })
      },
    })

    await expect(installer.writeFileAtomic(file, '{}\n'))
      .rejects.toMatchObject({ code: 'DURABILITY_UNSUPPORTED' })
  })
})
