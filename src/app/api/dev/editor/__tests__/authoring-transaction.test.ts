import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { authoringStoreLockPath, CrossProcessAuthoringStoreLock } from '../authoring-lock'
import { AuthoringSidecarStore } from '../authoring-store'
import { SingleRootAuthoringTransaction, discoverSingleRootRecoveryDecisions, executeSingleRootRecovery, type AuthoringTransactionHooks } from '../authoring-transaction'
import { DurableFileInstaller, sha256 } from '../durable-file-installer'
import { RuntimeRootRegistry } from '../runtime-root-registry'

type ParticipantGraphFixture = {
  sidecar: { after: unknown }
  graphPatches: Array<{ before: unknown }>
  inverse: Array<{ after: unknown }>
}

const require = createRequire(import.meta.url)
const VITE_NODE = require.resolve('vite-node/vite-node.mjs')
const CRASH_FIXTURE = fileURLToPath(new URL('fixtures/transaction-crash-child.ts', import.meta.url))

async function makeTransaction(hooks?: AuthoringTransactionHooks) {
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
      hooks,
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
      schemaVersion: 1,
      transactionId: 'tx-1',
      storeId: 'project-main',
      coordinator: {
        storeId: 'project-main',
        relativeTransactionPath: 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/coordinator.json',
      },
      participants: ['project-main'],
      status: 'committed',
      beforeRevision: 0,
      afterRevision: 1,
      files: [],
      sidecar: { file: 'src/app/(dev)/react-figma-components/.onemo/authoring-v1.json', before: null },
      graphPatches: [{ kind: 'replace-graph', before: null }],
      inverse: [{ kind: 'replace-graph', after: null }],
    })
    const coordinator = JSON.parse(await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/coordinator.json'),
      'utf8',
    ))
    expect(coordinator).toMatchObject({ transactionId: 'tx-1', status: 'committed' })
    expect(participant.sidecar.after.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(participant.graphPatches[0].after).toEqual(participant.sidecar.after)
    expect(participant.inverse[0].before).toEqual(participant.sidecar.after)
    await expect(fs.readFile(path.join(root, participant.sidecar.after.path))).resolves.toBeTruthy()
    expect(JSON.stringify(participant)).not.toContain(root)
  })

  it('durably creates a new source file with a null preimage and records its exact hash', async () => {
    const { root, tx } = await makeTransaction()
    const file = 'src/app/(dev)/react-figma-components/Card.tsx'
    const bytes = 'export function Card() { return <section /> }\n'

    const graph = await tx.commit({
      expectedRevision: 0,
      sourceFiles: [file],
      sourcePatches: [{ file, before: null, after: bytes }],
      mutate: (draft) => draft,
    })

    await expect(fs.readFile(path.join(root, file), 'utf8')).resolves.toBe(bytes)
    expect(graph.sourceHashes[file]).toBe(sha256(bytes))
    const participant = JSON.parse(await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/participant.json'),
      'utf8',
    ))
    expect(participant.files).toEqual([expect.objectContaining({ file, before: null, after: expect.any(Object) })])
  })

  it('removes a newly created source file when failure occurs before the commit decision', async () => {
    const { root, tx } = await makeTransaction({ afterSourceInstall: () => { throw new Error('injected create failure') } })
    const file = 'src/app/(dev)/react-figma-components/Card.tsx'

    await expect(tx.commit({
      expectedRevision: 0,
      sourceFiles: [file],
      sourcePatches: [{ file, before: null, after: 'export function Card() { return <section /> }\n' }],
      mutate: (draft) => draft,
    })).rejects.toThrow('injected create failure')

    await expect(fs.readFile(path.join(root, file))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readFile(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/authoring-v1.json')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses a null source preimage when the target already exists', async () => {
    const { root, tx } = await makeTransaction()
    const file = 'src/app/(dev)/react-figma-components/Card.tsx'
    await fs.writeFile(path.join(root, file), 'existing bytes')

    await expect(tx.commit({
      expectedRevision: 0,
      sourceFiles: [file],
      sourcePatches: [{ file, before: null, after: 'replacement bytes' }],
      mutate: (draft) => draft,
    })).rejects.toMatchObject({ code: 'SOURCE_PREIMAGE_STALE', changedPaths: [file] })
    await expect(fs.readFile(path.join(root, file), 'utf8')).resolves.toBe('existing bytes')
  })

  it('durably deletes a source file when applying the inverse of creation', async () => {
    const { root, registry, store, tx } = await makeTransaction()
    const file = 'src/app/(dev)/react-figma-components/Card.tsx'
    const bytes = 'export function Card() { return <section /> }\n'
    await tx.commit({
      expectedRevision: 0,
      sourceFiles: [file],
      sourcePatches: [{ file, before: null, after: bytes }],
      mutate: (draft) => draft,
    })

    const graph = await new SingleRootAuthoringTransaction({
      transactionId: 'tx-2', storeId: 'project-main', registry, store,
    }).commit({
      expectedRevision: 1,
      sourceFiles: [file],
      expectedSourceHashes: { [file]: sha256(bytes) },
      sourcePatches: [{ file, before: bytes, after: null }],
      mutate: (draft) => draft,
    })

    await expect(fs.readFile(path.join(root, file))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(graph.sourceHashes[file]).toBeUndefined()
    const participant = JSON.parse(await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-2/participant.json'),
      'utf8',
    ))
    expect(participant.files).toEqual([expect.objectContaining({ file, before: expect.any(Object), after: null })])
  })

  it('rejects stale revision before preparing a transaction', async () => {
    const { tx } = await makeTransaction()
    await tx.commit({ expectedRevision: 0, mutate: (draft) => draft })

    await expect(tx.commit({ expectedRevision: 0, mutate: (draft) => draft }))
      .rejects.toMatchObject({ code: 'AUTHORING_REVISION_STALE', status: 409 })
  })

  it('refuses reuse of a durable transaction identity', async () => {
    const { tx } = await makeTransaction()
    await tx.commit({ expectedRevision: 0, mutate: (draft) => draft })

    await expect(tx.commit({ expectedRevision: 1, mutate: (draft) => draft }))
      .rejects.toMatchObject({ code: 'TRANSACTION_ID_EXISTS', status: 409 })
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
    const { root, sourceFile, registry, store, tx } = await makeTransaction()

    const first = await tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      expectedSourceHashes: await store.computeSourceHashes([sourceFile]),
      mutate: (draft) => draft,
    })
    await fs.writeFile(path.join(root, sourceFile), 'export function Button() { return <button>Changed</button> }\n')
    const second = await new SingleRootAuthoringTransaction({
      transactionId: 'tx-2',
      storeId: 'project-main',
      registry,
      store,
    }).commit({
      expectedRevision: 1,
      sourceFiles: [sourceFile],
      expectedSourceHashes: await store.computeSourceHashes([sourceFile]),
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

  it('requires an expected hash for every listed source before preparing', async () => {
    const { root, sourceFile, tx } = await makeTransaction()

    await expect(tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      mutate: (draft) => draft,
    })).rejects.toMatchObject({
      code: 'SOURCE_HASH_PRECONDITION_REQUIRED',
      status: 422,
      changedPaths: [sourceFile],
    })
    await expect(fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/participant.json'),
    )).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses source and history patches that cross metadata namespaces', async () => {
    const { sourceFile, tx } = await makeTransaction()

    await expect(tx.commit({
      expectedRevision: 0,
      sourcePatches: [{
        file: 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson',
        before: '',
        after: 'bad',
      }],
      mutate: (draft) => draft,
    })).rejects.toMatchObject({ code: 'SOURCE_PATCH_PATH_INVALID' })
    await expect(tx.commit({
      expectedRevision: 0,
      metadataPatches: [{ file: sourceFile, before: null, after: 'bad' }],
      mutate: (draft) => draft,
    })).rejects.toMatchObject({ code: 'METADATA_PATCH_PATH_INVALID' })
  })

  it.each([
    {
      label: 'source',
      update: { sourcePatches: [{ file: 'src/app/(dev)/react-figma-components/Missing.tsx', before: null, after: null }] },
      code: 'SOURCE_PATCH_EMPTY',
    },
    {
      label: 'metadata',
      update: { metadataPatches: [{ file: 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson', before: null, after: null }] },
      code: 'METADATA_PATCH_EMPTY',
    },
  ])('refuses an empty $label patch before durable evidence and permits the same transaction ID afterward', async ({ update, code }) => {
    const { root, tx } = await makeTransaction()
    const transactionRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1')

    await expect(tx.commit({ expectedRevision: 0, ...update, mutate: (draft) => draft }))
      .rejects.toMatchObject({ code, status: 422 })
    await expect(fs.lstat(transactionRoot)).rejects.toMatchObject({ code: 'ENOENT' })

    await expect(tx.commit({ expectedRevision: 0, mutate: (draft) => draft }))
      .resolves.toMatchObject({ revision: 1 })
    await expect(fs.readFile(path.join(transactionRoot, 'participant.json'), 'utf8'))
      .resolves.toContain('"status": "committed"')
  })

  it('prepares blobs and both records before source mutation, then restores them on failure', async () => {
    let root = ''
    let sourceFile = ''
    const transactions = () => path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1')
    const txFixture = await makeTransaction({
      afterPrepare: async () => {
        expect(JSON.parse(await fs.readFile(path.join(transactions(), 'participant.json'), 'utf8')).status).toBe('prepared')
        expect(JSON.parse(await fs.readFile(path.join(transactions(), 'coordinator.json'), 'utf8')).status).toBe('prepared')
        expect(await fs.readFile(path.join(root, sourceFile), 'utf8'))
          .toBe('export function Button() { return <button /> }\n')
      },
      afterSourceInstall: async () => {
        expect(await fs.readFile(path.join(root, sourceFile), 'utf8')).toBe('after\n')
      },
      afterMetadataInstall: async () => {
        expect(await fs.readFile(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'), 'utf8'))
          .toBe('{"planned":true}\n')
        throw Object.assign(new Error('injected after-metadata failure'), { code: 'INJECTED_METADATA_FAILURE' })
      },
    })
    ;({ root, sourceFile } = txFixture)
    const before = await fs.readFile(path.join(root, sourceFile), 'utf8')

    await expect(txFixture.tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      expectedSourceHashes: { [sourceFile]: sha256(before) },
      sourcePatches: [{ file: sourceFile, before, after: 'after\n' }],
      metadataPatches: [{
        file: 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson',
        before: null,
        after: '{"planned":true}\n',
      }],
      command: { kind: 'test-source-install' },
      mutate: (draft) => draft,
    })).rejects.toMatchObject({ code: 'INJECTED_METADATA_FAILURE' })

    const participant = JSON.parse(await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/participant.json'),
      'utf8',
    ))
    expect(participant.status).toBe('rolled-back')
    expect(participant.files[0]).toMatchObject({ file: sourceFile })
    expect(participant.files[0].before.sha256).not.toBe(participant.files[0].after.sha256)
    expect(participant.metadata).toHaveLength(1)
    await expect(fs.readFile(path.join(root, sourceFile), 'utf8')).resolves.toBe(before)
    await expect(fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/authoring-v1.json'),
      'utf8',
    )).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'),
      'utf8',
    )).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves RECOVERY_REQUIRED when lock release also fails', async () => {
    const { registry, store } = await makeTransaction()
    let syncs = 0
    const lock = new CrossProcessAuthoringStoreLock(registry, 'project-main', async () => {
      syncs += 1
      if (syncs === 2) throw new Error('injected release sync failure')
    })
    const tx = new SingleRootAuthoringTransaction({
      transactionId: 'tx-dual-failure',
      storeId: 'project-main',
      registry,
      store,
      lock,
      hooks: { afterCoordinatorCommit: () => { throw new Error('injected post-decision failure') } },
    })

    await expect(tx.commit({ expectedRevision: 0, mutate: (draft) => draft })).rejects.toMatchObject({
      code: 'RECOVERY_REQUIRED',
      releaseError: { code: 'AUTHORING_LOCK_RELEASE_UNCERTAIN' },
    })
  })

  it('never rolls back a coordinator decision installed with uncertain directory sync', async () => {
    const { root, registry, store } = await makeTransaction()
    class UncertainCoordinatorInstaller extends DurableFileInstaller {
      override async writeJsonAtomic(absPath: string, value: unknown) {
        const result = await super.writeJsonAtomic(absPath, value)
        if ((value as { status?: unknown; participantPaths?: unknown }).status === 'committed' &&
          Array.isArray((value as { participantPaths?: unknown }).participantPaths)) {
          throw Object.assign(new Error('injected coordinator uncertainty'), { code: 'DURABLE_INSTALL_UNCERTAIN' })
        }
        return result
      }
    }
    const tx = new SingleRootAuthoringTransaction({
      transactionId: 'tx-uncertain-decision',
      storeId: 'project-main',
      registry,
      store,
      installer: new UncertainCoordinatorInstaller(),
    })

    await expect(tx.commit({ expectedRevision: 0, mutate: (draft) => draft }))
      .rejects.toMatchObject({ code: 'RECOVERY_REQUIRED' })
    const txRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-uncertain-decision')
    expect(JSON.parse(await fs.readFile(path.join(txRoot, 'coordinator.json'), 'utf8')).status).toBe('committed')
    expect(JSON.parse(await fs.readFile(path.join(txRoot, 'participant.json'), 'utf8')).status).toBe('prepared')
    expect((await store.load())?.revision).toBe(1)
  })

  it('writes global participant state under the global root metadata directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-global-tx-'))
    await fs.writeFile(path.join(root, 'Button.tsx'), 'before\n')
    const registry = await RuntimeRootRegistry.create([
      { storeId: 'global-main', kind: 'global', rootPath: root },
    ])
    const store = new AuthoringSidecarStore({
      storeId: 'global-main',
      rootKind: 'global',
      registry,
    })
    const tx = new SingleRootAuthoringTransaction({ transactionId: 'tx-global', storeId: 'global-main', registry, store })

    await tx.commit({
      expectedRevision: 0,
      sourceFiles: ['Button.tsx'],
      expectedSourceHashes: { 'Button.tsx': sha256('before\n') },
      sourcePatches: [{ file: 'Button.tsx', before: 'before\n', after: 'after\n' }],
      mutate: (draft) => draft,
    })

    await expect(fs.readFile(path.join(root, '.onemo/transactions/tx-global/coordinator.json'), 'utf8'))
      .resolves.toContain('committed')
    await expect(fs.readFile(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-global/coordinator.json')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('uses the coordinator as the sole restart decision', async () => {
    const { root, registry, store, tx } = await makeTransaction()
    await tx.commit({ expectedRevision: 0, mutate: (draft) => draft })
    const txRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1')
    const participantPath = path.join(txRoot, 'participant.json')
    const coordinatorPath = path.join(txRoot, 'coordinator.json')

    expect((await discoverSingleRootRecoveryDecisions({ storeId: 'project-main', registry }))[0]?.decision)
      .toBe('ignore-committed')

    const coordinator = JSON.parse(await fs.readFile(coordinatorPath, 'utf8'))
    await fs.writeFile(coordinatorPath, JSON.stringify({ ...coordinator, status: 'prepared' }))
    expect((await discoverSingleRootRecoveryDecisions({ storeId: 'project-main', registry }))[0]?.decision)
      .toBe('rollback-prepared')

    const participant = JSON.parse(await fs.readFile(participantPath, 'utf8'))
    await fs.writeFile(participantPath, JSON.stringify({ ...participant, status: 'prepared' }))
    await fs.writeFile(coordinatorPath, JSON.stringify({ ...coordinator, status: 'rolled-back' }))
    expect((await discoverSingleRootRecoveryDecisions({ storeId: 'project-main', registry }))[0]?.decision)
      .toBe('finish-rolled-back')
    expect(await executeSingleRootRecovery({ storeId: 'project-main', registry, store }))
      .toEqual([{ transactionId: 'tx-1', action: 'finished-rolled-back' }])
    expect(JSON.parse(await fs.readFile(participantPath, 'utf8')).status).toBe('rolled-back')
    expect(await executeSingleRootRecovery({ storeId: 'project-main', registry, store }))
      .toEqual([{ transactionId: 'tx-1', action: 'ignored-rolled-back' }])
  })

  it('refuses a new commit while older prepared recovery evidence is unresolved', async () => {
    const { root, sourceFile, registry, store, tx } = await makeTransaction()
    const before = await fs.readFile(path.join(root, sourceFile), 'utf8')
    await tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      expectedSourceHashes: { [sourceFile]: sha256(before) },
      sourcePatches: [{ file: sourceFile, before, after: 'first committed bytes\n' }],
      mutate: (draft) => draft,
    })
    const txRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1')
    for (const name of ['participant.json', 'coordinator.json']) {
      const file = path.join(txRoot, name)
      const record = JSON.parse(await fs.readFile(file, 'utf8'))
      await fs.writeFile(file, JSON.stringify({ ...record, status: 'prepared' }))
    }
    const next = new SingleRootAuthoringTransaction({
      transactionId: 'tx-2',
      storeId: 'project-main',
      registry,
      store,
    })

    await expect(next.commit({
      expectedRevision: 1,
      sourceFiles: [sourceFile],
      expectedSourceHashes: { [sourceFile]: sha256('first committed bytes\n') },
      sourcePatches: [{ file: sourceFile, before: 'first committed bytes\n', after: 'must not install\n' }],
      mutate: (draft) => draft,
    })).rejects.toMatchObject({ code: 'RECOVERY_REQUIRED', status: 409, transactionIds: ['tx-1'] })

    await expect(fs.readFile(path.join(root, sourceFile), 'utf8')).resolves.toBe('first committed bytes\n')
    expect((await store.load())?.revision).toBe(1)
    await expect(fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-2/participant.json'),
    )).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('converges a rolled-back participant and prepared coordinator in the other direction', async () => {
    const { root, registry, store, tx } = await makeTransaction()
    await tx.commit({ expectedRevision: 0, mutate: (draft) => draft })
    const txRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1')
    const participantPath = path.join(txRoot, 'participant.json')
    const coordinatorPath = path.join(txRoot, 'coordinator.json')
    const participant = JSON.parse(await fs.readFile(participantPath, 'utf8'))
    const coordinator = JSON.parse(await fs.readFile(coordinatorPath, 'utf8'))
    await fs.writeFile(participantPath, JSON.stringify({ ...participant, status: 'rolled-back' }))
    await fs.writeFile(coordinatorPath, JSON.stringify({ ...coordinator, status: 'prepared' }))

    expect(await executeSingleRootRecovery({ storeId: 'project-main', registry, store }))
      .toEqual([{ transactionId: 'tx-1', action: 'finished-rolled-back' }])
    expect(JSON.parse(await fs.readFile(participantPath, 'utf8')).status).toBe('rolled-back')
    expect(JSON.parse(await fs.readFile(coordinatorPath, 'utf8')).status).toBe('rolled-back')
  })

  it.each([
    { participantStatus: 'prepared', coordinatorStatus: 'rolled-back' },
    { participantStatus: 'rolled-back', coordinatorStatus: 'prepared' },
  ] as const)('restores rollback images before converging $participantStatus/$coordinatorStatus markers', async ({
    participantStatus,
    coordinatorStatus,
  }) => {
    const { root, sourceFile, registry, store, tx } = await makeTransaction()
    const sourceAbs = path.join(root, sourceFile)
    await fs.chmod(sourceAbs, 0o640)
    const before = await fs.readFile(sourceAbs, 'utf8')
    const historyFile = 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'
    const historyAbs = path.join(root, historyFile)
    const beforeHistory = '{"before":true}\n'
    await fs.mkdir(path.dirname(historyAbs), { recursive: true })
    await fs.writeFile(historyAbs, beforeHistory, { mode: 0o640 })
    await fs.chmod(historyAbs, 0o640)
    await tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      expectedSourceHashes: { [sourceFile]: sha256(before) },
      sourcePatches: [{ file: sourceFile, before, after: 'after bytes requiring rollback\n' }],
      metadataPatches: [{ file: historyFile, before: beforeHistory, after: `${beforeHistory}{"after":true}\n` }],
      mutate: (draft) => draft,
    })
    const txRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1')
    const participantPath = path.join(txRoot, 'participant.json')
    const coordinatorPath = path.join(txRoot, 'coordinator.json')
    const participant = JSON.parse(await fs.readFile(participantPath, 'utf8'))
    const coordinator = JSON.parse(await fs.readFile(coordinatorPath, 'utf8'))
    participant.files[0].after.mode = 0o600
    await fs.writeFile(participantPath, JSON.stringify({ ...participant, status: participantStatus }))
    await fs.writeFile(coordinatorPath, JSON.stringify({ ...coordinator, status: coordinatorStatus }))
    await fs.chmod(sourceAbs, 0o600)

    expect(await executeSingleRootRecovery({ storeId: 'project-main', registry, store }))
      .toEqual([{ transactionId: 'tx-1', action: 'finished-rolled-back' }])
    await expect(fs.readFile(sourceAbs, 'utf8')).resolves.toBe(before)
    expect((await fs.stat(sourceAbs)).mode & 0o777).toBe(0o640)
    expect(await store.load()).toBeNull()
    await expect(fs.readFile(historyAbs, 'utf8')).resolves.toBe(beforeHistory)
    expect((await fs.stat(historyAbs)).mode & 0o777).toBe(0o640)
    expect(JSON.parse(await fs.readFile(participantPath, 'utf8')).status).toBe('rolled-back')
    expect(JSON.parse(await fs.readFile(coordinatorPath, 'utf8')).status).toBe('rolled-back')
  })

  it('blocks new writes when the transactions directory contains a non-directory entry', async () => {
    const { root, sourceFile, tx } = await makeTransaction()
    const transactionsRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')
    await fs.mkdir(transactionsRoot, { recursive: true })
    await fs.writeFile(path.join(transactionsRoot, 'orphan-entry'), 'invalid recovery evidence\n')

    await expect(tx.commit({ expectedRevision: 0, mutate: (draft) => draft }))
      .rejects.toMatchObject({ code: 'RECOVERY_REQUIRED', transactionIds: ['orphan-entry'] })
    await expect(fs.readFile(path.join(root, sourceFile), 'utf8'))
      .resolves.toBe('export function Button() { return <button /> }\n')
    await expect(fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/authoring-v1.json'),
    )).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not replay terminal committed transactions over newer source state', async () => {
    const { root, sourceFile, registry, store, tx } = await makeTransaction()
    const before = await fs.readFile(path.join(root, sourceFile), 'utf8')
    await tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      expectedSourceHashes: { [sourceFile]: sha256(before) },
      sourcePatches: [{ file: sourceFile, before, after: 'after one\n' }],
      mutate: (draft) => draft,
    })
    await new SingleRootAuthoringTransaction({
      transactionId: 'tx-2',
      storeId: 'project-main',
      registry,
      store,
    }).commit({
      expectedRevision: 1,
      sourceFiles: [sourceFile],
      expectedSourceHashes: { [sourceFile]: sha256('after one\n') },
      sourcePatches: [{ file: sourceFile, before: 'after one\n', after: 'after two\n' }],
      mutate: (draft) => draft,
    })

    const results = await executeSingleRootRecovery({ storeId: 'project-main', registry, store })

    expect(results).toEqual([
      { transactionId: 'tx-1', action: 'ignored-committed' },
      { transactionId: 'tx-2', action: 'ignored-committed' },
    ])
    await expect(fs.readFile(path.join(root, sourceFile), 'utf8')).resolves.toBe('after two\n')
  })

  it('refuses symlinked recovery records before reading outside the store', async () => {
    const { root, registry, tx } = await makeTransaction()
    await tx.commit({ expectedRevision: 0, mutate: (draft) => draft })
    const participantPath = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/participant.json')
    const outside = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-outside-record-')), 'participant.json')
    await fs.rename(participantPath, outside)
    await fs.symlink(outside, participantPath)

    const decisions = await discoverSingleRootRecoveryDecisions({ storeId: 'project-main', registry })

    expect(decisions).toEqual([expect.objectContaining({ transactionId: 'tx-1', decision: 'invalid-record' })])
    expect((decisions[0] as { reason: string }).reason).toContain('symlink')
  })

  it('classifies malformed participant blob evidence as invalid', async () => {
    const { root, registry, tx } = await makeTransaction()
    await tx.commit({ expectedRevision: 0, mutate: (draft) => draft })
    const participantPath = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/participant.json')
    const participant = JSON.parse(await fs.readFile(participantPath, 'utf8'))
    participant.sidecar.after.path = '/tmp/outside-blob'
    await fs.writeFile(participantPath, JSON.stringify(participant))

    const decisions = await discoverSingleRootRecoveryDecisions({ storeId: 'project-main', registry })

    expect(decisions).toEqual([expect.objectContaining({
      transactionId: 'tx-1',
      decision: 'invalid-record',
      reason: expect.stringContaining('path'),
    })])
  })

  it.each([
    {
      label: 'forward patch',
      mutate: (participant: ParticipantGraphFixture) => { participant.graphPatches[0]!.before = participant.sidecar.after },
    },
    {
      label: 'inverse',
      mutate: (participant: ParticipantGraphFixture) => { participant.inverse[0]!.after = participant.sidecar.after },
    },
  ])('classifies a $label that diverges from sidecar images as invalid', async ({ mutate }) => {
    const { root, registry, tx } = await makeTransaction()
    await tx.commit({ expectedRevision: 0, mutate: (draft) => draft })
    const participantPath = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/participant.json')
    const participant = JSON.parse(await fs.readFile(participantPath, 'utf8'))
    mutate(participant as ParticipantGraphFixture)
    await fs.writeFile(participantPath, JSON.stringify(participant))

    const decisions = await discoverSingleRootRecoveryDecisions({ storeId: 'project-main', registry })

    expect(decisions).toEqual([expect.objectContaining({
      transactionId: 'tx-1',
      decision: 'invalid-record',
      reason: expect.stringContaining('does not match the sidecar image'),
    })])
  })

  it('rolls back prepared source and sidecar bytes from disk evidence alone', async () => {
    const { root, sourceFile, registry, store, tx } = await makeTransaction()
    const before = await fs.readFile(path.join(root, sourceFile), 'utf8')
    await tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      expectedSourceHashes: { [sourceFile]: sha256(before) },
      sourcePatches: [{ file: sourceFile, before, after: 'after\n' }],
      mutate: (draft) => draft,
    })
    const txRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1')
    for (const name of ['participant.json', 'coordinator.json']) {
      const file = path.join(txRoot, name)
      const record = JSON.parse(await fs.readFile(file, 'utf8'))
      await fs.writeFile(file, JSON.stringify({ ...record, status: 'prepared' }))
    }
    const staleLockPath = path.join(root, authoringStoreLockPath('project'))
    await fs.writeFile(staleLockPath, JSON.stringify({
      schemaVersion: 1,
      storeId: 'project-main',
      token: 'dead-process-token',
      pid: 99_999_999,
    }) + '\n')

    const results = await executeSingleRootRecovery({ storeId: 'project-main', registry, store })

    expect(results).toEqual([{ transactionId: 'tx-1', action: 'rolled-back-prepared' }])
    await expect(fs.readFile(path.join(root, sourceFile), 'utf8')).resolves.toBe(before)
    expect(await store.load()).toBeNull()
    expect(JSON.parse(await fs.readFile(path.join(txRoot, 'participant.json'), 'utf8')).status).toBe('rolled-back')
    expect(JSON.parse(await fs.readFile(path.join(txRoot, 'coordinator.json'), 'utf8')).status).toBe('rolled-back')
    await expect(fs.readFile(staleLockPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('finishes committed after-images from disk evidence alone', async () => {
    const { root, sourceFile, registry, store, tx } = await makeTransaction()
    const before = await fs.readFile(path.join(root, sourceFile), 'utf8')
    await tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      expectedSourceHashes: { [sourceFile]: sha256(before) },
      sourcePatches: [{ file: sourceFile, before, after: 'after\n' }],
      mutate: (draft) => draft,
    })
    const txRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1')
    const participantPath = path.join(txRoot, 'participant.json')
    const participant = JSON.parse(await fs.readFile(participantPath, 'utf8'))
    await fs.writeFile(participantPath, JSON.stringify({ ...participant, status: 'rolled-back' }))
    await fs.writeFile(path.join(root, sourceFile), before)
    await fs.unlink(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/authoring-v1.json'))

    const results = await executeSingleRootRecovery({ storeId: 'project-main', registry, store })

    expect(results).toEqual([{ transactionId: 'tx-1', action: 'finished-committed' }])
    await expect(fs.readFile(path.join(root, sourceFile), 'utf8')).resolves.toBe('after\n')
    expect((await store.load())?.revision).toBe(1)
    expect(JSON.parse(await fs.readFile(participantPath, 'utf8')).status).toBe('committed')
  })

  it('rolls back from durable disk evidence after a child process is killed mid-transaction', async () => {
    const { root, sourceFile, registry, store } = await makeTransaction()
    const sourceAbs = path.join(root, sourceFile)
    const before = await fs.readFile(sourceAbs, 'utf8')
    const child = spawn(process.execPath, [VITE_NODE, CRASH_FIXTURE, root, sourceFile], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      const [ready] = await once(child.stdout!, 'data')
      expect(ready.toString()).toContain('after-source-install')
      expect(await fs.readFile(sourceAbs, 'utf8')).toBe('after bytes from killed child\n')
      const txRoot = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-killed-child')
      expect(JSON.parse(await fs.readFile(path.join(txRoot, 'participant.json'), 'utf8')).status).toBe('prepared')
      expect(JSON.parse(await fs.readFile(path.join(txRoot, 'coordinator.json'), 'utf8')).status).toBe('prepared')
      await expect(fs.readFile(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/authoring-v1.json')))
        .rejects.toMatchObject({ code: 'ENOENT' })
      child.kill('SIGKILL')
      const [, signal] = await once(child, 'exit')
      expect(signal).toBe('SIGKILL')

      expect(await executeSingleRootRecovery({ storeId: 'project-main', registry, store }))
        .toEqual([{ transactionId: 'tx-killed-child', action: 'rolled-back-prepared' }])
      expect(await fs.readFile(sourceAbs, 'utf8')).toBe(before)
      expect(await store.load()).toBeNull()
      expect(JSON.parse(await fs.readFile(path.join(txRoot, 'participant.json'), 'utf8')).status).toBe('rolled-back')
      expect(JSON.parse(await fs.readFile(path.join(txRoot, 'coordinator.json'), 'utf8')).status).toBe('rolled-back')
      await expect(fs.readFile(path.join(root, authoringStoreLockPath('project'))))
        .rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }
  })

  it('refuses recovery over source bytes outside both recorded images', async () => {
    const { root, sourceFile, registry, store, tx } = await makeTransaction()
    const before = await fs.readFile(path.join(root, sourceFile), 'utf8')
    await tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      expectedSourceHashes: { [sourceFile]: sha256(before) },
      sourcePatches: [{ file: sourceFile, before, after: 'after\n' }],
      mutate: (draft) => draft,
    })
    const coordinatorPath = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/coordinator.json')
    const coordinator = JSON.parse(await fs.readFile(coordinatorPath, 'utf8'))
    await fs.writeFile(coordinatorPath, JSON.stringify({ ...coordinator, status: 'prepared' }))
    await fs.writeFile(path.join(root, sourceFile), 'hand edit\n')

    await expect(executeSingleRootRecovery({ storeId: 'project-main', registry, store }))
      .rejects.toMatchObject({ code: 'RECOVERY_CONFLICT', changedPaths: [sourceFile] })
  })

  it('refuses recovery over an unrecorded source mode change', async () => {
    const { root, sourceFile, registry, store, tx } = await makeTransaction()
    const before = await fs.readFile(path.join(root, sourceFile), 'utf8')
    await tx.commit({
      expectedRevision: 0,
      sourceFiles: [sourceFile],
      expectedSourceHashes: { [sourceFile]: sha256(before) },
      sourcePatches: [{ file: sourceFile, before, after: 'after\n' }],
      mutate: (draft) => draft,
    })
    const coordinatorPath = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions/tx-1/coordinator.json')
    const coordinator = JSON.parse(await fs.readFile(coordinatorPath, 'utf8'))
    await fs.writeFile(coordinatorPath, JSON.stringify({ ...coordinator, status: 'prepared' }))
    await fs.chmod(path.join(root, sourceFile), 0o600)

    await expect(executeSingleRootRecovery({ storeId: 'project-main', registry, store }))
      .rejects.toMatchObject({ code: 'RECOVERY_CONFLICT', changedPaths: [sourceFile] })
  })
})
