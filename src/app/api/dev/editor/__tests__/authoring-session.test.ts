import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { createProjectAuthoringSession } from '../authoring-session'
import { sha256 } from '../durable-file-installer'

const SOURCE_FILE = 'src/app/(dev)/react-figma-components/Button.tsx'

const source = `
export function Button({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {
  return <button data-variant={variant}>Button</button>
}
`.trimStart()

async function makeSession() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-session-'))
  await fs.mkdir(path.dirname(path.join(root, SOURCE_FILE)), { recursive: true })
  await fs.writeFile(path.join(root, SOURCE_FILE), source)
  const session = await createProjectAuthoringSession({ rootPath: root })
  return { root, session }
}

describe('ProjectAuthoringSession', () => {
  it('loads a graph-backed canvas state from SourceProjection and exact source hashes', async () => {
    const { session } = await makeSession()

    const state = await session.loadCanvas(SOURCE_FILE)

    expect(state.revision).toBe(0)
    expect(state.sourceHashes[SOURCE_FILE]).toMatch(/^[a-f0-9]{64}$/)
    expect(state.component).toMatchObject({
      displayName: 'Button',
      source: { file: SOURCE_FILE, exportName: 'Button' },
    })
    expect(state.component?.variants.map((variant) => [variant.displayName, variant.primary])).toEqual([
      ['Primary', true],
      ['Secondary', false],
    ])
  })

  it('executes create-variant through staged source bytes and persists sidecar revision/hash', async () => {
    const { root, session } = await makeSession()
    const before = await session.loadCanvas(SOURCE_FILE)

    const result = await session.executeCommand({
      expectedRevision: before.revision,
      expectedSourceHashes: before.sourceHashes,
      command: { kind: 'create-variant', file: SOURCE_FILE, name: 'Tertiary' },
    })

    expect(result.revision).toBe(1)
    expect(await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).toContain("'Primary' | 'Secondary' | 'Tertiary'")
    const after = await session.loadCanvas(SOURCE_FILE)
    expect(after.revision).toBe(1)
    expect(after.sourceHashes[SOURCE_FILE]).toMatch(/^[a-f0-9]{64}$/)
    expect(after.sourceHashes[SOURCE_FILE]).not.toBe(before.sourceHashes[SOURCE_FILE])
    expect(after.component?.variants.map((variant) => variant.displayName)).toEqual(['Primary', 'Secondary', 'Tertiary'])
    const journal = await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'),
      'utf8',
    )
    expect(journal).toContain('authoring-command')
    expect(journal).toContain(SOURCE_FILE)
    expect(journal).not.toContain(root)
  })

  it('reloads committed sidecar state from a fresh session and survives Home -> edit navigation', async () => {
    const { root, session } = await makeSession()
    const before = await session.loadCanvas(SOURCE_FILE)
    await session.executeCommand({
      expectedRevision: before.revision,
      expectedSourceHashes: before.sourceHashes,
      command: { kind: 'create-variant', file: SOURCE_FILE, name: 'Tertiary' },
    })
    const reloadedSession = await createProjectAuthoringSession({ rootPath: root })

    const home = await reloadedSession.loadCanvas(null)
    const afterHomeBack = await reloadedSession.loadCanvas(SOURCE_FILE)

    expect(home.component).toBeNull()
    expect(afterHomeBack.revision).toBe(1)
    expect(afterHomeBack.canUndo).toBe(true)
    expect(afterHomeBack.component?.variants.map((variant) => variant.displayName)).toEqual(['Primary', 'Secondary', 'Tertiary'])
  })

  it('undoes the latest source-backed command by restoring the preimage and committing prior graph state', async () => {
    const { root, session } = await makeSession()
    const before = await session.loadCanvas(SOURCE_FILE)
    await session.executeCommand({
      expectedRevision: before.revision,
      expectedSourceHashes: before.sourceHashes,
      command: { kind: 'create-variant', file: SOURCE_FILE, name: 'Tertiary' },
    })
    const afterCreate = await session.loadCanvas(SOURCE_FILE)

    const undo = await session.undoLastCommand({
      expectedRevision: afterCreate.revision,
      expectedSourceHashes: afterCreate.sourceHashes,
    })

    expect(undo.revision).toBe(2)
    expect(undo.restoredFiles).toEqual([SOURCE_FILE])
    expect(await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).toBe(source)
    const afterUndo = await session.loadCanvas(SOURCE_FILE)
    expect(afterUndo.component?.variants.map((variant) => variant.displayName)).toEqual(['Primary', 'Secondary'])
    expect(afterUndo.sourceHashes[SOURCE_FILE]).toBe(before.sourceHashes[SOURCE_FILE])
    const journal = await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'),
      'utf8',
    )
    expect(journal).toContain('authoring-undo')
    expect(journal).not.toContain(root)
  })

  it('refuses a hash-valid malformed graph preimage before undo mutates source', async () => {
    const { root, session } = await makeSession()
    const before = await session.loadCanvas(SOURCE_FILE)
    await session.executeCommand({
      expectedRevision: before.revision,
      expectedSourceHashes: before.sourceHashes,
      command: { kind: 'create-variant', file: SOURCE_FILE, name: 'Tertiary' },
    })
    const afterCreate = await session.loadCanvas(SOURCE_FILE)
    const journalPath = path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson')
    const records = (await fs.readFile(journalPath, 'utf8')).trimEnd().split('\n').map((line) => JSON.parse(line))
    const invalidGraph = Buffer.from('{"not":"an authoring graph"}\n')
    const digest = sha256(invalidGraph)
    const blobPath = path.join(root, `src/app/(dev)/react-figma-components/.onemo/history/blobs/${digest}`)
    await fs.writeFile(blobPath, invalidGraph)
    records[0].graphPreimage = {
      sha256: digest,
      path: `src/app/(dev)/react-figma-components/.onemo/history/blobs/${digest}`,
    }
    await fs.writeFile(journalPath, records.map((record) => JSON.stringify(record)).join('\n') + '\n')
    const sourceBeforeUndo = await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')

    await expect(session.undoLastCommand({
      expectedRevision: afterCreate.revision,
      expectedSourceHashes: afterCreate.sourceHashes,
    })).rejects.toMatchObject({ code: 'UNDO_GRAPH_PREIMAGE_INVALID', status: 422 })
    expect(await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).toBe(sourceBeforeUndo)
  })

  it('refuses source-mutating commands without expected source hashes', async () => {
    const { session } = await makeSession()

    await expect(session.executeCommand({
      expectedRevision: 0,
      command: { kind: 'create-variant', file: SOURCE_FILE, name: 'Tertiary' },
    })).rejects.toMatchObject({ code: 'SOURCE_HASH_PRECONDITION_REQUIRED', status: 400 })
  })

  it('rejects stale source hashes before writing staged source bytes', async () => {
    const { root, session } = await makeSession()
    const before = await session.loadCanvas(SOURCE_FILE)
    await fs.writeFile(path.join(root, SOURCE_FILE), source.replace('Button</button>', 'Changed</button>'))

    await expect(session.executeCommand({
      expectedRevision: before.revision,
      expectedSourceHashes: before.sourceHashes,
      command: { kind: 'create-variant', file: SOURCE_FILE, name: 'Tertiary' },
    })).rejects.toMatchObject({ code: 'SOURCE_HASH_STALE', status: 409 })

    expect(await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).not.toContain('Tertiary')
  })

  it('executes move-variant-frame as sidecar-only state', async () => {
    const { root, session } = await makeSession()
    const before = await session.loadCanvas(SOURCE_FILE)
    const secondary = before.component?.variants.find((variant) => variant.displayName === 'Secondary')
    expect(secondary).toBeTruthy()

    await session.executeCommand({
      expectedRevision: before.revision,
      command: { kind: 'move-variant-frame', file: SOURCE_FILE, variantId: secondary!.id, frame: { x: 40, y: 80, width: 360, height: 220 } },
    })

    expect(await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).toBe(source)
    const after = await session.loadCanvas(SOURCE_FILE)
    expect(after.revision).toBe(1)
    expect(after.component?.variants.find((variant) => variant.id === secondary!.id)?.frame)
      .toEqual({ x: 40, y: 80, width: 360, height: 220 })
  })

  it('undoes sidecar-only move-variant-frame without modifying source bytes', async () => {
    const { root, session } = await makeSession()
    const before = await session.loadCanvas(SOURCE_FILE)
    const secondary = before.component?.variants.find((variant) => variant.displayName === 'Secondary')
    expect(secondary).toBeTruthy()
    await session.executeCommand({
      expectedRevision: before.revision,
      command: { kind: 'move-variant-frame', file: SOURCE_FILE, variantId: secondary!.id, frame: { x: 40, y: 80, width: 360, height: 220 } },
    })
    const afterMove = await session.loadCanvas(SOURCE_FILE)

    await session.undoLastCommand({
      expectedRevision: afterMove.revision,
      expectedSourceHashes: afterMove.sourceHashes,
    })

    expect(await fs.readFile(path.join(root, SOURCE_FILE), 'utf8')).toBe(source)
    const afterUndo = await session.loadCanvas(SOURCE_FILE)
    expect(afterUndo.revision).toBe(2)
    expect(afterUndo.component?.variants.find((variant) => variant.id === secondary!.id)?.frame)
      .toEqual(secondary!.frame)
  })
})
