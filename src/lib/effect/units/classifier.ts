// units/classifier.ts — CLASSIFIER: what the shape IS, before anything is placed.
//
// Moved from grid-magnet-class.ts byte-identical (S2 step 3); it stands on foundation.
// shapeFamilyOf did NOT come: the hardcoded three-family enum with its invented numbers has two
// live callers (the worker and the catalogue matcher) and dies in S4 once the catalogue answers.

import type { AxisClass, BBox, FrameKind, Pt, SafeSegment, ShapeClass } from '../types'
import { bbox } from '../foundation/geometry'
import { DEFAULT_PITCH_MM, MIN_EFFECT_MM } from '../grid-magnet-spec'

// ─── THE FRAME: what the shape's USABLE MATERIAL carries ────────────────────────────────────────
// Dan's step 1. Everything below the divider is the older outline-bbox classification, which
// measures the wrong region and cannot count past five; it still feeds a display readout and the
// dormant family matcher, and it leaves when its consumers do.

/** The box enclosing every LIVE MASS — the region deep enough to actually hold a magnet.
 *
 *  Not the outline: a 135mm triangle's outline claims three lines across while only 96mm of it can
 *  hold anything. Not the legal bbox either, and that is the one that surprises — a 30mm arm eroded
 *  by 12mm each side leaves a 6mm sliver that stretches the box the arm's whole length and seats
 *  nothing, so a dead arm and a live one measure identically on it. And not the GOVERNING mass:
 *  that is the centring dial's pick, so classifying off it would tie what the shape IS to a
 *  control, and would lose a two-mass shape's second body entirely.
 *
 *  Masses only — a segment holding no mass contributes nothing. Segmentation itself is untouched;
 *  this reads what safeSegments already produces. */
export function massUnionBoxMM(segments: readonly SafeSegment[]): BBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const segment of segments) for (const mass of segment.masses) {
    if (mass.bbox.minX < minX) minX = mass.bbox.minX
    if (mass.bbox.minY < minY) minY = mass.bbox.minY
    if (mass.bbox.maxX > maxX) maxX = mass.bbox.maxX
    if (mass.bbox.maxY > maxY) maxY = mass.bbox.maxY
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY }
}

/** How many magnet positions a span of this length carries: n positions span (n−1) pitches, so the
 *  span admits floor(span / pitch) + 1. NO CEILING — the 1|2|3|4|5 axis class below encodes the old
 *  five-band product range in the type system and clamps anything larger down to it. */
export function positionsAcross(spanMM: number, pitchMM: number): number {
  return spanMM < 0 ? 0 : Math.floor(spanMM / pitchMM + 1e-9) + 1
}

/** THE ORDERED FRAME the shape's usable material carries, at the size it was measured.
 *
 *  Ordered, not a ratio: 3×6 and 2×4 share a ratio and are different frames, and a 1-wide frame has
 *  no ratio at all. No aspect anywhere — the pair carries everything a ratio would, without the
 *  degenerate case. */
export function frameOfMasses(
  segments: readonly SafeSegment[], pitchMM: number,
): { cols: number; rows: number; widthMM: number; heightMM: number } | null {
  const box = massUnionBoxMM(segments)
  if (!box) return null
  const widthMM = box.maxX - box.minX, heightMM = box.maxY - box.minY
  return { cols: positionsAcross(widthMM, pitchMM), rows: positionsAcross(heightMM, pitchMM), widthMM, heightMM }
}

/**
 * Which class an axis of this length falls in.
 *
 * Class n starts where an n-line frame first fits: 24 + (n-1)*pitch — 24, 72, 120, 168, 216 at
 * the 48mm lattice. Derived from the lattice, never a table of magic numbers, so a pitch change
 * re-derives the bands with it.
 */
export function axisClassOf(sideMM: number, pitchMM: number = DEFAULT_PITCH_MM): AxisClass {
  const floorOf = (n: number) => MIN_EFFECT_MM + (n - 1) * pitchMM
  let c: AxisClass = 1
  for (let n = 5; n >= 1; n--) if (sideMM >= floorOf(n)) { c = n as AxisClass; break }
  return c
}

/** Area of a closed ring (shoelace). */
function areaOf(pts: ReadonlyArray<Pt>): number {
  let a2 = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return Math.abs(a2 / 2)
}

/** Classify a sized outline: axis pair, band, frame. Measurement only — no policy. */
export function classifyShape(
  outer: ReadonlyArray<Pt>, pitchMM: number = DEFAULT_PITCH_MM,
): ShapeClass {
  const bb = bbox(outer)
  const widthMM = bb.maxX - bb.minX, heightMM = bb.maxY - bb.minY
  const cx = axisClassOf(widthMM, pitchMM)
  const cy = axisClassOf(heightMM, pitchMM)
  const band = Math.max(cx, cy) as AxisClass
  const minor = Math.min(cx, cy)
  const kind: FrameKind = cx === cy ? 'square' : minor <= 2 ? 'slim' : 'standard'
  const dominant = cx === cy ? 'none' : cx > cy ? 'x' : 'y'
  return {
    cx, cy, band, kind, dominant, widthMM, heightMM,
    fill: areaOf(outer) / Math.max(1e-9, widthMM * heightMM),
    frame: { cols: cx, rows: cy, capacity: cx * cy },
  }
}

/** The smallest size at which an axis carries `lines` magnet lines — the class floor. */
export function classFloorMM(lines: AxisClass, pitchMM: number = DEFAULT_PITCH_MM): number {
  return MIN_EFFECT_MM + (lines - 1) * pitchMM
}

/** The frame's node offsets, centred on the frame's own middle — capacity, not a layout. */
export function frameNodes(cols: AxisClass, rows: AxisClass, pitchMM: number = DEFAULT_PITCH_MM): Pt[] {
  const out: Pt[] = []
  for (let ix = 0; ix < cols; ix++) for (let iy = 0; iy < rows; iy++)
    out.push([(ix - (cols - 1) / 2) * pitchMM, (iy - (rows - 1) / 2) * pitchMM])
  return out
}



/**
 * THE CLASS FRAME (Dan's pipeline): the segment box's PROPORTIONS are scale-invariant, so the
 * class needs no size — the band id IS the dominant axis's line count (band-by-frame), and the
 * minor axis carries lines in proportion.
 */
export function classFrameNodes(
  segW: number, segH: number, bandId: number, pitchMM: number = DEFAULT_PITCH_MM,
): { cols: number; rows: number; nodes: Pt[] } {
  const n = Math.max(1, Math.min(5, bandId)) as AxisClass
  const dom = Math.max(segW, segH), min = Math.min(segW, segH)
  const m = Math.max(1, Math.min(n, Math.round(n * (dom > 0 ? min / dom : 1)))) as AxisClass
  const tall = segH >= segW
  const cols = (tall ? m : n) as AxisClass
  const rows = (tall ? n : m) as AxisClass
  return { cols, rows, nodes: frameNodes(cols, rows, pitchMM) }
}
