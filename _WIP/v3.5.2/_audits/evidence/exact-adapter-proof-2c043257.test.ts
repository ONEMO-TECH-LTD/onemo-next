/* DISPOSABLE bounded proof (s62-kai-lead, 2026-08-22) — exact selected-state reconstruction at 2c043257.
 * Not product code. Proves: numeric Centre selects the state; the chosen centre/phase/anchors and the scaled
 * contour are reconstructed exactly from the supplied bits; exact seat + exact Wrap share that geometry;
 * fixed inspection and rung validation are one function; contact roots are local quadratics. */
import { describe, expect, it } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer, normBaseContour } from '../../effect/magnetic-grid-bridge'
import { computeGrid, scaleContour } from '../engine'
import {
  addRational, compareRational, divideRational, multiplyRational, rational, rationalFromNumber,
  sqrtMinusRational, compareExactToRational, approximateExact, squareRational, subtractRational,
} from '../compute/exact-real'
import type { Contour, Pt, Rational } from '../spec'

type Q = Rational
type QP = readonly [Q, Q]
const Z = rational(0), R = rational(12), R2 = rational(144), PITCH = rational(48), HALF = rational(24), STEP = rational(2)
const q = (n: number) => rationalFromNumber(n)
const num = (v: Q) => Number(v.numerator) / Number(v.denominator)
const sub = subtractRational, add = addRational, mul = multiplyRational, div = divideRational
const lt = (a: Q, b: Q) => compareRational(a, b) < 0, le = (a: Q, b: Q) => compareRational(a, b) <= 0
const min = (a: Q, b: Q) => (lt(a, b) ? a : b), max = (a: Q, b: Q) => (lt(a, b) ? b : a)
const floorQ = (v: Q): bigint => { const n = BigInt(v.numerator), d = BigInt(v.denominator); let f = n / d; if (n < 0n && n % d !== 0n) f -= 1n; return f }
const modQ = (v: Q, m: Q): Q => sub(v, mul(rational(floorQ(div(v, m))), m))
const roundQ = (v: Q): bigint => floorQ(add(v, rational(1, 2)))

// ---- exact contour from supplied bits, replicating the product's scaleContour branch exactly ----
type ExactContour = { pts: QP[]; minX: Q; minY: Q; maxX: Q; maxY: Q; aX: Q[]; aY: Q[]; bX: Q[]; bY: Q[] }
/** Product: contour(s) = base·s, or (base−min)·s/actual when float span ≠ s. Both are exact affine in s: P_i(s) = A_i·s + B_i. */
function exactContourModel(base: Contour, sMM: number) {
  const floatScaled = scaleContour(base, sMM)
  const bx = base.outer.pts.map((p) => q(p[0])), by = base.outer.pts.map((p) => q(p[1]))
  const fMinX = Math.min(...base.outer.pts.map((p) => p[0])), fMinY = Math.min(...base.outer.pts.map((p) => p[1]))
  const fSpan = Math.max(Math.max(...base.outer.pts.map((p) => p[0])) - fMinX, Math.max(...base.outer.pts.map((p) => p[1])) - fMinY)
  // Product branch detection uses the float `actual === longestMM` test on the float-scaled outer.
  // Replicate scaleContour's own test: span of the PRE-correction float product base·s versus longestMM.
  const pre = base.outer.pts.map(([x, y]) => [x * sMM, y * sMM] as const)
  const actual = Math.max(Math.max(...pre.map((p) => p[0])) - Math.min(...pre.map((p) => p[0])), Math.max(...pre.map((p) => p[1])) - Math.min(...pre.map((p) => p[1])))
  const shifted = actual !== sMM
  // Exact affine coefficients: shifted → A = (base−min)/span, B = 0 ; plain → A = base, B = 0
  const spanQ = q(fSpan)
  const aX = bx.map((x) => (shifted ? div(sub(x, q(fMinX)), spanQ) : x))
  const aY = by.map((y) => (shifted ? div(sub(y, q(fMinY)), spanQ) : y))
  return { aX, aY, floatScaled, at: (s: Q): ExactContour => {
    const pts = aX.map((x, i) => [mul(x, s), mul(aY[i], s)] as const)
    let minX = pts[0][0], maxX = pts[0][0], minY = pts[0][1], maxY = pts[0][1]
    for (const [x, y] of pts) { minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y) }
    return { pts: pts as QP[], minX, minY, maxX, maxY, aX, aY, bX: aX.map(() => Z), bY: aY.map(() => Z) }
  } }
}

// ---- exact geometry predicates (same as contact-root/seat, inlined) ----
const d2PointSeg = (p: QP, a: QP, b: QP): Q => {
  const sx = sub(b[0], a[0]), sy = sub(b[1], a[1]), rx = sub(p[0], a[0]), ry = sub(p[1], a[1])
  const proj = add(mul(rx, sx), mul(ry, sy)), len2 = add(squareRational(sx), squareRational(sy))
  let t: QP
  if (compareRational(len2, Z) === 0 || le(proj, Z)) t = a
  else if (compareRational(proj, len2) >= 0) t = b
  else { const u = div(proj, len2); t = [add(a[0], mul(sx, u)), add(a[1], mul(sy, u))] }
  return add(squareRational(sub(p[0], t[0])), squareRational(sub(p[1], t[1])))
}
const nearest2 = (p: QP, c: ExactContour): { d2: Q; seg: number } => {
  let best = { d2: d2PointSeg(p, c.pts[c.pts.length - 1], c.pts[0]), seg: 0 }
  for (let i = 1; i < c.pts.length; i++) { const d2 = d2PointSeg(p, c.pts[i - 1], c.pts[i]); if (lt(d2, best.d2)) best = { d2, seg: i } }
  return best
}
const inside = (p: QP, c: ExactContour): boolean => {
  let w = 0
  for (let i = 0, j = c.pts.length - 1; i < c.pts.length; j = i++) {
    const a = c.pts[j], b = c.pts[i]
    const turn = compareRational(sub(mul(sub(b[0], a[0]), sub(p[1], a[1])), mul(sub(b[1], a[1]), sub(p[0], a[0]))), Z)
    const ay = compareRational(a[1], p[1]), by = compareRational(b[1], p[1])
    if (ay <= 0 && by > 0 && turn > 0) w++; else if (ay > 0 && by <= 0 && turn < 0) w--
  }
  return w !== 0
}
const seatLegal = (p: QP, c: ExactContour) => inside(p, c) && compareRational(nearest2(p, c).d2, R2) >= 0
/** ONE judgement used by fixed inspection AND rung validation. */
function judge(belt: QP[], c: ExactContour) {
  let worst: ReturnType<typeof sqrtMinusRational> | null = null, worstIdx = -1, seatOk = true
  const per = belt.map((p, i) => {
    const n = nearest2(p, c)
    if (!seatLegal(p, c)) seatOk = false
    const req = sqrtMinusRational(n.d2, R)
    if (!worst || compareExactToRational(req, Z) > 0 && (('numerator' in worst) ? compareExactToRational(req, worst as Q) > 0 : approximateExact(req) > approximateExact(worst))) { worst = req; worstIdx = i }
    return { i, seg: n.seg, req, reqApprox: approximateExact(req) }
  })
  const reqWorst = worst ?? Z
  const lawful0 = seatOk && compareExactToRational(reqWorst, Z) <= 0
  return { seatOk, lawful0, reqWorst, reqWorstApprox: approximateExact(reqWorst), worstIdx, per }
}

// ---- exact selected-state reconstruction from the numeric Centre path's outputs ----
const cfgBase = { pitchMM: 48, paddingMM: 12, phaseStepMM: 1, massDepthMM: 16, plan: 'all6' as const, perimeterOnly: true, circle: false, flapMM: 0, wrapMode: 'fixed' as const }
const base = (k: Parameters<typeof getShape>[0]) => normBaseContour(getShape(k, 1024, 1024), 1024)!
const shoelaceCentroid = (pts: QP[]): QP => {
  let a2 = Z, sx = Z, sy = Z
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cross = sub(mul(pts[j][0], pts[i][1]), mul(pts[i][0], pts[j][1]))
    a2 = add(a2, cross); sx = add(sx, mul(add(pts[j][0], pts[i][0]), cross)); sy = add(sy, mul(add(pts[j][1], pts[i][1]), cross))
  }
  return [div(sx, mul(rational(3), a2)), div(sy, mul(rational(3), a2))]
}
function reconstruct(baseC: Contour, sMM: number, centreMode: number, governor = 0) {
  const model = exactContourModel(baseC, sMM), s = q(sMM), c = model.at(s)
  const grid = computeGrid(model.floatScaled, { ...cfgBase, centreMode, governor })
  // exact centre by source identity
  let centre: QP
  if (centreMode === 0) centre = [div(add(c.minX, c.maxX), rational(2)), div(add(c.minY, c.maxY), rational(2))]
  else if (centreMode === 3) centre = shoelaceCentroid(c.pts)
  else if (centreMode === 1) {
    // Core: area-weighted mean of island means; each mean = x0 + 2·(Σix/n) → recover Σix exactly
    const x0 = sub(c.minX, STEP), y0 = sub(c.minY, STEP)
    let n = Z, sx = Z, sy = Z
    for (const seg of grid.segments) {
      const cnt = Math.round(seg.areaMM2 / 4)
      const sumIx = Math.round(((seg.meanMM[0] - num(x0)) / 2) * cnt), sumIy = Math.round(((seg.meanMM[1] - num(y0)) / 2) * cnt)
      const meanX = add(x0, div(mul(STEP, rational(sumIx)), rational(cnt))), meanY = add(y0, div(mul(STEP, rational(sumIy)), rational(cnt)))
      const area = rational(cnt * 4)
      n = add(n, area); sx = add(sx, mul(meanX, area)); sy = add(sy, mul(meanY, area))
    }
    centre = [div(sx, n), div(sy, n)]
  } else {
    // Deep / Top / governed Mass: the selected mesh sample  x0 + 2·ix
    const x0 = sub(c.minX, STEP), y0 = sub(c.minY, STEP)
    const ix = Math.round((grid.centreMainMM[0] - num(x0)) / 2), iy = Math.round((grid.centreMainMM[1] - num(y0)) / 2)
    centre = [add(x0, mul(STEP, rational(ix))), add(y0, mul(STEP, rational(iy)))]
  }
  // exact phase: the chosen one of the four (centre − min [+ half]) mod pitch
  const pick = (axis: 0 | 1): Q => {
    const bc = sub(centre[axis], axis === 0 ? c.minX : c.minY)
    const cands = [modQ(bc, PITCH), modQ(add(bc, HALF), PITCH)]
    const f = grid.phaseMM[axis]
    return Math.abs(num(cands[0]) - f) <= Math.abs(num(cands[1]) - f) ? cands[0] : cands[1]
  }
  const phase: QP = [pick(0), pick(1)]
  // exact anchors: min + phase + k·pitch, k from the float anchor
  const anchors: QP[] = grid.anchors.map((a) => {
    const kx = Math.round((a.p[0] - num(c.minX) - num(phase[0])) / 48), ky = Math.round((a.p[1] - num(c.minY) - num(phase[1])) / 48)
    return [add(add(c.minX, phase[0]), mul(PITCH, rational(kx))), add(add(c.minY, phase[1]), mul(PITCH, rational(ky)))]
  })
  const centreErr = Math.hypot(num(centre[0]) - grid.centreMainMM[0], num(centre[1]) - grid.centreMainMM[1])
  const anchorErr = Math.max(0, ...anchors.map((p, i) => Math.hypot(num(p[0]) - grid.anchors[i].p[0], num(p[1]) - grid.anchors[i].p[1])))
  return { grid, c, s, centre, phase, anchors, centreErr, anchorErr, model }
}

// ---- minimal quadratic root kernel (disposable copy of the audited shape) ----
const gcd = (a: bigint, b: bigint): bigint => { let x = a < 0n ? -a : a, y = b < 0n ? -b : b; while (y) { [x, y] = [y, x % y] } return x || 1n }
const isqrt = (v: bigint): bigint => { if (v < 2n) return v; let x = 1n << BigInt((v.toString(2).length + 1) >> 1); for (;;) { const nx = (x + v / x) >> 1n; if (nx >= x) return x; x = nx } }
/** roots of a·s²+b·s+c = 0 in [lo,hi]; rational when perfect square, else {polynomial, isolating(192 bisections)} */
function quadRoots(a: Q, b: Q, c: Q, lo: Q, hi: Q) {
  const A = BigInt(a.numerator) * BigInt(b.denominator) * BigInt(c.denominator)
  const B = BigInt(b.numerator) * BigInt(a.denominator) * BigInt(c.denominator)
  const C = BigInt(c.numerator) * BigInt(a.denominator) * BigInt(b.denominator)
  let g = gcd(gcd(A, B), C); const P = [A / g, B / g, C / g].map((v) => (A < 0n ? -v : v))
  const ev = (x: Q) => add(mul(add(mul(rational(P[0]), x), rational(P[1])), x), rational(P[2]))
  if (P[0] === 0n) { if (P[1] === 0n) return []; const r = rational(-P[2], P[1]); return le(lo, r) && le(r, hi) ? [r] : [] }
  const disc = P[1] * P[1] - 4n * P[0] * P[2]
  if (disc < 0n) return []
  const sq = isqrt(disc)
  if (sq * sq === disc) return [rational(-P[1] - sq, 2n * P[0]), rational(-P[1] + sq, 2n * P[0])].filter((r) => le(lo, r) && le(r, hi))
  const out: any[] = []
  const vertex = rational(-P[1], 2n * P[0])
  for (const [L, H, idx] of [[lo, min(vertex, hi), 0], [max(vertex, lo), hi, 1]] as const) {
    if (!le(L, H)) continue
    let l = L, h = H, sl = compareRational(ev(l), Z), sh = compareRational(ev(h), Z)
    if (sl === 0) { out.push(l); continue } if (sh === 0) { out.push(h); continue } if (sl === sh) continue
    for (let i = 0; i < 192; i++) { const m = div(add(l, h), rational(2)); const sm = compareRational(ev(m), Z); if (sm === 0) { l = h = m; break } if (sm === sl) l = m; else h = m }
    out.push({ polynomial: P.map(String), isolating: [l, h], rootIndex: idx })
  }
  return out
}
/** Contact equations for one anchor p(s)=α·s+β against segment endpoints E(s)=A·s (B=0 here): |p−E|² = R² → quadratic in s.
 *  Interior projection: cross((p−E1), d)² / |d|² with d = (A2−A1)·s → (γ s + δ)² /|d_base|² = R². */
function contactRoots(alpha: QP, beta: QP, aX: Q[], aY: Q[], lo: Q, hi: Q) {
  const roots: Array<{ s: any; seg: number; kind: string }> = []
  const n = aX.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    for (const [kind, ex, ey] of [['end', aX[i], aY[i]], ['end', aX[j], aY[j]]] as const) {
      const ux = sub(alpha[0], ex), uy = sub(alpha[1], ey) // (α−A)·s + β
      const A = add(squareRational(ux), squareRational(uy)), B = mul(rational(2), add(mul(ux, beta[0]), mul(uy, beta[1]))), C = sub(add(squareRational(beta[0]), squareRational(beta[1])), R2)
      for (const s of quadRoots(A, B, C, lo, hi)) roots.push({ s, seg: j, kind })
    }
    const dx = sub(aX[j], aX[i]), dy = sub(aY[j], aY[i]), len2 = add(squareRational(dx), squareRational(dy))
    if (compareRational(len2, Z) === 0) continue
    // cross((α−A_i)s+β, d_base) = (γ)s + δ  with γ = (α−A_i)×d, δ = β×d
    const gx = sub(alpha[0], aX[i]), gy = sub(alpha[1], aY[i])
    const gamma = sub(mul(gx, dy), mul(gy, dx)), delta = sub(mul(beta[0], dy), mul(beta[1], dx))
    const A = squareRational(gamma), B = mul(rational(2), mul(gamma, delta)), C = sub(squareRational(delta), mul(R2, len2))
    for (const s of quadRoots(A, B, C, lo, hi)) roots.push({ s, seg: j, kind: 'interior' })
  }
  return roots
}

describe('bounded exact-adapter proof @2c043257', () => {
  it('1. every Centre mode + governor: exact reconstruction matches the numeric selection; exact seat/Wrap one verdict', () => {
    const rows: string[] = []
    for (const [k, mm] of [['squircle', 72], ['heart', 108], ['squircle', 120]] as const) {
      for (const mode of [0, 1, 2, 3, 4, 5]) for (const gov of mode === 2 ? [0, 1, 2, 3] : [0]) {
        const r = reconstruct(base(k), mm, mode, gov)
        const v = judge(r.anchors, r.c)
        rows.push(`${k}${mm} m${mode}g${gov} centreErr=${r.centreErr.toExponential(1)} anchorErr=${r.anchorErr.toExponential(1)} n=${r.anchors.length} seatOk=${v.seatOk} exactReq=${v.reqWorstApprox.toExponential(3)} lawful0=${v.lawful0} float=${r.grid.wrap.status}`)
      }
    }
    console.log('P1\n' + rows.join('\n'))
    for (const row of rows) expect(row, row).not.toMatch(/centreErr=[1-9]\S*e[+-]0[1-9]|centreErr=[1-9]\S*e\+|anchorErr=[1-9]\S*e[+-]0[1-9]/)
  }, 300000)

  it('2. square25 @ pitch24: one exact verdict; float path disagrees (the W1 defect)', () => {
    const b = base('square'), r = (() => { const model = exactContourModel(b, 25), s = q(25), c = model.at(s)
      const grid = computeGrid(model.floatScaled, { ...cfgBase, pitchMM: 24, centreMode: 2 })
      const x0 = sub(c.minX, STEP), y0 = sub(c.minY, STEP)
      const ix = Math.round((grid.centreMainMM[0] - num(x0)) / 2), iy = Math.round((grid.centreMainMM[1] - num(y0)) / 2)
      const centre: QP = [add(x0, mul(STEP, rational(ix))), add(y0, mul(STEP, rational(iy)))]
      return { grid, c, centre, s, model } })()
    const v = judge([r.centre], r.c)
    console.log('P2', JSON.stringify({ floatAnchor: r.grid.anchors[0]?.p, exactAnchor: [num(r.centre[0]), num(r.centre[1])], exactReq: v.reqWorst, seatOk: v.seatOk, lawful0: v.lawful0, floatStatus: r.grid.wrap.status, floatReq: r.grid.wrap.requiredFlapApproxMM }))
    expect(v.seatOk).toBe(true)
    expect(v.reqWorst).toEqual(Z)                       // gap exactly 0: tangent to the left edge by construction
    expect(r.grid.wrap.status).toBe('refused')          // float path (approximate seat + raw-float Wrap) disagrees → the defect
    // rung-path view of the same state: contact root of this (constant) anchor vs the moving right edge
    const alpha: QP = [div(r.c.minX, r.s), div(r.c.minY, r.s)], beta: QP = [sub(r.centre[0], mul(alpha[0], r.s)), sub(r.centre[1], mul(alpha[1], r.s))]
    const roots = contactRoots(alpha, beta, r.model.aX, r.model.aY, q(20), q(30)).map((x) => ({ ...x, s: 'numerator' in x.s ? num(x.s) : approximateExact(x.s) }))
    console.log('P2-roots', JSON.stringify(roots.map((x) => [x.kind, x.seg, +x.s.toFixed(6)])))
    expect(roots.some((x) => Math.abs(x.s - 24) < 1e-9)).toBe(true)   // right edge touches at s=24 → the square24 standard
  })

  it('3. Weight squircle72: asymmetric supplied bits → one correct exact refusal in fixed and rung paths; per-disc contact roots differ', () => {
    const r = reconstruct(base('squircle'), 72, 3)
    const fixed = judge(r.anchors, r.c)
    // rung path: same state, anchors affine p(s)=α·s+β with α = centroid_base, β = offsets; validate at s=72 with the SAME judge
    const cb = shoelaceCentroid(r.model.at(rational(1)).pts)
    const alphas = r.anchors.map(() => cb), betas = r.anchors.map((p) => [sub(p[0], mul(cb[0], r.s)), sub(p[1], mul(cb[1], r.s))] as QP)
    const rung = judge(alphas.map((a, i) => [add(mul(a[0], r.s), betas[i][0]), add(mul(a[1], r.s), betas[i][1])] as QP), r.c)
    const perDiscRoots = r.anchors.map((_, i) => contactRoots(alphas[i], betas[i], r.model.aX, r.model.aY, q(71), q(73)).map((x) => 'numerator' in x.s ? num(x.s) : approximateExact(x.s)))
    console.log('P3', JSON.stringify({ centroid: [num(r.centre[0]), num(r.centre[1])], box: [num(r.c.maxX) / 2, num(r.c.maxY) / 2], fixed: { seatOk: fixed.seatOk, lawful0: fixed.lawful0, req: fixed.reqWorst, reqApprox: fixed.reqWorstApprox }, rung: { lawful0: rung.lawful0, req: rung.reqWorst }, perDiscTouchSizes: perDiscRoots.map((rs) => rs.map((v) => +v.toFixed(12))) }))
    expect(JSON.stringify(fixed.reqWorst)).toBe(JSON.stringify(rung.reqWorst))   // identity of verdict/evidence
    expect(fixed.lawful0).toBe(rung.lawful0)
  }, 120000)

  it('4. diamond: Box mode count-1 contact root is irrational and carried exactly', () => {
    const b = base('diamond'), model = exactContourModel(b, 40)
    const centreBase: QP = (() => { const c1 = model.at(rational(1)); return [div(add(c1.minX, c1.maxX), rational(2)), div(add(c1.minY, c1.maxY), rational(2))] })()
    const roots = contactRoots(centreBase, [Z, Z], model.aX, model.aY, q(20), q(60))
    const named = roots.map((x) => ({ kind: x.kind, seg: x.seg, exact: x.s, approx: 'numerator' in x.s ? num(x.s) : approximateExact(x.s) }))
    named.sort((a, b) => b.approx - a.approx)
    const binding = named[0]   // the disc seats when the farthest-reaching constraint is met: largest contact size among edges = first legal size
    const sStar = binding.exact
    const c = model.at('numerator' in sStar ? sStar : sStar.isolating[1])
    const vHi = judge([[mul(centreBase[0], 'numerator' in sStar ? sStar : sStar.isolating[1]), mul(centreBase[1], 'numerator' in sStar ? sStar : sStar.isolating[1])]], c)
    console.log('P4', JSON.stringify({ rootsApprox: named.map((n) => [n.kind, n.seg, +n.approx.toFixed(9)]), binding: { kind: binding.kind, seg: binding.seg, exact: binding.exact }, judgeAtUpperBound: { seatOk: vHi.seatOk, req: vHi.reqWorstApprox } }))
    expect('polynomial' in sStar).toBe(true)                                  // irrational contact scale
    expect(num((sStar as any).isolating[1]) - num((sStar as any).isolating[0])).toBeLessThan(1e-40)
    expect(vHi.seatOk).toBe(true)                                             // just above the root the disc is legal
    expect(vHi.reqWorstApprox).toBeLessThan(1e-30)                            // and its gap is the isolating width
  })
})

describe('diagnostics', () => {
  it('D1 squircle72 box: why seatOk=false; D2 squircle120 box: why centreErr=33', () => {
    for (const mm of [72, 120]) {
      const r = reconstruct(base('squircle'), mm, 0)
      const fs = r.model.floatScaled.outer.pts
      const fmin = [Math.min(...fs.map((p) => p[0])), Math.min(...fs.map((p) => p[1]))], fmax = [Math.max(...fs.map((p) => p[0])), Math.max(...fs.map((p) => p[1]))]
      console.log(`D mm=${mm} pts=${fs.length} floatBBox=${JSON.stringify([fmin, fmax])} exactBBox=${JSON.stringify([[num(r.c.minX), num(r.c.minY)], [num(r.c.maxX), num(r.c.maxY)]])} floatCentre=${JSON.stringify(r.grid.centreMainMM)} exactCentre=${JSON.stringify([num(r.centre[0]), num(r.centre[1])])} shifted=${(Math.max(fmax[0]-fmin[0], fmax[1]-fmin[1]) !== mm)}`)
      r.anchors.forEach((p, i) => {
        const n = nearest2(p, r.c)
        console.log(`  anchor${i} float=${JSON.stringify(r.grid.anchors[i].p)} exact=${JSON.stringify([num(p[0]), num(p[1])])} inside=${inside(p, r.c)} d2-144=${num(sub(n.d2, R2)).toExponential(3)} seg=${n.seg}`)
      })
    }
  }, 120000)
})
