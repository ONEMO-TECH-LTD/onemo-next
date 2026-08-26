import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { CLASS_SPECS, LIBRARY_FAMILIES, specOf } from '../library/class-registry'
import { outlineFromLayout } from '../library/outline'
import { CATALOGUE_FORMAT_VERSION, catalogue, type CatalogueEntry } from '../library/catalogue'
import { catalogueCandidates, classifiedLibraryCatalogue } from '../grid-magnet-library-catalogue'

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

type Zone = 0 | 1 | 2 | 3 | 4 | 5
type ImportEdge = { from: string; to: string | null; specifier: string; typeOnly: boolean }
type ImportViolation = ImportEdge & { fromZone: Zone; toZone?: Zone; reason: string }

const ZONE_FILES: Record<Exclude<Zone, 1>, readonly string[]> = {
  0: ['types.ts', 'class-contract.ts'],
  2: ['geometry.ts', 'transforms.ts', 'outline.ts', 'rules.ts'],
  3: [
    'registry-class.ts', 'square-class.ts', 'rectangle-class.ts', 'diamond-class.ts',
    'triangle-class.ts', 'triangle-frames.ts', 'triangle-geometry.ts', 'triangle-types.ts',
  ],
  4: ['class-registry.ts'],
  5: ['selection.ts', 'options.ts', 'authoring.ts', 'materialize.ts', 'catalogue.ts', 'drafts.ts', 'integrity.ts'],
}

const step2Files = () => files(LIBRARY).filter((path) => /\.tsx?$/.test(path)
  && !['index.ts', 'public-types.ts', 'public-values.ts', 'surface.ts'].includes(basename(path)))

const zonesOf = (path: string): Zone[] => {
  const name = basename(path)
  const matches: Zone[] = []
  if (/^corpus-.*\.ts$/.test(name)) matches.push(1)
  for (const [zone, names] of Object.entries(ZONE_FILES))
    if (names.includes(name)) matches.push(Number(zone) as Zone)
  return matches
}

const resolveModule = (from: string, specifier: string): string | null => {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null
  const base = specifier.startsWith('@/')
    ? resolve(process.cwd(), 'src', specifier.slice(2))
    : resolve(dirname(from), specifier)
  const candidates = extname(base)
    ? [base]
    : [base, base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')]
  return candidates.find(existsSync) ?? base
}

const importEdges = (path: string, code = source(path)): ImportEdge[] => {
  const tree = parse(path, code)
  const out: ImportEdge[] = []
  const add = (specifier: ts.Expression, typeOnly: boolean) => {
    if (!ts.isStringLiteralLike(specifier)) return
    out.push({ from: path, to: resolveModule(path, specifier.text), specifier: specifier.text, typeOnly })
  }
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause
      const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
        ? clause.namedBindings.elements : []
      const typeOnly = Boolean(clause?.isTypeOnly)
        || Boolean(clause && !clause.name && named.length > 0 && named.every((part) => part.isTypeOnly))
      add(node.moduleSpecifier, typeOnly)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      add(node.moduleSpecifier, node.isTypeOnly)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments[0]) {
      add(node.arguments[0], false)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return out
}

const concretePackage = (path: string): string | null => {
  const hit = /^(square|rectangle|diamond|triangle)-(?:class|frames|geometry|types)\.ts$/.exec(basename(path))
  return hit?.[1] ?? null
}

const ALLOWED_ZONES: Record<Zone, readonly Zone[]> = {
  0: [0], 1: [0], 2: [0, 2], 3: [0, 1, 2, 3], 4: [0, 3], 5: [0, 2, 4, 5],
}

const importViolations = (overrides: Record<string, string> = {}): ImportViolation[] => {
  const out: ImportViolation[] = []
  for (const path of step2Files()) {
    const fromZone = zonesOf(path)[0]
    if (fromZone === undefined) continue
    const key = 'library/' + basename(path)
    for (const edge of importEdges(path, overrides[key] ?? source(path))) {
      if (!edge.to) {
        out.push({ ...edge, fromZone, reason: 'unknown external module' })
        continue
      }
      const toZones = edge.to.startsWith(LIBRARY + '/') ? zonesOf(edge.to) : []
      if (toZones.length === 0) {
        const approved = fromZone === 2
          && ['grid-magnet-spec.ts', 'offset.ts'].includes(basename(edge.to))
        if (!approved) out.push({ ...edge, fromZone, reason: 'external edge is not allowlisted' })
        continue
      }
      const toZone = toZones[0]
      if ((fromZone === 0 || fromZone === 1) && !edge.typeOnly) {
        out.push({ ...edge, fromZone, toZone, reason: 'contracts/corpus edge is not type-only' })
        continue
      }
      if (!ALLOWED_ZONES[fromZone].includes(toZone)) {
        out.push({ ...edge, fromZone, toZone, reason: 'zone direction is forbidden' })
        continue
      }
      if (fromZone === 3 && toZone === 3) {
        const fromPackage = concretePackage(path), toPackage = concretePackage(edge.to)
        const sharedConstructor = basename(edge.to) === 'registry-class.ts'
        if ((!fromPackage && toPackage) || (fromPackage && toPackage && fromPackage !== toPackage)
          || (fromPackage && !toPackage && !sharedConstructor))
          out.push({ ...edge, fromZone, toZone, reason: 'concrete class package edge is forbidden' })
      }
    }
  }
  return out
}

const jsxOffenders = (tree: ts.SourceFile): ts.Node[] => {
  const out: ts.Node[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) out.push(node)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return out
}

const parseFailureCodes = (tree: ts.SourceFile): number[] =>
  [...(tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics]
    .map((diagnostic) => diagnostic.code)

const corpusDeclarationViolations = (path: string, code = source(path)): string[] => {
  const tree = parse(path, code)
  const out: string[] = []
  for (const statement of tree.statements) {
    if (!ts.isVariableStatement(statement)
      || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
      const value = declaration.initializer
      const literalReadonly = ts.isSatisfiesExpression(value)
        && ts.isTypeOperatorNode(value.type) && value.type.operator === ts.SyntaxKind.ReadonlyKeyword
        && ts.isAsExpression(value.expression) && value.expression.type.getText(tree) === 'const'
        && ts.isArrayLiteralExpression(value.expression.expression)
      if (!literalReadonly) out.push(declaration.name.text)
    }
  }
  return out
}

const emptyLayoutSentinels = (path: string, code = source(path)): number[] => {
  const tree = parse(path, code)
  const out: number[] = []
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'layouts'
      && ts.isArrayLiteralExpression(node.initializer) && node.initializer.elements.length === 0)
      out.push(tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return out
}

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
      expect(specOf(classId), classId).toBe(spec)
      expect(spec.classId).toBe(classId)
      expect(spec.types.length).toBeGreaterThan(0)
      for (const pitchMM of [24, 48, 96]) for (const type of spec.types)
        expect(spec.variants(type.id, pitchMM).length).toBeGreaterThan(0)
    }
  })
  it('STEP 2: every governed source belongs to exactly one active zone', () => {
    for (const path of step2Files()) expect(zonesOf(path), path).toHaveLength(1)
  })
  it('STEP 2: the AST import matrix enforces zones 0-5', () => {
    expect(importViolations()).toEqual([])
  })
  it('STEP 2: zones 0-5 contain no React, Next, or JSX', () => {
    for (const path of step2Files()) {
      const tree = parse(path)
      expect(parseFailureCodes(tree), path).toEqual([])
      expect(jsxOffenders(tree), path).toEqual([])
    }
  })
  it('STEP 2 gate self-proof rejects forbidden service-to-class, JSX, mutable corpus and sentinels', () => {
    expect(importViolations({
      'library/selection.ts': `import { squareClass } from './square-class'; void squareClass`,
    })).toContainEqual(expect.objectContaining({ fromZone: 5, toZone: 3 }))
    expect(jsxOffenders(parse('probe.tsx', `export const Probe = () => <div />`))).toHaveLength(1)
    expect(parseFailureCodes(parse('probe.ts', `export const Probe = <div />`))).not.toEqual([])
    expect(corpusDeclarationViolations('corpus-probe.ts',
      `export const FRAMES: readonly unknown[] = []`)).toEqual(['FRAMES'])
    expect(emptyLayoutSentinels('sentinel.ts',
      `const frame = { cols: 1, rows: 1, layouts: [] }`)).toEqual([1])
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
  it('STEP 2: corpus exports are literal readonly values and no empty frame sentinel remains', () => {
    for (const path of step2Files().filter((file) => /^corpus-/.test(basename(file))))
      expect(corpusDeclarationViolations(path), path).toEqual([])
    for (const path of step2Files()) expect(emptyLayoutSentinels(path), path).toEqual([])
  })
  it('STEP 2: physical constants are owned by grid-magnet-spec', () => {
    const offenders: string[] = []
    const physical = /(PAD|PADDING|PITCH|DIAMETER|DIA).*MM/
    for (const path of step2Files()) {
      const tree = parse(path)
      const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && physical.test(node.name.text))
          offenders.push(path + ':' + node.name.text)
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
    expect(offenders).toEqual([])
  })
  it('STEP 2: library identity fails loudly through the registry', () => {
    expect(() => specOf('nope')).toThrow('unknown classId')
    for (const classId of LIBRARY_FAMILIES) {
      const spec = specOf(classId)
      const selection = spec.open({ classId, frameKey: 'nope', layoutId: 'nope', view: { transpose: false, flipX: false, flipY: false } }, 48)
      expect(() => spec.variantOf({ ...selection, frameKey: 'nope' }, 48)).toThrow()
    }
  })
  it('STEP 3: outline topology keeps point, line, convex, and concave recipes distinct', () => {
    const round = outlineFromLayout([[0, 0]], { corners: 'round' })
    const square = outlineFromLayout([[0, 0]], { corners: 'sharp', pointRotationDeg: 0 })
    const diamond = outlineFromLayout([[0, 0]], { corners: 'sharp', pointRotationDeg: 45 })
    const pill = outlineFromLayout([[0, 0], [48, 0]], { corners: 'round' })
    const convex = outlineFromLayout([[0, 0], [48, 0], [0, 48]], { corners: 'sharp' })
    const h = [[0, 0], [96, 0], [96, 96], [64, 96], [64, 32], [32, 32], [32, 96], [0, 96]] as const
    const concave = outlineFromLayout(h, { corners: 'sharp' }, h)
    expect(round.length).toBeGreaterThan(3)
    expect(square).not.toEqual(diamond)
    expect(pill.length).toBeGreaterThan(2)
    expect(convex).toHaveLength(3)
    expect(concave.length).toBeGreaterThan(4)
  })
  it('STEP 3: one outline and hull implementation own production', () => {
    const declarations: Record<string, string[]> = { outlineFromLayout: [], convexHull: [] }
    const offsetCallers: string[] = []
    for (const path of step2Files()) {
      const tree = parse(path)
      const visit = (node: ts.Node) => {
        if (ts.isFunctionDeclaration(node) && node.name && node.name.text in declarations)
          declarations[node.name.text].push(basename(path))
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
          && node.expression.text === 'offsetPathMM') offsetCallers.push(basename(path))
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
    expect(declarations.outlineFromLayout).toEqual(['outline.ts'])
    expect(declarations.convexHull).toEqual(['geometry.ts'])
    expect(offsetCallers).toEqual(['outline.ts'])
  })
  it('STEP 3: library and bridge contain no runtime padding parameter', () => {
    const governed = [...files(LIBRARY), join(ROOT, 'grid-magnet-library-bridge.ts')]
      .filter((path) => path !== LAW)
    for (const path of governed)
      expect(source(path), path).not.toMatch(/\bpadMM\b/)
  })
  it('STEP 4: catalogue V1 has exact readonly data-only records and frozen identity', () => {
    type Exact = Readonly<{
      classId: string; typeId: string; id: string; label: string; pitchMM: number; corners: 'sharp' | 'bevel' | 'round'
      nodesMM: readonly (readonly [number, number])[]; outlineMM: readonly (readonly [number, number])[]
      widthMM: number; heightMM: number; frameCols: number; frameRows: number
    }>
    type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
    const exact: Equal<CatalogueEntry, Exact> = true
    expect(exact).toBe(true)
    expect(CATALOGUE_FORMAT_VERSION).toBe(1)
    const entries = catalogue(48)
    const keys = ['classId', 'typeId', 'id', 'label', 'pitchMM', 'corners', 'nodesMM', 'outlineMM', 'widthMM', 'heightMM', 'frameCols', 'frameRows'].sort()
    for (const pitchMM of [24, 48, 96]) for (const entry of catalogue(pitchMM)) {
      expect(Object.keys(entry).sort()).toEqual(keys)
      expect(JSON.parse(JSON.stringify(entry))).toEqual(entry)
      expect(Number.isFinite(entry.widthMM) && Number.isFinite(entry.heightMM)).toBe(true)
    }
    const ids = entries.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...catalogue(24).map((entry) => entry.id)].sort()).toEqual([...ids].sort())
    expect([...catalogue(96).map((entry) => entry.id)].sort()).toEqual([...ids].sort())
    const manifest = JSON.parse(source(join(TESTS, 'fixtures/catalogue-identity.v1.json')))
    expect(manifest).toEqual(entries.map((entry) => ({ id: entry.id, classId: entry.classId, typeId: entry.typeId, corners: entry.corners, frameCols: entry.frameCols, frameRows: entry.frameRows, nodesMM: [...entry.nodesMM].sort((a, b) => a[0] - b[0] || a[1] - b[1]) })))
  })
  it('STEP 4: classifier matcher round-trips every catalogue entry', () => {
    for (const item of classifiedLibraryCatalogue(48)) {
      expect(Number.isFinite(item.shapeClass.cx) && Number.isFinite(item.shapeClass.cy)).toBe(true)
      expect(catalogueCandidates(item.entry.outlineMM.map(([x, y]) => [x, y]), 48).some((entry) => entry.id === item.entry.id)).toBe(true)
    }
  })
  it('STEP 5: surface, bridge, barrel, and shell use the contract boundary', () => {
    const barrel = source(join(LIBRARY, 'index.ts'))
    for (const symbol of ['CatalogueEntry', 'LibrarySurface', 'catalogue', 'librarySurface', 'LIBRARY_FAMILIES'])
      expect(barrel).toContain(symbol)
    const bridge = source(join(ROOT, 'grid-magnet-library-bridge.ts'))
    for (const symbol of ['materializeSelection', 'materializeDraft', 'resolveSelection', 'panelOptions', 'specOf'])
      expect(bridge).not.toContain(symbol)
    const panel = source(PANEL)
    expect(panel).not.toContain('panelOptions(')
    expect(panel).toContain('options: PanelOptions')
    const page = source(PAGE)
    expect(page).toContain('librarySurface(')
    expect(page).toContain('libraryStageModel(')
  })
})
