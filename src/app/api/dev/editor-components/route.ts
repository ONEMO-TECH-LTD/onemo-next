/**
 * react-figma engine · E4-G4 / E7.2 — component inventory for Assets + the components canvas.
 * GET → every reusable component across BOTH roots (architecture v4.1 §5/§6):
 *  - project: src/app/(dev)/react-figma-components/** (category = first-level subdir)
 *  - global:  the onemo-component-library package's src/** (category = first-level subdir)
 * Each entry: { name, category, importPath, root, file } — importPath insertable by
 * insert-component; file is the editor identity (repo-relative or package-prefixed per F1).
 * Dev-only, read-only.
 */
import { NextResponse } from 'next/server'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { LIB_NAME, LIB_ROOT, exportedTsxNames } from '../editor/lib'

const ROOT = process.cwd()
const COMP_DIR = join(ROOT, 'src', 'app', '(dev)', 'react-figma-components')

type Entry = { name: string; category: string; importPath: string; root: 'project' | 'global'; file: string; exports: string[] }

/* Variants metadata: parsed server-side from the file (always fresh — a NEW global file's
 * variants are correct even before webpack sees it). Parser shared with the barrel regen. */
async function exportedNames(abs: string): Promise<string[]> {
  try { return exportedTsxNames(abs, await readFile(abs, 'utf8')) } catch { return [] }
}

async function walkTsx(dir: string): Promise<string[]> {
  let out: string[] = []
  let entries: import('node:fs').Dirent[] = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return [] }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out = out.concat(await walkTsx(p))
    else if (e.isFile() && e.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

function categoryOf(relPath: string): string {
  const parts = relPath.split(sep)
  return parts.length > 1 ? parts[0] : 'ungrouped'
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const components: Entry[] = []
    for (const abs of await walkTsx(COMP_DIR)) {
      const rel = relative(COMP_DIR, abs)
      const name = rel.split(sep).pop()!.replace(/\.tsx$/, '')
      const sub = rel.replace(/\.tsx$/, '').split(sep).join('/')
      components.push({
        name,
        category: categoryOf(rel),
        importPath: `@/app/(dev)/react-figma-components/${sub}`,
        root: 'project',
        file: relative(ROOT, abs),
        exports: await exportedNames(abs),
      })
    }
    if (LIB_ROOT) {
      const libSrc = join(LIB_ROOT, 'src')
      for (const abs of await walkTsx(libSrc)) {
        const rel = relative(libSrc, abs)
        components.push({
          name: rel.split(sep).pop()!.replace(/\.tsx$/, ''),
          category: categoryOf(rel),
          importPath: LIB_NAME, // barrel import — validated by insert-component's existing regex
          root: 'global',
          file: `${LIB_NAME}/src/${rel.split(sep).join('/')}`, // F1 package-prefixed identity
          exports: await exportedNames(abs),
        })
      }
    }
    return NextResponse.json({ components, count: components.length })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
