// Magnetic-grid Logic: Centre policy over completed neutral measurements.

import type { Anchor, BBox, Band, CentreMeasurements, CentreMode, CentrePhaseCandidate, CentrePlacementMeasurement, Governor, MagnetPlan, PerimeterMeasurement, Pt } from './spec'
import {
  BANDS,
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  MIN_ANCHORS,
} from './spec'

const QUANTUM_KEY_MM = 0.001
const mod = (v: number, m: number) => ((v % m) + m) % m

/** The cloned Centre parity predicate, unchanged in T2. */
export function parityHolds(seat: ReadonlyArray<Pt>, target: Pt, bb: BBox, pitch: number): boolean {
  if (!seat.length) return false
  const lines = (axis: 0 | 1) => new Set(seat.map((s) => Math.round(s[axis] / QUANTUM_KEY_MM))).size
  const onNode = (axis: 0 | 1) => {
    const off = mod(seat[0][axis] - target[axis], pitch)
    return off < pitch / 4 || off > pitch * 3 / 4
  }
  void bb
  return (lines(0) % 2 === 1) === onNode(0) && (lines(1) % 2 === 1) === onNode(1)
}

/** Which band a size falls in — dominant side against the band ranges. Null above the last. */
export function bandOf(sizeMM: number): Band | null {
  for (const b of BANDS) if (sizeMM >= b.minMM && sizeMM <= b.maxMM) return b
  return null
}

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
  measured: CentreMeasurements,
): Pt[] {
  if (mode === 0) return [measured.box]
  if (mode === 3) return [measured.weight]
  if (mode === 1) return [measured.core]
  if (mode === 4) return [measured.deep]
  if (mode === 5) return [measured.top]
  // Mode 2 — adaptive: every mass centre anchors; scoring chooses between them.
  return measured.masses.length ? measured.masses.map((m) => m.centreMM) : [measured.box]
}

/** The four class-derived Centre phases. Geometry is measured later by compute. */
export function centrePhaseCandidates(target: Pt, bb: BBox, pitch: number): CentrePhaseCandidate[] {
  const bxc = target[0] - bb.minX, byc = target[1] - bb.minY
  const half = pitch / 2
  const clsOf = (side: number) => bandOf(side)?.id ?? BANDS[BANDS.length - 1].id
  const canX = clsOf(bb.maxX - bb.minX) % 2 === 1 ? bxc : bxc + half
  const canY = clsOf(bb.maxY - bb.minY) % 2 === 1 ? byc : byc + half
  const otherX = canX === bxc ? bxc + half : bxc
  const otherY = canY === byc ? byc + half : byc
  return [
    { phaseMM: [canX, canY], canon: 2 },
    { phaseMM: [otherX, canY], canon: 1 },
    { phaseMM: [canX, otherY], canon: 1 },
    { phaseMM: [otherX, otherY], canon: 0 },
  ]
}

/** Centre-rules ordering over completed neutral placement measurements. */
export function chooseCentrePlacement(
  candidates: ReadonlyArray<CentrePlacementMeasurement>,
): CentrePlacementMeasurement | null {
  let best: CentrePlacementMeasurement | null = null
  for (const candidate of candidates) {
    if (!candidate.seated.length) continue
    const wins = !best
      || candidate.seated.length > best.seated.length
      || (candidate.seated.length === best.seated.length && candidate.canon > best.canon)
      || (candidate.seated.length === best.seated.length && candidate.canon === best.canon && candidate.excessMM < best.excessMM)
    if (wins) best = candidate
  }
  return best
}

/** Perimeter belt: with >4 seated, drop fully-surrounded interior nodes, never below the minimum. */
export function applyCoverage(
  seated: Pt[],
  perimeterOnly: boolean,
  split: PerimeterMeasurement,
): { seated: Pt[]; interior: Pt[] } {
  if (!perimeterOnly || seated.length <= 4) return { seated, interior: [] }
  if (split.belt.length >= MIN_ANCHORS) return { seated: split.belt, interior: split.interior }
  return { seated, interior: [] }
}


/** Per-anchor magnet size. corners8 → the large body on the extreme corners, small elsewhere. */
export function assignSizes(seated: Pt[], plan: MagnetPlan, bb: BBox): Anchor[] {
  if (plan === 'all8') return seated.map((p) => ({ p, dia: MAGNET_DIA_LARGE_MM }))
  if (plan === 'all6') return seated.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM }))
  return seated.map((p) => {
    const ex = Math.abs(p[0] - bb.minX) < 0.6 || Math.abs(p[0] - bb.maxX) < 0.6
    const ey = Math.abs(p[1] - bb.minY) < 0.6 || Math.abs(p[1] - bb.maxY) < 0.6
    return { p, dia: ex && ey ? MAGNET_DIA_LARGE_MM : MAGNET_DIA_SMALL_MM }
  })
}
