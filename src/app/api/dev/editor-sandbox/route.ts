/**
 * react-figma engine · E6.9 — sandbox branching + time-capsule versioning (KAI-9359).
 * Dan's model: a "branch" is a plain COPY of the build folder run as a sandbox on its own
 * port (APFS copy-on-write clone — instant, node_modules shared until divergence). Everything
 * stays sandboxed until explicitly saved back. Versioning = Figma/Framer-style time capsule:
 * every Publish snapshots the editable surface; any version restores or forks.
 *
 * Safety model (deliberate):
 * - History covers the editor-writable surface: the seed dirs (pages sandbox, extracted
 *   components, canvas) plus every build-source file Publish writes ('track' baselines each at
 *   its original content first). Restore rewinds tracked files; only editor-owned seed content
 *   is ever deleted — branch/dev work outside the tracked surface can't be clobbered.
 * - History lives in a separate hidden git dir (.editor-history) — the real repo's git is
 *   never touched by versioning.
 * - Fork clones the build folder, DROPS the inherited .git link (a worktree .git file would
 *   dangle), and re-inits a private history baseline in the clone.
 * - Dev-only, POST actions validated, names jailed to [a-z0-9-].
 */
import { NextResponse } from 'next/server'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, open, readFile, realpath, rm, rmdir, symlink, writeFile, stat } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join, dirname, basename } from 'node:path'
import { LIB_ROOT } from '../editor/lib'

const run = promisify(execFile)
const ROOT = process.cwd()
/* The editable surface — the "file" the editor owns. Everything else is app machinery. */
const HISTORY_PATHS = [
  'src/app/(dev)/react-figma-pages',
  'src/app/(dev)/react-figma-components',
  'src/app/(dev)/react-figma/canvas',
]
const HISTORY_DIR = '.editor-history'
/* E7.4 (KAI-9378, lead F2): history paths are PER ROOT — the app root keeps its seed dirs;
 * the global component library's whole editable surface is its src/. */
function historyPathsFor(root: string): string[] {
  return LIB_ROOT && root === LIB_ROOT ? ['src'] : HISTORY_PATHS
}
/* Root selector (QA R3 shape): 'package' → the library realpath; default → the app root. */
function rootFor(sel?: string): string {
  if (sel === 'package') {
    if (!LIB_ROOT) throw Object.assign(new Error('component library not installed'), { status: 403 })
    return LIB_ROOT
  }
  if (sel && sel !== 'app') throw Object.assign(new Error('root must be app|package'), { status: 422 })
  return ROOT
}
/* Sandbox registry lives OUTSIDE any repo (sibling of the builds), so clones share it. */
const REGISTRY = join(dirname(dirname(ROOT)), '.react-figma-sandboxes.json')

type SandboxEntry = { name: string; path: string; port: number; pid: number; forkedFrom: string; createdAt: string }

async function readRegistry(): Promise<SandboxEntry[]> {
  try { return JSON.parse(await readFile(REGISTRY, 'utf8')) as SandboxEntry[] } catch { return [] }
}
async function writeRegistry(entries: SandboxEntry[]) {
  await writeFile(REGISTRY, JSON.stringify(entries, null, 2))
}
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}
async function freePort(from: number): Promise<number> {
  for (let p = from; p < from + 40; p++) {
    const ok = await new Promise<boolean>((resolve) => {
      const srv = createServer()
      srv.once('error', () => resolve(false))
      srv.once('listening', () => srv.close(() => resolve(true)))
      srv.listen(p, '127.0.0.1')
    })
    if (ok) return p
  }
  throw Object.assign(new Error('no free port in range'), { status: 507 })
}

/* git against the hidden history dir, scoped work-tree = the given build root. */
async function hgit(root: string, args: string[]) {
  return run('git', ['--git-dir', join(root, HISTORY_DIR), '--work-tree', root, ...args], { cwd: root })
}
async function ensureHistory(root: string) {
  try { await stat(join(root, HISTORY_DIR)) } catch {
    // init a private repo whose git-dir is .editor-history — the real .git is never touched
    await run('git', ['init'], { cwd: root, env: { ...process.env, GIT_DIR: join(root, HISTORY_DIR), GIT_WORK_TREE: root } })
    await hgit(root, ['config', 'core.bare', 'false'])
    await hgit(root, ['config', 'core.worktree', root])
    await hgit(root, ['config', 'user.email', 'editor@react-figma.local'])
    await hgit(root, ['config', 'user.name', 'react-figma editor'])
  }
}
async function snapshot(root: string, label: string, extraFiles: string[] = []): Promise<{ hash: string }> {
  await ensureHistory(root)
  // add each surface dir separately — one missing dir must not mask the others
  for (const p of historyPathsFor(root)) await hgit(root, ['add', '--force', '--', p]).catch(() => null)
  // Publish can write anywhere in the connected build's source (e.g. storybook/…) — the client
  // reports each written file so history covers the REAL editable surface, not just the seed dirs.
  // Once added, a file stays tracked, so later plain snapshots keep capturing its changes.
  for (const f of extraFiles) {
    if (typeof f !== 'string' || f.includes('..') || f.startsWith('/')) continue // jail: repo-relative only
    await hgit(root, ['add', '--force', '--', f]).catch(() => null)
  }
  // refresh everything history already tracks (files pulled in by prior publishes)
  await hgit(root, ['add', '--update']).catch(() => null)
  const msg = label || `checkpoint ${new Date().toISOString()}`
  await hgit(root, ['commit', '-m', msg, '--allow-empty'])
  const { stdout } = await hgit(root, ['rev-parse', 'HEAD'])
  return { hash: stdout.trim() }
}
async function checkoutHistoryRef(root: string, ref: string) {
  // true time-travel over the WHOLE tracked history tree (seed dirs + every file Publish
  // ever wrote): files created after the target version go away, tracked files rewind.
  const { stdout: nowList } = await hgit(root, ['ls-files'])
  const { stdout: refList } = await hgit(root, ['ls-tree', '-r', '--name-only', ref])
  const refSet = new Set(refList.trim().split('\n').filter(Boolean))
  const emptied = new Set<string>()
  for (const f of nowList.trim().split('\n').filter(Boolean)) {
    // DELETE only inside the editor-owned seed dirs (pages/components/canvas — editor-created
    // content). Build-source files (storybook/…) are only ever REWOUND, never deleted: absent
    // from an old ref usually means "entered history later", not "didn't exist".
    const editorOwned = historyPathsFor(root).some((p) => f.startsWith(p + '/'))
    if (!refSet.has(f) && editorOwned) { await rm(join(root, f), { force: true }); emptied.add(dirname(f)) }
  }
  // prune now-empty dirs (git tracks files only); rmdir refuses non-empty dirs, so this
  // can never remove a folder still holding untracked/unrelated files
  for (let d of emptied) {
    while (historyPathsFor(root).some((p) => d.startsWith(p + '/'))) {
      try { await rmdir(join(root, d)) } catch { break } // non-empty or gone → stop climbing
      d = dirname(d)
    }
  }
  await hgit(root, ['checkout', ref, '--', '.']).catch(() => null) // rewind whole tracked tree
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const body = await req.json() as { action: string; name?: string; label?: string; ref?: string; files?: string[]; root?: string }
    const { action } = body

    if (action === 'fork') {
      const name = (body.name ?? '').trim()
      const ref = (body.ref ?? '').trim()
      if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(name)) {
        return NextResponse.json({ error: 'invalid sandbox name (a-z, 0-9, dashes)' }, { status: 422 })
      }
      if (ref && !/^[0-9a-f]{7,40}$/.test(ref)) return NextResponse.json({ error: 'invalid version ref' }, { status: 422 })
      const registry = await readRegistry()
      if (registry.some((e) => e.name === name && alive(e.pid))) {
        return NextResponse.json({ error: 'sandbox name already running' }, { status: 409 })
      }
      const dest = join(dirname(ROOT), `${basename(ROOT)}--sandbox-${name}`)
      try { await stat(dest); return NextResponse.json({ error: 'sandbox folder already exists' }, { status: 409 }) } catch { /* free */ }
      // APFS clonefile via cp -c (instant, copy-on-write); fs.cp fallback for non-APFS.
      try {
        await run('cp', ['-c', '-R', ROOT, dest], { maxBuffer: 1024 * 1024 })
      } catch {
        await cp(ROOT, dest, { recursive: true })
      }
      // drop inherited git link (worktree .git is a file pointer — dangling in a copy) + stale build cache
      await rm(join(dest, '.git'), { recursive: true, force: true })
      await rm(join(dest, '.next'), { recursive: true, force: true })
      // deps: worktrees often symlink node_modules relatively (breaks from the clone) or carry a
      // stub dir — always point the clone at the SOURCE's resolved real node_modules (same repo,
      // identical deps; a dangling/stub copy means `next` doesn't exist and the dev server dies).
      const realMods = await realpath(join(ROOT, 'node_modules')).catch(() => null)
      if (realMods) {
        await rm(join(dest, 'node_modules'), { recursive: true, force: true })
        await symlink(realMods, join(dest, 'node_modules'))
      }
      if (ref) {
        await checkoutHistoryRef(dest, ref)
        await snapshot(dest, `fork baseline from ${ref.slice(0, 8)}`)
      } else {
        await snapshot(dest, `fork baseline from ${basename(ROOT)}`)
      }
      const port = await freePort(3030)
      // dev server output goes to <clone>/dev.log — a boot crash must be diagnosable, not silent
      const log = await open(join(dest, 'dev.log'), 'a')
      // --webpack explicit: the editor's data-src tagging is a webpack loader, and a bare
      // `next dev` in the clone exits prompting for a bundler choice (caught via dev.log)
      const child = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--webpack'], {
        cwd: dest, detached: true, stdio: ['ignore', log.fd, log.fd], env: { ...process.env, PORT: String(port) },
      })
      child.unref()
      await log.close()
      const entry: SandboxEntry = { name, path: dest, port, pid: child.pid ?? -1, forkedFrom: ROOT, createdAt: new Date().toISOString() }
      await writeRegistry([...registry.filter((e) => e.name !== name), entry])
      return NextResponse.json({ ok: true, ...entry, url: `http://localhost:${port}/react-figma` })
    }

    if (action === 'list') {
      const registry = await readRegistry()
      return NextResponse.json({ sandboxes: registry.map((e) => ({ ...e, alive: alive(e.pid) })) })
    }

    if (action === 'stop') {
      const registry = await readRegistry()
      const entry = registry.find((e) => e.name === body.name)
      if (!entry) return NextResponse.json({ error: 'unknown sandbox' }, { status: 404 })
      if (alive(entry.pid)) { try { process.kill(-entry.pid) } catch { process.kill(entry.pid) } }
      return NextResponse.json({ ok: true, stopped: entry.name })
    }

    if (action === 'track') {
      const trackRoot = rootFor(body.root)
      // Called by Publish BEFORE writing: baselines not-yet-tracked build files into history at
      // their ORIGINAL content, so the pre-edit state is always restorable. No-op if all tracked.
      await ensureHistory(trackRoot)
      const files = (Array.isArray(body.files) ? body.files.slice(0, 200) : []).filter(
        (f) => typeof f === 'string' && !f.includes('..') && !f.startsWith('/'),
      )
      let added = 0
      for (const f of files) {
        const { stdout } = await hgit(trackRoot, ['ls-files', '--', f]).catch(() => ({ stdout: '' }))
        if (!stdout.trim()) { await hgit(trackRoot, ['add', '--force', '--', f]).catch(() => null); added++ }
      }
      if (added) {
        // Fresh histories need the seed editor dirs in the same baseline; otherwise restoring the
        // first tracked build-file baseline can treat routes like canvas as post-ref creations.
        for (const p of historyPathsFor(trackRoot)) await hgit(trackRoot, ['add', '--force', '--', p]).catch(() => null)
        const { stdout: staged } = await hgit(trackRoot, ['diff', '--cached', '--name-only'])
        if (staged.trim()) await hgit(trackRoot, ['commit', '-m', `baseline — ${added} file(s) entered history`])
      }
      return NextResponse.json({ ok: true, tracked: added })
    }

    if (action === 'snapshot') {
      const { hash } = await snapshot(rootFor(body.root), (body.label ?? '').slice(0, 200), Array.isArray(body.files) ? body.files.slice(0, 200) : [])
      return NextResponse.json({ ok: true, hash })
    }

    if (action === 'versions') {
      const vRoot = rootFor(body.root)
      await ensureHistory(vRoot)
      const { stdout } = await hgit(vRoot, ['log', '--pretty=%H|%cI|%s', '-100']).catch(() => ({ stdout: '' }))
      const versions = stdout.trim().split('\n').filter(Boolean).map((l) => {
        const [hash, date, ...m] = l.split('|')
        return { hash, date, label: m.join('|') }
      })
      return NextResponse.json({ versions })
    }

    if (action === 'restore') {
      const rRoot = rootFor(body.root)
      const ref = (body.ref ?? '').trim()
      if (!/^[0-9a-f]{7,40}$/.test(ref)) return NextResponse.json({ error: 'invalid version ref' }, { status: 422 })
      await snapshot(rRoot, `pre-restore safety checkpoint`) // restoring is itself revertable
      await checkoutHistoryRef(rRoot, ref)
      const { hash } = await snapshot(rRoot, `restored to ${ref.slice(0, 8)}`)
      return NextResponse.json({ ok: true, restored: ref, checkpoint: hash })
    }

    if (action === 'rename-sandbox') {
      const next = (body.label ?? '').trim()
      if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(next)) return NextResponse.json({ error: 'invalid new name' }, { status: 422 })
      const registry = await readRegistry()
      const entry = registry.find((e) => e.name === body.name)
      if (!entry) return NextResponse.json({ error: 'unknown sandbox' }, { status: 404 })
      if (!entry.path.includes('--sandbox-')) return NextResponse.json({ error: 'not a sandbox — original builds cannot be renamed here' }, { status: 403 })
      // rename = registry identity only; the folder keeps its slug (a running dev server holds cwd)
      await writeRegistry(registry.map((e) => (e.name === body.name ? { ...e, name: next } : e)))
      return NextResponse.json({ ok: true, renamed: next })
    }

    if (action === 'trash-sandbox') {
      const registry = await readRegistry()
      const entry = registry.find((e) => e.name === body.name)
      if (!entry) return NextResponse.json({ error: 'unknown sandbox' }, { status: 404 })
      if (!entry.path.includes('--sandbox-')) return NextResponse.json({ error: 'not a sandbox — the original build cannot be trashed' }, { status: 403 })
      if (alive(entry.pid)) { try { process.kill(-entry.pid) } catch { process.kill(entry.pid) } }
      // macOS Trash, not rm — recoverable, matching Figma's "Move to trash"
      await run('osascript', ['-e', `tell application "Finder" to delete POSIX file "${entry.path}"`]).catch(async () => {
        await rm(entry.path, { recursive: true, force: true }) // non-mac fallback
      })
      await writeRegistry(registry.filter((e) => e.name !== body.name))
      return NextResponse.json({ ok: true, trashed: entry.name })
    }

    if (action === 'pick-folder') {
      // native Finder folder picker (Dan: "selectable on local disc via finder")
      // cancel is a handled user action → 200 {cancelled} (a non-2xx would log a browser console error)
      try {
        const { stdout } = await run('osascript', ['-e', 'POSIX path of (choose folder with prompt "Select a build folder")'], { timeout: 120_000 })
        return NextResponse.json({ ok: true, path: stdout.trim() })
      } catch (e) {
        if (/-128/.test(String(e))) return NextResponse.json({ ok: false, cancelled: true })
        throw Object.assign(new Error('picker failed'), { status: 500 })
      }
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
