import { NextResponse } from 'next/server'

import { classifySourceFileForImport, importSourceFileToAuthoringStore } from '../editor/authoring-import'
import { parseG2VariantCommand } from '../editor/authoring-commands'
import { isSha256, isStoreRelativePath } from '../editor/authoring-schema'
import { ProjectAuthoringSession } from '../editor/authoring-session'
import { AuthoringSidecarStore } from '../editor/authoring-store'
import { RuntimeRootRegistry } from '../editor/runtime-root-registry'

const STORE_ID = 'project-main'
const COMPONENT_ROOT = 'src/app/(dev)/react-figma-components/'

export async function handleGet(req: Request, rootPath = process.cwd()) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  try {
    const file = new URL(req.url).searchParams.get('file')
    if (!isImportFile(file)) return NextResponse.json({ error: 'valid component file required' }, { status: 400 })
    const { registry, store, session } = await createContext(rootPath)
    const mode = new URL(req.url).searchParams.get('mode')
    if (mode === 'component') return NextResponse.json(await session.loadComponent(file))
    if (mode === 'component-status') {
      try {
        return NextResponse.json({ authoringState: 'loaded', ...await session.loadComponent(file) })
      } catch (error) {
        const code = (error as { code?: unknown }).code
        if (code === 'ENVIRONMENT_FINGERPRINT_STALE') {
          const graph = await store.load()
          if (!graph) throw error
          return NextResponse.json({
            authoringState: 'environment-stale',
            expectedRevision: graph.revision,
            ...await classifySourceFileForImport({ storeId: STORE_ID, file, registry }),
          })
        }
        if (code === 'SOURCE_HASH_STALE') {
          const graph = await store.load()
          if (!graph) throw error
          return NextResponse.json({
            authoringState: 'source-stale',
            expectedRevision: graph.revision,
            changedPaths: (error as { changedPaths?: unknown }).changedPaths,
            ...await classifySourceFileForImport({ storeId: STORE_ID, file, registry }),
          })
        }
        if (code !== 'AUTHORING_GRAPH_MISSING') throw error
        return NextResponse.json({
          authoringState: 'import-preview',
          ...await classifySourceFileForImport({ storeId: STORE_ID, file, registry }),
        })
      }
    }
    return NextResponse.json(await classifySourceFileForImport({ storeId: STORE_ID, file, registry }))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handlePost(req: Request, rootPath = process.cwd()) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  try {
    let body: unknown
    try {
      body = await req.json() as unknown
    } catch {
      return NextResponse.json({ error: 'invalid authoring request' }, { status: 400 })
    }
    if (isImportRequest(body)) {
      const { registry, store } = await createContext(rootPath)
      return NextResponse.json(await importSourceFileToAuthoringStore({
        storeId: STORE_ID,
        file: body.file,
        expectedSourceHashes: body.expectedSourceHashes,
        expectedEnvironmentFingerprint: body.expectedEnvironmentFingerprint,
        transactionId: body.transactionId,
        registry,
        store,
      }))
    }
    if (isExecuteRequest(body)) {
      const { session } = await createContext(rootPath)
      const result = await session.execute(body)
      return NextResponse.json({
        graph: result.graph,
        sourceChanged: result.plan.sourcePatches.length > 0,
      })
    }
    if (isRevalidateRequest(body)) {
      const { session } = await createContext(rootPath)
      return NextResponse.json(await session.revalidateSource(body))
    }
    if (isEnvironmentRebaseRequest(body)) {
      const { session } = await createContext(rootPath)
      return NextResponse.json(await session.rebaseEnvironment(body))
    }
    if (isUndoRequest(body)) {
      const { session } = await createContext(rootPath)
      return NextResponse.json(await session.undo(body))
    }
    return NextResponse.json({ error: 'invalid authoring request' }, { status: 400 })
  } catch (error) {
    return errorResponse(error)
  }
}

async function createContext(rootPath: string) {
  const registry = await RuntimeRootRegistry.create([{ storeId: STORE_ID, kind: 'project', rootPath }])
  const store = new AuthoringSidecarStore({ storeId: STORE_ID, rootKind: 'project', registry })
  const session = new ProjectAuthoringSession({ storeId: STORE_ID, registry, store })
  return { registry, store, session }
}

function isExecuteRequest(value: unknown): value is {
  kind: 'execute-command'
  command: NonNullable<ReturnType<typeof parseG2VariantCommand>>
  expectedRevision: number
  expectedSourceHashes: Record<string, string>
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).sort().join('\0') === ['command', 'expectedRevision', 'expectedSourceHashes', 'kind'].sort().join('\0') &&
    record.kind === 'execute-command' && parseG2VariantCommand(record.command) !== null &&
    typeof record.expectedRevision === 'number' && Number.isSafeInteger(record.expectedRevision) && record.expectedRevision >= 0 &&
    isHashMap(record.expectedSourceHashes)
}

function isImportRequest(value: unknown): value is {
  kind: 'import-source'
  file: string
  expectedSourceHashes: Record<string, string>
  expectedEnvironmentFingerprint: string
  transactionId: string
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (Object.keys(record).sort().join('\0') !== ['kind', 'file', 'expectedSourceHashes', 'expectedEnvironmentFingerprint', 'transactionId'].sort().join('\0')) return false
  return record.kind === 'import-source' && isImportFile(record.file) && isHashMap(record.expectedSourceHashes) &&
    isSha256(record.expectedEnvironmentFingerprint) && isUuid(record.transactionId)
}

function isUndoRequest(value: unknown): value is {
  kind: 'undo'
  expectedRevision: number
  expectedSourceHashes: Record<string, string>
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).sort().join('\0') === ['expectedRevision', 'expectedSourceHashes', 'kind'].sort().join('\0') &&
    record.kind === 'undo' &&
    typeof record.expectedRevision === 'number' && Number.isSafeInteger(record.expectedRevision) && record.expectedRevision >= 0 &&
    isHashMap(record.expectedSourceHashes)
}

function isRevalidateRequest(value: unknown): value is {
  kind: 'revalidate-source'
  file: string
  expectedRevision: number
  expectedSourceHashes: Record<string, string>
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).sort().join('\0') === ['expectedRevision', 'expectedSourceHashes', 'file', 'kind'].sort().join('\0') &&
    record.kind === 'revalidate-source' && isImportFile(record.file) &&
    typeof record.expectedRevision === 'number' && Number.isSafeInteger(record.expectedRevision) && record.expectedRevision >= 0 &&
    isHashMap(record.expectedSourceHashes)
}

function isEnvironmentRebaseRequest(value: unknown): value is {
  kind: 'environment-rebase'
  file: string
  expectedRevision: number
  expectedSourceHashes: Record<string, string>
  expectedEnvironmentFingerprint: string
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).sort().join('\0') === ['expectedEnvironmentFingerprint', 'expectedRevision', 'expectedSourceHashes', 'file', 'kind'].sort().join('\0') &&
    record.kind === 'environment-rebase' && isImportFile(record.file) &&
    typeof record.expectedRevision === 'number' && Number.isSafeInteger(record.expectedRevision) && record.expectedRevision >= 0 &&
    isHashMap(record.expectedSourceHashes) && isSha256(record.expectedEnvironmentFingerprint)
}

function isHashMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const hashes = value as Record<string, unknown>
  return Object.keys(hashes).length > 0 && Object.entries(hashes).every(([file, hash]) => isStoreRelativePath(file) && isSha256(hash))
}

function isImportFile(value: unknown): value is string {
  return typeof value === 'string' && isStoreRelativePath(value) && value.startsWith(COMPONENT_ROOT) && value.endsWith('.tsx')
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function errorResponse(error: unknown) {
  const typed = error as Error & { code?: string; status?: number; changedPaths?: string[] }
  return NextResponse.json({
    error: typed.message,
    code: typed.code,
    ...(typed.changedPaths ? { changedPaths: typed.changedPaths } : {}),
  }, { status: typed.status ?? 500 })
}
