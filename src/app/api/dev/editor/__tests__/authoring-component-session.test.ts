import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseCreateComponentFromSelectionCommand } from '../authoring-commands'
import { compileCreateComponentFromSelection } from '../authoring-compiler'
import { readExactAuthoringSourceSnapshot } from '../authoring-import'
import { ProjectAuthoringSession } from '../authoring-session'
import { AuthoringSidecarStore, createEmptyAuthoringGraph, PROJECT_AUTHORING_SIDECAR } from '../authoring-store'
import { RuntimeRootRegistry } from '../runtime-root-registry'
import { linkTestNodeModules } from './test-project-root'

const PAGE = 'src/app/page.tsx'
const COMPONENT = 'src/app/(dev)/react-figma-components/Card.tsx'
const PAGE_SOURCE = `export function Page() {
  return (
    <main>
      <section data-card>Card</section>
    </main>
  )
}
`

describe('create-component-from-selection authoring session', () => {
  it('builds a strict compiler plan without writing source or authoring metadata', async () => {
    const { root, registry } = await fixture()
    const snapshot = await readExactAuthoringSourceSnapshot({ storeId: 'project-main', file: PAGE, registry })
    const command = {
      kind: 'create-component-from-selection' as const,
      commandId: 'compile-card-1', file: PAGE, line: 4, col: 7, name: 'Card',
    }

    const plan = await compileCreateComponentFromSelection({
      graph: createEmptyAuthoringGraph({
        storeId: 'project-main', rootKind: 'project', environmentFingerprint: snapshot.environmentFingerprint,
      }),
      command,
      consumerSource: snapshot.sources[PAGE]!,
      sourceHashes: snapshot.sourceHashes,
      environmentFingerprint: snapshot.environmentFingerprint,
      projectRoot: registry.get('project-main').canonicalRealPath,
      compilerOptions: snapshot.compilerOptions,
      dependencySources: snapshot.sources,
    })

    expect(plan).toMatchObject({
      componentFile: COMPONENT,
      sourcePatches: [
        { file: PAGE, before: PAGE_SOURCE, after: expect.stringContaining('<Card />') },
        { file: COMPONENT, before: null, after: expect.stringContaining('export function Card()') },
      ],
      verifiedAssertions: [
        { kind: 'staged-typescript-semantics', status: 'passed' },
        { kind: 'source-projection-round-trip', status: 'passed' },
        { kind: 'stable-component-identity', status: 'passed' },
        { kind: 'stable-instance-anchor', status: 'passed' },
      ],
    })
    await expect(fs.readFile(path.join(root, PAGE), 'utf8')).resolves.toBe(PAGE_SOURCE)
    await expect(fs.readFile(path.join(root, COMPONENT))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 20_000)

  it('commits consumer, component, graph, instance, history, and undo as one durable flow', async () => {
    const { root, registry, store, session } = await fixture()
    const preview = await readExactAuthoringSourceSnapshot({ storeId: 'project-main', file: PAGE, registry })
    const command = {
      kind: 'create-component-from-selection' as const,
      commandId: 'create-card-1',
      file: PAGE,
      line: 4,
      col: 7,
      name: 'Card',
    }

    const created = await session.createComponentFromSelection({
      command,
      transactionId: '00000000-0000-4000-8000-000000000101',
      expectedRevision: 0,
      expectedSourceHashes: preview.sourceHashes,
      expectedEnvironmentFingerprint: preview.environmentFingerprint,
    })

    expect(created).toMatchObject({ componentFile: COMPONENT, graph: { revision: 1 } })
    expect(await fs.readFile(path.join(root, COMPONENT), 'utf8')).toContain('export function Card()')
    expect(await fs.readFile(path.join(root, PAGE), 'utf8')).toContain('<Card />')
    const component = created.graph.components[created.componentId]!
    expect(component.source.file).toBe(COMPONENT)
    expect(Object.values(created.graph.instances)).toEqual([
      expect.objectContaining({ componentId: component.id, variantId: component.primaryVariantId }),
    ])
    expect(created.graph.sourceHashes).toMatchObject({
      [PAGE]: expect.stringMatching(/^[a-f0-9]{64}$/),
      [COMPONENT]: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    const loaded = await session.loadComponent(COMPONENT)
    expect(loaded.canUndo).toBe(true)
    expect(loaded.sourceHashes[PAGE]).toBe(created.graph.sourceHashes[PAGE])
    const journal = await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'),
      'utf8',
    )
    expect(journal).toContain('create-component-from-selection')
    expect(journal).toContain('"sha256":null')

    const undone = await session.undo({
      expectedRevision: created.graph.revision,
      expectedSourceHashes: created.graph.sourceHashes,
    })

    expect(undone.graph).toMatchObject({ revision: 2, components: {}, instances: {} })
    await expect(fs.readFile(path.join(root, PAGE), 'utf8')).resolves.toBe(PAGE_SOURCE)
    await expect(fs.readFile(path.join(root, COMPONENT))).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await store.load())?.sourceHashes[COMPONENT]).toBeUndefined()
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR), 'utf8'))
      .resolves.toContain('"revision": 2')
  }, 20_000)

  it('strictly validates command identity, source location, and component name', () => {
    const valid = {
      kind: 'create-component-from-selection', commandId: 'create-card-1',
      file: PAGE, line: 4, col: 7, name: 'Card',
    }
    expect(parseCreateComponentFromSelectionCommand(valid)).toEqual(valid)
    expect(parseCreateComponentFromSelectionCommand({ ...valid, file: '../outside.tsx' })).toBeNull()
    expect(parseCreateComponentFromSelectionCommand({ ...valid, line: 0 })).toBeNull()
    expect(parseCreateComponentFromSelectionCommand({ ...valid, name: 'not valid' })).toBeNull()
    expect(parseCreateComponentFromSelectionCommand({ ...valid, name: `C${'a'.repeat(120)}` })).toBeNull()
    expect(parseCreateComponentFromSelectionCommand({ ...valid, extra: true })).toBeNull()
  })

  it('refuses a component-file collision without changing consumer or durable authoring state', async () => {
    const { root, registry, session } = await fixture()
    const existing = 'export function ExistingCard() { return <aside /> }\n'
    await fs.mkdir(path.dirname(path.join(root, COMPONENT)), { recursive: true })
    await fs.writeFile(path.join(root, COMPONENT), existing)
    const preview = await readExactAuthoringSourceSnapshot({ storeId: 'project-main', file: PAGE, registry })

    await expect(session.createComponentFromSelection({
      command: {
        kind: 'create-component-from-selection', commandId: 'collision.card:1',
        file: PAGE, line: 4, col: 7, name: 'Card',
      },
      transactionId: '00000000-0000-4000-8000-000000000102',
      expectedRevision: 0,
      expectedSourceHashes: preview.sourceHashes,
      expectedEnvironmentFingerprint: preview.environmentFingerprint,
    })).rejects.toMatchObject({ code: 'SOURCE_PREIMAGE_STALE', changedPaths: [COMPONENT] })

    await expect(fs.readFile(path.join(root, PAGE), 'utf8')).resolves.toBe(PAGE_SOURCE)
    await expect(fs.readFile(path.join(root, COMPONENT), 'utf8')).resolves.toBe(existing)
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 20_000)
})

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-create-component-'))
  await fs.mkdir(path.dirname(path.join(root, PAGE)), { recursive: true })
  await linkTestNodeModules(root)
  await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      types: ['react'],
      baseUrl: '.',
      paths: { '@/*': ['src/*'] },
    },
    include: ['src/**/*.ts', 'src/**/*.tsx'],
  }))
  await fs.writeFile(path.join(root, PAGE), PAGE_SOURCE)
  const registry = await RuntimeRootRegistry.create([
    { storeId: 'project-main', kind: 'project', rootPath: root },
  ])
  const store = new AuthoringSidecarStore({ storeId: 'project-main', rootKind: 'project', registry })
  return {
    root,
    registry,
    store,
    session: new ProjectAuthoringSession({ storeId: 'project-main', registry, store }),
  }
}
