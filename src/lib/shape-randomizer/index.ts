// shape-randomizer — one-tap "statement shape" generator (Dan 2026-08-07: surprising, balanced,
// trend-worthy silhouettes; optionally framing the SUBJECT loosely — never tracing it).
// Framework-free, deterministic (same seed = same shape), zero heavy deps. Two owned engines:
// radial perturbation (blob/splat/star/scallop/stamp) and the Gielis superformula
// (squircle/flower). Output: a closed ring of points in normalized 0..1 space — the same
// currency the editor's vector pipeline consumes (finishDrawn-compatible).

export type Family = 'blob' | 'splat' | 'star' | 'scallop' | 'stamp' | 'squircle' | 'flower'
export interface Pt { x: number; y: number }
export interface Subject { cx: number; cy: number; w: number; h: number }
export interface ShapeResult { ring: Pt[]; seed: number; family: Family }

/** Deterministic PRNG (mulberry32) — Math.random/Date are forbidden in this module. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const RING_SAMPLES = 180 // output resolution — the vector pipeline re-fits anyway
const TAU = Math.PI * 2

// ── engine 1: radial perturbation → smooth closed spline (the blobmaker lineage) ──
interface RadialCfg {
  nMin: number; nMax: number        // control-point count range
  irregularity: number              // 0..1 angular jitter
  spikeMin: number; spikeMax: number // radial amplitude range (fraction of radius)
  smooth: boolean                   // catmull-rom through points vs straight edges
  alternate?: number                // star mode: every 2nd point pulled inward by this factor
  outwardOnly?: boolean             // scallop/cloud: bumps only outward from the base circle
}
function radialRing(rand: () => number, cfg: RadialCfg): Pt[] {
  const n = cfg.nMin + Math.floor(rand() * (cfg.nMax - cfg.nMin + 1))
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const baseA = (i / n) * TAU
    const a = baseA + (rand() - 0.5) * cfg.irregularity * (TAU / n)
    let amp = cfg.spikeMin + rand() * (cfg.spikeMax - cfg.spikeMin)
    if (cfg.outwardOnly) amp = Math.abs(amp)
    else amp *= rand() < 0.5 ? -1 : 1
    let r = 0.38 * (1 + amp)
    if (cfg.alternate && i % 2 === 1) r *= cfg.alternate
    pts.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) })
  }
  return cfg.smooth ? catmullRing(pts, RING_SAMPLES) : densify(pts, RING_SAMPLES)
}
/** Closed Catmull-Rom through the control points, sampled to `out` points. */
function catmullRing(p: Pt[], out: number): Pt[] {
  const n = p.length, ring: Pt[] = []
  for (let s = 0; s < out; s++) {
    const f = (s / out) * n
    const i = Math.floor(f), t = f - i
    const p0 = p[(i - 1 + n) % n], p1 = p[i % n], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n]
    const t2 = t * t, t3 = t2 * t
    ring.push({
      x: 0.5 * (2 * p1.x + (p2.x - p0.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * (2 * p1.y + (p2.y - p0.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3),
    })
  }
  return ring
}
/** Straight-edge resampling for sharp families (star, stamp). */
function densify(p: Pt[], out: number): Pt[] {
  const n = p.length, ring: Pt[] = []
  for (let s = 0; s < out; s++) {
    const f = (s / out) * n
    const i = Math.floor(f), t = f - i
    const a = p[i % n], b = p[(i + 1) % n]
    ring.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return ring
}

// ── engine 2: superformula (Gielis) — squircles, flowers ──
interface SuperCfg { m: [number, number]; n1: [number, number]; n2: [number, number]; n3: [number, number] }
function superRing(rand: () => number, cfg: SuperCfg): Pt[] {
  const pick = ([lo, hi]: [number, number]) => lo + rand() * (hi - lo)
  const m = Math.round(pick(cfg.m)), n1 = pick(cfg.n1), n2 = pick(cfg.n2), n3 = pick(cfg.n3)
  const ring: Pt[] = []
  let rMax = 0
  const rs: number[] = []
  for (let s = 0; s < RING_SAMPLES; s++) {
    const a = (s / RING_SAMPLES) * TAU
    const t1 = Math.pow(Math.abs(Math.cos((m * a) / 4)), n2)
    const t2 = Math.pow(Math.abs(Math.sin((m * a) / 4)), n3)
    const r = Math.pow(t1 + t2, -1 / n1)
    rs.push(r); if (r > rMax) rMax = r
  }
  for (let s = 0; s < RING_SAMPLES; s++) {
    const a = (s / RING_SAMPLES) * TAU
    const r = (rs[s] / rMax) * 0.42
    ring.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) })
  }
  return ring
}

// ── curated per-family recipes (the aesthetic ranges — tuned by eye on the bench page) ──
const FAMILIES: Record<Family, (rand: () => number) => Pt[]> = {
  blob:    (r) => radialRing(r, { nMin: 6, nMax: 9, irregularity: 0.7, spikeMin: 0.06, spikeMax: 0.22, smooth: true }),
  splat:   (r) => radialRing(r, { nMin: 14, nMax: 20, irregularity: 0.9, spikeMin: 0.22, spikeMax: 0.55, smooth: true }),
  star:    (r) => radialRing(r, { nMin: 10, nMax: 16, irregularity: 0.15, spikeMin: 0.02, spikeMax: 0.1, smooth: false, alternate: 0.55 + r() * 0.15 }),
  scallop: (r) => radialRing(r, { nMin: 20, nMax: 26, irregularity: 0.08, spikeMin: 0.015, spikeMax: 0.035, smooth: true, alternate: 0.86 }),
  stamp:   (r) => radialRing(r, { nMin: 24, nMax: 32, irregularity: 0.05, spikeMin: 0.05, spikeMax: 0.07, smooth: false, alternate: 0.9 }),
  squircle: (r) => superRing(r, { m: [4, 4], n1: [8, 14], n2: [6, 10], n3: [6, 10] }),
  flower:  (r) => superRing(r, { m: [5, 8], n1: [0.4, 0.9], n2: [0.5, 1.2], n3: [0.5, 1.2] }),
}
export const FAMILY_NAMES = Object.keys(FAMILIES) as Family[]

/** Generate one shape. Deterministic: (family, seed, aspect) fully determine the ring. */
const ENVELOPE_HALF = 0.46 // max half-extent about center — every shape fits the unit box with air
/** Uniform-scale about center so the ring never leaves its unit envelope (spiky families can
 *  otherwise overshoot: base·(1+spikeMax) > 0.5). */
function fitEnvelope(ring: Pt[]): Pt[] {
  let m = 0
  for (const p of ring) m = Math.max(m, Math.abs(p.x - 0.5), Math.abs(p.y - 0.5))
  if (m <= ENVELOPE_HALF) return ring
  const k = ENVELOPE_HALF / m
  return ring.map((p) => ({ x: 0.5 + (p.x - 0.5) * k, y: 0.5 + (p.y - 0.5) * k }))
}

export function randomShape(opts: { family: Family; seed: number; aspect?: number }): ShapeResult {
  const rand = mulberry32(opts.seed)
  let ring = fitEnvelope(FAMILIES[opts.family](rand))
  const aspect = opts.aspect ?? 1
  if (aspect !== 1) {
    // stretch about center toward the subject's proportions (aspect = w/h), keeping the long
    // side at the generated extent so the shape never grows past its unit envelope.
    ring = ring.map((p) => ({
      x: 0.5 + (p.x - 0.5) * Math.min(1, aspect),
      y: 0.5 + (p.y - 0.5) * Math.min(1, 1 / aspect),
    }))
  }
  return { ring, seed: opts.seed, family: opts.family }
}

/** Scale + position a generated ring so the subject box sits inside with ≥ marginFrac slack —
 *  LOOSE containment (the shape frames the object, never traces it). Coordinates: same space
 *  as the subject (image px). */
export function frameSubject(ring: Pt[], subject: Subject, marginFrac: number): Pt[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of ring) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
  const rw = maxX - minX, rh = maxY - minY
  const rcx = (minX + maxX) / 2, rcy = (minY + maxY) / 2
  const needW = subject.w * (1 + 2 * marginFrac), needH = subject.h * (1 + 2 * marginFrac)
  // scale so the ring's INSCRIBED span covers the needed box; rings are ~convex-ish so bbox×0.78
  // is a safe inscribed estimate — the balance gate verifies true containment afterwards.
  const INSCRIBED_EST = 0.78
  const k = Math.max(needW / (rw * INSCRIBED_EST), needH / (rh * INSCRIBED_EST))
  return ring.map((p) => ({ x: subject.cx + (p.x - rcx) * k, y: subject.cy + (p.y - rcy) * k }))
}

/** Point-in-polygon (ray cast). */
export function insideRing(ring: Pt[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

const BALANCE = {
  areaMin: 0.15, areaMax: 0.88,   // of the ring bbox — a circle is ~0.785 and must PASS; slivers fail
  regularityMax: 60,              // perimeter²/area (circle ≈ 12.6; spiky splats live ~35-55)
  centroidOffMax: 0.08,           // |area centroid − bbox center| / bbox size — lopsided shapes fail
}
/** Cheap aesthetic/usability gate: 0..1 (1 = passes every heuristic). With a subject given,
 *  containment of the subject box (corners + edge midpoints) is REQUIRED. */
export function balanceScore(ring: Pt[], subject?: Subject): number {
  let area = 0, perim = 0
  let cx = 0, cy = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    area += a.x * b.y - b.x * a.y
    perim += Math.hypot(b.x - a.x, b.y - a.y)
    cx += a.x; cy += a.y
  }
  area = Math.abs(area) / 2; cx /= ring.length; cy /= ring.length
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of ring) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
  const bboxArea = (maxX - minX) * (maxY - minY)
  if (!(bboxArea > 0) || !(area > 0)) return 0
  const areaFrac = area / bboxArea
  const regularity = (perim * perim) / area
  const size = Math.max(maxX - minX, maxY - minY)
  const centroidOff = Math.hypot(cx - (minX + maxX) / 2, cy - (minY + maxY) / 2) / size
  let score = 1
  if (areaFrac < BALANCE.areaMin || areaFrac > BALANCE.areaMax) score -= 0.5
  if (regularity > BALANCE.regularityMax) score -= 0.3
  if (centroidOff > BALANCE.centroidOffMax) score -= 0.2
  if (subject) {
    const xs = [subject.cx - subject.w / 2, subject.cx, subject.cx + subject.w / 2]
    const ys = [subject.cy - subject.h / 2, subject.cy, subject.cy + subject.h / 2]
    for (const x of xs) for (const y of ys) if (!insideRing(ring, x, y)) return 0 // containment is binary
  }
  return Math.max(0, score)
}

const ROLL_SEED_STRIDE = 0x9e3779b9 // seed hop between attempts — deterministic ladder
/** Roll until the gate passes (deterministic ladder from the base seed). Never returns garbage:
 *  falls back to the best-scoring attempt if none clears minScore. */
export function rollUntilBalanced(
  opts: { family: Family; seed: number; aspect?: number; subject?: Subject; marginFrac?: number },
  minScore = 0.7, maxTries = 12,
): ShapeResult & { score: number } {
  let best: (ShapeResult & { score: number }) | null = null
  for (let i = 0; i < maxTries; i++) {
    const seed = (opts.seed + i * ROLL_SEED_STRIDE) >>> 0
    const s = randomShape({ family: opts.family, seed, aspect: opts.aspect })
    const ring = opts.subject ? frameSubject(s.ring, opts.subject, opts.marginFrac ?? 0.18) : s.ring
    const score = balanceScore(ring, opts.subject)
    const cand = { ring, seed, family: s.family, score }
    if (!best || score > best.score) best = cand
    if (score >= minScore) return cand
  }
  return best!
}
