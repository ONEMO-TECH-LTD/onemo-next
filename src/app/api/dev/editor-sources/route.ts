/**
 * react-figma engine — build explorer (Dan: "select build folder to load").
 * Walks src/app for real routes (page.tsx) + registered storybook screen hosts,
 * returns the loadable surfaces of the build grouped by folder. Dev-only.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

const ROOT = process.cwd()

export type BuildSource = { key: string; name: string; route: string; group: string }

async function walkRoutes(dir: string, urlSegs: string[], out: BuildSource[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  if (entries.some((e) => e.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(e.name))) {
    const route = '/' + urlSegs.join('/')
    if (route !== '/react-figma') { // the editor itself is not a canvas
      out.push({
        key: route || '/',
        name: urlSegs[urlSegs.length - 1] ?? 'home',
        route: route || '/',
        group: urlSegs.length > 1 ? urlSegs.slice(0, -1).join('/') : '(root)',
      })
    }
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('_') || e.name === 'api') continue
    const isGroup = e.name.startsWith('(') && e.name.endsWith(')')
    if (e.name.startsWith('[')) continue // param routes need a value — not iframe-loadable as-is
    await walkRoutes(path.join(dir, e.name), isGroup ? urlSegs : [...urlSegs, e.name], out)
  }
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  const sources: BuildSource[] = [
    // storybook screens with a same-origin host route (engine-compatible)
    { key: 'editor-402', name: 'Editor 402 — apple blur glass', route: '/react-figma/canvas', group: 'storybook/create-studio' },
  ]
  await walkRoutes(path.join(ROOT, 'src/app'), [], sources)
  // dedupe by route (host entries take precedence over the walked duplicate)
  const seen = new Set<string>()
  const deduped = sources.filter((s) => (seen.has(s.route) ? false : (seen.add(s.route), true)))
  return NextResponse.json({ sources: deduped })
}
