// Neutral clearance maximum (R14 §7.1b item 5). The deepest point of a legal region is a
// generalized Voronoi vertex of the boundary features — equidistant from three of them — or, on a
// plateau, a tie between such vertices. Candidates are solved exactly from feature triples; a
// hierarchical branch-and-bound with clearance's 1-Lipschitz per-cell upper bound prunes the
// domain and limits which features can bind inside a surviving cell, so every candidate that
// could be the maximum is enumerated. A winner is accepted only when its certified lower bound
// exceeds every other candidate's and every unexplored cell's upper bound; exactly equal maxima
// are returned as an explicit tie; a question the bounds cannot settle is unresolved.

import type { ExactRational } from './exact-real'
import { approx, cAdd, cDiv, cInt, cMul, cNeg, cRat, cSqrt, cSub, compareCReal, evaluate, signOf, type CReal } from './certified-real'
import { insideContour, nearestDist2, type ExactContour, type ExactSegment } from './clearance'
import { compareExact, ratAdd, ratFromInt, ratMul, ratSub, rational, sqrtInterval } from './exact-real'
import { boundaryFeatures, traversed, type P2 } from './offset'
import { regionContains, type ExactRegion } from './region'

type Feature = { kind: 'line'; seg: ExactSegment } | { kind: 'point'; x: bigint; y: bigint }

export interface Candidate {
  readonly p: P2
  /** exact squared clearance */
  readonly d2: CReal
  readonly lo: ExactRational
  readonly hi: ExactRational
  readonly features: readonly Feature[]
}

/**
 * A continuum of co-maximal points: the medial branch of two parallel features, on which the
 * clearance is provably constant. Its ends are exact; every point strictly between them has the
 * same exact clearance, so this is evidence a pair of discrete points cannot express.
 */
export interface Plateau {
  readonly from: P2
  readonly to: P2
  /** a representative interior point, used for the ruled centre target */
  readonly mid: P2
  /** the exact squared clearance held along the whole branch */
  readonly d2: CReal
  readonly lo: ExactRational
  readonly hi: ExactRational
  readonly features: readonly [Feature, Feature]
}

/**
 * The clearance maximum as DISCRIMINATED evidence (R14: evidence and refusal are typed, and Logic
 * must never receive a duplicate point decision for a continuum). Each variant carries exactly the
 * evidence its case has: one point, several isolated points, one or more co-maximal branches with
 * their scalar clearance witness, or nothing at all. Contradictory combinations are unrepresentable.
 */
export type ClearanceMaximum =
  | { readonly status: 'certified'; readonly best: Candidate; readonly reasons: readonly string[]; readonly cellsEvaluated: number }
  | { readonly status: 'tie'; readonly candidates: readonly [Candidate, Candidate, ...Candidate[]]; readonly reasons: readonly string[]; readonly cellsEvaluated: number }
  | { readonly status: 'plateau'; readonly branches: readonly [Plateau, ...Plateau[]]; readonly clearanceLo: ExactRational; readonly clearanceHi: ExactRational; readonly d2: CReal; readonly reasons: readonly string[]; readonly cellsEvaluated: number }
  | { readonly status: 'unresolved'; readonly reasons: readonly string[]; readonly cellsEvaluated: number }

const TWO = BigInt(2)
const SQRT2_HI = sqrtInterval(ratFromInt(2), BigInt(1) << BigInt(40)).hi
const MAX_ACTIVE = 10
const MAX_CELLS = 6000

const cB = (v: bigint) => cInt(v)
const sub2 = (p: P2, q: P2): P2 => ({ x: cSub(p.x, q.x), y: cSub(p.y, q.y) })
const crossC = (u: P2, v: P2) => cSub(cMul(u.x, v.y), cMul(u.y, v.x))
const dotC = (u: P2, v: P2) => cAdd(cMul(u.x, v.x), cMul(u.y, v.y))

/** exact squared distance from a certified point to a feature (segment → nearest point on it) */
function d2ToFeature(p: P2, f: Feature): CReal | null {
  if (f.kind === 'point') { const w = sub2(p, { x: cB(f.x), y: cB(f.y) }); return dotC(w, w) }
  const s = f.seg
  const dx = s.bx - s.ax, dy = s.by - s.ay, len2 = dx * dx + dy * dy
  const w = sub2(p, { x: cB(s.ax), y: cB(s.ay) })
  const t = cAdd(cMul(w.x, cB(dx)), cMul(w.y, cB(dy)))
  const sT = signOf(t)
  if (sT === null) return null
  if (sT <= 0) return dotC(w, w)
  const sE = signOf(cSub(t, cB(len2)))
  if (sE === null) return null
  if (sE >= 0) { const u = sub2(p, { x: cB(s.bx), y: cB(s.by) }); return dotC(u, u) }
  const cr = cSub(cMul(w.x, cB(dy)), cMul(w.y, cB(dx)))
  return cDiv(cMul(cr, cr), cB(len2))
}

/** Signed distance to a line feature as a linear form  a·x + b·y + c  (material side positive). */
function lineForm(f: Extract<Feature, { kind: 'line' }>): { a: CReal; b: CReal; c: CReal } {
  const s = f.seg
  const dx = s.bx - s.ax, dy = s.by - s.ay
  const len = cSqrt(cB(dx * dx + dy * dy))
  // cross(p − A, d)/|d| = ((px−ax)·dy − (py−ay)·dx)/|d| … material is on the LEFT, where cross(d, p−A) > 0,
  // i.e. dx·(py−ay) − dy·(px−ax) > 0. Use that orientation.
  const a = cDiv(cB(-dy), len), b = cDiv(cB(dx), len)
  const c = cNeg(cAdd(cMul(a, cB(s.ax)), cMul(b, cB(s.ay))))
  return { a, b, c }
}

/** Solve two linear forms  a₁x+b₁y+c₁=0, a₂x+b₂y+c₂=0. */
function solveLinear(L1: { a: CReal; b: CReal; c: CReal }, L2: { a: CReal; b: CReal; c: CReal }): P2 | null | 'undecidable' {
  const det = cSub(cMul(L1.a, L2.b), cMul(L2.a, L1.b))
  const s = signOf(det)
  if (s === null) return 'undecidable'
  if (s === 0) return null
  return { x: cDiv(cSub(cMul(L1.b, L2.c), cMul(L2.b, L1.c)), det), y: cDiv(cSub(cMul(L2.a, L1.c), cMul(L1.a, L2.c)), det) }
}

/** Points on the parametric line p = P0 + s·D where dist² to `f` equals the value of form² (line) or
 *  |p − V|² (point) of another feature — i.e. the quadratic  q(s) = 0  for equidistance. */
function solveOnLine(P0: P2, D: P2, eqA: Feature, eqB: Feature): P2[] | 'undecidable' {
  // express squared distance to each as a quadratic in s: for a line form ℓ(p) = a x + b y + c →
  // ℓ(P0 + sD) = ℓ0 + s·ℓD, squared; for a point V: |P0 − V + sD|².
  const quad = (f: Feature): { A: CReal; B: CReal; C: CReal } => {
    if (f.kind === 'line') {
      const L = lineForm(f)
      const l0 = cAdd(cAdd(cMul(L.a, P0.x), cMul(L.b, P0.y)), L.c)
      const lD = cAdd(cMul(L.a, D.x), cMul(L.b, D.y))
      return { A: cMul(lD, lD), B: cMul(cInt(2), cMul(l0, lD)), C: cMul(l0, l0) }
    }
    const w = sub2(P0, { x: cB(f.x), y: cB(f.y) })
    return { A: dotC(D, D), B: cMul(cInt(2), dotC(w, D)), C: dotC(w, w) }
  }
  const qa = quad(eqA), qb = quad(eqB)
  const A = cSub(qa.A, qb.A), B = cSub(qa.B, qb.B), C = cSub(qa.C, qb.C)
  const sA = signOf(A)
  if (sA === null) return 'undecidable'
  const roots: CReal[] = []
  if (sA === 0) {
    const sB = signOf(B)
    if (sB === null) return 'undecidable'
    if (sB !== 0) roots.push(cDiv(cNeg(C), B))
  } else {
    const disc = cSub(cMul(B, B), cMul(cInt(4), cMul(A, C)))
    const sd = signOf(disc)
    if (sd === null) return 'undecidable'
    if (sd === 0) roots.push(cDiv(cNeg(B), cMul(cInt(2), A)))
    else if (sd > 0) roots.push(cDiv(cSub(cNeg(B), cSqrt(disc)), cMul(cInt(2), A)), cDiv(cAdd(cNeg(B), cSqrt(disc)), cMul(cInt(2), A)))
  }
  return roots.map((s) => ({ x: cAdd(P0.x, cMul(s, D.x)), y: cAdd(P0.y, cMul(s, D.y)) }))
}

/** Exact equidistant points of a feature triple. */
function equidistant(f1: Feature, f2: Feature, f3: Feature): P2[] | 'undecidable' {
  const lines = [f1, f2, f3].filter((f): f is Extract<Feature, { kind: 'line' }> => f.kind === 'line')
  const points = [f1, f2, f3].filter((f): f is Extract<Feature, { kind: 'point' }> => f.kind === 'point')
  const bisectorLL = (u: typeof lines[number], v: typeof lines[number]) => {
    const A = lineForm(u), B = lineForm(v)
    return { a: cSub(A.a, B.a), b: cSub(A.b, B.b), c: cSub(A.c, B.c) } // equal signed distances
  }
  const bisectorPP = (u: typeof points[number], v: typeof points[number]) => ({
    a: cB(TWO * (v.x - u.x)), b: cB(TWO * (v.y - u.y)), c: cB(u.x * u.x + u.y * u.y - v.x * v.x - v.y * v.y),
  })
  if (lines.length === 3) {
    const r = solveLinear(bisectorLL(lines[0], lines[1]), bisectorLL(lines[1], lines[2]))
    return r === 'undecidable' ? r : r ? [r] : []
  }
  if (points.length === 3) {
    const r = solveLinear(bisectorPP(points[0], points[1]), bisectorPP(points[1], points[2]))
    return r === 'undecidable' ? r : r ? [r] : []
  }
  // one linear bisector from the same-type pair, then the quadratic equidistance with the odd one
  const linear = lines.length === 2 ? bisectorLL(lines[0], lines[1]) : bisectorPP(points[0], points[1])
  const odd: Feature = lines.length === 2 ? points[0] : lines[0]
  const same: Feature = lines.length === 2 ? lines[0] : points[0]
  // parametrize the linear bisector: a point on it and its direction (−b, a)
  const sa = signOf(linear.a), sb = signOf(linear.b)
  if (sa === null || sb === null) return 'undecidable'
  if (sa === 0 && sb === 0) return []
  const P0: P2 = sb !== 0 ? { x: cInt(0), y: cDiv(cNeg(linear.c), linear.b) } : { x: cDiv(cNeg(linear.c), linear.a), y: cInt(0) }
  const D: P2 = { x: cNeg(linear.b), y: linear.a }
  return solveOnLine(P0, D, same, odd)
}

interface Cell { x: bigint; y: bigint; half: bigint; inside: boolean; d2: ExactRational }

/** The clearance maximum of one region. `rUnits` is the region's own level (spot radius or mass depth). */
export function clearanceMaximum(c: ExactContour, region: ExactRegion, rUnits: bigint): ClearanceMaximum {
  const reasons: string[] = []
  const { edges, reflex } = boundaryFeatures(c)
  const features: Feature[] = [...edges.map((seg) => ({ kind: 'line' as const, seg })), ...reflex.map((v) => ({ kind: 'point' as const, x: v.x, y: v.y }))]

  // Root cell over certified extents of every traversed endpoint AND every arc's full extent —
  // a piece midpoint is not an extent, and an acute or long piece would otherwise fall outside.
  let minX: ExactRational | null = null, minY: ExactRational | null = null, maxX: ExactRational | null = null, maxY: ExactRational | null = null
  const widen = (x: ExactRational, y: ExactRational) => {
    minX = minX === null || compareExact(x, minX) < 0 ? x : minX; maxX = maxX === null || compareExact(x, maxX) > 0 ? x : maxX
    minY = minY === null || compareExact(y, minY) < 0 ? y : minY; maxY = maxY === null || compareExact(y, maxY) > 0 ? y : maxY
  }
  for (const loop of [region.outer, ...region.holes]) for (const op of loop.pieces) {
    const t = traversed(op, rUnits)
    for (const p of [t.from, t.to]) {
      const ix = evaluate(p.x, BigInt(32)), iy = evaluate(p.y, BigInt(32))
      widen(ix.lo, iy.lo); widen(ix.hi, iy.hi)
    }
    if (t.arc) {
      const cx = ratFromInt(t.arc.cx), cy = ratFromInt(t.arc.cy), rr = ratFromInt(t.arc.r)
      widen(ratSub(cx, rr), ratSub(cy, rr)); widen(ratAdd(cx, rr), ratAdd(cy, rr))
    }
  }
  if (!minX || !minY || !maxX || !maxY) return { status: 'unresolved', reasons: ['empty region'], cellsEvaluated: 0 }
  const floorInt = (r: ExactRational) => (r.n >= BigInt(0) ? r.n / r.d : -((-r.n + r.d - BigInt(1)) / r.d))
  const ceilInt = (r: ExactRational) => (r.n >= BigInt(0) ? (r.n + r.d - BigInt(1)) / r.d : -((-r.n) / r.d))
  const x0 = floorInt(minX) - rUnits, x1 = ceilInt(maxX) + rUnits, y0 = floorInt(minY) - rUnits, y1 = ceilInt(maxY) + rUnits
  let half = BigInt(1)
  while (half * TWO < (x1 - x0 > y1 - y0 ? x1 - x0 : y1 - y0)) half *= TWO
  const cx0 = (x0 + x1) / TWO, cy0 = (y0 + y1) / TWO

  let evaluated = 0
  const make = (x: bigint, y: bigint, h: bigint): Cell => {
    evaluated++
    const p: P2 = { x: cB(x), y: cB(y) }
    const inRegion = insideContour(x, y, c) && regionContains(region, p, rUnits) === true
    return { x, y, half: h, inside: inRegion, d2: nearestDist2(x, y, c).d2 }
  }
  // per-cell bounds on clearance, as rationals: upper = √d2 + h√2 (any point), lower = √d2 (inside centre)
  const hiOf = (cell: Cell) => ratAdd(sqrtInterval(cell.d2, BigInt(1) << BigInt(30)).hi, ratMul(ratFromInt(cell.half), SQRT2_HI))
  const loOf = (cell: Cell) => sqrtInterval(cell.d2, BigInt(1) << BigInt(30)).lo

  let cells: Cell[] = [make(cx0, cy0, half)]
  const candidates: Candidate[] = []
  const seenTriples = new Set<string>()
  let bestLo: ExactRational = ratFromInt(-1)
  const considerCandidate = (cand: Candidate) => {
    candidates.push(cand)
    if (compareExact(cand.lo, bestLo) > 0) bestLo = cand.lo
  }

  for (let round = 0; round < 60 && cells.length; round++) {
    // lower bounds from inside cell centres keep pruning honest before any candidate exists
    for (const cell of cells) if (cell.inside) { const lo = loOf(cell); if (compareExact(lo, bestLo) > 0) bestLo = lo }
    cells = cells.filter((cell) => compareExact(hiOf(cell), bestLo) >= 0)
    if (!cells.length) break
    if (cells.length > MAX_CELLS) { reasons.push(`resource envelope: ${cells.length} live cells`); return { status: 'unresolved', reasons, cellsEvaluated: evaluated } }

    const queue: Cell[] = []
    for (const cell of cells) {
      // features that can bind somewhere in this cell: distance lower bound ≤ cell upper bound
      const hi = hiOf(cell)
      const active: Feature[] = []
      for (const f of features) {
        const d2 = f.kind === 'point'
          ? rational((cell.x - f.x) * (cell.x - f.x) + (cell.y - f.y) * (cell.y - f.y), BigInt(1))
          : nearestDist2ToSeg(cell.x, cell.y, f.seg)
        const lo = ratSub(sqrtInterval(d2, BigInt(1) << BigInt(30)).lo, ratMul(ratFromInt(cell.half), SQRT2_HI))
        if (compareExact(lo, hi) <= 0) active.push(f)
      }
      if (active.length < 2) continue // one binding feature: clearance grows monotonically away from it
      if (active.length === 2) {
        // Two binding features. On a NONPARALLEL line/line, line/point or point/point branch the
        // clearance is strictly monotone along the branch, so any maximum lies at the branch end
        // where a third feature binds — enumerated in the cell holding that end. Parallel-line
        // branches are NOT dismissed here: they are enumerated exhaustively from the feature set
        // below, independent of which cells happened to survive.
        continue
      }
      if (active.length <= MAX_ACTIVE) {
        // Completeness: a clearance maximum is equidistant from at least three binding features
        // (a two-feature ridge is a plateau whose endpoints are themselves such points). Solving
        // every triple of this cell's binding set therefore enumerates every maximum inside it —
        // so the cell is finished and needs no further splitting, dominated or not.
        for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) for (let k = j + 1; k < active.length; k++) {
          const key = [i, j, k].map((idx) => features.indexOf(active[idx])).sort((a, b) => a - b).join(':')
          if (seenTriples.has(key)) continue
          seenTriples.add(key)
          const sol = equidistant(active[i], active[j], active[k])
          if (sol === 'undecidable') { reasons.push('equidistant solve undecidable'); continue }
          for (const p of sol) {
            // The bisectors are built from infinite lines; a solution is only a medial vertex if
            // all THREE generating features are at the same true (segment/point) distance —
            // otherwise an endpoint-projection case would admit a non-medial point.
            const d2 = d2ToFeature(p, active[i]) ?? null
            if (!d2) { reasons.push('candidate distance undecidable'); continue }
            let ok = true
            for (const g of [active[j], active[k]]) {
              const dg = d2ToFeature(p, g)
              if (dg === null) { ok = false; reasons.push('generator distance undecidable'); break }
              const s = signOf(cSub(dg, d2))
              if (s === null) { ok = false; reasons.push('generator equality undecidable'); break }
              if (s !== 0) { ok = false; break } // equidistant to the lines, not to the features
            }
            if (!ok) continue
            // and no other feature may be closer
            for (const f of features) {
              const df = d2ToFeature(p, f)
              if (df === null) { ok = false; reasons.push('candidate check undecidable'); break }
              const s = signOf(cSub(df, d2))
              if (s === null) { ok = false; reasons.push('candidate check undecidable'); break }
              if (s < 0) { ok = false; break }
            }
            if (!ok) continue
            const inside = regionContains(region, p, rUnits)
            if (inside !== true) continue
            const e = evaluate(cSqrt(d2), BigInt(64))
            considerCandidate({ p, d2, lo: e.lo, hi: e.hi, features: [active[i], active[j], active[k]] })
          }
        }
        continue
      }
      if (cell.half <= BigInt(1)) {
        // A cell that reaches the representation floor with too many binding features is an
        // unsettled question — it must not vanish from the search.
        reasons.push('cell at the representable floor still has too many binding features')
        return { status: 'unresolved', reasons, cellsEvaluated: evaluated }
      }
      const q = cell.half / TWO
      queue.push(make(cell.x - q, cell.y - q, q), make(cell.x + q, cell.y - q, q), make(cell.x - q, cell.y + q, q), make(cell.x + q, cell.y + q, q))
    }
    cells = queue
  }

  // ---- Plateau branches (R14 §7.1b item 5: co-maxima are explicit evidence) -------------------
  //
  // Two PARALLEL line features have a medial branch on which clearance is constant, so every point
  // of it is co-maximal and no feature triple lies on it — triple enumeration alone cannot see it.
  // Pairs are enumerated exhaustively from the feature set, never from whichever B&B cells
  // survived. Constancy is proved ALGEBRAICALLY (the branch direction annihilates each generating
  // line form, so the distance is invariant along the whole branch, not merely at sampled points).
  // The span is clipped by solving, for every other feature, where its TRUE finite distance equals
  // the branch's constant clearance — including its endpoints as point features, so an
  // endpoint-projection ownership change cannot be stepped over. Parameters are ordered by
  // certified insertion; an undecidable comparison refuses the branch instead of guessing.
  const plateaus: Plateau[] = []
  for (let i = 0; i < features.length; i++) for (let j = i + 1; j < features.length; j++) {
    const f = features[i], g = features[j]
    if (f.kind !== 'line' || g.kind !== 'line') continue
    const d1 = { x: f.seg.bx - f.seg.ax, y: f.seg.by - f.seg.ay }
    const d2v = { x: g.seg.bx - g.seg.ax, y: g.seg.by - g.seg.ay }
    if (d1.x * d2v.y - d1.y * d2v.x !== BigInt(0)) continue // not parallel: branch is monotone

    const Lf = lineForm(f), Lg = lineForm(g)
    const mid = { a: cSub(Lf.a, Lg.a), b: cSub(Lf.b, Lg.b), c: cSub(Lf.c, Lg.c) }
    const sa = signOf(mid.a), sb = signOf(mid.b)
    if (sa === null || sb === null) { reasons.push('plateau branch undecidable'); continue }
    if (sa === 0 && sb === 0) continue // identical forms: no branch between them

    const P0: P2 = sb !== 0 ? { x: cInt(0), y: cDiv(cNeg(mid.c), mid.b) } : { x: cDiv(cNeg(mid.c), mid.a), y: cInt(0) }
    const D: P2 = { x: cNeg(mid.b), y: mid.a }

    // ALGEBRAIC CONSTANCY: distance to a line form is invariant along D iff the form's gradient is
    // annihilated by D. Proved exactly for BOTH generators — this covers the entire branch.
    const annF = signOf(cAdd(cMul(Lf.a, D.x), cMul(Lf.b, D.y)))
    const annG = signOf(cAdd(cMul(Lg.a, D.x), cMul(Lg.b, D.y)))
    if (annF === null || annG === null) { reasons.push('plateau constancy undecidable'); continue }
    if (annF !== 0 || annG !== 0) continue // not a constant-clearance branch

    // EXACT PRUNE (changes no answer): on a facing parallel pair the gradients cancel, so
    // ℓf(p) + ℓg(p) = c_f + c_g everywhere, and on the branch ℓf = ℓg = K. Hence K = (c_f+c_g)/2
    // exactly — an upper bound on any clearance this branch can hold. A pair that cannot reach the
    // best already certified cannot be the maximum, so its clipping work is skipped entirely.
    const branchK = cDiv(cAdd(Lf.c, Lg.c), cInt(2))
    const beats = compareCReal(branchK, cRat(bestLo))
    if (beats === null) { reasons.push('plateau bound undecidable'); continue }
    if (beats < 0) continue

    const dd = dotC(D, D)
    const at = (u: CReal): P2 => ({ x: cAdd(P0.x, cMul(u, D.x)), y: cAdd(P0.y, cMul(u, D.y)) })
    const paramOf = (q: P2): CReal => cDiv(cAdd(cMul(cSub(q.x, P0.x), D.x), cMul(cSub(q.y, P0.y), D.y)), dd)

    // Projection-regime events of the GENERATORS themselves. The algebraic annihilation above
    // certifies the INFINITE-LINE distance; the true finite-segment distance equals it only while
    // the branch point projects strictly inside the segment. The projection parameter is linear in
    // u (t(u) = t0 + u·(D·d)), so both regime boundaries are exact roots and become cuts — a span
    // can then never straddle a regime change unnoticed.
    const regimeCuts: CReal[] = []
    let regimeUndecidable = false
    for (const h of [f, g]) {
      const d = { x: h.seg.bx - h.seg.ax, y: h.seg.by - h.seg.ay }
      const len2 = d.x * d.x + d.y * d.y
      const slope = cAdd(cMul(D.x, cB(d.x)), cMul(D.y, cB(d.y)))
      const sSlope = signOf(slope)
      if (sSlope === null) { regimeUndecidable = true; break }
      if (sSlope === 0) continue // projection constant along the branch: no regime change
      const t0 = cAdd(cMul(cSub(P0.x, cB(h.seg.ax)), cB(d.x)), cMul(cSub(P0.y, cB(h.seg.ay)), cB(d.y)))
      regimeCuts.push(cDiv(cNeg(t0), slope), cDiv(cSub(cB(len2), t0), slope))
    }
    if (regimeUndecidable) { reasons.push('plateau generator regime undecidable'); continue }

    // CLIP: every parameter where another feature's TRUE distance equals K. Line features
    // contribute their infinite-line roots AND their endpoints as point features, so ownership
    // changes at an endpoint projection are enumerated; each root is then verified by exact
    // true-distance equality before it is admitted as a cut.
    const cuts: CReal[] = [...regimeCuts]
    let undecidable = false
    const addRootsAgainst = (h: Feature) => {
      const probes: Feature[] = h.kind === 'point' ? [h]
        : [h, { kind: 'point', x: h.seg.ax, y: h.seg.ay }, { kind: 'point', x: h.seg.bx, y: h.seg.by }]
      for (const probe of probes) {
        const hits = solveOnLine(P0, D, f, probe)
        if (hits === 'undecidable') { undecidable = true; return }
        for (const q of hits) {
          // admit the root as a cut when h's TRUE distance there equals f's TRUE distance —
          // an ownership change, wherever the projection regimes put it
          const dh = d2ToFeature(q, h), df = d2ToFeature(q, f)
          if (dh === null || df === null) { undecidable = true; return }
          const eq = compareCReal(dh, df)
          if (eq === null) { undecidable = true; return }
          if (eq === 0) cuts.push(paramOf(q))
        }
      }
    }
    for (const h of features) { if (h !== f && h !== g) { addRootsAgainst(h); if (undecidable) break } }
    if (undecidable) { reasons.push('plateau clip undecidable'); continue }
    if (cuts.length < 2) continue

    // CERTIFIED ORDER: insertion by exact comparison; a null comparison refuses the branch.
    const ordered: CReal[] = []
    for (const u of cuts) {
      let place = ordered.length
      let duplicate = false
      for (let k = 0; k < ordered.length; k++) {
        const cmp = compareCReal(u, ordered[k])
        if (cmp === null) { undecidable = true; break }
        if (cmp === 0) { duplicate = true; break }
        if (cmp < 0) { place = k; break }
      }
      if (undecidable) break
      if (!duplicate) ordered.splice(place, 0, u)
    }
    if (undecidable) { reasons.push('plateau order undecidable'); continue }

    for (let k = 0; k + 1 < ordered.length; k++) {
      const u0 = ordered[k], u1 = ordered[k + 1]
      const A = at(u0), B = at(u1), M = at(cDiv(cAdd(u0, u1), cInt(2)))
      // a degenerate span is a single co-nearest point, not a continuum
      const width = compareCReal(u1, u0)
      if (width === null) { reasons.push('plateau width undecidable'); continue }
      if (width <= 0) continue
      if (regionContains(region, M, rUnits) !== true) continue
      // The span's clearance is measured on the span itself, never inherited from the base point:
      // both generators must be in their interior-projection regime here, so the annihilation
      // proof applies to their TRUE distance, and both must hold the same value.
      const K2 = d2ToFeature(M, f)
      const K2g = d2ToFeature(M, g)
      if (K2 === null || K2g === null) { reasons.push('plateau span clearance undecidable'); continue }
      const bothEqual = compareCReal(K2g, K2)
      if (bothEqual === null) { reasons.push('plateau span equality undecidable'); continue }
      if (bothEqual !== 0) continue
      let interiorRegime = true
      for (const h of [f, g]) {
        const d = { x: h.seg.bx - h.seg.ax, y: h.seg.by - h.seg.ay }
        const len2 = d.x * d.x + d.y * d.y
        const t = cAdd(cMul(cSub(M.x, cB(h.seg.ax)), cB(d.x)), cMul(cSub(M.y, cB(h.seg.ay)), cB(d.y)))
        const lo = signOf(t), hi = signOf(cSub(cB(len2), t))
        if (lo === null || hi === null) { reasons.push('plateau regime undecidable'); interiorRegime = false; break }
        if (lo <= 0 || hi <= 0) { interiorRegime = false; break } // nearest point is an endpoint: not constant
      }
      if (!interiorRegime) continue
      // and no other feature is strictly closer anywhere on the span
      let nearer = false
      for (const other of features) {
        const df = d2ToFeature(M, other)
        if (df === null) { reasons.push('plateau span check undecidable'); nearer = true; break }
        const cmp = compareCReal(df, K2)
        if (cmp === null) { reasons.push('plateau span check undecidable'); nearer = true; break }
        if (cmp < 0) { nearer = true; break }
      }
      if (nearer) continue
      const e = evaluate(cSqrt(K2), BigInt(64))
      plateaus.push({ from: A, to: B, mid: M, d2: K2, lo: e.lo, hi: e.hi, features: [f, g] })
      considerCandidate({ p: M, d2: K2, lo: e.lo, hi: e.hi, features: [f, g] })
    }
  }

  if (!candidates.length) { reasons.push('no candidate isolated'); return { status: 'unresolved', reasons, cellsEvaluated: evaluated } }
  if (cells.length) { reasons.push(`${cells.length} cells still undominated`); return { status: 'unresolved', reasons, cellsEvaluated: evaluated } }

  // Winner by EXACT comparison, never by interval order: an enclosure with a lower `lo` may still
  // hold the larger exact value, so every candidate is compared exactly against the running best.
  let best = candidates[0]
  let ties: Candidate[] = []
  const samePoint = (a: Candidate, b: Candidate) => signOf(cSub(a.p.x, b.p.x)) === 0 && signOf(cSub(a.p.y, b.p.y)) === 0
  for (const cand of candidates.slice(1)) {
    // a strictly dominated enclosure needs no exact work
    if (compareExact(cand.hi, best.lo) < 0) continue
    const cmp = compareCReal(cand.d2, best.d2)
    if (cmp === null) { reasons.push('candidate comparison undecidable'); return { status: 'unresolved', reasons, cellsEvaluated: evaluated } }
    if (cmp > 0) { best = cand; ties = [] }
    else if (cmp === 0 && !samePoint(cand, best) && !ties.some((t) => samePoint(t, cand))) ties.push(cand)
  }
  // a candidate skipped by the interval shortcut can never equal the final best; re-verify any
  // whose enclosure still reaches it
  for (const cand of candidates) {
    if (cand === best || ties.includes(cand)) continue
    if (compareExact(cand.hi, best.lo) < 0) continue
    const cmp = compareCReal(cand.d2, best.d2)
    if (cmp === null) { reasons.push('candidate comparison undecidable'); return { status: 'unresolved', reasons, cellsEvaluated: evaluated } }
    if (cmp > 0) { reasons.push('winner not maximal'); return { status: 'unresolved', reasons, cellsEvaluated: evaluated } }
    if (cmp === 0 && !samePoint(cand, best) && !ties.some((t) => samePoint(t, cand))) ties.push(cand)
  }
  // a plateau is only reported when the maximum is actually attained on it
  const winning: Plateau[] = []
  for (const pl of plateaus) {
    const cmp = compareCReal(pl.d2, best.d2)
    if (cmp === null) { reasons.push('plateau winner comparison undecidable'); return { status: 'unresolved', reasons, cellsEvaluated: evaluated } }
    if (cmp === 0) winning.push(pl)
  }
  // CANONICAL EVIDENCE: a co-maximal continuum is reported once. Point candidates lying ON a
  // winning branch are absorbed into it — otherwise one branch would yield a plateau plus discrete
  // ties, i.e. several centre decisions and identities for a single co-maximal set. Isolated equal
  // maxima off every branch stay ties.
  const onBranch = (q: P2, pl: Plateau): boolean | null => {
    const ex = cSub(pl.to.x, pl.from.x), ey = cSub(pl.to.y, pl.from.y)
    const wx = cSub(q.x, pl.from.x), wy = cSub(q.y, pl.from.y)
    const col = signOf(cSub(cMul(ex, wy), cMul(ey, wx)))
    if (col === null) return null
    if (col !== 0) return false
    const t = cAdd(cMul(wx, ex), cMul(wy, ey))
    const lo = signOf(t), hi = signOf(cSub(cAdd(cMul(ex, ex), cMul(ey, ey)), t))
    if (lo === null || hi === null) return null
    return lo >= 0 && hi >= 0
  }
  let absorbed: Candidate[] = ties
  if (winning.length) {
    const keep: Candidate[] = []
    for (const cand of ties) {
      let swallowed = false
      for (const pl of winning) {
        const on = onBranch(cand.p, pl)
        if (on === null) { reasons.push('plateau absorption undecidable'); return { status: 'unresolved', reasons, cellsEvaluated: evaluated } }
        if (on) { swallowed = true; break }
      }
      if (!swallowed) keep.push(cand)
    }
    absorbed = keep
  }
  if (winning.length) {
    // A continuum has no selectable point: the branches ARE the evidence, with one scalar
    // clearance witness. `best` is deliberately not returned here.
    const [head, ...rest] = winning
    return { status: 'plateau', branches: [head, ...rest], clearanceLo: head.lo, clearanceHi: head.hi, d2: head.d2, reasons, cellsEvaluated: evaluated }
  }
  if (absorbed.length) {
    const [second, ...rest] = absorbed
    return { status: 'tie', candidates: [best, second, ...rest], reasons, cellsEvaluated: evaluated }
  }
  return { status: 'certified', best, reasons, cellsEvaluated: evaluated }
}

function nearestDist2ToSeg(px: bigint, py: bigint, s: ExactSegment): ExactRational {
  const dx = s.bx - s.ax, dy = s.by - s.ay, len2 = dx * dx + dy * dy
  const wx = px - s.ax, wy = py - s.ay
  if (len2 === BigInt(0)) return rational(wx * wx + wy * wy, BigInt(1))
  const t = wx * dx + wy * dy
  if (t <= BigInt(0)) return rational(wx * wx + wy * wy, BigInt(1))
  if (t >= len2) { const ex = px - s.bx, ey = py - s.by; return rational(ex * ex + ey * ey, BigInt(1)) }
  const cr = wx * dy - wy * dx
  return rational(cr * cr, len2)
}

/** report-only */
export const candidateApprox = (cand: Candidate, unit: bigint): { x: number; y: number; clearance: number } => ({
  x: approx(cand.p.x) / Number(unit), y: approx(cand.p.y) / Number(unit), clearance: (Number(cand.lo.n) / Number(cand.lo.d)) / Number(unit),
})
