import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AuthoringHistoryStore } from '../authoring-history'
import { sha256 } from '../durable-file-installer'
import { RuntimeRootRegistry } from '../runtime-root-registry'

describe('AuthoringHistoryStore', () => {
  it('plans content-addressed blobs and append-only journal bytes without writing outside a transaction', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-history-'))
    const registry = await RuntimeRootRegistry.create([
      { storeId: 'project-main', kind: 'project', rootPath: root },
    ])
    const history = new AuthoringHistoryStore(registry, 'project-main')

    const patches = await history.planCommand({
      command: { kind: 'test' },
      sourceFiles: ['Button.tsx'],
      sourcePreimages: [{ file: 'Button.tsx', bytes: 'before bytes' }],
      graphPreimage: '{}\n',
      revision: 1,
    })
    const blobPath = `src/app/(dev)/react-figma-components/.onemo/history/blobs/${sha256('before bytes')}`
    const blob = patches.find((patch) => patch.file === blobPath)
    const journal = patches.find((patch) => patch.file.endsWith('/history/journal.ndjson'))

    expect(blob).toMatchObject({ file: blobPath, before: null })
    expect(blob?.after.toString()).toBe('before bytes')
    expect(journal?.after.toString()).toContain(sha256('before bytes'))
    expect(JSON.stringify(patches)).not.toContain(root)
    await expect(fs.readFile(path.join(root, blobPath))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each([
    {
      label: 'a traversal source path',
      mutate: (record: Record<string, unknown>) => {
        record.sourceFiles = ['../outside.tsx']
      },
    },
    {
      label: 'a mismatched blob path',
      mutate: (record: Record<string, unknown>) => {
        const graphPreimage = record.graphPreimage as Record<string, unknown>
        graphPreimage.path = 'src/app/(dev)/react-figma-components/.onemo/history/blobs/wrong'
      },
    },
    {
      label: 'an invalid revision',
      mutate: (record: Record<string, unknown>) => {
        record.revision = -1
      },
    },
    {
      label: 'an untyped command',
      mutate: (record: Record<string, unknown>) => {
        record.command = null
      },
    },
  ])('refuses a journal record containing $label', async ({ mutate }) => {
    const { history, journalPath, validCommandRecord } = await historyFixture()
    const record = validCommandRecord()
    mutate(record)
    await fs.writeFile(journalPath, JSON.stringify(record) + '\n')

    await expect(history.latestUndoableCommand()).rejects.toMatchObject({ code: 'HISTORY_RECORD_INVALID' })
  })

  it('refuses an undo record that does not target an earlier command', async () => {
    const { history, journalPath } = await historyFixture()
    await fs.writeFile(journalPath, JSON.stringify({
      type: 'authoring-undo',
      undoneJournalIndex: 0,
      restoredFiles: [],
      revision: 1,
    }) + '\n')

    await expect(history.latestUndoableCommand()).rejects.toMatchObject({ code: 'HISTORY_RECORD_INVALID' })
  })

  it('refuses a validly shaped journal whose tail revision disagrees with current state', async () => {
    const { history, journalPath, validCommandRecord } = await historyFixture()
    await fs.writeFile(journalPath, JSON.stringify(validCommandRecord()) + '\n')

    await expect(history.latestUndoableCommand(2)).rejects.toMatchObject({ code: 'HISTORY_REVISION_STALE' })
  })

  it('refuses non-contiguous durable history revisions', async () => {
    const { history, journalPath, validCommandRecord } = await historyFixture()
    const command = validCommandRecord()
    const undo = { type: 'authoring-undo', undoneJournalIndex: 0, restoredFiles: ['Button.tsx'], revision: 3 }
    await fs.writeFile(journalPath, `${JSON.stringify(command)}\n${JSON.stringify(undo)}\n`)

    await expect(history.latestUndoableCommand()).rejects.toMatchObject({ code: 'HISTORY_RECORD_INVALID' })
  })

  it('returns a named refusal for a missing content-addressed blob', async () => {
    const { history, validCommandRecord } = await historyFixture()
    const record = validCommandRecord()

    await expect(history.readBlob(record.graphPreimage as { sha256: string; path: string }))
      .rejects.toMatchObject({ code: 'HISTORY_BLOB_MISSING' })
  })

  it.each([
    { label: 'truncated JSON', bytes: '{"type":"authoring-command"' },
    { label: 'a blank interior record', bytes: '{}\n\n' },
  ])('refuses a journal containing $label', async ({ bytes }) => {
    const { history, journalPath } = await historyFixture()
    await fs.writeFile(journalPath, bytes)

    await expect(history.latestUndoableCommand()).rejects.toMatchObject({ code: 'HISTORY_RECORD_INVALID' })
  })
})

async function historyFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-history-invalid-'))
  const registry = await RuntimeRootRegistry.create([
    { storeId: 'project-main', kind: 'project', rootPath: root },
  ])
  const history = new AuthoringHistoryStore(registry, 'project-main')
  const planned = await history.planCommand({
    command: { kind: 'test' },
    sourceFiles: ['Button.tsx'],
    sourcePreimages: [{ file: 'Button.tsx', bytes: 'before bytes' }],
    graphPreimage: '{}\n',
    revision: 1,
  })
  const journal = planned.find((patch) => patch.file.endsWith('/history/journal.ndjson'))!
  const journalPath = await registry.resolveStorePath('project-main', journal.file)
  await fs.mkdir(path.dirname(journalPath), { recursive: true })
  return {
    history,
    journalPath,
    validCommandRecord: () => JSON.parse(journal.after.toString()) as Record<string, unknown>,
  }
}
