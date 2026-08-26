import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, test } from 'vitest'

const ROOT = resolve(process.cwd(), 'src/lib/effect')
const LIBRARY = join(ROOT, 'library')
const TESTS = join(ROOT, '__tests__')

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name)
  return entry.isDirectory() ? files(path) : [path]
})

const source = (path: string) => readFileSync(path, 'utf8')
const parse = (path: string) => ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true)

const retiredTokens = [
  'LAYOUT_LIBRARY',
  'prim:',
  'Peak 14, Wedge 17, Sail 48',
  'ten types',
  'classifier bridge',
]

describe('Shape-Layout Library Law — activation schedule', () => {
  it('STEP 1: retired runtime/test vocabulary is absent', () => {
    const governed = [...files(LIBRARY), join(ROOT, 'grid-magnet-library-bridge.ts'), join(TESTS, 'grid-layout-library.test.ts')]
      .filter((path) => !path.endsWith('shape-layout-lib-architecture.md'))
    for (const path of governed) for (const token of retiredTokens)
      expect(source(path), `${path} contains retired ${token}`).not.toContain(token)
  })

  it('STEP 1: AST tautology gate rejects self-equality expectations', () => {
    const offenders: string[] = []
    for (const path of files(TESTS).filter((file) => file.endsWith('.test.ts'))) {
      const tree = parse(path)
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && node.expression.name.text === 'toEqual' && node.arguments.length === 1
          && ts.isCallExpression(node.expression.expression)
          && node.expression.expression.expression.getText(tree) === 'expect') {
          const actual = node.expression.expression.arguments[0]?.getText(tree)
          const expected = node.arguments[0].getText(tree)
          if (actual === expected) offenders.push(`${path}: ${actual}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
    expect(offenders).toEqual([])
  })

  it('STEP 1: the law is landed verbatim', () => {
    expect(source(join(LIBRARY, 'shape-layout-lib-architecture.md'))).toContain('LAW 0 — THE OUTPUT CONTRACT OUTRANKS EVERYTHING')
  })

  test.todo('STEP 2: AST import matrix and zones 0-5')
  test.todo('STEP 2: registration invariant and class-policy isolation')
  test.todo('STEP 2: readonly corpus, no sentinels, fail-loud variant identity')
  test.todo('STEP 2: no React/Next/JSX in zones 0-5')
  test.todo('STEP 2: no runtime pitch default')
  test.todo('STEP 3: constant ownership and no padMM')
  test.todo('STEP 3: one outline producer and topology/size/clearance')
  test.todo('STEP 4: LAW 0 exact catalogue contract, identity, and matcher')
  test.todo('STEP 5: surface, barrel, shell, bridge, CSS, and caller equality')
})
