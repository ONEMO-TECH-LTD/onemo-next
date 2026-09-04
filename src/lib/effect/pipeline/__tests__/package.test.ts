// T4 — the lift gate. It walks the real import closure from the engine door and pins the boundary
// that makes the engine liftable: nothing from the application, nothing from a browser, one external
// package, one door. The package build is the other half (it fails on a DOM type, which no text scan
// can see); this is the runtime-import inventory.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')
const ENTRY = join(SRC, 'lib/effect/pipeline/index.ts')

const resolveSpec = (spec: string, from: string): string | null => {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2))
    : spec.startsWith('.') ? resolve(dirname(from), spec) : null
  if (!base) return null
  for (const candidate of [base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')])
    if (existsSync(candidate)) return candidate
  return null
}

const closure = (() => {
  const files = new Set<string>()
  const external = new Set<string>()
  const walk = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const target = resolveSpec(spec, file)
      if (target) walk(target)
      else external.add(spec)
    }
  }
  walk(ENTRY)
  return { files: [...files].map((f) => f.replace(ROOT + '/', '')).sort(), external: [...external].sort() }
})()

describe('the engine is liftable', () => {
  it('reaches nothing in the application', () => {
    const app = closure.files.filter((f) => f.startsWith('src/app/'))
    expect(app, 'the engine imports the shell: ' + app.join(' · ')).toEqual([])
  })

  it('touches no browser global', () => {
    const guilty: string[] = []
    for (const file of closure.files) {
      const text = readFileSync(join(ROOT, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      if (/\b(document|window|navigator|localStorage|sessionStorage)\b\s*[.[]/.test(text)) guilty.push(file)
    }
    expect(guilty, 'browser globals in the closure: ' + guilty.join(' · ')).toEqual([])
  })

  it('depends on exactly one package outside the repository', () => {
    expect(closure.external).toEqual(['@countertype/clipper2-ts'])
  })

  it('carries exactly the pinned files from outside lib/effect — the lift boundary', () => {
    expect(closure.files.filter((f) => !f.startsWith('src/lib/effect/'))).toEqual([
      'src/lib/grid-engine/compute/geometry.ts',
      'src/lib/outline-core/hash.ts',
      'src/lib/outline-core/math.ts',
      'src/lib/outline-core/resolver.ts',
      'src/lib/outline-core/types.ts',
      'src/lib/vector-core/fit.ts',
      'src/lib/vector-core/index.ts',
      'src/lib/vector-core/ops.ts',
      'src/lib/vector-core/path.ts',
      'src/lib/vector-core/types.ts',
    ])
  })

  it('the door exports exactly the call and its two shapes', () => {
    const names = [...readFileSync(ENTRY, 'utf8').matchAll(/export(?:\s+type)?\s+\{([^}]+)\}/g)]
      .flatMap((m) => m[1].split(',').map((n) => n.trim())).sort()
    expect(names).toEqual(['GridRequest', 'GridSolve', 'solveGrid'])
  })

  it('the built package carries no repository alias', () => {
    const dist = join(SRC, 'lib/effect/engine-package/dist')
    if (!existsSync(dist)) return                          // build not run here; the package's own build asserts it
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => {
      const p = join(d, n)
      return statSync(p).isDirectory() ? walk(p) : [p]
    })
    const left = walk(dist).filter((f) => /\.(js|d\.ts)$/.test(f))
      .reduce((n, f) => n + (readFileSync(f, 'utf8').match(/from\s+['"]@\//g)?.length ?? 0), 0)
    expect(left, 'unresolved @/ specifiers in dist').toBe(0)
  })
})
