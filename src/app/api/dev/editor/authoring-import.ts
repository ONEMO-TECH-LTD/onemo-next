import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import * as ts from 'typescript'

import { AuthoringHistoryStore } from './authoring-history'
import { importProjectionToAuthoringGraph, type ProjectionImportResult } from './authoring-migrations'
import { AuthoringSidecarStore, createEmptyAuthoringGraph } from './authoring-store'
import { SingleRootAuthoringTransaction } from './authoring-transaction'
import { readExactCompilerConfig } from './authoring-tsconfig'
import type { StoreId } from './authoring-types'
import { sha256 } from './durable-file-installer'
import { parseComponentModelFromSource } from './lib'
import { RuntimeRootRegistry } from './runtime-root-registry'
import { extractSourceAnchorsFromTsx } from './source-anchor'
import { sourceProjectionFromModel, type SourceProjection, unsupportedSourceProjection } from './source-projection'

export type SourceImportClassification = {
  projection: SourceProjection
  sourceHashes: Record<string, string>
}

export type ExactAuthoringSourceSnapshot = SourceImportClassification & {
  sources: Record<string, string>
  compilerOptions: ts.CompilerOptions
}

export async function classifySourceFileForImport(input: {
  storeId: StoreId
  file: string
  registry: RuntimeRootRegistry
}): Promise<SourceImportClassification> {
  const snapshot = await readExactAuthoringSourceSnapshot(input)
  return { projection: snapshot.projection, sourceHashes: snapshot.sourceHashes }
}

export async function readExactAuthoringSourceSnapshot(input: {
  storeId: StoreId
  file: string
  registry: RuntimeRootRegistry
}): Promise<ExactAuthoringSourceSnapshot> {
  const sources = new Map<string, Buffer>()
  const sourceAbs = await input.registry.resolveStorePath(input.storeId, input.file)
  sources.set(input.file, await fs.readFile(sourceAbs))
  const compilerConfig = await readExactCompilerConfig(input)
  for (const [file, bytes] of Object.entries(compilerConfig.sources)) sources.set(file, bytes)
  await readProjectModuleDependencies(input, sources, compilerConfig.options, compilerConfig.configuredFiles)
  const cssSources: Record<string, string> = {}
  let projection: SourceProjection

  for (;;) {
    try {
      const source = sources.get(input.file)!.toString('utf8')
      const model = await parseComponentModelFromSource({ file: input.file, source, cssSources })
      projection = sourceProjectionFromModel(input.file, model, extractSourceAnchorsFromTsx({
        file: input.file,
        source,
        exportName: model.name,
      }))
      break
    } catch (error) {
      const dependency = (error as { code?: unknown; dependency?: unknown }).code === 'SOURCE_DEPENDENCY_REQUIRED'
        ? (error as { dependency?: unknown }).dependency
        : undefined
      if (typeof dependency !== 'string' || sources.has(dependency)) {
        projection = unsupportedSourceProjection(input.file, (error as Error).message)
        break
      }
      try {
        const dependencyAbs = await input.registry.resolveStorePath(input.storeId, dependency)
        const dependencyBytes = await fs.readFile(dependencyAbs)
        sources.set(dependency, dependencyBytes)
        cssSources[dependency] = dependencyBytes.toString('utf8')
      } catch (dependencyError) {
        projection = unsupportedSourceProjection(input.file, `source dependency unavailable: ${dependency}: ${(dependencyError as Error).message}`)
        break
      }
    }
  }

  return {
    projection,
    sourceHashes: Object.fromEntries([...sources].map(([file, bytes]) => [file, sha256(bytes)])),
    sources: Object.fromEntries([...sources].map(([file, bytes]) => [file, bytes.toString('utf8')])),
    compilerOptions: compilerConfig.options,
  }
}

async function readProjectModuleDependencies(
  input: { storeId: StoreId; file: string; registry: RuntimeRootRegistry },
  sources: Map<string, Buffer>,
  options: ts.CompilerOptions,
  configuredFiles: string[],
): Promise<void> {
  const root = input.registry.get(input.storeId).canonicalRealPath
  await readConfiguredAmbientDeclarations(input, root, configuredFiles, sources)
  await readConfiguredTypeDirectives(input, root, options, sources)
  const pending = [...sources.keys()]
  while (pending.length > 0) {
    const file = pending.pop()!
    const bytes = sources.get(file)
    if (!bytes || !/\.[cm]?[jt]sx?$/.test(file)) continue
    const abs = path.join(root, file)
    const preprocessed = ts.preProcessFile(bytes.toString('utf8'))
    for (const reference of preprocessed.referencedFiles) {
      const referencedAbs = path.resolve(path.dirname(abs), reference.fileName)
      const relative = storeRelativeDependency(root, referencedAbs)
      if (sources.has(relative)) continue
      const jailed = await input.registry.resolveStorePath(input.storeId, relative)
      sources.set(relative, await fs.readFile(jailed))
      pending.push(relative)
    }
    for (const reference of preprocessed.typeReferenceDirectives) {
      const relative = await readTypeDirective(input, root, options, abs, reference.fileName, sources)
      if (relative) pending.push(relative)
    }
    for (const imported of preprocessed.importedFiles) {
      const resolved = ts.resolveModuleName(imported.fileName, abs, options, ts.sys).resolvedModule
      if (!resolved) {
        if (requiresProjectResolution(imported.fileName, options, root, abs) && !imported.fileName.endsWith('.css')) {
          throw namedError(
            'SOURCE_DEPENDENCY_UNRESOLVED',
            `project source dependency could not be resolved from ${file}: ${imported.fileName}`,
            422,
          )
        }
        continue
      }
      if (resolved.isExternalLibraryImport) continue
      const resolvedAbs = path.resolve(resolved.resolvedFileName)
      const relative = storeRelativeDependency(root, resolvedAbs)
      if (sources.has(relative)) continue
      const jailed = await input.registry.resolveStorePath(input.storeId, relative)
      sources.set(relative, await fs.readFile(jailed))
      pending.push(relative)
    }
  }
}

async function readConfiguredTypeDirectives(
  input: { storeId: StoreId; file: string; registry: RuntimeRootRegistry },
  root: string,
  options: ts.CompilerOptions,
  sources: Map<string, Buffer>,
): Promise<void> {
  const containingFile = path.join(root, input.file)
  for (const name of ts.getAutomaticTypeDirectiveNames(options, ts.sys)) {
    await readTypeDirective(input, root, options, containingFile, name, sources)
  }
}

async function readTypeDirective(
  input: { storeId: StoreId; registry: RuntimeRootRegistry },
  root: string,
  options: ts.CompilerOptions,
  containingFile: string,
  name: string,
  sources: Map<string, Buffer>,
): Promise<string | null> {
  const resolved = ts.resolveTypeReferenceDirective(name, containingFile, options, ts.sys).resolvedTypeReferenceDirective
  if (!resolved || resolved.isExternalLibraryImport) return null
  if (!resolved.resolvedFileName) throw namedError('SOURCE_TYPE_DIRECTIVE_UNRESOLVED', `local type directive has no resolved file: ${name}`, 422)
  const relative = storeRelativeDependency(root, resolved.resolvedFileName)
  if (sources.has(relative)) return null
  const jailed = await input.registry.resolveStorePath(input.storeId, relative)
  sources.set(relative, await fs.readFile(jailed))
  return relative
}

async function readConfiguredAmbientDeclarations(
  input: { storeId: StoreId; registry: RuntimeRootRegistry },
  root: string,
  configuredFiles: string[],
  sources: Map<string, Buffer>,
): Promise<void> {
  for (const configuredFile of configuredFiles) {
    if (!configuredFile.endsWith('.d.ts') || isPackageDependency(configuredFile)) continue
    const relative = storeRelativeDependency(root, configuredFile)
    if (sources.has(relative)) continue
    const jailed = await input.registry.resolveStorePath(input.storeId, relative)
    const bytes = await fs.readFile(jailed)
    if (isRelevantAmbientDeclaration(jailed, bytes.toString('utf8'))) sources.set(relative, bytes)
  }
}

function isRelevantAmbientDeclaration(file: string, source: string): boolean {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  if (sf.statements.length === 0) return false
  if (!ts.isExternalModule(sf)) return true
  let relevant = false
  const visit = (node: ts.Node) => {
    if (ts.isModuleDeclaration(node) && (ts.isStringLiteral(node.name) || node.flags & ts.NodeFlags.GlobalAugmentation)) {
      relevant = true
      return
    }
    if (!relevant) ts.forEachChild(node, visit)
  }
  visit(sf)
  return relevant
}

function storeRelativeDependency(root: string, candidate: string): string {
  const resolved = path.resolve(candidate)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw namedError('SOURCE_DEPENDENCY_OUTSIDE_ROOT', `source dependency resolves outside the registered root: ${resolved}`, 422)
  }
  return path.relative(root, resolved).split(path.sep).join('/')
}

function isPackageDependency(file: string): boolean {
  return path.resolve(file).split(path.sep).includes('node_modules')
}

function requiresProjectResolution(
  specifier: string,
  options: ts.CompilerOptions,
  root: string,
  containingFile: string,
): boolean {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) return true
  if (Object.keys(options.paths ?? {}).some((pattern) => {
    const star = pattern.indexOf('*')
    if (star === -1) return specifier === pattern
    return specifier.startsWith(pattern.slice(0, star)) && specifier.endsWith(pattern.slice(star + 1))
  })) return true
  if (!options.baseUrl || packageExistsForSpecifier(specifier, containingFile)) return false
  const baseUrl = path.isAbsolute(options.baseUrl) ? options.baseUrl : path.resolve(root, options.baseUrl)
  const candidate = path.resolve(baseUrl, specifier)
  return candidate === root || candidate.startsWith(root + path.sep)
}

function packageExistsForSpecifier(specifier: string, containingFile: string): boolean {
  const parts = specifier.split('/')
  const packageName = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  if (!packageName || (specifier.startsWith('@') && parts.length < 2)) return false
  let directory = path.dirname(containingFile)
  for (;;) {
    if (ts.sys.fileExists(path.join(directory, 'node_modules', packageName, 'package.json'))) return true
    const parent = path.dirname(directory)
    if (parent === directory) return false
    directory = parent
  }
}

export async function importSourceFileToAuthoringStore(input: {
  storeId: StoreId
  file: string
  expectedSourceHashes: Record<string, string>
  registry: RuntimeRootRegistry
  store: AuthoringSidecarStore
}): Promise<ProjectionImportResult> {
  if (input.registry.get(input.storeId).kind !== 'project') {
    throw namedError('IMPORT_ROOT_UNSUPPORTED', 'G1 source import supports the project root only', 422)
  }
  const classified = await classifySourceFileForImport(input)
  assertExpectedHashes(input.expectedSourceHashes, classified.sourceHashes)
  const imported = importProjectionToAuthoringGraph({
    storeId: input.storeId,
    projection: classified.projection,
    sourceHashes: classified.sourceHashes,
  })
  if (imported.kind !== 'imported') return imported

  const graphPreimage = createEmptyAuthoringGraph({
    storeId: input.storeId,
    rootKind: input.registry.get(input.storeId).kind,
    sourceHashes: classified.sourceHashes,
  })
  const history = new AuthoringHistoryStore(input.registry, input.storeId)
  const metadataPatches = await history.planCommand({
    command: { kind: 'import-legacy-component', file: input.file },
    sourceFiles: Object.keys(classified.sourceHashes),
    sourcePreimages: [],
    graphPreimage: JSON.stringify(graphPreimage, null, 2) + '\n',
    revision: 1,
  })
  const committed = await new SingleRootAuthoringTransaction({
    transactionId: `import-${randomUUID()}`,
    storeId: input.storeId,
    registry: input.registry,
    store: input.store,
  }).commit({
    expectedRevision: 0,
    requireMissingSidecar: true,
    expectedSourceHashes: input.expectedSourceHashes,
    sourceFiles: Object.keys(classified.sourceHashes),
    metadataPatches,
    command: { kind: 'import-legacy-component', file: input.file },
    mutate: () => imported.graph,
  })
  return { kind: 'imported', graph: committed }
}

function assertExpectedHashes(expected: Record<string, string>, actual: Record<string, string>): void {
  const paths = new Set([...Object.keys(expected), ...Object.keys(actual)])
  const changedPaths = [...paths].filter((file) => expected[file] !== actual[file]).sort()
  if (changedPaths.length > 0) {
    throw Object.assign(new Error(`source hash mismatch: ${changedPaths.join(', ')}`), {
      code: 'SOURCE_HASH_STALE',
      status: 409,
      changedPaths,
    })
  }
}

function namedError(code: string, message: string, status: number) {
  return Object.assign(new Error(message), { code, status })
}
