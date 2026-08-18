// grid-origin-logic.ts — LOGIC: policies and laws. Which body a plan uses, how a registration is
// judged, when the belt drops interior nodes, what the verdict says. No geometry — it reads what
// compute measured and applies a rule; the numbers it weighs with come from spec.

import type { Pt } from './types'
import {
  FLAP_WEIGHT,
  MAGNET_RADIUS_LARGE_MM,
  MAGNET_RADIUS_SMALL_MM,
  MIN_ANCHORS,
  SEAT_WEIGHT,
} from './grid-origin-spec'
import { bbox, splitPerimeter, type GridPattern } from './grid-origin-compute'

export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type MagnetDia = 6 | 8

export interface Anchor { p: Pt; dia: MagnetDia }

/** POLICY: which magnet body a plan erodes with — the 8mm body governs any plan that carries one. */
export function magnetRadiusMM(plan: MagnetPlan): number {
  return plan === 'all6' ? MAGNET_RADIUS_SMALL_MM : MAGNET_RADIUS_LARGE_MM
}

/**
 * POLICY: how a registration is judged — seats above all, then fewest flaps, then balance.
 * (The seat-count dominance is v1's standing rule; the selection law is an open product ruling.)
 */
export function registrationScore(seats: number, flapCount: number, balanceMM: number): number {
  return seats * SEAT_WEIGHT - flapCount * FLAP_WEIGHT - balanceMM
}

/**
 * POLICY: the perimeter belt — with more than four seated, drop fully-surrounded interior nodes,
 * but never below the holding minimum.
 */
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

/** POLICY: per-anchor magnet size. corners8 → 8mm on the extreme corners, 6mm elsewhere. */
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

/** POLICY: the verdict — what counts as a refusal and how it is said. */
export function verdictIssues(
  degenerate: boolean,
  seatedCount: number,
  flapCount: number,
  padMM: number,
): string[] {
  const issues: string[] = []
  if (degenerate) issues.push(`No room for a magnet — the shape is too small/thin to fit a magnet plus its ${padMM}mm application ring.`)
  else if (seatedCount < MIN_ANCHORS) issues.push(`Too small — only ${seatedCount} magnet grips material. Turn on "Snap size to grid" to auto-size it up.`)
  if (flapCount > 0) issues.push(`Some edge areas have no magnet within reach (red edge). Turn on "Snap size to grid", or reduce the pitch.`)
  return issues
}
