/**
 * react-figma engine — LOCAL FOLDER BROWSER (Dan: "folder browser locally,
 * opens and navigatable"). Lists real directories under the dev root so the
 * editor's Pages panel can navigate the filesystem and load what it finds.
 *
 * Read-only listing; jailed to EDITOR_FS_ROOT (default: the onemo-dev root).
 * Loadability: a folder inside THIS app's src/app that contains page.tsx maps
 * to its route (groups stripped); hosted storybook screens map via HOSTS.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

const APP_ROOT = process.cwd()
const FS_ROOT = process.env.EDITOR_FS_ROOT ?? path.resolve(APP_ROOT, '../../..' /* onemo-next */ + '/..') // → onemo-dev
const SKIP = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'coverage'])

/** storybook screens with a same-origin host route in THIS app */
const HOSTS: Record<string, string> = {
  'storybook/prototypes/create-studio/Editor402.stories.tsx': '/react-figma/canvas',
}

function routeFor(absDir: string): string | undefined {
  const appDir = path.join(APP_ROOT, 'src/app')
  if (!absDir.startsWith(appDir)) return undefined
  const segs = path.relative(appDir, absDir).split(path.sep).filter(Boolean)
  if (segs.some((s) => s.startsWith('['))) return undefined // param routes need values
  if (segs[0] === 'api') return undefined
  const url = '/' + segs.filter((s) => !(s.startsWith('(') && s.endsWith(')'))).join('/')
  return url === '/react-figma' ? undefined : url === '' ? '/' : url
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  const rel = new URL(req.url).searchParams.get('path') ?? ''
  const abs = path.resolve(FS_ROOT, rel)
  if (abs !== FS_ROOT && !abs.startsWith(FS_ROOT + path.sep)) {
    return NextResponse.json({ error: 'outside browse jail' }, { status: 403 })
  }
  let entries
  try {
    entries = await fs.readdir(abs, { withFileTypes: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 })
  }
  const dirs: { name: string; route?: string }[] = []
  const files: { name: string; route?: string }[] = []
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue
    if (e.isDirectory() || e.isSymbolicLink()) {
      const dAbs = path.join(abs, e.name)
      let route: string | undefined
      try { await fs.access(path.join(dAbs, 'page.tsx')); route = routeFor(dAbs) } catch { /* not a screen dir */ }
      dirs.push({ name: e.name, route })
    } else if (/\.(stories\.tsx|tsx)$/.test(e.name)) {
      const relFile = path.relative(APP_ROOT, path.join(abs, e.name))
      files.push({ name: e.name, route: HOSTS[relFile] })
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name))
  files.sort((a, b) => a.name.localeCompare(b.name))
  const relPath = path.relative(FS_ROOT, abs)
  return NextResponse.json({
    root: path.basename(FS_ROOT),
    path: relPath,
    parent: relPath ? path.dirname(relPath).replace(/^\.$/, '') : null,
    appStart: path.relative(FS_ROOT, path.join(APP_ROOT, 'src/app')), // default browse start
    dirs, files,
  })
}
