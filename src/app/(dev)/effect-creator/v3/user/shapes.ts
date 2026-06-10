// Shape generators for the outline editor's "Shape" tool — the V3 lineup from Dan's Figma
// "shapes library" board (2026-06-10): a bold symbol alphabet (Simbolik/LOEWE language — pinched
// square, daisy, bolt, sparkle, teardrop, leaf, lens, pebble…) plus TWO live generators:
//   • form — the superformula family (lobes + pinch): pinched squares, clovers, petals, stars —
//     one continuous parametric space; the LOEWE pinched square is a preset inside it.
//   • blob — seeded organic blobs (waviness + dice-reroll): smooth harmonic displacement of a
//     circle, always closed and simple.
// Each generator outputs a closed ring of points (Vec2Px, image-pixel space, y-DOWN like the editor
// SVG) centered in the image and fit to a default box. The ring seeds the OutlineDocument
// (docFromRings) so every tool — Smooth, Scale, drag, Points — applies on top.

import type { Vec2Px } from '@/lib/outline-core'

export type ShapeKind =
  | 'pinched' | 'daisy' | 'heart' | 'bolt' | 'sparkle' | 'teardrop' | 'leaf' | 'lens'
  | 'diamond' | 'plus' | 'asterisk' | 'bowtie' | 'pinwheel' | 'pebble'
  | 'circle' | 'square' | 'squircle' | 'polygon' | 'star'
  | 'form' | 'blob'

export interface ShapeParams {
  kind: ShapeKind
  sides?: number      // polygon: 3..12
  points?: number     // star: 3..12
  spikiness?: number  // star: 0..100 → inner-radius ratio %
  lobes?: number      // form: 3..8 (superformula symmetry)
  pinch?: number      // form: 0..100 (round → deeply pinched)
  petals?: number     // daisy: 5..12
  depth?: number      // daisy: 0..100 petal depth %
  blades?: number     // pinwheel: 3..8
  swirl?: number      // pinwheel: 0..100
  waviness?: number   // blob: 0..100
  seed?: number       // blob: dice-reroll seed
  rotateDeg?: number  // any shape, about its center
}

const rotate = (pts: Vec2Px[], deg: number): Vec2Px[] => {
  if (!deg) return pts
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a)
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c] as Vec2Px)
}
const translate = (pts: Vec2Px[], cx: number, cy: number): Vec2Px[] =>
  pts.map(([x, y]) => [x + cx, y + cy] as Vec2Px)
const scaleNorm = (pts: Vec2Px[], hw: number, hh: number): Vec2Px[] =>
  pts.map(([x, y]) => [x * hw, y * hh] as Vec2Px)

// ── VECTOR CORE (#29): pure-curve shape output — anchors + cubic handles, points on demand ──
// A curve shape is NOT made of points: the document carries sparse anchors with Bézier handles
// (corners only where the geometry truly has them); display renders the curves exactly.
export interface CurveAnchor { p: Vec2Px; c1?: Vec2Px; c2?: Vec2Px; corner?: boolean }

const KAPPA = 0.5522847498307936

/** Exact 4-anchor Bézier circle/ellipse (the canonical minimal set). */
function circleCurve(rx: number, ry: number): CurveAnchor[] {
  const k = KAPPA
  return [
    { p: [0, -ry], c1: [rx * k, -ry], c2: [rx, -ry * k] },
    { p: [rx, 0], c1: [rx, ry * k], c2: [rx * k, ry] },
    { p: [0, ry], c1: [-rx * k, ry], c2: [-rx, ry * k] },
    { p: [-rx, 0], c1: [-rx, -ry * k], c2: [-rx * k, -ry] },
  ]
}

/** Detect true corners on a dense ring (tangent break > `deg`). */
function denseCorners(ring: Vec2Px[], deg = 40): Set<number> {
  const n = ring.length
  const out = new Set<number>()
  for (let i = 0; i < n; i++) {
    const a = ring[(i - 1 + n) % n], p = ring[i], b = ring[(i + 1) % n]
    const ax = p[0] - a[0], ay = p[1] - a[1], bx = b[0] - p[0], by = b[1] - p[1]
    const la = Math.hypot(ax, ay) || 1e-9, lb = Math.hypot(bx, by) || 1e-9
    const dot = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))
    if ((Math.acos(dot) * 180) / Math.PI > deg) out.add(i)
  }
  return out
}

/**
 * Convert a dense parametric ring into a sparse CURVE chain: anchors every ~`spacing` along the
 * ring (always exactly ON the curve, cusps pinned as corner anchors), Catmull-Rom tangents become
 * cubic handles (one-sided at corners so cusps stay crisp). The result is smooth at every zoom —
 * the faceting class (heart/daisy, Dan 2026-06-10) is structurally gone.
 */
function curveChainFromDense(ring: Vec2Px[], anchorsTarget = 28): CurveAnchor[] {
  const n = ring.length
  if (n < 8) return ring.map((p) => ({ p: [p[0], p[1]] as Vec2Px }))
  const corners = denseCorners(ring)
  // pick anchor indices: corners + evenly spaced fills between them
  const idx: number[] = [...corners].sort((a, b) => a - b)
  const spacing = Math.max(4, Math.floor(n / anchorsTarget))
  if (idx.length === 0) {
    for (let i = 0; i < n; i += spacing) idx.push(i)
  } else {
    const fills: number[] = []
    for (let k = 0; k < idx.length; k++) {
      const a = idx[k], b = idx[(k + 1) % idx.length]
      const span = (b - a + n) % n
      const steps = Math.max(1, Math.round(span / spacing))
      for (let t = 1; t < steps; t++) fills.push((a + Math.round((span * t) / steps)) % n)
    }
    idx.push(...fills)
    idx.sort((a, b) => a - b)
  }
  const uniq = [...new Set(idx)]
  const m = uniq.length
  const anchors: CurveAnchor[] = []
  for (let k = 0; k < m; k++) {
    const iPrev = uniq[(k - 1 + m) % m], iCur = uniq[k], iNext = uniq[(k + 1) % m]
    const pPrev = ring[iPrev], p = ring[iCur], pNext = ring[iNext]
    const isCorner = corners.has(iCur)
    const nextIsCorner = corners.has(iNext)
    // outgoing tangent at the current anchor (one-sided when the anchor is a true corner)
    const tOutX = isCorner ? pNext[0] - p[0] : (pNext[0] - pPrev[0]) / 2
    const tOutY = isCorner ? pNext[1] - p[1] : (pNext[1] - pPrev[1]) / 2
    // incoming tangent at the NEXT anchor
    const iNext2 = uniq[(k + 2) % m]
    const pNext2 = ring[iNext2]
    const tInX = nextIsCorner ? pNext[0] - p[0] : (pNext2[0] - p[0]) / 2
    const tInY = nextIsCorner ? pNext[1] - p[1] : (pNext2[1] - p[1]) / 2
    anchors.push({
      p: [p[0], p[1]],
      c1: [p[0] + tOutX / 3, p[1] + tOutY / 3],
      c2: [pNext[0] - tInX / 3, pNext[1] - tInY / 3],
      corner: isCorner,
    })
  }
  return anchors
}

const curveOps = {
  rotate(a: CurveAnchor[], deg: number): CurveAnchor[] {
    if (!deg) return a
    const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r)
    const rp = (p: Vec2Px): Vec2Px => [p[0] * c - p[1] * s, p[0] * s + p[1] * c]
    return a.map((n) => ({ ...n, p: rp(n.p), c1: n.c1 && rp(n.c1), c2: n.c2 && rp(n.c2) }))
  },
  translate(a: CurveAnchor[], cx: number, cy: number): CurveAnchor[] {
    const tp = (p: Vec2Px): Vec2Px => [p[0] + cx, p[1] + cy]
    return a.map((n) => ({ ...n, p: tp(n.p), c1: n.c1 && tp(n.c1), c2: n.c2 && tp(n.c2) }))
  },
}

/**
 * VECTOR CORE shape output: returns the pure-curve definition for curved kinds, or null for
 * polygonal kinds (whose generateShapeRing output IS the exact sparse vertex set — true corners,
 * straight lines, Radius-ready). One source of geometry truth per kind.
 */
export function generateCurveShape(params: ShapeParams, imgW: number, imgH: number): CurveAnchor[] | null {
  const kind = params.kind
  // polygonal kinds: exact sparse vertices (lines + corners) — no curves to carry
  if (kind === 'square' || kind === 'diamond' || kind === 'plus' || kind === 'bolt' || kind === 'polygon' || kind === 'star') return null
  const S = Math.min(imgW, imgH) * 0.72
  const h = S / 2
  const cx = imgW / 2, cy = imgH / 2
  if (kind === 'circle') return curveOps.translate(circleCurve(h, h), cx, cy)
  // every other curved kind: dense parametric ring → sparse curve chain (cusps pinned)
  const ring = generateShapeRing({ ...params, rotateDeg: 0 }, imgW, imgH)
  // ring is already centered/translated in image space — chain it directly
  const chain = curveChainFromDense(ring)
  return params.rotateDeg ? curveOps.rotate(curveOps.translate(chain, -cx, -cy), params.rotateDeg).map((n) => ({ ...n, p: [n.p[0] + cx, n.p[1] + cy] as Vec2Px, c1: n.c1 && ([n.c1[0] + cx, n.c1[1] + cy] as Vec2Px), c2: n.c2 && ([n.c2[0] + cx, n.c2[1] + cy] as Vec2Px) })) : chain
}

/** Re-fit any ring to [-1,1] preserving aspect (so parametric output always fills its box). */
function normalize(pts: Vec2Px[]): Vec2Px[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const k = 2 / Math.max(maxX - minX, maxY - minY, 1e-9)
  return pts.map(([x, y]) => [(x - cx) * k, (y - cy) * k] as Vec2Px)
}

// ── parametric primitives (centered at origin) ──────────────────────────────
function regularPolygon(N: number, rx: number, ry: number): Vec2Px[] {
  const out: Vec2Px[] = []
  for (let i = 0; i < N; i++) { const t = (2 * Math.PI * i) / N - Math.PI / 2; out.push([rx * Math.cos(t), ry * Math.sin(t)]) }
  return out
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
function heartRing(W: number, H: number, num = 72): Vec2Px[] {
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    const rx = 16 * Math.pow(Math.sin(t), 3)
    const ry = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    out.push([(rx / 16) * (W / 2), -((ry - 2) / 14) * (H / 2)])
  }
  return out
}

/**
 * The "form" generator's engine — the lobed-clover family (LOEWE language): FAT rounded lobes
 * with pinched valleys, r(φ) = (1−d) + d·|cos(m·φ/2)|^p. `m` = lobe count; `d` (from pinch)
 * = how deep the valleys cut; p<1 keeps the lobes fat instead of pointy. (A pure Gielis
 * superformula read as pointy petals here — wrong language for the board.)
 */
function formRing(lobes: number, pinch01: number, num = 192): Vec2Px[] {
  const m = Math.max(3, Math.min(8, lobes))
  const d = 0.08 + 0.4 * Math.max(0, Math.min(1, pinch01))
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    const r = (1 - d) + d * Math.pow(Math.abs(Math.cos((m * t) / 2)), 0.8)
    out.push([r * Math.cos(t), r * Math.sin(t)])
  }
  return normalize(out)
}

/** mulberry32 — tiny seeded PRNG so a blob is reproducible per seed (dice rerolls the seed). */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** blob generator: harmonic displacement of a circle — always smooth, closed, simple. */
function blobRing(seed: number, waviness01: number, num = 96): Vec2Px[] {
  const rnd = mulberry32(seed || 1)
  const w = 0.06 + 0.22 * Math.max(0, Math.min(1, waviness01))
  const a1 = (0.5 + 0.5 * rnd()) * w, p1 = rnd() * 2 * Math.PI
  const a2 = (0.4 + 0.6 * rnd()) * w * 0.7, p2 = rnd() * 2 * Math.PI
  const a3 = (0.3 + 0.7 * rnd()) * w * 0.45, p3 = rnd() * 2 * Math.PI
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    const r = 1 + a1 * Math.sin(2 * t + p1) + a2 * Math.sin(3 * t + p2) + a3 * Math.sin(5 * t + p3)
    out.push([r * Math.cos(t), r * Math.sin(t)])
  }
  return normalize(out)
}

/** daisy: rounded cosine petals (board's yellow flower). */
function daisyRing(petals: number, depth01: number, num = 160): Vec2Px[] {
  const d = 0.1 + 0.28 * Math.max(0, Math.min(1, depth01))
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    const r = 1 - d + d * (0.5 + 0.5 * Math.cos(petals * t)) * 2
    out.push([r * Math.cos(t), r * Math.sin(t)])
  }
  return normalize(out)
}

/** pinwheel: daisy blades swirled — each point rotates more the deeper it sits (curved blades). */
function pinwheelRing(blades: number, swirl01: number, num = 192): Vec2Px[] {
  const d = 0.42
  const s = 1.4 * Math.max(0, Math.min(1, swirl01))
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    const lobe = 0.5 + 0.5 * Math.cos(blades * t)
    const r = 1 - d + d * lobe * 2
    const theta = t + s * (1 - lobe) // valleys lag → blades curve
    out.push([r * Math.cos(theta), r * Math.sin(theta)])
  }
  return normalize(out)
}

/** asterisk: six fat rounded arms (Simbolik totem glyph). */
function asteriskRing(num = 192): Vec2Px[] {
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    const r = 0.34 + 0.66 * Math.pow(Math.abs(Math.cos(3 * t)), 1.1)
    out.push([r * Math.cos(t), r * Math.sin(t)])
  }
  return normalize(out)
}

/** bowtie: two lobes with a pinched waist (Simbolik infinity glyph). */
function bowtieRing(num = 144): Vec2Px[] {
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    const r = 0.34 + 0.66 * Math.pow(Math.abs(Math.cos(t)), 1.35)
    out.push([r * Math.cos(t), r * Math.sin(t)])
  }
  return normalize(out)
}

/** sparkle: astroid (x=cos³t, y=sin³t) — the 4-point star with concave sides. */
function sparkleRing(num = 128): Vec2Px[] {
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    out.push([Math.pow(Math.cos(t), 3), Math.pow(Math.sin(t), 3)])
  }
  return out
}

/** teardrop: classic teardrop curve, point up. */
function teardropRing(num = 96): Vec2Px[] {
  const out: Vec2Px[] = []
  for (let i = 0; i < num; i++) {
    const t = (2 * Math.PI * i) / num
    const x = Math.sin(t) * Math.pow(Math.sin(t / 2), 2)
    const y = -Math.cos(t) // cusp at t=0 → the point sits at the top (screen y-down)
    out.push([x, y])
  }
  return normalize(out)
}

/** leaf: rounded square with ONE sharp corner (board's blue petal/leaf). */
function leafRing(): Vec2Px[] {
  const R = 0.72, arc = 18
  const out: Vec2Px[] = []
  // sharp corner top-left, then clockwise: TR, BR, BL rounded (y-down screen space)
  out.push([-1, -1])
  for (let i = 0; i <= arc; i++) { const a = -Math.PI / 2 + (Math.PI / 2) * (i / arc); out.push([1 - R + R * Math.cos(a), -1 + R + R * Math.sin(a)]) }
  for (let i = 0; i <= arc; i++) { const a = (Math.PI / 2) * (i / arc); out.push([1 - R + R * Math.cos(a), 1 - R + R * Math.sin(a)]) }
  for (let i = 0; i <= arc; i++) { const a = Math.PI / 2 + (Math.PI / 2) * (i / arc); out.push([-1 + R + R * Math.cos(a), 1 - R + R * Math.sin(a)]) }
  return out
}

/** lens: vesica — two mirrored circular arcs meeting at two points (board's yellow eye). */
function lensRing(bulge = 0.58, arc = 40): Vec2Px[] {
  const Rc = (1 + bulge * bulge) / (2 * bulge) // arc through (±1,0) with apex at ±bulge
  const half = Math.asin(1 / Rc)
  const out: Vec2Px[] = []
  for (let i = 0; i <= arc; i++) {
    const a = -half + (2 * half) * (i / arc)
    out.push([Rc * Math.sin(a), -(Rc * Math.cos(a) - (Rc - bulge))])
  }
  for (let i = 0; i <= arc; i++) {
    const a = half - (2 * half) * (i / arc)
    out.push([Rc * Math.sin(a), Rc * Math.cos(a) - (Rc - bulge)])
  }
  return out
}

// static normalized silhouettes ([-1,1], y-down)
const BOLT: Vec2Px[] = [[-0.12, -1], [0.5, -1], [0.16, -0.22], [0.52, -0.22], [-0.34, 1], [-0.08, 0.1], [-0.5, 0.1]]
const PLUS: Vec2Px[] = [[-0.36, -1], [0.36, -1], [0.36, -0.36], [1, -0.36], [1, 0.36], [0.36, 0.36], [0.36, 1], [-0.36, 1], [-0.36, 0.36], [-1, 0.36], [-1, -0.36], [-0.36, -0.36]]
const DIAMOND: Vec2Px[] = [[0, -1], [0.78, 0], [0, 1], [-0.78, 0]]

/**
 * Build a shape's point ring fit to the image, centered, at a sensible default size (~70% of the
 * shorter side). Rotation is a post-transform about the center.
 */
export function generateShapeRing(params: ShapeParams, imgW: number, imgH: number): Vec2Px[] {
  const cx = imgW / 2, cy = imgH / 2
  const S = Math.min(imgW, imgH) * 0.7
  const h = S / 2
  const rot = params.rotateDeg ?? 0
  const p01 = (v: number | undefined, dflt: number) => Math.max(0, Math.min(1, (v ?? dflt) / 100))
  let ring: Vec2Px[]
  switch (params.kind) {
    case 'pinched': ring = rotate(scaleNorm(formRing(4, 0.55), h, h), 45); break // the LOEWE preset — lobes at the corners
    case 'daisy': ring = scaleNorm(daisyRing(Math.max(5, Math.min(12, params.petals ?? 8)), p01(params.depth, 55)), h, h); break
    case 'heart': ring = heartRing(S, S); break
    case 'bolt': ring = scaleNorm(BOLT, h, h); break
    case 'sparkle': ring = scaleNorm(sparkleRing(), h, h); break
    case 'teardrop': ring = scaleNorm(teardropRing(), h * 0.8, h); break
    case 'leaf': ring = scaleNorm(leafRing(), h, h); break
    case 'lens': ring = scaleNorm(lensRing(), h, h * 0.62); break
    case 'diamond': ring = scaleNorm(DIAMOND, h, h); break
    case 'plus': ring = scaleNorm(PLUS, h, h); break
    case 'asterisk': ring = scaleNorm(asteriskRing(), h, h); break
    case 'bowtie': ring = scaleNorm(bowtieRing(), h, h * 0.9); break
    case 'pinwheel': ring = scaleNorm(pinwheelRing(Math.max(3, Math.min(8, params.blades ?? 5)), p01(params.swirl, 50)), h, h); break
    case 'pebble': ring = scaleNorm(blobRing(7, 0.3), h, h * 0.92); break
    case 'circle': ring = ellipseRing(h, h); break
    case 'square': ring = [[-h, -h], [h, -h], [h, h], [-h, h]]; break
    case 'squircle': ring = superellipse(h, h, 5); break
    case 'polygon': ring = regularPolygon(Math.max(3, Math.min(12, params.sides ?? 6)), h, h); break
    case 'star': ring = starRing(Math.max(3, Math.min(12, params.points ?? 5)), h, Math.max(0.05, Math.min(0.95, (params.spikiness ?? 45) / 100))); break
    case 'form': ring = scaleNorm(formRing(params.lobes ?? 4, p01(params.pinch, 50)), h, h); break
    case 'blob': ring = scaleNorm(blobRing(params.seed ?? 1, p01(params.waviness, 50)), h, h); break
    default: ring = ellipseRing(h, h)
  }
  return translate(rotate(ring, rot), cx, cy)
}

/** Uniform arc-length resample of a closed ring — evenly spaced points at ~`spacingPx` so curves
 *  render vector-true (uneven generator spacing + coarse merging read as wobbly lines). */
export function resampleClosed(pts: Vec2Px[], spacingPx: number): Vec2Px[] {
  const n = pts.length
  if (n < 3 || spacingPx <= 0) return pts
  let perim = 0
  const segLen: number[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    segLen.push(l); perim += l
  }
  const count = Math.max(24, Math.round(perim / spacingPx))
  const step = perim / count
  const out: Vec2Px[] = []
  let seg = 0, into = 0
  for (let k = 0; k < count; k++) {
    const target = k * step
    while (seg < n && into + segLen[seg] < target) { into += segLen[seg]; seg++ }
    const a = pts[seg % n], b = pts[(seg + 1) % n]
    const t = segLen[seg % n] > 0 ? (target - into) / segLen[seg % n] : 0
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return out
}

/** Shapes that expose live parameter controls (tick-bars/steppers) in the sheet. */
export const PARAMETRIC: Record<string, boolean> = {
  polygon: true, star: true, daisy: true, pinwheel: true, form: true, blob: true,
}
