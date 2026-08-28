// grid-magnet-wrap-compute.ts — COMPUTE: wrap. Self-contained, exact.
//
// ONE job: add N magnets, shrink the shape onto them.
//
// Method (Clipper2, the recommended geometry route — no physics loop, no iteration artifacts):
//
//   1. Deflate the outline by the disc radius. The remaining region is exactly where a magnet
//      CENTRE is allowed to sit.
//   2. The magnets are a rigid group with local offsets L1..Ln, so the grid origin O is valid iff
//      every O+Li lies in that region — i.e. iff O lies in the INTERSECTION of the region
//      translated by each -Li.
//   3. Non-empty intersection ⟺ the group fits at this size. Empty ⟺ it does not.
//   4. Binary-search the size for the smallest one that still fits. That is the tightest wrap,
//      computed rather than converged on, so it cannot stop early or jitter.
//
// Deliberately disconnected from the rest of the engine: no centring modes, no governing mass, no
// safe-area islands, no voting, no coverage, no flap. Inputs are the outline, the pitch and the
// radius. Nothing here reads a policy.

import type { BandRung, Contour, GridConfig, GridResult, Pt, WrapAt, WrapConfig } from './types'
import { DEFAULT_PITCH_MM, MAGNET_DIA_SMALL_MM, MAGNET_DIA_LARGE_MM, PADDING_FLOOR_MM } from './grid-magnet-spec'
import { computeGrid } from './grid-magnet'
import { bbox, centroidOf, spotRadiusOf } from './foundation/geometry'
import { safeSegments } from './units/segment'
import { centeringAnchors, governMass } from './units/centring'
import { CENTRE_MODE, GOVERNOR, MASS_DEPTH_MM } from './grid-magnet-spec'
import type { CentreMode, Governor } from './types'
import { wrapGroup } from './units/wrap'
import { inBand, orderOffers } from './units/judge'


/** mm → integer microns; Clipper64 is integer-robust. */



// The wrap solver now lives in units/wrap.ts (S2 step 5); its result shaping stays here with the
// ladder until adapters land in S3. Re-exported so no consumer changes in the move.
export { wrapGroup }
export type { BandRung, WrapAt, WrapConfig } from './types'

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
    },
  }
}

/**
 * THE BAND LADDER, size-first (Dan's reversal, 2026-08-25): the band is the input, the count is
 * the output. Nothing here invents a layout and nothing walks a gate:
 *
 *   1 · REVEAL — at each scanned size, centre-rules seating (the existing engine, positioning 1)
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
): BandRung[] {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const scanCfg: GridConfig = { ...cfg, positioning: 1, segmentsDetail: 'light', forcePhaseMM: undefined }
  // Sequencer's job: derive the governed centre ONCE and hand it to wrap, which never computes
  // one for itself. Falls back to the same governed centre the old wrap derived internally, so the
  // answer is unchanged — the derivation simply moved to the caller.
  const anchorFn: (mm: number) => Pt = anchorAtMM ?? ((mm: number) => {
    const outer = sized(mm).outer.pts
    const r = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
    const segs = safeSegments(outer, r, Math.max(r, cfg.massDepthMM ?? MASS_DEPTH_MM), 'light')
    const bb = bbox(outer)
    const boxC: Pt = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
    const cands = centeringAnchors((cfg.centreMode ?? CENTRE_MODE) as CentreMode, segs, boxC, centroidOf(outer))
    if (((cfg.centreMode ?? CENTRE_MODE) as number) !== 2) return cands[0] ?? boxC
    const masses = segs.flatMap((x) => (x.masses.length ? x.masses : [x]))
    return governMass(masses, (cfg.governor ?? GOVERNOR) as Governor, (bb.minY + bb.maxY) / 2)?.centreMM ?? cands[0] ?? boxC
  })
  const wcfg: WrapConfig = {
    pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM,
    centreMode: cfg.centreMode, governor: cfg.governor, massDepthMM: cfg.massDepthMM,
    anchorAtMM: anchorFn,
  }
  const seen = new Set<string>()
  const rungs: BandRung[] = []
  const SCAN_MM = 1
  for (let mm = loMM; mm <= hiMM + 1e-9; mm += SCAN_MM) {
    const pts = computeGrid(sized(mm), anchorAtMM ? { ...scanCfg, centreOverrideMM: anchorAtMM(mm) } : scanCfg).anchors.map((a) => a.p)
    if (!pts.length) continue
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
  return orderOffers(rungs)
}
