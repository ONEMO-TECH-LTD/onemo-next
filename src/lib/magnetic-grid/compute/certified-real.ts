// Neutral certified reals (R14 §7.1b item 4: "CertifiedExpressionReal, evaluated by
// deterministic BigInt interval arithmetic with directed bounds"). A value is an exact expression
// over rationals; evaluation at a precision yields a dyadic interval proven to contain it.
// Ordering decisions succeed when intervals separate and refine on demand; a rational-only
// expression decides exactly; an expression the bounds cannot separate is reported undecided —
// never rounded into a verdict.

import type { Rational } from '../spec'
import { compareExact, isqrt, ratFromInt, ratSign, rational, sqrtInterval } from './exact-real'

export type CReal =
  | { readonly k: 'rat'; readonly v: Rational }
  | { readonly k: 'add' | 'sub' | 'mul' | 'div'; readonly a: CReal; readonly b: CReal }
  | { readonly k: 'neg' | 'sqrt'; readonly a: CReal }

export interface Interval { readonly lo: Rational; readonly hi: Rational }

export const cRat = (v: Rational): CReal => ({ k: 'rat', v })
export const cInt = (v: bigint | number): CReal => cRat(ratFromInt(v))
export const cAdd = (a: CReal, b: CReal): CReal => ({ k: 'add', a, b })
export const cSub = (a: CReal, b: CReal): CReal => ({ k: 'sub', a, b })
export const cMul = (a: CReal, b: CReal): CReal => ({ k: 'mul', a, b })
export const cDiv = (a: CReal, b: CReal): CReal => ({ k: 'div', a, b })
export const cNeg = (a: CReal): CReal => ({ k: 'neg', a })
/** Square root — stays exact when the operand is a rational perfect square (axis-aligned and
 *  Pythagorean edge lengths), so tangencies between such elements decide exactly. */
export const cSqrt = (a: CReal): CReal => {
  if (isRationalExpr(a)) {
    const v = exactRational(a)
    if (v.n >= BigInt(0)) {
      const rn = isqrt(v.n), rd = isqrt(v.d)
      if (rn * rn === v.n && rd * rd === v.d) return cRat(rational(rn, rd))
    }
  }
  return { k: 'sqrt', a }
}

export function isRationalExpr(e: CReal): boolean {
  const hit = memoOn ? ratMemo.get(e) : undefined
  if (hit !== undefined) return hit
  let value: boolean
  switch (e.k) {
    case 'rat': value = true; break
    case 'sqrt': value = false; break
    case 'neg': value = isRationalExpr(e.a); break
    default: value = isRationalExpr(e.a) && isRationalExpr(e.b)
  }
  if (memoOn) ratMemo.set(e, value)
  return value
}

/** Exact value of a rational-only expression. */
export function exactRational(e: CReal): Rational {
  switch (e.k) {
    case 'rat': return e.v
    case 'neg': { const v = exactRational(e.a); return { n: -v.n, d: v.d } }
    case 'sqrt': throw new Error('exactRational: sqrt is not rational')
    default: {
      const a = exactRational(e.a), b = exactRational(e.b)
      if (e.k === 'add') return rational(a.n * b.d + b.n * a.d, a.d * b.d)
      if (e.k === 'sub') return rational(a.n * b.d - b.n * a.d, a.d * b.d)
      if (e.k === 'mul') return rational(a.n * b.n, a.d * b.d)
      return rational(a.n * b.d, a.d * b.n)
    }
  }
}

// Directed rounding to the dyadic grid 2^-bits: lower bound floors, upper bound ceils.
const floorDyadic = (r: Rational, bits: bigint): Rational => {
  const scale = BigInt(1) << bits
  let q = (r.n * scale) / r.d
  if (r.n < BigInt(0) && (r.n * scale) % r.d !== BigInt(0)) q -= BigInt(1)
  return rational(q, scale)
}
const ceilDyadic = (r: Rational, bits: bigint): Rational => {
  const scale = BigInt(1) << bits
  let q = (r.n * scale) / r.d
  if (r.n > BigInt(0) && (r.n * scale) % r.d !== BigInt(0)) q += BigInt(1)
  return rational(q, scale)
}
const iv = (lo: Rational, hi: Rational, bits: bigint): Interval => ({ lo: floorDyadic(lo, bits), hi: ceilDyadic(hi, bits) })
const add = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a: Rational, b: Rational) => rational(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d)
const div = (a: Rational, b: Rational) => rational(a.n * b.d, a.d * b.n)
const minR = (...xs: Rational[]) => xs.reduce((m, x) => (compareExact(x, m) < 0 ? x : m))
const maxR = (...xs: Rational[]) => xs.reduce((m, x) => (compareExact(x, m) > 0 ? x : m))

// Memo tables. An expression node is immutable, so its enclosure at a given precision and its
// quadratic normal form are functions of the node alone — identical values, computed once. The
// certified construction shares subtrees heavily (one branch's base point feeds every clip root),
// so without this the same subtree is re-walked thousands of times per region.
// R14 §7.3: reuse changes cost only — certificates and results must be byte-identical with caches
// disabled. `certifiedMemo` makes that falsifiable rather than asserted: switched off, every lookup
// and store is bypassed and each value is recomputed from the node; the fixtures compare both modes.
let evalMemo = new WeakMap<object, Map<string, Interval>>()
let ratMemo = new WeakMap<object, boolean>()
let memoOn = true

/** Neutral cache control. Disabling it changes cost, never a value. */
export function certifiedMemo(enabled: boolean): void {
  memoOn = enabled
  resetCertifiedMemo()
}

/** Drop every memoized enclosure/normal form, so a later call recomputes from the node. */
export function resetCertifiedMemo(): void {
  evalMemo = new WeakMap()
  ratMemo = new WeakMap()
  quadMemo = new WeakMap()
}

/** Certified enclosure of the expression at `bits` of dyadic precision. A rational-only
 *  expression is returned exactly, zero-width — rounding is only for radicals. */
export function evaluate(e: CReal, bits: bigint): Interval {
  if (!memoOn) return evaluateUncached(e, bits)
  const key = bits.toString()
  let table = evalMemo.get(e)
  const hit = table?.get(key)
  if (hit) return hit
  const value = evaluateUncached(e, bits)
  if (!table) { table = new Map(); evalMemo.set(e, table) }
  table.set(key, value)
  return value
}

function evaluateUncached(e: CReal, bits: bigint): Interval {
  if (e.k !== 'rat' && isRationalExpr(e)) { const v = exactRational(e); return { lo: v, hi: v } }
  switch (e.k) {
    case 'rat': return { lo: e.v, hi: e.v }
    case 'neg': { const a = evaluate(e.a, bits); return { lo: { n: -a.hi.n, d: a.hi.d }, hi: { n: -a.lo.n, d: a.lo.d } } }
    case 'sqrt': {
      const a = evaluate(e.a, bits)
      if (ratSign(a.hi) < 0) throw new Error('evaluate: sqrt of a negative enclosure')
      const lo = ratSign(a.lo) < 0 ? ratFromInt(0) : sqrtInterval(a.lo, BigInt(1) << bits).lo
      const hi = sqrtInterval(a.hi, BigInt(1) << bits).hi
      return iv(lo, hi, bits)
    }
    default: {
      const a = evaluate(e.a, bits), b = evaluate(e.b, bits)
      if (e.k === 'add') return iv(add(a.lo, b.lo), add(a.hi, b.hi), bits)
      if (e.k === 'sub') return iv(sub(a.lo, b.hi), sub(a.hi, b.lo), bits)
      if (e.k === 'mul') {
        const p = [mul(a.lo, b.lo), mul(a.lo, b.hi), mul(a.hi, b.lo), mul(a.hi, b.hi)]
        return iv(minR(...p), maxR(...p), bits)
      }
      if (ratSign(b.lo) <= 0 && ratSign(b.hi) >= 0) throw new Error('evaluate: division by an enclosure containing zero')
      const q = [div(a.lo, b.lo), div(a.lo, b.hi), div(a.hi, b.lo), div(a.hi, b.hi)]
      return iv(minR(...q), maxR(...q), bits)
    }
  }
}

const PRECISIONS = [BigInt(64), BigInt(128), BigInt(256), BigInt(512), BigInt(1024)]

/** A value in one quadratic field: a + b·√k with a, b rational and k a positive integer. */
export interface Quadratic { readonly a: Rational; readonly b: Rational; readonly k: bigint }

const qAdd = (x: Rational, y: Rational) => rational(x.n * y.d + y.n * x.d, x.d * y.d)
const qSub = (x: Rational, y: Rational) => rational(x.n * y.d - y.n * x.d, x.d * y.d)
const qMul = (x: Rational, y: Rational) => rational(x.n * y.n, x.d * y.d)
const qDiv = (x: Rational, y: Rational) => rational(x.n * y.d, x.d * y.n)
const qZero = ratFromInt(0)
const sameField = (p: Quadratic, q: Quadratic): bigint | null =>
  p.b.n === BigInt(0) ? q.k : q.b.n === BigInt(0) ? p.k : p.k === q.k ? p.k : null

let quadMemo = new WeakMap<object, { q: Quadratic | null }>()

/**
 * Exact normal form when the expression lives in a single quadratic field (at most one distinct
 * square root). Nested or mixed radicals return null and fall back to certified enclosures.
 */
export function asQuadratic(e: CReal): Quadratic | null {
  if (!memoOn) return asQuadraticUncached(e)
  const hit = quadMemo.get(e)
  if (hit) return hit.q
  const q = asQuadraticUncached(e)
  quadMemo.set(e, { q })
  return q
}

function asQuadraticUncached(e: CReal): Quadratic | null {
  switch (e.k) {
    case 'rat': return { a: e.v, b: qZero, k: BigInt(1) }
    case 'neg': { const q = asQuadratic(e.a); return q && { a: { n: -q.a.n, d: q.a.d }, b: { n: -q.b.n, d: q.b.d }, k: q.k } }
    case 'sqrt': {
      const q = asQuadratic(e.a)
      if (!q || q.b.n !== BigInt(0) || q.a.n < BigInt(0)) return null
      // √(n/d) = √(n·d) / d
      const rad = q.a.n * q.a.d
      const root = isqrt(rad)
      if (root * root === rad) return { a: rational(root, q.a.d), b: qZero, k: BigInt(1) }
      return { a: qZero, b: rational(BigInt(1), q.a.d), k: rad }
    }
    default: {
      const p = asQuadratic(e.a), q = asQuadratic(e.b)
      if (!p || !q) return null
      const k = sameField(p, q)
      if (k === null) return null
      if (e.k === 'add') return { a: qAdd(p.a, q.a), b: qAdd(p.b, q.b), k }
      if (e.k === 'sub') return { a: qSub(p.a, q.a), b: qSub(p.b, q.b), k }
      if (e.k === 'mul') return { a: qAdd(qMul(p.a, q.a), qMul(qMul(p.b, q.b), ratFromInt(k))), b: qAdd(qMul(p.a, q.b), qMul(p.b, q.a)), k }
      // division: multiply by the conjugate; denominator a² − b²k is rational and non-zero unless q = 0
      const den = qSub(qMul(q.a, q.a), qMul(qMul(q.b, q.b), ratFromInt(k)))
      if (den.n === BigInt(0)) return null
      const num = { a: qSub(qMul(p.a, q.a), qMul(qMul(p.b, q.b), ratFromInt(k))), b: qSub(qMul(p.b, q.a), qMul(p.a, q.b)) }
      return { a: qDiv(num.a, den), b: qDiv(num.b, den), k }
    }
  }
}

/** Exact sign of a + b√k. */
export function quadraticSign(q: Quadratic): -1 | 0 | 1 {
  const sa = ratSign(q.a), sb = ratSign(q.b)
  if (sb === 0) return sa
  if (sa === 0) return sb
  if (sa === sb) return sa
  // opposite signs: compare a² against b²·k
  const c = compareExact(qMul(q.a, q.a), qMul(qMul(q.b, q.b), ratFromInt(q.k)))
  return c > 0 ? sa : c < 0 ? sb : 0
}

/**
 * Exact values over several square roots.
 *
 * The offset arrangement needs this: a convex miter is built from two edges' offset lines, so its
 * coordinates carry both edges' length radicals, and asking whether a third edge's crossing lands
 * exactly on that miter compares a value living in three radicals at once. Interval refinement can
 * prove such a value nonzero but never zero, and the single-quadratic-field form cannot express it.
 *
 * Soundness rests on one invariant: the atoms are PAIRWISE COPRIME and none is a perfect square.
 * Radicands are not independent generators — √2·√3 and √6 are the same number, and a form storing
 * them under different keys would call their difference nonzero. Under the invariant the products
 * √(∏S) are linearly independent over the rationals, so a value is zero exactly when every
 * coefficient is zero — which is what makes an equality provable rather than merely unrefuted.
 *
 * TWO PASSES, so the basis is immutable while coefficients are encoded. Pass one walks the
 * expression and collects every radicand; the atoms are refined once, there and then. Pass two
 * encodes against that finished basis. Nothing can reinterpret an index after it is written, which
 * is the entire class of bug that a mutable, self-splitting basis invites.
 */
type RadicalTerms = Map<string, Rational>

const RADICAL_TERM_LIMIT = 96

const addTerm = (terms: RadicalTerms, key: string, value: Rational) => {
  const prior = terms.get(key)
  const sum = prior ? rational(prior.n * value.d + value.n * prior.d, prior.d * value.d) : value
  if (sum.n === BigInt(0)) terms.delete(key); else terms.set(key, sum)
}
const keyOf = (idx: readonly number[]) => [...idx].sort((a, b) => a - b).join(',')
const idxOf = (key: string) => (key === '' ? [] : key.split(',').map(Number))
const bgcd = (a: bigint, b: bigint): bigint => { let x = a < BigInt(0) ? -a : a, y = b < BigInt(0) ? -b : b; while (y) { const t = x % y; x = y; y = t } return x }
const isSquare = (v: bigint) => { const root = isqrt(v); return root * root === v }

/** Exact rational value of a radical-free expression; null as soon as a root appears. */
function rationalOnly(e: CReal): Rational | null {
  switch (e.k) {
    case 'rat': return e.v
    case 'sqrt': return null
    case 'neg': { const v = rationalOnly(e.a); return v && { n: -v.n, d: v.d } }
    default: {
      const a = rationalOnly(e.a), b = rationalOnly(e.b)
      if (!a || !b) return null
      if (e.k === 'add') return rational(a.n * b.d + b.n * a.d, a.d * b.d)
      if (e.k === 'sub') return rational(a.n * b.d - b.n * a.d, a.d * b.d)
      if (e.k === 'mul') return rational(a.n * b.n, a.d * b.d)
      return b.n === BigInt(0) ? null : rational(a.n * b.d, a.d * b.n)
    }
  }
}

/** PASS ONE: every radicand appearing under a root, or null if one is not rational (nested root). */
function collectRadicands(e: CReal, out: bigint[]): boolean {
  switch (e.k) {
    case 'rat': return true
    case 'neg': return collectRadicands(e.a, out)
    case 'sqrt': {
      const value = rationalOnly(e.a)
      if (!value || ratSign(value) < 0) return false
      if (value.n !== BigInt(0)) out.push(value.n * value.d) // √(n/d) = √(n·d)/d
      return true
    }
    default: return collectRadicands(e.a, out) && collectRadicands(e.b, out)
  }
}

/** Refine a radicand into the coprime, square-free atom set. Perfect squares are rational and are
 *  never atoms; a shared factor splits an existing atom, and the pieces are refined in turn. */
function insertAtom(atoms: bigint[], value: bigint): void {
  let k = value
  if (k <= BigInt(1) || isSquare(k)) return
  for (let i = 0; i < atoms.length && k > BigInt(1); i++) {
    const atom = atoms[i]
    if (atom <= BigInt(1)) continue
    // dividing out an existing atom's square keeps the numbers small; it is a size reduction, not
    // a correctness requirement — the split below is what enforces the invariant
    while (k % (atom * atom) === BigInt(0)) k /= atom * atom
    const g = bgcd(k, atom)
    if (g === BigInt(1)) continue
    if (g < atom) {
      atoms.splice(i, 1)
      insertAtom(atoms, g)
      insertAtom(atoms, atom / g)
      i = -1 // the atom set changed shape: refine this radicand from the start
      continue
    }
    k /= atom
    if (isSquare(k)) k = BigInt(1)
  }
  if (k > BigInt(1) && !isSquare(k) && !atoms.includes(k)) atoms.push(k)
}

function canonicalAtoms(radicands: readonly bigint[]): bigint[] {
  const atoms: bigint[] = []
  for (const value of radicands) insertAtom(atoms, value)
  return atoms.filter((a) => a > BigInt(1)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** PASS TWO helper: √k over the finished atom set, as (rational) × ∏ √atom. */
function decompose(atoms: readonly bigint[], radicand: bigint): { coeff: bigint; idx: number[] } | null {
  let k = radicand
  let coeff = BigInt(1)
  const idx: number[] = []
  const whole = isqrt(k)
  if (whole * whole === k) return { coeff: whole, idx: [] }
  for (let i = 0; i < atoms.length && k > BigInt(1); i++) {
    const atom = atoms[i]
    while (k % (atom * atom) === BigInt(0)) { k /= atom * atom; coeff *= atom }
    if (k % atom === BigInt(0)) {
      k /= atom
      idx.push(i)
      const root = isqrt(k)
      if (root * root === k) { coeff *= root; k = BigInt(1) }
    }
  }
  // the basis was built from exactly these radicands, so nothing irrational may remain
  return k === BigInt(1) ? { coeff, idx } : null
}

const rationalTerms = (value: Rational): RadicalTerms => (value.n === BigInt(0) ? new Map() : new Map([['', value]]))
const isRationalTerms = (terms: RadicalTerms) => [...terms.keys()].every((key) => key === '')

function combine(a: RadicalTerms, b: RadicalTerms, negate: boolean): RadicalTerms {
  const terms = new Map(a)
  for (const [key, coeff] of b) addTerm(terms, key, negate ? { n: -coeff.n, d: coeff.d } : coeff)
  return terms
}

function multiply(atoms: readonly bigint[], a: RadicalTerms, b: RadicalTerms): RadicalTerms | null {
  const terms: RadicalTerms = new Map()
  for (const [ka, ca] of a) for (const [kb, cb] of b) {
    const ia = idxOf(ka), ib = idxOf(kb)
    const shared = ia.filter((i) => ib.includes(i))
    const rest = [...ia, ...ib].filter((i) => !shared.includes(i))
    let coeff = rational(ca.n * cb.n, ca.d * cb.d)
    for (const i of shared) coeff = rational(coeff.n * atoms[i], coeff.d) // √a·√a = a
    addTerm(terms, keyOf(rest), coeff)
    if (terms.size > RADICAL_TERM_LIMIT) return null
  }
  return terms
}

/**
 * a / b with radicals below the line — the ordinary case, since an offset normal is a vector over
 * √(len²). A single monomial inverts by the identity 1/(c·√S) = √S/(c·S); several terms are cleared
 * by conjugates, one atom per round. The atom set never changes here: it was finished in pass one.
 */
function divide(atoms: readonly bigint[], a: RadicalTerms, b: RadicalTerms): RadicalTerms | null {
  if (b.size === 0) return null
  if (b.size === 1) {
    const [key, coeff] = [...b][0]
    if (coeff.n === BigInt(0)) return null
    const idx = idxOf(key)
    // 1/(c·√S) = √S/(c·S)
    let denominator = rational(coeff.n, coeff.d)
    for (const i of idx) denominator = rational(denominator.n * atoms[i], denominator.d)
    const inverse: RadicalTerms = new Map([[keyOf(idx), rational(denominator.d, denominator.n)]])
    return multiply(atoms, a, inverse)
  }
  let num: RadicalTerms | null = a
  let den: RadicalTerms | null = b
  for (let round = 0; round <= atoms.length && den && !isRationalTerms(den); round++) {
    const active = [...den.keys()].flatMap(idxOf)[0]
    if (active === undefined) break
    const conjugate: RadicalTerms = new Map([...den].map(([key, coeff]) =>
      [key, idxOf(key).includes(active) ? { n: -coeff.n, d: coeff.d } : coeff] as const))
    num = multiply(atoms, num, conjugate)
    den = multiply(atoms, den, conjugate)
    if (!num || !den) return null
  }
  if (!num || !den || !isRationalTerms(den)) return null
  const denom = den.get('')
  if (!denom || denom.n === BigInt(0)) return null
  const terms: RadicalTerms = new Map()
  for (const [key, coeff] of num) addTerm(terms, key, rational(coeff.n * denom.d, coeff.d * denom.n))
  return terms
}

/** PASS TWO: encode the expression against the finished atom set. */
function encode(e: CReal, atoms: readonly bigint[]): RadicalTerms | null {
  switch (e.k) {
    case 'rat': return rationalTerms(e.v)
    case 'neg': {
      const inner = encode(e.a, atoms)
      if (!inner) return null
      const terms: RadicalTerms = new Map()
      for (const [key, coeff] of inner) terms.set(key, { n: -coeff.n, d: coeff.d })
      return terms
    }
    case 'sqrt': {
      const value = rationalOnly(e.a)
      if (!value || ratSign(value) < 0) return null
      if (value.n === BigInt(0)) return new Map()
      const reduced = decompose(atoms, value.n * value.d)
      if (!reduced) return null
      const terms: RadicalTerms = new Map()
      addTerm(terms, keyOf(reduced.idx), rational(reduced.coeff, value.d))
      return terms
    }
    default: {
      const a = encode(e.a, atoms), b = encode(e.b, atoms)
      if (!a || !b) return null
      if (e.k === 'add') return combine(a, b, false)
      if (e.k === 'sub') return combine(a, b, true)
      if (e.k === 'mul') return multiply(atoms, a, b)
      return divide(atoms, a, b)
    }
  }
}

/**
 * Exact sign of a form. Split off one atom: v = a + b√k with a and b over the remaining atoms.
 * Equal signs answer immediately; opposite signs reduce to comparing a² against b²k, one atom
 * shorter, so the recursion ends at a rational whose sign is read directly. All coefficients zero
 * means the value IS zero — the equality enclosures can never certify.
 */
function termsSign(atoms: readonly bigint[], terms: RadicalTerms): -1 | 0 | 1 | null {
  const live = [...new Set([...terms].filter(([, c]) => c.n !== BigInt(0)).flatMap(([key]) => idxOf(key)))]
  if (!live.length) return ratSign(terms.get('') ?? ratFromInt(0))
  const pick = live[0]
  const withRoot: RadicalTerms = new Map(), without: RadicalTerms = new Map()
  for (const [key, coeff] of terms) {
    if (coeff.n === BigInt(0)) continue
    const idx = idxOf(key)
    if (idx.includes(pick)) addTerm(withRoot, keyOf(idx.filter((i) => i !== pick)), coeff)
    else addTerm(without, key, coeff)
  }
  const sa = termsSign(atoms, without), sb = termsSign(atoms, withRoot)
  if (sa === null || sb === null) return null
  if (sb === 0) return sa
  if (sa === 0) return sb
  if (sa === sb) return sa
  const a2 = multiply(atoms, without, without), b2 = multiply(atoms, withRoot, withRoot)
  if (!a2 || !b2) return null
  const scaled = multiply(atoms, b2, rationalTerms(ratFromInt(atoms[pick])))
  if (!scaled) return null
  const cmp = termsSign(atoms, combine(a2, scaled, true))
  if (cmp === null) return null
  return cmp > 0 ? sa : cmp < 0 ? sb : 0
}

/**
 * The canonical atom set an expression reduces to, or null when it leaves the field. Exported as a
 * PROOF SURFACE: the sign recursion compares a² against b²k and is therefore correct whether or not
 * the atoms are independent, so results alone cannot show whether the reduction ran. The invariant
 * it maintains — pairwise coprime, no perfect squares — is asserted directly instead.
 */
export function canonicalRadicalAtoms(e: CReal): bigint[] | null {
  const radicands: bigint[] = []
  if (!collectRadicands(e, radicands)) return null
  return canonicalAtoms(radicands)
}

/** Exact sign over a multi-radical field, or null when the expression leaves that field. */
export function radicalFieldSign(e: CReal): -1 | 0 | 1 | null {
  const radicands: bigint[] = []
  if (!collectRadicands(e, radicands)) return null
  const atoms = canonicalAtoms(radicands)
  const terms = encode(e, atoms)
  return terms ? termsSign(atoms, terms) : null
}

/**
 * Sign of an expression: exact for rational and single-radical expressions; otherwise decided by
 * refining enclosures until they exclude zero. `null` means the bounds could not separate within
 * the precision ladder — the caller must report unresolved, never pick a side.
 */
export function signOf(e: CReal): -1 | 0 | 1 | null {
  const q = asQuadratic(e)
  if (q) return quadraticSign(q)
  // Enclosures first: they settle almost every NONZERO comparison in a few refinements, and a
  // bound that has excluded zero is already a proof. Only what survives the whole ladder — the
  // equalities, which no enclosure can ever certify — is worth normalizing exactly.
  for (const bits of PRECISIONS) {
    const { lo, hi } = evaluate(e, bits)
    if (ratSign(lo) > 0) return 1
    if (ratSign(hi) < 0) return -1
  }
  // Several radicals at once — a miter's coordinates carry two edge lengths, a crossing against it
  // adds a third. This is the only route that can prove equality rather than merely fail to refute
  // it, and it runs on exactly the comparisons that need it.
  return radicalFieldSign(e)
}

/** Three-way comparison through signOf(a − b). */
export const compareCReal = (a: CReal, b: CReal): -1 | 0 | 1 | null => signOf(cSub(a, b))

/** Report-only decimal from a 64-bit enclosure midpoint. */
export function approx(e: CReal): number {
  const { lo, hi } = evaluate(e, BigInt(64))
  return (Number(lo.n) / Number(lo.d) + Number(hi.n) / Number(hi.d)) / 2
}
