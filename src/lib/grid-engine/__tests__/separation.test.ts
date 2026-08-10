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
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const UNIT = join(process.cwd(), 'src/lib/grid-engine')
const SHELL = join(process.cwd(), 'src/app/(dev)/grid-engine')

const read = (dir: string, filter: RegExp) =>
  readdirSync(dir)
    .filter((f) => filter.test(f))
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }))

const codeLines = (text: string) =>
  text
    .split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => line && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))

describe('1 — the unit is portable', () => {
  it('imports nothing from React, Next or a stylesheet', () => {
    for (const { file, text } of read(UNIT, /\.ts$/)) {
      expect(text, `${file} must not depend on a framework`).not.toMatch(
        /from ['"](react|next|next\/.*)['"]|\.css['"]/,
      )
    }
  })

  it('knows nothing about screens', () => {
    for (const { file, text } of read(UNIT, /\.ts$/)) {
      for (const { line, n } of codeLines(text)) {
        expect(line, `${file}:${n} names a screen concern`).not.toMatch(
          /\b(zoom|pixel|px|viewBox|camera|screen)\b/i,
        )
      }
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

describe('3b — publication belongs to the unit', () => {
  it('the shell never rounds a size itself', () => {
    // Law 5.3: a surface holding a number the engine did not produce is how a screen goes stale.
    for (const { file, text } of read(SHELL, /\.tsx?$/)) {
      const rounding = codeLines(text).filter(({ line }) =>
        /Math\.(ceil|floor|round)\s*\([^)]*(size|mm)/i.test(line),
      )
      expect(rounding, `${file} rounds a size: ${JSON.stringify(rounding)}`).toEqual([])
    }
  })
})

describe('4 — traffic is one-way: shell → bridge → unit', () => {
  it('the shell reaches the unit only through the bridge', () => {
    for (const { file, text } of read(SHELL, /\.tsx?$/)) {
      const imports = text.match(/from ['"]@\/lib\/grid-engine\/[a-z]+['"]/g) ?? []
      const past = imports.filter((i) => !/\/(bridge|spec)['"]$/.test(i))
      expect(past, `${file} reaches past the bridge: ${past.join(', ')}`).toEqual([])
    }
  })

  it('the unit never imports from the app', () => {
    for (const { file, text } of read(UNIT, /\.ts$/)) {
      expect(text, `${file} must not import from the app`).not.toMatch(/from ['"]@\/app\//)
    }
  })

  it('the unit depends on no sibling of this repo', () => {
    // s62-meta, 2026-08-10: a third-party package travels with the unit; a sibling module does not.
    // The repo already wraps clipper2 twice (vector-core/clipper-kernel, effect/offset) and either
    // import would tie the unit to onemo-next — the one property it exists to avoid.
    for (const { file, text } of read(UNIT, /\.ts$/)) {
      const siblings = (text.match(/from ['"]@\/lib\/[a-z-]+/g) ?? []).filter(
        (i) => !i.endsWith('@/lib/grid-engine'),
      )
      expect(siblings, `${file} depends on repo code: ${siblings.join(', ')}`).toEqual([])
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
