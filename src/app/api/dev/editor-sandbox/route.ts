/**
 * react-figma engine · E6.9 — sandbox branching + time-capsule versioning (KAI-9359).
 * Dan's model: a "branch" is a plain COPY of the build folder run as a sandbox on its own
 * port (APFS copy-on-write clone — instant, node_modules shared until divergence). Everything
 * stays sandboxed until explicitly saved back. Versioning = Figma/Framer-style time capsule:
 * every Publish snapshots the editable surface; any version restores or forks.
 *
 * Safety model (deliberate):
 * - Snapshots/restore are SCOPED to the editor-writable surface only (pages sandbox,
 *   extracted components, canvas) — never the whole repo, so branch/dev work can't be clobbered.
 * - History lives in a separate hidden git dir (.editor-history) — the real repo's git is
 *   never touched by versioning.
 * - Fork clones the build folder, DROPS the inherited .git link (a worktree .git file would
 *   dangle), and re-inits a private history baseline in the clone.
 * - Dev-only, POST actions validated, names jailed to [a-z0-9-].
 */
import { NextResponse } from 'next/server'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, readFile, rm, rmdir, writeFile, stat } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join, dirname, basename } from 'node:path'

const run = promisify(execFile)
const ROOT = process.cwd()
/* The editable surface — the "file" the editor owns. Everything else is app machinery. */
const HISTORY_PATHS = [
  'src/app/(dev)/react-figma-pages',
  'src/app/(dev)/react-figma-components',
  'src/app/(dev)/react-figma/canvas',
]
const HISTORY_DIR = '.editor-history'
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
async function snapshot(root: string, label: string): Promise<{ hash: string }> {
  await ensureHistory(root)
  // add each surface dir separately — one missing dir must not mask the others
  for (const p of HISTORY_PATHS) await hgit(root, ['add', '--force', '--', p]).catch(() => null)
  const msg = label || `checkpoint ${new Date().toISOString()}`
  await hgit(root, ['commit', '-m', msg, '--allow-empty'])
  const { stdout } = await hgit(root, ['rev-parse', 'HEAD'])
  return { hash: stdout.trim() }
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const body = await req.json() as { action: string; name?: string; label?: string; ref?: string }
    const { action } = body

    if (action === 'fork') {
      const name = (body.name ?? '').trim()
      if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(name)) {
        return NextResponse.json({ error: 'invalid sandbox name (a-z, 0-9, dashes)' }, { status: 422 })
      }
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
      await snapshot(dest, `fork baseline from ${basename(ROOT)}`)
      const port = await freePort(3030)
      const child = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
        cwd: dest, detached: true, stdio: 'ignore', env: { ...process.env, PORT: String(port) },
      })
      child.unref()
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

    if (action === 'snapshot') {
      const { hash } = await snapshot(ROOT, (body.label ?? '').slice(0, 200))
      return NextResponse.json({ ok: true, hash })
    }

    if (action === 'versions') {
      await ensureHistory(ROOT)
      const { stdout } = await hgit(ROOT, ['log', '--pretty=%H|%cI|%s', '-100']).catch(() => ({ stdout: '' }))
      const versions = stdout.trim().split('\n').filter(Boolean).map((l) => {
        const [hash, date, ...m] = l.split('|')
        return { hash, date, label: m.join('|') }
      })
      return NextResponse.json({ versions })
    }

    if (action === 'restore') {
      const ref = (body.ref ?? '').trim()
      if (!/^[0-9a-f]{7,40}$/.test(ref)) return NextResponse.json({ error: 'invalid version ref' }, { status: 422 })
      await snapshot(ROOT, `pre-restore safety checkpoint`) // restoring is itself revertable
      // true time-travel: files created AFTER the target version must go away too —
      // checkout alone only rewrites files that existed in ref.
      const { stdout: nowList } = await hgit(ROOT, ['ls-files', '--', ...HISTORY_PATHS])
      const { stdout: refList } = await hgit(ROOT, ['ls-tree', '-r', '--name-only', ref, '--', ...HISTORY_PATHS])
      const refSet = new Set(refList.trim().split('\n').filter(Boolean))
      const emptied = new Set<string>()
      for (const f of nowList.trim().split('\n').filter(Boolean)) {
        if (!refSet.has(f)) { await rm(join(ROOT, f), { force: true }); emptied.add(dirname(f)) }
      }
      // prune now-empty dirs (git tracks files only) up to the surface roots
      for (let d of emptied) {
        while (HISTORY_PATHS.some((p) => d.startsWith(p + '/'))) {
          try { await rmdir(join(ROOT, d)) } catch { break } // non-empty or gone → stop climbing
          d = dirname(d)
        }
      }
      // per-path: a surface dir absent in the target version (e.g. no components yet) is fine
      for (const p of HISTORY_PATHS) await hgit(ROOT, ['checkout', ref, '--', p]).catch(() => null)
      const { hash } = await snapshot(ROOT, `restored to ${ref.slice(0, 8)}`)
      return NextResponse.json({ ok: true, restored: ref, checkpoint: hash })
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
