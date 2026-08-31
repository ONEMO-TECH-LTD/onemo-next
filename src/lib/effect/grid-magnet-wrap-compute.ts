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
import { applyEnforcers, applyHoldingRules, gapAreaMM2, gapRingsMM, holdingFactsOf, inBand, orderOffers, protectionReachMM, unprotectedRegions, type HoldingFacts } from './units/judge'
import { bestSeatedCandidate, fallbackRevealSizes } from './units/layout'
import { legalRegion, legalRegionBoxMM, materialRegion } from './units/classifier'


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
      legalBoxMM: legalRegionBoxMM(contour, radius),
      centresMM: [at.anchorMM],
      centreMainMM: at.anchorMM,
      seatings: [],   // display of a settled answer; the registrations were spent upstream
      canonSeatings: [],
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
/** THE THREE ANSWERS Dan asked for: the canon layout tried first, then the MIN magnet count in
 *  the range and the MAX. Anything that coincides collapses, so a shape whose optimal IS its fullest
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
  const attempt = (pts: ReadonlyArray<Pt>, revealMM: number): BandRung | null => {
    const at = wrapGroup(sized, wcfg, localise(pts), minMM, hiMM)
    if (!at) return null
    if (!inBand(at.sizeMM, loMM, hiMM)) return null   // judge: another band owns it
    return { at, revealMM, roles: [] }
  }

  // THE SUGGESTED LAYOUT IS THE SEARCH'S STARTING POINT — not a second search. Dan, 2026-08-30:
  // "make canon just an anchor that plugs in the free search that fine tunes", and "if we provide
  // suggested layout as starting point for optimal search but keep the rest as is for the search."
  //
  // It is handed to the SAME computeGrid the walk already calls, at the SAME sizes, and comes back
  // seated at the SAME four positions the centre rule produces. The only difference from the free
  // search is where it starts: the layout's own spots instead of the whole lattice. Everything
  // after — the fits test, the wrap, the band rule — is the identical code path.
  //
  // Three previous attempts gave the canon its own machinery instead. This gives it none.
  const canonLocal = optimalNodesMM?.length ? localise(optimalNodesMM) : undefined
  const canonRungs: BandRung[] = []
  /** Its OWN dedup set, so it never collides with the free search's pool. The walk drops repeats
   *  before wrapping and this must too: without it the same landing is wrapped once per size —
   *  ~192 solves instead of a handful, which does not fail, it hangs. */
  const canonSeen = new Set<string>()

  // THE WALK, unchanged in range and method. Every lawful registration at each size is collected,
  // not only the fullest, or the MIN answer below could never exist.
  for (const mm of fallbackRevealSizes(loMM, hiMM)) {
    const grid = computeGrid(sized(mm),
      anchorAtMM ? { ...scanCfg, centreOverrideMM: anchorAtMM(mm) } : scanCfg, canonLocal)
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
    // The suggested layout's own landings, kept SEPARATE so MIN and MAX are drawn from exactly the
    // pool they are drawn from today. Same attempt, same wrap, same band rule.
    for (const pts of grid.canonSeatings) {
      if (!pts.length) continue
      const id = identityOf(pts)
      if (canonSeen.has(id)) continue
      canonSeen.add(id)
      const rung = attempt(pts, mm)
      if (rung) canonRungs.push(rung)
    }
  }

  // DAN'S ENFORCER, BEFORE ANY ROLE IS PICKED (QA F5). Applied after the collapse it discarded the
  // lawful candidates first: if the chosen max failed the extremes while another max-count
  // candidate held them, the row vanished instead of falling back to the lawful one. A filter must
  // constrain the POOLS, not the three survivors.
  const rules = cfg.holdingRules
  const ruleReach = protectionReachMM(cfg.protectionReachMM)
  const holdRadius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const holdFacts = new Map<BandRung, HoldingFacts | null>()
  const factsOf = (r: BandRung): HoldingFacts | null => {
    if (!holdFacts.has(r)) {
      const c = sized(r.at.sizeMM)
      const region = legalRegion(c, holdRadius)
      const box = legalRegionBoxMM(c, holdRadius)
      // gaps are measured on the MATERIAL, not on the centre-region: Dan's flap is bare fabric
      const material = materialRegion(c)
      const gaps = unprotectedRegions(material, r.at.points, ruleReach)
      // the evidence travels WITH the answer, so the canvas draws what the rules judged
      const facts0 = region && box ? null : null
      void facts0
      holdFacts.set(r, region && box
        ? holdingFactsOf(r.at.points, box, gaps, c.outer.pts,
          // the SHAPE's centre at this size — one reference for every candidate, never the
          // candidate's own anchor, which moves with the answer
          [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2], pitch, cfg.protectionReachMM, region)
        : null)
    }
    const f = holdFacts.get(r) ?? null
    if (f && !r.unprotected) {
      const c = sized(r.at.sizeMM)
      const material = materialRegion(c)
      const gaps = unprotectedRegions(material, r.at.points, ruleReach)
      r.unprotected = { ringsMM: gapRingsMM(gaps), areaMM2: gapAreaMM2(gaps), boundaryMM: f.unsupportedBoundaryMM }
    }
    return f
  }
  // THE ENFORCERS RUN ONCE, OVER EVERYTHING, BEFORE ANY ROLE IS NAMED. Dan, 2026-08-31: "the
  // detector inside the engine must verify each position meets the rules we toggle selectively in
  // the dash before calling it optimal max or min."
  //
  // Over the COMBINED universe, not per pool. Enforcing separately let a lopsided canon answer
  // survive because it was the least lopsided of the canon candidates — while a balanced free
  // answer sat untouched in the other pool. Balance is a property of the shape, not of which
  // search happened to find the answer.
  if (rules && (rules.extremes || rules.balance)) {
    const survivors = new Set(applyEnforcers([...canonRungs, ...rungs], factsOf, rules))
    for (let i = canonRungs.length - 1; i >= 0; i--) if (!survivors.has(canonRungs[i])) canonRungs.splice(i, 1)
    for (let i = rungs.length - 1; i >= 0; i--) if (!survivors.has(rungs[i])) rungs.splice(i, 1)
  }

  // THE PREFERENCES GUIDE EVERY ROLE, not just the order of the finished rows. Dan, 2026-08-31:
  // "make sure that rule 2 or whatever the filters i asked to apply aplly to all results and guide
  // them optimal and min-max."
  //
  // They do not overturn what each role MEANS — optimal is still the canon landing holding most of
  // the layout, min is still the fewest magnets, max the most. They decide WHICH of the equally
  // qualified candidates takes the role, where the tie-break used to be nothing more than the
  // tightest size. So a role now goes to the best-held candidate among its own equals.
  const prefsOn = !!rules && (rules.perimeter || rules.corners || rules.gravity || rules.universal)
  const byPreference = (pool: BandRung[]): Map<BandRung, number> => {
    const ranked = prefsOn ? applyHoldingRules(pool, factsOf, rules!) : pool
    return new Map(ranked.map((r, i) => [r, i]))
  }
  const canonRank = byPreference(canonRungs)
  const walkRank = byPreference(rungs)
  const preferred = (rank: Map<BandRung, number>) => (a: BandRung, b: BandRung) =>
    (rank.get(a) ?? 0) - (rank.get(b) ?? 0)

  // Of the suggested layout's landings, the one holding most of it; then Dan's filters decide
  // between equals, and only if they cannot does the tightest win.
  const optimal: BandRung | null = canonRungs
    .sort((a, b) => b.at.count - a.at.count || preferred(canonRank)(a, b) || a.at.sizeMM - b.at.sizeMM)[0] ?? null

  // MIN and MAX magnets in the range, from what the walk actually found. Dan's own words for
  // them, restored 2026-08-30 — they had been renamed to fewest/most, which he never asked for.
  const byCount = [...rungs].sort((a, b) =>
    a.at.count - b.at.count || preferred(walkRank)(a, b) || a.at.sizeMM - b.at.sizeMM)
  const min = byCount[0] ?? null
  // MAX takes the fullest, and among equally full ones the filters choose — so the last entry of
  // an ascending sort is wrong here: it would hand the role to whichever equal came last.
  const fullest = byCount.length ? byCount[byCount.length - 1].at.count : 0
  const max = [...byCount].filter((r) => r.at.count === fullest)
    .sort((a, b) => preferred(walkRank)(a, b) || a.at.sizeMM - b.at.sizeMM)[0] ?? null

  // COINCIDENT RESULTS COLLAPSE — the same answer is one row, whatever reached it first. Identity
  // is what SHIPS: the wrapped size and the magnet positions, never which probe proposed it.
  const shipped = (r: BandRung) => r.at.sizeMM.toFixed(2) + '|' + identityOf(r.at.points)
  const offers: BandRung[] = []
  const kept = new Map<string, BandRung>()
  for (const [role, r] of [['optimal', optimal], ['min', min], ['max', max]] as Array<[RungRole, BandRung | null]>) {
    if (!r) continue
    const key = shipped(r)
    const already = kept.get(key)
    if (already) { already.roles.push(role); continue }   // the same answer, reached twice: one row
    r.roles = [role]
    kept.set(key, r)
    offers.push(r)
  }
  // THE PREFERENCES order what ships. They never remove — only rule 2 removes, and it did that
  // above, on the pools.
  const ruled = rules && (rules.perimeter || rules.corners || rules.gravity || rules.universal || rules.balance)
    ? applyHoldingRules(offers, factsOf, rules) : offers
  // THE EVIDENCE IS ALWAYS MEASURED for what ships, whether or not a rule is switched on. Dan,
  // 2026-08-31: the unprotected area "was always shown in previous versions and the engine must
  // know what they are". Three offers, so it costs three subtractions — and it means the canvas
  // draws the gaps with every toggle OFF, which is how you judge whether switching one on helped.
  for (const o of ruled) {
    if (o.unprotected) continue
    const c = sized(o.at.sizeMM)
    const gaps = unprotectedRegions(materialRegion(c), o.at.points, ruleReach)
    const region = legalRegion(c, holdRadius)
    const box = legalRegionBoxMM(c, holdRadius)
    const f = region && box
      ? holdingFactsOf(o.at.points, box, gaps, c.outer.pts,
        [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2], pitch, cfg.protectionReachMM, region)
      : null
    o.unprotected = {
      ringsMM: gapRingsMM(gaps), areaMM2: gapAreaMM2(gaps),
      boundaryMM: f?.unsupportedBoundaryMM ?? 0,
    }
  }
  return { offers: ruled, bestSeated: bestSeatedCandidate(witnesses) }
}
