import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { classifySourceFileForImport, importSourceFileToAuthoringStore } from '../authoring-import'
import { ProjectAuthoringSession } from '../authoring-session'
import { AuthoringSidecarStore } from '../authoring-store'
import { RuntimeRootRegistry } from '../runtime-root-registry'

const FILE = 'src/app/(dev)/react-figma-components/Button.tsx'
const SOURCE = `export function Button({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {
  return <button data-variant={variant}>Button</button>
}
`

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'g2-authoring-session-'))
  await fs.mkdir(path.dirname(path.join(root, FILE)), { recursive: true })
  await fs.writeFile(path.join(root, FILE), SOURCE)
  const registry = await RuntimeRootRegistry.create([{ storeId: 'project-main', kind: 'project', rootPath: root }])
  const store = new AuthoringSidecarStore({ storeId: 'project-main', rootKind: 'project', registry })
  const classified = await classifySourceFileForImport({ storeId: 'project-main', file: FILE, registry })
  const imported = await importSourceFileToAuthoringStore({
    storeId: 'project-main', file: FILE, expectedSourceHashes: classified.sourceHashes, registry, store,
  })
  if (imported.kind !== 'imported') throw new Error(`expected import, received ${imported.kind}`)
  return { root, registry, store, graph: imported.graph }
}

describe('ProjectAuthoringSession', () => {
  it('compiles and commits native variant source, graph, hashes, and history through one G1 transaction', async () => {
    const { root, registry, store, graph } = await setup()
    const component = Object.values(graph.components)[0]!
    const session = new ProjectAuthoringSession({ storeId: 'project-main', registry, store })

    const result = await session.execute({
      command: { kind: 'create-variant', commandId: 'session-create', componentId: component.id, displayName: 'New Variant' },
      expectedRevision: graph.revision,
      expectedSourceHashes: graph.sourceHashes,
    })

    expect(result.graph.revision).toBe(2)
    expect(Object.values(result.graph.variants).map((variant) => variant.displayName)).toContain('New Variant')
    expect(await fs.readFile(path.join(root, FILE), 'utf8')).toContain('__onemoVariantRegistry')
    expect((await store.load())?.sourceHashes[FILE]).not.toBe(graph.sourceHashes[FILE])
    expect(await fs.readFile(path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'), 'utf8'))
      .toContain('session-create')
  })

  it('refuses an incomplete hash set before compile or transaction evidence', async () => {
    const { root, registry, store, graph } = await setup()
    const component = Object.values(graph.components)[0]!
    const session = new ProjectAuthoringSession({ storeId: 'project-main', registry, store })
    const sourceBefore = await fs.readFile(path.join(root, FILE))
    const transactions = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/transactions')
    const transactionEntriesBefore = await fs.readdir(transactions)

    await expect(session.execute({
      command: { kind: 'create-variant', commandId: 'session-stale', componentId: component.id, displayName: 'Nope' },
      expectedRevision: graph.revision,
      expectedSourceHashes: {},
    })).rejects.toMatchObject({ code: 'SOURCE_HASH_SET_MISMATCH' })
    await expect(fs.readFile(path.join(root, FILE))).resolves.toEqual(sourceBefore)
    await expect(fs.readdir(transactions)).resolves.toEqual(transactionEntriesBefore)
  })
})
