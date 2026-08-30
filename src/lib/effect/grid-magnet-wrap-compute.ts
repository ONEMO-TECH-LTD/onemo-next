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

import type { BandRung, BandSolve, Contour, GridConfig, GridResult, Pt, RungRole, WrapAt, WrapConfig } from './types'
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
import { bestSeatedCandidate, fallbackRevealSizes, makeContourSeatPredicate } from './units/layout'


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
/** THE THREE ANSWERS Dan asked for: the canon layout tried first, then the fewest magnets in the
 *  range and the most. Anything that coincides collapses, so a shape whose optimal IS its fullest
 *  shows two rows, and one whose optimal is also its sparsest shows one.
 *
 *  `optimalNodesMM` is the layout the lookup named for this band — local offsets about its own
 *  middle. It is handed to the SAME wrapGroup the discovery walk uses; scaling and shrinking to
 *  make it hold are that mechanism's job, unchanged. */
export function wrapBandLadder(
  sized: (mm: number) => Contour, cfg: GridConfig, loMM: number, hiMM: number, minMM: number,
  anchorAtMM?: (mm: number) => Pt, optimalNodesMM?: ReadonlyArray<Pt>,
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
  /** local offsets about a population's own middle — wrapGroup pins that middle on the anchor */
  const localise = (pts: ReadonlyArray<Pt>): Pt[] => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    return pts.map(([x, y]) => [x - cx, y - cy] as Pt)
  }
  /** the seated pattern in lattice units, origin-free */
  const identityOf = (pts: ReadonlyArray<Pt>): string => {
    let mx = Infinity, my = Infinity
    for (const p of pts) { if (p[0] < mx) mx = p[0]; if (p[1] < my) my = p[1] }
    return pts.map((p) => Math.round((p[0] - mx) / pitch) + ',' + Math.round((p[1] - my) / pitch)).sort().join(';')
  }
  const attempt = (pts: ReadonlyArray<Pt>, revealMM: number, floorMM = minMM): BandRung | null => {
    const at = wrapGroup(sized, wcfg, localise(pts), floorMM, hiMM)
    if (!at) return null
    if (!inBand(at.sizeMM, loMM, hiMM)) return null   // judge: another band owns it
    return { at, revealMM, roles: [] }
  }

  // THE OPTIMAL, FIRST. Same wrap, same laws — it just gets asked before anything is discovered.
  //
  // Whole group first: if the shape can carry every magnet at some size in the range, that is the
  // answer and nothing is dropped. Only when it cannot does the second half apply — Dan,
  // 2026-08-30: "if some of the magnets fall off it must either scale or shrink to it". So the
  // layout is SEATED against the real material at the most generous size in the range, whatever
  // the material refuses is dropped and recorded, and the survivors go to the same wrap.
  //
  // Without this an irregular shape gets no optimal at all: the BOT's B4 box admits a 3x4 of
  // twelve, and its actual material holds four. All-or-nothing threw the recommendation away on
  // every real cutout at B4 and B5.
  const seatOptimal = (nodes: ReadonlyArray<Pt>, mm: number): { seated: Pt[]; omitted: Pt[] } => {
    const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
    const fits = makeContourSeatPredicate(sized(mm), radius)
    const anchor = anchorFn(mm)
    const placed = localise(nodes).map(([x, y]) => [anchor[0] + x, anchor[1] + y] as Pt)
    if (!fits) return { seated: [], omitted: [...placed] }
    const seated: Pt[] = [], omitted: Pt[] = []
    for (const q of placed) (fits(q) ? seated : omitted).push(q)
    return { seated, omitted }
  }
  let optimal: BandRung | null = null
  let optimalOmitted = 0
  if (optimalNodesMM?.length) {
    optimal = attempt(optimalNodesMM, loMM)
    if (!optimal) {
      // SCALE TO IT before shrinking to it. Seating is a predicate test, not a solve, so every
      // size in the range is cheap to try; the one that holds most of the layout is the one worth
      // wrapping. Seating at a single size gave the duck no optimal at all at B3 and B4.
      let bestSeated: Pt[] = [], bestOmitted = 0, bestMM = hiMM
      for (const mm of fallbackRevealSizes(loMM, hiMM)) {
        const { seated, omitted } = seatOptimal(optimalNodesMM, mm)
        if (seated.length > bestSeated.length) { bestSeated = seated; bestOmitted = omitted.length; bestMM = mm }
        if (!omitted.length) break            // it holds whole here; nothing better exists
      }
      if (bestSeated.length) {
        // Do not shrink BELOW the size the layout was placed at. Dan asked the shape to be scaled
        // to the optimal layout; wrapping the survivors from the floor instead lets a heavily
        // refused canon collapse onto its few remaining magnets and fall out of the band — which
        // is how the duck and the butterfly lost their optimal at B3 and B4 entirely.
        optimal = attempt(bestSeated, bestMM, bestMM)
        optimalOmitted = bestOmitted
      }
    }
  }

  // THE WALK, unchanged in range and method. Every lawful registration at each size is collected,
  // not only the fullest, or the fewest-magnet answer below could never exist.
  for (const mm of fallbackRevealSizes(loMM, hiMM)) {
    const grid = computeGrid(sized(mm), anchorAtMM ? { ...scanCfg, centreOverrideMM: anchorAtMM(mm) } : scanCfg)
    const drawn = grid.anchors.map((a) => a.p)
    if (drawn.length) witnesses.push({ revealMM: mm, points: drawn })
    for (const pts of grid.seatings.length ? grid.seatings : [drawn]) {
      if (!pts.length) continue
      const id = identityOf(pts)
      if (seen.has(id)) continue
      seen.add(id)
      const rung = attempt(pts, mm)
      if (rung) rungs.push(rung)
    }
  }

  // FEWEST and MOST magnets in the range, from what the walk actually found.
  const byCount = [...rungs].sort((a, b) => a.at.count - b.at.count || a.at.sizeMM - b.at.sizeMM)
  const fewest = byCount[0] ?? null
  const most = byCount[byCount.length - 1] ?? null

  // COINCIDENT RESULTS COLLAPSE — the same answer is one row, whatever reached it first. Identity
  // is what SHIPS: the wrapped size and the magnet positions, never which probe proposed it.
  const shipped = (r: BandRung) => r.at.sizeMM.toFixed(2) + '|' + identityOf(r.at.points)
  const offers: BandRung[] = []
  const kept = new Map<string, BandRung>()
  for (const [role, r] of [['optimal', optimal], ['fewest', fewest], ['most', most]] as Array<[RungRole, BandRung | null]>) {
    if (!r) continue
    const key = shipped(r)
    const already = kept.get(key)
    if (already) { already.roles.push(role); continue }   // the same answer, reached twice: one row
    r.roles = [role]
    if (role === 'optimal' && optimalOmitted) r.omittedFromOptimal = optimalOmitted
    kept.set(key, r)
    offers.push(r)
  }
  return { offers, bestSeated: bestSeatedCandidate(witnesses) }
}
