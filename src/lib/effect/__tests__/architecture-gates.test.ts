import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, test } from 'vitest'
import { CLASS_SPECS, LIBRARY_FAMILIES, specOf } from '../library/class-registry'

const ROOT = resolve(process.cwd(), 'src/lib/effect')
const LIBRARY = join(ROOT, 'library')
const TESTS = join(ROOT, '__tests__')
const PANEL = resolve(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/LibraryPanel.tsx')
const PAGE = resolve(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/page.tsx')
const LAW = join(LIBRARY, 'shape-layout-lib-architecture.md')
const ARCH_GATE = join(TESTS, 'architecture-gates.test.ts')
const LAW_SHA256 = '9a9c8d0b9f9d58d4b078b9bff10d5f86b3ef9e225c84da737cf55e89c0e214ee'

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name)
  return entry.isDirectory() ? files(path) : [path]
})

const source = (path: string) => readFileSync(path, 'utf8')
const parse = (path: string, code = source(path)) => ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true)

const retiredPatterns = [
  { label: 'LAYOUT_LIBRARY', pattern: /\bLAYOUT_LIBRARY\b/ },
  { label: 'prim:', pattern: /prim:/ },
  { label: 'applicability', pattern: /\bapplicability\b/ },
  { label: 'deleted triangle type id', pattern: /['"](?:peak|slice|ramp|pennant|sail|fin)['"]/ },
  { label: 'obsolete triangle counts', pattern: /Peak 14, Wedge 17, Sail 48/ },
  { label: 'obsolete type count', pattern: /\bten types\b/ },
  { label: 'obsolete classifier bridge claim', pattern: /\bclassifier bridge\b/ },
] as const

const retiredProbes = [
  'LAYOUT_LIBRARY', 'prim:single', 'applicability', "'peak'", "'slice'", "'ramp'",
  "'pennant'", "'sail'", "'fin'", 'Peak 14, Wedge 17, Sail 48', 'ten types',
  'classifier bridge',
]

describe('Shape-Layout Library Law — activation schedule', () => {
  it('STEP 1: retired runtime/test vocabulary is absent', () => {
    const governed = [
      ...files(LIBRARY),
      join(ROOT, 'grid-magnet-library-bridge.ts'),
      PANEL,
      PAGE,
      ...files(TESTS).filter((path) => /\.test\.tsx?$/.test(path)),
    ].filter((path) => path !== LAW && path !== ARCH_GATE)
    for (const path of governed) for (const { label, pattern } of retiredPatterns)
      expect(pattern.test(source(path)), `${path} contains retired ${label}`).toBe(false)
    for (const probe of retiredProbes)
      expect(retiredPatterns.some(({ pattern }) => pattern.test(probe)), `unguarded retired token ${probe}`).toBe(true)
  })

  const tautologies = (path: string, code: string): string[] => {
    const tree = parse(path, code)
    const offenders: string[] = []
    const equality = new Set(['toEqual', 'toStrictEqual'])
    const literal = (expr: ts.Expression): { known: true; value: unknown } | { known: false } => {
      if (expr.kind === ts.SyntaxKind.TrueKeyword) return { known: true, value: true }
      if (expr.kind === ts.SyntaxKind.FalseKeyword) return { known: true, value: false }
      if (expr.kind === ts.SyntaxKind.NullKeyword) return { known: true, value: null }
      if (ts.isIdentifier(expr) && expr.text === 'undefined') return { known: true, value: undefined }
      if (ts.isNumericLiteral(expr)) return { known: true, value: Number(expr.text) }
      if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return { known: true, value: expr.text }
      return { known: false }
    }
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && ts.isCallExpression(node.expression.expression)
          && node.expression.expression.expression.getText(tree) === 'expect') {
          const matcher = node.expression.name.text
          const actual = node.expression.expression.arguments[0]
          const expected = node.arguments[0]
          if (actual && expected && node.arguments.length === 1 && equality.has(matcher)
            && actual.getText(tree) === expected.getText(tree)) offenders.push(`${path}: ${actual.getText(tree)} ${matcher} itself`)
          if (actual && expected && matcher === 'toBe') {
            const a = literal(actual), b = literal(expected)
            if (a.known && b.known && Object.is(a.value, b.value)) offenders.push(`${path}: literal ${actual.getText(tree)} toBe itself`)
          }
          if (actual && node.arguments.length === 0) {
            const value = literal(actual)
            const proven = value.known && ((matcher === 'toBeTruthy' && Boolean(value.value)) || (matcher === 'toBeFalsy' && !Boolean(value.value)) || (matcher === 'toBeNull' && value.value === null) || (matcher === 'toBeUndefined' && value.value === undefined))
            if (proven) offenders.push(`${path}: literal ${actual.getText(tree)}.${matcher}()`)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(tree)
    return offenders
  }

  it('STEP 1: AST tautology gate rejects self-equality and literal truths', () => {
    expect(tautologies('self.ts', 'const value = []; expect(value).toEqual(value)')).toHaveLength(1)
    expect(tautologies('literal.ts', 'expect(true).toBe(true)')).toHaveLength(1)
    expect(tautologies('truthy.ts', 'expect(true).toBeTruthy()')).toHaveLength(1)
    const offenders = files(TESTS).filter((file) => /\.test\.tsx?$/.test(file)).flatMap((path) => tautologies(path, source(path)))
    expect(offenders).toEqual([])
  })

  it('STEP 1: the approved law is landed verbatim', () => {
    expect(createHash('sha256').update(source(LAW)).digest('hex')).toBe(LAW_SHA256)
  })

  it('STEP 2: registration invariants derive families from registered classes', () => {
    expect(LIBRARY_FAMILIES).toEqual(Object.keys(CLASS_SPECS))
    for (const [classId, spec] of Object.entries(CLASS_SPECS)) {
      expect(spec.classId).toBe(classId)
      expect(spec.types.length).toBeGreaterThan(0)
      for (const pitchMM of [24, 48, 96]) for (const type of spec.types)
        expect(spec.variants(type.id, pitchMM).length).toBeGreaterThan(0)
    }
  })
  it('STEP 2: zones 0-5 contain no React, Next, or JSX', () => {
    const zoneFiles = files(LIBRARY).filter((path) => !/\/(index|surface)\.ts$/.test(path))
    for (const path of zoneFiles) {
      const tree = parse(path)
      expect(ts.isJsxElement(tree as never), path).toBe(false)
      expect(source(path), path).not.toMatch(/from ['"](?:react|next(?:\/|['"]))/)
    }
  })
  it('STEP 2: no runtime pitch default exists in library services', () => {
    const offenders: string[] = []
    for (const path of files(LIBRARY).filter((file) => file.endsWith('.ts'))) {
      const tree = parse(path)
      const visit = (node: ts.Node) => {
        if (ts.isParameter(node) && ts.isIdentifier(node.name) && /pitchMM/i.test(node.name.text)
          && node.initializer) offenders.push(path)
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
    expect(offenders).toEqual([])
  })
  it('STEP 2: governed class packages do not import another concrete package', () => {
    for (const path of [
      join(LIBRARY, 'square-class.ts'), join(LIBRARY, 'rectangle-class.ts'),
      join(LIBRARY, 'diamond-class.ts'), join(LIBRARY, 'triangle-class.ts'),
    ]) {
      const own = path.slice(path.lastIndexOf('/') + 1)
      const concrete = /from ['"]\.\/(?:square|rectangle|diamond|triangle)-class['"]/
      expect(concrete.test(source(path).replace(own, '')), path).toBe(false)
    }
  })
  it('STEP 2: library identity fails loudly through the registry', () => {
    expect(() => specOf('nope')).toThrow('unknown classId')
    for (const classId of LIBRARY_FAMILIES) {
      const spec = specOf(classId)
      const selection = spec.open({ classId, frameKey: 'nope', layoutId: 'nope', view: { transpose: false, flipX: false, flipY: false } }, 48)
      expect(() => spec.variantOf({ ...selection, frameKey: 'nope' }, 48)).toThrow()
    }
  })
  test.todo('STEP 3: constant ownership and no padMM')
  test.todo('STEP 3: one outline producer and topology/size/clearance')
  test.todo('STEP 4: LAW 0 exact catalogue contract, identity, and matcher')
  test.todo('STEP 5: surface, barrel, shell, bridge, CSS, and caller equality')
})
