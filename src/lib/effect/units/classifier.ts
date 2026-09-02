// units/classifier.ts — CLASSIFIER: what the shape IS, before anything is placed.
//
// Moved from grid-magnet-class.ts byte-identical (S2 step 3); it stands on foundation.
// shapeFamilyOf did NOT come: the hardcoded three-family enum with its invented numbers has two
// live callers (the worker and the catalogue matcher) and dies in S4 once the catalogue answers.

import { Clipper, FillRule, JoinType, EndType, type Paths64 } from '@countertype/clipper2-ts'
import type { AxisClass, BBox, CanonPriority, Contour, FrameKind, Pt, SafeSegment, ShapeClass } from '../types'
import { bbox } from '../foundation/geometry'
import { MANUFACTURING_OFFSET_ARC_TOLERANCE_MM } from '../offset'
import { BAND_STEP_MM, DEFAULT_PITCH_MM, MIN_EFFECT_MM, type Band } from '../grid-magnet-spec'

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
// ─── THE RULER ──────────────────────────────────────────────────────────────────────────────────
// Bands and frames are measured on exact polygon arithmetic, never on the segmentation mesh.
//
// QA F2 (2026-08-30): the mesh-derived box is not transform-invariant. A 7-point polygon read
// 239.18mm (no band) and its horizontal mirror 238.81mm (B5); a 1,000-shape sweep found 8 mirror
// band flips and up to 5.97mm disagreement. It is exact on a square only because the clearance
// field is linear along a straight edge. A sampled display field must not own classification.

/** Micron scale — Clipper64 is integer-robust. */
const LEGAL_SCALE = 1000

/** The legal magnet-centre region: the outline inset by the spot radius, minus every hole grown by
 *  the same. Null when nothing can hold a magnet.
 *
 *  NOT wrap's `seatRegion`, deliberately, and this is the one place the two differ. seatRegion
 *  insets by radius PLUS the arc tolerance — a safety margin so a seated magnet is certainly
 *  inside. That margin is right for placing and wrong for measuring: as a ruler it cost 0.05mm a
 *  side, so a 144mm square measured 119.95 where the arithmetic says 120, and a tenth of a
 *  millimetre is exactly the margin that decides a band. They answer different questions —
 *  "where may a magnet go" and "how far does the legal area reach" — so they are not unified.
 *  Unifying them would also change wrap, which Dan has ruled untouchable. */
export function legalRegion(contour: Contour, spotRadiusMM: number): Paths64 | null {
  const tol = MANUFACTURING_OFFSET_ARC_TOLERANCE_MM
  const flat: number[] = []
  for (const [x, y] of contour.outer.pts) flat.push(Math.round(x * LEGAL_SCALE), Math.round(y * LEGAL_SCALE))
  const region = Clipper.inflatePaths([Clipper.makePath(flat)],
    -spotRadiusMM * LEGAL_SCALE, JoinType.Round, EndType.Polygon, 2, tol * LEGAL_SCALE)
  if (!region || !region.length) return null
  if (!contour.holes.length) return region
  const blocked: Paths64 = []
  for (const hole of contour.holes) {
    const hf: number[] = []
    for (const [x, y] of hole.pts) hf.push(Math.round(x * LEGAL_SCALE), Math.round(y * LEGAL_SCALE))
    const grown = Clipper.inflatePaths([Clipper.makePath(hf)],
      spotRadiusMM * LEGAL_SCALE, JoinType.Round, EndType.Polygon, 2, tol * LEGAL_SCALE)
    if (grown && grown.length) blocked.push(...grown)
  }
  if (!blocked.length) return region
  const left = Clipper.difference(region, blocked, FillRule.NonZero)
  return left && left.length ? left : null
}

/** The bounding extent of that region — what bands and frames are read from. Transform-invariant
 *  by construction: mirroring the shape mirrors the region exactly. */
export function legalRegionBoxMM(contour: Contour, spotRadiusMM: number): BBox | null {
  const region = legalRegion(contour, spotRadiusMM)
  if (!region) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const path of region) for (const p of path) {
    const x = Number(p.x) / LEGAL_SCALE, y = Number(p.y) / LEGAL_SCALE
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY }
}

/** THE MESH BOX — the bounding extent of every region where a magnet centre may sit. Bands and
 *  classification are both measured on it (QA pin, 2026-08-30). No lattice, no count: how many
 *  positions this box carries is the lookup's question, not this one's. */
export function legalUnionBoxMM(segments: readonly SafeSegment[]): BBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const segment of segments) {
    if (segment.bbox.minX < minX) minX = segment.bbox.minX
    if (segment.bbox.minY < minY) minY = segment.bbox.minY
    if (segment.bbox.maxX > maxX) maxX = segment.bbox.maxX
    if (segment.bbox.maxY > maxY) maxY = segment.bbox.maxY
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY }
}

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

/** THE TRIAL SIZE a band is classified at — the middle of the outline range that band spans for a
 *  shape wearing this rim (Dan, 2026-08-30: "size the shape for each mid range value in each band").
 *
 *  The middle rather than the floor or the ceiling: the floor under-reveals a shape's material, and
 *  the ceiling touches the next band. It is a PROBE, not a band assignment — what band a finished
 *  answer belongs to is decided after the wrap, on its own measured legal extent.
 *
 *  A formula, not a table: BANDS runs to B11 and the rim is a caller's value. */
export function classificationSeedMM(band: Band, paddingMM: number): number {
  return band.minMM + BAND_STEP_MM / 2 + 2 * paddingMM
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


// ─── PRIORITY HOLD POINTS ───────────────────────────────────────────────────────────────────────
// Dan, 2026-09-01: "add priority hold points to the canon" · "top/corners are priorities of the
// canon … symmetry is more side to side". The classifier already knows the frame; naming which of
// its nodes matter is classification, not placement. Data only — layout and judge decide what to do
// with it. No catalogue field, no lookup, no shape names, and no long-axis choice: gravity is the
// only orientation, so a square, a banner and a strip all read the same way.

/** The frame facts the priority rule needs: each node's column and row, the top row, the row count
 *  and the slim rule. Corners and mirror partners are NOT emitted — they belong to the placement,
 *  not the frame, and the tuple derives them from the seats actually held. */
export function canonPriorityOf(
  canonLocalMM: ReadonlyArray<Pt>, pitchMM: number = DEFAULT_PITCH_MM,
): CanonPriority | null {
  if (!canonLocalMM.length) return null
  const lineIdx = (axis: 0 | 1): number[] => {
    const vs = canonLocalMM.map((p) => p[axis]), min = Math.min(...vs)
    return vs.map((v) => Math.round((v - min) / pitchMM))
  }
  const colOf = lineIdx(0), rowOf = lineIdx(1)
  const cols = Math.max(...colOf) + 1, rows = Math.max(...rowOf) + 1
  // Slim is the classifier's existing rule (FrameKind): a minor axis of one or two lines.
  const slim = Math.min(cols, rows) <= 2
  const centreAxis: 0 | 1 = cols <= rows ? 0 : 1
  return { colOf, rowOf, topRow: rows - 1, rows, slim, centreAxis }
}
