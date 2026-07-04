/**
 * react-figma engine · E1.4 — surgical write endpoint (KAI-9307).
 * POST WriteOp → byte-splice into the owning *.module.css (jail-guarded,
 * stale-DeclRef 409), or the converter loop for token values.
 * Dev-only. See ENGINE-PLAN.md §3 M4 / §4.
 */
import { NextResponse } from 'next/server'
import { applyWrite, type WriteOp } from '../editor/lib'

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const op = (await req.json()) as WriteOp
    if (!op?.kind) return NextResponse.json({ error: 'WriteOp required' }, { status: 400 })
    return NextResponse.json(await applyWrite(op))
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
