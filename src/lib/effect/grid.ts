// grid.ts — magnetic-grid REGISTRATION (Session 59). Pure mm computation, no DOM / no three.
//
// The model (SSOT _ssot-workbench/_briefs/magnetic-grid-standard-brief.md + Dan, 2026-07-20):
//   • Fixed 48mm pitch (centre-to-centre). The lattice PHASE is the free parameter.
//   • PER-SPOT padding: each magnet needs `pad`mm of material around it (its application ring), so its
//     centre sits ≥ (magnetRadius + pad) from the outline → erode the silhouette to a "safe zone".
//   • MAX COVERAGE, NEVER COLLAPSE: choose the phase that seats the MOST magnets on material — fit as
//     many points as each axis (width AND height) allows; a tall head fits 2+ vertically, a wide piece
//     fills its columns. Corners are reached by pushing the phase outward.
//   • PERIMETER FRAME (default): drop only FULLY-surrounded interior nodes (regular shapes → an edge
//     belt, a 200mm square ≈ 4–5 per side; thin/irregular shapes keep every point → no collapse).
//   • Sizing ADAPTS: auto-scale up from the selected size until ≥4 magnets seat (envelop the corners).

import type { Contour, Pt } from './types'
import { pointInPolygon } from './attachment'

/** 'diamond' (§13.5c) = checkerboard parity on the main pitch lattice — keeps alternating nodes so the
 *  seated set forms the rotated/diamond arrangement (axis points at one pitch from centre on a disc;
 *  apex + base pair on a triangle). All nodes remain MAIN lattice nodes → registration math unchanged. */
export type GridPattern = 'standard' | 'quincunx' | 'granular' | 'diamond'
export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type MagnetDia = 6 | 8

export const DEFAULT_PITCH_MM = 48
export const PADDING_FLOOR_MM = 10
export const MIN_ANCHORS = 2
export const TARGET_ANCHORS = 4
/** How far a magnet holds material down before an edge would lift — a PHYSICAL distance, independent of
 *  the chosen grid pitch (a fine 24mm grid doesn't make the fabric flap sooner). Tunable (coupon later). */
export const HOLD_REACH_MM = 48

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  pattern?: GridPattern
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — magnetic belt (drop redundant interior)
  center?: 'centroid' | 'bbox' // where the fixed grid is anchored (A/B). default 'centroid'
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
  /** grid slots that HAVE material but couldn't seat a magnet (padding blocked), flanked by seated
   *  neighbours — i.e. an unbalanced hole. balancedFit nudges the size up until this reaches 0. */
  gaps: number
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
  const atom = pitch / 2
  const out: Pt[] = []
  const cross = (xs: number[], ys: number[]) => { for (const x of xs) for (const y of ys) out.push([x, y]) }
  if (pattern === 'granular') {
    cross(axisFrom(bb.minX, bb.maxX, atom, ox), axisFrom(bb.minY, bb.maxY, atom, oy))
  } else if (pattern === 'quincunx') {
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
  return pattern === 'granular' ? pitch / 2
    : pattern === 'quincunx' ? pitch / Math.SQRT2
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

  // A node is VALID = inside the silhouette AND ≥ pad from the outline (10mm application radius, from the
  // magnet centre). Checked PER NODE against the REAL outline — no erosion — so a shape that pinches into
  // separate regions (a duck's head AND body) seats magnets in BOTH, not just the largest eroded piece.
  const valid = (p: Pt) => pointInPolygon(p, outer) && distToRing(p, outer) >= pad
  const inMaterial = (p: Pt) => pointInPolygon(p, outer)

  // CENTER the fixed grid on the shape — balanced by construction (the grid translates as a rigid bulk).
  // A/B: centroid balances MATERIAL (lopsided shapes); bbox-centre balances the FRAME (regular shapes).
  let fullSeated: Pt[] = []
  let gaps = 0
  {
    const c: Pt = centerMode === 'bbox'
      ? [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
      : polyCentroid(outer)
    const ox0 = (((c[0] - bb.minX) % pitch) + pitch) % pitch
    const oy0 = (((c[1] - bb.minY) % pitch) + pitch) % pitch
    const h = pitch / 2
    // Try both CENTRED parities per axis — a node ON the centre vs a cell centred (nodes at ±pitch/2). Both
    // are centred rigid translations; keep whichever seats more → small shapes get a 4-corner cell, not one dot.
    const oxs = [ox0, (ox0 + h) % pitch], oys = [oy0, (oy0 + h) % pitch]
    let bestScore = -Infinity, chosenNodes: Pt[] = []
    // no two magnets closer than 2× the application radius → their padding rings can never overlap
    const minSpacing = 2 * pad
    const checkers = pattern === 'diamond' ? [0, 1] : [0] // diamond: try both checkerboard halves
    for (const px of oxs) for (const py of oys) for (const ck of checkers) {
      const nodes = latticeAt(bb, pitch, pattern, px, py, ck)
      const seat = thinBySpacing(nodes.filter(valid), minSpacing, outer, c)
      let sx = 0, sy = 0; for (const p of seat) { sx += p[0]; sy += p[1] }
      const bal = seat.length ? Math.hypot(sx / seat.length - c[0], sy / seat.length - c[1]) : 1e9
      const score = seat.length * 1000 - bal // most seated, then most balanced
      if (score > bestScore) { bestScore = score; fullSeated = seat; chosenNodes = nodes }
    }
    // GAPS: material slots (inside the silhouette) that couldn't seat because padding was blocked BY THE
    // OUTLINE (too close to an edge) yet are flanked by ≥2 seated neighbours — a hole that a bigger margin
    // would fill. A node dropped for min-SPACING is NOT a gap (it passed the outline test; growing can't
    // help — the neighbour is already there), so we count only nodes that fail `valid`.
    const nR = pitch * 1.2
    for (const n of chosenNodes) {
      if (!inMaterial(n) || valid(n)) continue // no material, or seatable/spacing-dropped → not a growable gap
      let nb = 0; for (const s of fullSeated) if (dist(n, s) <= nR) nb++
      if (nb >= 2) gaps++
    }
  }

  // GUARANTEE ≥1: if the sparse grid seated nothing but the shape can still hold a magnet, drop one at the
  // deepest interior point (a single magnet has no spacing to honour, so grid phase is moot here).
  if (fullSeated.length === 0) {
    const dp = deepestPoint(outer, bb)
    if (dp && dp.d >= pad) fullSeated = [dp.p]
  }

  let seated = fullSeated
  let interior: Pt[] = []
  if (perimeterOnly && seated.length > 4) {
    const split = splitPerimeter(seated, neighbourStep(pitch, pattern))
    if (split.belt.length >= MIN_ANCHORS) {
      // COVERAGE-VERIFIED belt (shape-agnostic): dropping an "interior" node must never uncover the rim —
      // on curved/concave shapes a 4-side-surrounded node can still be the closest cover for a rim dip.
      // Greedily re-add the interior nodes that recover the most uncovered outline until coverage matches
      // what the full set achieves.
      const belt = split.belt.slice()
      const pool = split.interior.slice()
      let uncovered = flapVerts(outer, belt, HOLD_REACH_MM)
      const fullUncovered = flapVerts(outer, fullSeated, HOLD_REACH_MM).length
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

  // LIGHT thinning — 1·3·4·6 (Dan: "keep central 3-4, remove 2 and 5") — applied AFTER the perimeter
  // split, ALONG the belt edges only: top/bottom rows thin their x positions, left/right columns their
  // y positions; corners always stay. Never introduces interior magnets (perimeter stays pure — full
  // grid mode is the dense option). Interior nodes (full mode) thin on the axis cross.
  if (cfg.sparseThin && pitch === 48 && seated.length >= 5) {
    const r1 = (v: number) => Math.round(v * 10) / 10
    const mains = (vals: number[]): number[] => {
      const u0 = [...new Set(vals.map(r1))].sort((a, b) => a - b)
      // main pitch lines only — quincunx half-step offsets are not lines
      return u0.filter((v) => { const m = (((v - u0[0]) % pitch) + pitch) % pitch; return m < 1 || m > pitch - 1 })
    }
    const axisKeep = (u: number[]): Set<number> => {
      if (u.length < 5) return new Set(u)
      const keep = new Set<number>()
      let i = 0, j = u.length - 1, take = true
      while (i <= j) { if (take) { keep.add(u[i]); keep.add(u[j]) } i++; j--; take = !take }
      return keep
    }
    const xs = mains(fullSeated.map((p) => p[0])), ys = mains(fullSeated.map((p) => p[1]))
    if (xs.length >= 5 || ys.length >= 5) {
      const kx = axisKeep(xs), ky = axisKeep(ys)
      const isEnd = (v: number, u: number[]) => u.length > 0 && (Math.abs(v - u[0]) < 1 || Math.abs(v - u[u.length - 1]) < 1)
      const thinned = seated.filter((p) => {
        const x = r1(p[0]), y = r1(p[1])
        const endX = isEnd(x, xs), endY = isEnd(y, ys)
        if (endX && endY) return true                 // corners: always
        if (endY) return kx.has(x)                    // top/bottom row → thin along x
        if (endX) return ky.has(y)                    // left/right column → thin along y
        return kx.has(x) && ky.has(y)                 // interior (full-grid mode only)
      })
      if (thinned.length >= MIN_ANCHORS) seated = thinned
    }
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
    gaps,
  }
}


// ─── LAUNCH LAW (§13, locked 2026-07-21) — 48-family only, procedural zero-point ladder ──────────────
// Launch pitches = 48/96 exclusively (24/72 have no counterpart on the 96-dice garment canvas; small/cap
// domains untested — admin-only experiments). Auto never leaves the family.
/** Grid density preference: 'light' tries the coarse 96 first (sparse, uncrowded — the garment
 *  aesthetic); 'standard' tries 48 first (denser, firmer hold). Same family either way. */
export type GridDensity = 'standard' | 'light'
function allowedPitches(density: GridDensity): number[] { return density === 'standard' ? [48, 96] : [96, 48] }

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

/**
 * Proportion-adaptive pitch (THE mechanism): the COARSEST launch pitch (96 → 48, §13.1) whose grid
 * (a) seats a solid hold (≥ minN magnets) AND (b) COVERS the shape — no outline point further than
 * HOLD_REACH from a magnet (zero flaps). Coverage-by-hold is the ONE shape-agnostic metric (squares,
 * discs, stars, AI cuts alike) and it subsumes the empty-space rule: a dead border beyond reach = flaps
 * (Dan: "empty spaces greater than x must be filled — coarse wins as long as the space is not forcing
 * the variable"). When nothing fully covers, fall back to the coarsest pitch with the FEWEST uncovered
 * outline points. `withMargin` is the effect producer (design + margin).
 */
export function autoPitch(
  withMargin: (m: number) => Contour, cfg: GridConfig, fromMM: number, maxGrowMM: number,
  minN = TARGET_ANCHORS, density: GridDensity = 'light',
): number {
  // evaluate each pitch WITH the auto-margin, in the density's preference order: 'light' coarse-first
  // (96 sparse wins while it still covers), 'standard' dense-first (48 firm hold)
  const ladder = allowedPitches(density)
  let fallback = ladder[ladder.length - 1], fallbackFlaps = Infinity
  for (const p of ladder) {
    const fit = balancedFit(withMargin, { ...cfg, pitchMM: p }, fromMM, maxGrowMM)
    if (fit.grid.anchors.length >= minN && fit.grid.flaps.length === 0) return p
    if (fit.grid.anchors.length >= MIN_ANCHORS && fit.grid.flaps.length < fallbackFlaps) {
      fallback = p; fallbackFlaps = fit.grid.flaps.length
    }
  }
  return fallback
}

/** Scale a normalized contour (longest side = 1mm) to a real longest-side size in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  return { outer: { pts: base.outer.pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt) }, holes: [] }
}

/** RECTANGLE law (§13 / D12): each axis snaps the SAME ladder independently — a rectangle is two rung
 *  choices (W × H), e.g. 214×118 landscape = 96-pitch 3×2 anchors. Non-uniform scale of the normalized
 *  base to real W×H mm. */
export function scaleContourXY(base: Contour, wMM: number, hMM: number): Contour {
  const bb = bbox(base.outer.pts)
  const sx = wMM / Math.max(bb.maxX - bb.minX, 1e-6), sy = hMM / Math.max(bb.maxY - bb.minY, 1e-6)
  return { outer: { pts: base.outer.pts.map(([x, y]) => [(x - bb.minX) * sx, (y - bb.minY) * sy] as Pt) }, holes: [] }
}

/** All rectangle variations from the ladder: every W×H rung pair (W ≥ H — portrait = the transpose).
 *  The common pitch is 48 when either rung is 48-composed, else 96. */
export function rectVariations(law: SizeLaw = DEFAULT_LAW, visibleOnly = true): { w: SizeRung; h: SizeRung; pitchMM: number }[] {
  const rungs = sizeLadder(law).filter((r) => !visibleOnly || r.visible)
  const out: { w: SizeRung; h: SizeRung; pitchMM: number }[] = []
  for (const w of rungs) for (const h of rungs) {
    if (h.sizeMM > w.sizeMM) continue
    out.push({ w, h, pitchMM: w.pitchMM === 48 || h.pitchMM === 48 ? 48 : 96 })
  }
  return out
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
