// grid-magnet-logic.ts — LOGIC: policies. Reads what compute measured; weighs with spec's values.

import type { Pt } from './types'

// Moved to units/centring.ts and types.ts (S2). Re-exported so no consumer changes in the move.
export { governMass, centeringAnchors, centeringRef, anchorBakeOf, anchorFromBake, type AnchorBake } from './units/centring'
export type { CentreMode, Governor } from './types'
import {
  BALANCE_WEIGHT,
  BANDS,
  FLAP_WEIGHT,
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  MIN_ANCHORS,
  SEAT_WEIGHT,
  VOTING_ORDER,
} from './grid-magnet-spec'
import { bbox, splitPerimeter } from './grid-magnet-compute'
import type { Band } from './grid-magnet-spec'

/** Which band a size falls in — dominant side against the band ranges. Null above the last. */
export function bandOf(sizeMM: number): Band | null {
  for (const b of BANDS) if (sizeMM >= b.minMM && sizeMM <= b.maxMM) return b
  return null
}

export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type MagnetDia = typeof MAGNET_DIA_SMALL_MM | typeof MAGNET_DIA_LARGE_MM

export interface Anchor { p: Pt; dia: MagnetDia }

/** Magnet count always governs — it is the band's step axis (Dan). The order only decides
 *  which force places the layout among equal counts: press-the-discs first, or centre first. */
export type VotingOrder = 0 | 1
const ORDERS: ReadonlyArray<readonly [number, number]> = [
  [FLAP_WEIGHT, BALANCE_WEIGHT], // magnets > wrap (press) > centring — default
  [BALANCE_WEIGHT, FLAP_WEIGHT], // magnets > centring > wrap (press)
]
export function registrationScore(
  seats: number, pressMM: number, balanceMM: number, order?: VotingOrder,
): number {
  const [pw, bw] = ORDERS[order ?? (VOTING_ORDER as VotingOrder)] ?? ORDERS[0]
  return seats * SEAT_WEIGHT - pressMM * pw - balanceMM * bw
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


