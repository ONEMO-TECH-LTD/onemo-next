// shape-library — preset shapes as PURE VECTOR DATA (V3 vector reset, Runs 1–2).
//
// Presets are files, not code (Dan, locked): authored Bézier control points / exact corner
// vertices in a unit box ([-1,1]², y-DOWN), instantiated by transform only. Organic forms are
// BAKED offline (see bake.ts + baked.ts); analytic forms (arcs, polygons, stars) are constructed
// with exact arc/vertex math — never sampled, never fitted at runtime.
// Blueprint: v3/blueprint/modules/shape-library.md.

import type { VAnchor, VShape } from '@/lib/vector-core'
import {
  PINCHED_ANCHORS, SPARKLE_ANCHORS, TEARDROP_ANCHORS,
  SQUIRCLE_ANCHORS, ASTERISK_ANCHORS, BOWTIE_ANCHORS,
} from './baked'

/** Exact circle: 4 smooth anchors, the standard kappa construction (max radial error ~0.027%). */
const KAPPA = 0.5522847498307936

function circleDef(): VShape {
  const k = KAPPA
  const anchors: VAnchor[] = [
    { p: { x: 0, y: -1 }, hIn: { x: -k, y: -1 }, hOut: { x: k, y: -1 }, corner: false },
    { p: { x: 1, y: 0 }, hIn: { x: 1, y: -k }, hOut: { x: 1, y: k }, corner: false },
    { p: { x: 0, y: 1 }, hIn: { x: k, y: 1 }, hOut: { x: -k, y: 1 }, corner: false },
    { p: { x: -1, y: 0 }, hIn: { x: -1, y: k }, hOut: { x: -1, y: -k }, corner: false },
  ]
  return { paths: [{ anchors }] }
}

/** Exact square: 4 corner anchors, no handles — straight lines by construction. */
function squareDef(): VShape {
  return cornersDef([[-1, -1], [1, -1], [1, 1], [-1, 1]])
}

/**
 * Canonical heart — the classic suit-heart cubic construction (public-domain construction,
 * 32 × 29.6 design box), restated as 6 anchors: 2 true cusps (top notch, bottom tip) + 4 smooth.
 */
function heartDef(): VShape {
  const W = 32, H = 29.6
  const n = (x: number, y: number) => ({ x: (x / W) * 2 - 1, y: (y / H) * 2 - 1 })
  const anchors: VAnchor[] = [
    { p: n(23.6, 0), hIn: n(28.2, 0), hOut: n(20.2, 0), corner: false },
    { p: n(16, 5.6), hIn: n(17.3, 2.7), hOut: n(14.7, 2.7), corner: true },
    { p: n(8.4, 0), hIn: n(11.8, 0), hOut: n(3.8, 0), corner: false },
    { p: n(0, 8.4), hIn: n(0, 3.8), hOut: n(0, 17.8), corner: false },
    { p: n(16, 29.6), hIn: n(9.5, 20.3), hOut: n(22.1, 20.3), corner: true },
    { p: n(32, 8.4), hIn: n(32, 17.5), hOut: n(32, 3.8), corner: false },
  ]
  return { paths: [{ anchors }] }
}

/** Pure corner polygons — exact vertices, zero handles. */
function cornersDef(pts: [number, number][]): VShape {
  return { paths: [{ anchors: pts.map(([x, y]) => ({ p: { x, y }, corner: true as const })) }] }
}
const boltDef = () => cornersDef([[-0.12, -1], [0.5, -1], [0.16, -0.22], [0.52, -0.22], [-0.34, 1], [-0.08, 0.1], [-0.5, 0.1]])
const plusDef = () => cornersDef([[-0.36, -1], [0.36, -1], [0.36, -0.36], [1, -0.36], [1, 0.36], [0.36, 0.36], [0.36, 1], [-0.36, 1], [-0.36, 0.36], [-1, 0.36], [-1, -0.36], [-0.36, -0.36]])
const diamondDef = () => cornersDef([[0, -1], [0.78, 0], [0, 1], [-0.78, 0]])

/** Regular polygon — exact vertices from the unit circle (top-centered). */
function polygonDef(sides: number): VShape {
  const N = Math.max(3, Math.min(12, Math.round(sides)))
  const pts: [number, number][] = []
  for (let i = 0; i < N; i++) { const t = (2 * Math.PI * i) / N - Math.PI / 2; pts.push([Math.cos(t), Math.sin(t)]) }
  return cornersDef(pts)
}

/** Star — exact alternating outer/inner vertices. */
function starDef(points: number, spikiness01: number): VShape {
  const N = Math.max(3, Math.min(12, Math.round(points)))
  const ratio = Math.max(0.05, Math.min(0.95, spikiness01))
  const pts: [number, number][] = []
  for (let i = 0; i < 2 * N; i++) {
    const t = (Math.PI * i) / N - Math.PI / 2
    const r = i % 2 === 0 ? 1 : ratio
    pts.push([r * Math.cos(t), r * Math.sin(t)])
  }
  return cornersDef(pts)
}

/** One circular arc as cubics (≤90° per cubic — kappa-exact), CCW in y-down screen space. */
function arcAnchors(cx: number, cy: number, r: number, a0: number, a1: number): VAnchor[] {
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2)))
  const out: VAnchor[] = []
  for (let s = 0; s <= steps; s++) {
    const a = a0 + ((a1 - a0) * s) / steps
    const da = (a1 - a0) / steps
    const k = (4 / 3) * Math.tan(da / 4) * r
    const p = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
    const tan = { x: -Math.sin(a), y: Math.cos(a) } // CCW tangent
    const dir = Math.sign(da) || 1
    out.push({
      p,
      hIn: s > 0 ? { x: p.x - dir * tan.x * Math.abs(k), y: p.y - dir * tan.y * Math.abs(k) } : null,
      hOut: s < steps ? { x: p.x + dir * tan.x * Math.abs(k), y: p.y + dir * tan.y * Math.abs(k) } : null,
      corner: false,
    })
  }
  return out
}

/** leaf: rounded square with ONE sharp corner (3 exact quarter arcs + 1 corner). */
function leafDef(): VShape {
  const R = 0.72
  const a: VAnchor[] = []
  a.push({ p: { x: -1, y: -1 }, corner: true }) // the sharp corner (top-left, y-down)
  a.push(...arcAnchors(1 - R, -1 + R, R, -Math.PI / 2, 0)) // top-right quarter
  a.push(...arcAnchors(1 - R, 1 - R, R, 0, Math.PI / 2)) // bottom-right
  a.push(...arcAnchors(-1 + R, 1 - R, R, Math.PI / 2, Math.PI)) // bottom-left
  // merge consecutive duplicate anchors at arc joins (same point: end of one arc = start of next)
  const merged: VAnchor[] = []
  for (const an of a) {
    const prev = merged[merged.length - 1]
    if (prev && Math.hypot(prev.p.x - an.p.x, prev.p.y - an.p.y) < 1e-9) prev.hOut = an.hOut
    else merged.push(an)
  }
  return { paths: [{ anchors: merged }] }
}

/** lens (vesica): two mirrored circular arcs meeting at two sharp tips — exact arc math. */
function lensDef(bulge = 0.58): VShape {
  const Rc = (1 + bulge * bulge) / (2 * bulge)
  const half = Math.asin(1 / Rc)
  // top arc: center below, sweeping left→right; bottom arc mirrored. Tips at (±1, 0) are corners.
  const top = arcAnchors(0, Rc - bulge, Rc, -Math.PI / 2 - half, -Math.PI / 2 + half)
  const bottom = arcAnchors(0, -(Rc - bulge), Rc, Math.PI / 2 - half, Math.PI / 2 + half)
  const anchors: VAnchor[] = []
  const pushChain = (chain: VAnchor[]) => {
    for (const an of chain) {
      const prev = anchors[anchors.length - 1]
      if (prev && Math.hypot(prev.p.x - an.p.x, prev.p.y - an.p.y) < 1e-9) prev.hOut = an.hOut
      else anchors.push(an)
    }
  }
  pushChain(top)
  pushChain(bottom)
  // close: last point of bottom == first point of top → merge into the ring start
  const first = anchors[0], last = anchors[anchors.length - 1]
  if (Math.hypot(first.p.x - last.p.x, first.p.y - last.p.y) < 1e-9) { first.hIn = last.hIn; anchors.pop() }
  // the two tips are true corners
  for (const an of anchors) if (Math.abs(Math.abs(an.p.x) - 1) < 1e-6 && Math.abs(an.p.y) < 1e-6) an.corner = true
  return { paths: [{ anchors }] }
}

/** pill / stadium (KAI-9129) — a horizontal capsule: two semicircular ends + straight top/bottom, all
 *  smooth. Used for the chip glyph; the PICKED pill is math-derived (a sharp rectangle + a whole-shape
 *  Radius recipe = half the short side), fully reversible to a rectangle. */
function pillDef(): VShape {
  const R = 0.5
  const right = arcAnchors(0.5, 0, R, -Math.PI / 2, Math.PI / 2)       // top → right → bottom
  const left = arcAnchors(-0.5, 0, R, Math.PI / 2, (3 * Math.PI) / 2)  // bottom → left → top
  const anchors: VAnchor[] = []
  const push = (chain: VAnchor[]) => {
    for (const an of chain) {
      const prev = anchors[anchors.length - 1]
      if (prev && Math.hypot(prev.p.x - an.p.x, prev.p.y - an.p.y) < 1e-9) prev.hOut = an.hOut
      else anchors.push(an)
    }
  }
  push(right)
  push(left)
  const first = anchors[0], last = anchors[anchors.length - 1]
  if (Math.hypot(first.p.x - last.p.x, first.p.y - last.p.y) < 1e-9) { first.hIn = last.hIn; anchors.pop() }
  return { paths: [{ anchors }] }
}

const fromBaked = (anchors: VAnchor[]) => (): VShape => ({ paths: [{ anchors: anchors.map((a) => ({ ...a, p: { ...a.p }, hIn: a.hIn ? { ...a.hIn } : a.hIn, hOut: a.hOut ? { ...a.hOut } : a.hOut })) }] })

export interface VectorShapeParams {
  sides?: number
  points?: number
  spikiness?: number // 0..100
}

export type VectorShapeKind =
  | 'circle' | 'square' | 'pill' | 'heart'
  | 'bolt' | 'plus' | 'diamond' | 'polygon' | 'star'
  | 'leaf' | 'lens'
  | 'pinched' | 'sparkle' | 'teardrop' | 'squircle' | 'asterisk' | 'bowtie'

const DEFS: Record<VectorShapeKind, (p: VectorShapeParams) => VShape> = {
  circle: () => circleDef(),
  square: () => squareDef(),
  pill: () => pillDef(),
  heart: () => heartDef(),
  bolt: () => boltDef(),
  plus: () => plusDef(),
  diamond: () => diamondDef(),
  polygon: (p) => polygonDef(p.sides ?? 6),
  star: (p) => starDef(p.points ?? 5, (p.spikiness ?? 45) / 100),
  leaf: () => leafDef(),
  lens: () => lensDef(),
  pinched: fromBaked(PINCHED_ANCHORS),
  sparkle: fromBaked(SPARKLE_ANCHORS),
  teardrop: fromBaked(TEARDROP_ANCHORS),
  squircle: fromBaked(SQUIRCLE_ANCHORS),
  asterisk: fromBaked(ASTERISK_ANCHORS),
  bowtie: fromBaked(BOWTIE_ANCHORS),
}

export function hasVectorDef(kind: string): kind is VectorShapeKind {
  return kind in DEFS
}

export function unitShape(kind: VectorShapeKind, params: VectorShapeParams = {}): VShape {
  return DEFS[kind](params)
}

/** Per-kind aspect of the placement box (matches the retired generator proportions). */
export const SHAPE_ASPECT: Partial<Record<VectorShapeKind, { sx: number; sy: number }>> = {
  teardrop: { sx: 0.8, sy: 1 },
  lens: { sx: 1, sy: 0.62 },
  bowtie: { sx: 1, sy: 0.9 },
}
