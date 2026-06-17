// vector-core/paper-kernel.ts — the BOUGHT geometry math (DEC-v5-02, Creator v5 Phase 1).
//
// Paper.js HEADLESS is the kernel for editor ops (corner-round / smooth / simplify), behind our
// in-house VShape model. Paper is used for MATH ONLY — data in → op → segments out — we never let it
// render or own state (the prior "avoid Paper.js" objection applied only to letting it render in our
// React/three.js app). A single headless PaperScope (a Size, NO canvas element) is set up lazily;
// every op builds a transient Path and removes it after, so nothing accumulates in the project.
//
// Coordinate convention: a VShape anchor's hIn/hOut are ABSOLUTE positions; a Paper Segment's
// handleIn/handleOut are RELATIVE to the segment point. The converters below translate between them.
//
// Headless proven in node (no DOM) at L0: the unequal-leg corner the hand-rolled filletPathSmart skews
// rounds SYMMETRICALLY here (arc ends equidistant from the vertex).

// Import the HEADLESS core build, NOT 'paper' (= paper-full): paper-full pulls dist/node/self.js, a
// Node-only shim webpack can't resolve in the browser bundle (build break). paper-core is the same
// PaperScope minus PaperScript — all the path math we use — and bundles cleanly client + server.
import paper from 'paper/dist/paper-core'
import { PaperRoundCorners } from 'paperjs-round-corners'
import type { VPath, VAnchor, VShape } from './types'

// paper Segment carries a runtime `.data` bag the bundled types don't declare — typed accessors.
type SegData = { vid?: string }
const getData = (s: paper.Segment): SegData | undefined => (s as unknown as { data?: SegData }).data
const setData = (s: paper.Segment, d: SegData): void => { (s as unknown as { data?: SegData }).data = d }

let _ready = false
function ensureScope(): void {
  if (_ready) return
  // Headless: size the project arbitrarily, NO canvas element (math only — the view is never used).
  paper.setup(new paper.Size(1000, 1000))
  _ready = true
}

/** VShape path → transient Paper Path (absolute handles → relative). The VShape anchor id rides on
 *  `segment.data.vid` so it survives the op (the F1 reversibility bond — a rounded corner stays keyed
 *  to its source id). Caller must `.remove()` the path. */
function toPaperPath(path: VPath): paper.Path {
  ensureScope()
  const p = new paper.Path()
  for (const a of path.anchors) {
    const seg = new paper.Segment(
      new paper.Point(a.p.x, a.p.y),
      a.hIn ? new paper.Point(a.hIn.x - a.p.x, a.hIn.y - a.p.y) : undefined,
      a.hOut ? new paper.Point(a.hOut.x - a.p.x, a.hOut.y - a.p.y) : undefined,
    )
    setData(seg, { vid: a.id })
    p.add(seg)
  }
  p.closed = true
  return p
}

/** Paper Path → VShape path (relative handles → absolute; a zero-handle segment is a true corner;
 *  `segment.data.vid` → the anchor id). */
function fromPaperPath(p: paper.Path): VPath {
  const anchors: VAnchor[] = p.segments.map((seg) => {
    const hIn = seg.handleIn.isZero() ? null : { x: seg.point.x + seg.handleIn.x, y: seg.point.y + seg.handleIn.y }
    const hOut = seg.handleOut.isZero() ? null : { x: seg.point.x + seg.handleOut.x, y: seg.point.y + seg.handleOut.y }
    const vid = getData(seg)?.vid
    const out: VAnchor = { p: { x: seg.point.x, y: seg.point.y }, hIn, hOut, corner: !hIn && !hOut }
    if (vid) out.id = vid
    return out
  })
  return { anchors }
}

/**
 * L1 — TRUE-ARC corner round (replaces the hand-rolled, leg-skewing `filletPathSmart`). Rounds every
 * anchor index for which `pick(i)` is true with `radiusPx`, via paperjs-round-corners — a single
 * constant-radius arc, SYMMETRIC on unequal legs (the exact thing the hand-roll got wrong). A radius
 * too large for a corner is left sharp (the plugin throws → that corner is skipped), never folded.
 */
export function roundCornersPaper(path: VPath, radiusPx: number, pick: (i: number) => boolean): VPath {
  if (radiusPx <= 0) return path
  const N = path.anchors.length
  const want: boolean[] = []
  let count = 0
  for (let i = 0; i < N; i++) { want[i] = pick(i); if (want[i]) count++ }
  if (!count) return path
  // SEAM FIX (Dan: "one corner always stays straight" — the top-right seam): PaperRoundCorners
  // mis-rounds a target at index 0 of a CLOSED path — it rounds the NEXT vertex, leaving the seam
  // corner sharp (round(seg[0]) and round(seg[1]) both hit vertex 1; vertex 0 is unreachable). A closed
  // ring's start is arbitrary, so rotate a NON-target to index 0 before rounding (ids ride along → the
  // exact same shape + F1 bond). When EVERY corner is a target there is no lone seam — the high→low
  // multi pass rounds index 0 correctly last — so no rotation is needed.
  let anchors = path.anchors
  let want2 = want
  if (want[0] && count < N) {
    let k = 1
    while (k < N && want[k]) k++ // first non-target → rotate it to index 0
    anchors = [...path.anchors.slice(k), ...path.anchors.slice(0, k)]
    want2 = [...want.slice(k), ...want.slice(0, k)]
  }
  const targets: number[] = []
  for (let i = 0; i < anchors.length; i++) if (want2[i]) targets.push(i)
  const pp = toPaperPath({ anchors })
  try {
    // Round HIGH→LOW so each round's inserted segments don't shift the still-pending lower indices.
    for (const i of targets.sort((a, b) => b - a)) {
      const seg = pp.segments[i]
      if (!seg) continue
      const vid = getData(seg)?.vid // the source corner id (F1 bond)
      // Clamp the radius to the corner's legs (≈ half the shorter neighbour distance). A true-radius
      // arc can't exceed its legs; this is the geometrically-honest max (and matches the old fillet's
      // clamp) — so a corner pinned into a DENSE faired ring still rounds (smaller), never throws.
      const n = pp.segments.length
      const cur = seg.point, prev = pp.segments[(i - 1 + n) % n].point, next = pp.segments[(i + 1) % n].point
      const minLeg = Math.min(cur.getDistance(prev), cur.getDistance(next))
      const r = Math.min(radiusPx, 0.49 * minLeg)
      if (r < 0.25) continue // leg too short to rounding meaningfully — leave the corner
      const lenBefore = pp.segments.length
      try { PaperRoundCorners.round(seg, r) } catch { continue /* still too tight — leave sharp */ }
      // round split the corner at i into its two arc-end anchors ([i, i+1]); carry the source id onto
      // them so the rounded corner stays re-selectable + reversible by id (no bake / no drift, F1).
      if (vid && pp.segments.length > lenBefore) {
        for (const j of [i, i + 1]) { const a = pp.segments[j]; if (a) setData(a, { vid }) }
      }
    }
    return fromPaperPath(pp)
  } finally {
    pp.remove() // headless hygiene: no Path accumulates in the project
  }
}

/**
 * L6 — round EVERY corner of a shape (the standard-square birth's 8mm corners + any whole-shape
 * round). One engine: the same Paper true-arc round as the editor's Radius tool, so there is no second
 * fillet implementation. Replaces the in-house filletShape on the production birth path.
 */
export function roundShapePaper(shape: VShape, radiusPx: number): VShape {
  return { paths: shape.paths.map((p) => roundCornersPaper(p, radiusPx, () => true)) }
}

/**
 * L2 — SMOOTH the whole path via Paper's native catmull-rom smoothing (no point explosion). Returns a
 * faired copy; OFF (no call) leaves the source. `type`/`factor` map the 0..100 Smooth axis.
 */
export function smoothPaper(path: VPath, factor: number): VPath {
  if (factor <= 0) return path
  const pp = toPaperPath(path)
  try {
    pp.smooth({ type: 'catmull-rom', factor: Math.max(0, Math.min(1, factor)) })
    return fromPaperPath(pp)
  } finally {
    pp.remove()
  }
}

/**
 * L2 — SIMPLIFY (Detail) via Paper's native fit: fewer anchors as tolerance rises, correct direction
 * (more tolerance = fewer points = LESS detail). tolerancePx 0 = no simplify (full detail).
 */
export function simplifyPaper(path: VPath, tolerancePx: number): VPath {
  if (tolerancePx <= 0) return path
  const pp = toPaperPath(path)
  try {
    pp.simplify(tolerancePx)
    return fromPaperPath(pp)
  } finally {
    pp.remove()
  }
}
