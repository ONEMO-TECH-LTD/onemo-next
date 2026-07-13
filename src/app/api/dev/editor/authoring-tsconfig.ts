import { promises as fs } from 'node:fs'
import path from 'node:path'

import * as ts from 'typescript'

import type { StoreId } from './authoring-types'
import { RuntimeRootRegistry } from './runtime-root-registry'

export type ExactCompilerConfig = {
  options: ts.CompilerOptions
  configuredFiles: string[]
  sources: Record<string, Buffer>
}

const DEFAULT_OPTIONS: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  noEmit: true,
}

export async function readExactCompilerConfig(input: {
  storeId: StoreId
  registry: RuntimeRootRegistry
}): Promise<ExactCompilerConfig> {
  const root = input.registry.get(input.storeId).canonicalRealPath
  const rootConfig = 'tsconfig.json'
  let rootBytes: Buffer
  try {
    rootBytes = await fs.readFile(await input.registry.resolveStorePath(input.storeId, rootConfig))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { options: freezeCompilerOptions({ ...DEFAULT_OPTIONS }), configuredFiles: [], sources: {} }
    }
    throw error
  }

  const sources = new Map<string, Buffer>()
  const parsedConfigs = new Map<string, unknown>()
  await readConfigChain(input, rootConfig, rootBytes, sources, parsedConfigs, new Set())

  const parsed = parseCompilerConfig(
    root,
    sources,
    parsedConfigs.get(rootConfig),
    ts.sys.readDirectory,
    false,
  )
  await validateProjectResolutionAuthorities(input, root, parsed.options)
  return parsed
}

export function parseExactCompilerConfigFromSources(input: {
  projectRoot: string
  sources: Record<string, Buffer | string>
}): ExactCompilerConfig {
  const sources = new Map(Object.entries(input.sources).map(([file, bytes]) => [
    file,
    Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8'),
  ]))
  const rootBytes = sources.get('tsconfig.json')
  if (!rootBytes) {
    return { options: freezeCompilerOptions({ ...DEFAULT_OPTIONS }), configuredFiles: [], sources: {} }
  }
  const rootConfig = ts.parseConfigFileTextToJson(
    path.join(input.projectRoot, 'tsconfig.json'),
    rootBytes.toString('utf8'),
  )
  if (rootConfig.error) throw namedError('SOURCE_TSCONFIG_INVALID', formatDiagnostic(rootConfig.error))
  const parsed = parseCompilerConfig(input.projectRoot, sources, rootConfig.config, () => [], true)
  return parsed
}

function parseCompilerConfig(
  root: string,
  sources: Map<string, Buffer>,
  rootConfig: unknown,
  readDirectory: ts.ParseConfigHost['readDirectory'],
  allowNoInputs: boolean,
): ExactCompilerConfig {
  const configPath = path.join(root, 'tsconfig.json')
  const host: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    readDirectory,
    fileExists: (candidate) => {
      const relative = maybeStoreRelative(root, candidate)
      return relative !== null && sources.has(relative)
    },
    readFile: (candidate) => {
      const relative = maybeStoreRelative(root, candidate)
      return relative === null ? undefined : sources.get(relative)?.toString('utf8')
    },
  }
  const parsed = ts.parseJsonConfigFileContent(
    rootConfig,
    host,
    root,
    { noEmit: true },
    configPath,
  )
  projectResolutionAuthorityPaths(root, parsed.options)
  const errors = allowNoInputs ? parsed.errors.filter((diagnostic) => diagnostic.code !== 18003) : parsed.errors
  if (errors.length > 0) {
    throw namedError('SOURCE_TSCONFIG_INVALID', errors.map(formatDiagnostic).join('; '))
  }
  return {
    options: freezeCompilerOptions({ ...parsed.options, noEmit: true }),
    configuredFiles: [...parsed.fileNames],
    sources: Object.fromEntries(sources),
  }
}

async function validateProjectResolutionAuthorities(
  input: { storeId: StoreId; registry: RuntimeRootRegistry },
  root: string,
  options: ts.CompilerOptions,
): Promise<void> {
  for (const relative of projectResolutionAuthorityPaths(root, options)) {
    if (relative !== '') await input.registry.resolveStorePath(input.storeId, relative)
  }
}

function projectResolutionAuthorityPaths(root: string, options: ts.CompilerOptions): string[] {
  const authorities = [
    ...(options.baseUrl ? [options.baseUrl] : []),
    ...(options.rootDirs ?? []),
  ]
  const pathsBase = options.baseUrl ?? root
  for (const targets of Object.values(options.paths ?? {})) {
    for (const target of targets) authorities.push(path.resolve(pathsBase, target.replace('*', '__onemo_wildcard__')))
  }
  return authorities.map((authority) => toStoreRelative(root, authority))
}

async function readConfigChain(
  input: { storeId: StoreId; registry: RuntimeRootRegistry },
  relative: string,
  bytes: Buffer,
  sources: Map<string, Buffer>,
  parsedConfigs: Map<string, unknown>,
  active: Set<string>,
): Promise<void> {
  if (active.has(relative)) throw namedError('SOURCE_TSCONFIG_INVALID', `tsconfig extends cycle: ${relative}`)
  if (sources.has(relative)) return
  const absolute = input.registry.get(input.storeId).canonicalRealPath
  const parsed = ts.parseConfigFileTextToJson(path.join(absolute, relative), bytes.toString('utf8'))
  if (parsed.error) throw namedError('SOURCE_TSCONFIG_INVALID', formatDiagnostic(parsed.error))
  if (!parsed.config || typeof parsed.config !== 'object' || Array.isArray(parsed.config)) {
    throw namedError('SOURCE_TSCONFIG_INVALID', `tsconfig must contain an object: ${relative}`)
  }

  sources.set(relative, bytes)
  parsedConfigs.set(relative, parsed.config)
  active.add(relative)
  const extended = (parsed.config as { extends?: unknown }).extends
  const specifiers = extended === undefined ? [] : Array.isArray(extended) ? extended : [extended]
  for (const specifier of specifiers) {
    if (typeof specifier !== 'string') {
      throw namedError('SOURCE_TSCONFIG_EXTENDS_UNSUPPORTED', `tsconfig extends must be root-local: ${String(specifier)}`)
    }
    if (path.isAbsolute(specifier)) {
      toStoreRelative(absolute, specifier)
      throw namedError('SOURCE_TSCONFIG_EXTENDS_UNSUPPORTED', 'absolute tsconfig extends paths are not supported')
    }
    const child = await resolveExtendedConfig(input, relative, specifier, sources)
    const childBytes = await fs.readFile(await input.registry.resolveStorePath(input.storeId, child))
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') throw namedError('SOURCE_TSCONFIG_EXTENDS_UNRESOLVED', `tsconfig extends not found: ${specifier}`)
        throw error
      })
    await readConfigChain(input, child, childBytes, sources, parsedConfigs, active)
  }
  active.delete(relative)
}

async function resolveExtendedConfig(
  input: { storeId: StoreId; registry: RuntimeRootRegistry },
  parent: string,
  specifier: string,
  sources: Map<string, Buffer>,
): Promise<string> {
  const root = input.registry.get(input.storeId).canonicalRealPath
  if (!specifier.startsWith('.')) return resolvePackageExtendedConfig(input, parent, specifier, sources)
  const unresolved = path.resolve(root, path.dirname(parent), specifier)
  return requireConfigCandidate(input, specifier, unresolved)
}

async function resolvePackageExtendedConfig(
  input: { storeId: StoreId; registry: RuntimeRootRegistry },
  parent: string,
  specifier: string,
  sources: Map<string, Buffer>,
): Promise<string> {
  const root = input.registry.get(input.storeId).canonicalRealPath
  const parts = specifier.split('/')
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw namedError('SOURCE_TSCONFIG_EXTENDS_UNSUPPORTED', `invalid package tsconfig extends: ${specifier}`)
  }
  const packageParts = specifier.startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1)
  const subpath = parts.slice(packageParts.length).join('/')
  if (packageParts.some((part) => !part) || (specifier.startsWith('@') && packageParts.length !== 2)) {
    throw namedError('SOURCE_TSCONFIG_EXTENDS_UNSUPPORTED', `invalid package tsconfig extends: ${specifier}`)
  }

  let directory = path.resolve(root, path.dirname(parent))
  for (;;) {
    const packageRoot = path.join(directory, 'node_modules', ...packageParts)
    if (packageRoot === root || packageRoot.startsWith(root + path.sep)) {
      if (subpath) {
        try {
          return await requireConfigCandidate(input, specifier, path.join(packageRoot, subpath))
        } catch (error) {
          if ((error as { code?: string }).code !== 'SOURCE_TSCONFIG_EXTENDS_UNRESOLVED') throw error
        }
      } else {
        const packageJsonRelative = toStoreRelative(root, path.join(packageRoot, 'package.json'))
        try {
          const packageJsonPath = await input.registry.resolveStorePath(input.storeId, packageJsonRelative)
          const packageJsonBytes = await fs.readFile(packageJsonPath)
          const packageJson = JSON.parse(packageJsonBytes.toString('utf8')) as { tsconfig?: unknown }
          sources.set(packageJsonRelative, packageJsonBytes)
          const target = typeof packageJson.tsconfig === 'string' ? packageJson.tsconfig : 'tsconfig.json'
          return await requireConfigCandidate(input, specifier, path.join(packageRoot, target))
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && (error as { code?: string }).code !== 'SOURCE_TSCONFIG_EXTENDS_UNRESOLVED') {
            if (error instanceof SyntaxError) throw namedError('SOURCE_TSCONFIG_INVALID', `invalid package.json for tsconfig extends: ${specifier}`)
            throw error
          }
        }
      }
    }
    if (directory === root) break
    const next = path.dirname(directory)
    if (next === directory || (next !== root && !next.startsWith(root + path.sep))) break
    directory = next
  }
  throw namedError('SOURCE_TSCONFIG_EXTENDS_UNRESOLVED', `tsconfig extends not found: ${specifier}`)
}

async function requireConfigCandidate(
  input: { storeId: StoreId; registry: RuntimeRootRegistry },
  specifier: string,
  unresolved: string,
): Promise<string> {
  const root = input.registry.get(input.storeId).canonicalRealPath
  const candidates = path.extname(unresolved) ? [unresolved] : [`${unresolved}.json`, path.join(unresolved, 'tsconfig.json')]
  for (const candidate of candidates) {
    const relative = toStoreRelative(root, candidate)
    const absolute = await input.registry.resolveStorePath(input.storeId, relative)
    try {
      const stat = await fs.stat(absolute)
      if (stat.isFile()) return relative
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  throw namedError('SOURCE_TSCONFIG_EXTENDS_UNRESOLVED', `tsconfig extends not found: ${specifier}`)
}

function toStoreRelative(root: string, candidate: string): string {
  const resolved = path.resolve(candidate)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw namedError('SOURCE_TSCONFIG_OUTSIDE_ROOT', `tsconfig resolves outside the registered root: ${resolved}`)
  }
  return path.relative(root, resolved).split(path.sep).join('/')
}

function maybeStoreRelative(root: string, candidate: string): string | null {
  const resolved = path.resolve(candidate)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null
  return path.relative(root, resolved).split(path.sep).join('/')
}

function freezeCompilerOptions(options: ts.CompilerOptions): ts.CompilerOptions {
  return deepFreeze(options)
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  for (const nested of Object.values(value)) deepFreeze(nested, seen)
  return Object.freeze(value)
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  return `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`
}

function namedError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code, status: 422 })
}
