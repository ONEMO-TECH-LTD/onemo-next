// grid-magnet-class.ts — COMPUTE: what the shape IS, before anything is placed.
//
// Canon step 2 (Compute System §4): each bounding-box axis is classified independently, and the
// band is the larger of the two classes. The axis PAIR is the classification — "tall B3" is not
// one thing: a 1x3 holds a column of three and a 2x3 holds six with a mid row to skip.
//
// The frame that pair implies (canon §5) is the candidate node structure — CAPACITY, never a
// compulsory layout. Which of its nodes the material actually supports is a later question.

import type { Pt } from './types'
import { bbox } from './grid-magnet-compute'
import { DEFAULT_PITCH_MM, MIN_EFFECT_MM } from './grid-magnet-spec'

/** How many magnet lines an axis of this length can carry, 1..5. */
export type AxisClass = 1 | 2 | 3 | 4 | 5

/** Slim = the minor axis carries one or two lines, so the frame is a chain or a ladder.
 *  Standard = three or four lines on the minor axis — a real two-dimensional field. */
export type FrameKind = 'square' | 'slim' | 'standard'

export interface ShapeClass {
  /** Node lines the box can carry on each axis. */
  cx: AxisClass
  cy: AxisClass
  /** The product band — the dominant axis class (Compute System §4). */
  band: AxisClass
  kind: FrameKind
  /** Which axis is dominant; 'none' when square. */
  dominant: 'x' | 'y' | 'none'
  widthMM: number
  heightMM: number
  /** Material area over bounding-box area — how much of its box the shape actually fills. */
  fill: number
  /** The candidate node frame this pair implies: cx by cy lines, spanning 2n-1 cells per axis. */
  frame: { cols: AxisClass; rows: AxisClass; capacity: number }
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

/** The three primitive families (Dan, 08-24 23:26): SQUARE and its rectangles fill the frame;
 *  ROUND are their rounded versions — square counts, corner padding; TRIANGLE (triangle,
 *  diamond = double triangle, T, L, waisted) populate the frame PARTIALLY. */
export type ShapeFamily = 'square' | 'round' | 'triangle'

/**
 * Family from the material: fill ratio separates triangle (partial box) from full box; corner
 * occupancy separates square (material reaches its corners) from round (corners are padding).
 * Measured on the exemplars 08-24: triangle family fills ~50-65% of its box, square/round 70%+.
 */
export function shapeFamilyOf(outer: ReadonlyArray<Pt>): ShapeFamily {
  const bb = bbox(outer)
  const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY
  const boxA = Math.max(1e-9, w * h)
  let a2 = 0
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++)
    a2 += outer[j][0] * outer[i][1] - outer[i][0] * outer[j][1]
  const fill = Math.abs(a2 / 2) / boxA
  if (fill < 0.68) return 'triangle'
  // corner occupancy: sample the four bbox corner cells for material
  const inside = (px: number, py: number): boolean => {
    let hit = false
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      const xi = outer[i][0], yi = outer[i][1], xj = outer[j][0], yj = outer[j][1]
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
  }
  const dx = w * 0.08, dy = h * 0.08
  const corners = [
    [bb.minX + dx, bb.minY + dy], [bb.maxX - dx, bb.minY + dy],
    [bb.minX + dx, bb.maxY - dy], [bb.maxX - dx, bb.maxY - dy],
  ].filter(([x, y]) => inside(x, y)).length
  return corners >= 3 ? 'square' : 'round'
}
