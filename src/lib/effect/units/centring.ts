// units/centring.ts — CENTRING: where the group's middle sits, and which mass governs it.
//
// Moved from grid-magnet-logic.ts byte-identical (S2, move class VERBATIM). Only the imports below
// are new. CentreMode/Governor and the SafeSegment vocabulary moved to types.ts in the same commit,
// so this unit imports no other unit.

import type { AnchorBake, CentreMode, Governor, Pt, SafeSegment } from '../types'

// Moved out of foundation (F3): zero unit consumers there; the weight centre is centring's.
/** Area centroid of a polygon (shoelace) — the material's weight centre. */
export function centroidOf(pts: ReadonlyArray<Pt>): Pt {
  let a2 = 0, sx = 0, sy = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cross = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    a2 += cross
    sx += (pts[j][0] + pts[i][0]) * cross
    sy += (pts[j][1] + pts[i][1]) * cross
  }
  if (Math.abs(a2) < 1e-9) {
    let mx = 0, my = 0
    for (const p of pts) { mx += p[0]; my += p[1] }
    return [mx / pts.length, my / pts.length]
  }
  return [sx / (3 * a2), sy / (3 * a2)]
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
 * mass centre; the caller selects among them with governMass.
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
