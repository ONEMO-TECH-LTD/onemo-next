// s62-meta — the replacement for the two regex checks.
// Two line-greps out, one AST walk in. Exact, not heuristic: formatting, destructuring, aliasing,
// multi-line and naming are all invisible to it because it reads the tree, not the text.

import ts from '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-canvas/node_modules/typescript/lib/typescript.js'

const ARITHMETIC = new Set([
  ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskAsteriskToken,
])

/** Small integers are structural — identity, off-by-one, halving. Anything else is a law value. */
const STRUCTURAL = new Set([0, 1, 2])

const walk = (src, visit) => {
  const parsed = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true)
  const go = (n) => { visit(n); ts.forEachChild(n, go) }
  go(parsed)
}

/** SUB 2 — the spec is the feed, not the calculator: no arithmetic anywhere in it. */
export const specDoesArithmetic = (src) => {
  const hits = []
  walk(src, (n) => {
    if (ts.isBinaryExpression(n) && ARITHMETIC.has(n.operatorToken.kind))
      hits.push(`arithmetic: ${n.getText().slice(0, 60)}`)
    if (ts.isCallExpression(n) && /^Math\./.test(n.expression.getText()))
      hits.push(`computes via ${n.expression.getText()}()`)
  })
  return hits
}

/** SUB 1 — the engine holds no values: no numeric literal beyond the structural {0,1,2}. */
export const engineDeclaresValues = (src) => {
  const hits = []
  walk(src, (n) => {
    if (ts.isNumericLiteral(n) && !STRUCTURAL.has(Number(n.text)))
      hits.push(`law value ${n.text} baked in engine source`)
    if (ts.isStringLiteral(n) && n.text.trim() !== '' && Number.isFinite(Number(n.text)))
      hits.push(`numeric value smuggled as string "${n.text}"`)
  })
  return hits
}

// ── prove it against every case that evaded the regexes ─────────────────────
if (process.argv[2] === '--attack') {
  const A = [
    ['the real prior violation, verbatim', 'return 2 * grid.paddingMM'],
    ['the other real one, verbatim', 'const stride = grid.pitchMM / grid.basePitchMM'],
    ['destructure first', 'const { paddingMM } = grid\nreturn 2 * paddingMM'],
    ['alias the spec', 'const g = grid\nreturn g.paddingMM * 2'],
    ['operator on the next line', 'return grid.paddingMM\n  * 2'],
    ['Math.* instead of an operator', 'return Math.max(grid.paddingMM, grid.pitchMM)'],
    ['arithmetic on locals only', 'const PAD = 10\nreturn 2 * PAD'],
    ['reduce over values', 'return [grid.pitchMM, grid.paddingMM].reduce((a, b) => a * b)'],
    ['exponent operator', 'return grid.paddingMM ** 2'],
  ]
  const B = [
    ['screaming exported literal', 'export const BASE_PITCH_MM = 48'],
    ['camelCase name', 'export const basePitchFallbackMM = 48'],
    ['not exported', 'const BASE_PITCH_MM = 48'],
    ['object literal', 'export const DEFAULTS = { pitchMM: 48, paddingMM: 10 }'],
    ['default parameter', 'export function reg(grid, offsetMM = 24) { return offsetMM }'],
    ['inline literal in a formula', 'return grid.basePitchMM - 20'],
    ['local inside a function', 'function f() { const PAD = 10; return PAD }'],
    ['wrapped as a string', "export const PITCH_MM = Number('48')"],
    ['array of values', 'export const PITCHES_MM = [48, 96]'],
  ]
  const run = (t, cases, fn) => {
    console.log(`\n${t}`); console.log('─'.repeat(88))
    let missed = 0
    for (const [label, src] of cases) {
      const hits = fn(src)
      if (!hits.length) missed++
      console.log(`  ${hits.length ? 'CAUGHT ' : 'EVADES '} │ ${label.padEnd(32)} │ ${hits[0] ?? '—'}`)
    }
    console.log(`  → ${cases.length - missed}/${cases.length} caught`)
  }
  run('CHECK A replacement — spec does no arithmetic (AST)', A, specDoesArithmetic)
  run('CHECK B replacement — engine holds no values (AST)', B, engineDeclaresValues)

  // and it must not false-positive on the real files
  const fs = await import('node:fs')
  const U = '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-canvas/src/lib/grid-engine'
  console.log('\nAGAINST THE REAL TREE'); console.log('─'.repeat(88))
  console.log('  spec.ts  ', JSON.stringify(specDoesArithmetic(fs.readFileSync(`${U}/spec.ts`, 'utf8'))))
  console.log('  engine.ts', JSON.stringify(engineDeclaresValues(fs.readFileSync(`${U}/engine.ts`, 'utf8'))))
}
