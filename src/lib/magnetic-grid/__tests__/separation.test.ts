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

const ownerKindViolations = (file: keyof typeof OWNERS, text: string): string[] => {
  const violations: string[] = []
  walk(parse(text), (node) => {
    if (file === 'magnetic-grid/spec.ts') {
      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) violations.push('spec-function')
      if (ts.isBinaryExpression(node) && /[-+*/%]/.test(node.operatorToken.getText())) violations.push('spec-arithmetic')
    }
    if (file === 'magnetic-grid/logic.ts' && ts.isCallExpression(node)) {
      const callee = node.expression.getText()
      if (/Math\.(hypot|sqrt|atan2|sin|cos)|bbox|lattice|prepare|holds|pointInPolygon|edgeDist|insetRing/.test(callee)) {
        violations.push(`logic-geometry:${callee}`)
      }
    }
    if (file.startsWith('magnetic-grid/compute/') && ts.isIdentifier(node)) {
      if (/^(CentreMode|Governor|MagnetPlan|Coverage)$/.test(node.text)) violations.push(`compute-policy:${node.text}`)
    }
    if (file === 'magnetic-grid/engine.ts') {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) violations.push('engine-ui')
      if (ts.isFunctionDeclaration(node) && node.name && /^(parityHolds|centrePhaseCandidates|chooseCentrePlacement|governMass)$/.test(node.name.text)) {
        violations.push(`engine-policy:${node.name.text}`)
      }
      if (ts.isCallExpression(node) && /Math\.(hypot|sqrt|atan2|sin|cos)|pointInPolygon|insetRing/.test(node.expression.getText())) {
        violations.push(`engine-geometry:${node.expression.getText()}`)
      }
    }
  })
  return violations
}

describe('magnetic-grid T2 owner DAG', () => {
  it('every final owner imports only its contracted dependencies', () => {
    for (const file of Object.keys(OWNERS) as Array<keyof typeof OWNERS>) {
      const bad = forbiddenImports(file, readFileSync(join(ROOT, file), 'utf8'))
      expect(bad, `${file} imports outside its T2 owner list`).toEqual([])
    }
  })

  it('every final owner contains only its T2 kind of code', () => {
    for (const file of Object.keys(OWNERS) as Array<keyof typeof OWNERS>) {
      const bad = ownerKindViolations(file, readFileSync(join(ROOT, file), 'utf8'))
      expect(bad, `${file} contains code owned by another T2 layer`).toEqual([])
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

  it('rejects owner-kind mutations, not only import strings', () => {
    expect(ownerKindViolations('magnetic-grid/spec.ts', 'export const derived = () => 1 + 1')).toContain('spec-function')
    expect(ownerKindViolations('magnetic-grid/logic.ts', 'export const leak = () => Math.hypot(1, 2)')).toContain('logic-geometry:Math.hypot')
    expect(ownerKindViolations('magnetic-grid/compute/seat.ts', 'type Leak = CentreMode')).toContain('compute-policy:CentreMode')
    expect(ownerKindViolations('magnetic-grid/engine.ts', 'function parityHolds() { return true }')).toContain('engine-policy:parityHolds')
  })
})
