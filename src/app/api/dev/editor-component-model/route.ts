/**
 * I0 (component engine, blueprint §1): GET /api/dev/editor-component-model?file=<rel-.tsx>
 * → the structured ComponentModel (props + config variants + states) parsed from source.
 * The READ half of the bidirectional compiler — after every write the editor re-reads this so the
 * inspector never drifts from source. Dev-only.
 */
import { NextResponse } from 'next/server'
import { parseComponentModel } from '../editor/lib'

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  const file = new URL(req.url).searchParams.get('file')
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
  try {
    return NextResponse.json(await parseComponentModel(file))
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500
    return NextResponse.json({ error: (e as Error).message }, { status })
  }
}
