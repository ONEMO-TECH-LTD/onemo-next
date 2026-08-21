import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const REPO = process.cwd()
const ROOT = join(REPO, 'src/lib')

const LAW_RUNTIME_FILES = [
  'src/lib/magnetic-grid/spec.ts',
  'src/lib/magnetic-grid/compute.ts',
  'src/lib/magnetic-grid/compute/seat.ts',
  'src/lib/magnetic-grid/compute/centre-evidence.ts',
  'src/lib/magnetic-grid/logic.ts',
  'src/lib/magnetic-grid/engine.ts',
  'src/lib/effect/magnetic-grid-bridge.ts',
  'src/app/(dev)/effect-creator/grid-origin/LawPanel.tsx',
  'src/app/(dev)/effect-creator/grid-origin/law.worker.ts',
] as const

const FROZEN_DONORS = [
  'src/lib/effect/grid-origin.ts',
  'src/lib/effect/grid-origin-spec.ts',
  'src/lib/effect/grid-origin-compute.ts',
  'src/lib/effect/grid-origin-logic.ts',
  'src/lib/effect/grid-origin-bridge.ts',
  'src/app/(dev)/effect-creator/grid-origin/solve.worker.ts',
  'src/lib/grid-engine/compute/geometry.ts',
] as const

const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex')
const readRepo = (file: string): string => readFileSync(join(REPO, file), 'utf8')
const donorBytes = (file: string): Buffer => execFileSync('git', ['show', `8d17780c:${file}`], { cwd: REPO })

const OWNERS = {
  'magnetic-grid/spec.ts': [] as RegExp[],
  'magnetic-grid/compute.ts': [/^\.\/compute\/(seat|centre-evidence|exact-real|contact-root)$/],
  'magnetic-grid/compute/exact-real.ts': [/^\.\.\/spec$/],
  'magnetic-grid/compute/contact-root.ts': [/^\.\.\/spec$/, /^\.\/exact-real$/],
  'magnetic-grid/compute/seat.ts': [/^\.\.\/spec$/],
  'magnetic-grid/compute/centre-evidence.ts': [/^\.\.\/spec$/, /^\.\/seat$/],
  'magnetic-grid/logic.ts': [/^\.\/spec$/, /^\.\/compute$/],
  'magnetic-grid/engine.ts': [/^\.\/spec$/, /^\.\/compute$/, /^\.\/logic$/],
  'effect/magnetic-grid-bridge.ts': [
    /^\.\/geometry-truth$/, /^\.\/contour$/, /^\.\/offset$/, /^\.\/types$/,
    /^\.\.\/magnetic-grid\/engine$/, /^@\/lib\/vector-core$/,
  ],
} as const

/** Current phase profile: re-roomed Centre plus the live exact Wrap support/consumer only. */
const PHASE_TOP_LEVEL_FUNCTIONS: Record<keyof typeof OWNERS, readonly string[]> = {
  'magnetic-grid/spec.ts': [],
  'magnetic-grid/compute.ts': [],
  'magnetic-grid/compute/exact-real.ts': [
    'abs', 'gcd', 'q', 'fromPublic', 'toPublic', 'rational', 'rationalFromNumber',
    'addRational', 'subtractRational', 'multiplyRational', 'divideRational', 'squareRational',
    'compareRational', 'integerSqrt', 'exactSquareRoot', 'primitivePolynomial',
    'sqrtMinusRational', 'isRational', 'evaluatePolynomial', 'compareAlgebraicToRational',
    'compareExactToRational', 'approximateExact', 'canonicalExact',
  ],
  'magnetic-grid/compute/contact-root.ts': [
    'exactPoint', 'dot', 'minus', 'plus', 'times', 'squaredLength', 'pointToSegment',
    'witnessForAnchor', 'measureWrap',
  ],
  'magnetic-grid/compute/seat.ts': [
    'big', 'orient', 'onSegment', 'prepare', 'locate', 'atLeast', 'holds', 'bbox',
    'spotRadiusOf', 'fieldSpanMM', 'axisFrom', 'latticeAt', 'latticeOver',
    'measureCentrePlacements', 'edgeIdxOf', 'segDist2', 'edgeDistMM', 'pointInOuter',
    'makeSeatPredicate', 'makeCircleSeatPredicate', 'pressExcessMM', 'maxPressMM',
    'contactPointsMM', 'impliedFlapMM', 'splitPerimeter', 'measureExtremeCorners', 'scaleContour',
  ],
  'magnetic-grid/compute/centre-evidence.ts': ['safeSegments', 'centroidOf', 'measureCentreBranches'],
  'magnetic-grid/logic.ts': [
    'mod', 'parityHolds', 'bandOf', 'governMass', 'centeringAnchors',
    'centrePhaseCandidates', 'chooseCentrePlacement', 'evaluateWrap', 'applyCoverage', 'assignSizes',
  ],
  'magnetic-grid/engine.ts': [
    'mod', 'computeGrid', 'snapRange', 'bandSnapPoints', 'bandWalk', 'fitSizeInBand', 'autoFlapInBand',
  ],
  'effect/magnetic-grid-bridge.ts': [
    'bboxOf', 'normBaseContour', 'makeSizer', 'normMaskContour', 'normGeneratedRing',
    'sizeRange', 'fieldSpots', 'seatedSpots',
  ],
}

const parse = (text: string) => ts.createSourceFile('owner.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

const walk = (root: ts.Node, visit: (node: ts.Node) => void) => {
  const next = (node: ts.Node) => { visit(node); ts.forEachChild(node, next) }
  next(root)
}

const importsOf = (text: string): string[] => {
  const imports: string[] = []
  walk(parse(text), (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text)
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const source = node.arguments[0]
      if (source && ts.isStringLiteral(source)) imports.push(source.text)
    }
  })
  return imports
}

const identifiersOf = (text: string): string[] => {
  const identifiers: string[] = []
  walk(parse(text), (node) => { if (ts.isIdentifier(node)) identifiers.push(node.text) })
  return identifiers
}

const stringLiteralsOf = (text: string): string[] => {
  const literals: string[] = []
  walk(parse(text), (node) => { if (ts.isStringLiteralLike(node)) literals.push(node.text) })
  return literals
}

const forbiddenImports = (file: keyof typeof OWNERS, text: string): string[] => {
  const allowed: readonly RegExp[] = OWNERS[file]
  return importsOf(text).filter((source) => !allowed.some((rule) => rule.test(source)))
}

const topLevelFunctionNames = (text: string): string[] => {
  const names: string[] = []
  for (const statement of parse(text).statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) names.push(statement.name.text)
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer
        && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
        names.push(declaration.name.text)
      }
    }
  }
  return names
}

const ownerKindViolations = (file: keyof typeof OWNERS, text: string): string[] => {
  const violations: string[] = []
  walk(parse(text), (node) => {
    if (file === 'magnetic-grid/spec.ts') {
      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) violations.push('spec-function')
      if (ts.isBinaryExpression(node) && /[-+*/%]/.test(node.operatorToken.getText())) violations.push('spec-arithmetic')
    }
    if (file.startsWith('magnetic-grid/compute/') && ts.isIdentifier(node)) {
      if (/^(CentreMode|Governor|MagnetPlan|Coverage)$/.test(node.text)) violations.push(`compute-policy:${node.text}`)
    }
    if (file === 'magnetic-grid/logic.ts' && ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === './compute') {
      const imported = node.importClause?.namedBindings
      if (!imported || !ts.isNamedImports(imported)
        || imported.elements.some((element) => element.name.text !== 'compareExactToRational')) {
        violations.push('logic-compute-import')
      }
    }
    if (file === 'magnetic-grid/engine.ts'
      && (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))) violations.push('engine-ui')
  })
  const expected = [...PHASE_TOP_LEVEL_FUNCTIONS[file]].sort()
  const actual = topLevelFunctionNames(text).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) violations.push(`t2-function-set:${actual.join(',')}`)
  return violations
}

describe('magnetic-grid T2 owner DAG', () => {
  it('every final owner imports only its contracted dependencies', () => {
    for (const file of Object.keys(OWNERS) as Array<keyof typeof OWNERS>) {
      const bad = forbiddenImports(file, readFileSync(join(ROOT, file), 'utf8'))
      expect(bad, `${file} imports outside its T2 owner list`).toEqual([])
    }
  })

  it('every final owner matches the explicit T2 phase profile', () => {
    for (const file of Object.keys(OWNERS) as Array<keyof typeof OWNERS>) {
      const bad = ownerKindViolations(file, readFileSync(join(ROOT, file), 'utf8'))
      expect(bad, `${file} diverges from its T2 owner/profile allowlist`).toEqual([])
    }
  })

  it('rejects the dependency leaks T2 exists to prevent', () => {
    expect(forbiddenImports('magnetic-grid/compute/centre-evidence.ts', "import x from '../../effect/attachment'"))
      .toEqual(['../../effect/attachment'])
    expect(forbiddenImports('effect/magnetic-grid-bridge.ts', "import x from '../magnetic-grid/compute'"))
      .toEqual(['../magnetic-grid/compute'])
    expect(ownerKindViolations('magnetic-grid/logic.ts', "import { bbox } from './compute'")).toContain('logic-compute-import')
    expect(forbiddenImports('magnetic-grid/compute/seat.ts', "import x from '../../effect/types'"))
      .toEqual(['../../effect/types'])
    expect(forbiddenImports('magnetic-grid/logic.ts', "const x = import('./compute/seat')"))
      .toEqual(['./compute/seat'])
  })

  it('rejects additions beyond the exact T2 preserved-body allowlist', () => {
    expect(ownerKindViolations('magnetic-grid/spec.ts', 'export const derived = () => 1 + 1')).toContain('spec-function')
    expect(ownerKindViolations('magnetic-grid/logic.ts', 'export function newGeometry() {}').some((v) => v.startsWith('t2-function-set:'))).toBe(true)
    expect(ownerKindViolations('magnetic-grid/compute/seat.ts', 'type Leak = CentreMode')).toContain('compute-policy:CentreMode')
    expect(ownerKindViolations('magnetic-grid/engine.ts', 'function wrapIsLawful() { return true }').some((v) => v.startsWith('t2-function-set:'))).toBe(true)
  })

  it('keeps the Law runtime isolated from legacy engines, state and Voting', () => {
    const forbiddenIdentifiers = /^(positioning|votingOrder|registrationScore|VOTING_ORDER)$/
    for (const file of LAW_RUNTIME_FILES) {
      const text = readRepo(file)
      expect(importsOf(text).filter((source) => /grid-origin|grid-engine/.test(source)), `${file} imports a legacy engine`).toEqual([])
      expect(identifiersOf(text).filter((name) => forbiddenIdentifiers.test(name)), `${file} carries legacy state or Voting`).toEqual([])
    }
    expect(stringLiteralsOf(readRepo('src/app/(dev)/effect-creator/grid-origin/LawPanel.tsx')).filter((value) => value.includes('grid-origin.')))
      .toEqual([])
  })

  it('keeps all seven comparator donors byte-identical to 8d17780c', () => {
    for (const file of FROZEN_DONORS) {
      expect(sha256(readFileSync(join(REPO, file))), `${file} diverged from the frozen comparator donor`)
        .toBe(sha256(donorBytes(file)))
    }
  })

  it('mutation-proves the four isolation duties', () => {
    expect(importsOf("import x from '@/lib/effect/grid-origin'").some((source) => /grid-origin|grid-engine/.test(source))).toBe(true)
    expect(stringLiteralsOf("const key = 'grid-origin.pad'").some((value) => value.includes('grid-origin.'))).toBe(true)
    expect(identifiersOf('const positioning = 0')).toContain('positioning')
    const donor = donorBytes(FROZEN_DONORS[0])
    expect(sha256(Buffer.concat([donor, Buffer.from('mutation')]))).not.toBe(sha256(donor))
  })
})
