/**
 * react-figma engine · E4-G3 — source read for Code mode.
 * GET ?file=&line= → the source lines around the selected element's data-src position, so the
 * editor's Code mode shows the real code for what's selected. Dev-only, read-only, jailed to
 * src/ + storybook/ + the global component library src (E7.2 — paths dispatch through the
 * central resolveEditorPath, so package-prefixed identities resolve correctly).
 */
import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { resolveEditorPath, LIB_ROOT } from '../editor/lib'

const ROOT = process.cwd()
const ROOTS = [join(ROOT, 'src'), join(ROOT, 'storybook'), ...(LIB_ROOT ? [join(LIB_ROOT, 'src')] : [])]

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const url = new URL(req.url)
    const file = url.searchParams.get('file') ?? ''
    const line = Math.max(1, parseInt(url.searchParams.get('line') ?? '1', 10) || 1)
    const abs = resolveEditorPath(file)
    if (!ROOTS.some((r) => abs.startsWith(r + sep)) || !/\.(tsx|ts|css)$/.test(abs)) {
      return NextResponse.json({ error: 'outside read jail' }, { status: 403 })
    }
    const lines = (await readFile(abs, 'utf8')).split('\n')
    const start = Math.max(0, line - 7), end = Math.min(lines.length, line + 9)
    return NextResponse.json({ file, line, from: start + 1, snippet: lines.slice(start, end) })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
