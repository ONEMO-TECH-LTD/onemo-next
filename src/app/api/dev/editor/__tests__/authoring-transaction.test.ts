import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { AuthoringSidecarStore } from '../authoring-store'
import { SingleRootAuthoringTransaction, discoverSingleRootRecoveryDecisions, executeSingleRootRecovery } from '../authoring-transaction'
import { RuntimeRootRegistry } from '../runtime-root-registry'

async function makeTransaction() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-tx-'))
  const sourceFile = 'src/app/(dev)/react-figma-components/Button.tsx'
  await fs.mkdir(path.dirname(path.join(root, sourceFile)), { recursive: true })
  await fs.writeFile(path.join(root, sourceFile), 'export function Button() { return <button /> }\n')
  const registry = await RuntimeRootRegistry.create([
    { storeId: 'project-main', kind: 'project', rootPath: root },
  ])
  const store = new AuthoringSidecarStore({ storeId: 'project-main', rootKind: 'project', registry })
  return {
    root,
    sourceFile,
    registry,
    store,
    tx: new SingleRootAuthoringTransaction({
      transactionId: 'tx-1',
      storeId: 'project-main',
      registry,
      store,
    }),
  }
}

describe('SingleRootAuthoringTransaction', () => {
  it('writes participant prepare and commit records around a sidecar revision', async () => {
    const { root, tx } = await makeTransaction()

    const graph = await tx.commit({
      expectedRevision: 0,
      mutate: (draft) => ({
        ...draft,
        folders: {
          folder_a: { id: 'folder_a', name: 'Buttons', parentId: null, sortKey: 'a' },
        },
      }),
    })

    expect(graph.revision).toBe(1)
    const participant = JSON.parse(await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/participant.json'),
      'utf8',
    ))
    expect(participant).toMatchObject({
      transactionId: 'tx-1',
      storeId: 'project-main',
      coordinator: {
        storeId: 'project-main',
        relativeTransactionPath: 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/participant.json',
      },
      participants: ['project-main'],
      status: 'committed',
      beforeRevision: 0,
      afterRevision: 1,
    })
    expect(JSON.stringify(participant)).not.toContain(root)
  })

  it('rejects stale revision before preparing a transaction', async () => {
    const { tx } = await makeTransaction()
    await tx.commit({ expectedRevision: 0, mutate: (draft) => draft })

    await expect(tx.commit({ expectedRevision: 0, mutate: (draft) => draft }))
      .rejects.toMatchObject({ code: 'AUTHORING_REVISION_STALE', status: 409 })
  })

  it('serializes the live transaction path with a filesystem lock', async () => {
    const { registry, store, tx } = await makeTransaction()
    const competing = new SingleRootAuthoringTransaction({
      transactionId: 'tx-2',
      storeId: 'project-main',
      registry,
      store,
    })

    const results = await Promise.allSettled([
      tx.commit({ expectedRevision: 0, mutate: (draft) => draft }),
      competing.commit({ expectedRevision: 0, mutate: (draft) => draft }),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejection = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    expect(rejection?.reason).toMatchObject({ code: 'AUTHORING_STORE_LOCKED', status: 409 })
    expect((await store.load())?.revision).toBe(1)
  })

  it('persists exact source hashes during transaction commit and updates them after byte edits', async () => {
    const { root, sourceFile, tx } = await makeTransaction()

    const first = await tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      mutate: (draft) => draft,
    })
    await fs.writeFile(path.join(root, sourceFile), 'export function Button() { return <button>Changed</button> }\n')
    const second = await tx.commit({
      expectedRevision: 1,
      sourceFiles: [sourceFile],
      mutate: (draft) => draft,
    })

    expect(first.sourceHashes[sourceFile]).toMatch(/^[a-f0-9]{64}$/)
    expect(second.sourceHashes[sourceFile]).toMatch(/^[a-f0-9]{64}$/)
    expect(second.sourceHashes[sourceFile]).not.toBe(first.sourceHashes[sourceFile])
    const persisted = JSON.parse(await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/authoring-v1.json'),
      'utf8',
    ))
    expect(persisted.sourceHashes[sourceFile]).toBe(second.sourceHashes[sourceFile])
  })

  it('rejects stale source hashes before preparing a transaction', async () => {
    const { root, sourceFile, store, tx } = await makeTransaction()
    const hashes = await store.computeSourceHashes([sourceFile])
    await fs.writeFile(path.join(root, sourceFile), 'export function Button() { return <button>Hand edit</button> }\n')

    await expect(tx.commit({
      expectedRevision: 0,
      expectedSourceHashes: hashes,
      mutate: (draft) => draft,
    })).rejects.toMatchObject({
      code: 'SOURCE_HASH_STALE',
      status: 409,
      changedPaths: [sourceFile],
    })

    await expect(fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/participant.json'),
      'utf8',
    )).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rolls back a prepared sidecar record to the supplied preimage', async () => {
    const { root, store, tx } = await makeTransaction()
    const preimage = await store.loadOrCreate()
    const graph = await tx.commit({
      expectedRevision: 0,
      mutate: (draft) => ({
        ...draft,
        folders: {
          folder_a: { id: 'folder_a', name: 'Buttons', parentId: null, sortKey: 'a' },
        },
      }),
    })
    const prepared = {
      transactionId: 'tx-rollback',
      storeId: 'project-main',
      coordinator: {
        storeId: 'project-main',
        relativeTransactionPath: 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-rollback/participant.json',
      },
      participants: ['project-main'],
      status: 'prepared' as const,
      beforeRevision: preimage.revision,
      afterRevision: graph.revision,
      beforeSidecarHash: null,
      afterSidecarHash: 'b'.repeat(64),
    }

    await tx.rollbackPrepared(preimage, prepared)

    const rolledBack = await store.load()
    expect(rolledBack?.revision).toBe(0)
    const participant = JSON.parse(await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-rollback/participant.json'),
      'utf8',
    ))
    expect(participant.status).toBe('rolled-back')
  })

  it('marks a prepared transaction rolled back when sidecar save fails before commit decision', async () => {
    const { root, store, tx } = await makeTransaction()
    vi.spyOn(store, 'save')
      .mockRejectedValueOnce(Object.assign(new Error('sidecar write failed'), { code: 'INJECTED_SAVE_FAILURE' }))

    await expect(tx.commit({
      expectedRevision: 0,
      mutate: (draft) => ({
        ...draft,
        folders: {
          folder_a: { id: 'folder_a', name: 'Buttons', parentId: null, sortKey: 'a' },
        },
      }),
    })).rejects.toMatchObject({ code: 'INJECTED_SAVE_FAILURE' })

    const participant = JSON.parse(await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/participant.json'),
      'utf8',
    ))
    expect(participant.status).toBe('rolled-back')
    await expect(fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/authoring-v1.json'),
      'utf8',
    )).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('discovers single-root participant records and classifies restart decisions', async () => {
    const { root, tx } = await makeTransaction()
    await tx.commit({ expectedRevision: 0, mutate: (draft) => draft })
    const transactionsRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')
    await fs.mkdir(path.join(transactionsRoot, 'tx-prepared'), { recursive: true })
    await fs.writeFile(path.join(transactionsRoot, 'tx-prepared', 'participant.json'), JSON.stringify({
      transactionId: 'tx-prepared',
      storeId: 'project-main',
      coordinator: { storeId: 'project-main', relativeTransactionPath: 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-prepared/participant.json' },
      participants: ['project-main'],
      status: 'prepared',
      beforeRevision: 1,
      afterRevision: 2,
      beforeSidecarHash: 'a'.repeat(64),
      afterSidecarHash: 'b'.repeat(64),
    }))
    await fs.mkdir(path.join(transactionsRoot, 'tx-rolled-back'), { recursive: true })
    await fs.writeFile(path.join(transactionsRoot, 'tx-rolled-back', 'participant.json'), JSON.stringify({
      transactionId: 'tx-rolled-back',
      storeId: 'project-main',
      coordinator: { storeId: 'project-main', relativeTransactionPath: 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-rolled-back/participant.json' },
      participants: ['project-main'],
      status: 'rolled-back',
      beforeRevision: 1,
      afterRevision: 2,
      beforeSidecarHash: 'a'.repeat(64),
      afterSidecarHash: 'b'.repeat(64),
    }))

    const registry = await RuntimeRootRegistry.create([
      { storeId: 'project-main', kind: 'project', rootPath: root },
    ])
    const decisions = await discoverSingleRootRecoveryDecisions({ storeId: 'project-main', registry })

    expect(decisions.map((decision) => [decision.transactionId, decision.decision])).toEqual([
      ['tx-1', 'finish-committed'],
      ['tx-prepared', 'rollback-prepared'],
      ['tx-rolled-back', 'ignore-rolled-back'],
    ])
    expect(JSON.stringify(decisions)).not.toContain(root)
  })

  it('executes single-root recovery decisions for prepared, committed, and rolled-back records', async () => {
    const { root, store } = await makeTransaction()
    const preimage = await store.loadOrCreate()
    await store.save({
      ...preimage,
      revision: 1,
      folders: {
        folder_a: { id: 'folder_a', name: 'Partial', parentId: null, sortKey: 'a' },
      },
    })
    const transactionsRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')
    await fs.mkdir(path.join(transactionsRoot, 'tx-prepared'), { recursive: true })
    await fs.writeFile(path.join(transactionsRoot, 'tx-prepared', 'participant.json'), JSON.stringify({
      transactionId: 'tx-prepared',
      storeId: 'project-main',
      coordinator: { storeId: 'project-main', relativeTransactionPath: 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-prepared/participant.json' },
      participants: ['project-main'],
      status: 'prepared',
      beforeRevision: 0,
      afterRevision: 1,
      beforeSidecarHash: 'a'.repeat(64),
      afterSidecarHash: 'b'.repeat(64),
    }))
    await fs.mkdir(path.join(transactionsRoot, 'tx-committed'), { recursive: true })
    await fs.writeFile(path.join(transactionsRoot, 'tx-committed', 'participant.json'), JSON.stringify({
      transactionId: 'tx-committed',
      storeId: 'project-main',
      coordinator: { storeId: 'project-main', relativeTransactionPath: 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-committed/participant.json' },
      participants: ['project-main'],
      status: 'committed',
      beforeRevision: 1,
      afterRevision: 2,
      beforeSidecarHash: 'c'.repeat(64),
      afterSidecarHash: 'd'.repeat(64),
    }))
    await fs.mkdir(path.join(transactionsRoot, 'tx-rolled-back'), { recursive: true })
    await fs.writeFile(path.join(transactionsRoot, 'tx-rolled-back', 'participant.json'), JSON.stringify({
      transactionId: 'tx-rolled-back',
      storeId: 'project-main',
      coordinator: { storeId: 'project-main', relativeTransactionPath: 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-rolled-back/participant.json' },
      participants: ['project-main'],
      status: 'rolled-back',
      beforeRevision: 1,
      afterRevision: 2,
      beforeSidecarHash: 'e'.repeat(64),
      afterSidecarHash: 'f'.repeat(64),
    }))
    const registry = await RuntimeRootRegistry.create([
      { storeId: 'project-main', kind: 'project', rootPath: root },
    ])

    const results = await executeSingleRootRecovery({
      storeId: 'project-main',
      registry,
      store,
      preimages: { 'tx-prepared': preimage },
    })

    expect(results).toEqual([
      { transactionId: 'tx-committed', action: 'finished-committed' },
      { transactionId: 'tx-prepared', action: 'rolled-back-prepared' },
      { transactionId: 'tx-rolled-back', action: 'ignored-rolled-back' },
    ])
    expect((await store.load())?.revision).toBe(0)
    const prepared = JSON.parse(await fs.readFile(path.join(transactionsRoot, 'tx-prepared', 'participant.json'), 'utf8'))
    const committed = JSON.parse(await fs.readFile(path.join(transactionsRoot, 'tx-committed', 'participant.json'), 'utf8'))
    expect(prepared.status).toBe('rolled-back')
    expect(committed.status).toBe('committed')
    expect(JSON.stringify(results)).not.toContain(root)
  })
})
