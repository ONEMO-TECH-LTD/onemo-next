// Shape generators — REDUCED to the Run-3 PARAMETRIC generators only (vector reset).
//
// Every static preset (pinched, heart, bolt, sparkle, teardrop, leaf, lens, diamond, plus,
// asterisk, bowtie, pebble, circle, square, squircle, polygon, star) now lives in
// `@/lib/shape-library` as PURE VECTOR DATA — authored/baked Bézier anchors, zero runtime
// sampling. The ring generators that built them were DELETED with the migration (vector reset
// Run 2; the corrupted-construction class dies with its code).
//
// What remains here, temporarily, are the four LIVE generators whose output still feeds the
// polyline document — they convert to fit-at-generation vector output in Run 3:
//   • daisy(petals, depth) · pinwheel(blades, swirl) · form(lobes, pinch) · blob(waviness, seed)

import type { Vec2Px } from '@/lib/outline-core'

export type ShapeKind =
  | 'pinched' | 'daisy' | 'heart' | 'bolt' | 'sparkle' | 'teardrop' | 'leaf' | 'lens'
  | 'diamond' | 'plus' | 'asterisk' | 'bowtie' | 'pinwheel' | 'pebble'
  | 'circle' | 'square' | 'squircle' | 'polygon' | 'star'
  | 'form' | 'blob'

export interface ShapeParams {
  kind: ShapeKind
  sides?: number      // polygon: 3..12 (vector construction — shape-library)
  points?: number     // star: 3..12 (vector construction — shape-library)
  spikiness?: number  // star: 0..100 (vector construction — shape-library)
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

/** Re-fit any ring to [-1,1] preserving aspect (so parametric output always fills its box). */
function normalize(pts: Vec2Px[]): Vec2Px[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const k = 2 / Math.max(maxX - minX, maxY - minY, 1e-9)
  return pts.map(([x, y]) => [(x - cx) * k, (y - cy) * k] as Vec2Px)
}

/**
 * The "form" generator's engine — the lobed-clover family (LOEWE language): FAT rounded lobes
 * with pinched valleys, r(φ) = (1−d) + d·|cos(m·φ/2)|^p. `m` = lobe count; `d` (from pinch)
 * = how deep the valleys cut; p<1 keeps the lobes fat instead of pointy.
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

/**
 * Build a LIVE generator's point ring fit to the image (Run-3 kinds only — every static preset
 * spawns from `@/lib/shape-library` as pure vector data and never passes through here).
 */
export function generateShapeRing(params: ShapeParams, imgW: number, imgH: number): Vec2Px[] {
  const cx = imgW / 2, cy = imgH / 2
  const S = Math.min(imgW, imgH) * 0.7
  const h = S / 2
  const rot = params.rotateDeg ?? 0
  const p01 = (v: number | undefined, dflt: number) => Math.max(0, Math.min(1, (v ?? dflt) / 100))
  let ring: Vec2Px[]
  switch (params.kind) {
    case 'daisy': ring = scaleNorm(daisyRing(Math.max(5, Math.min(12, params.petals ?? 8)), p01(params.depth, 55)), h, h); break
    case 'pinwheel': ring = scaleNorm(pinwheelRing(Math.max(3, Math.min(8, params.blades ?? 5)), p01(params.swirl, 50)), h, h); break
    case 'form': ring = scaleNorm(formRing(params.lobes ?? 4, p01(params.pinch, 50)), h, h); break
    case 'blob': ring = scaleNorm(blobRing(params.seed ?? 1, p01(params.waviness, 50)), h, h); break
    default: ring = scaleNorm(blobRing(1, 0.2), h, h) // unreachable for migrated kinds
  }
  return translate(rotate(ring, rot), cx, cy)
}

/** Uniform arc-length resample of a closed ring — evenly spaced points at ~`spacingPx`. */
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
