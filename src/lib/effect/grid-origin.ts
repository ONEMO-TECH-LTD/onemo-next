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
import { insetRingMM } from './offset'

export type GridPattern = 'standard' | 'quincunx' | 'granular'
export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type MagnetDia = 6 | 8

export const DEFAULT_PITCH_MM = 48
export const PADDING_FLOOR_MM = 10
export const MIN_ANCHORS = 2
export const TARGET_ANCHORS = 4

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  pattern?: GridPattern
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — magnetic belt (drop redundant interior)
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

/** Node positions along an axis at fixed `step` with a phase offset, spanning [min, max]. */
function axisFrom(min: number, max: number, step: number, phase: number): number[] {
  if (step <= 0 || max <= min) return [(min + max) / 2]
  const res: number[] = []
  let x = min + (((phase % step) + step) % step)
  while (x - step >= min - 1e-6) x -= step
  for (; x <= max + 1e-6; x += step) if (x >= min - 1e-6) res.push(x)
  return res
}

/** Lattice across the bbox at PHASE (ox, oy). Pattern is a parity variant of the 24mm atom. */
function latticeAt(bb: BBox, pitch: number, pattern: GridPattern, ox: number, oy: number): Pt[] {
  const atom = pitch / 2
  const out: Pt[] = []
  const cross = (xs: number[], ys: number[]) => { for (const x of xs) for (const y of ys) out.push([x, y]) }
  if (pattern === 'granular') {
    cross(axisFrom(bb.minX, bb.maxX, atom, ox), axisFrom(bb.minY, bb.maxY, atom, oy))
  } else if (pattern === 'quincunx') {
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox), axisFrom(bb.minY, bb.maxY, pitch, oy))
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox + pitch / 2), axisFrom(bb.minY, bb.maxY, pitch, oy + pitch / 2))
  } else {
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox), axisFrom(bb.minY, bb.maxY, pitch, oy))
  }
  const seen = new Set<string>(); const uniq: Pt[] = []
  for (const p of out) { const k = p[0].toFixed(2) + ',' + p[1].toFixed(2); if (!seen.has(k)) { seen.add(k); uniq.push(p) } }
  return uniq
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
  return pattern === 'granular' ? pitch / 2 : pattern === 'quincunx' ? pitch / Math.SQRT2 : pitch
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
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const issues: string[] = []

  const rMag = plan === 'all6' ? 3 : 4
  const safe = insetRingMM(outer, -(rMag + pad), 'round')
  const hasSafe = !!safe && safe.length >= 3
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  // Phase-optimize: MAX seated count (coverage) first, then fewest flaps, then most-centred/balanced.
  let bestSeated: Pt[] = []
  let bestOx = 0, bestOy = 0
  if (hasSafe) {
    const OFF = 6
    let bestScore = -Infinity
    for (let iy = 0; iy < OFF; iy++) for (let ix = 0; ix < OFF; ix++) {
      const ox = (ix / OFF) * pitch, oy = (iy / OFF) * pitch
      const seat = latticeAt(bb, pitch, pattern, ox, oy).filter((p) => pointInPolygon(p, safe!))
      if (!seat.length) continue
      const flaps = flapVerts(outer, seat, pitch).length
      let sx = 0, sy = 0; for (const p of seat) { sx += p[0]; sy += p[1] }
      const balance = Math.hypot(sx / seat.length - cx, sy / seat.length - cy)
      const score = seat.length * 100000 - flaps * 100 - balance
      if (score > bestScore) { bestScore = score; bestSeated = seat; bestOx = ox; bestOy = oy }
    }
  }

  // GAPS: grid slots with material under them (inside the silhouette) that couldn't seat (padding blocked)
  // yet are flanked by ≥2 seated neighbours — an unbalanced hole. balancedFit nudges size up to clear them.
  let gaps = 0
  if (bestSeated.length) {
    const seatKeys = new Set(bestSeated.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)))
    const nR = pitch * 1.2
    for (const n of latticeAt(bb, pitch, pattern, bestOx, bestOy)) {
      if (seatKeys.has(n[0].toFixed(1) + ',' + n[1].toFixed(1))) continue
      if (!pointInPolygon(n, outer)) continue // no material → not a gap
      let nb = 0
      for (const s of bestSeated) if (dist(n, s) <= nR) nb++
      if (nb >= 2) gaps++
    }
  }

  let seated = bestSeated
  let interior: Pt[] = []
  if (perimeterOnly && seated.length > 4) {
    const split = splitPerimeter(seated, neighbourStep(pitch, pattern))
    if (split.belt.length >= MIN_ANCHORS) { seated = split.belt; interior = split.interior }
  }
  const anchors = assignSizes(seated, plan)

  if (!hasSafe) issues.push(`No room for a magnet — the shape is too small/thin to fit a magnet plus its ${pad}mm application ring.`)
  else if (seated.length < MIN_ANCHORS) issues.push(`Too small — only ${seated.length} magnet grips material. Turn on "Snap size to grid" to auto-size it up.`)
  const flaps: Pt[] = seated.length ? flapVerts(outer, seated, pitch) : []
  if (flaps.length > 0) issues.push(`Some edge areas have no magnet within reach (red edge). Turn on "Snap size to grid", or reduce the pitch.`)

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

/** Scale a normalized contour (longest side = 1mm) to a real longest-side size in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  return { outer: { pts: base.outer.pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt) }, holes: [] }
}

/**
 * Sizing ADAPTS: scan UP from the selected size and return the first size whose grid seats ≥ target
 * magnets (envelops the corners). `sized(mm)` produces the real-mm contour (applies any outline offset).
 */
export function fitSizeToGrid(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number,
  opts: { target?: number; maxMM?: number; step?: number } = {},
): { sizeMM: number; grid: GridResult; snapped: boolean } {
  const target = opts.target ?? TARGET_ANCHORS
  const maxMM = opts.maxMM ?? 300
  const step = opts.step ?? 5
  const start = Math.round(fromMM)
  let fallback: { sizeMM: number; grid: GridResult } | null = null
  for (let mm = start; mm <= maxMM; mm += step) {
    const grid = computeGrid(sized(mm), cfg)
    if (!fallback && grid.anchors.length >= MIN_ANCHORS) fallback = { sizeMM: mm, grid }
    if (grid.anchors.length >= target) return { sizeMM: mm, grid, snapped: mm !== start }
  }
  if (fallback) return { ...fallback, snapped: fallback.sizeMM !== start }
  return { sizeMM: maxMM, grid: computeGrid(sized(maxMM), cfg), snapped: true }
}
