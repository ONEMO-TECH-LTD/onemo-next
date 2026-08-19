// grid-origin-logic.ts — LOGIC: policies. Reads what compute measured; weighs with spec's values.

import type { Pt } from './types'
import {
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

/** Registration score — the BLESSED voting order (perfect-slow/perfect-fast builds): seats
 *  above all, then UNCOVERED MATERIAL (the flap dial's placement power — it pulls magnets
 *  toward material), then balance to the centre as the tie-break. Exact centring is the
 *  CENTRE-RULES law's job, not this score's — the two positioning laws split the principles. */
export function registrationScore(seats: number, flapExcessMM: number, balanceMM: number): number {
  return seats * SEAT_WEIGHT - flapExcessMM * FLAP_WEIGHT - balanceMM
}

export type CentreMode = 0 | 1 | 2 | 3 | 4 | 5
export type Governor = 0 | 1 | 2 | 3

/** Which mass rules — the switchable governor: 0 smallest area · 1 deepest · 2 top (gravity) ·
 *  3 top-small — RULED 2026-08-19: among masses in the shape's upper half the smallest governs;
 *  if nothing lives in the upper half, the topmost governs. The small mass needs the precision,
 *  the upper mass needs the anchor; a bottom sliver can never rule, and the governor stays
 *  stable across the size ladder. */
export function governMass<M extends { areaMM2: number; centreMM: Pt; peakClearMM?: number }>(
  masses: ReadonlyArray<M>, governor: Governor, midY?: number,
): M | null {
  if (!masses.length) return null
  if (governor === 3) {
    const mid = midY ?? Math.min(...masses.map((m) => m.centreMM[1]))
    const upper = masses.filter((m) => m.centreMM[1] >= mid)
    if (upper.length) return governMass(upper, 0)
    return governMass(masses, 2)
  }
  let best = masses[0]
  for (const m of masses) {
    if (governor === 0 && m.areaMM2 < best.areaMM2) best = m
    if (governor === 1 && (m.peakClearMM ?? 0) > (best.peakClearMM ?? 0)) best = m
    if (governor === 2 && m.centreMM[1] > best.centreMM[1]) best = m
  }
  return best
}

/**
 * The centres a mode aims at — the switchable test system. Every returned point both anchors
 * the slide walk and (for single-target modes) is the balance target. Mode 2 returns every
 * mass centre; its balance target is then the governing mass via centeringRef.
 */
export function centeringAnchors(
  mode: CentreMode,
  segments: ReadonlyArray<SafeSegment>,
  boxCentre: Pt,
  weightCentre: Pt,
): Pt[] {
  if (mode === 0) return [boxCentre]
  if (mode === 3) return [weightCentre]
  if (!segments.length) return [boxCentre]
  if (mode === 1) {
    // The whole erosion area's centre — area-weighted mean of the islands' means.
    let n = 0, sx = 0, sy = 0
    for (const seg of segments) { n += seg.areaMM2; sx += seg.meanMM[0] * seg.areaMM2; sy += seg.meanMM[1] * seg.areaMM2 }
    return [[sx / n, sy / n]]
  }
  if (mode === 4) {
    // The single most buried point of the shape.
    let best = segments[0]
    for (const seg of segments) if (seg.peakClearMM > best.peakClearMM) best = seg
    return [best.centreMM]
  }
  const masses = segments.flatMap((seg) => (seg.masses.length ? seg.masses : [seg]))
  if (mode === 5) {
    // Gravity: the highest mass governs.
    let top = masses[0]
    for (const m of masses) if (m.centreMM[1] > top.centreMM[1]) top = m
    return [top.centreMM]
  }
  // Mode 2 — adaptive: every mass centre anchors; scoring chooses between them.
  return masses.map((m) => m.centreMM)
}

/**
 * The centring target — Dan's rule: THE SMALLEST MASS THAT HOLDS A MAGNET GOVERNS; the grid
 * centres on its deepest point. The roomy masses adapt; an unused sliver can never hijack.
 * Null when no seated magnet lands in any mass — the caller falls back to the box centre.
 */
export function centeringRef(
  segments: ReadonlyArray<SafeSegment>, seated: ReadonlyArray<Pt>,
  inMass: (p: Pt, mass: { bbox: SafeSegment['bbox']; rings: Pt[][] }) => boolean,
  governor: Governor,
  midY?: number,
): { centreMM: Pt; bbox: SafeSegment['bbox']; rings: Pt[][] } | null {
  const holding: Array<{ areaMM2: number; centreMM: Pt; peakClearMM: number; bbox: SafeSegment['bbox']; rings: Pt[][] }> = []
  for (const seg of segments) {
    const masses = seg.masses.length ? seg.masses : [seg]
    for (const m of masses) if (seated.some((p) => inMass(p, m))) holding.push(m)
  }
  return governMass(holding, governor, midY)
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

/** Holding — THE BAND LAW (Dan, 2026-08-19: "the engine in the bands cannot show by definition
 *  the variants that have flap greater"): at least one seat AND every edge within reach at the
 *  dialled allowance. The flap dial is definitional, not advisory. */
export function isHolding(seatedCount: number, flapCount: number): boolean {
  return seatedCount >= 1 && flapCount === 0
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


