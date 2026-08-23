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
  'magnetic-grid/compute.ts': [/^\.\/compute\/(seat|centre-evidence|wrap-measurement|identity)$/],
  'magnetic-grid/compute/wrap-measurement.ts': [/^\.\.\/spec$/, /^\.\/seat$/],
  'magnetic-grid/compute/identity.ts': [/^\.\.\/spec$/],
  'magnetic-grid/compute/seat.ts': [/^\.\.\/spec$/],
  'magnetic-grid/compute/centre-evidence.ts': [/^\.\.\/spec$/, /^\.\/seat$/],
  'magnetic-grid/logic.ts': [/^\.\/spec$/],
  'magnetic-grid/engine.ts': [/^\.\/spec$/, /^\.\/compute$/, /^\.\/logic$/],
  'effect/magnetic-grid-bridge.ts': [
    /^\.\/geometry-truth$/, /^\.\/contour$/, /^\.\/offset$/, /^\.\/types$/,
    /^\.\.\/magnetic-grid\/engine$/, /^@\/lib\/vector-core$/,
  ],
} as const

/** Final v3.5.3 owner profile: frozen Centre + ruler Wrap + even-size scaling. */
const PHASE_TOP_LEVEL_FUNCTIONS: Record<keyof typeof OWNERS, readonly string[]> = {
  'magnetic-grid/spec.ts': [],
  'magnetic-grid/compute.ts': [],
  'magnetic-grid/compute/wrap-measurement.ts': ['measureWrap'],
  'magnetic-grid/compute/identity.ts': ['contourIdentity','contourBoundaryTruth'],
  'magnetic-grid/compute/seat.ts': [
    'big', 'orient', 'onSegment', 'prepare', 'locate', 'atLeast', 'holds', 'bbox',
    'spotRadiusOf', 'fieldSpanMM', 'axisFrom', 'latticeAt', 'latticeOver',
    'measureCentrePlacements', 'edgeIdxOf', 'segDist2', 'edgeDistMM', 'pointInOuter',
    'pointInMaterial', 'nearestOutlineMM', 'makeSeatPredicate', 'pressExcessMM',
    'measureParity', 'splitPerimeter', 'measureExtremeCorners', 'scaleContour',
  ],
  'magnetic-grid/compute/centre-evidence.ts': ['safeSegments', 'centroidOf', 'measureCentreBranches'],
  'magnetic-grid/logic.ts': [
    'bandOf', 'governMass', 'centeringAnchors',
    'centrePhaseCandidates', 'chooseCentrePlacement', 'evaluateWrap', 'inspectionConcessions', 'reduceBandLadders', 'bandRefusal', 'applyCoverage', 'assignSizes',
  ],
  'magnetic-grid/engine.ts': [
    'mod', 'computeGrid', 'wrapPolicyOf', 'solveBands', 'fitSizeInBand', 'autoFlapInBand',
  ],
  'effect/magnetic-grid-bridge.ts': [
    'contourIdentity', 'boundaryTruth', 'bboxOf', 'normBaseContour', 'makeSizer', 'normMaskContour', 'normGeneratedRing',
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

const namedImportsFrom = (text: string, sources: ReadonlySet<string>): string[] => {
  const names: string[] = []
  for (const statement of parse(text).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
      || !sources.has(statement.moduleSpecifier.text)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) names.push(element.name.text)
  }
  return names
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
      && ts.isStringLiteral(node.moduleSpecifier) && /compute/.test(node.moduleSpecifier.text)) {
      violations.push('logic-compute-import')
    }
    if (file === 'magnetic-grid/engine.ts'
      && (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))) violations.push('engine-ui')
  })
  const expected = [...PHASE_TOP_LEVEL_FUNCTIONS[file]].sort()
  const actual = topLevelFunctionNames(text).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) violations.push(`t2-function-set:${actual.join(',')}`)
  return violations
}

describe('magnetic-grid current-phase owner DAG', () => {
  it('every final owner imports only its contracted dependencies', () => {
    for (const file of Object.keys(OWNERS) as Array<keyof typeof OWNERS>) {
      const bad = forbiddenImports(file, readFileSync(join(ROOT, file), 'utf8'))
      expect(bad, `${file} imports outside its T2 owner list`).toEqual([])
    }
  })

  it('every final owner matches the explicit T2 phase profile', () => {
    for (const file of Object.keys(OWNERS) as Array<keyof typeof OWNERS>) {
      const bad = ownerKindViolations(file, readFileSync(join(ROOT, file), 'utf8'))
      expect(bad, `${file} diverges from its current owner/profile allowlist`).toEqual([])
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

  it('rejects additions beyond the exact current-phase body allowlist', () => {
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
  it('carries BoundaryTruth through the live request and validates it before caching',()=>{
    const panel=readRepo('src/app/(dev)/effect-creator/grid-origin/LawPanel.tsx'),worker=readRepo('src/app/(dev)/effect-creator/grid-origin/law.worker.ts')
    expect(panel).toContain('boundaryTruth: boundaryTruth(base)')
    expect(worker).toContain('boundaryTruth.contourIdentity!==contourIdentity(base)')
    expect(worker).toContain('[boundaryTruth.contourIdentity, offsetMM]')
  })
  it('measures seat and Wrap from one signed clearance record in seat.ts geometry, nothing below the ruler',()=>{
    const contact=readRepo('src/lib/magnetic-grid/compute/wrap-measurement.ts'),logic=readRepo('src/lib/magnetic-grid/logic.ts')
    expect(contact).toContain("import { nearestOutlineMM, pointInMaterial, splitPerimeter } from './seat'")
    expect(contact).toContain('Math.floor(rawClearanceMM + 0.5)')
    expect(contact).not.toMatch(/exact|Rational|toFixed|1e-|QUANTUM|GUARD/)
    expect(logic).not.toMatch(/compareExact|approx|toFixed/i)
  })
  it('solveBands is the only production loop over the even-size ladder; no second size walk anywhere',()=>{
    const loops=(text:string)=>(text.match(/\+=\s*SIZE_STEP_MM/g)??[]).length
    expect(loops(readRepo('src/lib/magnetic-grid/engine.ts'))).toBe(1)
    for(const file of LAW_RUNTIME_FILES.filter((f)=>!f.endsWith('engine.ts'))) expect(loops(readRepo(file)),`${file} walks sizes`).toBe(0)
    for(const file of LAW_RUNTIME_FILES) expect(identifiersOf(readRepo(file)).filter((n)=>/^(bandWalk|bandSnapPoints|snapRange|BandSnapPoint|solveCache|schedulePrefetch)$/.test(n)),`${file} carries a deleted walk identifier`).toEqual([])
  })

  it('keeps the final surface import doors and stored rung rendering mechanical', () => {
    const panel = readRepo('src/app/(dev)/effect-creator/grid-origin/LawPanel.tsx')
    const worker = readRepo('src/app/(dev)/effect-creator/grid-origin/law.worker.ts')
    const engine = readRepo('src/lib/magnetic-grid/engine.ts')
    expect(importsOf(panel).filter((source) => source.startsWith('@/lib/magnetic-grid/'))).toEqual([])
    expect(importsOf(worker).filter((source) => source.startsWith('@/lib/magnetic-grid/')))
      .toEqual(['@/lib/magnetic-grid/engine'])
    expect(importsOf("import x from '@/lib/magnetic-grid/spec'").filter((source) => source.startsWith('@/lib/magnetic-grid/')))
      .toEqual(['@/lib/magnetic-grid/spec'])

    const fit = parse(engine).statements.find((statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === 'fitSizeInBand')
    expect(fit).toBeDefined()
    const fitIds = identifiersOf(fit!.getText())
    for (const forbidden of namedImportsFrom(engine, new Set(['./compute', './logic']))) {
      expect(fitIds, `fitSizeInBand calls ${forbidden}`).not.toContain(forbidden)
    }

    expect(identifiersOf(engine), 'engine recomputes the perimeter belt').not.toContain('splitPerimeter')
    expect(worker).toContain('cached.contoursBySize.get(eff)')
    expect(worker).toContain('cached.contoursBySize.get(band.minMM)')
    expect(worker).not.toMatch(/contour:\s*sized\(/)
    expect(worker).toContain('Math.max(0, Math.min(rungSel')
    expect(worker).toContain('Math.max(0, Math.min(layoutSel')
    const idxExpression = worker.match(/const idx = (.+)/)?.[1]
    const layoutExpression = worker.match(/const layoutIdx = (.+)/)?.[1]
    expect(idxExpression).toBeDefined()
    expect(layoutExpression).toBeDefined()
    const ladder = { rungs: [{ layouts: [{}, {}] }, { layouts: [{}] }] }
    const idx = Function('rungSel', 'ladder', `return ${idxExpression}`)(-4, ladder)
    expect(idx).toBe(0)
    expect(Function('layoutSel', 'ladder', 'idx', `return ${layoutExpression}`)(-3, ladder, idx)).toBe(0)
    expect(worker).toContain('autoFlapInBand(cachedSizer, cfg, autoFlapMaxMM)')
    expect(panel).toContain("model.grid.concessions.join(' + ')")
    expect(panel).toContain("const [flapStored, setFlapStored] = usePersisted('flap', FLAP_MM)")
    expect(panel).toContain('const flap = Math.round(flapStored)')
    expect(panel).toContain('setFlapStored(Math.round(n))')
    expect(panel).toContain("const [sizeMinStored, setSizeMinStored] = usePersisted('sizeMin', MIN_EFFECT_MM)")
    expect(panel).toContain("const [sizeMaxStored, setSizeMaxStored] = usePersisted('sizeMax', sizeRange(RELEASED_PADDING_MM).maxMM)")
    expect(panel).toContain('const sizeMin = evenMM(sizeMinStored)')
    expect(panel).toContain('const sizeMax = evenMM(sizeMaxStored)')
    expect(panel).toContain('setSizeMinStored(evenMM(n))')
    expect(panel).toContain('setSizeMaxStored(evenMM(n))')
    expect(panel.match(/const n = evenMM\(\+e\.currentTarget\.value\)/g)).toHaveLength(2)
    expect(panel.match(/setSizeMM\(n\)/g)).toHaveLength(2)
    expect(panel.match(/setSizeMM\(evenMM\(n\)\)/g)).toHaveLength(1)
    const evenMM = (mm: number) => Math.round(mm / 2) * 2
    const staleMax = evenMM(25)
    const forcedSize = 27 > staleMax ? staleMax : 27
    expect(staleMax).toBe(26)
    expect(forcedSize).toBe(26)
    expect(forcedSize).toBeLessThanOrEqual(staleMax)
  })

  it('asserts the deleted rocket science is absent from the Law runtime',()=>{
    const deleted=/^(ExactInteger|Rational|AlgebraicReal|ExactReal|ExactScale|ExactPoint|BoundaryElement|PreparedContour|sqrtMinusRational|compareExactToRational|certifyContactWitness|sha256Text|exactSeatIsLegal|exactPointInMaterial|makeCircleSeatPredicate|maxPressMM|contactPointsMM|impliedFlapMM|TANGENT_GUARD_MM|parityHolds|prepareContour|PHASE_STEP_MM|PHASE_STEP_FLOOR_MM|phaseStepMM|segmentsDetail|panMM|PerimeterMeasurement)$/
    for(const file of [...LAW_RUNTIME_FILES,'src/lib/magnetic-grid/compute/wrap-measurement.ts','src/lib/magnetic-grid/compute/identity.ts']){
      const text=readRepo(file)
      expect(identifiersOf(text).filter((name)=>deleted.test(name)),`${file} still carries a deleted identifier`).toEqual([])
      expect(importsOf(text).filter((source)=>/exact-real|contact-root/.test(source)),`${file} imports a deleted module`).toEqual([])
    }
    expect(identifiersOf('const x = exactSeatIsLegal(1)').filter((name)=>deleted.test(name))).toEqual(['exactSeatIsLegal'])
    expect(identifiersOf('const phaseStepMM = PHASE_STEP_MM').filter((name)=>deleted.test(name))).toEqual(['phaseStepMM', 'PHASE_STEP_MM'])
  })
})
