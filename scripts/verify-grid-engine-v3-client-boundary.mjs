import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const chunksRoot = join(process.cwd(), '.next/static/chunks')
const javascriptFiles = []
const visit = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) visit(path)
    else if (entry.name.endsWith('.js')) javascriptFiles.push(path)
  }
}
visit(chunksRoot)

const routeChunks = javascriptFiles.filter((path) => path.includes('/app/(dev)/grid-engine/page-'))
if (routeChunks.length === 0) throw new Error('grid-engine client chunk not found; run the production build first')

const forbidden = [
  'MANUFACTURING_OFFER_MISMATCH',
  'PHYSICAL_TOLERANCE_POLICY_MISSING',
  'verifyEngineManufacturingSpec',
  'currentManufacturingVerificationResolver',
]
const leaks = []
for (const path of javascriptFiles) {
  const source = readFileSync(path, 'utf8')
  for (const token of forbidden) if (source.includes(token)) leaks.push({ path, token })
}
if (leaks.length > 0) throw new Error(`server verifier leaked into client chunks: ${JSON.stringify(leaks)}`)

const serverReferences = JSON.parse(
  readFileSync(join(process.cwd(), '.next/server/server-reference-manifest.json'), 'utf8'),
)
const serverAction = Object.values(serverReferences.node ?? {}).find(
  (entry) => entry.filename === 'app/(dev)/grid-engine/actions.ts'
    && entry.exportedName === 'verifyManufacturingSpecAction',
)
if (!serverAction) throw new Error('grid-engine manufacturing verifier is not registered as a server action')

console.log(JSON.stringify({
  routeChunks: routeChunks.length,
  scannedClientChunks: javascriptFiles.length,
  verifierLeaks: 0,
  serverAction: true,
}))
