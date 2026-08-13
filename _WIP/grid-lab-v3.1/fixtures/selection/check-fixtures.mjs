import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const fixturePath = resolve(root, 'band-1/cases.json')
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const failures = []
const ids = new Set()
const siteConstraintKinds = new Set(['top-half', 'maximum-clearance-region', 'shape-centre-region'])

const requireFile = async (path, label) => {
  try {
    const details = await stat(path)
    if (!details.isFile()) failures.push(`${label} is not a file: ${path}`)
  } catch {
    failures.push(`${label} missing: ${path}`)
  }
}

await requireFile(fixture.canonSource, 'canon source')

for (const entry of fixture.cases) {
  if (ids.has(entry.id)) failures.push(`duplicate id: ${entry.id}`)
  ids.add(entry.id)

  const caseRoot = dirname(fixturePath)
  const screenshot = resolve(caseRoot, entry.screenshot)
  const outline = resolve(caseRoot, entry.outlineSource)
  await requireFile(screenshot, `${entry.id} screenshot`)
  await requireFile(outline, `${entry.id} outline`)

  try {
    const hash = createHash('sha256').update(await readFile(screenshot)).digest('hex')
    if (hash !== entry.screenshotSha256) failures.push(`${entry.id} screenshot hash mismatch`)
  } catch {}

  if (entry.role === 'expected') {
    const required = entry.requiredCandidate
    if (!required || required.heldCount !== 1 || required.populationPitchMm !== 48 || required.allDiscsContained !== true) {
      failures.push(`${entry.id} has an invalid Band 1 membership predicate`)
    }
    const constraint = required?.siteConstraint
    if (!constraint || !siteConstraintKinds.has(constraint.kind)) {
      failures.push(`${entry.id} has an invalid canon site constraint`)
    }
    if (constraint?.tieBreak && !siteConstraintKinds.has(constraint.tieBreak)) {
      failures.push(`${entry.id} has an invalid canon site tie-break`)
    }
  }

  if (entry.role === 'counterexample' && (!entry.rawCandidateAllowed || !entry.selectionConstraint?.mustNotOutrankCaseId)) {
    failures.push(`${entry.id} has incomplete counterexample semantics`)
  }
}

const expected = fixture.cases.filter((entry) => entry.role === 'expected')
const counterexamples = fixture.cases.filter((entry) => entry.role === 'counterexample')
for (const entry of counterexamples) {
  if (!ids.has(entry.selectionConstraint.mustNotOutrankCaseId)) {
    failures.push(`${entry.id} points to unknown preferred case ${entry.selectionConstraint.mustNotOutrankCaseId}`)
  }
}

console.log(`Band 1 fixture cases: ${fixture.cases.length}`)
console.log(`Expected membership cases: ${expected.length}`)
console.log(`Counterexamples: ${counterexamples.length}`)
console.log(`Unique shapes: ${new Set(fixture.cases.map((entry) => entry.shape)).size}`)
console.log(`Verified screenshots: ${fixture.cases.length}`)
console.log(`Verified outlines: ${fixture.cases.length}`)

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exitCode = 1
} else {
  console.log('Band 1 fixture integrity: PASS')
}
