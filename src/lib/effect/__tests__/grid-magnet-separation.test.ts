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
import type { Contour, Pt } from '../types'

const LIB = join(process.cwd(), 'src/lib/effect')
const PAGE = join(process.cwd(), 'src/app/(dev)/effect-creator/grid-centre/page.tsx')

const MODULE_FILES = [
  'grid-magnet-spec.ts',
  'grid-magnet-compute.ts',
  'grid-magnet-logic.ts',
  'grid-magnet.ts',
  'grid-magnet-bridge.ts',
] as const

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
    'grid-magnet-logic.ts': [/^\.\/types$/, /^\.\/grid-magnet-spec$/, /^\.\/grid-magnet-compute$/, /^\.\/units\/[a-z-]+$/],  // import allowed ONLY as the shim's own re-export; see the unit zone below
    'grid-magnet.ts': [/^\.\/types$/, /^\.\/grid-magnet-spec$/, /^\.\/grid-magnet-compute$/, /^\.\/grid-magnet-logic$/],
    'grid-magnet-bridge.ts': [/^\.\/types$/, /^\.\/geometry-truth$/, /^\.\/contour$/, /^\.\/offset$/, /^\.\/grid-magnet$/, /^\.\/grid-magnet-compute$/, /^@\/lib\/vector-core$/],
  }

  it('every module file imports only from its allow-list', () => {
    for (const { file, text } of readModule()) {
      const allowed = ALLOWED[file]!
      const bad = importsOf(text).filter((i) => !allowed.some((rx) => rx.test(i)))
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
const UNIT_ALLOWED = [/^\.\.\/types$/, /^\.\.\/grid-magnet-spec$/, /^\.\.\/foundation\/[a-z-]+$/]

describe('2b — the units are self-sufficient', () => {
  it('every unit file imports only shared vocabulary, spec or foundation', () => {
    for (const f of unitFiles()) {
      const bad = importsOf(readFileSync(join(UNITS_DIR, f), 'utf8'))
        .filter((i) => !UNIT_ALLOWED.some((rx) => rx.test(i)))
      expect(bad, `units/${f} reaches outside its allow-list: ${bad.join(' · ')}`).toEqual([])
    }
  })

  it('no unit imports another unit', () => {
    for (const f of unitFiles()) {
      const bad = importsOf(readFileSync(join(UNITS_DIR, f), 'utf8')).filter((i) => /^\.\/[a-z-]+$/.test(i))
      expect(bad, `units/${f} imports another unit: ${bad.join(' · ')}`).toEqual([])
    }
  })

  it('no unit reaches back into a retiring aggregate or the app', () => {
    for (const f of unitFiles()) {
      const text = readFileSync(join(UNITS_DIR, f), 'utf8')
      const bad = importsOf(text).filter((i) => /grid-magnet-(compute|logic|class|bridge)$|^@\/app\//.test(i))
      expect(bad, `units/${f} reaches up to ${bad.join(' · ')}`).toEqual([])
      expect(text, `units/${f} depends on a framework`).not.toMatch(/from ['"]react['"]|from ['"]next|\.css['"]/)
    }
  })

  it('a legacy file may only REACH a unit through a re-export, never an import', () => {
    for (const { file, text } of readModule()) {
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
      const bad = importsOf(readFileSync(join(FOUNDATION, f), 'utf8'))
        .filter((i) => !FOUNDATION_ALLOWED.some((rx) => rx.test(i)))
      expect(bad, `foundation/${f} reaches outside its allow-list: ${bad.join(' · ')}`).toEqual([])
    }
  })

  it('never reaches a unit or a retiring aggregate', () => {
    for (const f of foundationFiles()) {
      const bad = importsOf(readFileSync(join(FOUNDATION, f), 'utf8'))
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
