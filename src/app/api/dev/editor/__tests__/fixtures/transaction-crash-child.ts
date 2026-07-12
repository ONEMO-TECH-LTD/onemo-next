import { promises as fs } from 'node:fs'

import { AuthoringSidecarStore } from '../../authoring-store'
import { SingleRootAuthoringTransaction } from '../../authoring-transaction'
import { RuntimeRootRegistry } from '../../runtime-root-registry'

const [root, sourceFile] = process.argv.slice(2)
if (!root || !sourceFile) throw new Error('root and sourceFile arguments are required')

const registry = await RuntimeRootRegistry.create([
  { storeId: 'project-main', kind: 'project', rootPath: root },
])
const store = new AuthoringSidecarStore({ storeId: 'project-main', rootKind: 'project', registry })
const before = await fs.readFile(await registry.resolveStorePath('project-main', sourceFile), 'utf8')
const transaction = new SingleRootAuthoringTransaction({
  transactionId: 'tx-killed-child',
  storeId: 'project-main',
  registry,
  store,
  hooks: {
    afterSourceInstall: async () => {
      process.stdout.write('after-source-install\n')
      await new Promise<void>(() => {})
    },
  },
})

await transaction.commit({
  expectedRevision: 0,
  sourceFiles: [sourceFile],
  sourcePatches: [{ file: sourceFile, before, after: 'after bytes from killed child\n' }],
  command: { kind: 'crash-fixture' },
  mutate: (draft) => draft,
})
