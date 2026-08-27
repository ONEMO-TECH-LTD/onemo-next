import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { CLASS_SPECS, LIBRARY_FAMILIES, specOf } from '../library/class-registry'
import { outlineFromLayout } from '../library/outline'
import { CATALOGUE_FORMAT_VERSION, catalogue, type CatalogueEntry } from '../library/catalogue'
import { catalogueCandidates, classifiedLibraryCatalogue } from '../grid-magnet-library-catalogue'
import { selectVariant } from '../library/selection'
import { materializeSelection } from '../library/materialize'

const ROOT = resolve(process.cwd(), 'src/lib/effect')
const LIBRARY = join(ROOT, 'library')
const TESTS = join(ROOT, '__tests__')
const PANEL = resolve(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/LibraryPanel.tsx')
const PAGE = resolve(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/page.tsx')
const BRIDGE = join(ROOT, 'grid-magnet-library-bridge.ts')
const CATALOGUE_ADAPTER = join(ROOT, 'grid-magnet-library-catalogue.ts')
const LAW = join(LIBRARY, 'shape-layout-lib-architecture.md')
const ARCH_GATE = join(TESTS, 'architecture-gates.test.ts')
const LAW_SHA256 = '8ba6480c7c85bc96f01cc12682c43d6803fcb4714ba9ed824aed016605a539c9'

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

type Zone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
type ImportEdge = { from: string; to: string | null; specifier: string; typeOnly: boolean }
type ImportViolation = ImportEdge & { fromZone: Zone; toZone?: Zone; reason: string }

const ZONE_FILES: Record<Exclude<Zone, 1 | 3>, readonly string[]> = {
  0: ['types.ts', 'class-contract.ts'],
  2: ['geometry.ts', 'transforms.ts', 'outline.ts', 'rules.ts', 'selection-transition.ts'],
  4: ['class-registry.ts'],
  5: ['selection.ts', 'options.ts', 'authoring.ts', 'materialize.ts', 'catalogue.ts', 'drafts.ts', 'integrity.ts'],
  6: ['surface.ts'],
  7: ['index.ts'],
}

const libraryFiles = () => files(LIBRARY).filter((path) => path.endsWith('.ts'))
const domainRuntimeFiles = () => [...libraryFiles(), BRIDGE, CATALOGUE_ADAPTER]
const governedRuntimeFiles = () => [...domainRuntimeFiles(), PANEL, PAGE]
const zonedFiles = () => libraryFiles()
const coreFiles = () => zonedFiles().filter((path) => zonesOf(path)[0] <= 5)
const nonUiFiles = () => zonedFiles().filter((path) => zonesOf(path)[0] <= 6)

const concretePackage = (path: string): string | null => {
  const hit = /^([a-z0-9-]+)-(?:class|frames|geometry|types)\.ts$/.exec(basename(path))
  return hit?.[1] === 'registry' ? null : hit?.[1] ?? null
}

const unregisteredClassPackages = (paths: readonly string[] = libraryFiles()): string[] =>
  paths.flatMap((path) => {
    const classId = concretePackage(path)
    return classId && !Object.prototype.hasOwnProperty.call(CLASS_SPECS, classId)
      ? [basename(path)] : []
  })

const zonesOf = (path: string): Zone[] => {
  const name = basename(path)
  const matches: Zone[] = []
  if (/^corpus-.*\.ts$/.test(name)) matches.push(1)
  if (name === 'registry-class.ts' || concretePackage(path)) matches.push(3)
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

const ALLOWED_ZONES: Record<Zone, readonly Zone[]> = {
  0: [0], 1: [0], 2: [0, 2], 3: [0, 1, 2, 3], 4: [0, 3], 5: [0, 2, 4, 5],
  6: [0, 5, 6], 7: [0, 4, 5, 6, 7],
}

const importViolations = (overrides: Record<string, string> = {}): ImportViolation[] => {
  const out: ImportViolation[] = []
  const paths = [...new Set([
    ...zonedFiles(),
    ...Object.keys(overrides).filter((key) => key.startsWith('library/'))
      .map((key) => join(LIBRARY, key.slice('library/'.length))),
  ])]
  for (const path of paths) {
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

const assertDataOnly = (value: unknown, path = 'entry'): void => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(path + ': non-finite number')
    return
  }
  if (typeof value !== 'object') throw new Error(path + ': non-data ' + typeof value)
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== Array.prototype) throw new Error(path + ': non-plain object')
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') throw new Error(path + ': symbol key')
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!
    if (descriptor.get || descriptor.set) throw new Error(path + '.' + key + ': accessor')
    if ('value' in descriptor) assertDataOnly(descriptor.value, path + '.' + key)
  }
}

const contractRuntimeDeclarations = (path: string, code = source(path)): string[] => {
  const out: string[] = []
  for (const statement of parse(path, code).statements) {
    if (ts.isFunctionDeclaration(statement) || ts.isVariableStatement(statement)
      || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement))
      out.push(statement.getText())
    if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly)
      out.push(statement.getText())
  }
  return out
}

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

const callsNamed = (path: string, name: string, code = source(path)): number => {
  let count = 0
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) count++
    ts.forEachChild(node, visit)
  }
  visit(parse(path, code))
  return count
}

const barrelExports = (code = source(join(LIBRARY, 'index.ts'))) => {
  const types: string[] = [], values: string[] = [], wildcards: string[] = [], aliases: string[] = []
  for (const statement of parse(join(LIBRARY, 'index.ts'), code).statements) {
    if (!ts.isExportDeclaration(statement)) continue
    if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
      wildcards.push(statement.getText())
      continue
    }
    for (const element of statement.exportClause.elements) {
      const names = statement.isTypeOnly || element.isTypeOnly ? types : values
      if (element.propertyName && element.propertyName.text !== element.name.text)
        aliases.push(`${element.propertyName.text} as ${element.name.text}`)
      names.push(element.name.text)
    }
  }
  return { types: types.sort(), values: values.sort(), wildcards, aliases }
}

const bridgeViolations = (code = source(BRIDGE)): string[] => {
  const violations: string[] = []
  for (const statement of parse(BRIDGE, code).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue
    const specifier = statement.moduleSpecifier.text
    const clause = statement.importClause
    const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
      ? clause.namedBindings.elements : []
    const names = named.map((part) => (part.propertyName ?? part.name).text).sort()
    const typeOnly = Boolean(clause?.isTypeOnly)
      || Boolean(clause && !clause.name && named.length > 0 && named.every((part) => part.isTypeOnly))
    const exact = (expected: readonly string[]) => names.length === expected.length
      && names.every((name, index) => name === expected[index]) && !clause?.name
    if (specifier === './library') {
      if (!typeOnly || !exact(['MaterializedLibrary'])) violations.push(specifier)
    } else if (specifier === './types' || specifier === './grid-magnet') {
      if (!typeOnly) violations.push(specifier)
    } else if (specifier === './grid-magnet-spec') {
      if (typeOnly || !exact(['MAGNET_DIA_SMALL_MM', 'RELEASED_PADDING_MM'])) violations.push(specifier)
    } else violations.push(specifier)
  }
  return violations
}

const catalogueAdapterViolations = (code = source(CATALOGUE_ADAPTER)): string[] => {
  const violations: string[] = []
  for (const statement of parse(CATALOGUE_ADAPTER, code).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue
    const specifier = statement.moduleSpecifier.text
    const clause = statement.importClause
    const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
      ? clause.namedBindings.elements : []
    const parts = new Map(named.map((part) => [
      (part.propertyName ?? part.name).text,
      Boolean(clause?.isTypeOnly || part.isTypeOnly),
    ]))
    const exact = (expected: Readonly<Record<string, boolean>>) => !clause?.name
      && parts.size === Object.keys(expected).length
      && Object.entries(expected).every(([name, typeOnly]) => parts.get(name) === typeOnly)
    if (specifier === './library') {
      if (!exact({ catalogue: false, CatalogueEntry: true })) violations.push(specifier)
    } else if (specifier === './grid-magnet-class') {
      if (!exact({ classifyShape: false, shapeFamilyOf: false })) violations.push(specifier)
    } else if (specifier === './types') {
      if (!exact({ Pt: true })) violations.push(specifier)
    } else violations.push(specifier)
  }
  return violations
}

const zone8Violations = (path: string, code = source(path)): string[] => {
  const violations: string[] = []
  if (path === BRIDGE) return bridgeViolations(code)
  if (path === CATALOGUE_ADAPTER) return catalogueAdapterViolations(code)
  for (const edge of importEdges(path, code)) {
    if (!edge.to) continue
    const libraryEdge = edge.to === LIBRARY || edge.to.startsWith(LIBRARY + '/')
    if (path === PANEL || path === PAGE) {
      if (libraryEdge && edge.specifier !== '@/lib/effect/library') violations.push(edge.specifier)
      if (path === PAGE && edge.to === BRIDGE
        && edge.specifier !== '@/lib/effect/grid-magnet-library-bridge') violations.push(edge.specifier)
    }
  }
  return violations
}

const classComparisonViolations = (path: string, code = source(path)): string[] => {
  const tree = parse(path, code)
  const violations: string[] = []
  const registered = (node: ts.Expression): boolean => ts.isStringLiteralLike(node)
    && Object.prototype.hasOwnProperty.call(CLASS_SPECS, node.text)
  const equality = new Set([
    ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ])
  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && equality.has(node.operatorToken.kind)
      && (registered(node.left) || registered(node.right))) violations.push(node.getText(tree))
    if (ts.isCaseClause(node) && registered(node.expression)) violations.push(node.getText(tree))
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'includes' && ts.isArrayLiteralExpression(node.expression.expression)
      && node.expression.expression.elements.some((element) => ts.isStringLiteralLike(element)
        && Object.prototype.hasOwnProperty.call(CLASS_SPECS, element.text)))
      violations.push(node.getText(tree))
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return violations
}

const pageSizeViolations = (code = source(PAGE)): string[] => {
  const tree = parse(PAGE, code)
  const violations: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'outer'
      && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'contour'
      && node.expression.expression.getText(tree).replace(/[?!]/g, '') === 'libraryModel')
      violations.push(node.getText(tree))
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'outlineMM'
      && node.expression.getText(tree).includes('materialized')) violations.push(node.getText(tree))
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return violations
}

/** LAW 14 — a shell may ask whether it was given anything; it may never count the options and
 *  decide. Comparing `.length` to anything but zero is the count-driven layout that put nine
 *  names in one unwrapping row and a different Type block on the triangle (Dan, 08-26/08-27). */
const countDrivenLayout = (path: string, code = source(path)): string[] => {
  const tree = parse(path, code)
  const out: string[] = []
  const isCount = (n: ts.Node) => ts.isPropertyAccessExpression(n) && n.name.text === 'length'
  const isThreshold = (n: ts.Node) => ts.isNumericLiteral(n) && n.text !== '0'
  const visit = (node: ts.Node) => {
    // either operand order — `opts.x.length === 1` and `1 === opts.x.length` are one rule
    if (ts.isBinaryExpression(node)
      && ((isCount(node.left) && isThreshold(node.right))
        || (isThreshold(node.left) && isCount(node.right)))) out.push(node.getText(tree))
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return out
}

const pitchDefaultViolations = (
  paths: readonly string[] = domainRuntimeFiles(), overrides: ReadonlyMap<string, string> = new Map(),
): string[] => {
  const offenders: string[] = []
  for (const path of paths) {
    const tree = parse(path, overrides.get(path) ?? source(path))
    const visit = (node: ts.Node) => {
      if (ts.isParameter(node) && ts.isIdentifier(node.name) && /pitchMM/i.test(node.name.text)
        && node.initializer) offenders.push(path)
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
  return offenders
}

const physicalConstantViolations = (
  paths: readonly string[] = domainRuntimeFiles(), overrides: ReadonlyMap<string, string> = new Map(),
): string[] => {
  const offenders: string[] = []
  const physical = /(PAD|PADDING|PITCH|DIAMETER|DIA).*MM/
  for (const path of paths) {
    const tree = parse(path, overrides.get(path) ?? source(path))
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && physical.test(node.name.text))
        offenders.push(path + ':' + node.name.text)
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
  return offenders
}

describe('Shape-Layout Library Law — activation schedule', () => {
  it('STEP 1: retired runtime/test vocabulary is absent', () => {
    const governed = [
      ...domainRuntimeFiles(),
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

  it('STEP 4 gate self-proof rejects accessors and non-data values', () => {
    expect(() => assertDataOnly({ get label() { return 'x' } })).toThrow('accessor')
    expect(() => assertDataOnly({ value: new Date(0) })).toThrow('non-plain object')
    expect(() => assertDataOnly({ value: Number.POSITIVE_INFINITY })).toThrow('non-finite number')
    expect(() => assertDataOnly({ [Symbol('x')]: 1 })).toThrow('symbol key')
  })

  it('STEP 2: registration invariants derive families from registered classes', () => {
    for (const [classId, spec] of Object.entries(CLASS_SPECS)) {
      expect(specOf(classId), classId).toBe(spec)
      expect(spec.classId).toBe(classId)
      expect(spec.types.length).toBeGreaterThan(0)
      for (const pitchMM of [24, 48, 96]) for (const type of spec.types)
        expect(spec.variants(type.id, pitchMM).length).toBeGreaterThan(0)
    }
  })
  it('STEP 2: every governed source belongs to exactly one active zone', () => {
    for (const path of libraryFiles()) expect(zonesOf(path), path).toHaveLength(1)
  })
  it('STEP 2: every concrete class package is registered', () => {
    expect(unregisteredClassPackages()).toEqual([])
  })
  it('STEP 2: the AST import matrix enforces zones 0-7', () => {
    expect(importViolations()).toEqual([])
  })
  it('STEP 2: zones 0-6 contain no React, Next, or JSX', () => {
    for (const path of nonUiFiles()) {
      const tree = parse(path)
      expect(parseFailureCodes(tree), path).toEqual([])
      expect(jsxOffenders(tree), path).toEqual([])
    }
  })
  it('STEP 2: contracts contain declarations only', () => {
    for (const path of ZONE_FILES[0])
      expect(contractRuntimeDeclarations(join(LIBRARY, path)), path).toEqual([])
  })
  it('STEP 2 gate self-proof rejects forbidden service-to-class, JSX, mutable corpus and sentinels', () => {
    const classId = Object.keys(CLASS_SPECS)[0]
    expect(importViolations({
      'library/selection.ts': `import { ${classId}Class } from './${classId}-class'; void ${classId}Class`,
    })).toContainEqual(expect.objectContaining({ fromZone: 5, toZone: 3 }))
    expect(importViolations({
      'library/circle-class.ts': `import { ${classId}Class } from './${classId}-class'; void ${classId}Class`,
    })).toContainEqual(expect.objectContaining({ fromZone: 3, toZone: 3, reason: 'concrete class package edge is forbidden' }))
    expect(unregisteredClassPackages([
      ...libraryFiles(), join(LIBRARY, 'circle-class.ts'),
    ])).toContain('circle-class.ts')
    expect(importViolations({
      'library/surface.ts': source(join(LIBRARY, 'surface.ts')) + `\nimport './triangle-class'`,
    })).toContainEqual(expect.objectContaining({ fromZone: 6, toZone: 3 }))
    expect(jsxOffenders(parse('probe.tsx', `export const Probe = () => <div />`))).toHaveLength(1)
    expect(parseFailureCodes(parse('probe.ts', `export const Probe = <div />`))).not.toEqual([])
    expect(contractRuntimeDeclarations('contract-probe.ts', `export function probe() {}`)).toHaveLength(1)
    expect(corpusDeclarationViolations('corpus-probe.ts',
      `export const FRAMES: readonly unknown[] = []`)).toEqual(['FRAMES'])
    expect(emptyLayoutSentinels('sentinel.ts',
      `const frame = { cols: 1, rows: 1, layouts: [] }`)).toEqual([1])
  })
  it('STEP 2: no runtime pitch default exists in library services', () => {
    expect(pitchDefaultViolations()).toEqual([])
  })
  it('STEP 2: corpus exports are literal readonly values and no empty frame sentinel remains', () => {
    for (const path of coreFiles().filter((file) => /^corpus-/.test(basename(file))))
      expect(corpusDeclarationViolations(path), path).toEqual([])
    for (const path of coreFiles()) expect(emptyLayoutSentinels(path), path).toEqual([])
  })
  it('STEP 2: physical constants are owned by grid-magnet-spec', () => {
    expect(physicalConstantViolations()).toEqual([])
  })
  it('STEP 2: physical and class policy cover every non-UI runtime file', () => {
    for (const path of governedRuntimeFiles()) if (zonesOf(path)[0] !== 3)
      expect(classComparisonViolations(path), path).toEqual([])
  })
  it('STEP 3: page consumes producer-owned size only', () => {
    expect(pageSizeViolations()).toEqual([])
  })
  it('STEP 5: no shell counts its options to choose what to render', () => {
    // the panel is the only shell that receives PanelOptions; the page passes the record
    // through untouched, and its own `.length` tests are bench contour geometry
    expect(countDrivenLayout(PANEL)).toEqual([])
    expect(source(PAGE)).not.toMatch(/\boptions\.(types|frames|orientations|layouts|spacing)\b/)
    expect(countDrivenLayout('probe.tsx', `const x = opts.types.length === 1`)).toHaveLength(1)
    expect(countDrivenLayout('probe.tsx', `const x = 1 !== opts.types.length`)).toHaveLength(1)
    expect(countDrivenLayout('probe.tsx', `const x = opts.types.length > 0`)).toEqual([])
    expect(countDrivenLayout('probe.tsx', `const x = 0 < opts.types.length`)).toEqual([])
  })
  it('STEP 2/3 gate self-proof rejects physical defaults, class branches, and size recomputation', () => {
    const physicalOverrides = new Map<string, string>([[
      join(LIBRARY, 'surface.ts'), source(join(LIBRARY, 'surface.ts')) + '\nconst FAKE_PITCH_MM = 48',
    ]])
    expect(physicalConstantViolations(undefined, physicalOverrides))
      .toEqual([join(LIBRARY, 'surface.ts') + ':FAKE_PITCH_MM'])
    const pitchOverrides = new Map<string, string>([[
      BRIDGE, source(BRIDGE).replace('pitchMM: number)', 'pitchMM: number = 48)'),
    ]])
    expect(pitchDefaultViolations(undefined, pitchOverrides)).toEqual([BRIDGE])
    const classBranch = source(join(LIBRARY, 'surface.ts')).replace(
      'const resolved = resolveSelection(selection, drafts, pitchMM)',
      "const resolved = resolveSelection(selection, drafts, pitchMM)\n  if (resolved.classId === 'triangle') void 0",
    )
    expect(classComparisonViolations(join(LIBRARY, 'surface.ts'), classBranch)).not.toEqual([])
    expect(pageSizeViolations(source(PAGE) + `\nconst libraryBox = (() => {
      const pts = libraryModel?.contour.outer.pts
      return pts.map((point) => point[0])
    })()`)).not.toEqual([])
    // a non-null assertion is ordinary TypeScript and read the same size out of the contour
    expect(pageSizeViolations(source(PAGE).replace(
      'boxMM={{ w: libraryState.materialized.widthMM',
      'boxMM={{ w: Math.max(...libraryModel!.contour.outer.pts.map((p) => p[0]))',
    ))).not.toEqual([])
    // and zone 0's rule reaches a THIRD contract file, not just the two it was written against
    expect(contractRuntimeDeclarations(join(LIBRARY, 'qa-contract.ts'),
      `export function leakedRuntime(): number { return 1 }`)).toHaveLength(1)
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
    for (const path of coreFiles()) {
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
  it('LAW 1: placement, layout-carry and variant selection each have one implementation', () => {
    // each of these was written out twice — the lattice-to-mm flip once for the canvas and once
    // for the chip label, pickLayout in zone 3 and again in zone 5, selectVariant in zone 5 and
    // by hand in the triangle package. Two copies of one fact is how the chip came to say
    // 120x120 over a 135x135 shape.
    const owners: Record<string, string[]> = { placeMM: [], pickLayout: [], selectVariant: [] }
    const flips: string[] = []
    for (const path of libraryFiles()) {
      const tree = parse(path)
      const visit = (node: ts.Node) => {
        const name = ts.isFunctionDeclaration(node) ? node.name?.text
          : ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
            && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
            ? node.name.text : undefined
        if (name && name in owners) owners[name].push(basename(path))
        // the lattice<->mm conversion itself: anything scaled BY the pitch. rules.ts counts a
        // ring side from its own start, which reads similar and is a different fact — this
        // catches the conversion, not the arithmetic shape.
        if (ts.isBinaryExpression(node)
          && (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken
            || node.operatorToken.kind === ts.SyntaxKind.SlashToken)
          && [node.left, node.right].some((side) => ts.isIdentifier(side) && side.text === 'pitchMM')
          // `96 / pitchMM` is a physical distance in NODES — a count, not a coordinate
          && !ts.isNumericLiteral(node.left)) flips.push(basename(path))
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
    expect(owners.placeMM).toEqual(['geometry.ts'])
    // transforms.ts is geometry; selection vocabulary reaching it is how the last collapse
    // put state policy in the wrong module to satisfy an owner count (QA, 08-27)
    expect(importEdges(join(LIBRARY, 'transforms.ts')).flatMap((edge) => edge.specifier))
      .toEqual(['./types'])
    expect(source(join(LIBRARY, 'transforms.ts'))).not.toMatch(/\bLibrarySelection\b|\bClassVariant\b/)
    expect(owners.pickLayout).toEqual(['selection-transition.ts'])
    expect(owners.selectVariant).toEqual(['selection-transition.ts'])
    // geometry.ts owns both directions (placeMM out, nodeAtMM back); rules.ts converts nothing —
    // it samples a physical stride, which is the pitch as a COUNT, not a coordinate
    expect([...new Set(flips)].sort()).toEqual(['geometry.ts'])
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
      assertDataOnly(entry)
      expect(JSON.parse(JSON.stringify(entry))).toEqual(entry)
      expect(Number.isFinite(entry.widthMM) && Number.isFinite(entry.heightMM)).toBe(true)
    }
    const ids = entries.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...catalogue(24).map((entry) => entry.id)].sort()).toEqual([...ids].sort())
    expect([...catalogue(96).map((entry) => entry.id)].sort()).toEqual([...ids].sort())
    type CatalogueIdentity = { id: string; classId: string; typeId: string; corners: 'sharp' | 'bevel' | 'round'; frameCols: number; frameRows: number; nodesMM: readonly (readonly [number, number])[] }
    const identity: CatalogueIdentity[] = entries.map((entry) => ({ id: entry.id, classId: entry.classId, typeId: entry.typeId, corners: entry.corners, frameCols: entry.frameCols, frameRows: entry.frameRows, nodesMM: [...entry.nodesMM].sort((a, b) => a[0] - b[0] || a[1] - b[1]) }))
    const manifest = JSON.parse(source(join(TESTS, 'fixtures/catalogue-identity.v1.json'))) as CatalogueIdentity[]
    const byId = (a: CatalogueIdentity, b: CatalogueIdentity) => a.id.localeCompare(b.id)
    expect([...manifest].sort(byId)).toEqual([...identity].sort(byId))
  })
  it('STEP 4: every record at every pitch equals an independent build through the class contract', () => {
    for (const pitchMM of [24, 48, 96]) for (const entry of catalogue(pitchMM)) {
      const [classId, typeId, variantId, layoutId, t, x, y] = entry.id.split('/').map(decodeURIComponent)
      const spec = specOf(classId)
      const opened = spec.open({ classId, frameKey: '', layoutId: '', view: { transpose: false, flipX: false, flipY: false } }, pitchMM)
      const variant = spec.variants(typeId, pitchMM).find((item) => item.id === variantId)!
      const expected = materializeSelection({
        ...selectVariant(opened, variant), layoutId,
        view: { transpose: t === 't', flipX: x === 'x', flipY: y === 'y' },
      }, pitchMM)
      expect(entry.nodesMM, entry.id + ' nodes @' + pitchMM).toEqual(expected.nodesMM)
      expect(entry.outlineMM, entry.id + ' outline @' + pitchMM).toEqual(expected.outlineMM)
      expect([entry.widthMM, entry.heightMM, entry.frameCols, entry.frameRows], entry.id + ' size @' + pitchMM)
        .toEqual([expected.widthMM, expected.heightMM, expected.frameCols, expected.frameRows])
    }
  }, 30_000)
  it('STEP 4: classifier matcher round-trips every catalogue entry at every pitch', () => {
    for (const pitchMM of [24, 48, 96]) for (const item of classifiedLibraryCatalogue(pitchMM)) {
      const shape = item.shapeClass
      const numericFields = [shape.cx, shape.cy, shape.band, shape.widthMM, shape.heightMM, shape.fill, shape.frame.cols, shape.frame.rows, shape.frame.capacity]
      expect(numericFields.every(Number.isFinite), item.entry.id).toBe(true)
      expect(catalogueCandidates(item.entry.outlineMM.map(([x, y]) => [x, y]), pitchMM).some((entry) => entry.id === item.entry.id), item.entry.id).toBe(true)
    }
  }, 20_000)
  it('STEP 5: surface, bridge, barrel, and shell use the contract boundary', () => {
    expect(barrelExports()).toEqual({
      types: ['CatalogueEntry', 'CornerMode', 'LibraryDraft', 'LibraryEdit', 'LibraryFamily', 'LibrarySelection', 'LibrarySurface', 'MaterializedLibrary', 'PanelOption', 'PanelOptions'],
      values: ['CATALOGUE_FORMAT_VERSION', 'DEFAULT_LIBRARY_SELECTION', 'DRAFT_STORE_KEY', 'LIBRARY_FAMILIES', 'catalogue', 'deleteEdit', 'librarySurface', 'saveEdit', 'selectionForFamily', 'startAdd', 'startEdit', 'toggleNodeAt'],
      wildcards: [],
      aliases: [],
    })
    const bridge = source(join(ROOT, 'grid-magnet-library-bridge.ts'))
    for (const symbol of ['materializeSelection', 'materializeDraft', 'resolveSelection', 'panelOptions', 'specOf'])
      expect(bridge).not.toContain(symbol)
    const panel = source(PANEL)
    expect(panel).not.toContain('panelOptions(')
    expect(panel).toContain('options: PanelOptions')
    const page = source(PAGE)
    expect(page).toContain('librarySurface(')
    expect(page).toContain('libraryStageModel(')
    expect(callsNamed(PAGE, 'librarySurface')).toBe(1)
    expect(callsNamed(PAGE, 'libraryStageModel')).toBe(1)
    const SURFACE = join(LIBRARY, 'surface.ts')
    for (const name of ['resolveSelection', 'materializeResolved', 'panelOptionsResolved'])
      expect(callsNamed(SURFACE, name), name).toBe(1)
    expect(zone8Violations(PANEL)).toEqual([])
    expect(zone8Violations(PAGE)).toEqual([])
    expect(zone8Violations(join(ROOT, 'grid-magnet-library-bridge.ts'))).toEqual([])
    expect(zone8Violations(join(ROOT, 'grid-magnet-library-catalogue.ts'))).toEqual([])
  })
  it('STEP 5 gate self-proof rejects forbidden panel, page, and bridge edges', () => {
    expect(zone8Violations(PANEL, source(PANEL) + `\nimport { resolveSelection } from '@/lib/effect/library/selection'`)).toEqual(['@/lib/effect/library/selection'])
    expect(zone8Violations(PAGE, source(PAGE) + `\nimport { materializeSelection } from '@/lib/effect/library/materialize'`)).toEqual(['@/lib/effect/library/materialize'])
    expect(zone8Violations(join(ROOT, 'grid-magnet-library-bridge.ts'), source(join(ROOT, 'grid-magnet-library-bridge.ts')) + `\nimport { resolveSelection } from './library/selection'`)).toEqual(['./library/selection'])
    expect(barrelExports(source(join(LIBRARY, 'index.ts')) + `\nexport * from './triangle-class'`).wildcards).toHaveLength(1)
    expect(barrelExports(source(join(LIBRARY, 'index.ts')).replace(
      'catalogue }', 'catalogue as hacked }',
    ))).toMatchObject({ values: expect.arrayContaining(['hacked']), aliases: ['catalogue as hacked'] })
    expect(bridgeViolations(source(join(ROOT, 'grid-magnet-library-bridge.ts')) + `\nimport './types'`)).toEqual(['./types'])
    expect(catalogueAdapterViolations(source(join(ROOT, 'grid-magnet-library-catalogue.ts')).replace(
      "from './library'", "from './library/catalogue'",
    ))).toEqual(['./library/catalogue'])
    expect(catalogueAdapterViolations(
      source(join(ROOT, 'grid-magnet-library-catalogue.ts')).replace('type CatalogueEntry', 'CatalogueEntry'),
    )).toEqual(['./library'])
    expect(callsNamed(PAGE, 'librarySurface', source(PAGE) + `\nlibrarySurface()`)).toBe(2)
    expect(callsNamed(join(LIBRARY, 'surface.ts'), 'resolveSelection',
      source(join(LIBRARY, 'surface.ts')).replace(
        'const resolved = resolveSelection(selection, drafts, pitchMM)',
        'const resolved = resolveSelection(selection, drafts, pitchMM)\n  void resolveSelection(selection, drafts, pitchMM)',
      ))).toBe(2)
  })
})
