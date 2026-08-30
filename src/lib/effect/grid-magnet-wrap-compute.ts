/**
 * Temporary S2 pipeline sequencer.
 *
 * Calls the extracted units in the legacy order so public behaviour stays stable during the move:
 * segment measures, centring names the anchor, layout reveals candidates, wrap solves each to its
 * contact size, judge rules on band membership and order. It holds no rule of its own.
 *
 * S3 replaces this file with the one headless pipeline. Until then it is a governed sequencer seat,
 * pinned to an exact set of unit edges by the separation gate — not a self-contained module, which
 * is what its previous header falsely claimed while it imported the door and four units.
 */

import type { BandRung, BandSolve, Contour, GridConfig, GridResult, Pt, WrapAt, WrapConfig } from './types'
import { DEFAULT_PITCH_MM, MAGNET_DIA_SMALL_MM, MAGNET_DIA_LARGE_MM, PADDING_FLOOR_MM } from './grid-magnet-spec'
import { computeGrid } from './grid-magnet'
import { bbox } from './foundation/geometry'
import { contourCentroidOf } from './units/centring'
import { spotRadiusOf } from './units/layout'
import { safeSegments } from './units/segment'
import { centeringAnchors, governMass } from './units/centring'
import { CENTRE_MODE, GOVERNOR } from './grid-magnet-spec'
import type { CentreMode, Governor } from './types'
import { wrapGroup } from './units/wrap'
import { inBand, orderOffers } from './units/judge'
import { bestSeatedCandidate, fallbackRevealSizes } from './units/layout'


/** mm → integer microns; Clipper64 is integer-robust. */



// The wrap solver now lives in units/wrap.ts (S2 step 5); its result shaping stays here with the
// ladder until adapters land in S3. Re-exported so no consumer changes in the move.
export { wrapGroup }
export type { BandRung, BandSolve, WrapAt, WrapConfig } from './types'

/** The wrapped answer as the canvas draws it. Display only — nothing is decided here. */
export function wrapGrid(
  sized: (mm: number) => Contour, cfg: WrapConfig, at: WrapAt,
): { contour: Contour; grid: GridResult } {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const dia = cfg.magnetDiaMM === MAGNET_DIA_LARGE_MM ? MAGNET_DIA_LARGE_MM : MAGNET_DIA_SMALL_MM
  const contour = sized(at.sizeMM)
  const bb = bbox(contour.outer.pts)
  const seed = at.points[0] ?? at.originMM
  const reach = Math.ceil(Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / pitch) + 2
  const lattice: Pt[] = []
  for (let ix = -reach; ix <= reach; ix++) for (let iy = -reach; iy <= reach; iy++)
    lattice.push([seed[0] + ix * pitch, seed[1] + iy * pitch])
  const mod = (v: number, m: number) => ((v % m) + m) % m
  return {
    contour,
    grid: {
      anchors: at.points.map((p) => ({ p, dia })),
      pitchCentreMM: pitch,
      lattice,
      phaseMM: [mod(seed[0] - bb.minX, pitch), mod(seed[1] - bb.minY, pitch)],
      panMM: [0, 0],
      spotRadiusMM: radius,
      contactsMM: at.points.filter((_, i) => (at.gapsMM[i] ?? Infinity) <= 0.6),
      segments: [],
      centresMM: [at.anchorMM],
      centreMainMM: at.anchorMM,
      seatings: [],   // display of a settled answer; the registrations were spent upstream
    },
  }
}

/**
 * THE BAND LADDER, size-first (Dan's reversal, 2026-08-25): the band is the input, the count is
 * the output. Nothing here invents a layout and nothing walks a gate:
 *
 *   1 · REVEAL — at each scanned size, centre-rules seating (the existing engine)
 *       says which magnets the material carries. The layout is read off the material, not chosen.
 *   2 · WRAP — each distinct revealed layout is handed WHOLE to `wrapGroup`, the proven solver:
 *       the group starts centred on the governed anchor and shifts only the minimum a lawful
 *       tighter wrap demands, bisected to the exact contact size. At that size the lawful region
 *       has collapsed — the binding magnets are pressed, a gap is impossible by construction.
 *   3 · BAND MEMBERSHIP — a layout whose contact size falls outside the band belongs to another
 *       band and is not offered here (ruled 08-24).
 *
 * Composition only: computeGrid and wrapGroup are used as they are, byte-untouched.
 */
export function wrapBandLadder(
  sized: (mm: number) => Contour, cfg: GridConfig, loMM: number, hiMM: number, minMM: number,
  anchorAtMM?: (mm: number) => Pt,
): BandSolve {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const scanCfg: GridConfig = { ...cfg, segmentsDetail: 'light', forcePhaseMM: undefined }
  // Sequencer's job: derive the governed centre ONCE and hand it to wrap, which never computes
  // one for itself. Falls back to the same governed centre the old wrap derived internally, so the
  // answer is unchanged — the derivation simply moved to the caller.
  const anchorFn: (mm: number) => Pt = anchorAtMM ?? ((mm: number) => {
    const outer = sized(mm).outer.pts
    const r = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
    const segs = safeSegments(sized(mm), r, 'light')
    const bb = bbox(outer)
    const boxC: Pt = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
    const cands = centeringAnchors((cfg.centreMode ?? CENTRE_MODE) as CentreMode, segs, boxC, contourCentroidOf(sized(mm)))
    if (((cfg.centreMode ?? CENTRE_MODE) as number) !== 2) return cands[0] ?? boxC
    const masses = segs.flatMap((x) => (x.masses.length ? x.masses : [x]))
    return governMass(masses, (cfg.governor ?? GOVERNOR) as Governor, (bb.minY + bb.maxY) / 2)?.centreMM ?? cands[0] ?? boxC
  })
  const wcfg: WrapConfig = {
    pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM,
    centreMode: cfg.centreMode, governor: cfg.governor,
    anchorAtMM: anchorFn,
  }
  const seen = new Set<string>()
  const rungs: BandRung[] = []
  const witnesses: Array<{ revealMM: number; points: Pt[] }> = []
  for (const mm of fallbackRevealSizes(loMM, hiMM)) {
    const pts = computeGrid(sized(mm), anchorAtMM ? { ...scanCfg, centreOverrideMM: anchorAtMM(mm) } : scanCfg).anchors.map((a) => a.p)
    if (!pts.length) continue
    witnesses.push({ revealMM: mm, points: pts })
    // Layout identity: the seated pattern in lattice units, origin-free.
    let mx = Infinity, my = Infinity
    for (const p of pts) { if (p[0] < mx) mx = p[0]; if (p[1] < my) my = p[1] }
    const id = pts.map((p) => Math.round((p[0] - mx) / pitch) + ',' + Math.round((p[1] - my) / pitch)).sort().join(';')
    if (seen.has(id)) continue
    seen.add(id)
    // Local offsets about the group's own middle — wrapGroup pins that middle on the anchor.
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const group = pts.map(([x, y]) => [x - cx, y - cy] as Pt)
    const at = wrapGroup(sized, wcfg, group, minMM, hiMM)
    if (!at) continue
    if (!inBand(at.sizeMM, loMM, hiMM)) continue   // judge: another band owns it
    rungs.push({ at, revealMM: mm })
  }
  return { offers: orderOffers(rungs), bestSeated: bestSeatedCandidate(witnesses) }
}
