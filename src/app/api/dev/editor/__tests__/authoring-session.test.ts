import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { createProjectAuthoringSession } from '../authoring-session'

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
})
