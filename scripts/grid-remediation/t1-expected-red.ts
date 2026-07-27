import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

import {
  REPO_ROOT,
  assertEqual,
  currentEnginePath,
  fail,
  finish,
  loadEngine,
  projectOneLegalLattice,
  readArtifact,
  type Attachment,
  type Shape,
} from './t1-contract'

interface GateConfig {
  manifestPath: string
  redFixturePaths: string[]
  acceptanceBypassSourceNeedle: string
  classifications: {
    transport: string[]
    tooling: string[]
  }
  consumerDiscovery: {
    roots: string[]
    extensions: string[]
    excludedDefinitionPaths: string[]
    markers: string[]
  }
}

interface ConsumerManifest {
  entries: Array<{
    path: string
    classification: string
    migratingTask: string
    disposition: string
  }>
}

interface DriftFixture {
  input: {
    shape: Shape
    sizeMM: number
    attachment: Attachment
  }
  expected: {
    pitchMM: number
    pattern: string
    anchors: number
    rescueAnchors: number
    oneLegalLattice: boolean
  }
}

interface BypassFixture {
  input: {
    shape: Shape
    sizeMM: number
    attachment: Attachment
  }
  expected: {
    generic: {
      pitchMM: number
      pattern: string
      anchors: number
      rescueAnchors: number
    }
    user: {
      pitchMM: number
      pattern: string
      anchors: number
      rescueAnchors: number
    }
  }
}

function walk(root: string, extensions: Set<string>): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...walk(path, extensions))
    else if (extensions.has(extname(entry.name))) files.push(path)
  }
  return files
}

function discoverConsumers(config: GateConfig): string[] {
  const extensions = new Set(config.consumerDiscovery.extensions)
  const excluded = new Set(config.consumerDiscovery.excludedDefinitionPaths)
  const found = new Set<string>()
  for (const root of config.consumerDiscovery.roots) {
    for (const absolutePath of walk(resolve(REPO_ROOT, root), extensions)) {
      const path = relative(REPO_ROOT, absolutePath)
      if (excluded.has(path)) continue
      const source = readFileSync(absolutePath, 'utf8')
      if (config.consumerDiscovery.markers.some((marker) => source.includes(marker))) {
        found.add(path)
      }
    }
  }
  return [...found].sort()
}

function assertPathSetsEqual(actual: string[], expected: string[], label: string): void {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  const missing = expected.filter((path) => !actualSet.has(path))
  const unexpected = actual.filter((path) => !expectedSet.has(path))
  if (missing.length || unexpected.length) {
    throw new Error(
      `${label} changed. Missing: ${missing.join(', ') || 'none'}. `
      + `Unexpected: ${unexpected.join(', ') || 'none'}.`,
    )
  }
}

function assertPlan(
  label: string,
  plan: {
    pitchMM: number
    pattern: string | null
    grid: { anchors: unknown[]; rescueAnchors?: unknown[] }
  },
  expected: { pitchMM: number; pattern: string; anchors: number; rescueAnchors: number },
): void {
  assertEqual(plan.pitchMM, expected.pitchMM, `${label} pitch`)
  assertEqual(plan.pattern, expected.pattern, `${label} pattern`)
  assertEqual(plan.grid.anchors.length, expected.anchors, `${label} anchors`)
  assertEqual(plan.grid.rescueAnchors?.length ?? 0, expected.rescueAnchors, `${label} rescue anchors`)
}

async function main(): Promise<void> {
  const config = readArtifact<GateConfig>('t1-gate-config.json')
  const manifest = JSON.parse(
    readFileSync(resolve(REPO_ROOT, config.manifestPath), 'utf8'),
  ) as ConsumerManifest

  for (const path of config.redFixturePaths) {
    if (!existsSync(resolve(REPO_ROOT, path))) throw new Error(`Configured RED fixture does not exist: ${path}`)
  }
  for (const entry of manifest.entries) {
    if (!existsSync(resolve(REPO_ROOT, entry.path))) throw new Error(`Manifest path does not exist: ${entry.path}`)
    if (!entry.migratingTask.trim() || !entry.disposition.trim()) {
      throw new Error(`Manifest entry lacks a task or disposition: ${entry.path}`)
    }
  }
  assertPathSetsEqual(
    discoverConsumers(config),
    manifest.entries.map((entry) => entry.path).sort(),
    'door-consumer manifest',
  )
  assertPathSetsEqual(
    config.classifications.transport.slice().sort(),
    manifest.entries
      .filter((entry) => entry.classification === 'transport')
      .map((entry) => entry.path)
      .sort(),
    'transport classification',
  )
  const manifestPaths = new Set(manifest.entries.map((entry) => entry.path))
  for (const path of config.classifications.tooling) {
    if (!manifestPaths.has(path)) throw new Error(`Tooling classification is absent from manifest: ${path}`)
  }

  const gridCoreSource = readFileSync(currentEnginePath(), 'utf8')
  if (!gridCoreSource.includes(config.acceptanceBypassSourceNeedle)) {
    throw new Error('Expected-red acceptance-bypass source branch was not reproduced.')
  }

  const engine = await loadEngine(currentEnginePath())
  if (!engine.resolveUserGridPlan) throw new Error('Current engine does not expose resolveUserGridPlan.')

  const lattice = readArtifact<DriftFixture>('fixtures/user-lattice-violation.json')
  const latticeContour = engine.stdShapeContour(lattice.input.shape, lattice.input.sizeMM)
  const latticePlan = engine.resolveUserGridPlan(latticeContour, lattice.input.attachment)
  assertPlan('User lattice RED fixture', latticePlan, lattice.expected)
  assertEqual(
    projectOneLegalLattice(latticePlan) !== null,
    lattice.expected.oneLegalLattice,
    'User lattice RED fixture legal-lattice verdict',
  )

  const bypass = readArtifact<BypassFixture>('fixtures/acceptance-bypass.json')
  const bypassContour = engine.stdShapeContour(bypass.input.shape, bypass.input.sizeMM)
  const genericPlan = engine.resolveGridPlan(bypassContour, { attachment: bypass.input.attachment })
  const userPlan = engine.resolveUserGridPlan(bypassContour, bypass.input.attachment)
  assertPlan('Generic bypass control', genericPlan, bypass.expected.generic)
  assertPlan('User bypass RED fixture', userPlan, bypass.expected.user)

  finish('t1-isolated-expected-red', {
    fixtures: {
      userLatticeViolation: lattice.input,
      acceptanceBypass: bypass.input,
    },
    manifest: {
      authority: config.manifestPath,
      pathSetMatchesDiscovery: true,
      everyEntryHasTaskAndDisposition: true,
    },
    note: 'PASS means the two known defects were reproduced exactly under an isolated expected-red command.',
  })
}

main().catch((error) => fail('t1-isolated-expected-red', error))
