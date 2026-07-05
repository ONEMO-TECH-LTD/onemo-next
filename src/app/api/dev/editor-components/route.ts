/**
 * react-figma engine · E4-G4 — Assets panel component list.
 * GET → the reusable components available to insert: the ones extracted in-editor
 * (src/app/(dev)/react-figma-components/*.tsx). Dev-only, read-only. Each entry carries the
 * component name + its @/-alias import path so the Assets panel can insert an instance.
 */
import { NextResponse } from 'next/server'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const COMP_DIR = join(process.cwd(), 'src', 'app', '(dev)', 'react-figma-components')

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    let files: string[] = []
    try { files = await readdir(COMP_DIR) } catch { files = [] } // dir may not exist yet
    const components = files
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => f.replace(/\.tsx$/, ''))
      .map((name) => ({ name, importPath: `@/app/(dev)/react-figma-components/${name}` }))
    return NextResponse.json({ components, count: components.length })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
