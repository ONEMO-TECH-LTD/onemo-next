// grid.ts — magnetic-grid REGISTRATION (Session 59). Pure mm computation, no DOM / no three.
//
// The model (SSOT _ssot-workbench/_briefs/magnetic-grid-standard-brief.md §10/§12/§13, locked 2026-07-21):
//   • FIXED lattice, launch family 48/96 (§13.1) — points never move; the whole grid translates as a
//     rigid bulk, CENTRED on the shape (centroid/bbox), best of the centred parities kept.
//   • PER-SPOT padding (interp A): a node is valid = inside the silhouette AND ≥ pad (10mm radius from
//     the magnet centre) from the REAL outline — per-node, no erosion (pinched shapes keep all regions).
//   • ONE physics metric everywhere: HOLD COVERAGE (no outline point beyond HOLD_REACH of a magnet).
//     Auto pitch × pattern selection (autoGrid), margin growth (balancedFit) and the coverage-verified
//     perimeter belt all rank by it — shape-agnostic, no shape-name branches.
//   • MARGIN model: the design never resizes; an outward margin band grows (capped) until covered.
//   • Procedural sizes: zero-point ladder `size = (n−1)·pitch + 2·pad (+2·frame)` → 70+48k (§13.2).

import type { Contour, Pt } from './types'
import { pointInPolygon } from './attachment'

/** THE 48/68 SYSTEM (§13.5d, locked): one lattice, two atoms — straight 48, diagonal 68 (=48√2).
 *  'standard' = straight rows only · 'diamond' = diagonal (68) links only · 'quincunx' (dice) = the
 *  mix (legal ONLY at pitch 96 — its centres land at 48-offsets, the canvas's own dice; a 48-dice
 *  would need 24-offsets, and NOTHING halves either atom). There is no granular/24/72 anywhere. */
export type GridPattern = 'standard' | 'quincunx' | 'diamond'
export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type MagnetDia = 6 | 8

export const DEFAULT_PITCH_MM = 48
export const PADDING_FLOOR_MM = 10
export const MIN_ANCHORS = 2
export const TARGET_ANCHORS = 4
/** How far a magnet holds material down before an edge would lift — a PHYSICAL distance, independent of
 *  the chosen grid pitch (a fine 24mm grid doesn't make the fabric flap sooner). Tunable (coupon later). */
export const HOLD_REACH_MM = 48
/** CORNER TOLERANCE on the pad distance: a convex corner ROUNDING may bring the outline slightly
 *  inside the pad radius — the REAL 70mm product's corner magnets sit ~9mm from the corner arc and
 *  hold (standard rungs must seat their canonical grid at exact size, no margin needed). Tunable. */
export const PAD_CORNER_TOL_MM = 1.5
/** Minimum fraction of the application ring (radius = pad) inside material — the second gate: corner
 *  rounding clips a small arc of the ring (~29% on the squircle) while a thin arm loses ~half, so
 *  encroachment beyond a clipped corner stays invalid. Tunable (coupon later). */
export const RING_COVERAGE_MIN = 0.7

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  pattern?: GridPattern
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — magnetic belt (drop redundant interior)
  center?: 'centroid' | 'bbox' // where the fixed grid is anchored (A/B). default 'centroid'
  /** STRICT pad law: disable the convex-corner tolerance (used by zero-point SIZING solves — a
   *  standard size is defined by the exact pad, the tolerance only rescues seating on rounded corners
   *  at a given size). */
  strictPad?: boolean
  /** LIGHT-mode thinning of 48-composed grids (Dan 2026-07-21: "keep central 3-4, remove 2 and 5"):
   *  per axis keep the ends + alternate inward, always keeping the central pair → 96/48/96 gaps.
   *  A 262 (48×6) light row becomes 1·3·4·6. Applied only at pitch 48 with ≥5 lines. */
  sparseThin?: boolean
}

export interface Anchor { p: Pt; dia: MagnetDia }

export interface GridResult {
  anchors: Anchor[]
  candidates: Pt[]      // interior points dropped by perimeter mode (faint viz)
  flaps: Pt[]
  ok: boolean
  issues: string[]
  pitchCentreMM: number
  edgeRangeMM: [number, number]
  applicationPadMM: number
}

type BBox = { minX: number; minY: number; maxX: number; maxY: number }
function bbox(pts: ReadonlyArray<Pt>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}
function dist(a: Pt, b: Pt) { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

/** Shortest distance from point `p` to segment a–b. */
function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1]
  const wx = p[0] - a[0], wy = p[1] - a[1]
  const c1 = vx * wx + vy * wy
  if (c1 <= 0) return Math.hypot(wx, wy)
  const c2 = vx * vx + vy * vy
  if (c2 <= c1) return Math.hypot(p[0] - b[0], p[1] - b[1])
  const t = c1 / c2
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy))
}
/** Shortest distance from `p` to the outline ring (any edge). Used for the per-node padding test — checked
 *  against the REAL outline (no erosion) so pinched shapes (a duck's head + body) keep BOTH regions. */
function distToRing(p: Pt, ring: ReadonlyArray<Pt>): number {
  let m = Infinity
  for (let i = 0, n = ring.length; i < n; i++) { const d = distToSeg(p, ring[i], ring[(i + 1) % n]); if (d < m) m = d }
  return m
}

/** The most-interior point of the silhouette (pole of inaccessibility, sampled) + its distance to the edge.
 *  Used as the guaranteed single-magnet fallback when the sparse grid seats none. */
function deepestPoint(outer: ReadonlyArray<Pt>, bb: BBox): { p: Pt; d: number } | null {
  const step = Math.max(2, Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 24)
  let best: Pt | null = null, bestD = -1
  for (let x = bb.minX; x <= bb.maxX; x += step) for (let y = bb.minY; y <= bb.maxY; y += step) {
    const p: Pt = [x, y]
    if (!pointInPolygon(p, outer)) continue
    const d = distToRing(p, outer)
    if (d > bestD) { bestD = d; best = p }
  }
  return best ? { p: best, d: bestD } : null
}

/** Area centroid of a polygon ring (balances material). Falls back to bbox centre if degenerate. */
function polyCentroid(ring: ReadonlyArray<Pt>): Pt {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % n]
    const cross = x0 * y1 - x1 * y0
    a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross
  }
  a *= 0.5
  if (Math.abs(a) < 1e-6) { const b = bbox(ring); return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2] }
  return [cx / (6 * a), cy / (6 * a)]
}

/** Node positions along an axis at fixed `step` with a phase offset, spanning [min, max]. */
function axisFrom(min: number, max: number, step: number, phase: number): number[] {
  if (step <= 0 || max <= min) return [(min + max) / 2]
  const res: number[] = []
  let x = min + (((phase % step) + step) % step)
  while (x - step >= min - 1e-6) x -= step
  for (; x <= max + 1e-6; x += step) if (x >= min - 1e-6) res.push(x)
  return res
}

/** Lattice across the bbox at PHASE (ox, oy). Pattern is a parity variant of the 24mm atom.
 *  `checker` (diamond only): which checkerboard half of the main lattice to keep (0 | 1). */
function latticeAt(bb: BBox, pitch: number, pattern: GridPattern, ox: number, oy: number, checker = 0): Pt[] {
  const out: Pt[] = []
  const cross = (xs: number[], ys: number[]) => { for (const x of xs) for (const y of ys) out.push([x, y]) }
  if (pattern === 'quincunx') {
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox), axisFrom(bb.minY, bb.maxY, pitch, oy))
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox + pitch / 2), axisFrom(bb.minY, bb.maxY, pitch, oy + pitch / 2))
  } else if (pattern === 'diamond') {
    // checkerboard on the main lattice: keep nodes where (ix+iy) parity matches → alternating diagonal
    // set (nearest neighbours at pitch·√2). Both parities are tried by the placement search.
    const xs = axisFrom(bb.minX, bb.maxX, pitch, ox), ys = axisFrom(bb.minY, bb.maxY, pitch, oy)
    for (let i = 0; i < xs.length; i++) for (let j = 0; j < ys.length; j++) {
      if ((i + j) % 2 === checker) out.push([xs[i], ys[j]])
    }
  } else {
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox), axisFrom(bb.minY, bb.maxY, pitch, oy))
  }
  const seen = new Set<string>(); const uniq: Pt[] = []
  for (const p of out) { const k = p[0].toFixed(2) + ',' + p[1].toFixed(2); if (!seen.has(k)) { seen.add(k); uniq.push(p) } }
  return uniq
}

/** Greedy min-spacing thinning: keep only magnets whose application rings never overlap — no two centres
 *  closer than `minDist` (= 2× the padding radius, so two 20mm rings can't intersect). Deepest-anchored
 *  kept first, then most central. This is the honest enforcement of per-spot padding: at fine pitch a
 *  quincunx CENTRE sits pitch/√2 from its corners (17mm at pitch 24) — closer than two 20mm rings allow —
 *  so those centres are dropped (Dice-5 correctly collapses to standard at 24mm). Regular 48/24 grids are
 *  untouched (spacing already ≥ minDist). */
function thinBySpacing(pts: Pt[], minDist: number, ring: ReadonlyArray<Pt>, c: Pt): Pt[] {
  const ranked = pts
    .map((p) => ({ p, d: distToRing(p, ring), r: dist(p, c) }))
    .sort((a, b) => b.d - a.d || a.r - b.r) // deepest in material first, then most central
  const kept: Pt[] = []
  for (const { p } of ranked) {
    let clear = true
    for (const q of kept) if (dist(p, q) < minDist - 1e-6) { clear = false; break }
    if (clear) kept.push(p)
  }
  return kept
}

/** Silhouette vertices further than `reach` from the nearest magnet (uncovered/flap-risk edge). */
function flapVerts(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number): Pt[] {
  const out: Pt[] = []
  for (const v of outer) {
    let nd = Infinity
    for (const a of seated) { const d = dist(v, a); if (d < nd) nd = d }
    if (nd > reach) out.push(v)
  }
  return out
}

/** Perimeter split: a node is INTERIOR when it has seated neighbours on all four sides (within `step`).
 *  Returns [perimeter, interior]. Thin shapes have no fully-surrounded node → everything is perimeter. */
function splitPerimeter(seated: ReadonlyArray<Pt>, step: number): { belt: Pt[]; interior: Pt[] } {
  const R = step * 1.45
  const belt: Pt[] = [], interior: Pt[] = []
  for (let i = 0; i < seated.length; i++) {
    const p = seated[i]
    let l = false, r = false, u = false, d = false
    for (let j = 0; j < seated.length; j++) {
      if (j === i) continue
      const dx = seated[j][0] - p[0], dy = seated[j][1] - p[1]
      if (Math.hypot(dx, dy) > R) continue
      if (dx > 1) r = true; else if (dx < -1) l = true
      if (dy > 1) u = true; else if (dy < -1) d = true
    }
    if (l && r && u && d) interior.push(p); else belt.push(p)
  }
  return { belt, interior }
}
function neighbourStep(pitch: number, pattern: GridPattern): number {
  return pattern === 'quincunx' ? pitch / Math.SQRT2
    : pattern === 'diamond' ? pitch * Math.SQRT2 // checkerboard: nearest kept neighbours are diagonal
    : pitch
}

/** Per-anchor magnet size. corners8 → 8mm on the extreme corners, 6mm elsewhere. */
function assignSizes(seated: Pt[], plan: MagnetPlan): Anchor[] {
  if (plan === 'all8') return seated.map((p) => ({ p, dia: 8 as MagnetDia }))
  if (plan === 'all6') return seated.map((p) => ({ p, dia: 6 as MagnetDia }))
  const bb = bbox(seated)
  return seated.map((p) => {
    const ex = Math.abs(p[0] - bb.minX) < 0.6 || Math.abs(p[0] - bb.maxX) < 0.6
    const ey = Math.abs(p[1] - bb.minY) < 0.6 || Math.abs(p[1] - bb.maxY) < 0.6
    return { p, dia: (ex && ey ? 8 : 6) as MagnetDia }
  })
}

/**
 * Magnet grid for a silhouette contour (mm). Phase-optimizes the fixed-pitch lattice to seat the MOST
 * magnets on material (max coverage per axis — never collapses), then in perimeter mode drops only the
 * fully-surrounded interior nodes (a magnetic belt). Each magnet keeps its application ring on material.
 */
export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const pattern = cfg.pattern ?? 'standard'
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const centerMode = cfg.center ?? 'centroid'
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const issues: string[] = []

  // A node is VALID = inside the silhouette AND its application zone is present. Per node against the
  // REAL outline (no erosion — pinched shapes keep all regions). The full pad ring inside is ideal; a
  // convex corner ROUNDING may clip it (the real 70mm product's corner magnets sit ~9mm from the corner
  // arc and hold — standard rungs must seat their canonical grid at exact size, no margin). Accepted
  // only when BOTH hold: pad deficit within the corner tolerance AND most of the ring present — so
  // encroachment on straight edges / thin arms stays invalid.
  const ringCoverage = (p: Pt): number => {
    const N = 24
    let inside = 0
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2
      if (pointInPolygon([p[0] + pad * Math.cos(t), p[1] + pad * Math.sin(t)], outer)) inside++
    }
    return inside / N
  }
  const valid = (p: Pt) => {
    if (!pointInPolygon(p, outer)) return false
    const d = distToRing(p, outer)
    if (d >= pad) return true
    if (cfg.strictPad) return false
    return d >= pad - PAD_CORNER_TOL_MM && ringCoverage(p) >= RING_COVERAGE_MIN
  }

  // FINALIZE a candidate seed into the layout the user actually gets: coverage-verified perimeter belt
  // + light 1·3·4·6 thinning. Placement parities are judged on THIS final layout (not the raw seed) —
  // the old raw-seat-count scoring let a 5-node cross beat a 4-node box, and after the belt dropped the
  // cross's centre the user saw a diamond-arranged result under the STANDARD pattern.
  const finalize = (seed: Pt[]): { seated: Pt[]; interior: Pt[] } => {
    let seated = seed
    let interior: Pt[] = []
    if (perimeterOnly && seated.length > 4) {
      const split = splitPerimeter(seated, neighbourStep(pitch, pattern))
      if (split.belt.length >= MIN_ANCHORS) {
        // COVERAGE-VERIFIED belt (shape-agnostic): dropping an "interior" node must never uncover the
        // rim — on curved/concave shapes a surrounded node can still be the closest cover for a dip.
        const belt = split.belt.slice()
        const pool = split.interior.slice()
        let uncovered = flapVerts(outer, belt, HOLD_REACH_MM)
        const fullUncovered = flapVerts(outer, seed, HOLD_REACH_MM).length
        while (uncovered.length > fullUncovered && pool.length) {
          let bi = -1, bestGain = 0
          for (let i = 0; i < pool.length; i++) {
            let gain = 0
            for (const v of uncovered) if (dist(v, pool[i]) <= HOLD_REACH_MM) gain++
            if (gain > bestGain) { bestGain = gain; bi = i }
          }
          if (bi < 0) break // no interior node can help — residual is a genuine size/pitch problem
          belt.push(pool[bi]); pool.splice(bi, 1)
          uncovered = flapVerts(outer, belt, HOLD_REACH_MM)
        }
        seated = belt; interior = pool
      }
    }
    // LIGHT thinning — 1·3·4·6 (Dan: "keep central 3-4, remove 2 and 5") — along the belt edges only;
    // corners always stay; interior nodes (full-grid mode) thin on the axis cross.
    if (cfg.sparseThin && pitch === 48 && seated.length >= 5) {
      const r1 = (v: number) => Math.round(v * 10) / 10
      const mains = (vals: number[]): number[] => {
        const u0 = [...new Set(vals.map(r1))].sort((a, b) => a - b)
        return u0.filter((v) => { const m = (((v - u0[0]) % pitch) + pitch) % pitch; return m < 1 || m > pitch - 1 })
      }
      const axisKeep = (u: number[]): Set<number> => {
        if (u.length < 5) return new Set(u)
        const keep = new Set<number>()
        let i = 0, j = u.length - 1, take = true
        while (i <= j) { if (take) { keep.add(u[i]); keep.add(u[j]) } i++; j--; take = !take }
        return keep
      }
      const xs = mains(seed.map((p) => p[0])), ys = mains(seed.map((p) => p[1]))
      if (xs.length >= 5 || ys.length >= 5) {
        const kx = axisKeep(xs), ky = axisKeep(ys)
        const isEnd = (v: number, u: number[]) => u.length > 0 && (Math.abs(v - u[0]) < 1 || Math.abs(v - u[u.length - 1]) < 1)
        const thinned = seated.filter((p) => {
          const x = r1(p[0]), y = r1(p[1])
          const endX = isEnd(x, xs), endY = isEnd(y, ys)
          if (endX && endY) return true
          if (endY) return kx.has(x)
          if (endX) return ky.has(y)
          return kx.has(x) && ky.has(y)
        })
        if (thinned.length >= MIN_ANCHORS) seated = thinned
      }
    }
    return { seated, interior }
  }

  // CENTER the fixed grid on the shape — balanced by construction (the grid translates as a rigid bulk).
  // A/B: centroid balances MATERIAL (lopsided shapes); bbox-centre balances the FRAME (regular shapes).
  // Each parity's FINAL layout is scored by: coverage (fewest uncovered outline points) → PATTERN
  // CONFORMANCE (nearest-neighbour spacing must match the pattern's own geometry: standard = pitch,
  // quincunx = pitch/√2, diamond = pitch·√2 — a standard grid must read as straight pitch-spaced rows,
  // never a rotated/diamond arrangement) → most seated → best centred.
  let seated: Pt[] = []
  let interior: Pt[] = []
  {
    const c: Pt = centerMode === 'bbox'
      ? [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
      : polyCentroid(outer)
    const ox0 = (((c[0] - bb.minX) % pitch) + pitch) % pitch
    const oy0 = (((c[1] - bb.minY) % pitch) + pitch) % pitch
    const h = pitch / 2
    const oxs = [ox0, (ox0 + h) % pitch], oys = [oy0, (oy0 + h) % pitch]
    // no two magnets closer than 2× the application radius → their padding rings can never overlap
    const minSpacing = 2 * pad
    const checkers = pattern === 'diamond' ? [0, 1] : [0] // diamond: try both checkerboard halves
    const expectedMp = neighbourStep(pitch, pattern)
    type Cand = { fin: { seated: Pt[]; interior: Pt[] }; flapN: number; conform: number; bal: number }
    const cands: Cand[] = []
    for (const px of oxs) for (const py of oys) for (const ck of checkers) {
      const nodes = latticeAt(bb, pitch, pattern, px, py, ck)
      const seat = thinBySpacing(nodes.filter(valid), minSpacing, outer, c)
      const fin = finalize(seat)
      const flapN = fin.seated.length ? flapVerts(outer, fin.seated, HOLD_REACH_MM).length : outer.length
      let mp = Infinity
      for (let i = 0; i < fin.seated.length; i++) for (let j = i + 1; j < fin.seated.length; j++) {
        const d = dist(fin.seated[i], fin.seated[j]); if (d < mp) mp = d
      }
      const conform = fin.seated.length < 2 ? 1 : Math.abs(mp - expectedMp) < 2 ? 1 : 0
      let sx = 0, sy = 0; for (const p of fin.seated) { sx += p[0]; sy += p[1] }
      const bal = fin.seated.length ? Math.hypot(sx / fin.seated.length - c[0], sy / fin.seated.length - c[1]) : 1e9
      cands.push({ fin, flapN, conform, bal })
    }
    // STANDARD is a HARD conformance law (Dan): straight pitch-spaced rows or nothing — a diamond
    // arrangement must never appear under the standard pattern, even when it covers better (the honest
    // outcome is flaps + margin growth, or the user/auto picking the Diamond pattern explicitly).
    // Other patterns keep coverage-first (their geometry is inherently mixed-spacing).
    const pool = pattern === 'standard' && cands.some((k) => k.conform === 1 && k.fin.seated.length >= MIN_ANCHORS)
      ? cands.filter((k) => k.conform === 1)
      : cands
    let bestKey: [number, number, number, number] | null = null
    for (const k of pool) {
      const key: [number, number, number, number] = [k.flapN, -k.conform, -k.fin.seated.length, k.bal]
      const better = !bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1]
        || (key[1] === bestKey[1] && (key[2] < bestKey[2] || (key[2] === bestKey[2] && key[3] < bestKey[3])))))
      if (better) { bestKey = key; seated = k.fin.seated; interior = k.fin.interior }
    }
  }

  // GUARANTEE ≥1: if the sparse grid seated nothing but the shape can still hold a magnet, drop one at the
  // deepest interior point (a single magnet has no spacing to honour, so grid phase is moot here).
  if (seated.length === 0) {
    const dp = deepestPoint(outer, bb)
    if (dp && dp.d >= pad) { seated = [dp.p]; interior = [] }
  }
  const anchors = assignSizes(seated, plan)

  if (!seated.length) issues.push(`No room for a magnet — too small/thin to keep a magnet ${pad}mm from every edge.`)
  else if (seated.length < MIN_ANCHORS) issues.push(`Too small — only ${seated.length} magnet grips material. Increase the size or the max auto-grow.`)
  const flaps: Pt[] = seated.length ? flapVerts(outer, seated, HOLD_REACH_MM) : []
  if (flaps.length > 0) issues.push(`Some edge areas sit more than ${HOLD_REACH_MM}mm from a magnet (red edge) and could lift. Raise the size / max auto-grow.`)

  let minD = 8, maxD = 6
  for (const a of anchors) { if (a.dia < minD) minD = a.dia; if (a.dia > maxD) maxD = a.dia }
  if (anchors.length === 0) { minD = 6; maxD = 6 }

  return {
    anchors, candidates: interior, flaps,
    ok: issues.length === 0,
    issues,
    pitchCentreMM: pitch,
    edgeRangeMM: [pitch + minD, pitch + maxD],
    applicationPadMM: pad,
  }
}


// ─── LAUNCH LAW (§13, locked 2026-07-21) — 48-family only, procedural zero-point ladder ──────────────
// Launch pitches = 48/96 exclusively (24/72 have no counterpart on the 96-dice garment canvas; small/cap
// domains untested — admin-only experiments). Auto never leaves the family.
/** Grid density preference: 'light' tries the coarse 96 first (sparse, uncrowded — the garment
 *  aesthetic); 'standard' tries 48 first (denser, firmer hold). Same family either way. */
export type GridDensity = 'standard' | 'light'
function allowedPitches(density: GridDensity): number[] { return density === 'standard' ? [48, 96] : [96, 48] }
/** Legal patterns per pitch under the 48/68 system: dice centres live at half-pitch, so quincunx is
 *  legal ONLY at 96 (centres at 48-offsets = the shirt's own dice). Nothing ever sits at 24-offsets. */
export function legalPatterns(pitchMM: number): GridPattern[] {
  return pitchMM % 96 === 0 ? ['standard', 'diamond', 'quincunx'] : ['standard', 'diamond']
}
/** The admin LAW INPUTS that generate every size procedurally — no hand-picked numbers. */
export interface SizeLaw {
  paddingMM: number   // mag-safe radius from magnet centre (default 10)
  frameMM: number     // frame stroke per side (default 1; 0 = frameless… padding then absorbs it)
  maxTestedMM: number // largest physically tested size → rungs above ship hidden (default 214)
  maxRungMM: number   // generator stop (default 310 — the 4-column shirt max)
}
export const DEFAULT_LAW: SizeLaw = { paddingMM: 10, frameMM: 1, maxTestedMM: 214, maxRungMM: 310 }

export interface SizeRung {
  sizeMM: number         // total outer size (the zero-point)
  pitchMM: number        // sparsest pitch composing it (96 preferred over 48 — fewer is better)
  anchorsPerSide: number // anchors along the axis at that pitch
  spanMM: number         // outermost anchor-to-anchor distance
  visible: boolean       // launch-visible (≤ maxTested) vs hidden-untested
}

/**
 * Zero-point ladder (§13.2): a size is OPTIMAL when the magnets' padding coincides edge-to-edge with the
 * effect's padding — `size = (n−1)·pitch + 2·pad (+2·frame)`. With the 48-family this is simply
 * 70 + 48k (pad 10, framed): 70 · 118 · 166 · 214 · 262 · 310. Sparse composition preferred: a rung
 * whose span divides by 96 is a 96-pitch rung (118 = 96×2 beats 48×3 — fewer is better).
 */
export function sizeLadder(law: SizeLaw = DEFAULT_LAW): SizeRung[] {
  const border = 2 * law.paddingMM + 2 * law.frameMM
  const rungs: SizeRung[] = []
  for (let span = 48; span + border <= law.maxRungMM + 1e-6; span += 48) {
    const sparse96 = span % 96 === 0
    const pitch = sparse96 ? 96 : 48
    rungs.push({
      sizeMM: span + border,
      pitchMM: pitch,
      anchorsPerSide: span / pitch + 1,
      spanMM: span,
      visible: span + border <= law.maxTestedMM,
    })
  }
  return rungs
}

/** Snap a requested size to the NEAREST ladder rung (§13.6 standard mode; free shapes snap the same
 *  way). `visibleOnly` (default true) restricts to launch-visible rungs. */
export function snapToRung(mm: number, law: SizeLaw = DEFAULT_LAW, visibleOnly = true): SizeRung {
  const all = sizeLadder(law)
  const pool = visibleOnly ? all.filter((r) => r.visible) : all
  let best = pool[0]
  for (const r of pool) if (Math.abs(r.sizeMM - mm) < Math.abs(best.sizeMM - mm)) best = r
  return best
}

/** GRID MODE — the four user-facing modes (§ goal 2026-07-21):
 *  auto = everything legal + extra surface anchors for irregular shapes · standard = straight (48-atom)
 *  links only · quincunx (dice) = the standard+diamond mix (96 pitch) · diamond = diagonal (68-atom)
 *  links only. */
export type GridMode = 'auto' | GridPattern
function modeCombos(mode: GridMode): { pitchMM: number; pattern: GridPattern }[] {
  const std = [{ pitchMM: 48, pattern: 'standard' as GridPattern }, { pitchMM: 96, pattern: 'standard' as GridPattern }]
  const dia = [{ pitchMM: 48, pattern: 'diamond' as GridPattern }, { pitchMM: 96, pattern: 'diamond' as GridPattern }]
  const dice = [{ pitchMM: 96, pattern: 'quincunx' as GridPattern }]
  return mode === 'standard' ? std : mode === 'diamond' ? dia : mode === 'quincunx' ? dice : [...std, ...dia, ...dice]
}

/** SEMANTIC SIZES (Dan, 2026-07-21): every shape carries its own T-shirt ladder keyed by ANCHOR COUNT —
 *  1 point = 2XS · 2 = XS · 3 = S · 4 = M (the standard) · then 6/8/12/16 → L/XL/2XL/3XL. The mm under
 *  each label is solved numerically per shape from the live inputs (padding + frame/margin + mode), so
 *  changing the recipe or mode recomputes every size. Strict pad law (sizing), perimeter belt. */
export interface SemanticRung { label: string; points: number; sizeMM: number; visible: boolean }
export const SIZE_TIERS: ReadonlyArray<readonly [number, string]> =
  [[1, '2XS'], [2, 'XS'], [3, 'S'], [4, 'M'], [6, 'L'], [8, 'XL'], [12, '2XL'], [16, '3XL']]
export function semanticLadder(
  makeShape: (sizeMM: number) => Contour, law: SizeLaw = DEFAULT_LAW, mode: GridMode = 'auto',
): SemanticRung[] {
  const combos = modeCombos(mode)
  const padEff = law.paddingMM + law.frameMM
  const rungs: SemanticRung[] = []
  let tier = 0
  for (let s = Math.ceil(2 * padEff); s <= law.maxRungMM && tier < SIZE_TIERS.length; s += 1) {
    let best = 0
    for (const cb of combos) {
      const g = computeGrid(makeShape(s), { pitchMM: cb.pitchMM, pattern: cb.pattern, paddingMM: padEff, perimeterOnly: true, strictPad: true })
      if (g.flaps.length) continue
      if (g.anchors.length > best) best = g.anchors.length
    }
    while (tier < SIZE_TIERS.length && best >= SIZE_TIERS[tier][0]) {
      rungs.push({ label: SIZE_TIERS[tier][1], points: SIZE_TIERS[tier][0], sizeMM: s, visible: s <= law.maxTestedMM })
      tier++
    }
  }
  // a shape may jump tiers at one size (a square seats 1 → straight to 4): keep the HIGHEST tier per
  // size — the true anchor count there; skipped tiers simply don't exist for that shape.
  const bySize = new Map<number, SemanticRung>()
  for (const r of rungs) bySize.set(r.sizeMM, r)
  return [...bySize.values()].sort((a, b) => a.sizeMM - b.sizeMM)
}

/**
 * Unified auto selection (pitch × pattern) under the ONE coverage physics — no shape-name branches.
 * AUTO mode covers everything legal in the 48/68 system (standard straight, diamond diagonal, 96-dice
 * mix) and, via per-node validity + the deepest-point guarantee, adds surface anchors on irregular
 * silhouettes (blobs, L-shapes, AI cuts). Pin `pitchMM`/`pattern` for the manual modes — they behave
 * literally. Fewest-uncovered fallback when nothing fully covers.
 */
export function autoGrid(
  withMargin: (m: number) => Contour, cfg: GridConfig, fromMM: number, maxGrowMM: number,
  opts: { minN?: number; density?: GridDensity; pitchMM?: number; pattern?: GridPattern } = {},
): { pitchMM: number; pattern: GridPattern } {
  const minN = opts.minN ?? TARGET_ANCHORS
  const pitches = opts.pitchMM != null ? [opts.pitchMM] : allowedPitches(opts.density ?? 'light')
  const patFor = (p: number): GridPattern[] => opts.pattern != null ? [opts.pattern] : legalPatterns(p)
  let fb = { pitchMM: pitches[pitches.length - 1], pattern: patFor(pitches[pitches.length - 1]).slice(-1)[0] }
  let fbFlaps = Infinity
  for (const p of pitches) for (const pat of patFor(p)) {
    const fit = balancedFit(withMargin, { ...cfg, pitchMM: p, pattern: pat }, fromMM, maxGrowMM)
    if (fit.grid.anchors.length >= minN && fit.grid.flaps.length === 0) return { pitchMM: p, pattern: pat }
    if (fit.grid.anchors.length >= MIN_ANCHORS && fit.grid.flaps.length < fbFlaps) {
      fb = { pitchMM: p, pattern: pat }; fbFlaps = fit.grid.flaps.length
    }
  }
  return fb
}

/** Scale a normalized contour (longest side = 1mm) to a real longest-side size in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  return { outer: { pts: base.outer.pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt) }, holes: [] }
}

/**
 * Sizing ADAPTS (always-on, capped): from the selected size, nudge UP in small steps up to `maxGrowMM`
 * and keep the first size that is BALANCED — full hold coverage (zero flaps: no outline point beyond
 * HOLD_REACH of a magnet) and ≥ target magnets. Coverage-by-hold is the shape-agnostic criterion (the
 * old `gaps` bbox heuristic mis-ranked curved shapes — a disc's rim always has padding-blocked nodes).
 * If nothing within the cap fully covers, keep the size with the fewest uncovered outline points (then
 * most magnets). `sized(mm)` produces the real-mm contour. `maxGrowMM = 0` disables growth.
 */
export function balancedFit(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, maxGrowMM: number,
  opts: { target?: number; step?: number } = {},
): { sizeMM: number; grid: GridResult; grew: number } {
  const target = opts.target ?? TARGET_ANCHORS
  const step = opts.step ?? 3
  const start = Math.round(fromMM)
  const end = start + Math.max(0, maxGrowMM)
  let best: { sizeMM: number; grid: GridResult } | null = null
  let bestRank = Infinity
  for (let mm = start; mm <= end; mm += step) {
    const grid = computeGrid(sized(mm), cfg)
    // perfect = fully covered AND ≥ target magnets → take the first (smallest) such size immediately
    if (grid.flaps.length === 0 && grid.anchors.length >= target) return { sizeMM: mm, grid, grew: mm - start }
    // otherwise rank: fewer uncovered points first, then more magnets (negated), then smaller size
    const rank = grid.flaps.length * 1000 - grid.anchors.length
    if (rank < bestRank) { bestRank = rank; best = { sizeMM: mm, grid } }
  }
  if (best) return { ...best, grew: best.sizeMM - start }
  const grid = computeGrid(sized(start), cfg)
  return { sizeMM: start, grid, grew: 0 }
}
