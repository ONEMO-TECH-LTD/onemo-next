import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AuthoringHistoryStore } from '../authoring-history'
import { sha256 } from '../durable-file-installer'
import { RuntimeRootRegistry } from '../runtime-root-registry'

describe('AuthoringHistoryStore', () => {
  it('stores content-addressed blobs and append-only journal records without absolute paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-history-'))
    const registry = await RuntimeRootRegistry.create([
      { storeId: 'project-main', kind: 'project', rootPath: root },
    ])
    const history = new AuthoringHistoryStore(registry, 'project-main')

    const blob = await history.putBlob('before bytes')
    await history.appendJournal({ type: 'undo-preimage', blob })

    expect(blob).toEqual({
      sha256: sha256('before bytes'),
      path: `src/app/(dev)/react-figma-components/.onemo/history/blobs/${sha256('before bytes')}`,
    })
    const journal = await fs.readFile(
      path.join(root, 'src/app/(dev)/react-figma-components/.onemo/history/journal.ndjson'),
      'utf8',
    )
    expect(journal).toContain(blob.sha256)
    expect(journal).not.toContain(root)
  })
})
