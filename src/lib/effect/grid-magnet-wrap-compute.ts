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
import { bbox } from './foundation/geometry'
import { CENTRE_MODE, GOVERNOR, MASS_DEPTH_MM } from './grid-magnet-spec'
import type { CentreMode, Governor } from './types'
import { wrapGroup } from './units/wrap'


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
    },
  }
}

// THE 1MM SWEEP IS DELETED (Dan, 2026-08-29: "the sweep goes ... segmentation > classification >
// layout is the filter already, wrap applies to that and this is MVP").
//
// It stepped a millimetre at a time across the band, seated whatever the material happened to hold
// at each size, deduped, wrapped each survivor and dropped anything that wrapped into another band
// — 48 solves to stumble on layouts a lookup names directly. It was the placeholder standing where
// step 3's library lookup belongs, and pipeline.ts is that step. Discovery may return later as the
// METHOD for step 5 (next best), which is where searching for something the catalogue does not hold
// actually belongs.
