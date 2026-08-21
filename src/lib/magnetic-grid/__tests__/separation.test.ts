import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(process.cwd(), 'src/lib')

const OWNERS = {
  'magnetic-grid/spec.ts': [] as RegExp[],
  'magnetic-grid/compute.ts': [/^\.\/compute\/(seat|centre-evidence)$/],
  'magnetic-grid/compute/seat.ts': [/^\.\.\/spec$/],
  'magnetic-grid/compute/centre-evidence.ts': [/^\.\.\/spec$/, /^\.\/seat$/],
  'magnetic-grid/logic.ts': [/^\.\/spec$/],
  'magnetic-grid/engine.ts': [/^\.\/spec$/, /^\.\/compute$/, /^\.\/logic$/],
  'effect/magnetic-grid-bridge.ts': [
    /^\.\/geometry-truth$/, /^\.\/contour$/, /^\.\/offset$/, /^\.\/types$/,
    /^\.\.\/magnetic-grid\/engine$/, /^@\/lib\/vector-core$/,
  ],
} as const

const importsOf = (text: string): string[] =>
  [...text.matchAll(/(?:from\s+|export\s+\*\s+from\s+)['"]([^'"]+)['"]/g)].map((match) => match[1])

const forbiddenImports = (file: keyof typeof OWNERS, text: string): string[] => {
  const allowed: readonly RegExp[] = OWNERS[file]
  return importsOf(text).filter((source) => !allowed.some((rule) => rule.test(source)))
}

describe('magnetic-grid T2 owner DAG', () => {
  it('every final owner imports only its contracted dependencies', () => {
    for (const file of Object.keys(OWNERS) as Array<keyof typeof OWNERS>) {
      const bad = forbiddenImports(file, readFileSync(join(ROOT, file), 'utf8'))
      expect(bad, `${file} imports outside its T2 owner list`).toEqual([])
    }
  })

  it('rejects the dependency leaks T2 exists to prevent', () => {
    expect(forbiddenImports('magnetic-grid/compute/centre-evidence.ts', "import x from '../../effect/attachment'"))
      .toEqual(['../../effect/attachment'])
    expect(forbiddenImports('effect/magnetic-grid-bridge.ts', "import x from '../magnetic-grid/compute'"))
      .toEqual(['../magnetic-grid/compute'])
    expect(forbiddenImports('magnetic-grid/logic.ts', "import x from './compute'"))
      .toEqual(['./compute'])
    expect(forbiddenImports('magnetic-grid/compute/seat.ts', "import x from '../../effect/types'"))
      .toEqual(['../../effect/types'])
  })
})
