// Preset shape generators for the outline editor's "Shape" tool.
// Each generator outputs a closed ring of points (Vec2Px, image-pixel space, y-DOWN like the editor
// SVG) centered in the image and fit to a default box. The point ring is then seeded into the
// OutlineDocument (docFromRings) so every existing tool — Round, Smooth, Scale, Hug, drag — applies.
// Parametric where there's a clean formula (polygon, star, pill, circle, squircle, heart, scalloped
// badge); a few recognizable silhouettes (shield, blob, arch, speech bubble) ship as static rings.

import type { Vec2Px } from '@/lib/outline-core'

export type ShapeKind =
  | 'polygon' | 'star' | 'circle' | 'square' | 'pill' | 'squircle'
  | 'heart' | 'speech' | 'badge' | 'shield' | 'blob' | 'arch'

export interface ShapeParams {
  kind: ShapeKind
  sides?: number      // polygon: 3..12
  points?: number     // star: 3..12
  spikiness?: number  // star: 0..100 → inner-radius ratio %
  rotateDeg?: number  // 0..360 (applied to any shape about its center)
}

const rotate = (pts: Vec2Px[], deg: number): Vec2Px[] => {
  if (!deg) return pts
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a)
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c] as Vec2Px)
}
const translate = (pts: Vec2Px[], cx: number, cy: number): Vec2Px[] =>
  pts.map(([x, y]) => [x + cx, y + cy] as Vec2Px)
const scaleNorm = (pts: Vec2Px[], hw: number, hh: number): Vec2Px[] =>
  pts.map(([x, y]) => [x * hw, y * hh] as Vec2Px) // normalized [-1,1] → half-box

// ── parametric primitives (centered at origin) ──────────────────────────────
function regularPolygon(N: number, rx: number, ry: number): Vec2Px[] {
  const out: Vec2Px[] = []
  for (let i = 0; i < N; i++) { const t = (2 * Math.PI * i) / N - Math.PI / 2; out.push([rx * Math.cos(t), ry * Math.sin(t)]) }
  return out // point-top; rotate by 180/N for flat-top
}
function starRing(N: number, R: number, ratio: number): Vec2Px[] {
  const r = R * ratio, out: Vec2Px[] = []
  for (let i = 0; i < 2 * N; i++) { const t = (Math.PI * i) / N - Math.PI / 2; const rad = i % 2 === 0 ? R : r; out.push([rad * Math.cos(t), rad * Math.sin(t)]) }
  return out
}
function ellipseRing(rx: number, ry: number, num = 64): Vec2Px[] {
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) { const t = (2 * Math.PI * i) / num; out.push([rx * Math.cos(t), ry * Math.sin(t)]) }
  return out
}
function superellipse(a: number, b: number, n = 5, num = 72): Vec2Px[] {
  const e = 2 / n, out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num, ct = Math.cos(t), st = Math.sin(t)
    out.push([a * Math.sign(ct) * Math.pow(Math.abs(ct), e), b * Math.sign(st) * Math.pow(Math.abs(st), e)])
  }
  return out
}
function pillRing(W: number, H: number, arc = 16): Vec2Px[] {
  const r = Math.min(W, H) / 2, straight = W / 2 - r, out: Vec2Px[] = []
  for (let i = 0; i <= arc; i++) { const t = -Math.PI / 2 + (Math.PI * i) / arc; out.push([straight + r * Math.cos(t), r * Math.sin(t)]) }
  for (let i = 0; i <= arc; i++) { const t = Math.PI / 2 + (Math.PI * i) / arc; out.push([-straight + r * Math.cos(t), r * Math.sin(t)]) }
  return out
}
function heartRing(W: number, H: number, num = 72): Vec2Px[] {
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    const rx = 16 * Math.pow(Math.sin(t), 3)
    const ry = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    // raw x∈[-16,16], y∈[-12,16] (math y-up): center y by 2, half-range 14, negate for screen y-down
    out.push([(rx / 16) * (W / 2), -((ry - 2) / 14) * (H / 2)])
  }
  return out
}
function scallopRing(N: number, R: number, depth = 0.12, num = 144): Vec2Px[] {
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) { const t = (2 * Math.PI * i) / num; const r = R * (1 + depth * Math.cos(N * t)); out.push([r * Math.cos(t), r * Math.sin(t)]) }
  return out
}
function archRing(): Vec2Px[] {
  // rectangle bottom + semicircular arched top, normalized [-1,1] (y-down: bottom = +1, springline y=0)
  const out: Vec2Px[] = [[1, 1], [1, 0]]
  const arc = 24
  for (let i = 0; i <= arc; i++) { const t = (Math.PI * i) / arc; out.push([Math.cos(t), -Math.sin(t)]) } // right→top→left over the top
  out.push([-1, 1])
  return out
}
function blobRing(num = 64): Vec2Px[] {
  // deterministic organic blob — frequency-modulated circle (fixed harmonics → consistent shape)
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    const r = 1 + 0.16 * Math.cos(3 * t + 0.5) + 0.11 * Math.sin(5 * t + 1.2) + 0.06 * Math.cos(7 * t)
    out.push([r * Math.cos(t) * 0.82, r * Math.sin(t) * 0.82])
  }
  return out
}

// static normalized silhouettes ([-1,1], y-down)
const SHIELD: Vec2Px[] = [[-1, -1], [1, -1], [1, 0.1], [0.6, 0.62], [0, 1], [-0.6, 0.62], [-1, 0.1]]
const SPEECH: Vec2Px[] = [[-1, -1], [1, -1], [1, 0.45], [-0.15, 0.45], [-0.6, 1.0], [-0.55, 0.45], [-1, 0.45]]

/**
 * Build a shape's point ring fit to the image, centered, at a sensible default size (~70% of the
 * shorter side). Rotation is a post-transform about the center (square→diamond = rotate 45°).
 */
export function generateShapeRing(params: ShapeParams, imgW: number, imgH: number): Vec2Px[] {
  const cx = imgW / 2, cy = imgH / 2
  const S = Math.min(imgW, imgH) * 0.7
  const h = S / 2 // half-box for square-fit shapes
  const rot = params.rotateDeg ?? 0
  let ring: Vec2Px[]
  switch (params.kind) {
    case 'polygon': ring = regularPolygon(Math.max(3, Math.min(12, params.sides ?? 6)), h, h); break
    case 'star': ring = starRing(Math.max(3, Math.min(12, params.points ?? 5)), h, Math.max(0.05, Math.min(0.95, (params.spikiness ?? 45) / 100))); break
    case 'circle': ring = ellipseRing(h, h); break
    case 'square': ring = [[-h, -h], [h, -h], [h, h], [-h, h]]; break
    case 'squircle': ring = superellipse(h, h, 5); break
    case 'pill': ring = pillRing(S, S * 0.56); break
    case 'heart': ring = heartRing(S, S); break
    case 'badge': ring = scallopRing(12, h, 0.12); break
    case 'shield': ring = scaleNorm(SHIELD, h, h); break
    case 'speech': ring = scaleNorm(SPEECH, h, h * 0.85); break
    case 'blob': ring = scaleNorm(blobRing(), h, h); break
    case 'arch': ring = scaleNorm(archRing(), h, h); break
    default: ring = ellipseRing(h, h)
  }
  return translate(rotate(ring, rot), cx, cy)
}

/** Shapes that expose live parameter controls (sliders/steppers) in the sheet. */
export const PARAMETRIC: Record<string, boolean> = { polygon: true, star: true }
