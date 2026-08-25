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
 * THE CLASS LAYOUT (Dan's pipeline, 2026-08-25): centre first, segments second, classification
 * third, layout fourth, wrap last. The segment box's PROPORTIONS are scale-invariant, so the
 * class needs no size: the band id IS the dominant axis's line count (band-by-frame), and the
 * minor axis carries lines in proportion. A tall segment in B2 is a vertical pair by
 * construction — no parity coin-flip, no discovery.
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

/**
 * THE CLASS ASSEMBLIES — the canon layout family for a frame, not just its full field. A tall
 * segment's band frame can be populated as the full assembly, its corners (the waisted/duck
 * answer), the tee — apex plus base row (the tapered/bat answer, Dan 08-25), or the diagonal
 * chain (the pill's ruled layout). All are lawful class layouts; the material decides which
 * fits, the band offers those that do.
 */
export function classAssemblies(
  cols: number, rows: number, pitchMM: number = DEFAULT_PITCH_MM,
): Array<{ name: string; nodes: Pt[] }> {
  const node = (ix: number, iy: number): Pt =>
    [(ix - (cols - 1) / 2) * pitchMM, (iy - (rows - 1) / 2) * pitchMM]
  const out: Array<{ name: string; nodes: Pt[] }> = []
  const seen = new Set<string>()
  const push = (name: string, raw: Pt[]) => {
    // magnets exist once per node — a degenerate assembly (apex falling on its own base) must
    // collapse, never stack two magnets on one spot
    const nodes = [...new Map(raw.map((q) => [q.join(','), q])).values()]
    const id = nodes.map((q) => q.join(',')).sort().join(';')
    if (nodes.length && !seen.has(id)) { seen.add(id); out.push({ name, nodes }) }
  }
  // full frame
  const full: Pt[] = []
  for (let ix = 0; ix < cols; ix++) for (let iy = 0; iy < rows; iy++) full.push(node(ix, iy))
  push('frame', full)
  // corners — the extremes of the frame
  push('corners', [...new Set([0, cols - 1])].flatMap((ix) => [...new Set([0, rows - 1])].map((iy) => node(ix, iy))))
  // tee — apex on the short end, full row on the base. THE APEX IS A LATTICE NODE, never the
  // geometric centre: an even-width frame has no centre node, so both mirrored tees are offered.
  // (A half-pitch apex violated the rigid-lattice law — magnets exist only at nodes.)
  if (rows >= cols) {
    const base: Pt[] = []
    for (let ix = 0; ix < cols; ix++) base.push(node(ix, 0))
    for (const ax of cols % 2 === 1 ? [(cols - 1) / 2] : [cols / 2 - 1, cols / 2])
      push('tee', [node(ax, rows - 1), ...base])
  } else {
    const base: Pt[] = []
    for (let iy = 0; iy < rows; iy++) base.push(node(0, iy))
    for (const ay of rows % 2 === 1 ? [(rows - 1) / 2] : [rows / 2 - 1, rows / 2])
      push('tee', [node(cols - 1, ay), ...base])
  }
  // ell — one full column and the base row, joined at the corner ("an L drops to 1+2 by itself")
  if (cols >= 2 && rows >= 2) {
    const ell: Pt[] = []
    for (let iy = 0; iy < rows; iy++) ell.push(node(0, iy))
    for (let ix = 1; ix < cols; ix++) ell.push(node(ix, 0))
    push('ell', ell)
  }
  // diagonal chain
  const n = Math.min(cols, rows)
  if (n > 1) {
    const diag: Pt[] = []
    const steps = Math.max(cols, rows)
    for (let k = 0; k < steps; k++) diag.push(node(Math.min(k, cols - 1), Math.min(k, rows - 1)))
    push('diagonal', [...new Map(diag.map((q) => [q.join(','), q])).values()])
  }
  return out
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
  // corner occupancy: sample the four bbox corner cells (15% of each side) for material
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

/** The family's assembly set — which populations of the frame are this shape's class layouts. */
export function familyAssemblies(
  family: ShapeFamily, cols: number, rows: number, pitchMM: number = DEFAULT_PITCH_MM,
): Array<{ name: string; nodes: Pt[] }> {
  const all = classAssemblies(cols, rows, pitchMM)
  const pick = (names: string[]) => all.filter((a) => names.includes(a.name))
  if (family === 'square') return pick(['frame'])
  if (family === 'round') return pick(['frame', 'corners'])
  return pick(['tee', 'corners', 'diagonal', 'ell'])
}
