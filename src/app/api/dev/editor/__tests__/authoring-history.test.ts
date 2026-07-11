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
})
