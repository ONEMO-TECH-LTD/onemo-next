import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AuthoringSidecarStore, PROJECT_AUTHORING_SIDECAR } from '../authoring-store'
import { RuntimeRootRegistry } from '../runtime-root-registry'

const SOURCE_FILE = 'src/app/(dev)/react-figma-components/Button.tsx'

async function makeStore() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-store-'))
  await fs.mkdir(path.dirname(path.join(root, SOURCE_FILE)), { recursive: true })
  await fs.writeFile(path.join(root, SOURCE_FILE), 'export function Button() { return <button /> }\n')
  const registry = await RuntimeRootRegistry.create([
    { storeId: 'project-main', kind: 'project', rootPath: root },
  ])
  return {
    root,
    store: new AuthoringSidecarStore({ storeId: 'project-main', rootKind: 'project', registry }),
  }
}

describe('AuthoringSidecarStore', () => {
  it('commits a project-root sidecar with revision and exact source hashes', async () => {
    const { root, store } = await makeStore()

    const graph = await store.commit({ expectedRevision: 0, sourceFiles: [SOURCE_FILE] })

    expect(graph.revision).toBe(1)
    expect(graph.sourceHashes[SOURCE_FILE]).toMatch(/^[a-f0-9]{64}$/)
    const raw = await fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR), 'utf8')
    expect(raw).not.toContain(root)
    expect(JSON.parse(raw)).toMatchObject({
      schemaVersion: 1,
      storeId: 'project-main',
      root: { kind: 'project' },
      revision: 1,
    })
  })

  it('rejects stale revisions instead of overwriting sidecar state', async () => {
    const { store } = await makeStore()
    await store.commit({ expectedRevision: 0, sourceFiles: [SOURCE_FILE] })

    await expect(store.commit({ expectedRevision: 0, sourceFiles: [SOURCE_FILE] }))
      .rejects.toMatchObject({ code: 'AUTHORING_REVISION_STALE', status: 409 })
  })

  it('updates hashes from exact source bytes on the next revision', async () => {
    const { root, store } = await makeStore()
    const first = await store.commit({ expectedRevision: 0, sourceFiles: [SOURCE_FILE] })
    await fs.writeFile(path.join(root, SOURCE_FILE), 'export function Button() { return <button>Changed</button> }\n')

    const second = await store.commit({ expectedRevision: 1, sourceFiles: [SOURCE_FILE] })

    expect(second.revision).toBe(2)
    expect(second.sourceHashes[SOURCE_FILE]).not.toBe(first.sourceHashes[SOURCE_FILE])
  })

  it('enforces expected per-file source hashes before accepting a commit', async () => {
    const { root, store } = await makeStore()
    const first = await store.commit({ expectedRevision: 0, sourceFiles: [SOURCE_FILE] })
    await fs.writeFile(path.join(root, SOURCE_FILE), 'export function Button() { return <button>Hand edit</button> }\n')

    await expect(store.commit({
      expectedRevision: 1,
      sourceFiles: [SOURCE_FILE],
      expectedSourceHashes: first.sourceHashes,
    })).rejects.toMatchObject({
      code: 'SOURCE_HASH_STALE',
      status: 409,
      changedPaths: [SOURCE_FILE],
    })
  })
})
