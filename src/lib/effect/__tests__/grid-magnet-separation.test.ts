// The separation is enforced here, not remembered. Cloned from the scaffold's guard
// (src/lib/grid-engine/__tests__/separation.test.ts) and installed for the grid-magnet module.
//
// Invariants:
//   1. the module is portable — no React/Next/stylesheet anywhere in it
//   2. traffic is one-way: page → engine door / spec / ui-bridge; modules never reach back
//   3. SPEC holds values only; LOGIC holds no geometry; the page computes nothing
//   4. no surface restates a released value as a bare literal
//   5. the solve is deterministic — same inputs, same layout, whatever mode asked

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { bandOuterMM, classifyBands, computeGrid } from '../grid-magnet'
import { canonLayoutForFrame, optimalLayoutForBox } from '../grid-magnet-library-catalogue'
import { solveCanonExperiment } from '../grid-magnet-canon-experiment'
import { frameOfMasses, positionsAcross } from '../units/classifier'
import type { BBox, SafeMass, SafeSegment } from '../types'
import { BANDS, BAND_STEP_MM } from '../grid-magnet-spec'
import { scaleContour } from '../grid-magnet-compute'
import { applyCoverage, enumerateCanonPhaseWindows, enumerateFreePhaseMax, fallbackRevealSizes, makeCircleSeatPredicate, makeContourSeatPredicate } from '../units/layout'
import { wrapGroup } from '../units/wrap'
import { wrapBandLadder } from '../grid-magnet-wrap-compute'
import { contourCentroidOf } from '../units/centring'
import { holdingFactsOf, rankByHolding, sparseExtremeHold } from '../units/judge'
import { safeSegments } from '../units/segment'
import { edgeDistToContourMM, pointInContour } from '../foundation/geometry'
import { contourCacheKey, makeSizer, normBaseContour, normMaskContour } from '../grid-magnet-bridge'
import { getShape } from '@/lib/shape-library'
import type { Contour, GridConfig, Pt } from '../types'

const LIB = join(process.cwd(), 'src/lib/effect')
const PAGE = join(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/page.tsx')
const nodeRequire = createRequire(import.meta.url)

// DERIVED, never hand-listed: the previous five-name list omitted wrap-compute, class and the
// worker — and wrap-compute imports four units and sequences them, invisibly.
const MODULE_FILES = readdirSync(LIB)
  .filter((f) => /^grid-magnet.*\.ts$/.test(f) && !f.endsWith('.d.ts'))
  .sort()

const readModule = () =>
  MODULE_FILES.map((f) => ({ file: f, text: readFileSync(join(LIB, f), 'utf8') }))
const pageText = () => readFileSync(PAGE, 'utf8')

const walkAst = (src: string, visit: (n: ts.Node) => void) => {
  const parsed = ts.createSourceFile('x.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const go = (n: ts.Node) => {
    visit(n)
    ts.forEachChild(n, go)
  }
  go(parsed)
}

const importsOf = (text: string): string[] =>
  [...text.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1])

/** EVERY module reference an AST can carry — plain and side-effect imports, re-exports with a
 *  specifier, dynamic import() and require(). The regex scanner missed side-effect imports and
 *  dynamic forms, which is how four separate mutations stayed green. */
const moduleRefsOf = (text: string): string[] => {
  const out: string[] = []
  walkAst(text, (n) => {
    if (ts.isImportDeclaration(n) || (ts.isExportDeclaration(n) && n.moduleSpecifier)) {
      const m = (n as { moduleSpecifier?: ts.Expression }).moduleSpecifier
      if (m) out.push(m.getText().slice(1, -1))
    }
    if (ts.isCallExpression(n)) {
      const fn = n.expression.getText()
      if ((fn === 'require' || n.expression.kind === ts.SyntaxKind.ImportKeyword) && n.arguments[0]
          && ts.isStringLiteral(n.arguments[0])) out.push(n.arguments[0].text)
    }
  })
  return out
}

/** IMPORT declarations only — a `export … from './units/x'` re-export shim is NOT an import, and
 *  conflating the two is what let the migration seam look like a dependency. Re-exports are
 *  governed separately in zone 2b, where they belong. */
const importDeclsOf = (text: string): string[] => {
  const out: string[] = []
  walkAst(text, (n) => {
    if (ts.isImportDeclaration(n)) out.push(n.moduleSpecifier.getText().slice(1, -1))
  })
  return out
}

/** Released surface values, read out of the spec's own declarations — never hand-listed. */
/** SEMANTIC guard, replacing the numeric-literal scan. A number scan cannot prove domain
 *  ownership: it fired on the page's `11 * spanMM` font arithmetic because 11 became a released
 *  value (the board's rows), and it was silent about a law restated under a different number.
 *  What the law actually requires is that the page consumes spec values through IMPORTS — so that
 *  is what is asserted: every released control bound the page renders resolves to an identifier
 *  imported from the spec, never a literal. */
const specImportsOnPage = () => {
  const names = new Set<string>()
  walkAst(pageText(), (n) => {
    if (ts.isImportDeclaration(n) && /grid-magnet-spec/.test(n.moduleSpecifier.getText())
      && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings))
      for (const el of n.importClause.namedBindings.elements) names.add(el.name.text)
  })
  return names
}

describe('1 — the module is portable', () => {
  it('imports nothing from React, Next or a stylesheet', () => {
    for (const { file, text } of readModule()) {
      const hits = importsOf(text).filter((i) => /^react$|^next(\/|$)|\.css$/.test(i))
      expect(hits, `${file} depends on a framework: ${hits.join(' · ')}`).toEqual([])
    }
  })
})

describe('2 — traffic is one-way', () => {
  const ALLOWED: Record<string, RegExp[]> = {
    'grid-magnet-spec.ts': [],
    'grid-magnet-compute.ts': [/^\.\/types$/, /^\.\/attachment$/, /^\.\/grid-magnet-spec$/, /^@\/lib\/grid-engine\/compute\/geometry$/, /^\.\/foundation\/[a-z-]+$/],
    'grid-magnet-logic.ts': [/^\.\/types$/, /^\.\/grid-magnet-spec$/, /^\.\/grid-magnet-compute$/, /^\.\/foundation\/[a-z-]+$/],
    // grid-magnet.ts is the TEMPORARY PIPELINE seat until pipeline/ lands (S3): it sequences
    // segment -> centring -> layout and shapes the result. Sequencing units is what a pipeline
    // does, so this is the one file that may import them — and the unit zone still forbids any
    // unit from importing back.
    //
    // ONE EDGE ADDED 2026-08-30: the catalogue adapter. Dan: "we need the channel that we use
    // between catalogue and classifier". Classifying a band and then asking the library what
    // belongs on that frame is one sequence, and sequencing is this seat's job. The edge is to the
    // ADAPTER, never to library/** directly — that boundary is unchanged.
    'grid-magnet.ts': [/^\.\/types$/, /^\.\/grid-magnet-spec$/, /^\.\/grid-magnet-compute$/, /^\.\/grid-magnet-logic$/, /^\.\/grid-magnet-library-catalogue$/, /^\.\/foundation\/[a-z-]+$/, /^\.\/units\/[a-z-]+$/],
    // The two SEQUENCER SEATS may import units (sequencing them is what a pipeline does); both
    // hand over to pipeline/ at S3. Every other retiring file re-exports only.
    'grid-magnet-wrap-compute.ts': [/^\.\/types$/, /^\.\/grid-magnet-spec$/, /^\.\/grid-magnet$/, /^\.\/offset$/, /^\.\/foundation\/[a-z-]+$/, /^\.\/units\/[a-z-]+$/, /^@countertype\/clipper2-ts$/],
    'grid-magnet-canon-experiment.ts': [/^\.\/types$/, /^\.\/grid-magnet-spec$/, /^\.\/grid-magnet$/, /^\.\/grid-magnet-wrap-compute$/, /^\.\/foundation\/[a-z-]+$/, /^\.\/units\/[a-z-]+$/],
    'grid-magnet-class.ts': [/^\.\/types$/, /^\.\/grid-magnet-spec$/, /^\.\/foundation\/[a-z-]+$/, /^\.\/units\/[a-z-]+$/],
    'grid-magnet-library-bridge.ts': [/^\.\/types$/, /^\.\/grid-magnet[a-z-]*$/, /^\.\/library[/a-z-]*$/, /^\.\/foundation\/[a-z-]+$/],
    'grid-magnet-library-catalogue.ts': [/^\.\/types$/, /^\.\/grid-magnet[a-z-]*$/, /^\.\/library[/a-z-]*$/],
    'grid-magnet-bridge.ts': [/^\.\/types$/, /^\.\/geometry-truth$/, /^\.\/contour$/, /^\.\/offset$/, /^\.\/grid-magnet$/, /^\.\/grid-magnet-compute$/, /^@\/lib\/vector-core$/],
  }

  it('every module file imports only from its allow-list', () => {
    for (const { file, text } of readModule()) {
      const allowed = ALLOWED[file]
      // A derived file with no allow-list is UNGOVERNED — fail loudly rather than skip it. That is
      // how wrap-compute sequenced four units invisibly under the old hand-listed set.
      expect(allowed, `${file} is in the cluster but has no allow-list entry — govern it`).toBeDefined()
      const bad = importDeclsOf(text).filter((i) => !allowed!.some((rx) => rx.test(i)))
      expect(bad, `${file} imports outside its allow-list: ${bad.join(', ')}`).toEqual([])
    }
  })

  it('the page reaches the module only through the engine door, the spec and the ui-bridge', () => {
    const reaches = importsOf(pageText()).filter((i) => /grid-magnet/.test(i))
    const bad = reaches.filter((i) => !/grid-magnet(-spec|-bridge|-library-bridge)?$/.test(i))
    expect(bad, `page reaches into the module's internals: ${bad.join(', ')}`).toEqual([])
  })

  it('the module never imports from the app', () => {
    for (const { file, text } of readModule()) {
      expect(text, `${file} must not import from the app`).not.toMatch(/from ['"]@\/app\//)
    }
  })
})

/**
 * THE UNIT ZONE — derived from the filesystem, never hand-listed. The previous version read five
 * legacy files by name, so a new unit was invisible to it: a direct unit->unit import passed 12/12,
 * and so did policy pulled back into compute. Both mutations are reproduced below.
 */
const UNITS_DIR = join(LIB, 'units')
const unitFiles = (): string[] =>
  existsSync(UNITS_DIR) ? readdirSync(UNITS_DIR).filter((f) => f.endsWith('.ts')) : []

/** A unit may reach shared vocabulary, spec and foundation. Never another unit, never a legacy
 *  aggregate, never the app, never a framework. */
const UNIT_ALLOWED = [
  /^\.\.\/types$/, /^\.\.\/grid-magnet-spec$/, /^\.\.\/foundation\/[a-z-]+$/,
  /^\.\.\/offset$/, /^\.\.\/geometry-truth$/,          // repo-wide primitives, not engine-owned
  /^@countertype\/clipper2-ts$/,                        // the geometry library itself
]

describe('2b — the units are self-sufficient', () => {
  // The repo-wide exact-arithmetic kernel is pinned to LAYOUT ONLY — it backs the seat predicate's
  // exact tangency test. Pinning beats widening the global list: another unit reaching for it fails.
  const EXTERNAL_KERNEL_EDGE: Record<string, readonly string[]> = {
    'layout.ts': ['@/lib/grid-engine/compute/geometry'],
  }

  it('every unit file imports only shared vocabulary, spec, foundation or its pinned kernel edge', () => {
    for (const f of unitFiles()) {
      const pinned = EXTERNAL_KERNEL_EDGE[f] ?? []
      const bad = moduleRefsOf(readFileSync(join(UNITS_DIR, f), 'utf8'))
        .filter((i) => !UNIT_ALLOWED.some((rx) => rx.test(i)) && !pinned.includes(i))
      expect(bad, `units/${f} reaches outside its allow-list: ${bad.join(' · ')}`).toEqual([])
    }
  })

  it('foundation exposes exactly the measurement primitives — nothing that decides', () => {
    const text = readFileSync(join(LIB, 'foundation/geometry.ts'), 'utf8')
    const names: string[] = []
    walkAst(text, (n) => {
      if (ts.isFunctionDeclaration(n) && n.name
          && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) names.push(n.name.text)
    })
    expect(names.sort(), 'the foundation export set is pinned: placement policy lives in its unit')
      .toEqual(['bbox', 'edgeDistMM', 'edgeDistToContourMM', 'pointInContour', 'pointInOuter'])
  })

  it('no unit imports another unit', () => {
    for (const f of unitFiles()) {
      const bad = moduleRefsOf(readFileSync(join(UNITS_DIR, f), 'utf8')).filter((i) => /^\.\/[a-z-]+$/.test(i))
      expect(bad, `units/${f} imports another unit: ${bad.join(' · ')}`).toEqual([])
    }
  })

  it('no unit reaches back into a retiring aggregate or the app', () => {
    for (const f of unitFiles()) {
      const text = readFileSync(join(UNITS_DIR, f), 'utf8')
      const bad = moduleRefsOf(text).filter((i) => /grid-magnet-(compute|logic|class|bridge)$|^@\/app\//.test(i))
      expect(bad, `units/${f} reaches up to ${bad.join(' · ')}`).toEqual([])
      expect(text, `units/${f} depends on a framework`).not.toMatch(/from ['"]react['"]|from ['"]next|\.css['"]/)
    }
  })

  it('only the two named sequencer seats hold unit edges, and exactly the pinned ones', () => {
    const TEMPORARY_UNIT_EDGES: Record<string, readonly string[]> = {
      'grid-magnet.ts': ['./units/centring', './units/classifier', './units/layout', './units/segment'],
      // + './units/classifier' (2026-08-30): the sequencer shapes the DISPLAY result, and that
      // result now carries the legal box so the canvas draws the same ruler the classifier
      // measures instead of deriving one from the 2mm segmentation islands. A measured value
      // travelling with the result is sequencing, not policy — but it is a new unit edge, so it
      // is pinned deliberately rather than arriving as a side effect.
      'grid-magnet-wrap-compute.ts': ['./units/centring', './units/classifier', './units/judge', './units/layout', './units/segment', './units/wrap'],
      'grid-magnet-canon-experiment.ts': ['./units/judge', './units/layout', './units/wrap'],
      'grid-magnet-class.ts': ['./units/classifier'],
      'grid-magnet-compute.ts': ['./units/centring', './units/layout', './units/segment'],
      'grid-magnet-logic.ts': ['./units/centring', './units/layout'],
    }
    for (const { file, text } of readModule()) {
      const edges = [...new Set(moduleRefsOf(text).filter((i) => /^\.\/units\//.test(i)))].sort()
      const pinned = [...(TEMPORARY_UNIT_EDGES[file] ?? [])].sort()
      expect(edges, `${file}: unit edges must equal the pinned set exactly`).toEqual(pinned)
    }
  })

  it('a legacy file may only REACH a unit through a re-export, never an import', () => {
    for (const { file, text } of readModule()) {
      // The two SEQUENCER SEATS may import units, because sequencing them is what a pipeline does.
      // Every other retiring file may only re-export. Both seats hand over at S3.
      if (file === 'grid-magnet.ts' || file === 'grid-magnet-wrap-compute.ts'
        || file === 'grid-magnet-canon-experiment.ts') continue
      const bad: string[] = []
      walkAst(text, (n) => {
        if (!ts.isImportDeclaration(n)) return
        const spec = n.moduleSpecifier.getText().slice(1, -1)
        if (/^\.\/units\//.test(spec)) bad.push(spec)
      })
      expect(bad, `${file} IMPORTS a unit (only \`export … from './units/x'\` is the shim): ${bad.join(' · ')}`).toEqual([])
    }
  })
})

describe('2c — the foundation holds primitives only', () => {
  const FOUNDATION = join(LIB, 'foundation')
  const foundationFiles = (): string[] =>
    existsSync(FOUNDATION) ? readdirSync(FOUNDATION).filter((f) => f.endsWith('.ts')) : []
  const FOUNDATION_ALLOWED = [/^\.\.\/types$/, /^\.\.\/grid-magnet-spec$/, /^@\/lib\/grid-engine\/compute\/geometry$/]

  it('imports nothing but shared types, spec and the repo-wide geometry kernel', () => {
    for (const f of foundationFiles()) {
      const bad = moduleRefsOf(readFileSync(join(FOUNDATION, f), 'utf8'))
        .filter((i) => !FOUNDATION_ALLOWED.some((rx) => rx.test(i)))
      expect(bad, `foundation/${f} reaches outside its allow-list: ${bad.join(' · ')}`).toEqual([])
    }
  })

  it('holds no policy — no ranking, no ordering, no preference', () => {
    for (const f of foundationFiles()) {
      const text = readFileSync(join(FOUNDATION, f), 'utf8')
      const hits: string[] = []
      walkAst(text, (n) => {
        if (ts.isCallExpression(n) && /\.sort$/.test(n.expression.getText())) hits.push('sort()')
        if (ts.isFunctionDeclaration(n) && n.name && /^(rank|score|prefer|best|choose|pick|order)/i.test(n.name.text))
          hits.push(n.name.text)
        // Arrow and function-expression policy hides from a FunctionDeclaration-only check — QA
        // added `export const chooseBest = (a, b) => ...` and it passed. Secondary tripwire only:
        // the pinned export set above is what actually closes this.
        if (ts.isVariableDeclaration(n) && n.initializer
            && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
            && /^(rank|score|prefer|best|choose|pick|order)/i.test(n.name.getText())) hits.push(n.name.getText())
      })
      expect(hits, `foundation/${f} contains policy: ${hits.join(' · ')}`).toEqual([])
    }
  })

  it('never reaches a unit or a retiring aggregate', () => {
    for (const f of foundationFiles()) {
      const bad = moduleRefsOf(readFileSync(join(FOUNDATION, f), 'utf8'))
        .filter((i) => /\/units\/|grid-magnet-(compute|logic|class|bridge)$/.test(i))
      expect(bad, `foundation/${f} depends on something above it: ${bad.join(' · ')}`).toEqual([])
    }
  })
})

describe('2d — the real shells are governed too', () => {
  const PAGE = join(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/page.tsx')
  const WORKER = join(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/solve.worker.ts')
  // The page reaches NO unit. The worker holds one temporary edge — judge's default landing — which
  // expires when the pipeline lands. Pinned exactly, so a stray import fails even where edges exist.
  const SHELL_UNIT_EDGES: Array<[string, readonly string[]]> = [
    [PAGE, []],
    [WORKER, ['@/lib/effect/units/classifier', '@/lib/effect/units/judge', '@/lib/effect/units/centring']],
  ]

  it('the page and worker hold exactly their pinned unit edges', () => {
    for (const [file, pinned] of SHELL_UNIT_EDGES) {
      const edges = [...new Set(moduleRefsOf(readFileSync(file, 'utf8')).filter((i) => /\/units\//.test(i)))].sort()
      expect(edges, `${file.split('/').pop()} unit edges must equal the pinned set`).toEqual([...pinned].sort())
    }
  })

  it('neither shell reaches a unit through a side-effect or dynamic import', () => {
    for (const [file, pinned] of SHELL_UNIT_EDGES) {
      const refs = moduleRefsOf(readFileSync(file, 'utf8')).filter((i) => /\/units\/|\/foundation\//.test(i))
      const bad = refs.filter((i) => !pinned.includes(i))
      expect(bad, `${file.split('/').pop()} reaches ${bad.join(' · ')}`).toEqual([])
    }
  })
})

describe('3 — each sub holds only its own kind', () => {
  it('every 48mm is a new band — the table follows the repeat with no gap and no overlap', () => {
    // Dan, 2026-08-29: "every 48mm is new band if you didnt guess". Spec may not compute, so the
    // table is written out; this is what stops it drifting off the rule. The hand-written five
    // stopped at 264 and made every larger layout homeless.
    // Bands are LEGAL-AREA ranges, so the first one starts at zero: a single magnet's legal extent
    // is a point. The outline size that band corresponds to is the shape's own business.
    expect(BANDS[0].minMM).toBe(0)
    BANDS.forEach((b, i) => {
      expect(b.id, 'band ids run 1..n in order').toBe(i + 1)
      expect(b.minMM, `B${b.id} starts one step past B${i}`).toBe(i * BAND_STEP_MM)
      expect(b.maxMM - b.minMM, `B${b.id} spans one step`).toBe(BAND_STEP_MM - 1)
      if (i) expect(b.minMM, `B${b.id} starts where B${i} ended`).toBe(BANDS[i - 1].maxMM + 1)
    })
  })

  it('SPEC declares values only — no functions, no arithmetic', () => {
    const src = readFileSync(join(LIB, 'grid-magnet-spec.ts'), 'utf8')
    const hits: string[] = []
    walkAst(src, (n) => {
      if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
        hits.push(n.getText().slice(0, 40))
      }
      if (ts.isBinaryExpression(n) && /[-+*/%]/.test(n.operatorToken.getText())) {
        hits.push(n.getText().slice(0, 40))
      }
    })
    expect(hits, `spec computes: ${hits.join(' · ')}`).toEqual([])
  })

  it('LOGIC does no geometry of its own', () => {
    const src = readFileSync(join(LIB, 'grid-magnet-logic.ts'), 'utf8')
    expect(src).not.toMatch(/Math\.(hypot|sqrt|atan2|sin|cos)|prepare\s*\(|holds\s*\(|insetRingMM|pointInPolygon/)
  })

  it('the page computes no geometry — it asks', () => {
    expect(pageText()).not.toMatch(/insetRingMM|pointInPolygon|latticeAt\s*\(|latticeOver\s*\(|holds\s*\(|prepare\s*\(|makeSeatPredicate/)
  })
})

describe('4 — no surface restates a released value', () => {
  it('the page consumes the released laws through spec imports', () => {
    const imported = specImportsOnPage()
    // the laws the page renders controls for: rim, its slider bounds, the pitches, the bands,
    // the mass-depth family. Each must arrive as an import — restating one as a literal is how
    // a law and a control drift apart.
    for (const name of ['RELEASED_PADDING_MM', 'PADDING_FLOOR_MM', 'PADDING_CEIL_MM',
      'RELEASED_PITCHES_MM', 'BANDS'])
      expect(imported.has(name), name + ' imported by the page').toBe(true)
    // and the retired controls stay dead: no revival under a spec import. Mass depth joined them
    // on 2026-08-30 — a probe 4mm past the legal area cost the classifier a whole magnet position
    // and moved with a centring dial, so the number and its control are gone, not defaulted.
    for (const dead of ['SNAP_STEP_MM', 'phaseStep', 'positioning',
      'MASS_DEPTH_MM', 'MASS_DEPTH_FLOOR_MM', 'MASS_DEPTH_CEIL_MM', 'massDepth'])
      expect(pageText().includes(dead), dead + ' must stay retired').toBe(false)
  })

  it('the rendered pitch choices come from the Spec binding, not a literal beside its import', () => {
    // QA's counterexample: keep the RELEASED_PITCHES_MM import but render a hardcoded pitch array
    // — the import-presence check above stays green while the page shows an incomplete released
    // list. The binding itself is what the law requires, so the binding is what is asserted.
    const bindsSpec = (text: string) => {
      let found = false
      walkAst(text, (node) => {
        if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
        if (node.expression.name.text !== 'map') return
        if (node.expression.expression.getText() === 'RELEASED_PITCHES_MM') found = true
      })
      return found
    }
    expect(bindsSpec(pageText()), 'Grid pitch must map RELEASED_PITCHES_MM from Spec').toBe(true)
    // and the exact mutation dies: the import kept, the rendered list hardcoded
    const mutated = pageText().replace(/RELEASED_PITCHES_MM\.map\(/, "[{ mm: 24, label: '24 mm' }].map(")
    expect(mutated).not.toBe(pageText())
    expect(bindsSpec(mutated), 'the hardcoded-list mutation must be caught').toBe(false)
  })

  it('compute, logic and the bridges import their values instead of restating them', () => {
    // semantic, not numeric: every module that consumes a released law imports it from spec.
    // A module restating a law under its own literal is the drift the old number-scan tried to
    // catch and could not prove; an import is checkable and cannot silently diverge.
    for (const { file, text } of readModule()) {
      if (file === 'grid-magnet-spec.ts') continue
      const usesLaw = /PADDING|BANDS|PITCH|MASS_DEPTH|FIELD_|BOARD_/.test(text)
      if (usesLaw) expect(/from '\.\/grid-magnet-spec'/.test(text), file + ' imports its laws from spec').toBe(true)
    }
  })
})

describe('4b — the law sliders take their bounds from spec, never literals', () => {
  it('the padding slider takes its bounds from spec, never a literal', () => {
    expect(pageText()).toMatch(/label="Magnet padding[^/]*min=\{PADDING_FLOOR_MM\}/)
  })

  it('the dead Snap step control is gone from the shell', () => {
    // Its engine path went with the rigid walk. A control that changes nothing is worse than a
    // missing one: it tells the operator a dial exists that the engine no longer reads.
    expect(pageText(), 'Snap step is still rendered').not.toMatch(/label="Snap step"/)
    expect(pageText(), 'Snap step state survives').not.toMatch(/\bsnapStep\b/)
  })
})

describe('5 — the solve is one pure function', () => {
  const square = (mm: number): Contour => ({
    outer: { pts: [[-mm / 2, -mm / 2], [mm / 2, -mm / 2], [mm / 2, mm / 2], [-mm / 2, mm / 2]] as Pt[] },
    holes: [],
  })

  it('same shape, same size, same values — same layout, every call', () => {
    const a = computeGrid(square(72), { paddingMM: 12 })
    const b = computeGrid(square(72), { paddingMM: 12 })
    expect(JSON.stringify(a.anchors)).toBe(JSON.stringify(b.anchors))
    expect(a.phaseMM).toEqual(b.phaseMM)
  })

  it('the square standard answers: 24 → 1 · 72 → 2×2 · 120 → 3×3 (belt keeps 8)', () => {
    expect(computeGrid(square(24), { paddingMM: 12 }).anchors.length).toBe(1)
    expect(computeGrid(square(72), { paddingMM: 12 }).anchors.length).toBe(4)
    expect(computeGrid(square(120), { paddingMM: 12 }).anchors.length).toBe(8)
  })
})

describe('5b — both seat predicates decide on the same micron', () => {
  // The polygon test and the analytic-circle test promise the SAME boundary semantics: tangency
  // passes by equality. They can only keep that promise if they round identically, and the quantum
  // used to be declared privately inside each of them — two numbers nothing compared. This asserts
  // the SHARED BEHAVIOUR, not the spelling: a source-text check would pass on two copies that agree
  // today and drift tomorrow.
  const Q = 0.001
  const R = 12

  it('the polygon predicate takes a magnet exactly on the line and refuses it one micron past', () => {
    const box: Pt[] = [[0, 0], [200, 0], [200, 200], [0, 200]]
    const fits = makeContourSeatPredicate({ outer: { pts: box }, holes: [] }, R)!
    expect(fits([R, 100]), 'a centre exactly one radius from the edge is legal').toBe(true)
    expect(fits([R - Q, 100]), 'one micron closer to the edge is not').toBe(false)
  })

  it('the circle predicate takes a magnet exactly on the line and refuses it one micron past', () => {
    const RADIUS = 100
    const fits = makeCircleSeatPredicate(100, 100, RADIUS, R)!
    expect(fits([100 + (RADIUS - R), 100]), 'a centre exactly tangent inside is legal').toBe(true)
    expect(fits([100 + (RADIUS - R) + Q, 100]), 'one micron further out is not').toBe(false)
  })
})

describe('6 — a supplied hole is material boundary, not decoration', () => {
  const ring = (cx: number, cy: number, r: number, n = 64): Pt[] =>
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2
      return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as Pt
    })
  const donut = (s: number): Contour =>
    ({ outer: { pts: [[0, 0], [s, 0], [s, s], [0, s]] as Pt[] }, holes: [{ pts: ring(s / 2, s / 2, (s * 60) / 192) }] })

  it('scaling carries every ring — a scaled donut still has its hole', () => {
    expect(scaleContour(donut(192), 0.5).holes.length).toBe(1)
  })

  it('the contour seat predicate refuses the hole centre', () => {
    const fits = makeContourSeatPredicate(donut(192), 12)!
    expect(fits([96, 96]), 'a magnet centre inside a supplied hole must be illegal').toBe(false)
  })

  it('no seated magnet lands inside a supplied hole', () => {
    const g = computeGrid(donut(192), { paddingMM: 12, pitchMM: 48 })
    const inHole = g.anchors.filter((a) => Math.hypot(a.p[0] - 96, a.p[1] - 96) < 60 - 12)
    expect(inHole.map((a) => a.p), 'magnets seated inside the hole').toEqual([])
    expect(g.anchors.length).toBeGreaterThan(0)
  })

  it('an OFF-CENTRE hole moves the material centroid and clears the legal area', () => {
    // A centred hole hides both defects: the centroid does not move and no segment centre lands in
    // it. That is why the first four tests passed while segmentation and the weight centre were
    // still hole-blind.
    const off: Contour = { outer: { pts: [[0, 0], [192, 0], [192, 192], [0, 192]] as Pt[] }, holes: [{ pts: ring(72, 96, 48) }] }
    expect(contourCentroidOf(off)[0], 'the hole sits left, so the material centre must move right').toBeGreaterThan(100)
    const inHole = safeSegments(off, 12, 'full')
      .filter((sg) => Math.hypot(sg.centreMM[0] - 72, sg.centreMM[1] - 96) < 48 - 12)
    expect(inHole.map((sg) => sg.centreMM), 'a legal-area centre inside a hole').toEqual([])
  })

  it('a nonzero outline offset moves outer and hole boundaries by that offset only', () => {
    // The previous version fed donut(192) into a sizer whose input contract is NORMALIZED to 1mm,
    // then asserted only holes.length. It could not see the operand: the code offset each hole by
    // the whole product SIZE instead of the offset, which deleted every hole at every real size.
    const sized = makeSizer(donut(1), 5)(192)
    const width = (pts: ReadonlyArray<Pt>) => {
      const xs = pts.map((p) => p[0])
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(sized.holes, 'a nonzero offset deleted the hole').toHaveLength(1)
    expect(width(sized.outer.pts), 'the outline must grow by the offset on both sides').toBeCloseTo(202, 1)
    expect(width(sized.holes[0].pts), 'the hole must shrink by the offset on both sides').toBeCloseTo(110, 1)
  })

  it('cache identity is the shape itself — hole position, hole size, ring order and offset all count', () => {
    // The previous version grepped the worker's source. QA emptied the hashing function's body and
    // it stayed green, and a 32-bit rolling hash cannot carry "full-content identity" anyway.
    const square: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]]
    const a: Contour = { outer: { pts: square }, holes: [{ pts: ring(0.4, 0.5, 0.2) }] }
    const same: Contour = { outer: { pts: [...square] }, holes: [{ pts: [...a.holes[0].pts] }] }
    const cases: Array<[string, Contour]> = [
      ['hole position', { outer: { pts: square }, holes: [{ pts: ring(0.6, 0.5, 0.2) }] }],
      ['hole size', { outer: { pts: square }, holes: [{ pts: ring(0.4, 0.5, 0.25) }] }],
      ['ring order', { outer: { pts: [...square].reverse() }, holes: a.holes }],
      ['hole count', { outer: { pts: square }, holes: [] }],
    ]
    expect(contourCacheKey(same, 0), 'identical content must share one key').toBe(contourCacheKey(a, 0))
    for (const [what, other] of cases) {
      expect(contourCacheKey(other, 0), `${what} must change the key`).not.toBe(contourCacheKey(a, 0))
    }
    expect(contourCacheKey(a, 5), 'the outline offset must change the key').not.toBe(contourCacheKey(a, 0))
  })

  it('wrap never places the group inside a supplied hole', () => {
    const at = wrapGroup((mm) => donut(mm), { paddingMM: 12, anchorAtMM: (mm) => [mm / 2, mm / 2] as Pt }, [[0, 0]], 96, 192)
    expect(at).not.toBeNull()
    const off = Math.hypot(at!.points[0][0] - at!.sizeMM / 2, at!.points[0][1] - at!.sizeMM / 2)
    expect(off, 'wrap placed the magnet inside the hole').toBeGreaterThanOrEqual((at!.sizeMM * 60) / 192 - 12)
  })
})

describe('1b — the frame comes from the usable material', () => {
  const bandBy = (id: number) => BANDS.find((b) => b.id === id)!

  const mass = (bbox: BBox): SafeMass => ({
    areaMM2: (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY),
    centreMM: [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2],
    peakClearMM: 48, bbox, rings: [],
  })
  const segment = (bbox: BBox, masses: SafeMass[]): SafeSegment => ({
    areaMM2: (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY),
    centreMM: [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2],
    meanMM: [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2],
    peakClearMM: 3, bbox, rings: [], masses,
  })

  it('COUNTEREXAMPLE: a dead limb never enlarges the frame', () => {
    // THE case this measurement exists for. A 96x96 body with a long thin arm: the arm survives
    // erosion as a sliver of LEGAL area — so it stretches the legal box its whole length — but it
    // holds no mass and can seat nothing. Measure the legal box and a dead arm reads 3x6; measure
    // the live masses and it reads 3x3, which is what the material can actually carry.
    const body = { minX: 0, minY: 0, maxX: 96, maxY: 96 }
    const deadArm = { minX: 96, minY: 40, maxX: 336, maxY: 56 }
    const withDeadArm = [segment(body, [mass(body)]), segment(deadArm, [])]
    expect(frameOfMasses(withDeadArm, 48)).toMatchObject({ cols: 3, rows: 3 })
    // and the same arm ALIVE must be counted — the rule is "is there mass", never "is it far away"
    const withLiveArm = [segment(body, [mass(body)]), segment(deadArm, [mass(deadArm)])]
    expect(frameOfMasses(withLiveArm, 48)).toMatchObject({ cols: 8, rows: 3 })
  })

  it('STEP 1+2: the classifier measures BOXES at each band trial size — never a count', () => {
    // Dan, 2026-08-30: "classifier must know no count at this step, it must just send the sweeper
    // the outer/inner box dimensions in each band". Counting positions, fitting a layout and
    // dropping what will not hold belong to the lookup, the sweep and wrap.
    const unit = (mm: number): Contour =>
      ({ outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] as Pt[] }, holes: [] })
    const rows = classifyBands(unit, { pitchMM: 48, paddingMM: 12 })
    const seen = new Map(rows.map((r) => [r.bandId, r]))

    // the trial size is the band's MIDDLE, not its floor or its ceiling
    for (const id of [1, 2, 3, 4, 5])
      expect(seen.get(id)!.seedMM, 'B' + id + ' trial size').toBe(bandBy(id).minMM + 24 + 24)

    // what comes back is two boxes: the outline, and the legal area 12mm inside every edge
    const b3 = seen.get(3)!
    expect([b3.outerWidthMM, b3.outerHeightMM], 'the outer box IS the trial size').toEqual([144, 144])
    expect([b3.legalWidthMM, b3.legalHeightMM], 'the rim comes off both sides').toEqual([120, 120])

    // NO COUNT anywhere in the row — that is the whole point of this step
    for (const key of ['cols', 'rows', 'count', 'frame', 'canonId', 'canonCount'])
      expect(key in b3, 'the classifier leaked ' + key).toBe(false)

    // every band is measured: the invented board skip that silently deleted B9-B11 is gone
    expect(rows.map((r) => r.bandId), 'a band was dropped').toEqual(BANDS.map((b) => b.id))
  })

  it('STEP 1+2: the LOOKUP digests those boxes and names the optimal layout in that band', () => {
    const at = (w: number, h: number, band: number) => optimalLayoutForBox(48, band, w, h)
    // a square legal box takes the square; a band above it takes nothing, and says so rather
    // than substituting something from another band
    expect([at(120, 120, 3)?.frameCols, at(120, 120, 3)?.frameRows]).toEqual([3, 3])
    expect(at(120, 120, 4), 'a bigger band squeezed into a smaller box').toBeNull()

    // ORIENTATION IS THE BOX, never a choice: the same numbers the other way round transpose
    expect([at(62, 120, 3)?.frameCols, at(62, 120, 3)?.frameRows], 'tall').toEqual([2, 3])
    expect([at(120, 62, 3)?.frameCols, at(120, 62, 3)?.frameRows], 'wide').toEqual([3, 2])

    // it uses as much of the box as fits, rather than the first thing that does
    expect(at(120, 120, 3)!.nodesMM.length, 'the 3x3, not the 1x3').toBe(9)

    // canon only — a preset never answers an automatic lookup
    for (const [w, h, band] of [[120, 120, 3], [62, 120, 3], [168, 168, 4]] as [number, number, number][])
      expect(at(w, h, band)!.catalogueRole, 'a preset answered').toBe('canon')
  })

  it('STEP 1+2: a shape whose material lags its outline measures a SMALLER legal box', () => {
    const star = (mm: number): Contour => {
      const pts: Pt[] = []
      for (let i = 0; i < 10; i++) {
        const t = (i / 10) * Math.PI * 2 - Math.PI / 2
        const r = (i % 2 === 0 ? 0.5 : 0.22) * mm
        pts.push([mm / 2 + r * Math.cos(t), mm / 2 + r * Math.sin(t)] as Pt)
      }
      return { outer: { pts }, holes: [] }
    }
    const sq = (mm: number): Contour =>
      ({ outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] as Pt[] }, holes: [] })
    const cfg = { pitchMM: 48, paddingMM: 12 }
    const row = (rows: ReturnType<typeof classifyBands>, id: number) => rows.find((r) => r.bandId === id)!
    const s3 = row(classifyBands(star, cfg), 3), q3 = row(classifyBands(sq, cfg), 3)
    expect(s3.seedMM, 'both measured at the same trial size').toBe(q3.seedMM)
    // the star's points do not reach its corners, so even its OUTLINE box is smaller — but the
    // gap that matters is the legal one, which is far bigger than the outline gap
    expect(s3.legalWidthMM, 'the star holds less').toBeLessThan(q3.legalWidthMM)
    expect(q3.legalWidthMM - s3.legalWidthMM, 'the legal gap dwarfs the outline gap')
      .toBeGreaterThan(q3.outerWidthMM - s3.outerWidthMM)
    expect(optimalLayoutForBox(48, 3, s3.legalWidthMM, s3.legalHeightMM), 'the star is not B3 there')
      .toBeNull()
  })

  it('EVERY lawful registration survives to the caller; the drawn answer is unchanged', () => {
    // Centre rules pins the grid by parity — node or gap on each axis — which is four positions.
    // Only the fullest was ever returned, so "find min count -> propose" was impossible: the sparse
    // ones were destroyed before anything could look at them. Dan's brief forbids a max-count
    // prefilter by name.
    const sq = (mm: number): Contour =>
      ({ outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] as Pt[] }, holes: [] })
    for (const [mm, expected, drawn] of [[120, [4, 6, 6, 9], 8], [168, [9, 12, 12, 16], 12]] as [number, number[], number][]) {
      const g = computeGrid(sq(mm), { pitchMM: 48, paddingMM: 12 })
      expect(g.seatings.map((x) => x.length).sort((a, b) => a - b), mm + 'mm registrations')
        .toEqual(expected)
      // and the ANSWER is untouched: still the fullest, still what gets drawn
      expect(g.anchors.length, mm + 'mm drawn answer moved').toBe(drawn)
    }
  })

  it('coverage never enters search, wrapping, qualification, roles or placement', () => {
    const sq = (mm: number): Contour =>
      ({ outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] as Pt[] }, holes: [] })
    const full = computeGrid(sq(168), { pitchMM: 48, paddingMM: 12, perimeterOnly: false })
    const belt = computeGrid(sq(168), { pitchMM: 48, paddingMM: 12, perimeterOnly: true })
    expect(belt.seatings, 'coverage changed the search registrations').toEqual(full.seatings)
    expect(belt.anchors, 'the belt must remain output processing').not.toEqual(full.anchors)

    const star = (mm: number): Contour => ({ outer: { pts: Array.from({ length: 10 }, (_, i) => {
      const t = i * Math.PI * 2 / 10 - Math.PI / 2
      const r = (i % 2 === 0 ? 0.5 : 0.24) * mm
      return [mm / 2 + r * Math.cos(t), mm / 2 + r * Math.sin(t)] as Pt
    }) }, holes: [] })
    const portrait = (mm: number): Contour =>
      ({ outer: { pts: [[0, 0], [mm * 0.58, 0], [mm * 0.58, mm], [0, mm]] as Pt[] }, holes: [] })
    const donut = (mm: number): Contour => ({
      outer: sq(mm).outer,
      holes: [{ pts: Array.from({ length: 48 }, (_, i) => {
        const t = i * Math.PI * 2 / 48
        return [mm / 2 + mm * 0.16 * Math.cos(t), mm / 2 + mm * 0.16 * Math.sin(t)] as Pt
      }) }],
    })
    const squircleBase = normBaseContour(getShape('squircle', 1024, 1024), 1024)!
    const cases: Array<[string, (mm: number) => Contour, number]> = [
      ['square', sq, 4], ['portrait', portrait, 3], ['star', star, 3], ['donut', donut, 4],
      ['squircle', makeSizer(squircleBase, 0), 4],
    ]
    for (const [name, sized, id] of cases) {
      const band = BANDS.find((b) => b.id === id)!
      const fullSolve = wrapBandLadder(sized, { pitchMM: 48, paddingMM: 12, perimeterOnly: false },
        band.minMM + 24, band.maxMM + 24, 24)
      const beltSolve = wrapBandLadder(sized, { pitchMM: 48, paddingMM: 12, perimeterOnly: true },
        band.minMM + 24, band.maxMM + 24, 24)
      expect(beltSolve, `${name}: coverage changed the raw band solve`).toEqual(fullSolve)
    }
  }, 120_000)

  it('Canon smart-search finds Batwoman raw9 outside the four Centre-rules phases', () => {
    const { PNG } = nodeRequire('pngjs') as { PNG: { sync: { read(data: Buffer): { width: number; height: number; data: Uint8Array } } } }
    const png = PNG.sync.read(readFileSync(join(process.cwd(), 'public/grid-engine/cutouts/BAT-WOMAN.png')))
    const mask = new Uint8Array(png.width * png.height)
    for (let i = 0; i < mask.length; i++) if (png.data[i * 4 + 3] > 128) mask[i] = 1
    const base = normMaskContour(mask, png.width, png.height)!
    const sized = makeSizer(base, 0)
    const cfg: GridConfig = { pitchMM: 48, paddingMM: 12, perimeterOnly: false, centreMode: 2, governor: 0 }
    const anchorAt = (mm: number): Pt => [86 / 201 * mm, 128 / 201 * mm]
    const row = classifyBands(sized, cfg, anchorAt).find((x) => x.bandId === 4)!
    const cols = positionsAcross(row.rulerWidthMM, 48), rows = positionsAcross(row.rulerHeightMM, 48)
    expect([cols, rows], 'Batwoman B4 classifier frame changed').toEqual([4, 4])
    const canon = canonLayoutForFrame(48, cols, rows)!
    const local = (() => {
      const pts = canon.nodesMM.map(([x, y]) => [x, y] as Pt)
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
      return pts.map(([x, y]) => [x - cx, y - cy] as Pt)
    })()
    const search = enumerateCanonPhaseWindows(sized(201), cfg, local, anchorAt(201), 201)
    const winner = search.candidates.find((x) => x.points.length === 9)
    expect(winner, 'full-phase search lost the nine-seat Canon window').toBeDefined()
    const fourPhase = computeGrid(sized(201), { ...cfg, centreOverrideMM: anchorAt(201) }, local)
    expect(Math.max(...fourPhase.canonSeatings.map((x) => x.length)), 'four-phase mutation stopped proving the gap')
      .toBe(6)
    expect(Math.max(...enumerateFreePhaseMax(sized(201), cfg, anchorAt(201), 201).candidates
      .map((x) => x.points.length)), 'recovered free fallback lost the same phase search').toBe(9)
    const span = bandOuterMM(BANDS.find((x) => x.id === 4)!, 12)
    const at = wrapGroup(sized, { pitchMM: 48, paddingMM: 12, anchorAtMM: anchorAt, frameMidMM: [0, 0] },
      winner!.points, 24, span.maxMM)
    expect(at).not.toBeNull()
    expect(at!.count).toBe(9)
    expect(at!.sizeMM).toBeCloseTo(198.59, 1)
    expect(applyCoverage(at!.points, true, 48).seated).toHaveLength(8)
  }, 30_000)

  it('THE THREE ANSWERS: optimal first, then min and max, coincident rows collapsed', () => {
    // Dan, 2026-08-30: "band module must get recommendation from the classifier of optimal layout
    // to try first from the canon ... and also try next best min magnet count in the range and max
    // - if they coincide or anything coincides we show only the single result".
    const sq = (mm: number): Contour =>
      ({ outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] as Pt[] }, holes: [] })
    const cfg = { pitchMM: 48, paddingMM: 12 }
    const anchorAt = (mm: number): Pt => [mm / 2, mm / 2]
    const rows = classifyBands(sq, cfg, anchorAt)
    const solveBand = (id: number) => {
      const band = BANDS.find((b) => b.id === id)!
      const row = rows.find((r) => r.bandId === id)!
      const optimal = optimalLayoutForBox(48, id, row.legalWidthMM, row.legalHeightMM)
      const nodes = optimal?.nodesMM.map(([x, y]) => [x, y] as Pt)
      const solve = wrapBandLadder(sq, cfg, band.minMM + 24, band.maxMM + 24, 24, anchorAt, nodes)
      return { solve, optimal }
    }

    // B4 — two distinct answers after coincident roles collapse. The counts are pinned because
    // they are the whole point:
    // Raw registrations are the search input; output coverage cannot invent a sparse search role.
    const b4 = solveBand(4)
    expect(b4.solve.offers.map((o) => o.at.count), 'B4 optimal+max / min').toEqual([16, 12])
    // every row states WHY it is on the list — the order alone is not the answer
    expect(b4.solve.offers.map((o) => o.roles.join('+')), 'B4 roles')
      .toEqual(['optimal+max', 'min'])
    expect(b4.solve.offers[0].at.count, 'the first row must be the canon layout')
      .toBe(b4.optimal!.nodesMM.length)

    // B2 — the optimal IS the fullest, so those two rows are the same answer and COLLAPSE to one.
    // This is the case that proves the collapse: without it the same answer appears twice.
    const b2 = solveBand(2)
    expect(b2.solve.offers.length, 'B2 must collapse to two rows').toBe(2)
    // and the collapsed row SAYS it is two answers, rather than silently being one of them
    expect(b2.solve.offers.map((o) => o.roles.join('+')), 'B2 roles')
      .toEqual(['optimal+max', 'min'])
    const shipped = (o: (typeof b2.solve.offers)[number]) => o.at.sizeMM.toFixed(2) + '|'
      + [...o.at.points].map((q) => q.map((v) => v.toFixed(1)).join(',')).sort().join(';')
    expect(new Set(b2.solve.offers.map(shipped)).size, 'the same answer appears twice').toBe(2)

    // never more than the three probes, whatever the walk found
    for (const id of [2, 3, 4, 5])
      expect(solveBand(id).solve.offers.length, 'B' + id + ' returned more than three')
        .toBeLessThanOrEqual(3)

    // with NO optimal handed in, the canon row is simply absent — never invented
    const band4 = BANDS.find((b) => b.id === 4)!
    const bare = wrapBandLadder(sq, cfg, band4.minMM + 24, band4.maxMM + 24, 24, anchorAt)
    expect(bare.offers.length, 'without a canon there are at most two probes').toBeLessThanOrEqual(2)
    expect(bare.offers.every((o) => !o.roles.includes('optimal')), 'an optimal role appeared without a canon')
      .toBe(true)
  }, 20_000)

  it('COUNTEREXAMPLE: the frame counts past five', () => {
    // The old axis class is typed 1|2|3|4|5 and clamps, so every larger shape read as five. The
    // board holds 9 columns and 11 rows at 48mm, and the library publishes frames to match.
    const wide = { minX: 0, minY: 0, maxX: 384, maxY: 480 }
    expect(frameOfMasses([segment(wide, [mass(wide)])], 48)).toMatchObject({ cols: 9, rows: 11 })
  })

  it('positions are (n-1) pitches apart, and a bare span carries one', () => {
    expect(positionsAcross(0, 48)).toBe(1)
    expect(positionsAcross(47.9, 48)).toBe(1)
    expect(positionsAcross(48, 48)).toBe(2)
    expect(positionsAcross(96, 48)).toBe(3)
    // exactly on a boundary counts the position it reaches, not the next one
    expect(positionsAcross(191, 48)).toBe(4)
    expect(positionsAcross(192, 48)).toBe(5)
  })

  it('no mass anywhere is null, not a frame of one', () => {
    expect(frameOfMasses([], 48)).toBeNull()
    expect(frameOfMasses([segment({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, [])], 48)).toBeNull()
  })
})

describe('deepest safe points', () => {
  const mirrorX = (c: Contour): Contour => ({
    outer: { pts: c.outer.pts.map(([x, y]) => [-x, y] as Pt) },
    holes: c.holes.map((h) => ({ pts: h.pts.map(([x, y]) => [-x, y] as Pt) })),
  })

  it('chooses the exact symmetric member of a non-grid-aligned deepest plateau in both paths', () => {
    const expected: Pt = [51.3, 51.7]
    const squircle: Contour = {
      outer: { pts: Array.from({ length: 128 }, (_, i) => {
        const t = i * Math.PI * 2 / 128
        const c = Math.cos(t), s = Math.sin(t)
        const q = (Math.abs(c) ** 4 + Math.abs(s) ** 4) ** -0.25
        return [expected[0] + 51 * c * q, expected[1] + 51 * s * q] as Pt
      }) }, holes: [],
    }
    for (const shape of [squircle, mirrorX(squircle)]) {
      const want: Pt = shape === squircle ? expected : [-expected[0], expected[1]]
      const light = safeSegments(shape, 12, 'light')[0].centreMM
      const full = safeSegments(shape, 12, 'full')[0].centreMM
      expect(light[0]).toBeCloseTo(want[0], 10)
      expect(light[1]).toBeCloseTo(want[1], 10)
      expect(full).toEqual(light)
    }
  })

  it('keeps a concave mass centre inside its component at maximum sampled clearance', () => {
    const concave: Contour = {
      outer: { pts: [[0, 0], [100, 0], [100, 100], [70, 100], [70, 30], [30, 30], [30, 100], [0, 100]] },
      holes: [],
    }
    const light = safeSegments(concave, 8, 'light')[0]
    const full = safeSegments(concave, 8, 'full')[0]
    expect(light.centreMM, 'light and full selected different deepest candidates').toEqual(full.centreMM)
    expect(pointInContour(light.centreMM, concave), 'the component mean void was selected').toBe(true)
    let sampledMax = -Infinity
    for (let y = -2; y <= 102; y += 2) for (let x = -2; x <= 102; x += 2) {
      const p: Pt = [x, y]
      if (pointInContour(p, concave)) sampledMax = Math.max(sampledMax, edgeDistToContourMM(concave, p) - 8)
    }
    expect(edgeDistToContourMM(concave, light.centreMM) - 8, 'a shallower point was selected')
      .toBeGreaterThanOrEqual(sampledMax)
  })
})

describe('7 — an empty band returns no lawful offer, never a fit', () => {
  it('canon experiment wraps the complete known answer before any partial or fallback work', () => {
    const sq = (mm: number): Contour => ({ outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] as Pt[] }, holes: [] })
    const canon = canonLayoutForFrame(48, 4, 4)!.nodesMM.map(([x, y]) => [x, y] as Pt)
    const result = solveCanonExperiment(sq, { pitchMM: 48, paddingMM: 12 }, 168, 215, 24,
      (mm) => [mm / 2, mm / 2], canon)
    expect(result.trace).toMatchObject({ source: 'canon-full', canonSeats: 16, populations: 1, wraps: 1, retained: 16, readded: 0 })
    expect(result.offers).toHaveLength(1)
    expect(result.offers[0].at.count).toBe(16)
    expect(result.offers[0].at.sizeMM).toBeGreaterThanOrEqual(168)
  })
  it('the old rigid walk is gone from every production path', () => {
    for (const f of ['grid-magnet.ts', 'grid-magnet-compute.ts']) {
      const text = readFileSync(join(LIB, f), 'utf8')
      for (const dead of ['bandWalk', 'fitSizeInBand', 'snapRange', 'maxPressMM']) {
        expect(text, `${f} still holds ${dead}`).not.toMatch(new RegExp(`\\b${dead}\\b`))
      }
    }
  })

  const sq = (mm: number): Contour => ({ outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] as Pt[] }, holes: [] })

  it('CALLS the solver: every returned offer is inside the band it was asked for', () => {
    // The previous version scanned source text. QA mutated the real post to `offers:
    // [bestSeatedMM]`, added a decoy `void { offers: [] }`, and every test stayed green. This one
    // calls the solver on a band that DOES produce offers, so deleting the membership rule fails it.
    // A SQUARE cannot prove this: its bisection bounds already keep every wrap inside the band, so
    // deleting the rule changes nothing. A star reveals small layouts that wrap far below the band
    // floor — 115, 128, 149, 150mm all leak into 168-216 the moment the rule goes.
    const star = (mm: number): Contour => {
      const pts: Pt[] = []
      for (let i = 0; i < 10; i++) {
        const t = (i / 10) * Math.PI * 2 - Math.PI / 2
        const r = (i % 2 === 0 ? 0.5 : 0.22) * mm
        pts.push([mm / 2 + r * Math.cos(t), mm / 2 + r * Math.sin(t)] as Pt)
      }
      return { outer: { pts }, holes: [] }
    }
    for (const [shape, lo, hi] of [[sq, 24, 72], [star, 120, 168], [star, 168, 216]] as const) {
      const solve = wrapBandLadder(shape, { paddingMM: 12, pitchMM: 48 }, lo, hi, 24)
      expect(solve.offers.length, `band ${lo}-${hi} must produce offers`).toBeGreaterThan(0)
      for (const o of solve.offers) {
        expect(o.at.sizeMM, `offer ${o.at.sizeMM}mm escaped band ${lo}-${hi}`).toBeGreaterThanOrEqual(lo - 0.005)
        expect(o.at.sizeMM, `offer ${o.at.sizeMM}mm escaped band ${lo}-${hi}`).toBeLessThanOrEqual(hi + 0.005)
      }
    }
  })

  it('band membership actually filters — the star leaks without it', () => {
    const star = (mm: number): Contour => {
      const pts: Pt[] = []
      for (let i = 0; i < 10; i++) {
        const t = (i / 10) * Math.PI * 2 - Math.PI / 2
        const r = (i % 2 === 0 ? 0.5 : 0.22) * mm
        pts.push([mm / 2 + r * Math.cos(t), mm / 2 + r * Math.sin(t)] as Pt)
      }
      return { outer: { pts }, holes: [] }
    }
    const solve = wrapBandLadder(star, { paddingMM: 12, pitchMM: 48 }, 168, 216, 24)
    expect(solve.offers.length, 'this band must hold offers, or the test proves nothing').toBeGreaterThan(0)
    expect(solve.offers.every((o) => o.at.sizeMM >= 168), 'a sub-band layout was offered').toBe(true)
  })

  it('the witness comes from layout and is never an offer', () => {
    const solve = wrapBandLadder(sq, { paddingMM: 12, pitchMM: 48 }, 24, 72, 24)
    expect(solve.bestSeated, 'layout must supply a witness').not.toBeNull()
    expect(Object.keys(solve)).toEqual(['offers', 'bestSeated'])
    // The witness is a REVEAL size, not a wrapped offer: it carries no contact size at all.
    expect(solve.offers.some((o) => (o as unknown as { points?: unknown }).points !== undefined)).toBe(false)
  })

  it('the shell belts only final delivery and preserves the unified raw solve', async () => {
    const cfg: GridConfig = { paddingMM: 12, pitchMM: 48, centreMode: 2, governor: 0 }
    type Posted = { model: {
      contour: Contour; effSize: number; idx: number
      ladder: Array<{ sizeMM: number; count: number; roles: string[] }>
      grid: { anchors: Array<{ p: Pt }>; phaseMM: Pt; centreMainMM: Pt }
      diagnostic?: unknown
    } | null }
    const posted: Posted[] = []
    const stub = { onmessage: null as ((e: { data: unknown }) => void) | null, postMessage: (m: unknown) => { posted.push(m as never) } }
    const g = globalThis as { self?: unknown }
    const prev = g.self
    g.self = stub
    try {
      const worker = await import('@/app/(dev)/effect-creator/grid-centre/solve.worker')
      const squircle = normBaseContour(getShape('squircle', 1024, 1024), 1024)!
      stub.onmessage!({ data: { id: 1, base: squircle, offsetMM: 0,
        cfg: { ...cfg, perimeterOnly: false }, mode: 4, sizeMM: 0, stepSel: null } })
      stub.onmessage!({ data: { id: 2, base: squircle, offsetMM: 0,
        cfg: { ...cfg, perimeterOnly: true }, mode: 4, sizeMM: 0, stepSel: null } })
      const full = posted[0].model!, belt = posted[1].model!
      expect(belt.idx, 'coverage changed the raw default row').toBe(full.idx)
      expect(belt.effSize, 'coverage changed the selected wrapped size').toBe(full.effSize)
      expect(belt.contour, 'coverage changed the selected outline').toEqual(full.contour)
      expect(belt.grid.phaseMM, 'coverage changed placement').toEqual(full.grid.phaseMM)
      expect(belt.grid.centreMainMM, 'coverage changed the governed centre').toEqual(full.grid.centreMainMM)
      expect(belt.ladder.map((r) => [r.roles, r.sizeMM]), 'coverage changed roles or rung sizes')
        .toEqual(full.ladder.map((r) => [r.roles, r.sizeMM]))
      expect(full.ladder.map((r) => r.count)).toEqual([16, 4])
      expect(belt.ladder.map((r) => r.count)).toEqual([12, 4])
      for (const a of belt.grid.anchors)
        expect(full.grid.anchors.some((b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]) < 1e-6),
          'Belt introduced a point instead of removing an interior point').toBe(true)

    } finally {
      g.self = prev
    }
  })

  it('the shell never labels the witness a fit', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/page.tsx'), 'utf8')
    expect(page).not.toMatch(/nothing fully fits in this band/)
    expect(page).toMatch(/no lawful offer in this band/)
  })
})

describe('8 — recovered phase search is wired through the production Canon solver', () => {
  const workerAnchorFor = async (
    sized: (mm: number) => Contour, cfg: GridConfig, sig: string,
  ): Promise<(mm: number) => Pt> => {
    const g = globalThis as { self?: unknown }
    const previous = g.self
    if (!g.self) g.self = { postMessage: () => undefined, onmessage: null }
    try {
      const worker = await import('@/app/(dev)/effect-creator/grid-centre/solve.worker')
      return worker.anchorFnFor(sized, cfg, JSON.stringify(cfg), sig)!
    } finally {
      g.self = previous
    }
  }

  it('production Canon solve finds and wraps Batwoman B4 raw9', async () => {
    const { PNG } = nodeRequire('pngjs') as { PNG: { sync: { read(data: Buffer): { width: number; height: number; data: Uint8Array } } } }
    const png = PNG.sync.read(readFileSync(join(process.cwd(), 'public/grid-engine/cutouts/BAT-WOMAN.png')))
    const mask = new Uint8Array(png.width * png.height)
    for (let i = 0; i < mask.length; i++) if (png.data[i * 4 + 3] > 128) mask[i] = 1
    const base = normMaskContour(mask, png.width, png.height)!
    const sized = makeSizer(base, 0)
    const cfg: GridConfig = { pitchMM: 48, paddingMM: 12, perimeterOnly: false, centreMode: 2, governor: 0 }
    const anchorAt = await workerAnchorFor(sized, cfg, 'batwoman-canon-integration')
    const span = bandOuterMM(BANDS.find((x) => x.id === 4)!, 12)
    const row = classifyBands(sized, cfg, anchorAt).find((x) => x.bandId === 4)!
    const canon = canonLayoutForFrame(48,
      positionsAcross(row.rulerWidthMM, 48), positionsAcross(row.rulerHeightMM, 48))!
    const canonNodes = canon.nodesMM.map(([x, y]) => [x, y] as Pt)
    const result = solveCanonExperiment(sized, cfg, span.minMM, span.maxMM, 24, anchorAt, canonNodes)
    expect(result.trace).toMatchObject({ source: 'canon-partial', canonSeats: 16, retained: 9 })
    expect(result.trace.winningPhaseMM).toBeDefined()
    expect(result.trace.winningWindow).toBeDefined()
    expect(result.offers).toHaveLength(1)
    expect(result.offers[0].at.count).toBe(9)
    expect(result.offers[0].at.sizeMM).toBeCloseTo(198.59, 1)
    expect(applyCoverage(result.offers[0].at.points, true, 48).seated).toHaveLength(8)
    expect(readFileSync(join(LIB, 'grid-magnet-canon-experiment.ts'), 'utf8')).not.toMatch(/\bwrapBandLadder\b/)
  }, 60_000)

  it('production Canon solve uses full-phase free maximum only as fallback', async () => {
    const square = (mm: number): Contour => ({
      outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] as Pt[] }, holes: [],
    })
    const cfg: GridConfig = { pitchMM: 48, paddingMM: 12, perimeterOnly: false, centreMode: 2, governor: 0 }
    const anchorAt = await workerAnchorFor(square, cfg, 'square-free-fallback-integration')
    const result = solveCanonExperiment(square, cfg, 168, 170, 24, anchorAt, [[0, 0]])
    const fullPhaseMax = Math.max(...fallbackRevealSizes(168, 170).flatMap((mm) =>
      enumerateFreePhaseMax(square(mm), cfg, anchorAt(mm), mm).candidates.map((x) => x.points.length)))
    expect(result.trace.source).toBe('free-fallback')
    expect(result.trace.winningPhaseMM).toBeDefined()
    expect(result.offers).toHaveLength(1)
    expect(result.offers[0].roles).toEqual(['max'])
    expect(result.offers[0].at.count).toBe(fullPhaseMax)
    expect(result.offers[0].at.sizeMM).toBeGreaterThanOrEqual(168)
    expect(result.offers[0].at.sizeMM).toBeLessThanOrEqual(170)
    const contour = square(result.offers[0].at.sizeMM)
    expect(result.offers[0].at.points.every((point) =>
      pointInContour(point, contour) && edgeDistToContourMM(contour, point) >= 11.98)).toBe(true)
  }, 30_000)

  it('enabled holding scores rank evenly and Canon min keeps extreme span holds', () => {
    const candidates = ['perimeter', 'protected', 'balanced'] as const
    const facts = {
      perimeter: { perimeter: 3, holdsExtremes: false, ends: 1, topUnprotectedMM: 20, unprotectedMM: 20, imbalance: 1 },
      protected: { perimeter: 1, holdsExtremes: true, ends: 2, topUnprotectedMM: 0, unprotectedMM: 0, imbalance: 0.5 },
      balanced: { perimeter: 2, holdsExtremes: true, ends: 2, topUnprotectedMM: 10, unprotectedMM: 10, imbalance: 0 },
    }
    const ranked = rankByHolding(candidates, (candidate) => facts[candidate], {
      universal: true, balance: true, perimeter: false, extremes: false, ends: false, top: false,
    })
    expect(ranked[0]).toBe('protected')
    const contour: Contour = { outer: { pts: [[0, 0], [144, 0], [144, 144], [0, 144]] }, holes: [] }
    const points: Pt[] = [[12, 12], [72, 12], [132, 12], [12, 72], [72, 72], [132, 72], [12, 132], [72, 132], [132, 132]]
    const sparse = sparseExtremeHold(contour, points, [72, 72])
    expect(sparse.length).toBeLessThan(points.length)
    const before = holdingFactsOf(contour, points, [72, 72])
    const after = holdingFactsOf(contour, sparse, [72, 72])
    expect(after.holdsExtremes).toBe(before.holdsExtremes)
    expect(after.ends).toBeGreaterThanOrEqual(before.ends)
  })
})
