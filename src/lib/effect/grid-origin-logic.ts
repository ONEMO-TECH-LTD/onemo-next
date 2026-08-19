// grid-origin-logic.ts — LOGIC: policies. Reads what compute measured; weighs with spec's values.

import type { Pt } from './types'
import {
  BALANCE_TIE_MM,
  BANDS,
  FLAP_WEIGHT,
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  MIN_ANCHORS,
  SEAT_WEIGHT,
} from './grid-origin-spec'
import { bbox, splitPerimeter, type SafeSegment } from './grid-origin-compute'
import type { Band } from './grid-origin-spec'

/** Which band a size falls in — dominant side against the band ranges. Null above the last. */
export function bandOf(sizeMM: number): Band | null {
  for (const b of BANDS) if (sizeMM >= b.minMM && sizeMM <= b.maxMM) return b
  return null
}

export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type MagnetDia = typeof MAGNET_DIA_SMALL_MM | typeof MAGNET_DIA_LARGE_MM

export interface Anchor { p: Pt; dia: MagnetDia }

/** Registration score: seats above all, then least uncovered material, then balance. Coverage
 *  is bucketed by the tie range, so near-equal coverage lets centring decide — and balance is
 *  capped below one coverage bucket, so centring can NEVER override a real coverage step. */
export function registrationScore(seats: number, flapExcessMM: number, balanceMM: number): number {
  const covered = Math.round(flapExcessMM / BALANCE_TIE_MM) * BALANCE_TIE_MM
  const balance = Math.min(balanceMM, BALANCE_TIE_MM * FLAP_WEIGHT - 1)
  return seats * SEAT_WEIGHT - covered * FLAP_WEIGHT - balance
}

/**
 * The centring target — Dan's rule: THE SMALLEST MASS THAT HOLDS A MAGNET GOVERNS; the grid
 * centres on its deepest point. The roomy masses adapt; an unused sliver can never hijack.
 * Null when no seated magnet lands in any mass — the caller falls back to the box centre.
 */
export function centeringRef(
  segments: ReadonlyArray<SafeSegment>, seated: ReadonlyArray<Pt>,
  inMass: (p: Pt, mass: { bbox: SafeSegment['bbox']; rings: Pt[][] }) => boolean,
): { centreMM: Pt; bbox: SafeSegment['bbox']; rings: Pt[][] } | null {
  let best: { areaMM2: number; centreMM: Pt; bbox: SafeSegment['bbox']; rings: Pt[][] } | null = null
  for (const seg of segments) {
    const masses = seg.masses.length ? seg.masses : [seg]
    for (const m of masses) {
      if (best && m.areaMM2 >= best.areaMM2) continue
      if (seated.some((p) => inMass(p, m))) best = m
    }
  }
  return best
}

/** Perimeter belt: with >4 seated, drop fully-surrounded interior nodes, never below the minimum. */
export function applyCoverage(
  seated: Pt[],
  perimeterOnly: boolean,
  pitch: number,
): { seated: Pt[]; interior: Pt[] } {
  if (!perimeterOnly || seated.length <= 4) return { seated, interior: [] }
  const split = splitPerimeter(seated, pitch)
  if (split.belt.length >= MIN_ANCHORS) return { seated: split.belt, interior: split.interior }
  return { seated, interior: [] }
}

/** Per-anchor magnet size. corners8 → the large body on the extreme corners, small elsewhere. */
export function assignSizes(seated: Pt[], plan: MagnetPlan): Anchor[] {
  if (plan === 'all8') return seated.map((p) => ({ p, dia: MAGNET_DIA_LARGE_MM }))
  if (plan === 'all6') return seated.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM }))
  const bb = bbox(seated)
  return seated.map((p) => {
    const ex = Math.abs(p[0] - bb.minX) < 0.6 || Math.abs(p[0] - bb.maxX) < 0.6
    const ey = Math.abs(p[1] - bb.minY) < 0.6 || Math.abs(p[1] - bb.maxY) < 0.6
    return { p, dia: ex && ey ? MAGNET_DIA_LARGE_MM : MAGNET_DIA_SMALL_MM }
  })
}

/** Holding: at least one seat and every edge within reach. The layout itself is whatever the
 *  material carries — single, pair, 2x2, rows — never a required pattern. */
export function isHolding(seatedCount: number, flapCount: number): boolean {
  return seatedCount >= 1 && flapCount === 0
}

/** The verdict: what counts as a refusal and how it is said. */
export function verdictIssues(
  degenerate: boolean,
  seatedCount: number,
  flapCount: number,
  padMM: number,
): string[] {
  const issues: string[] = []
  if (degenerate) issues.push(`No room for a magnet — the shape is too small/thin to fit a magnet plus its ${padMM}mm application ring.`)
  else if (seatedCount === 0) issues.push(`Too small — no magnet grips material. Pick a band to snap to a holding size.`)
  if (flapCount > 0) issues.push(`Some edge areas have no magnet within reach (red edge). Pick a band, or raise the flap allowance.`)
  return issues
}
