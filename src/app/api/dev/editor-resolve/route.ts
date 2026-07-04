/**
 * react-figma engine · E1.4 — DeclRef resolver endpoint (KAI-9307).
 * POST { file, classes, props } → ResolveResult (byte-exact DeclRefs).
 * Dev-only; single postcss authority shared with editor-write (lib.ts).
 */
import { NextResponse } from 'next/server'
import { resolveDeclRefs } from '../editor/lib'

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const { file, classes, props } = (await req.json()) as { file: string; classes: string[]; props: string[] }
    if (!file || !Array.isArray(classes) || !Array.isArray(props)) {
      return NextResponse.json({ error: 'file, classes[], props[] required' }, { status: 400 })
    }
    return NextResponse.json(await resolveDeclRefs(file, classes, props))
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
