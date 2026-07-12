import { NextResponse } from 'next/server'

import { classifySourceFileForImport, importSourceFileToAuthoringStore } from '../editor/authoring-import'
import { isSha256, isStoreRelativePath } from '../editor/authoring-schema'
import { AuthoringSidecarStore } from '../editor/authoring-store'
import { RuntimeRootRegistry } from '../editor/runtime-root-registry'

const STORE_ID = 'project-main'
const COMPONENT_ROOT = 'src/app/(dev)/react-figma-components/'

export async function GET(req: Request) {
  return handleGet(req)
}

export async function POST(req: Request) {
  return handlePost(req)
}

export async function handleGet(req: Request, rootPath = process.cwd()) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  try {
    const file = new URL(req.url).searchParams.get('file')
    if (!isImportFile(file)) return NextResponse.json({ error: 'valid component file required' }, { status: 400 })
    const { registry } = await createContext(rootPath)
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
      return NextResponse.json({ error: 'invalid source import request' }, { status: 400 })
    }
    if (!isImportRequest(body)) return NextResponse.json({ error: 'invalid source import request' }, { status: 400 })
    const { registry, store } = await createContext(rootPath)
    return NextResponse.json(await importSourceFileToAuthoringStore({
      storeId: STORE_ID,
      file: body.file,
      expectedSourceHashes: body.expectedSourceHashes,
      registry,
      store,
    }))
  } catch (error) {
    return errorResponse(error)
  }
}

async function createContext(rootPath: string) {
  const registry = await RuntimeRootRegistry.create([
    { storeId: STORE_ID, kind: 'project', rootPath },
  ])
  const store = new AuthoringSidecarStore({ storeId: STORE_ID, rootKind: 'project', registry })
  return { registry, store }
}

function isImportRequest(value: unknown): value is {
  kind: 'import-source'
  file: string
  expectedSourceHashes: Record<string, string>
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 3 || record.kind !== 'import-source' || !isImportFile(record.file)) return false
  if (!record.expectedSourceHashes || typeof record.expectedSourceHashes !== 'object' || Array.isArray(record.expectedSourceHashes)) return false
  const hashes = record.expectedSourceHashes as Record<string, unknown>
  return Object.keys(hashes).length > 0 && Object.entries(hashes).every(([file, hash]) =>
    isStoreRelativePath(file) && isSha256(hash))
}

function isImportFile(value: unknown): value is string {
  return typeof value === 'string' &&
    isStoreRelativePath(value) &&
    value.startsWith(COMPONENT_ROOT) &&
    value.endsWith('.tsx')
}

function errorResponse(error: unknown) {
  const typed = error as Error & { code?: string; status?: number; changedPaths?: string[] }
  return NextResponse.json({
    error: typed.message,
    code: typed.code,
    ...(typed.changedPaths ? { changedPaths: typed.changedPaths } : {}),
  }, { status: typed.status ?? 500 })
}
