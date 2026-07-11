import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { authoringStoreLockPath, CrossProcessAuthoringStoreLock } from '../authoring-lock'
import { RuntimeRootRegistry } from '../runtime-root-registry'

const LOCK_PATH = authoringStoreLockPath('project')

async function makeLock() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-lock-'))
  const registry = await RuntimeRootRegistry.create([
    { storeId: 'project-main', kind: 'project', rootPath: root },
  ])
  return { root, lock: new CrossProcessAuthoringStoreLock(registry, 'project-main') }
}

describe('CrossProcessAuthoringStoreLock', () => {
  it('excludes another owner and releases durably', async () => {
    const { root, lock } = await makeLock()
    const lease = await lock.acquire()

    await expect(lock.acquire()).rejects.toMatchObject({ code: 'AUTHORING_STORE_LOCKED', status: 409 })
    const record = JSON.parse(await fs.readFile(path.join(root, LOCK_PATH), 'utf8'))
    expect(record).toMatchObject({ schemaVersion: 1, storeId: 'project-main', token: lease.token })
    expect(JSON.stringify(record)).not.toContain(root)

    await lease.release()
    await expect(fs.readFile(path.join(root, LOCK_PATH))).rejects.toMatchObject({ code: 'ENOENT' })
    await (await lock.acquire()).release()
  })

  it('refuses a lock held by a separate process', async () => {
    const { root, lock } = await makeLock()
    const abs = path.join(root, LOCK_PATH)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    const child = spawn(process.execPath, ['-e', [
      "const fs=require('node:fs')",
      `const file=${JSON.stringify(abs)}`,
      "const fd=fs.openSync(file, fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY, 0o600)",
      "fs.writeFileSync(fd, '{}\\n')",
      "fs.fsyncSync(fd)",
      "fs.closeSync(fd)",
      "process.stdout.write('locked\\n')",
      "setInterval(()=>{}, 1000)",
    ].join(';')], { stdio: ['ignore', 'pipe', 'inherit'] })
    try {
      await once(child.stdout!, 'data')
      await expect(lock.acquire()).rejects.toMatchObject({ code: 'AUTHORING_STORE_LOCKED', status: 409 })
    } finally {
      child.kill('SIGTERM')
      await once(child, 'exit')
    }
  })

  it('names post-unlink directory-sync uncertainty without leaving a false lock', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-lock-sync-'))
    const registry = await RuntimeRootRegistry.create([
      { storeId: 'project-main', kind: 'project', rootPath: root },
    ])
    let syncs = 0
    const lock = new CrossProcessAuthoringStoreLock(registry, 'project-main', async () => {
      syncs += 1
      if (syncs === 2) throw new Error('injected release sync failure')
    })
    const lease = await lock.acquire()

    await expect(lease.release()).rejects.toMatchObject({ code: 'AUTHORING_LOCK_RELEASE_UNCERTAIN' })
    await expect(fs.readFile(path.join(root, LOCK_PATH))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses replaced ownership tokens and corrupt lock records', async () => {
    const replaced = await makeLock()
    const replacedLease = await replaced.lock.acquire()
    const replacedPath = path.join(replaced.root, LOCK_PATH)
    const originalRecord = JSON.parse(await fs.readFile(replacedPath, 'utf8'))
    await fs.writeFile(replacedPath, JSON.stringify({ ...originalRecord, token: 'another-owner' }) + '\n')
    await expect(replacedLease.release()).rejects.toMatchObject({ code: 'AUTHORING_LOCK_OWNERSHIP_LOST' })
    await expect(fs.readFile(replacedPath, 'utf8')).resolves.toContain('another-owner')

    const corrupt = await makeLock()
    const corruptLease = await corrupt.lock.acquire()
    const corruptPath = path.join(corrupt.root, LOCK_PATH)
    await fs.writeFile(corruptPath, 'not-json\n')
    await expect(corruptLease.release()).rejects.toMatchObject({ code: 'AUTHORING_LOCK_RECORD_INVALID' })
    await expect(fs.readFile(corruptPath, 'utf8')).resolves.toBe('not-json\n')
  })

  it('uses the global root lock location instead of the project-nested path', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-global-lock-'))
    const registry = await RuntimeRootRegistry.create([
      { storeId: 'global-main', kind: 'global', rootPath: root },
    ])
    const lease = await new CrossProcessAuthoringStoreLock(registry, 'global-main').acquire()

    await expect(fs.readFile(path.join(root, authoringStoreLockPath('global')), 'utf8')).resolves.toContain('global-main')
    await expect(fs.readFile(path.join(root, LOCK_PATH), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await lease.release()
  })

  it('names a missing ownership record without guessing', async () => {
    const { root, lock } = await makeLock()
    const lease = await lock.acquire()
    await fs.unlink(path.join(root, LOCK_PATH))

    await expect(lease.release()).rejects.toMatchObject({ code: 'AUTHORING_LOCK_MISSING' })
  })

  it('reclaims a valid lock only after its owner process has exited', async () => {
    const { root, lock } = await makeLock()
    const abs = path.join(root, LOCK_PATH)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    const child = spawn(process.execPath, ['-e', [
      "const fs=require('node:fs')",
      `const file=${JSON.stringify(abs)}`,
      "const record={schemaVersion:1,storeId:'project-main',token:'dead-owner',pid:process.pid}",
      "const fd=fs.openSync(file, fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY, 0o600)",
      "fs.writeFileSync(fd, JSON.stringify(record)+'\\n')",
      "fs.fsyncSync(fd)",
      "fs.closeSync(fd)",
    ].join(';')])
    await once(child, 'exit')

    const recovered = await lock.acquireForRecovery()

    expect(recovered.token).not.toBe('dead-owner')
    await recovered.release()
  })

  it('does not reclaim a lock owned by a live process', async () => {
    const { lock } = await makeLock()
    const active = await lock.acquire()

    await expect(lock.acquireForRecovery()).rejects.toMatchObject({ code: 'AUTHORING_STORE_LOCKED' })
    await active.release()
  })
})
