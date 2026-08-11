// The separation is enforced here, not remembered.
//
// Dan set it in the first brief and has had to repeat it. These are his four invariants, each one a
// check that goes red before he ever sees the drift:
//
//   1. the unit imports nothing from React, Next or a stylesheet — portability is testable
//   2. the UI does screen maths only — pixels, camera, aspect. Never grid maths
//   3. every write to a law value goes through the one guard
//   4. traffic is one-way: shell → bridge → unit. The unit never reaches back
//
// Plus the two-sub split inside the unit: the ENGINE holds no values, the SPEC holds no maths.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const UNIT = join(process.cwd(), 'src/lib/grid-engine')
const SHELL = join(process.cwd(), 'src/app/(dev)/grid-engine')

/**
 * RECURSIVE. The old reader listed ONE directory level, so everything under `ui/` — a whole
 * submodule of the unit, added after these guards were written — was silently unguarded. A guard
 * that cannot see a directory is not a guard, it is a habit.
 */
const readTree = (
  dir: string,
  filter: RegExp,
  root = dir,
): Array<{ file: string; text: string }> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' ? [] : readTree(full, filter, root)
    // relative to the ROOT, not to the directory being listed. Relative to the local directory every
    // nested file comes back looking top-level, so a "files in subdirectories" filter selects
    // NOTHING and its test passes by iterating an empty list — a guard that guards nothing.
    return filter.test(e.name) ? [{ file: relative(root, full), text: readFileSync(full, 'utf8') }] : []
  })

const read = (dir: string, filter: RegExp) =>
  readdirSync(dir)
    .filter((f) => filter.test(f))
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }))

/** The three files that TRAVEL. `ui/` is the adapter and is allowed to reach outward (see ui/README). */
const PORTABLE = ['engine.ts', 'spec.ts', 'bridge.ts'] as const
const portable = () => PORTABLE.map((f) => ({ file: f, text: readFileSync(join(UNIT, f), 'utf8') }))

/** Every law value name. A write to any of these outside the guard is a second door. */
const LAW_KEYS = new Set([
  'basePitchMM',
  'pitchMM',
  'paddingMM',
  'maxSizeMM',
  'positionsPerAxis',
  'registration',
])

/** The released law values, read from the spec itself so this list cannot drift from it. */
const RELEASED_VALUES = (() => {
  const src = readFileSync(join(UNIT, 'spec.ts'), 'utf8')
  const block = src.slice(src.indexOf('export const RELEASED'))
  const found = new Set<number>()
  for (const [, v] of block.matchAll(/(?:basePitchMM|pitchMM|paddingMM|maxSizeMM):\s*(\d+)/g)) {
    found.add(Number(v))
  }
  return found
})()

const walkAst = (src: string, visit: (n: ts.Node) => void) => {
  const parsed = ts.createSourceFile('x.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const go = (n: ts.Node) => {
    visit(n)
    ts.forEachChild(n, go)
  }
  go(parsed)
}

const codeLines = (text: string) =>
  text
    .split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => line && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))

describe('1 — the unit is portable', () => {
  it('imports nothing from React, Next or a stylesheet — including under ui/', () => {
    for (const { file, text } of readTree(UNIT, /\.ts$/)) {
      expect(text, `${file} must not depend on a framework`).not.toMatch(
        /from ['"](react|next|next\/.*)['"]|\.css['"]/,
      )
    }
  })

  it('the three files that travel know nothing about screens', () => {
    for (const { file, text } of portable()) {
      for (const { line, n } of codeLines(text)) {
        expect(line, `${file}:${n} names a screen concern`).not.toMatch(
          /\b(zoom|pixel|px|viewBox|camera|screen)\b/i,
        )
      }
    }
  })

  it('the three files that travel import nothing outward — not even from ui/', () => {
    for (const { file, text } of portable()) {
      const outward = [...text.matchAll(/from ['"](@\/[^'"]+|\.\.\/[^'"]+)['"]/g)].map((m) => m[1])
      expect(outward, `${file} imports outward: ${outward.join(', ')}`).toEqual([])
    }
  })
})

describe('2 — the UI does screen maths only', () => {
  const ui = read(SHELL, /\.tsx?$/)

  it('never derives lattice positions itself', () => {
    // Multiplying or dividing BY a law value is grid arithmetic and belongs in the engine.
    const latticeMaths =
      /[*/]\s*(basePitchMM|pitchMM|paddingMM)\b|\b(basePitchMM|pitchMM|paddingMM)\s*[*/]/
    for (const { file, text } of ui) {
      const offending = codeLines(text).filter(({ line }) => latticeMaths.test(line))
      expect(offending, `${file} does lattice arithmetic: ${JSON.stringify(offending)}`).toEqual([])
    }
  })

  it('never computes the population stride or the registration', () => {
    for (const { file, text } of ui) {
      expect(text, `${file} must ask the unit, not derive the lattice itself`).not.toMatch(
        /populationStride\s*\(|registrationOffsetMM\s*\(|%\s*stride/,
      )
    }
  })
})

describe('3 — law values move only through the guard', () => {
  it('the shell never assigns into the spec directly', () => {
    for (const { file, text } of read(SHELL, /\.tsx?$/)) {
      expect(text, `${file} must not write the spec directly`).not.toMatch(
        /grid:\s*\{\s*\.\.\.[a-z]+\.grid,/i,
      )
    }
  })
})

describe('4 — traffic is one-way: shell → bridge → unit', () => {
  it('the shell reaches the unit only through the bridge, the spec or ui/', () => {
    // The old pattern matched `grid-engine/<one-segment>` only, so every NESTED import — the two the
    // shell actually makes, `ui/camera` and `ui/trace-cutout` — slipped past it entirely. It passed
    // because the path shape escaped the regex, not because the rule held.
    for (const { file, text } of read(SHELL, /\.tsx?$/)) {
      const imports = [...text.matchAll(/from ['"]@\/lib\/grid-engine\/([^'"]+)['"]/g)].map((m) => m[1])
      const past = imports.filter((i) => !/^(bridge|spec|ui\/[\w-]+)$/.test(i))
      expect(past, `${file} reaches past the bridge: ${past.join(', ')}`).toEqual([])
    }
  })

  it('the unit never imports from the app — anywhere in the tree', () => {
    for (const { file, text } of readTree(UNIT, /\.ts$/)) {
      expect(text, `${file} must not import from the app`).not.toMatch(/from ['"]@\/app\//)
    }
  })
})

/**
 * STRUCTURAL GUARDS — the class, not the instances.
 *
 * Every guard above this block was pattern-shaped, so each escape was simply a spelling the pattern
 * did not anticipate: a directory it never listed, a two-segment import path, a sibling key beside
 * the one it watched, a bare literal with no arithmetic to notice. Four separate findings, one
 * defect. These read the SYNTAX TREE instead, so a rename, a reformat or a different spelling does
 * not walk through.
 */
describe('the class, not the instances', () => {
  it('no surface writes a law value outside the guard', () => {
    // `{ ...sp, registration: x }` is a write. So is `{ ...spec.grid, pitchMM: n }`. The old check
    // looked for the literal text `grid: { ...x.grid,` — registration is a SIBLING key and walked
    // straight past it, which is how P3 lived in the shell unseen.
    for (const { file, text } of read(SHELL, /\.tsx?$/)) {
      const hits: string[] = []
      walkAst(text, (n) => {
        if (!ts.isPropertyAssignment(n)) return
        const name = n.name.getText()
        if (LAW_KEYS.has(name)) hits.push(`${name}: ${n.getText().slice(0, 40)}`)
      })
      expect(hits, `${file} writes law values directly: ${hits.join(' · ')}`).toEqual([])
    }
  })

  it('no surface carries a released law value as a bare literal', () => {
    // P4 was `RULE_FINE_MM = 12` — the atom, in a drawing surface. No arithmetic, so the operator
    // regex above had nothing to catch. The values come from the spec, so this cannot drift from it.
    for (const { file, text } of read(SHELL, /\.tsx?$/)) {
      const hits: string[] = []
      walkAst(text, (n) => {
        if (ts.isNumericLiteral(n) && RELEASED_VALUES.has(Number(n.text))) {
          hits.push(`${n.text} in \`${n.parent.getText().slice(0, 50)}\``)
        }
      })
      expect(hits, `${file} hardcodes a released law value: ${hits.join(' · ')}`).toEqual([])
    }
  })

  it('the ui submodule does no lattice arithmetic', () => {
    // ui/ may reach outward — it is the adapter — but it may not compute the grid. Nothing checked
    // this before, because nothing read the directory at all.
    const submodule = readTree(UNIT, /\.ts$/).filter((f) => f.file.includes('/'))
    expect(submodule.length, 'no submodule files found — this guard would pass vacuously').toBeGreaterThan(0)
    for (const { file, text } of submodule) {
      expect(text, `${file} touches a law value`).not.toMatch(
        /\b(basePitchMM|pitchMM|paddingMM|positionsPerAxis)\b/,
      )
    }
  })
})

/**
 * The two subs, checked by READING THE TREE rather than the text.
 *
 * These were line-greps until s62-meta attacked them and got 7 of 9 and 8 of 9 past — including both
 * real prior violations verbatim, because the regex only fired when the operator came after the
 * property. Formatting, destructuring, aliasing, a rename, a line break or Math.* all walked through.
 * An AST walk cannot be evaded that way: it sees the operation, not its spelling.
 */
describe('the two subs stay apart', () => {
  const ARITHMETIC = new Set([
    ts.SyntaxKind.AsteriskToken,
    ts.SyntaxKind.SlashToken,
    ts.SyntaxKind.PercentToken,
    ts.SyntaxKind.PlusToken,
    ts.SyntaxKind.MinusToken,
    ts.SyntaxKind.AsteriskAsteriskToken,
  ])
  /** Small integers are structural — identity, off-by-one, halving. Anything else is a law value. */
  const STRUCTURAL = new Set([0, 1, 2])

  const walk = (src: string, visit: (n: ts.Node) => void) => {
    const parsed = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true)
    const go = (n: ts.Node) => {
      visit(n)
      ts.forEachChild(n, go)
    }
    go(parsed)
  }

  it('SUB 2 — the spec is the feed, not the calculator', () => {
    const src = readFileSync(join(UNIT, 'spec.ts'), 'utf8')
    const hits: string[] = []
    walk(src, (n) => {
      if (ts.isBinaryExpression(n) && ARITHMETIC.has(n.operatorToken.kind)) {
        hits.push(`arithmetic: ${n.getText().slice(0, 60)}`)
      }
      if (ts.isCallExpression(n) && /^Math\./.test(n.expression.getText())) {
        hits.push(`computes via ${n.expression.getText()}()`)
      }
    })
    expect(hits, `spec.ts computes: ${hits.join(' · ')}`).toEqual([])
  })

  it('SUB 1 — the engine holds no values of its own', () => {
    const src = readFileSync(join(UNIT, 'engine.ts'), 'utf8')
    const hits: string[] = []
    walk(src, (n) => {
      if (ts.isNumericLiteral(n) && !STRUCTURAL.has(Number(n.text))) {
        hits.push(`law value ${n.text} baked into engine source`)
      }
      if (ts.isStringLiteral(n) && n.text.trim() !== '' && Number.isFinite(Number(n.text))) {
        hits.push(`numeric value smuggled as string "${n.text}"`)
      }
    })
    expect(hits, `engine.ts declares values: ${hits.join(' · ')}`).toEqual([])
  })
})

describe('the canvas is clean', () => {
  const canvas = readFileSync(join(SHELL, 'GridCanvas.tsx'), 'utf8')

  it('draws no controls', () => {
    expect(canvas).not.toMatch(/<button|onClick=/)
  })

  it('draws no labels or readouts', () => {
    expect(canvas).not.toMatch(/<text[\s>]|className=\{styles\.readout\}/)
  })
})
