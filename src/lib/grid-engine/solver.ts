// grid-engine/solver.ts — SUB 1, THE ENGINE. The grid-first solve.
//
// Dan, 2026-08-11: "The sizes are dictated by grid not the shape. No decimal dictated by anything
// only grid exist." So this file generates its candidate sizes from grid arithmetic BEFORE it has
// looked at the shape, and then asks the shape one question at each: does every magnet's whole disc
// sit on material.
//
// Dan, 2026-08-11: "we have finite range that can be recomputed for any shape if we know the range
// and the range is 48mm between each magnet". Consecutive bands differ by exactly one pitch, because
// each extra magnet adds a pitch and the padding never changes. So a band IS a window one pitch wide,
// stepped by the atom — four candidate sizes at 48mm, eight at 96mm. That is the whole size domain.
//
// WHAT IS DELIBERATELY ABSENT, and why:
//   · no continuous scale, no contact-event roots, no interval algebra, no exact/BigInt kernel.
//     Dan, 2026-08-11: "our grid has no decimals and is razor sharp on 12mm cells. There is no case
//     to land on the decimals and miss the grid." A continuum was never in this product; the
//     machinery that existed to order fractional roots existed to serve a domain we invented.
//   · no even-millimetre walk. Sizes are not searched — they are generated from the lattice.
//   · no box-interior containment. See DISC SUPPORT below: a waisted shape cuts the grid box and
//     still lands its magnets correctly, measured on BUTTERFLY.
//
// No constants, no defaults, no literals standing in for law: every number here is read off the spec
// it was handed or produced by arithmetic on those (the engine's standing rule, engine.ts).

import { bandSpanMM, type PointMM, type RegionMM } from './engine'
import type { GridSpec, GridSystemSpec } from './spec'

/** A closed outline in millimetres, as the Cutout Lab hands it over. */
export type OutlineMM = ReadonlyArray<PointMM>

/** How many magnets across and down — a pair is 2x1, a band-2 square is 2x2. Same lattice. */
export interface LayoutCounts {
  cols: number
  rows: number
}

export interface FlapMM {
  left: number
  right: number
  top: number
  bottom: number
}

/** One grid-given candidate, and what the shape did with it. */
export interface Variant {
  /** Which population placed it — the base lattice, or the same lattice thinned. */
  pitchMM: number
  cols: number
  rows: number
  magnetCount: number
  /**
   * THE SIZE, and it is the grid's number: the shape's binding bounding-box side, always a whole
   * number of atoms. Dan: "no decimal dictated by anything only grid exist".
   */
  bindingMM: number
  /** The manufactured bounding box at that size — the other side follows from the locked aspect. */
  widthMM: number
  heightMM: number
  longestMM: number
  /** Magnet centres in the shape's own frame, millimetres, origin at the outline's bbox corner. */
  magnets: PointMM[]
  /** The magnet extent grown by the padding on every side (law: flap is measured from this). */
  gridBox: RegionMM
  /** How far the outline reaches past that box, per side, clamped at zero. */
  flapMM: FlapMM
  /** The agreement of those four — Dan's evenness yardstick, reported, never a gate. */
  flapSpreadMM: number
  /** Exactly two magnets is a twin fix; three or more is a multi fix. */
  classification: 'twin-fix' | 'multi-fix'
  /** Every magnet's whole disc on material. */
  holds: boolean
}

/** Everything one outline produced, plus the candidate count it was measured against. */
export interface SolveResult {
  candidatesTested: number
  variants: Variant[]
  /** Sizes where a pair holds at BOTH populations — Dan's success test, condition two. */
  coupledSizesMM: number[]
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY. Two predicates, both linear in the outline, both exact at the product's own resolution.

export function bboxOf(outline: OutlineMM): RegionMM {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of outline) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Ray crossing. The outline is one closed ring — Dan ruled cut-outs are solid, so there are no holes. */
export function pointInside(px: number, py: number, outline: OutlineMM): boolean {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i]
    const [xj, yj] = outline[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Squared distance from a point to a segment, with the projection clamped to the segment. */
function segmentDistanceSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const qx = ax + t * dx - px
  const qy = ay + t * dy - py
  return qx * qx + qy * qy
}

/** How much fabric a point has around it before the boundary — the clearance the disc needs. */
export function clearanceMM(px: number, py: number, outline: OutlineMM): number {
  let best = Infinity
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const d = segmentDistanceSq(px, py, outline[j][0], outline[j][1], outline[i][0], outline[i][1])
    if (d < best) best = d
  }
  return Math.sqrt(best)
}

/**
 * DISC SUPPORT — the material test, and the ONLY material test.
 *
 * Dan, 2026-08-11, on the butterfly: "the shapes can cut through bounding box and still land on the
 * precise spots of the grid… it has narrow mid section and wide top and bottom bounding box violated
 * by mid section top and bottom rest on the surface correctly."
 *
 * MEASURED, before this was written: at band 2 the butterfly holds all four discs from 130mm, while
 * a rule requiring the grid box's interior to be fabric only passes from 212mm — 41 even sizes
 * thrown away, every one of them with four magnets properly on the wings. A solid blob (POKE2) shows
 * zero difference, which is why a box-interior rule could pass every control shape and still be
 * wrong. Encapsulation means the shape's EXTENT wraps the grid's extent — which is what makes flap
 * measurable outward from the box — not that the box's inside is material.
 *
 * Comparison is closed: a disc exactly touching the boundary is supported. That is why a square lands
 * exactly on its canon spans rather than a hair above them.
 */
export function discSupported(
  centre: PointMM,
  outline: OutlineMM,
  paddingMM: number,
): boolean {
  const [px, py] = centre
  if (!pointInside(px, py, outline)) return false
  return clearanceMM(px, py, outline) >= paddingMM
}

// ─────────────────────────────────────────────────────────────────────────────
// THE GRID. Everything below is lattice arithmetic and never looks at a shape.

/** What a run of magnets measures across at a given population, including its padding. */
export function runSpanMM(pitchMM: number, paddingMM: number, magnets: number): number {
  return Math.max(0, magnets - 1) * pitchMM + 2 * paddingMM
}

/**
 * THE ATOM the whole grid steps in — it IS the padding (law: "we have 12mm atom the entire grid
 * steps in that size"), so it moves when the padding moves and is never restated as a number.
 */
export function atomMM(grid: GridSpec): number {
  return grid.paddingMM
}

/**
 * HOW MANY SIZES FIT IN A BAND. Dan's question, answered by the lattice: consecutive band spans
 * differ by exactly one pitch, so the window from a band to the next IS the pitch, and it is stepped
 * by the atom. Four at 48mm, eight at 96mm. Nothing here is chosen.
 */
export function sizesPerWindow(grid: GridSpec, pitchMM: number): number {
  return Math.round(pitchMM / atomMM(grid))
}

/**
 * A centred run of magnet coordinates. Registration falls out of the count and is never selected:
 * an even run straddles the centre (so the centre lands in the gap), an odd run puts a magnet on it.
 * That is the parity law expressed as arithmetic rather than as a stored choice.
 */
export function centredRun(centreMM: number, pitchMM: number, magnets: number): number[] {
  const out: number[] = []
  for (let i = 0; i < magnets; i++) out.push(centreMM + (i - (magnets - 1) / 2) * pitchMM)
  return out
}

/** Every layout the operational bands offer, from the pair floor up. No shape is consulted. */
export function layoutsFor(bands: ReadonlyArray<number>): LayoutCounts[] {
  const counts = new Set<number>([1])
  for (const b of bands) counts.add(b)
  const sorted = [...counts].sort((a, b) => a - b)
  const out: LayoutCounts[] = []
  for (const cols of sorted) {
    for (const rows of sorted) {
      // The pair is the floor: a single magnet lets the shape pivot and is never offered.
      if (cols * rows < 2) continue
      out.push({ cols, rows })
    }
  }
  return out
}

/**
 * THE CANDIDATE SIZES for one layout at one population — generated from the lattice, then handed the
 * shape's proportions only to know where the window starts.
 *
 * The window starts at the smallest atom-multiple whose shape still wraps the layout's span, and runs
 * one pitch — at which point the next band's layout takes over and is enumerated in its own right.
 */
export function candidateSizesMM(
  grid: GridSpec,
  pitchMM: number,
  layout: LayoutCounts,
  shapeW: number,
  shapeH: number,
): number[] {
  const atom = atomMM(grid)
  const spanX = runSpanMM(pitchMM, grid.paddingMM, layout.cols)
  const spanY = runSpanMM(pitchMM, grid.paddingMM, layout.rows)
  // The shape must at least reach the layout's extent on both axes before anything can be asked.
  const minScale = Math.max(spanX / shapeW, spanY / shapeH)
  const binding = Math.min(shapeW, shapeH)
  const first = Math.ceil((binding * minScale) / atom) * atom
  const steps = sizesPerWindow(grid, pitchMM)
  const out: number[] = []
  for (let k = 0; k < steps; k++) out.push(first + k * atom)
  return out
}

/** The magnet extent grown by the padding on every side — flap is measured from this box. */
export function gridBoxOf(magnets: ReadonlyArray<PointMM>, paddingMM: number): RegionMM {
  const xs = magnets.map(([x]) => x)
  const ys = magnets.map(([, y]) => y)
  const x0 = Math.min(...xs) - paddingMM
  const x1 = Math.max(...xs) + paddingMM
  const y0 = Math.min(...ys) - paddingMM
  const y1 = Math.max(...ys) + paddingMM
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * Flap: four subtractions, because the shape's extent scales with the shape. Nothing inside the box
 * is flap. Ruled after two models measured the gap to the nearest magnet instead, which made a plain
 * square fail — the square IS its box, so its flap is zero at every band.
 */
export function flapOf(shape: RegionMM, box: RegionMM): FlapMM {
  return {
    left: Math.max(0, box.x - shape.x),
    right: Math.max(0, shape.x + shape.w - (box.x + box.w)),
    top: Math.max(0, box.y - shape.y),
    bottom: Math.max(0, shape.y + shape.h - (box.y + box.h)),
  }
}

/** The two flap positions are the padding and the magnet spot — lattice quantities, not thresholds. */
export function flapLimitsMM(grid: GridSpec): [number, number] {
  return [grid.paddingMM, 2 * grid.paddingMM]
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SOLVE.

/**
 * Put one outline against every grid-given candidate.
 *
 * The whole domain: operational bands, both populations, every rectangle from the pair up, one
 * window of atom-steps each. Ninety-six candidates for a shape at the released values — which is why
 * this is instant and why there is nothing in it to optimise.
 */
export function solveOutline(
  spec: GridSystemSpec,
  outline: OutlineMM,
  bands: ReadonlyArray<number>,
  pitches: ReadonlyArray<number>,
): SolveResult {
  const { grid } = spec
  const source = bboxOf(outline)
  if (!(source.w > 0 && source.h > 0) || outline.length < 3) {
    return { candidatesTested: 0, variants: [], coupledSizesMM: [] }
  }
  const ceilingMM = bandSpanMM({ ...grid, pitchMM: grid.basePitchMM }, grid.positionsPerAxis)

  const variants: Variant[] = []
  let candidatesTested = 0

  for (const pitchMM of pitches) {
    for (const layout of layoutsFor(bands)) {
      for (const bindingMM of candidateSizesMM(grid, pitchMM, layout, source.w, source.h)) {
        candidatesTested++
        const scale = bindingMM / Math.min(source.w, source.h)
        const widthMM = source.w * scale
        const heightMM = source.h * scale
        const longestMM = Math.max(widthMM, heightMM)
        // The ceiling is a COUNT expressed as the span it implies — never a millimetre anyone chose.
        if (longestMM > ceilingMM) continue

        // Scale the outline about its own bbox origin; the shape is only ever scaled (law).
        const scaled: PointMM[] = outline.map(([x, y]) => [
          (x - source.x) * scale,
          (y - source.y) * scale,
        ])
        const cx = widthMM / 2
        const cy = heightMM / 2
        const xs = centredRun(cx, pitchMM, layout.cols)
        const ys = centredRun(cy, pitchMM, layout.rows)
        const magnets: PointMM[] = []
        for (const x of xs) for (const y of ys) magnets.push([x, y])

        const holds = magnets.every((m) => discSupported(m, scaled, grid.paddingMM))
        const gridBox = gridBoxOf(magnets, grid.paddingMM)
        const flap = flapOf({ x: 0, y: 0, w: widthMM, h: heightMM }, gridBox)
        const reaches = [flap.left, flap.right, flap.top, flap.bottom]

        variants.push({
          pitchMM,
          cols: layout.cols,
          rows: layout.rows,
          magnetCount: magnets.length,
          bindingMM,
          widthMM,
          heightMM,
          longestMM,
          magnets,
          gridBox,
          flapMM: flap,
          flapSpreadMM: Math.max(...reaches) - Math.min(...reaches),
          classification: magnets.length === 2 ? 'twin-fix' : 'multi-fix',
          holds,
        })
      }
    }
  }

  return { candidatesTested, variants, coupledSizesMM: coupledSizes(variants, pitches) }
}

/**
 * Dan's success test, condition two: a pair must hold at 48mm AND at 96mm sparse — "Not one or the
 * other". Reported as the sizes where both populations answer, so a shape that cannot satisfy it
 * says so with a number rather than by silently returning fewer variants.
 */
function coupledSizes(variants: ReadonlyArray<Variant>, pitches: ReadonlyArray<number>): number[] {
  if (pitches.length < 2) return []
  const holdingBy = new Map<number, Set<number>>()
  for (const v of variants) {
    if (!v.holds) continue
    const key = Math.round(v.bindingMM)
    if (!holdingBy.has(key)) holdingBy.set(key, new Set())
    holdingBy.get(key)!.add(v.pitchMM)
  }
  const out: number[] = []
  for (const [size, seen] of holdingBy) {
    if (pitches.every((p) => seen.has(p))) out.push(size)
  }
  return out.sort((a, b) => a - b)
}
