import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AuthoringSidecarStore, PROJECT_AUTHORING_SIDECAR } from '../authoring-store'
import { SingleRootAuthoringTransaction } from '../authoring-transaction'
import { RuntimeRootRegistry } from '../runtime-root-registry'

const SOURCE_FILE = 'src/app/(dev)/react-figma-components/Button.tsx'

async function makeStore() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-store-'))
  await fs.mkdir(path.dirname(path.join(root, SOURCE_FILE)), { recursive: true })
  await fs.writeFile(path.join(root, SOURCE_FILE), 'export function Button() { return <button /> }\n')
  const registry = await RuntimeRootRegistry.create([
    { storeId: 'project-main', kind: 'project', rootPath: root },
  ])
  const store = new AuthoringSidecarStore({ storeId: 'project-main', rootKind: 'project', registry })
  return {
    root,
    registry,
    store,
    tx: new SingleRootAuthoringTransaction({ transactionId: 'store-test', storeId: 'project-main', registry, store }),
  }
}

describe('AuthoringSidecarStore', () => {
  it('commits a project-root sidecar with revision and exact source hashes', async () => {
    const { root, store, tx } = await makeStore()

    const graph = await tx.commit({
      expectedRevision: 0,
      sourceFiles: [SOURCE_FILE],
      expectedSourceHashes: await store.computeSourceHashes([SOURCE_FILE]),
      mutate: (draft) => draft,
    })

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

  it('produces byte-identical sidecars after relocating the same logical store', async () => {
    const first = await makeStore()
    const relocated = await makeStore()
    expect(first.root).not.toBe(relocated.root)

    await first.tx.commit({
      expectedRevision: 0,
      sourceFiles: [SOURCE_FILE],
      expectedSourceHashes: await first.store.computeSourceHashes([SOURCE_FILE]),
      mutate: (draft) => draft,
    })
    await relocated.tx.commit({
      expectedRevision: 0,
      sourceFiles: [SOURCE_FILE],
      expectedSourceHashes: await relocated.store.computeSourceHashes([SOURCE_FILE]),
      mutate: (draft) => draft,
    })

    const firstBytes = await fs.readFile(path.join(first.root, PROJECT_AUTHORING_SIDECAR))
    const relocatedBytes = await fs.readFile(path.join(relocated.root, PROJECT_AUTHORING_SIDECAR))
    expect(relocatedBytes).toEqual(firstBytes)
    expect(relocatedBytes.toString()).not.toContain(first.root)
    expect(relocatedBytes.toString()).not.toContain(relocated.root)
  })

  it('rejects stale revisions instead of overwriting sidecar state', async () => {
    const { store, tx } = await makeStore()
    const expectedSourceHashes = await store.computeSourceHashes([SOURCE_FILE])
    await tx.commit({ expectedRevision: 0, sourceFiles: [SOURCE_FILE], expectedSourceHashes, mutate: (draft) => draft })

    await expect(tx.commit({ expectedRevision: 0, sourceFiles: [SOURCE_FILE], expectedSourceHashes, mutate: (draft) => draft }))
      .rejects.toMatchObject({ code: 'AUTHORING_REVISION_STALE', status: 409 })
  })

  it('updates hashes from exact source bytes on the next revision', async () => {
    const { root, registry, store, tx } = await makeStore()
    const first = await tx.commit({
      expectedRevision: 0,
      sourceFiles: [SOURCE_FILE],
      expectedSourceHashes: await store.computeSourceHashes([SOURCE_FILE]),
      mutate: (draft) => draft,
    })
    await fs.writeFile(path.join(root, SOURCE_FILE), 'export function Button() { return <button>Changed</button> }\n')

    const second = await new SingleRootAuthoringTransaction({
      transactionId: 'store-test-2',
      storeId: 'project-main',
      registry,
      store,
    }).commit({
      expectedRevision: 1,
      sourceFiles: [SOURCE_FILE],
      expectedSourceHashes: await store.computeSourceHashes([SOURCE_FILE]),
      mutate: (draft) => draft,
    })

    expect(second.revision).toBe(2)
    expect(second.sourceHashes[SOURCE_FILE]).not.toBe(first.sourceHashes[SOURCE_FILE])
  })

  it('updates touched hashes without dropping untouched source authority', async () => {
    const { root, registry, store, tx } = await makeStore()
    const otherFile = 'src/app/(dev)/react-figma-components/Other.tsx'
    await fs.writeFile(path.join(root, otherFile), 'export function Other() { return <div /> }\n')
    const first = await tx.commit({
      expectedRevision: 0,
      sourceFiles: [SOURCE_FILE, otherFile],
      expectedSourceHashes: await store.computeSourceHashes([SOURCE_FILE, otherFile]),
      mutate: (draft) => draft,
    })
    await fs.writeFile(path.join(root, SOURCE_FILE), 'export function Button() { return <button>Changed</button> }\n')

    const second = await new SingleRootAuthoringTransaction({
      transactionId: 'store-test-2',
      storeId: 'project-main',
      registry,
      store,
    }).commit({
      expectedRevision: 1,
      sourceFiles: [SOURCE_FILE],
      expectedSourceHashes: await store.computeSourceHashes([SOURCE_FILE]),
      mutate: (draft) => draft,
    })

    expect(second.sourceHashes[SOURCE_FILE]).not.toBe(first.sourceHashes[SOURCE_FILE])
    expect(second.sourceHashes[otherFile]).toBe(first.sourceHashes[otherFile])
  })

  it('enforces expected per-file source hashes before accepting a commit', async () => {
    const { root, registry, store, tx } = await makeStore()
    const first = await tx.commit({
      expectedRevision: 0,
      sourceFiles: [SOURCE_FILE],
      expectedSourceHashes: await store.computeSourceHashes([SOURCE_FILE]),
      mutate: (draft) => draft,
    })
    await fs.writeFile(path.join(root, SOURCE_FILE), 'export function Button() { return <button>Hand edit</button> }\n')

    await expect(new SingleRootAuthoringTransaction({
      transactionId: 'store-test-2',
      storeId: 'project-main',
      registry,
      store,
    }).commit({
      expectedRevision: 1,
      sourceFiles: [SOURCE_FILE],
      expectedSourceHashes: first.sourceHashes,
      mutate: (draft) => draft,
    })).rejects.toMatchObject({
      code: 'SOURCE_HASH_STALE',
      status: 409,
      changedPaths: [SOURCE_FILE],
    })
  })
})
