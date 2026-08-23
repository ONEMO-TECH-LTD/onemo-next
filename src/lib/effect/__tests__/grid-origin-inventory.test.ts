import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { bbox, centroidOf, latticeAt, scaleContour } from '../grid-origin-compute'
import { canonicalCallableBodySha256 } from './grid-origin-function-text'

const ROOT = process.cwd()
const ACTIVE_LANE = 'session62-task/s62-kai-lead-v3.2-rv-t3'

const RUNTIME_FILES = [
  'src/lib/effect/grid-origin-spec.ts',
  'src/lib/effect/grid-origin-compute.ts',
  'src/lib/effect/grid-origin-logic.ts',
  'src/lib/effect/grid-origin.ts',
  'src/lib/effect/grid-origin-bridge.ts',
  'src/app/(dev)/effect-creator/grid-origin/solve.worker.ts',
  'src/app/(dev)/effect-creator/grid-origin/page.tsx',
  'src/lib/effect/__tests__/grid-origin-separation.test.ts',
  'src/app/(dev)/effect-creator/grid-origin/asset-lib/route.ts',
  'src/app/(dev)/effect-creator/grid-origin/asset-lib/dirs.ts',
  'src/app/(dev)/effect-creator/grid-origin/asset-lib/[file]/route.ts',
] as const

type Disposition =
  | 'MOVE-VERBATIM'
  | 'ADAPT'
  | 'DELETE-LATER'
  | 'PRESERVE-COMPARATOR'
  | 'PROVEN-UNRELATED'

const bodyDispositions = new Map<string, Disposition>()
function bodies(file: string, disposition: Disposition, names: readonly string[]) {
  for (const name of names) bodyDispositions.set(`${file}#${name}`, disposition)
}

bodies(RUNTIME_FILES[1], 'ADAPT', [
  'bbox', 'axisFrom', 'latticeAt', 'latticeOver', 'centroidOf', 'scaleContour',
  'makeSeatPredicate', 'maxPressMM', 'impliedFlapMM', 'splitPerimeter',
])
bodies(RUNTIME_FILES[1], 'DELETE-LATER', [
  'dist', 'spotRadiusOf', 'fieldSpanMM', 'edgeIdxOf', 'segDist2', 'edgeDistMM', 'pointInOuter',
  'makeCircleSeatPredicate', 'q', 'distToSeg', 'pressExcessMM', 'contactPointsMM',
  'safeSegments', 'signed', 'key', 'lerp', 'snapToIso', 'smoothLoop', 'level', 'at0',
  'edge', 'compAt', 'at', 'pointInMass',
])
bodies(RUNTIME_FILES[2], 'ADAPT', ['bandOf', 'governMass', 'centeringAnchors', 'applyCoverage', 'assignSizes'])
bodies(RUNTIME_FILES[2], 'DELETE-LATER', ['registrationScore', 'centeringRef'])
bodies(RUNTIME_FILES[3], 'ADAPT', [
  'mod', 'parityHolds', 'lines', 'onNode', 'clsOf', 'bandWalk', 'autoFlapInBand',
])
bodies(RUNTIME_FILES[3], 'DELETE-LATER', [
  'computeGrid', 'snapRange', 'bandSnapPoints', 'solve', 'pressAt', 'fitSizeInBand',
  'phases', 'push', 'fitsM',
])
bodies(RUNTIME_FILES[4], 'ADAPT', ['makeSizer', 'fieldSpots', 'seatedSpots'])
bodies(RUNTIME_FILES[4], 'PRESERVE-COMPARATOR', ['bboxOf', 'normBaseContour', 'normMaskContour', 'normGeneratedRing'])
bodies(RUNTIME_FILES[4], 'DELETE-LATER', ['sizeRange'])
bodies(RUNTIME_FILES[5], 'PRESERVE-COMPARATOR', ['sizeCacheOf', 'bandFit', 'cacheFor', 'schedulePrefetch', 'step'])
bodies(RUNTIME_FILES[6], 'PRESERVE-COMPARATOR', [
  'usePersisted', 'set', 'GridLab', 'saveDefaults', 'resetDefaults', 'report', 'cutFile', 'onFile',
  'loadLib', 'loadCut', 'dim', 'Stage', 'fy', 'commit', 'pxPerMM', 'onWheel', 'Empty',
  'Slider', 'LabRow', 'Sec', 'Fold',
])
bodies(RUNTIME_FILES[7], 'PRESERVE-COMPARATOR', ['readModule', 'pageText', 'walkAst', 'go', 'importsOf', 'collect', 'findBareLawValue', 'square'])
bodies(RUNTIME_FILES[8], 'PROVEN-UNRELATED', ['GET'])
bodies(RUNTIME_FILES[10], 'PROVEN-UNRELATED', ['GET'])

const adaptContracts = new Map<string, { destination: string; fixture: string }>()
function adapted(file: string, names: readonly string[], destination: string, fixture: string) {
  for (const name of names) adaptContracts.set(`${file}#${name}`, { destination, fixture })
}

adapted(RUNTIME_FILES[1], ['bbox', 'axisFrom', 'latticeAt', 'latticeOver'], 'src/lib/magnetic-grid/compute/seat.ts', 'grid-origin-adapt-baseline: bbox/lattice numeric compatibility')
adapted(RUNTIME_FILES[1], ['centroidOf'], 'src/lib/magnetic-grid/compute/centre-evidence.ts', 'grid-origin-adapt-baseline: single-ring centroid + hole defect')
adapted(RUNTIME_FILES[1], ['scaleContour'], 'src/lib/magnetic-grid/compute/seat.ts as scaleBoundary', 'grid-origin-adapt-baseline: scale + hole-loss defect')
adapted(RUNTIME_FILES[1], ['makeSeatPredicate'], 'src/lib/magnetic-grid/compute/seat.ts', 'grid-origin-adapt-baseline: tangent/inside/outside seat predicate')
adapted(RUNTIME_FILES[1], ['maxPressMM', 'impliedFlapMM'], 'src/lib/magnetic-grid/compute/contact-root.ts', 'grid-origin-adapt-baseline: worst-belt allowance equivalence')
adapted(RUNTIME_FILES[1], ['splitPerimeter'], 'src/lib/magnetic-grid/compute/seat.ts neighbour measurement', 'grid-origin-adapt-baseline: belt/interior partition')
adapted(RUNTIME_FILES[2], ['bandOf'], 'src/lib/magnetic-grid/logic.ts band membership', 'grid-origin-adapt-baseline: exact band boundaries')
adapted(RUNTIME_FILES[2], ['governMass', 'centeringAnchors'], 'src/lib/magnetic-grid/logic.ts centre policy', 'grid-origin-centre-baseline: 288 raw-bit centre decisions + direct governors')
adapted(RUNTIME_FILES[2], ['applyCoverage', 'assignSizes'], 'src/lib/magnetic-grid/logic.ts coverage/magnet policy', 'grid-origin-adapt-baseline: coverage and magnet-plan outputs')
adapted(RUNTIME_FILES[3], ['mod', 'parityHolds', 'lines', 'onNode', 'clsOf'], 'src/lib/magnetic-grid/logic.ts parity law', 'grid-origin-centre-baseline: 288 raw-bit phase/anchor outcomes')
adapted(RUNTIME_FILES[3], ['bandWalk'], 'compute/contact-root.ts roots + logic.ts ownership + engine.ts sequencing', 'grid-origin-adapt-baseline: first-count/no-repeat ladder behavior')
adapted(RUNTIME_FILES[3], ['autoFlapInBand'], 'src/lib/magnetic-grid/logic.ts exact minimum allowance', 'grid-origin-adapt-baseline: Auto whole-mm compatibility')
adapted(RUNTIME_FILES[4], ['makeSizer'], 'src/lib/effect/magnetic-grid-bridge.ts', 'grid-origin-adapt-baseline: supplied-contour scaling identity')
adapted(RUNTIME_FILES[4], ['fieldSpots', 'seatedSpots'], 'src/lib/effect/magnetic-grid-bridge.ts view mapping', 'grid-origin-adapt-baseline: field/seated view outputs')

function sha256(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex')
}

function trackedFiles(...paths: string[]): string[] {
  return execFileSync('git', ['ls-files', '--', ...paths], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).sort()
}

function source(file: string): ts.SourceFile {
  const text = readFileSync(join(ROOT, file), 'utf8')
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

function callableBodies(file: string): string[] {
  const parsed = source(file)
  const found = new Set<string>()
  const walk = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) found.add(node.name.text)
    if (ts.isVariableDeclaration(node) && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      found.add(node.name.getText(parsed))
    }
    ts.forEachChild(node, walk)
  }
  walk(parsed)
  return [...found].sort()
}

function bodyDestination(id: string, disposition: Disposition): string {
  if (disposition === 'ADAPT') {
    const contract = adaptContracts.get(id)
    if (!contract) throw new Error(`ADAPT body lacks explicit destination ${id}`)
    return contract.destination
  }
  if (disposition === 'PRESERVE-COMPARATOR') return 'current comparator only; no Law destination'
  if (disposition === 'PROVEN-UNRELATED') return 'existing dev-loader owner'
  if (disposition === 'DELETE-LATER') return 'no Law destination'
  throw new Error(`body lacks explicit destination ${id}`)
}

function bodyProof(id: string, disposition: Disposition): string {
  if (disposition === 'MOVE-VERBATIM') return 'exact AST body hash plus neutral primitive fixture in this T0 test'
  if (disposition === 'PRESERVE-COMPARATOR') return 'runtime file SHA pinned through T5; no Law copy'
  if (disposition === 'PROVEN-UNRELATED') return 'asset route has no magnetic-grid law authority'
  if (disposition === 'DELETE-LATER') return 'R14 forbidden/deletion list; provider deletion waits for T7 zero-consumer proof'
  if (disposition === 'ADAPT') {
    const contract = adaptContracts.get(id)
    if (!contract) throw new Error(`ADAPT body lacks executable fixture ${id}`)
    return contract.fixture
  }
  throw new Error(`body lacks proof ${id}`)
}

function exportedSymbols(file: string): string[] {
  const parsed = source(file)
  const out: string[] = []
  for (const node of parsed.statements) {
    if (ts.isExportDeclaration(node)) {
      out.push(`re-export:${node.moduleSpecifier?.getText(parsed) ?? node.exportClause?.getText(parsed)}`)
      continue
    }
    const exported = ts.canHaveModifiers(node)
      && Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
    if (!exported) continue
    if (ts.isFunctionDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      out.push(node.name?.getText(parsed) ?? 'default')
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) out.push(declaration.name.getText(parsed))
    }
  }
  return out.sort()
}

function topLevelSymbols(file: string): Array<{ name: string; exported: boolean; disposition: Disposition }> {
  const parsed = source(file)
  const symbols: Array<{ name: string; exported: boolean; disposition: Disposition }> = []
  const push = (name: string, exported: boolean) => {
    let disposition: Disposition | undefined
    if (file === RUNTIME_FILES[0]) {
      disposition = /^(CONTACT_TOLERANCE_MM|AUTO_FLAP_STEP_MM|SEAT_WEIGHT|FLAP_WEIGHT|BALANCE_WEIGHT|VOTING_ORDER|PHASE_STEP_MM|PHASE_STEP_FLOOR_MM|SNAP_STEP_MM|POSITIONING)$/.test(name)
        ? 'DELETE-LATER' : 'ADAPT'
    } else if (file === RUNTIME_FILES[1]) {
      disposition = bodyDispositions.get(`${file}#${name}`)
        ?? (/^(TANGENT_GUARD_MM|KEY_QUANTUM_MM|MS_CASES|EDGE_IDX|EdgeIdx)$/.test(name) ? 'DELETE-LATER' : 'ADAPT')
    } else if (file === RUNTIME_FILES[2]) {
      disposition = bodyDispositions.get(`${file}#${name}`)
        ?? (/^(ORDERS|VotingOrder)$/.test(name) ? 'DELETE-LATER' : 'ADAPT')
    } else if (file === RUNTIME_FILES[3]) {
      disposition = bodyDispositions.get(`${file}#${name}`)
        ?? (/^(QUANTUM_KEY_MM|re-export:)/.test(name) ? 'DELETE-LATER' : 'ADAPT')
    } else if (file === RUNTIME_FILES[4]) {
      disposition = bodyDispositions.get(`${file}#${name}`)
        ?? (name === 'FLATTEN_REF_MM' ? 'PRESERVE-COMPARATOR' : 'ADAPT')
    } else if (file === RUNTIME_FILES[5] || file === RUNTIME_FILES[6] || file === RUNTIME_FILES[7]) {
      disposition = 'PRESERVE-COMPARATOR'
    } else if (file === RUNTIME_FILES[8] || file === RUNTIME_FILES[9] || file === RUNTIME_FILES[10]) {
      disposition = 'PROVEN-UNRELATED'
    }
    if (!disposition) throw new Error(`unclassified top-level symbol ${file}#${name}`)
    symbols.push({ name, exported, disposition })
  }
  for (const node of parsed.statements) {
    if (ts.isExportDeclaration(node)) {
      push(`re-export:${node.moduleSpecifier?.getText(parsed) ?? node.exportClause?.getText(parsed)}`, true)
      continue
    }
    const exported = ts.canHaveModifiers(node)
      && Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
    if (ts.isFunctionDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      push(node.name?.getText(parsed) ?? 'default', exported)
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) push(declaration.name.getText(parsed), exported)
    }
  }
  return symbols.sort((a, b) => a.name.localeCompare(b.name))
}

function interfaceFields(file: string, name: string): string[] {
  const parsed = source(file)
  const declaration = parsed.statements.find((node): node is ts.InterfaceDeclaration =>
    ts.isInterfaceDeclaration(node) && node.name.text === name)
  if (!declaration) throw new Error(`missing interface ${file}#${name}`)
  return declaration.members.map((member) => member.name?.getText(parsed) ?? '').filter(Boolean)
}

function workerPostMessageShapes(file: string): { response: string[]; model: string[] } {
  const parsed = source(file)
  const response = new Set<string>()
  const model = new Set<string>()
  const propertyNames = (object: ts.ObjectLiteralExpression) => object.properties
    .map((property) => property.name?.getText(parsed) ?? '')
    .filter(Boolean)
  const walk = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'ctx.postMessage') {
      const payload = node.arguments[0]
      if (payload && ts.isObjectLiteralExpression(payload)) {
        for (const name of propertyNames(payload)) response.add(name)
        const modelProperty = payload.properties.find((property) => property.name?.getText(parsed) === 'model')
        if (modelProperty && ts.isPropertyAssignment(modelProperty) && ts.isObjectLiteralExpression(modelProperty.initializer)) {
          for (const name of propertyNames(modelProperty.initializer)) model.add(name)
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(parsed)
  return { response: [...response].sort(), model: [...model].sort() }
}

function persistedDefaultObjects(file: string): { save: string[]; reset: string[] } {
  const parsed = source(file)
  const names = (object: ts.ObjectLiteralExpression) => object.properties
    .map((property) => property.name?.getText(parsed) ?? '')
    .filter(Boolean)
  let save: string[] = []
  let reset: string[] = []
  const walk = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'd'
      && node.initializer && ts.isObjectLiteralExpression(node.initializer)) reset = names(node.initializer)
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'JSON.stringify') {
      const argument = node.arguments[0]
      if (argument && ts.isObjectLiteralExpression(argument)) save = names(argument)
    }
    ts.forEachChild(node, walk)
  }
  walk(parsed)
  if (!save.length || !reset.length) throw new Error('grid-origin.defaults save/reset object not found')
  return { save, reset }
}

function consumerLines(): Array<{ file: string; line: number; kind: 'runtime' | 'test' | 'build'; target: string; text: string }> {
  const candidates = trackedFiles('src', 'scripts', 'next.config.ts')
    .filter((file) => /\.(?:ts|tsx|js|mjs|cjs)$/.test(file))
  const rows: Array<{ file: string; line: number; kind: 'runtime' | 'test' | 'build'; target: string; text: string }> = []
  for (const file of candidates) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split('\n')
    const parsed = source(file)
    const kind = /__tests__/.test(file) ? 'test' : /next\.config|scripts\//.test(file) ? 'build' : 'runtime'
    for (const node of parsed.statements) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && /grid-origin/.test(node.moduleSpecifier.getText(parsed))) {
        rows.push({
          file,
          line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1,
          kind,
          target: node.moduleSpecifier.getText(parsed).slice(1, -1),
          text: node.getText(parsed).replace(/\s+/g, ' '),
        })
      }
    }
    if (file.endsWith('grid-origin-inventory.test.ts')) continue
    lines.forEach((text, index) => {
      const target = /new Worker\(new URL\(['"]\.\/solve\.worker\.ts/.test(text)
        ? './solve.worker.ts'
        : text.match(/\/effect-creator\/grid-origin\/asset-lib(?:\/\[file\])?/)?.[0]
      if (!target) return
      rows.push({ file, line: index + 1, kind, target, text: text.trim() })
    })
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.target.localeCompare(b.target))
}

describe('v3.5 T0 inventory is exhaustive', () => {
  it('classifies every callable body with no hidden default disposition', () => {
    const actual = RUNTIME_FILES.flatMap((file) => callableBodies(file).map((name) => `${file}#${name}`)).sort()
    const classified = [...bodyDispositions.keys()].sort()
    expect(classified).toEqual(actual)
    expect([...bodyDispositions.entries()].filter(([, disposition]) => disposition === 'ADAPT').map(([id]) => id).sort())
      .toEqual([...adaptContracts.keys()].sort())
    expect(actual.map((id) => {
      const disposition = bodyDispositions.get(id)!
      const [file, name] = id.split('#')
      return {
        id,
        disposition,
        destination: bodyDestination(id, disposition),
        proof: bodyProof(id, disposition),
        functionTextSha256: disposition === 'MOVE-VERBATIM'
          ? canonicalCallableBodySha256(join(ROOT, file), name)
          : null,
      }
    })).toMatchSnapshot()
  })

  it('characterizes numeric donor behavior without certifying it as final MOVE', () => {
    expect([...bodyDispositions.values()].filter((disposition) => disposition === 'MOVE-VERBATIM')).toEqual([])
    expect(bbox([[3, -2], [-4, 8], [1, 5]])).toEqual({ minX: -4, minY: -2, maxX: 3, maxY: 8 })
    expect(latticeAt({ minX: 0, minY: 0, maxX: 48, maxY: 48 }, 48, 24, 24)).toEqual([[24, 24]])
    expect(centroidOf([[0, 0], [6, 0], [0, 6]])).toEqual([2, 2])
    expect(scaleContour({ outer: { pts: [[0, 0], [1, 0], [1, 0.5]] }, holes: [] }, 96))
      .toEqual({ outer: { pts: [[0, 0], [96, 0], [96, 48]] }, holes: [] })
    expect(scaleContour({ outer: { pts: [[0, 0], [1, 0], [1, 1]] }, holes: [{ pts: [[0.2, 0.2], [0.3, 0.2], [0.2, 0.3]] }] }, 96).holes)
      .toEqual([])
  })

  it('classifies every top-level symbol and records every public export and re-export', () => {
    const inventory = RUNTIME_FILES.map((file) => ({
      file,
      symbols: topLevelSymbols(file),
      publicExportsAndReexports: exportedSymbols(file),
    }))
    expect(inventory).toMatchSnapshot()
  })

  it('records every runtime, test and build consumer', () => {
    expect(consumerLines()).toMatchSnapshot()
  })

  it('records every persisted key, worker envelope field and cache shape', () => {
    const page = readFileSync(join(ROOT, RUNTIME_FILES[6]), 'utf8')
    const persistedKeys = [...page.matchAll(/usePersisted\('([^']+)'/g)].map((match) => `grid-origin.${match[1]}`).sort()
    persistedKeys.push('grid-origin.defaults')
    const persistedDefaults = persistedDefaultObjects(RUNTIME_FILES[6])
    expect(persistedDefaults.save).toEqual(persistedDefaults.reset)
    const workerState = {
      request: ['id', 'base', 'offsetMM', 'cfg', 'mode', 'sizeMM', 'snapStep', 'stepSel', 'autoFlapMaxMM'],
      response: ['id', 'model', 'error'],
      model: ['contour', 'grid', 'effSize', 'ladder', 'idx', 'segments', 'autoFlapMM'],
      caches: {
        freeCache: 'Map<cfgSig|sizeMM,{contour,grid}>; cap=400',
        walkCaches: 'Map<cfgSig,Map<sizeMM,GridResult>>; cap=10',
        walkFits: 'Map<[cfgSig,bandId,snapStep,autoFlapMaxMM],{fit,autoFlapMM}>; cap=12',
        invalidation: 'shapeSig change clears all three caches',
      },
      queue: 'one in-flight plus latest queued request; stale response rejected by request id',
    }
    const workerSource = readFileSync(join(ROOT, RUNTIME_FILES[5]), 'utf8')
    const postMessageShapes = workerPostMessageShapes(RUNTIME_FILES[5])
    expect(interfaceFields(RUNTIME_FILES[5], 'SolveRequest')).toEqual(workerState.request)
    expect(postMessageShapes.response).toEqual([...workerState.response].sort())
    expect(postMessageShapes.model).toEqual([...workerState.model].sort())
    expect(workerSource).toContain('const freeCache = new Map<string, { contour: Contour; grid: GridResult }>()')
    expect(workerSource).toContain('const walkCaches = new Map<string, Map<number, GridResult>>()')
    expect(workerSource).toContain("const walkFits = new Map<string, { fit: ReturnType<typeof fitSizeInBand>; autoFlapMM: number | null }>()")
    expect(workerSource).toContain('const FREE_CAP = 400')
    expect(workerSource).toContain('const WALK_CAP = 10')
    expect(workerSource).toContain('const FITS_CAP = 12')
    expect({ persistedKeys: persistedKeys.sort(), persistedDefaultFields: persistedDefaults.save, workerState }).toMatchSnapshot()
  })

  it('records every grid-origin and active grid-engine artifact with owner and destination', () => {
    expect(existsSync(join(ROOT, 'src/lib/effect/__tests__/grid-origin-t0-inventory.test.ts'))).toBe(false)
    expect(existsSync(join(ROOT, 'src/lib/effect/__tests__/__snapshots__/grid-origin-t0-inventory.test.ts.snap'))).toBe(false)
    const originArtifacts = trackedFiles('src/lib/effect/grid-origin*', 'src/lib/effect/__tests__/grid-origin*', 'src/lib/effect/__tests__/__snapshots__/grid-origin*', 'src/app/(dev)/effect-creator/grid-origin', 'next.config.ts')
      .map((file) => ({
        file,
        sha256: /grid-origin-inventory\.test\.ts(?:\.snap)?$/.test(file) ? 'SELF-MANIFEST' : sha256(readFileSync(join(ROOT, file))),
        disposition: /asset-lib|next\.config/.test(file)
          ? 'PROVEN-UNRELATED'
          : /__tests__/.test(file)
            ? 'KEEP-FLAGGED-THROUGH-T5-THEN-MIGRATE-OR-DELETE'
            : 'MIGRATE-CONSUMER-THEN-DELETE',
        owner: 'session62-task/grid-v3.5',
        destination: /asset-lib|next\.config/.test(file)
          ? 'existing dev-loader owner'
          : /grid-origin-(?:centre-baseline|inventory)\.test/.test(file)
            ? 'T0 characterization/proof owner'
            : 'src/lib/magnetic-grid or magnetic-grid bridge',
        generatedSourceOwner: /__snapshots__/.test(file) ? file.replace('/__snapshots__/', '/').replace('.snap', '') : 'hand-authored tracked source',
        deletionProof: /asset-lib|next\.config/.test(file)
          ? 'not a magnetic-grid authority; retained under the existing dev-loader owner'
          : /__tests__/.test(file)
            ? 'NOT YET PROVEN: retained through T5; T7/T8 must migrate to canonical tests or delete, then prove zero old-provider consumers'
            : 'NOT YET PROVEN: T7 requires migrated consumers plus a zero-consumer trace',
      }))
    const activeLaneArtifacts = trackedFiles('src/lib/grid-engine')
      .map((file) => ({
        file,
        sha256: sha256(readFileSync(join(ROOT, file))),
        disposition: 'MIGRATE-CONSUMER-THEN-DELETE-AFTER-DAN-LANE-GATE',
        owner: ACTIVE_LANE,
        destination: 'neutral kernel body to src/lib/magnetic-grid; unrelated primitive to true owner; no second grid authority',
        generatedSourceOwner: /\/dist\//.test(file)
          ? file.replace('/dist/', '/src/').replace(/\.d\.ts$|\.js$/, '.ts')
          : /SHA256SUMS|fixtures\/manifest\.json/.test(file)
            ? 'sibling package generation script'
            : 'hand-authored tracked source or declared fixture',
        deletionProof: 'NOT YET PROVEN: blocked on Dan lane-precedence ruling and post-migration zero-consumer trace',
      }))
    const activeLaneConsumers = trackedFiles('src')
      .filter((file) => /\.(?:ts|tsx)$/.test(file) && !file.startsWith('src/lib/grid-engine/'))
      .flatMap((file) => readFileSync(join(ROOT, file), 'utf8').split('\n')
        .map((text, index) => ({ file, line: index + 1, text: text.trim() }))
        .filter(({ text }) => /@\/lib\/grid-engine|\.\.\/grid-engine|\.\/grid-engine/.test(text)))
    expect({ originArtifacts, activeLaneArtifacts, activeLaneConsumers }).toMatchSnapshot()
  })
})
