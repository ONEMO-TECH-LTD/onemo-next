import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { CrossProcessAuthoringStoreLock } from '../authoring-lock'
import { RuntimeRootRegistry } from '../runtime-root-registry'

const LOCK_PATH = 'src/app/(dev)/react-figma-components/.onemo/locks/store.lock'

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
})
