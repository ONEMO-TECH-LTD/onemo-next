// units/judge.ts — JUDGE: which offers are lawful, and in what order they stand.
//
// The rules that were buried inside the band ladder (S2 step 6). Judge decides; it never places a
// magnet, never wraps and never mutates a population.

import type { BandRung } from '../types'

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

/** THE OPTIMAL ORDER (Dan, 2026-09-01) among wrapped priority candidates. The priority tuple has
 *  already decided WHICH node sets are offered; among lawful wraps of those, the tightest stands,
 *  then the closest to the governed centre, then a stable id. Pure ordering — no geometry. */
export function orderCanonOffers<T extends { rung: BandRung; id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.rung.at.sizeMM - b.rung.at.sizeMM
    || a.rung.at.centreOffMM - b.rung.at.centreOffMM
    || a.id.localeCompare(b.id))
}
