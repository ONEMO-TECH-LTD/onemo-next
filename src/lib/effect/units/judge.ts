// units/judge.ts — JUDGE: which offers are lawful, and in what order they stand.
//
// The rules that were buried inside the band ladder (S2 step 6). Judge decides; it never places a
// magnet, never wraps and never mutates a population.

import type { BandRung, Pt } from '../types'
import { SNAP_STEP_MM } from '../grid-magnet-spec'

/** BAND MEMBERSHIP (Dan, 08-24): a layout whose TRUE wrapped size falls outside the band does not
 *  exist in that band. No clamping to band floors — the size decides, not the request. */
export function inBand(sizeMM: number, loMM: number, hiMM: number): boolean {
  return !(sizeMM < loMM - 0.005 || sizeMM > hiMM + 0.005)
}

/** Offers stand smallest-first. Ordering is judgement, not sequencing. */
export function orderOffers(rungs: BandRung[]): BandRung[] {
  return [...rungs].sort((a, b) => a.at.sizeMM - b.at.sizeMM)
}

/** RULE 4 (Dan, 08-24): prefer the tight solution closest to the centroid — never the smallest at
 *  any centring cost. Among offers of the SAME COUNT as the tightest, within half a pitch of it,
 *  the best-centred is the default landing. Every other lawful offer stays visible. */
export function defaultLanding(rungs: BandRung[], pitchMM: number): number {
  if (!rungs.length) return 0
  const half = pitchMM / 2
  const c0 = rungs[0]
  let idx = 0
  for (let i = 1; i < rungs.length; i++) {
    const r = rungs[i]
    if (r.at.count !== c0.at.count || r.at.sizeMM > c0.at.sizeMM + half) continue
    if (r.at.centreOffMM < rungs[idx].at.centreOffMM - 0.01) idx = i
  }
  return idx
}

/** COVERAGE EVIDENCE — the longest run of outline with no magnet near it.
 *
 *  Dan, 08-25: "unheld between extreme perimeter is fine, edges unprotected is bad." Unheld AREA
 *  is not the measure — it ranked the correct 143mm duck BELOW the wrong 125mm one. The failure is
 *  an unprotected EDGE, so the measure is an arc along the outline, not a region inside it.
 *
 *  `reachMM` is how far a magnet protects along the edge. It is the cell's circumradius,
 *  `pitch/sqrt(2)` — the distance from a lattice node to the corner of its own cell, so the reach
 *  of neighbouring magnets meets exactly where their cells do. A number the lattice already fixes,
 *  not a threshold chosen to make an example pass.
 *
 *  Sampled at the ruled snap step, so the walk resolves the same millimetre the sizes do. */
export function longestUnpinnedRunMM(
  outer: ReadonlyArray<Pt>, points: ReadonlyArray<Pt>, reachMM: number,
): number {
  if (outer.length < 2) return 0
  if (!points.length) return perimeterMM(outer)
  let worst = 0, run = 0
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const steps = Math.max(1, Math.ceil(len / SNAP_STEP_MM))
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.5) / steps
      const p: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      const near = points.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= reachMM)
      if (near) run = 0
      else { run += len / steps; if (run > worst) worst = run }
    }
  }
  return Math.round(worst * 10) / 10
}

/** The outline's own length — what "unpinned" measures against when nothing is seated. */
export function perimeterMM(outer: ReadonlyArray<Pt>): number {
  let total = 0
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length]
    total += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return Math.round(total * 10) / 10
}

/** The reach one magnet has along the edge: its cell's circumradius. */
export function edgeReachMM(pitchMM: number): number {
  return pitchMM / Math.SQRT2
}
