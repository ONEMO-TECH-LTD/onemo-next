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
const PORTABLE = [
  'engine.ts',
  'spec.ts',
  'bridge.ts',
  'measure.ts',
  'enumerate.ts',
  'candidates.ts',
  'select.ts',
] as const
const portable = () => PORTABLE.map((f) => ({ file: f, text: readFileSync(join(UNIT, f), 'utf8') }))

const walkAst = (src: string, visit: (n: ts.Node) => void) => {
  const parsed = ts.createSourceFile('x.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const go = (n: ts.Node) => {
    visit(n)
    ts.forEachChild(n, go)
  }
  go(parsed)
}

/**
 * EVERY law name and EVERY released value, READ OUT OF THE SPEC'S OWN DECLARATION.
 *
 * Both were hand-written lists — six key names, and a regex that re-enumerated five of them. That is
 * the same defect the guards below exist to catch, committed inside the guards themselves: add a law
 * value to the spec tomorrow and neither list knows about it, so the new value is unguarded from the
 * moment it exists and every test still passes. A guard that must be edited whenever the thing it
 * guards changes will eventually not be edited.
 *
 * Walking `RELEASED` instead means the sets ARE the spec. It is also strictly wider than the lists
 * it replaces — it picks up the `grid` and `magnet` containers and the magnet bodies 6 and 8, which
 * nothing enumerated before — and the shell is clean under the wider set, so nothing is being
 * excused here.
 */
const { LAW_KEYS, RELEASED_VALUES } = (() => {
  const src = readFileSync(join(UNIT, 'spec.ts'), 'utf8')
  const keys = new Set<string>()
  const values = new Set<number>()
  let declaration: ts.Node | undefined
  walkAst(src, (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText() === 'RELEASED') declaration = n
  })
  if (!declaration) throw new Error('spec.ts declares no RELEASED — the guards have no source')
  const collect = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n)) {
      keys.add(n.name.getText())
      if (ts.isNumericLiteral(n.initializer)) values.add(Number(n.initializer.text))
    }
    ts.forEachChild(n, collect)
  }
  collect(declaration)
  return { LAW_KEYS: keys, RELEASED_VALUES: values }
})()

/**
 * THE GUARDS THEMSELVES, as pure functions over one file's text.
 *
 * Extracted so the mutation fixtures below run through the SAME code that reads the real tree. A
 * fixture that exercises a re-implementation proves nothing about the guard that ships.
 */
const findFrameworkImport = (text: string) =>
  [...text.matchAll(/from ['"](react|next|next\/[^'"]*)['"]|(\S+\.css)['"]/g)].map((m) => m[0])

const findReachPastBridge = (text: string) =>
  [...text.matchAll(/from ['"]@\/lib\/grid-engine\/([^'"]+)['"]/g)]
    .map((m) => m[1])
    .filter((i) => !/^(bridge|spec|ui\/[\w-]+)$/.test(i))

const findLawWrite = (text: string) => {
  const hits: string[] = []
  walkAst(text, (n) => {
    if (!ts.isPropertyAssignment(n)) return
    const name = n.name.getText()
    if (LAW_KEYS.has(name)) hits.push(`${name}: ${n.getText().slice(0, 40)}`)
  })
  return hits
}

const findBareLawValue = (text: string) => {
  const hits: string[] = []
  walkAst(text, (n) => {
    if (ts.isNumericLiteral(n) && RELEASED_VALUES.has(Number(n.text))) {
      hits.push(`${n.text} in \`${n.parent.getText().slice(0, 50)}\``)
    }
  })
  return hits
}

const codeLines = (text: string) =>
  text
    .split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => line && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))

describe('1 — the unit is portable', () => {
  it('imports nothing from React, Next or a stylesheet — including under ui/', () => {
    const tree = readTree(UNIT, /\.ts$/)
    expect(tree.length, 'unit traversal found nothing — this guard would pass vacuously').toBeGreaterThan(0)
    for (const { file, text } of tree) {
      const hits = findFrameworkImport(text)
      expect(hits, `${file} depends on a framework: ${hits.join(' · ')}`).toEqual([])
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
      const past = findReachPastBridge(text)
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
      const hits = findLawWrite(text)
      expect(hits, `${file} writes law values directly: ${hits.join(' · ')}`).toEqual([])
    }
  })

  it('no surface carries a released law value as a bare literal', () => {
    // P4 was `RULE_FINE_MM = 12` — the atom, in a drawing surface. No arithmetic, so the operator
    // regex above had nothing to catch. The values come from the spec, so this cannot drift from it.
    for (const { file, text } of read(SHELL, /\.tsx?$/)) {
      const hits = findBareLawValue(text)
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
/**
 * MUTATION FIXTURES — the four escape classes, each reintroduced on purpose.
 *
 * KAI-10282's acceptance asks that each escape class be PROVEN to fail. It was proven by hand: I
 * reintroduced all five defects into the tree, watched four go red and caught the fifth guard passing
 * vacuously. None of that was executable, so it protected exactly one afternoon. A falsification that
 * lives in a ledger is a story about a test, not a test.
 *
 * These run the SAME functions the tree is read with — extracted above for that reason. A fixture
 * against a re-implementation would prove nothing about the guard that ships.
 *
 * Each case asserts BOTH directions: the escape is caught, and the legal spelling next to it is not.
 * Only the pair is meaningful — a guard that fires on everything is as useless as one that never does.
 */
describe('mutation fixtures — every escape class is caught, and legal code is not', () => {
  it('CLASS 1 · a framework import in a NESTED unit file', () => {
    // The traversal listed one directory level, so all of ui/ was unguarded. Two halves: the walk
    // must actually reach nested files, and the check must fire on one.
    const nested = readTree(UNIT, /\.ts$/).filter((f) => f.file.includes('/'))
    expect(nested.length, 'traversal reaches no nested file — the guard would pass vacuously').toBeGreaterThan(0)

    expect(findFrameworkImport(`import { useRef } from 'react'`)).not.toEqual([])
    expect(findFrameworkImport(`import styles from './camera.css'`)).not.toEqual([])
    expect(findFrameworkImport(`import { magnetsInRegion } from '../engine'`)).toEqual([])
  })

  it('CLASS 2 · a NESTED unit import path from the shell', () => {
    // `grid-engine/<one-segment>` was the old pattern, so `ui/camera` — which the shell really does
    // import — slipped past. Anything deeper than the adapter is reaching past the bridge.
    expect(findReachPastBridge(`import { x } from '@/lib/grid-engine/engine'`)).toEqual(['engine'])
    expect(findReachPastBridge(`import { x } from '@/lib/grid-engine/ui/deep/inner'`)).toEqual([
      'ui/deep/inner',
    ])
    expect(findReachPastBridge(`import { bandSpan } from '@/lib/grid-engine/bridge'`)).toEqual([])
    expect(findReachPastBridge(`import { pinchFactor } from '@/lib/grid-engine/ui/camera'`)).toEqual([])
  })

  it('CLASS 3 · a law-value write as a SIBLING key, not just under `grid`', () => {
    // The old check looked for the literal text `grid: { ...x.grid,`. `registration` sits beside it,
    // which is how the registration bypass lived in the shell unseen.
    expect(findLawWrite(`const next = { ...spec, registration: 'gap' }`)).not.toEqual([])
    expect(findLawWrite(`const next = { ...spec, grid: { ...spec.grid, pitchMM: 96 } }`)).not.toEqual([])
    // reads are not writes, and a same-named local is not the spec
    expect(findLawWrite(`const p = spec.grid.pitchMM`)).toEqual([])
    expect(findLawWrite(`setSize(bandSpan(spec, 3))`)).toEqual([])
  })

  it('CLASS 4 · a bare released value with no arithmetic to notice it', () => {
    // `RULE_FINE_MM = 12` — the atom, sitting in a drawing surface. No operator, so the arithmetic
    // regex had nothing to catch.
    expect(findBareLawValue(`const RULE_FINE_MM = 12`)).not.toEqual([])
    expect(findBareLawValue(`const rows = 9`)).not.toEqual([])
    expect(findBareLawValue(`const body = 6`)).not.toEqual([]) // magnet body — only the WIDER set sees this
    expect(findBareLawValue(`const gap = 4`)).toEqual([])
    expect(findBareLawValue(`const half = n / 2`)).toEqual([])
  })

  it('the derived sets ARE the spec, not a list beside it', () => {
    // If someone adds a law value, these must grow on their own. Named here so the failure reads as
    // "the spec changed" rather than as a mystery.
    expect([...LAW_KEYS].sort()).toEqual(
      ['basePitchMM', 'grid', 'largeMM', 'magnet', 'maxSizeMM', 'paddingMM', 'pitchMM', 'positionsPerAxis', 'registration', 'smallMM'],
    )
    expect([...RELEASED_VALUES].sort((a, b) => a - b)).toEqual([6, 8, 9, 12, 48, 310])
  })
})

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
