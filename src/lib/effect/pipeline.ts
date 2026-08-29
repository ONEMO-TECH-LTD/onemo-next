// pipeline.ts — THE PIPELINE. One call, no browser, and the whole of Dan's MVP:
//
//   1 CLASS   the shape's usable material says which grid it is
//   2 BANDS   the band gives the measurement anchor and the size range — never a rejection
//   3 LAYOUT  the library says which layouts live on that grid — looked up, never invented
//   4 WRAP    each surviving group gets its exact contact size
//
// "the entire pipeline is the compute and the selector" (Dan, 2026-08-29). Each step narrows, so
// NOTHING ELSE MAY: this door does not rank, prefer, pick a default, drop a magnet by choice, or
// hide a result because it wrapped into a different band. Every attempt comes back, unordered,
// with what it tried, what seated, what the material refused and what wrap answered. If the right
// answer is not in that list, no filter added later could have produced it — which is the whole
// point of running the pipeline raw before anything sorts it.
//
// Steps 5 (next best) and the scoring that orders offers are deliberately absent: Dan scoped the
// MVP to 1–4 and put discovery and ranking after it.

import type { Contour, Pt, SafeSegment, WrapAt, WrapConfig } from './types'
import type { CentreMode, Governor } from './types'
import {
  BANDS, CENTRE_MODE, DEFAULT_PITCH_MM, GOVERNOR, MASS_DEPTH_MM, MIN_EFFECT_MM, PADDING_FLOOR_MM,
  RELEASED_PADDING_MM,
} from './grid-magnet-spec'
import { bbox } from './foundation/geometry'
import { safeSegments } from './units/segment'
import { centeringAnchors, contourCentroidOf, governMass } from './units/centring'
import { frameOfMasses } from './units/classifier'
import {
  bandOf, bandOuterMM, legalOfOuterMM, makeCircleSeatPredicate, makeContourSeatPredicate,
  spotRadiusOf,
} from './units/layout'
import { wrapGroup } from './units/wrap'
import { layoutsForFrame } from './grid-magnet-library-catalogue'

export interface PipelineRequest {
  /** The shape at any size — the one thing the caller owns. */
  readonly sized: (mm: number) => Contour
  /** Which band to solve. The band is the measurement anchor and the range, per Dan's step 2. */
  readonly bandId: number
  readonly pitchMM?: number
  readonly paddingMM?: number
  readonly centreMode?: number
  readonly governor?: number
  readonly massDepthMM?: number
  /** The outline is a true circle — judge against the analytic curve, not its flattened chords. */
  readonly circle?: boolean
  /** The governed centre at any size. Supplied by the bench (baked once per shape); derived here
   *  when absent, so a headless caller needs nothing but a shape. */
  readonly anchorAtMM?: (mm: number) => Pt
}

/** A position the layout asked for and the material refused. Recorded, never silent — Dan,
 *  2026-08-29: "anything falling off the layout is just omitted as not fitting the shape". */
export interface Omission {
  readonly pointMM: Pt
  readonly reason: 'outside-safe-area'
}

/** One layout tried at one registration. Emitted whether or not it wrapped: a failure is evidence,
 *  and never permission to drop a magnet and retry with fewer. */
export interface Attempt {
  readonly entryId: string
  readonly label: string
  readonly classId: string
  readonly frameCols: number
  readonly frameRows: number
  /** The library record was used turned — a landscape shape wearing a canonical-tall layout. */
  readonly transposed: boolean
  /** Which of the governed registrations this attempt seated at, as an offset from the anchor. */
  readonly registrationMM: Pt
  readonly attempted: number
  readonly seatedMM: readonly Pt[]
  readonly omitted: readonly Omission[]
  /** The exact contact size for the survivors, or null when they never fit at any size in range. */
  readonly wrap: WrapAt | null
  /** The band the WRAPPED result actually lands in — read off its own legal span. A LABEL: the
   *  asked-for band never deletes an answer (Dan: band is "another filter" in the sense of an
   *  anchor and a range, and a result belongs to the band of its true wrapped size). */
  readonly landedBandId: number | null
}

export interface PipelineResult {
  /** What the shape IS: the grid its usable material carries, at the size it was measured. */
  readonly frame: { readonly cols: number; readonly rows: number; readonly widthMM: number; readonly heightMM: number } | null
  /** The size the frame was measured at — the top of the band's range for this shape. */
  readonly classifiedAtMM: number
  readonly pitchMM: number
  readonly anchorMM: Pt | null
  readonly segments: readonly SafeSegment[]
  /** Every layout × registration the pipeline tried. Unordered and unfiltered by construction. */
  readonly attempts: readonly Attempt[]
}

/** Local offsets about a group's own middle — the form wrapGroup takes. */
function localise(nodes: readonly Pt[]): { group: Pt[]; midMM: Pt } {
  const xs = nodes.map((p) => p[0]), ys = nodes.map((p) => p[1])
  const midMM: Pt = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  return { group: nodes.map(([x, y]) => [x - midMM[0], y - midMM[1]] as Pt), midMM }
}

/** The legal span a placed group occupies — its own extent, which is what a band is measured on. */
function legalSpanMM(points: readonly Pt[]): number {
  if (!points.length) return 0
  const bb = bbox(points as Pt[])
  return Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY)
}

/**
 * THE FOUR GOVERNED REGISTRATIONS (centre rules, Dan 2026-08-25). The grid is pinned to the
 * governed centre by parity rather than swept: each axis either carries a NODE on the centre or a
 * GAP on it, which is these four offsets. All four are returned — the engine used to build all
 * four and keep only the highest-count one, deleting three lawful registrations before wrap ever
 * saw them, which is the max-count prefilter the brief forbids by name.
 */
function registrations(pitchMM: number): Pt[] {
  const half = pitchMM / 2
  return [[0, 0], [half, 0], [0, half], [half, half]]
}

export function runPipeline(request: PipelineRequest): PipelineResult {
  const pitchMM = request.pitchMM ?? DEFAULT_PITCH_MM
  // The released rim is the law and it is locked; a caller that says nothing gets 12, never the
  // admin slider's floor (Dan, 2026-08-29: "point it to the last locked number").
  const padMM = Math.max(PADDING_FLOOR_MM, request.paddingMM ?? RELEASED_PADDING_MM)
  const radiusMM = spotRadiusOf(padMM)
  const band = BANDS.find((b) => b.id === request.bandId) ?? BANDS[0]
  // The band is a LEGAL range; sizes are OUTLINE sizes, so it converts through this shape's own
  // rim. A diamond and a square in one band do not share an outline range.
  const span = bandOuterMM(band, padMM)

  // STEP 1 + 2 — measure at the top of the band's range: the largest this shape may be while still
  // in the band, so the most positions its material can carry here. A smaller size inside the same
  // band can only ever read the same frame or a smaller one.
  const classifiedAtMM = span.maxMM
  const contour = request.sized(classifiedAtMM)
  const depthMM = Math.max(radiusMM, request.massDepthMM ?? MASS_DEPTH_MM)
  const segments = safeSegments(contour, radiusMM, depthMM, 'full')
  const frame = frameOfMasses(segments, pitchMM)

  const bb = bbox(contour.outer.pts)
  const boxC: Pt = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
  const mode = (request.centreMode ?? CENTRE_MODE) as CentreMode
  const anchorFn: (mm: number) => Pt = request.anchorAtMM ?? ((mm: number) => {
    const c = request.sized(mm)
    const segs = safeSegments(c, radiusMM, depthMM, 'light')
    const cb = bbox(c.outer.pts)
    const centre: Pt = [(cb.minX + cb.maxX) / 2, (cb.minY + cb.maxY) / 2]
    const cands = centeringAnchors(mode, segs, centre, contourCentroidOf(c))
    if (mode !== 2) return cands[0] ?? centre
    const masses = segs.flatMap((s) => (s.masses.length ? s.masses : [s]))
    return governMass(masses, (request.governor ?? GOVERNOR) as Governor, (cb.minY + cb.maxY) / 2)?.centreMM
      ?? cands[0] ?? centre
  })
  const anchorMM = anchorFn(classifiedAtMM)

  const fits = request.circle
    ? makeCircleSeatPredicate(boxC[0], boxC[1], Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, radiusMM)
    : makeContourSeatPredicate(contour, radiusMM)

  if (!frame || !fits)
    return { frame, classifiedAtMM, pitchMM, anchorMM, segments, attempts: [] }

  const wcfg: WrapConfig = {
    pitchMM, paddingMM: padMM, centreMode: request.centreMode, governor: request.governor,
    massDepthMM: request.massDepthMM, anchorAtMM: anchorFn,
  }

  // STEP 3 — the library answers. It proposes; it never adjudicates.
  const matches = layoutsForFrame(frame.cols, frame.rows, pitchMM)
  const attempts: Attempt[] = []
  for (const match of matches) {
    const { group } = localise(match.nodesMM as Pt[])
    for (const [dx, dy] of registrations(pitchMM)) {
      const origin: Pt = [anchorMM[0] + dx, anchorMM[1] + dy]
      const placed = group.map(([lx, ly]) => [origin[0] + lx, origin[1] + ly] as Pt)
      // Per position, one physical question, asked of the real material. This IS the omission
      // rule — the same predicate the engine has always seated with.
      const seatedMM: Pt[] = []
      const omitted: Omission[] = []
      for (const point of placed) {
        if (fits(point)) seatedMM.push(point)
        else omitted.push({ pointMM: point, reason: 'outside-safe-area' })
      }
      if (!seatedMM.length) continue

      // STEP 4 — the survivors go to wrap WHOLE and unchanged. Wrap is the only authority on fit,
      // and it either seats the entire group or answers null; nothing here removes a magnet to
      // make a failure succeed.
      const { group: survivors } = localise(seatedMM)
      const wrap = wrapGroup(request.sized, wcfg, survivors, MIN_EFFECT_MM, span.maxMM)
      attempts.push({
        entryId: match.entry.id,
        label: match.entry.label,
        classId: match.entry.classId,
        frameCols: frame.cols,
        frameRows: frame.rows,
        transposed: match.transposed,
        registrationMM: [dx, dy],
        attempted: placed.length,
        seatedMM,
        omitted,
        wrap,
        landedBandId: wrap ? bandOf(legalSpanMM(wrap.points))?.id ?? null : null,
      })
    }
  }
  return { frame, classifiedAtMM, pitchMM, anchorMM, segments, attempts }
}

export { legalOfOuterMM }
