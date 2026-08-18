// grid-origin-logic.ts — LOGIC: policies. Reads what compute measured; weighs with spec's values.

import type { Pt } from './types'
import {
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  MIN_ANCHORS,
} from './grid-origin-spec'
import { bbox, splitPerimeter } from './grid-origin-compute'

export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type MagnetDia = typeof MAGNET_DIA_SMALL_MM | typeof MAGNET_DIA_LARGE_MM

export interface Anchor { p: Pt; dia: MagnetDia }

/** One candidate registration's measures, ranked lexicographically. */
export interface LayoutMeasure {
  registered: boolean
  excessMM: number
  seats: number
  balanceMM: number
}

/** Judging order: what matters most when two layouts compete. */
export type RankOrder = 'edges' | 'coverage' | 'count'

/** Layout rank. 'edges' (default, v1 law): registration → coverage → seats → balance.
 *  'coverage' puts wrap first; 'count' is the legacy most-magnets-first behaviour.
 *  Coverage within `tieMM` counts as equal, so lower terms settle near-ties.
 *  Returns true when `a` beats `b`. */
export function betterLayout(a: LayoutMeasure, b: LayoutMeasure, order: RankOrder, tieMM: number): boolean {
  const cover = Math.abs(a.excessMM - b.excessMM) <= tieMM ? 0 : a.excessMM < b.excessMM ? 1 : -1
  const seq = order === 'coverage' ? ['cov', 'reg', 'seats', 'bal']
    : order === 'count' ? ['seats', 'cov', 'bal']
      : ['reg', 'cov', 'seats', 'bal']
  for (const term of seq) {
    if (term === 'reg' && a.registered !== b.registered) return a.registered
    if (term === 'cov' && cover !== 0) return cover > 0
    if (term === 'seats' && a.seats !== b.seats) return a.seats > b.seats
    if (term === 'bal' && a.balanceMM !== b.balanceMM) return a.balanceMM < b.balanceMM
  }
  return false
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

