// The separation is enforced here, not remembered. Cloned from the scaffold's guard
// (src/lib/grid-engine/__tests__/separation.test.ts) and installed for the grid-origin module.
//
// Invariants:
//   1. the module is portable — no React/Next/stylesheet anywhere in it
//   2. traffic is one-way: page → engine door / spec / ui-bridge; modules never reach back
//   3. SPEC holds values only; LOGIC holds no geometry; the page computes nothing
//   4. no surface restates a released value as a bare literal
//   5. the solve is deterministic — same inputs, same layout, whatever mode asked

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { computeGrid } from '../grid-origin'
import type { Contour, Pt } from '../types'

const LIB = join(process.cwd(), 'src/lib/effect')
const PAGE = join(process.cwd(), 'src/app/(dev)/effect-creator/grid-origin/page.tsx')

const MODULE_FILES = [
  'grid-origin-spec.ts',
  'grid-origin-compute.ts',
  'grid-origin-logic.ts',
  'grid-origin.ts',
  'grid-origin-bridge.ts',
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
  const src = readFileSync(join(LIB, 'grid-origin-spec.ts'), 'utf8')
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

/** Skips generator-knob data (the GENS table) and JSX min/max attrs — those are pinned below. */
const findBareLawValue = (text: string) => {
  const hits: string[] = []
  walkAst(text, (n) => {
    if (!ts.isNumericLiteral(n) || !RELEASED_VALUES.has(Number(n.text))) return
    for (let a: ts.Node | undefined = n.parent; a; a = a.parent) {
      if (ts.isJsxAttribute(a) && /^(min|max)$/.test(a.name.getText())) return
      if (ts.isVariableDeclaration(a) && a.name.getText() === 'GENS') return
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
    'grid-origin-spec.ts': [],
    'grid-origin-compute.ts': [/^\.\/types$/, /^\.\/attachment$/, /^\.\/grid-origin-spec$/, /^@\/lib\/grid-engine\/compute\/geometry$/],
    'grid-origin-logic.ts': [/^\.\/types$/, /^\.\/grid-origin-spec$/, /^\.\/grid-origin-compute$/],
    'grid-origin.ts': [/^\.\/types$/, /^\.\/grid-origin-spec$/, /^\.\/grid-origin-compute$/, /^\.\/grid-origin-logic$/],
    'grid-origin-bridge.ts': [/^\.\/types$/, /^\.\/geometry-truth$/, /^\.\/offset$/, /^\.\/grid-origin$/, /^\.\/grid-origin-compute$/, /^@\/lib\/vector-core$/],
  }

  it('every module file imports only from its allow-list', () => {
    for (const { file, text } of readModule()) {
      const allowed = ALLOWED[file]!
      const bad = importsOf(text).filter((i) => !allowed.some((rx) => rx.test(i)))
      expect(bad, `${file} imports outside its allow-list: ${bad.join(', ')}`).toEqual([])
    }
  })

  it('the page reaches the module only through the engine door, the spec and the ui-bridge', () => {
    const reaches = importsOf(pageText()).filter((i) => /grid-origin/.test(i))
    const bad = reaches.filter((i) => !/grid-origin(-spec|-bridge)?$/.test(i))
    expect(bad, `page reaches into the module's internals: ${bad.join(', ')}`).toEqual([])
  })

  it('the module never imports from the app', () => {
    for (const { file, text } of readModule()) {
      expect(text, `${file} must not import from the app`).not.toMatch(/from ['"]@\/app\//)
    }
  })
})

describe('3 — each sub holds only its own kind', () => {
  it('SPEC declares values only — no functions, no arithmetic', () => {
    const src = readFileSync(join(LIB, 'grid-origin-spec.ts'), 'utf8')
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
    const src = readFileSync(join(LIB, 'grid-origin-logic.ts'), 'utf8')
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
      if (file === 'grid-origin-spec.ts') continue
      const hits = findBareLawValue(text)
      expect(hits, `${file} restates released values: ${hits.join(' · ')}`).toEqual([])
    }
  })
})

describe('4b — the law sliders take their bounds from spec, never literals', () => {
  it('the padding slider uses identifiers for its bounds', () => {
    const text = pageText()
    expect(text).toMatch(/label="Magnet padding[^/]*min=\{PADDING_FLOOR_MM\}/)
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
