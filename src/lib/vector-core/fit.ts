// vector-core/fit — cubic Bézier fitting (clean-room implementation of the published
// Graphics Gems method: "An Algorithm for Automatically Fitting Digitized Curves",
// P. J. Schneider — chord-length parameterization, least-squares control points along fixed
// unit end-tangents, Newton–Raphson reparameterization, split-at-max-error recursion).
//
// Used OFFLINE to bake organic preset definitions (shape-library) and at GENERATION time by the
// parametric generators + the editor's ring producers (ringToVPath). Never used to "fix" library
// shapes at runtime — presets are static data.

import type { Vec2, VAnchor, VPath } from './types'

export interface CubicSeg {
  p0: Vec2
  c1: Vec2
  c2: Vec2
  p1: Vec2
}

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
const len = (a: Vec2): number => Math.hypot(a.x, a.y)
const norm = (a: Vec2): Vec2 => { const l = len(a) || 1e-12; return { x: a.x / l, y: a.y / l } }

function bezierPoint(s: CubicSeg, t: number): Vec2 {
  const u = 1 - t
  const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t
  return {
    x: w0 * s.p0.x + w1 * s.c1.x + w2 * s.c2.x + w3 * s.p1.x,
    y: w0 * s.p0.y + w1 * s.c1.y + w2 * s.c2.y + w3 * s.p1.y,
  }
}
function bezierD1(s: CubicSeg, t: number): Vec2 {
  const u = 1 - t
  return {
    x: 3 * (u * u * (s.c1.x - s.p0.x) + 2 * u * t * (s.c2.x - s.c1.x) + t * t * (s.p1.x - s.c2.x)),
    y: 3 * (u * u * (s.c1.y - s.p0.y) + 2 * u * t * (s.c2.y - s.c1.y) + t * t * (s.p1.y - s.c2.y)),
  }
}
function bezierD2(s: CubicSeg, t: number): Vec2 {
  const u = 1 - t
  return {
    x: 6 * (u * (s.c2.x - 2 * s.c1.x + s.p0.x) + t * (s.p1.x - 2 * s.c2.x + s.c1.x)),
    y: 6 * (u * (s.c2.y - 2 * s.c1.y + s.p0.y) + t * (s.p1.y - 2 * s.c2.y + s.c1.y)),
  }
}

function chordParams(pts: Vec2[]): number[] {
  const u = [0]
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + len(sub(pts[i], pts[i - 1])))
  const total = u[u.length - 1] || 1e-12
  return u.map((v) => v / total)
}

/** Least-squares c1/c2 along fixed unit end tangents (Wu/Barsky heuristic fallback). */
function generateBezier(pts: Vec2[], u: number[], tHat1: Vec2, tHat2: Vec2): CubicSeg {
  const first = pts[0], last = pts[pts.length - 1]
  let C00 = 0, C01 = 0, C11 = 0, X0 = 0, X1 = 0
  for (let i = 0; i < pts.length; i++) {
    const t = u[i], v = 1 - t
    const b0 = v * v * v, b1 = 3 * v * v * t, b2 = 3 * v * t * t, b3 = t * t * t
    const A1 = scale(tHat1, b1)
    const A2 = scale(tHat2, b2)
    C00 += dot(A1, A1); C01 += dot(A1, A2); C11 += dot(A2, A2)
    const tmp = sub(pts[i], add(scale(first, b0 + b1), scale(last, b2 + b3)))
    X0 += dot(A1, tmp); X1 += dot(A2, tmp)
  }
  const det = C00 * C11 - C01 * C01
  let a1 = 0, a2 = 0
  if (Math.abs(det) > 1e-12) {
    a1 = (X0 * C11 - X1 * C01) / det
    a2 = (C00 * X1 - C01 * X0) / det
  }
  const segLen = len(sub(last, first))
  const eps = 1e-6 * segLen
  if (a1 < eps || a2 < eps) { a1 = a2 = segLen / 3 } // degenerate → heuristic
  return { p0: first, c1: add(first, scale(tHat1, a1)), c2: add(last, scale(tHat2, a2)), p1: last }
}

function maxErrorAt(pts: Vec2[], seg: CubicSeg, u: number[]): { err: number; idx: number } {
  let err = 0, idx = Math.floor(pts.length / 2)
  for (let i = 1; i < pts.length - 1; i++) {
    const d = len(sub(bezierPoint(seg, u[i]), pts[i]))
    if (d > err) { err = d; idx = i }
  }
  return { err, idx }
}

/** One Newton–Raphson step improving each point's parameter. */
function reparameterize(pts: Vec2[], u: number[], seg: CubicSeg): number[] {
  return u.map((t, i) => {
    const d = sub(bezierPoint(seg, t), pts[i])
    const d1 = bezierD1(seg, t)
    const d2 = bezierD2(seg, t)
    const num = dot(d, d1)
    const den = dot(d1, d1) + dot(d, d2)
    if (Math.abs(den) < 1e-12) return t
    return Math.min(1, Math.max(0, t - num / den))
  })
}

function fitRec(pts: Vec2[], tHat1: Vec2, tHat2: Vec2, maxError: number, depth: number, out: CubicSeg[]): void {
  if (pts.length === 2) {
    const d = len(sub(pts[1], pts[0])) / 3
    out.push({ p0: pts[0], c1: add(pts[0], scale(tHat1, d)), c2: add(pts[1], scale(tHat2, d)), p1: pts[1] })
    return
  }
  let u = chordParams(pts)
  let seg = generateBezier(pts, u, tHat1, tHat2)
  let { err, idx } = maxErrorAt(pts, seg, u)
  if (err < maxError) { out.push(seg); return }
  if (err < maxError * maxError * 4 || err < maxError * 4) {
    for (let i = 0; i < 4; i++) {
      u = reparameterize(pts, u, seg)
      seg = generateBezier(pts, u, tHat1, tHat2)
      const m = maxErrorAt(pts, seg, u)
      err = m.err; idx = m.idx
      if (err < maxError) { out.push(seg); return }
    }
  }
  if (depth >= 24) { out.push(seg); return } // bounded recursion — accept best effort
  // split at the worst point; center unit tangent shared (G1 across the split)
  const centerT = norm(sub(pts[idx - 1] ?? pts[idx], pts[idx + 1] ?? pts[idx]))
  fitRec(pts.slice(0, idx + 1), tHat1, centerT, maxError, depth + 1, out)
  fitRec(pts.slice(idx), scale(centerT, -1), tHat2, maxError, depth + 1, out)
}

/** Fit an OPEN polyline with fixed end tangents. */
export function fitCubicsOpen(pts: Vec2[], tHat1: Vec2, tHat2: Vec2, maxError: number): CubicSeg[] {
  const out: CubicSeg[] = []
  if (pts.length < 2) return out
  fitRec(pts, tHat1, tHat2, maxError, 0, out)
  return out
}

/** Indices of true corners on a closed ring (turn angle above threshold). */
export function cornerIndices(ring: Vec2[], angleDeg: number): number[] {
  const n = ring.length
  const out: number[] = []
  const thr = (angleDeg * Math.PI) / 180
  for (let i = 0; i < n; i++) {
    const a = ring[(i - 1 + n) % n], p = ring[i], b = ring[(i + 1) % n]
    const v1 = norm(sub(p, a)), v2 = norm(sub(b, p))
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(v1, v2))))
    if (ang > thr) out.push(i)
  }
  return out
}

/** Convert fitted cubic chains (+ corner flags at chain ends) into a closed VPath. */
function segsToAnchors(chains: { segs: CubicSeg[]; startCorner: boolean }[]): VPath {
  const anchors: VAnchor[] = []
  for (const ch of chains) {
    for (let i = 0; i < ch.segs.length; i++) {
      const s = ch.segs[i]
      if (i === 0) {
        anchors.push({ p: s.p0, hIn: null, hOut: s.c1, corner: ch.startCorner })
      } else {
        // join: previous seg's c2 is hIn, this seg's c1 is hOut (G1/tangent-continuous at splits)
        anchors[anchors.length - 1].hOut = s.c1
        // (anchor for s.p0 was pushed as previous seg's end below)
      }
      anchors.push({ p: s.p1, hIn: s.c2, hOut: null, corner: false })
    }
    anchors.pop() // chain end anchor duplicates the next chain's start — dropped; flags re-applied there
  }
  // close the ring: the final chain's end == the first chain's start (already present at index 0)
  return { anchors }
}

/**
 * ANCHOR COMPACTION (KAI-8974/F3b): Schneider's split-at-max-error recursion never re-merges, so
 * high-curvature features (petal tips, valleys) collect clusters of near-redundant anchors —
 * unusable at finger size (fab-qa: ~34 anchors where ~18 carry the shape). Greedy pairwise merging
 * is structurally too weak here (split points come in PAIRS around each curvature peak; removing
 * either one bridges across the peak and fails tolerance), so this is DP-MINIMAL SEGMENTATION:
 * candidate breakpoints = the fit's own anchors (they sit at curvature peaks, where good
 * breakpoints live); per smooth chain, dynamic programming picks the FEWEST anchors such that
 * every span re-fits as ONE cubic within `budget` of the SOURCE RING (fidelity measured against
 * the source — no drift compounding). Tangents are fixed per node a priori (ring central
 * difference; chain ends keep their one-sided directions), so adjacent spans share unit tangent
 * DIRECTIONS — G1 (tangent) continuous by construction; derivative magnitudes are not enforced.
 * Corner anchors are never candidates (corner integrity).
 */
function compactRingFit(path: VPath, ring: Vec2[], budget: number, minPairPx = 0): VPath {
  const n = ring.length
  const keyOf = (p: Vec2) => `${p.x},${p.y}`
  const ringIdx = new Map<string, number>()
  for (let i = 0; i < ring.length; i++) ringIdx.set(keyOf(ring[i]), i)
  const A = path.anchors
  const m = A.length
  if (m <= 4) return path
  // nodes: every anchor that sits on an exact ring sample. Any anchor we can't locate (e.g. a
  // corner snapped to a raw-trace position) is immovable, like a corner.
  const nodeRing: (number | null)[] = A.map((a) => ringIdx.get(keyOf(a.p)) ?? null)
  const fixed = A.map((a, i) => a.corner || nodeRing[i] === null)
  // fixed-per-node tangent: ring central difference (smooth nodes); corner/unlocatable nodes use
  // their existing one-sided handle directions per span side at fit time.
  const nodeTangent = (i: number): Vec2 | null => {
    const ri = nodeRing[i]
    if (ri === null) return null
    return norm(sub(ring[(ri + 1) % n], ring[(ri - 1 + n) % n]))
  }
  /** fit ONE cubic over the ring span between anchor nodes a→b; returns it if within budget */
  const trySpan = (ia: number, ib: number): CubicSeg | null => {
    const ra = nodeRing[ia]!, rb = nodeRing[ib] ?? null
    const span: Vec2[] = [ring[ra]]
    for (let j = (ra + 1) % n; ; j = (j + 1) % n) {
      span.push(ring[j])
      if (rb !== null && j === rb) break
      if (j === ra) return null // wrapped — degenerate
      if (span.length > n) return null
    }
    if (span.length < 2) return null
    const t1 = fixed[ia]
      ? (A[ia].hOut && len(sub(A[ia].hOut!, A[ia].p)) > 1e-9 ? norm(sub(A[ia].hOut!, A[ia].p)) : norm(sub(span[1], span[0])))
      : nodeTangent(ia)!
    const t2raw = fixed[ib]
      ? (A[ib].hIn && len(sub(A[ib].hIn!, A[ib].p)) > 1e-9 ? norm(sub(A[ib].hIn!, A[ib].p)) : norm(sub(span[span.length - 2], span[span.length - 1])))
      : scale(nodeTangent(ib)!, -1) // incoming direction = reversed forward tangent
    let u = chordParams(span)
    let seg = generateBezier(span, u, t1, t2raw)
    let { err } = maxErrorAt(span, seg, u)
    for (let r = 0; r < 4 && err >= budget; r++) {
      u = reparameterize(span, u, seg)
      seg = generateBezier(span, u, t1, t2raw)
      err = maxErrorAt(span, seg, u).err
    }
    return err < budget ? seg : null
  }
  // chains: runs of consecutive anchor nodes between fixed anchors. Smooth-only rings have no
  // fixed anchor — open the cycle at node 0 (kept; minimal up to the forced seam).
  const order: number[] = A.map((_, i) => i)
  const fixedIdxs = order.filter((i) => fixed[i])
  const chainStarts = fixedIdxs.length ? fixedIdxs : [0]
  const keep = new Set<number>(chainStarts)
  const newSegs = new Map<number, CubicSeg>() // keyed by span START anchor index
  for (let c = 0; c < chainStarts.length; c++) {
    const s0 = chainStarts[c]
    const s1 = chainStarts[(c + 1) % chainStarts.length]
    // the chain's node list s0..s1 (wrapping the anchor array)
    const nodes: number[] = [s0]
    for (let i = (s0 + 1) % m; ; i = (i + 1) % m) {
      nodes.push(i)
      if (i === s1 && nodes.length > 1) break
      if (i === s0) break
    }
    if (nodes.length <= 2) continue // nothing between the fixed ends
    const K = nodes.length
    // DP: minimal cuts from node 0 to node K-1 where each edge is a within-budget single cubic
    const INF = 1e9
    const cost = new Array<number>(K).fill(INF)
    const prev = new Array<number>(K).fill(-1)
    const edgeSeg = new Map<string, CubicSeg>()
    cost[0] = 0
    for (let j = 1; j < K; j++) {
      for (let i = j - 1; i >= 0; i--) {
        if (cost[i] === INF) continue
        if (cost[i] + 1 >= cost[j]) continue // can't improve
        const adjacentReuse = j === i + 1
        const seg = adjacentReuse ? ({} as CubicSeg) : trySpan(nodes[i], nodes[j])
        if (!adjacentReuse && !seg) continue
        cost[j] = cost[i] + 1
        prev[j] = i
        if (!adjacentReuse) edgeSeg.set(`${i}|${j}`, seg as CubicSeg)
        else edgeSeg.delete(`${i}|${j}`)
      }
    }
    // walk back; mark kept nodes and record refitted spans
    let j = K - 1
    while (j > 0) {
      const i = prev[j]
      if (i < 0) break // unreachable (shouldn't happen — adjacent edges always exist)
      keep.add(nodes[i]); keep.add(nodes[j])
      const seg = edgeSeg.get(`${i}|${j}`)
      if (seg) newSegs.set(nodes[i], seg)
      j = i
    }
  }
  // assemble: kept anchors in original order; spans that were re-fitted get the new handles
  const out: VAnchor[] = []
  const outRing: (number | null)[] = [] // each kept anchor's ring index (for the pair-collapse)
  const oldToNew = new Map<number, number>()
  for (let i = 0; i < m; i++) if (keep.has(i)) { oldToNew.set(i, out.length); outRing.push(nodeRing[i]); out.push({ ...A[i] }) }
  for (const [startIdx, seg] of newSegs) {
    const ai = oldToNew.get(startIdx)
    if (ai === undefined) continue
    const a = out[ai]
    const b = out[(ai + 1) % out.length]
    a.hOut = seg.c1
    b.hIn = seg.c2
  }
  // RESIDUAL PAIR-COLLAPSE (fab-qa returner on KAI-8974): the DP picks among existing candidates,
  // so a forced node (the smooth-ring seam) can survive a few px from a natural anchor — two
  // overlapping finger targets. Collapse such a non-corner pair to ONE anchor at the arc-midpoint
  // ring sample, accepted only if BOTH bridging spans fit one cubic within the same budget.
  {
    let bbMinX = Infinity, bbMinY = Infinity, bbMaxX = -Infinity, bbMaxY = -Infinity
    for (const p2 of ring) {
      if (p2.x < bbMinX) bbMinX = p2.x; if (p2.x > bbMaxX) bbMaxX = p2.x
      if (p2.y < bbMinY) bbMinY = p2.y; if (p2.y > bbMaxY) bbMaxY = p2.y
    }
    // the pair floor: 2% of the ring diagonal, raised by the caller's PHYSICAL floor when known
    // (fab-qa re-gate: a 10px valley pair survived the relative floor — finger distinctness is a
    // mm fact, not a viewport fact, so mm-aware callers pass ~1.5mm in content px)
    const sep = Math.max(0.02 * Math.hypot(bbMaxX - bbMinX, bbMaxY - bbMinY), minPairPx)
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const j = (i + 1) % out.length
      const a = out[i], b = out[j]
      if (a.corner || b.corner) continue
      if (Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) >= sep) continue
      const ra = outRing[i], rb = outRing[j]
      if (ra === null || rb === null) continue
      const gap = (rb - ra + n) % n
      if (gap === 0) continue
      const prev = out[(i - 1 + out.length) % out.length]
      const next = out[(j + 1) % out.length]
      const rPrev = outRing[(i - 1 + out.length) % out.length]
      const rNext = outRing[(j + 1) % out.length]
      if (rPrev === null || rNext === null) continue
      const fitSpan = (rFrom: number, rTo: number, t1: Vec2, t2: Vec2): CubicSeg | null => {
        const span: Vec2[] = [ring[rFrom]]
        for (let k = (rFrom + 1) % n; ; k = (k + 1) % n) {
          span.push(ring[k])
          if (k === rTo) break
          if (k === rFrom || span.length > n) return null
        }
        if (span.length < 2) return null
        let u = chordParams(span)
        let seg = generateBezier(span, u, t1, t2)
        let { err } = maxErrorAt(span, seg, u)
        for (let r2 = 0; r2 < 4 && err >= budget; r2++) {
          u = reparameterize(span, u, seg)
          seg = generateBezier(span, u, t1, t2)
          err = maxErrorAt(span, seg, u).err
        }
        return err < budget ? seg : null
      }
      const tPrev = prev.hOut && len(sub(prev.hOut, prev.p)) > 1e-9 ? norm(sub(prev.hOut, prev.p)) : norm(sub(ring[(rPrev + 1) % n], ring[rPrev]))
      const tNext = next.hIn && len(sub(next.hIn, next.p)) > 1e-9 ? norm(sub(next.hIn, next.p)) : norm(sub(ring[rNext], ring[(rNext - 1 + n) % n]))
      // multi-candidate search: the arc-midpoint isn't necessarily the curvature apex — try EVERY
      // ring sample strictly between the pair; only a pair no candidate can carry is load-bearing
      let segIn: CubicSeg | null = null, segOut: CubicSeg | null = null, rc = -1
      for (let step = 1; step < gap; step++) {
        const cand = (ra + step) % n
        const tC2 = norm(sub(ring[(cand + 1) % n], ring[(cand - 1 + n) % n]))
        const sIn = fitSpan(rPrev, cand, tPrev, scale(tC2, -1))
        if (!sIn) continue
        const sOut = fitSpan(cand, rNext, tC2, tNext)
        if (!sOut) continue
        segIn = sIn; segOut = sOut; rc = cand
        break
      }
      if (!segIn || !segOut || rc < 0) continue
      const merged: VAnchor = { p: { ...ring[rc] }, hIn: segIn.c2, hOut: segOut.c1, corner: false }
      prev.hOut = segIn.c1
      next.hIn = segOut.c2
      if (j > i) { out.splice(j, 1); out.splice(i, 1, merged); outRing.splice(j, 1); outRing.splice(i, 1, rc) }
      else { out.splice(i, 1, merged); out.splice(j, 1); outRing.splice(i, 1, rc); outRing.splice(j, 1) }
      i--
    }
  }
  if (out.length >= m && !newSegs.size) return path
  return { anchors: out }
}

/**
 * Fit a CLOSED dense ring into a VPath: corners (turn > angleDeg) become true corner anchors;
 * smooth spans become minimal cubic chains within maxError. Smooth-only rings (no corners) get a
 * seam-free closure: the ring is opened at index 0 with a shared central-difference tangent.
 * `cornersOverride` supplies domain-detected corner indices (e.g. straw-based on noisy strokes)
 * in place of the per-sample turning-angle detector.
 */
export function ringToVPath(ring: Vec2[], angleDeg: number, maxError: number, cornersOverride?: number[], compactError?: number, minPairPx?: number): VPath {
  const n = ring.length
  if (n < 3) return { anchors: ring.map((p) => ({ p, corner: true })) }
  const corners = cornersOverride ?? cornerIndices(ring, angleDeg)
  if (corners.length === 0) {
    // seam tangent via central difference at index 0
    const t0 = norm(sub(ring[1], ring[n - 1]))
    const open = [...ring, ring[0]]
    const segs = fitCubicsOpen(open, t0, scale(t0, -1), maxError)
    const chains = segsToAnchors([{ segs, startCorner: false }])
    // merge seam: last implicit anchor == first; give the first anchor its incoming handle
    const lastSeg = segs[segs.length - 1]
    chains.anchors[0].hIn = lastSeg.c2
    return compactRingFit(chains, ring, compactError ?? maxError, minPairPx)
  }
  const chains: { segs: CubicSeg[]; startCorner: boolean }[] = []
  for (let k = 0; k < corners.length; k++) {
    const i0 = corners[k]
    const i1 = corners[(k + 1) % corners.length]
    const span: Vec2[] = [ring[i0]]
    // walk forward to the NEXT corner; a single-corner ring wraps the whole way around to itself
    for (let i = (i0 + 1) % n; ; i = (i + 1) % n) {
      span.push(ring[i])
      if (i === i1) break
      if (i === i0) break // safety: full loop
    }
    if (span.length < 3) continue
    // one-sided tangents at the corner ends
    const tStart = norm(sub(span[1], span[0]))
    const tEnd = norm(sub(span[span.length - 2], span[span.length - 1]))
    const segs = fitCubicsOpen(span, tStart, tEnd, maxError)
    chains.push({ segs, startCorner: true })
  }
  const path = segsToAnchors(chains)
  // chain boundaries are the corners — re-mark them (segsToAnchors dropped duplicates)
  // anchors[0] is the first corner; each chain start lands where the previous chain ended.
  let idx = 0
  for (const ch of chains) {
    if (path.anchors[idx]) path.anchors[idx].corner = true
    idx += ch.segs.length
  }
  // corner anchors keep independent handles; ensure hIn of each corner comes from the previous chain's last seg
  for (let k = 0, base = 0; k < chains.length; k++) {
    const prev = chains[(k - 1 + chains.length) % chains.length]
    const lastSeg = prev.segs[prev.segs.length - 1]
    if (path.anchors[base]) path.anchors[base].hIn = lastSeg.c2
    base += chains[k].segs.length
  }
  return compactRingFit(path, ring, compactError ?? maxError, minPairPx)
}
