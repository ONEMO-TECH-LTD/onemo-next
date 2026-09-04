// Build the engine package from the repository sources.
//
// `tsc` alone is not enough for a consumable artifact, and the spike showed exactly why (T4):
//   1. it emits our `@/…` path aliases verbatim — nothing outside this repository can resolve them;
//   2. it emits extensionless relative specifiers, which Node's ESM loader refuses.
// So the build compiles, then rewrites both in the emitted JS and declarations. Nothing else: no
// bundler, no minifier, no transform of the code itself.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST = join(PKG, 'dist')
const REPO = join(PKG, '..', '..', '..', '..')

execFileSync(join(REPO, 'node_modules', '.bin', 'tsc'), ['-p', join(PKG, 'tsconfig.json')],
  { stdio: 'inherit', cwd: PKG })

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : [path]
})
const emitted = walk(DIST).filter((f) => f.endsWith('.js') || f.endsWith('.d.ts'))

for (const file of emitted) {
  const isJs = file.endsWith('.js')
  const source = readFileSync(file, 'utf8')
  const rewritten = source.replace(/(from\s+['"])([^'"]+)(['"])/g, (whole, head, spec, tail) => {
    let target = spec
    if (target.startsWith('@/')) {
      let rel = relative(dirname(file), join(DIST, target.slice(2)))
      target = rel.startsWith('.') ? rel : './' + rel
    } else if (!target.startsWith('.')) {
      return whole                                   // a real package (clipper2) — leave it alone
    }
    if (isJs && !/\.(js|mjs|cjs|json)$/.test(target)) {
      const resolved = join(dirname(file), target)
      target += existsSync(resolved + '.js') ? '.js'
        : existsSync(join(resolved, 'index.js')) ? '/index.js' : '.js'
    }
    return head + target + tail
  })
  if (rewritten !== source) writeFileSync(file, rewritten)
}

const aliasesLeft = emitted.reduce((n, f) => n + (readFileSync(f, 'utf8').match(/from\s+['"]@\//g)?.length ?? 0), 0)
if (aliasesLeft) throw new Error(`${aliasesLeft} unresolved @/ specifier(s) survived the build`)
console.log(`engine package built · ${emitted.length} emitted files · 0 unresolved aliases`)
