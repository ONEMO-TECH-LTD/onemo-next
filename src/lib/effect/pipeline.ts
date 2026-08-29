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
  RELEASED_PADDING_MM, SIZE_CEIL_MARGIN_MM,
} from './grid-magnet-spec'
import { bbox } from './foundation/geometry'
import { safeSegments } from './units/segment'
import { centeringAnchors, contourCentroidOf, governMass } from './units/centring'
import { frameOfMasses } from './units/classifier'
import {
  bandOf, bandOuterMM, fieldSpanMM, legalOfOuterMM, makeCircleSeatPredicate,
  makeContourSeatPredicate, registrationOffsets, spotRadiusOf,
} from './units/layout'
import { wrapGroup } from './units/wrap'
import { layoutsForFrame } from './grid-magnet-library-catalogue'
import { makeSizer } from './grid-magnet-shape'
import { viewIdOf } from './units/layout'

/** WHAT SIZE TO MEASURE AT — the only difference between the bench's two controls.
 *  A band asks the pipeline to solve for the size where the shape fills it; manual states the size
 *  outright. Manual is NOT a bypass: it classifies, matches, seats, records omission and wraps
 *  through the same chain and answers to the same laws (product law: "free/manual and the band run
 *  one engine"). It supplies a measurement, not a verdict. */
export type PipelineEnvelope =
  | Readonly<{ kind: 'band'; bandId: number }>
  | Readonly<{ kind: 'manual'; sizeMM: number }>

/** DATA ONLY. The door used to take `(mm) => Contour` and an anchor function, which meant the
 *  request could not be serialised, replayed, compared or sent across a worker boundary as a
 *  value — so there was no single door, only a call convention. The shape arrives as its stored
 *  contour and the sizer is built inside. */
export interface PipelineRequest {
  /** The normalized contour, longest side 1mm — the shape as it is stored. */
  readonly base: Contour
  /** Outline offset in mm, applied by the sizer. */
  readonly offsetMM?: number
  readonly envelope: PipelineEnvelope
  readonly pitchMM?: number
  readonly paddingMM?: number
  readonly centreMode?: number
  readonly governor?: number
  readonly massDepthMM?: number
  /** The outline is a true circle — judge against the analytic curve, not its flattened chords. */
  readonly circle?: boolean
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
  /** WHICH of the eight ways round this layout is turned — 'n/n/n' is upright. A mirror is a
   *  different magnet set, so the view is part of what was tried, not decoration. */
  readonly viewId: string
  /** Stable identity: entry + view + registration. The shell selects BY THIS, never by position —
   *  an index into a filtered list draws a different attempt the moment a row above it fails. */
  readonly attemptId: string
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
  /** Set when the pipeline could not classify at all, and why. An empty list with no reason would
   *  be indistinguishable from a library that holds nothing. */
  readonly reason?: string
  /** Echoed so a consumer can rebuild the shape at any size without re-deriving the request. */
  readonly baseContour: Contour
  readonly offsetMM: number
  readonly spotRadiusMM: number
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
/** The frame a shape carries at one size — the same measurement the classifier reads. */
function frameAtMM(
  sized: (mm: number) => Contour, sizeMM: number, radiusMM: number, depthMM: number, pitchMM: number,
): { cols: number; rows: number } | null {
  return frameOfMasses(safeSegments(sized(sizeMM), radiusMM, depthMM, 'light'), pitchMM)
}

/**
 * THE SIZE AT WHICH THIS SHAPE CARRIES THE BAND'S POSITIONS — solved, not assumed.
 *
 * THE BAND IS THE FRAME. "A band says how many magnet positions the shape can carry across its
 * dominant axis: B1 holds one, B2 two, B3 three" (spec, from Dan's ruling). So the target is a
 * POSITION COUNT, and it is solved against the very measurement the classifier then reads — the
 * live-mass frame. Two earlier targets each mixed two rulers and each was wrong:
 *
 *   - the band's OUTLINE ceiling: outline-minus-rim is the legal span only for an axis-aligned
 *     shape, so a star classified three bands adrift;
 *   - the band's LEGAL ceiling: the mesh quantises in ~2mm steps, so it overshot 191 to 192 —
 *     four pitches, FIVE positions — and asking for B4 returned a 5x5 frame whose every layout
 *     belongs to B5, with 72 attempts where one band can only mean one frame. Worse, legal span
 *     and live mass are different probes, so the frame read one position lower again on a star.
 *
 * One quantity, one probe, no conversion. The frame grows monotonically with size, so the smallest
 * size carrying the band's count is a bisection. Null when the shape never carries that many
 * positions at any size the board allows — an honest answer, not a silent wrong one.
 */
function calibrateSizeForBand(
  sized: (mm: number) => Contour, positions: number, radiusMM: number, depthMM: number,
  pitchMM: number, ceilingMM: number,
): number | null {
  const dominantAt = (mm: number): number => {
    const f = frameAtMM(sized, mm, radiusMM, depthMM, pitchMM)
    return f ? Math.max(f.cols, f.rows) : 0
  }
  if (dominantAt(ceilingMM) < positions) return null
  let lo = MIN_EFFECT_MM, hi = ceilingMM
  for (let i = 0; i < 40 && hi - lo > 0.05; i++) {
    const mid = (lo + hi) / 2
    if (dominantAt(mid) < positions) lo = mid; else hi = mid
  }
  return dominantAt(hi) === positions ? hi : null
}

export function runPipeline(request: PipelineRequest): PipelineResult {
  const sized = makeSizer(request.base, request.offsetMM ?? 0)
  const pitchMM = request.pitchMM ?? DEFAULT_PITCH_MM
  // The released rim is the law and it is locked; a caller that says nothing gets 12, never the
  // admin slider's floor (Dan, 2026-08-29: "point it to the last locked number").
  const padMM = Math.max(PADDING_FLOOR_MM, request.paddingMM ?? RELEASED_PADDING_MM)
  const radiusMM = spotRadiusOf(padMM)
  // FAIL LOUD. An unknown band silently became B1, so asking for band 999 and band 1 returned
  // byte-identical answers — a wrong question answered confidently is worse than an error.
  const envelope = request.envelope
  const band = envelope.kind === 'band' ? BANDS.find((b) => b.id === envelope.bandId) : undefined
  if (envelope.kind === 'band' && !band)
    throw new Error('pipeline: unknown band ' + envelope.bandId)
  // The band is a LEGAL range; sizes are OUTLINE sizes, so it converts through this shape's own
  // rim. A diamond and a square in one band do not share an outline range.
  const ceilingMM = fieldSpanMM(padMM) + SIZE_CEIL_MARGIN_MM
  const span = band ? bandOuterMM(band, padMM) : { minMM: MIN_EFFECT_MM, maxMM: ceilingMM }

  // STEP 1 + 2 — measure where the shape actually FILLS the band, not where its outline happens to
  // be. The size is solved against the same live-span measurement the frame is then read from, so
  // the two cannot disagree.
  const depthMM = Math.max(radiusMM, request.massDepthMM ?? MASS_DEPTH_MM)
  const calibratedMM = band
    ? calibrateSizeForBand(sized, band.id, radiusMM, depthMM, pitchMM, ceilingMM)
    : envelope.kind === 'manual' ? envelope.sizeMM : null
  if (calibratedMM === null)
    return { frame: null, classifiedAtMM: span.maxMM, pitchMM, anchorMM: null, segments: [], attempts: [],
      reason: 'this shape never carries ' + (band ? band.id : '?') + ' magnet positions across at any size the board allows',
      baseContour: request.base, offsetMM: request.offsetMM ?? 0, spotRadiusMM: radiusMM }
  const classifiedAtMM = calibratedMM
  const contour = sized(classifiedAtMM)
  const segments = safeSegments(contour, radiusMM, depthMM, 'full')
  const frame = frameOfMasses(segments, pitchMM)

  const bb = bbox(contour.outer.pts)
  const boxC: Pt = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
  const mode = (request.centreMode ?? CENTRE_MODE) as CentreMode
  const anchorFn: (mm: number) => Pt = ((mm: number) => {
    const c = sized(mm)
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
    return { frame, classifiedAtMM, pitchMM, anchorMM, segments, attempts: [],
      reason: !frame ? 'no live mass to classify' : 'the outline admits no seat at all',
      baseContour: request.base, offsetMM: request.offsetMM ?? 0, spotRadiusMM: radiusMM }

  const wcfg: WrapConfig = {
    pitchMM, paddingMM: padMM, centreMode: request.centreMode, governor: request.governor,
    massDepthMM: request.massDepthMM, anchorAtMM: anchorFn,
  }

  // STEP 3 — the library answers. It proposes; it never adjudicates.
  const matches = layoutsForFrame(frame.cols, frame.rows, pitchMM)
  const attempts: Attempt[] = []
  for (const match of matches) {
    const { group } = localise(match.nodesMM as Pt[])
    for (const [dx, dy] of registrationOffsets(pitchMM)) {
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

      // STEP 4 — the survivors go to wrap WHOLE and unchanged. Wrap is the only authority on fit,
      // and it either seats the entire group or answers null; nothing here removes a magnet to
      // make a failure succeed. A registration that seated NOTHING is still reported: it is a
      // real thing the pipeline tried, and dropping it made the bench claim four grid positions
      // while rendering two (QA F3a).
      const wrap = seatedMM.length
        ? wrapGroup(sized, wcfg, localise(seatedMM).group, MIN_EFFECT_MM, span.maxMM)
        : null
      attempts.push({
        entryId: match.entry.id,
        label: match.entry.label,
        classId: match.entry.classId,
        frameCols: frame.cols,
        frameRows: frame.rows,
        viewId: viewIdOf(match.match.view),
        attemptId: match.entry.id + '|' + viewIdOf(match.match.view) + '|' + dx + ',' + dy,
        registrationMM: [dx, dy],
        attempted: placed.length,
        seatedMM,
        omitted,
        wrap,
        landedBandId: wrap ? bandOf(legalSpanMM(wrap.points))?.id ?? null : null,
      })
    }
  }
  return { frame, classifiedAtMM, pitchMM, anchorMM, segments, attempts,
    baseContour: request.base, offsetMM: request.offsetMM ?? 0, spotRadiusMM: radiusMM }
}

export { legalOfOuterMM }
