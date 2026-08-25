// grid-magnet-logic.ts — LOGIC: policies. Reads what compute measured; weighs with spec's values.

import type { Pt } from './types'
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
import { bbox, splitPerimeter, type SafeSegment } from './grid-magnet-compute'
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

/**
 * ANCHOR BAKE (Dan, 2026-08-25: "measure the centre once and stick to it — unless size truly
 * moves the inner area's centre"). A centre is a property of the SHAPE: mass deep-points, the
 * box centre, the centroid and the global deep point are fixed relative features and scale
 * linearly with size — re-measuring them per size only re-samples mesh noise (the 2mm grid),
 * which is what the slider jitter was. What IS size-dependent is QUALIFICATION: clearance is
 * fixed in real mm while the shape scales, so a mass governs only at sizes where its depth
 * (which also scales linearly — exact, not approximated) still clears the dial. Core mode is
 * excluded: its definition (area-weighted mean of the legal area) truly moves with size, so
 * it stays measured live.
 */
export interface AnchorBake {
  refMM: number
  boxC: Pt
  weightC: Pt
  /** Deepest island's deep point at reference — the global Deep anchor. */
  deepC: Pt
  refMidY: number
  masses: Array<{ centreMM: Pt; areaMM2: number; peakClearMM: number }>
}

export function anchorBakeOf(
  segments: ReadonlyArray<SafeSegment>, boxC: Pt, weightC: Pt, refMM: number, refMidY: number,
): AnchorBake {
  let deep = segments[0]
  for (const seg of segments) if (seg.peakClearMM > (deep?.peakClearMM ?? -Infinity)) deep = seg
  const masses = segments.flatMap((s) => (s.masses.length ? s.masses : [s]))
    .map((m) => ({ centreMM: m.centreMM, areaMM2: m.areaMM2, peakClearMM: m.peakClearMM }))
  return { refMM, boxC, weightC, deepC: deep?.centreMM ?? boxC, refMidY, masses }
}

/**
 * The governed anchor at a size, from the bake. Null for Core (mode 1) — the caller measures
 * that one live, per its own size-dependent definition. Positions scale linearly; the governor
 * chooses among the masses whose scaled depth still clears the dial.
 */
export function anchorFromBake(
  bake: AnchorBake, mode: CentreMode, governor: Governor, massDepthMM: number, sizeMM: number,
): Pt | null {
  const sc = sizeMM / bake.refMM
  const at = (p: Pt): Pt => [p[0] * sc, p[1] * sc]
  if (mode === 0) return at(bake.boxC)
  if (mode === 1) return null
  if (mode === 3) return at(bake.weightC)
  if (mode === 4) return at(bake.deepC)
  const qualifying = bake.masses
    .filter((m) => m.peakClearMM * sc >= massDepthMM)
    .map((m) => ({ centreMM: at(m.centreMM), areaMM2: m.areaMM2 * sc * sc, peakClearMM: m.peakClearMM * sc }))
  const pool = qualifying.length ? qualifying : bake.masses.map((m) => ({ centreMM: at(m.centreMM), areaMM2: m.areaMM2 * sc * sc, peakClearMM: m.peakClearMM * sc }))
  if (mode === 5) {
    let top = pool[0]
    for (const m of pool) if (m.centreMM[1] > top.centreMM[1]) top = m
    return top?.centreMM ?? at(bake.boxC)
  }
  return governMass(pool, governor, bake.refMidY * sc)?.centreMM ?? at(bake.boxC)
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


