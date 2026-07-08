/**
 * react-figma engine — TRUE pages of the loaded build (E9 pages model, expert design
 * s58-e9-pages-model-answer.md). NOT a folder browser, NOT a hardcoded sandbox:
 * the loaded build's real route structure IS the page list.
 *
 * GET /api/dev/editor-pages[?root=<rel-to-FS_ROOT>]
 *  → { kind, root, buildName, appDir, pages: [{ name, route, file, home, mutable }] }
 *
 * Adapter: next-app — app root = <root>/src/app else <root>/app (Next's own rule),
 * recursive page.tsx|jsx|js scan, route groups collapsed, api/ and [param] excluded.
 * Root jailed under FS_ROOT (onemo-dev). No detection → no pages (honest empty, no finder fallback).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

const APP_ROOT = process.cwd()
const FS_ROOT = process.env.EDITOR_FS_ROOT ?? path.resolve(APP_ROOT, '../../..' /* onemo-next */ + '/..') // → onemo-dev
const SKIP = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'coverage'])

type BuildPage = { name: string; route: string; file: string; home: boolean; mutable: boolean }

async function exists(p: string): Promise<boolean> { try { await fs.access(p); return true } catch { return false } }

/** Next's own app-root rule: src/app if present, else app. */
async function appDirOf(root: string): Promise<string | null> {
  for (const c of ['src/app', 'app']) { const p = path.join(root, c); if (await exists(path.join(p))) return p }
  return null
}

async function detectBuildKind(root: string): Promise<'next-app' | null> {
  const hasConfig = (await Promise.all(['next.config.ts', 'next.config.js', 'next.config.mjs'].map((f) => exists(path.join(root, f))))).some(Boolean)
  if (hasConfig && (await appDirOf(root))) return 'next-app'
  return null
}

/** editor-fs's routeFor, lifted + parameterized on appDir (the expert's "only hardcoding to remove"). */
function routeFor(appDir: string, absDir: string): string | undefined {
  const segs = path.relative(appDir, absDir).split(path.sep).filter(Boolean)
  if (segs.some((s) => s.startsWith('['))) return undefined // dynamic routes need a value — excluded in v1
  if (segs[0] === 'api') return undefined
  const url = '/' + segs.filter((s) => !(s.startsWith('(') && s.endsWith(')'))).join('/')
  return url === '' ? '/' : url
}

async function scanPages(root: string): Promise<{ appDir: string; pages: BuildPage[] } | null> {
  const appDir = await appDirOf(root)
  if (!appDir) return null
  const pages: BuildPage[] = []
  const walk = async (dir: string): Promise<void> => {
    let entries
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const f of ['page.tsx', 'page.jsx', 'page.js']) {
      if (entries.some((e) => e.isFile() && e.name === f)) {
        const route = routeFor(appDir, dir)
        if (route !== undefined) {
          const segs = route.split('/').filter(Boolean)
          pages.push({ name: route === '/' ? 'home' : segs[segs.length - 1], route, file: path.relative(root, path.join(dir, f)), home: route === '/', mutable: true })
        }
        break
      }
    }
    for (const e of entries) {
      if ((e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith('.') && !SKIP.has(e.name) && e.name !== 'api') await walk(path.join(dir, e.name))
    }
  }
  await walk(appDir)
  // Framer parity: flat list, home first, then alpha by route.
  pages.sort((a, b) => (a.home ? -1 : b.home ? 1 : a.route.localeCompare(b.route)))
  return { appDir, pages }
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  const rel = new URL(req.url).searchParams.get('root')
  const root = rel ? path.resolve(FS_ROOT, rel) : APP_ROOT
  if (root !== FS_ROOT && !root.startsWith(FS_ROOT + path.sep)) return NextResponse.json({ error: 'outside build jail' }, { status: 403 })
  const kind = await detectBuildKind(root)
  if (!kind) return NextResponse.json({ kind: null, root: path.relative(FS_ROOT, root), buildName: path.basename(root), pages: [] })
  const scanned = await scanPages(root)
  let buildName = path.basename(root)
  try { buildName = (JSON.parse((await fs.readFile(path.join(root, 'package.json'))).toString('utf8')) as { name?: string }).name ?? buildName } catch { /* basename fallback */ }
  return NextResponse.json({ kind, root: path.relative(FS_ROOT, root), buildName, appDir: path.relative(root, scanned!.appDir), pages: scanned!.pages })
}
