import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const componentRoot = path.join(process.cwd(), 'src/app/(dev)/react-figma-components')
const fixtureFile = path.join(componentRoot, 'AuthoringE2EButton.tsx')
const storePath = path.join(componentRoot, '.onemo')
const backupPath = path.join(componentRoot, '.onemo-e2e-backup')
const markerPath = path.join(componentRoot, '.onemo-e2e-fixture.json')

const exists = (file) => access(file).then(() => true, () => false)

export async function prepareAuthoringFixture() {
  await mkdir(componentRoot, { recursive: true })
  if (await exists(fixtureFile)) throw new Error(`E2E fixture already exists: ${fixtureFile}`)
  if (await exists(backupPath)) throw new Error(`E2E backup already exists: ${backupPath}`)
  if (await exists(markerPath)) throw new Error(`E2E fixture marker already exists: ${markerPath}`)

  const hadStore = await exists(storePath)
  await writeFile(markerPath, `${JSON.stringify({ hadStore })}\n`)
  try {
    if (hadStore) await rename(storePath, backupPath)
    await writeFile(fixtureFile, `export function AuthoringE2EButton({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {\n  return <button type="button">{variant}</button>\n}\n`)
  } catch (error) {
    await restoreAuthoringFixture()
    throw error
  }
}

export async function restoreAuthoringFixture() {
  if (!(await exists(markerPath))) return
  const marker = JSON.parse(await readFile(markerPath, 'utf8'))
  if (!marker || typeof marker.hadStore !== 'boolean') throw new Error(`Invalid E2E fixture marker: ${markerPath}`)

  await rm(fixtureFile, { force: true })
  if (marker.hadStore) {
    if (!(await exists(backupPath))) throw new Error('E2E store backup is missing; refusing to discard fixture evidence')
    await rm(storePath, { recursive: true, force: true })
    await rename(backupPath, storePath)
  } else {
    await rm(storePath, { recursive: true, force: true })
  }
  await rm(markerPath, { force: true })
}
