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
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { computeGrid } from '../grid-magnet'
import { scaleContour } from '../grid-magnet-compute'
import { makeContourSeatPredicate } from '../foundation/geometry'
import { wrapGroup } from '../units/wrap'
import type { Contour, Pt } from '../types'

const LIB = join(process.cwd(), 'src/lib/effect')
const PAGE = join(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/page.tsx')

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
const RELEASED_VALUES = (() => {
  const src = readFileSync(join(LIB, 'grid-magnet-spec.ts'), 'utf8')
  const values = new Set<number>()
  walkAst(src, (n) => {
    if (!ts.isVariableDeclaration(n)) return
    const name = n.name.getText()
    if (/WEIGHT|SNAP_MAX|SNAP_STEP/.test(name)) return // internal weights and scan bounds
    const collect = (m: ts.Node) => {
      if (ts.isNumericLiteral(m)) {
        const v = Number(m.text)
        if (v >= 10) values.add(v) // small counts (1,2,3,4,9) collide with ordinary UI numbers
      }
      ts.forEachChild(m, collect)
    }
    if (n.initializer) collect(n.initializer)
  })
  if (!values.size) throw new Error('spec yielded no released values — guard has no source')
  return values
})()

/** Skips generator-knob data (GENS), the camera zoom clamp (CAM_MAX — a view multiplier that
 *  collides with the 12mm padding, not a restated law) and JSX min/max attrs — pinned below. */
const findBareLawValue = (text: string) => {
  const hits: string[] = []
  walkAst(text, (n) => {
    if (!ts.isNumericLiteral(n) || !RELEASED_VALUES.has(Number(n.text))) return
    for (let a: ts.Node | undefined = n.parent; a; a = a.parent) {
      if (ts.isJsxAttribute(a) && /^(min|max)$/.test(a.name.getText())) return
      if (ts.isVariableDeclaration(a) && /^(GENS|CAM_MAX)$/.test(a.name.getText())) return
    }
    hits.push(`${n.text} in \`${n.parent.getText().slice(0, 50)}\``)
  })
  return hits
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
    'grid-magnet.ts': [/^\.\/types$/, /^\.\/grid-magnet-spec$/, /^\.\/grid-magnet-compute$/, /^\.\/grid-magnet-logic$/, /^\.\/foundation\/[a-z-]+$/, /^\.\/units\/[a-z-]+$/],
    // The two SEQUENCER SEATS may import units (sequencing them is what a pipeline does); both
    // hand over to pipeline/ at S3. Every other retiring file re-exports only.
    'grid-magnet-wrap-compute.ts': [/^\.\/types$/, /^\.\/grid-magnet-spec$/, /^\.\/grid-magnet$/, /^\.\/offset$/, /^\.\/foundation\/[a-z-]+$/, /^\.\/units\/[a-z-]+$/, /^@countertype\/clipper2-ts$/],
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
  it('every unit file imports only shared vocabulary, spec or foundation', () => {
    for (const f of unitFiles()) {
      const bad = moduleRefsOf(readFileSync(join(UNITS_DIR, f), 'utf8'))
        .filter((i) => !UNIT_ALLOWED.some((rx) => rx.test(i)))
      expect(bad, `units/${f} reaches outside its allow-list: ${bad.join(' · ')}`).toEqual([])
    }
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
      'grid-magnet.ts': ['./units/centring', './units/layout', './units/segment'],
      'grid-magnet-wrap-compute.ts': ['./units/centring', './units/judge', './units/layout', './units/segment', './units/wrap'],
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
      if (file === 'grid-magnet.ts' || file === 'grid-magnet-wrap-compute.ts') continue
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

describe('3 — each sub holds only its own kind', () => {
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
  it('the page carries no released value as a bare literal', () => {
    const hits = findBareLawValue(pageText())
    expect(hits, `page hardcodes released values: ${hits.join(' · ')}`).toEqual([])
  })

  it('compute, logic and the bridges import their values instead of restating them', () => {
    for (const { file, text } of readModule()) {
      if (file === 'grid-magnet-spec.ts') continue
      const hits = findBareLawValue(text)
      expect(hits, `${file} restates released values: ${hits.join(' · ')}`).toEqual([])
    }
  })
})

describe('4b — the law sliders take their bounds from spec, never literals', () => {
  it('padding and snap-step sliders use identifiers for min', () => {
    const text = pageText()
    expect(text).toMatch(/label="Magnet padding[^/]*min=\{PADDING_FLOOR_MM\}/)
    expect(text).toMatch(/label="Snap step"[^/]*min=\{SNAP_STEP_MM\}[^/]*max=\{MIN_EFFECT_MM\}/)
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

  it('wrap never places the group inside a supplied hole', () => {
    const at = wrapGroup((mm) => donut(mm), { paddingMM: 12, anchorAtMM: (mm) => [mm / 2, mm / 2] as Pt }, [[0, 0]], 96, 192)
    expect(at).not.toBeNull()
    const off = Math.hypot(at!.points[0][0] - at!.sizeMM / 2, at!.points[0][1] - at!.sizeMM / 2)
    expect(off, 'wrap placed the magnet inside the hole').toBeGreaterThanOrEqual((at!.sizeMM * 60) / 192 - 12)
  })
})

describe('7 — an empty band returns no lawful offer, never a fit', () => {
  it('the old rigid walk is gone from every production path', () => {
    for (const f of ['grid-magnet.ts', 'grid-magnet-compute.ts']) {
      const text = readFileSync(join(LIB, f), 'utf8')
      for (const dead of ['bandWalk', 'fitSizeInBand', 'snapRange', 'maxPressMM']) {
        expect(text, `${f} still holds ${dead} — the rigid gate the brief rejects`).not.toMatch(new RegExp(`\\b${dead}\\b`))
      }
    }
  })

  it('the worker answers an empty band with no-lawful-offer plus a witness', () => {
    const w = readFileSync(join(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/solve.worker.ts'), 'utf8')
    expect(w, 'the empty band must post offers: [] with a no-lawful-offer diagnostic').toMatch(/offers: \[\]/)
    expect(w).toMatch(/reason: 'no-lawful-offer'/)
    expect(w, 'the witness must not be produced by the deleted walk').not.toMatch(/\bbandFit\b|\bfitSizeInBand\b/)
  })

  it('the shell never labels the witness a fit', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/page.tsx'), 'utf8')
    expect(page).not.toMatch(/nothing fully fits in this band/)
    expect(page).toMatch(/no lawful offer in this band/)
  })
})
