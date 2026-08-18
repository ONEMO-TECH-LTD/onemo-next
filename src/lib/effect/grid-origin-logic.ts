// grid-origin-logic.ts — LOGIC: policies. Reads what compute measured; weighs with spec's values.

import type { Pt } from './types'
import {
  BANDS,
  FLAP_WEIGHT,
  MAGNET_RADIUS_LARGE_MM,
  MAGNET_RADIUS_SMALL_MM,
  MIN_ANCHORS,
  SEAT_WEIGHT,
} from './grid-origin-spec'
import { bbox, splitPerimeter, type GridPattern } from './grid-origin-compute'
import type { Band } from './grid-origin-spec'

/** Which band a size falls in — dominant side against the band ranges. Null above the last. */
export function bandOf(sizeMM: number): Band | null {
  for (const b of BANDS) if (sizeMM >= b.minMM && sizeMM < b.maxMM) return b
  const last = BANDS[BANDS.length - 1]
  return sizeMM === last.maxMM ? last : null
}

export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type MagnetDia = 6 | 8

export interface Anchor { p: Pt; dia: MagnetDia }

/** Which magnet body a plan erodes with — the 8mm body governs any plan that carries one. */
export function magnetRadiusMM(plan: MagnetPlan): number {
  return plan === 'all6' ? MAGNET_RADIUS_SMALL_MM : MAGNET_RADIUS_LARGE_MM
}

/** Registration score: seats above all, then fewest flaps, then balance. */
export function registrationScore(seats: number, flapCount: number, balanceMM: number): number {
  return seats * SEAT_WEIGHT - flapCount * FLAP_WEIGHT - balanceMM
}

/** Perimeter belt: with >4 seated, drop fully-surrounded interior nodes, never below the minimum. */
export function applyCoverage(
  seated: Pt[],
  perimeterOnly: boolean,
  pitch: number,
  pattern: GridPattern,
  step: (pitch: number, pattern: GridPattern) => number,
): { seated: Pt[]; interior: Pt[] } {
  if (!perimeterOnly || seated.length <= 4) return { seated, interior: [] }
  const split = splitPerimeter(seated, step(pitch, pattern))
  if (split.belt.length >= MIN_ANCHORS) return { seated: split.belt, interior: split.interior }
  return { seated, interior: [] }
}

/** Per-anchor magnet size. corners8 → 8mm on the extreme corners, 6mm elsewhere. */
export function assignSizes(seated: Pt[], plan: MagnetPlan): Anchor[] {
  if (plan === 'all8') return seated.map((p) => ({ p, dia: 8 as MagnetDia }))
  if (plan === 'all6') return seated.map((p) => ({ p, dia: 6 as MagnetDia }))
  const bb = bbox(seated)
  return seated.map((p) => {
    const ex = Math.abs(p[0] - bb.minX) < 0.6 || Math.abs(p[0] - bb.maxX) < 0.6
    const ey = Math.abs(p[1] - bb.minY) < 0.6 || Math.abs(p[1] - bb.maxY) < 0.6
    return { p, dia: (ex && ey ? 8 : 6) as MagnetDia }
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
  else if (seatedCount === 0) issues.push(`Too small — no magnet grips material. Turn on "Snap size to grid" to auto-size it up.`)
  if (flapCount > 0) issues.push(`Some edge areas have no magnet within reach (red edge). Turn on "Snap size to grid", or reduce the pitch.`)
  return issues
}
