// units/judge.ts — JUDGE: which offers are lawful, and in what order they stand.
//
// The rules that were buried inside the band ladder (S2 step 6). Judge decides; it never places a
// magnet, never wraps and never mutates a population.

import type { BandRung, CanonPriority } from '../types'

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

/** Cross-axis displacement of a wrapped Canon rung — the frame centre IS `originMM` for Canon
 *  wraps (frameMidMM is the frame origin), so no geometry is recomputed here. */
export function centringMM(at: BandRung['at'], axis: 0 | 1): number {
  return Math.abs(at.originMM[axis] - at.anchorMM[axis])
}

/** THE OPTIMAL ORDER (Dan, 2026-09-01/02) among wrapped priority candidates. The priority tuple has
 *  already decided WHICH node sets are offered; among lawful wraps of those:
 *  - slim frames: CENTRED FIRST, TIGHTEST AMONG CENTRED — "if we have scale bandwidth we can afford to
 *    fit closer to center". A placement is centred when its frame axis sits within `onAxisMM` of the
 *    governed centre — the physical radius of the smallest seat in the active magnet plan, supplied
 *    by the caller, never a constant here. If any centred size exists in the band the tightest of
 *    them wins; otherwise the best-centred wins. No exchange rate, no tolerance dial (Dan,
 *    2026-09-02: "take whichever non invented execution by you and follows my directive and intent").
 *  - every other frame: the tightest stands.
 *  Then the closest to the governed centre, then a stable id. Pure ordering — no geometry. */
export function orderCanonOffers<T extends { rung: BandRung; id: string }>(rows: T[], priority?: CanonPriority, onAxisMM = 0): T[] {
  if (!priority?.slim) return [...rows].sort((a, b) => a.rung.at.sizeMM - b.rung.at.sizeMM
    || a.rung.at.centreOffMM - b.rung.at.centreOffMM || a.id.localeCompare(b.id))
  const onAxis = onAxisMM
  const dx = (r: T) => centringMM(r.rung.at, priority.centreAxis)
  const anyCentred = rows.some((r) => dx(r) <= onAxis)
  const key = (r: T) => anyCentred ? (dx(r) <= onAxis ? r.rung.at.sizeMM : Infinity) : dx(r)
  return [...rows].sort((a, b) => key(a) - key(b)
    || a.rung.at.sizeMM - b.rung.at.sizeMM
    || a.rung.at.centreOffMM - b.rung.at.centreOffMM
    || a.id.localeCompare(b.id))
}
