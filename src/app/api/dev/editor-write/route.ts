/**
 * react-figma engine · E1.4 — surgical write endpoint (KAI-9307).
 * POST WriteOp → byte-splice into the owning *.module.css (jail-guarded,
 * stale-DeclRef 409), or the converter loop for token values.
 * Dev-only. See ENGINE-PLAN.md §3 M4 / §4.
 */
import { NextResponse } from 'next/server'
import path from 'node:path'
import { applyWrite, type WriteOp } from '../editor/lib'

const PROJECT_COMPONENT_ROOT = 'src/app/(dev)/react-figma-components/'

function targetsProjectComponentSource(file: unknown): boolean {
  if (typeof file !== 'string') return false
  return path.posix.normalize(file).startsWith(PROJECT_COMPONENT_ROOT)
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const op = (await req.json()) as WriteOp
    if (!op?.kind) return NextResponse.json({ error: 'WriteOp required' }, { status: 400 })
    if (targetsProjectComponentSource((op as { file?: unknown }).file)) {
      return NextResponse.json({
        error: 'project component source writes require the authoring transaction',
        code: 'AUTHORING_TRANSACTION_REQUIRED',
      }, { status: 409 })
    }
    return NextResponse.json(await applyWrite(op))
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
