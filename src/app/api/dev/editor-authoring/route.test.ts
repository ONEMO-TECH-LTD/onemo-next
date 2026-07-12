import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PROJECT_AUTHORING_SIDECAR } from '../editor/authoring-store'
import { handleGet, handlePost } from './handler'
import { GET } from './route'

const SOURCE_FILE = 'src/app/(dev)/react-figma-components/Button.tsx'
const singleAxisSource = `export function Button({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {
  return <button>{variant}</button>
}
`

async function makeRoot(source = singleAxisSource) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-import-route-'))
  await fs.mkdir(path.dirname(path.join(root, SOURCE_FILE)), { recursive: true })
  await fs.writeFile(path.join(root, SOURCE_FILE), source)
  return root
}

function request(method: 'GET' | 'POST', body?: unknown) {
  return new Request(`http://localhost/api/dev/editor-authoring?file=${encodeURIComponent(SOURCE_FILE)}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  })
}

function componentRequest() {
  return new Request(`http://localhost/api/dev/editor-authoring?mode=component&file=${encodeURIComponent(SOURCE_FILE)}`)
}

describe('editor-authoring G1 import route', () => {
  beforeEach(() => vi.stubEnv('NODE_ENV', 'development'))
  afterEach(() => vi.unstubAllEnvs())

  it('classifies exact hashes then persists through the production import caller', async () => {
    const root = await makeRoot()
    const classifiedResponse = await handleGet(request('GET'), root)
    const classified = await classifiedResponse.json()
    expect(classifiedResponse.status).toBe(200)
    expect(classified).toMatchObject({ projection: { compatibility: 'legacy-single-axis' } })

    const importedResponse = await handlePost(request('POST', {
      kind: 'import-source',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
    }), root)
    const imported = await importedResponse.json()

    expect(importedResponse.status).toBe(200)
    expect(imported).toMatchObject({ kind: 'imported', graph: { revision: 1 } })
    expect(await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).toBe(singleAxisSource)
    expect(await fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR), 'utf8')).toContain('legacy-single-axis')
  })

  it('rejects malformed and extra request fields before filesystem access', async () => {
    const response = await handlePost(request('POST', {
      kind: 'import-source',
      file: SOURCE_FILE,
      expectedSourceHashes: { [SOURCE_FILE]: 'not-a-hash' },
      extra: true,
    }), '/path/that/must/not/be-read')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'invalid authoring request' })
  })

  it('rejects malformed JSON as a 400 before filesystem access', async () => {
    const response = await handlePost(new Request('http://localhost/api/dev/editor-authoring', {
      method: 'POST',
      body: '{',
      headers: { 'content-type': 'application/json' },
    }), '/path/that/must/not/be-read')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'invalid authoring request' })
  })

  it('returns a named 409 and no sidecar when source changed after classification', async () => {
    const root = await makeRoot()
    const classified = await (await handleGet(request('GET'), root)).json()
    await fs.writeFile(path.join(root, SOURCE_FILE), singleAxisSource.replace('variant}</button>', 'changed}</button>'))

    const response = await handlePost(request('POST', {
      kind: 'import-source',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
    }), root)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'SOURCE_HASH_STALE', changedPaths: [SOURCE_FILE] })
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('holds multi-axis source without writing a sidecar', async () => {
    const root = await makeRoot(`export function Button({ variant = 'Primary', size = 'sm' }: {
  variant?: 'Primary' | 'Secondary'; size?: 'sm' | 'lg'
}) { return <button>{variant}{size}</button> }
`)
    const classified = await (await handleGet(request('GET'), root)).json()
    const response = await handlePost(request('POST', {
      kind: 'import-source',
      file: SOURCE_FILE,
      expectedSourceHashes: classified.sourceHashes,
    }), root)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ kind: 'hold', compatibility: 'legacy-multi-axis' })
    await expect(fs.readFile(path.join(root, PROJECT_AUTHORING_SIDECAR))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps the production handlers dev-only', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const response = await GET(request('GET'))
    expect(response.status).toBe(403)
  })

  it('loads and persists create, rename, and move through the strict G2 command route', async () => {
    const root = await makeRoot()
    const classified = await (await handleGet(request('GET'), root)).json()
    await handlePost(request('POST', { kind: 'import-source', file: SOURCE_FILE, expectedSourceHashes: classified.sourceHashes }), root)

    let loaded = await (await handleGet(componentRequest(), root)).json()
    const componentId = loaded.componentId as string
    const create = await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'create-variant', commandId: 'route-create', componentId, displayName: 'New Variant' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    expect(create.status).toBe(200)
    const created = await create.json()
    const variant = Object.values(created.graph.variants as Record<string, { id: string; displayName: string }>).find((entry) => entry.displayName === 'New Variant')!

    loaded = await (await handleGet(componentRequest(), root)).json()
    const rename = await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'rename-variant', commandId: 'route-rename', componentId, variantId: variant.id, displayName: 'Renamed' },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    expect(rename.status).toBe(200)

    loaded = await (await handleGet(componentRequest(), root)).json()
    const move = await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'move-variant', commandId: 'route-move', componentId, variantId: variant.id, frame: { x: 80, y: 40, width: 320, height: 180 } },
      expectedRevision: loaded.graph.revision,
      expectedSourceHashes: loaded.sourceHashes,
    }), root)
    expect(move.status).toBe(200)
    await expect(move.json()).resolves.toMatchObject({ graph: { revision: 4, variants: { [variant.id]: { id: variant.id, displayName: 'Renamed', frame: { x: 80, y: 40 } } } } })
  }, 10_000)

  it('rejects malformed G2 command keys and geometry before filesystem access', async () => {
    const response = await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'move-variant', commandId: 'bad', componentId: 'component_x', variantId: 'variant_x', frame: { x: 0, y: 0, width: Number.NaN, height: 1 }, extra: true },
      expectedRevision: 1,
      expectedSourceHashes: { [SOURCE_FILE]: 'a'.repeat(64) },
    }), '/path/that/must/not-be-read')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'invalid authoring request' })

    const invalidName = await handlePost(request('POST', {
      kind: 'execute-command',
      command: { kind: 'create-variant', commandId: 'bad id', componentId: 'component_x', displayName: '   ' },
      expectedRevision: 1,
      expectedSourceHashes: { [SOURCE_FILE]: 'a'.repeat(64) },
    }), '/path/that/must/not-be-read')
    expect(invalidName.status).toBe(400)
  })
})
