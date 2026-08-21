import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
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

/** T2 phase profile. These are the reached, disposition-approved bodies after re-rooming.
 * Numeric parity/phase policy remains in Logic, and the sampled band/Auto walk remains in
 * Engine, until their explicitly named T3 adaptations. This guard must not pretend T3 landed. */
const T2_TOP_LEVEL_FUNCTIONS: Record<keyof typeof OWNERS, readonly string[]> = {
  'magnetic-grid/spec.ts': [],
  'magnetic-grid/compute.ts': [],
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
    'centrePhaseCandidates', 'chooseCentrePlacement', 'applyCoverage', 'assignSizes',
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
    if (file === 'magnetic-grid/engine.ts'
      && (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))) violations.push('engine-ui')
  })
  const expected = [...T2_TOP_LEVEL_FUNCTIONS[file]].sort()
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
    expect(forbiddenImports('magnetic-grid/logic.ts', "import x from './compute'"))
      .toEqual(['./compute'])
    expect(forbiddenImports('magnetic-grid/compute/seat.ts', "import x from '../../effect/types'"))
      .toEqual(['../../effect/types'])
    expect(forbiddenImports('magnetic-grid/logic.ts', "const x = import('./compute')"))
      .toEqual(['./compute'])
  })

  it('rejects additions beyond the exact T2 preserved-body allowlist', () => {
    expect(ownerKindViolations('magnetic-grid/spec.ts', 'export const derived = () => 1 + 1')).toContain('spec-function')
    expect(ownerKindViolations('magnetic-grid/logic.ts', 'export function newGeometry() {}').some((v) => v.startsWith('t2-function-set:'))).toBe(true)
    expect(ownerKindViolations('magnetic-grid/compute/seat.ts', 'type Leak = CentreMode')).toContain('compute-policy:CentreMode')
    expect(ownerKindViolations('magnetic-grid/engine.ts', 'function wrapIsLawful() { return true }').some((v) => v.startsWith('t2-function-set:'))).toBe(true)
  })
})
