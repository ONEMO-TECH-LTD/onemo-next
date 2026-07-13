import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const componentRoot = path.join(process.cwd(), 'src/app/(dev)/react-figma-components')
const fixtureFile = path.join(componentRoot, 'AuthoringE2EButton.tsx')
const extractedComponentFile = path.join(componentRoot, 'AuthoringE2EExtracted.tsx')
const canonicalComponentFile = path.join(componentRoot, 'AuthoringE2ECanonical.tsx')
const selectionRouteDir = path.join(process.cwd(), 'src/app/(dev)/authoring-e2e')
const selectionFixtureDir = path.join(process.cwd(), 'tests/e2e/fixtures/authoring-real-page')
const generatedSelectionRouteTypes = [
  path.join(process.cwd(), '.next/dev/types/app/(dev)/authoring-e2e'),
  path.join(process.cwd(), '.next/types/app/(dev)/authoring-e2e'),
]
const storePath = path.join(componentRoot, '.onemo')
const backupPath = path.join(componentRoot, '.onemo-e2e-backup')
const markerPath = path.join(componentRoot, '.onemo-e2e-fixture.json')

const exists = (file) => access(file).then(() => true, () => false)

export async function prepareAuthoringFixture() {
  await mkdir(componentRoot, { recursive: true })
  if (await exists(fixtureFile)) throw new Error(`E2E fixture already exists: ${fixtureFile}`)
  if (await exists(extractedComponentFile)) throw new Error(`E2E extracted component already exists: ${extractedComponentFile}`)
  if (await exists(canonicalComponentFile)) throw new Error(`E2E canonical component already exists: ${canonicalComponentFile}`)
  if (await exists(selectionRouteDir)) throw new Error(`E2E selection route already exists: ${selectionRouteDir}`)
  if (await exists(backupPath)) throw new Error(`E2E backup already exists: ${backupPath}`)
  if (await exists(markerPath)) throw new Error(`E2E fixture marker already exists: ${markerPath}`)

  const hadStore = await exists(storePath)
  await writeFile(markerPath, `${JSON.stringify({ hadStore })}\n`)
  try {
    if (hadStore) await rename(storePath, backupPath)
    await writeFile(fixtureFile, `function NestedLabel() {\n  return <span data-name="Nested">Nested</span>\n}\n\nexport function AuthoringE2EButton({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {\n  return <button type="button"><NestedLabel /><span data-name="Label">{variant}</span></button>\n}\n`)
    await mkdir(selectionRouteDir, { recursive: true })
    await writeFile(
      path.join(selectionRouteDir, 'AuthoringE2ECard.module.css'),
      await readFile(path.join(selectionFixtureDir, 'AuthoringE2ECard.module.css')),
    )
    await writeFile(path.join(selectionRouteDir, 'page.tsx'), await readFile(path.join(selectionFixtureDir, 'page.tsx')))
  } catch (error) {
    await restoreAuthoringFixture()
    throw error
  }
}

export async function restoreAuthoringFixture() {
  if (!(await exists(selectionRouteDir))) {
    for (const generatedDir of generatedSelectionRouteTypes) await rm(generatedDir, { recursive: true, force: true })
  }
  if (!(await exists(markerPath))) return
  const marker = JSON.parse(await readFile(markerPath, 'utf8'))
  if (!marker || typeof marker.hadStore !== 'boolean') throw new Error(`Invalid E2E fixture marker: ${markerPath}`)

  await rm(fixtureFile, { force: true })
  await rm(extractedComponentFile, { force: true })
  await rm(canonicalComponentFile, { force: true })
  await rm(selectionRouteDir, { recursive: true, force: true })
  for (const generatedDir of generatedSelectionRouteTypes) await rm(generatedDir, { recursive: true, force: true })
  if (marker.hadStore) {
    if (!(await exists(backupPath))) throw new Error('E2E store backup is missing; refusing to discard fixture evidence')
    await rm(storePath, { recursive: true, force: true })
    await rename(backupPath, storePath)
  } else {
    await rm(storePath, { recursive: true, force: true })
  }
  await rm(markerPath, { force: true })
}
