// Magnetic-grid centre evidence — neutral measurements from the cloned Centre ruler.

import type { BBox, CentreMeasurements, Contour, Pt, Rational, SafeMass, SafeSegment } from '../spec'
import { addRational, compareRational, divideRational, multiplyRational, rational, rationalFromNumber, subtractRational } from './exact-real'
import { bbox, edgeDistMM, pointInOuter } from './seat'

/** Point-identity key quantum — 0.01mm hash resolution, not a law value. */
const KEY_QUANTUM_MM = 0.01

const MS_CASES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [], [[3, 0]], [[0, 1]], [[3, 1]],
  [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]],
  [[1, 3]], [[0, 1]], [[0, 3]], [],
]

/**
 * The legal area's separate islands with smooth offset outlines and depth masses. Signed
 * clearance (distance to the cut line minus the spot radius, negative outside) is sampled on
 * a mesh once; islands are its regions above zero, masses its regions above the depth probe,
 * and every outline is the level crossing traced between samples (marching squares with
 * linear interpolation), so drawn edges follow the true offset curves, not mesh cells.
 * Centres are DEEPEST POINTS, so a crescent's centre sits in its arc, never the void.
 * A MEASUREMENT for display and scoring — magnet legality stays the exact per-point test.
 */
export function safeSegments(
  outer: ReadonlyArray<Pt>, spotRadiusMM: number, massDepthMM: number,
  detail: 'full' | 'light' = 'full',
): SafeSegment[] {
  if (outer.length < 3) return []
  // Dense traced outlines are decimated for this measurement — display grain, not legality.
  const MAXV = 800
  const k = Math.max(1, Math.ceil(outer.length / MAXV))
  const ring: Pt[] = []
  for (let i = 0; i < outer.length; i += k) ring.push(outer[i])
  const r = spotRadiusMM
  const signed = (p: Pt): number => {
    const d = edgeDistMM(ring, p)
    return pointInOuter(p, ring) ? d - r : -(d + r)
  }
  const step = 2 // mesh grain, mm
  const bb = bbox(ring)
  // One sample beyond the box on every side so outlines always close.
  const x0 = bb.minX - step, y0 = bb.minY - step
  const nx = Math.max(2, Math.round((bb.maxX - bb.minX) / step) + 3)
  const ny = Math.max(2, Math.round((bb.maxY - bb.minY) / step) + 3)
  const S = new Float64Array(nx * ny)
  for (let iy = 0; iy < ny; iy++)
    for (let ix = 0; ix < nx; ix++)
      S[iy * nx + ix] = signed([x0 + ix * step, y0 + iy * step])

  const key = (p: Pt) => (Math.round(p[0] / KEY_QUANTUM_MM) + ',' + Math.round(p[1] / KEY_QUANTUM_MM))
  const lerp = (pa: Pt, sa: number, pb: Pt, sb: number): Pt => {
    const t = sa / (sa - sb)
    return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]
  }

  /** Pull a ring point onto the exact offset curve (Newton on the signed field), so drawn
   *  outlines follow the true edge offset instead of the mesh's facets. */
  const snapToIso = (p: Pt, thr: number): Pt => {
    let q = p
    for (let it = 0; it < 2; it++) {
      const s = signed(q) - thr
      if (Math.abs(s) < 0.02) break
      const e = 0.5
      const gx = (signed([q[0] + e, q[1]]) - signed([q[0] - e, q[1]])) / (2 * e)
      const gy = (signed([q[0], q[1] + e]) - signed([q[0], q[1] - e])) / (2 * e)
      const g2 = gx * gx + gy * gy
      if (g2 < 1e-9) break
      q = [q[0] - s * gx / g2, q[1] - s * gy / g2]
    }
    return q
  }
  /** One midpoint per edge, then every point snapped to the exact curve. */
  const smoothLoop = (loop: Pt[], thr: number): Pt[] => {
    const dense: Pt[] = []
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length]
      dense.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    }
    return dense.map((p) => snapToIso(p, thr))
  }

  interface LevelItem { areaMM2: number; centreMM: Pt; meanMM: Pt; peakClearMM: number; bbox: BBox; rings: Pt[][]; deepIdx: number }
  /** Regions of S ≥ thr: connectivity, deepest point, bbox and traced outlines. */
  const level = (thr: number): { comp: Int32Array; items: LevelItem[] } => {
    const comp = new Int32Array(nx * ny).fill(-1)
    type Acc = { n: number; sx: number; sy: number; minX: number; minY: number; maxX: number; maxY: number; deepIdx: number; deepS: number }
    const accs: Acc[] = []
    for (let seed = 0; seed < nx * ny; seed++) {
      if (S[seed] < thr || comp[seed] >= 0) continue
      const id = accs.length
      const acc: Acc = { n: 0, sx: 0, sy: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, deepIdx: seed, deepS: -Infinity }
      accs.push(acc)
      const stack = [seed]
      comp[seed] = id
      while (stack.length) {
        const i = stack.pop()!
        const ix = i % nx, iy = (i / nx) | 0
        const px = x0 + ix * step, py = y0 + iy * step
        acc.n++
        acc.sx += px; acc.sy += py
        if (S[i] > acc.deepS) { acc.deepS = S[i]; acc.deepIdx = i }
        if (px < acc.minX) acc.minX = px; if (px > acc.maxX) acc.maxX = px
        if (py < acc.minY) acc.minY = py; if (py > acc.maxY) acc.maxY = py
        for (const j of [i - 1, i + 1, i - nx, i + nx]) {
          if (j < 0 || j >= nx * ny || comp[j] >= 0 || S[j] < thr) continue
          if (Math.abs((j % nx) - ix) > 1) continue // row wrap
          comp[j] = id
          stack.push(j)
        }
      }
    }
    // Level-crossing segments per mesh cell, lerped; chained into closed rings.
    // 'light' skips outlines entirely — scoring needs centres/areas/boxes, only display needs rings.
    const segs: Array<[Pt, Pt]> = []
    if (detail === 'light') {
      const at0 = (i: number): Pt => [x0 + (i % nx) * step, y0 + ((i / nx) | 0) * step]
      return {
        comp,
        items: accs.map((a) => ({
          areaMM2: a.n * step * step,
          centreMM: at0(a.deepIdx),
          meanMM: [a.sx / a.n, a.sy / a.n] as Pt,
          peakClearMM: a.deepS + r + thr,
          bbox: { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY },
          rings: [],
          deepIdx: a.deepIdx,
        })),
      }
    }
    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const i00 = iy * nx + ix, i10 = i00 + 1, i01 = i00 + nx, i11 = i01 + 1
        const s00 = S[i00] - thr, s10 = S[i10] - thr, s01 = S[i01] - thr, s11 = S[i11] - thr
        const m = (s00 >= 0 ? 1 : 0) | (s10 >= 0 ? 2 : 0) | (s11 >= 0 ? 4 : 0) | (s01 >= 0 ? 8 : 0)
        if (m === 0 || m === MS_CASES.length - 1) continue
        const ax = x0 + ix * step, ay = y0 + iy * step
        const P00: Pt = [ax, ay], P10: Pt = [ax + step, ay], P01: Pt = [ax, ay + step], P11: Pt = [ax + step, ay + step]
        // Crossing point on each cell edge: 0=top 1=right 2=bottom 3=left.
        const edge = (e: number): Pt =>
          e === 0 ? lerp(P00, s00, P10, s10)
            : e === 1 ? lerp(P10, s10, P11, s11)
              : e === 2 ? lerp(P01, s01, P11, s11)
                : lerp(P00, s00, P01, s01)
        for (const [ea, eb] of MS_CASES[m]) segs.push([edge(ea), edge(eb)])
      }
    }
    const byEnd = new Map<string, Array<[Pt, Pt]>>()
    for (const s of segs) {
      for (const p of [s[0], s[1]]) {
        const kk = key(p)
        const list = byEnd.get(kk)
        if (list) list.push(s); else byEnd.set(kk, [s])
      }
    }
    const used = new Set<[Pt, Pt]>()
    const loops: Pt[][] = []
    for (const s of segs) {
      if (used.has(s)) continue
      used.add(s)
      const loop: Pt[] = [s[0], s[1]]
      for (; ;) {
        const tail = loop[loop.length - 1]
        const cands = byEnd.get(key(tail)) ?? []
        const next = cands.find((c) => !used.has(c))
        if (!next) break
        used.add(next)
        loop.push(key(next[0]) === key(tail) ? next[1] : next[0])
        if (key(loop[loop.length - 1]) === key(loop[0])) break
      }
      if (loop.length > 3) loops.push(loop)
    }
    // Attach each ring to the region of the nearest qualifying sample.
    const compAt = (p: Pt): number => {
      let best = -1, bd = Infinity
      const ix0 = Math.max(0, Math.min(nx - 1, Math.round((p[0] - x0) / step)))
      const iy0 = Math.max(0, Math.min(ny - 1, Math.round((p[1] - y0) / step)))
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const ix = ix0 + dx, iy = iy0 + dy
        if (ix < 0 || ix >= nx || iy < 0 || iy >= ny) continue
        const i = iy * nx + ix
        if (comp[i] < 0) continue
        const d = (ix * step + x0 - p[0]) ** 2 + (iy * step + y0 - p[1]) ** 2
        if (d < bd) { bd = d; best = comp[i] }
      }
      return best
    }
    const ringsByComp: Pt[][][] = accs.map(() => [])
    for (const loop of loops) {
      const id = compAt(loop[0])
      if (id >= 0) ringsByComp[id].push(smoothLoop(loop, thr))
    }
    const at = (i: number): Pt => [x0 + (i % nx) * step, y0 + ((i / nx) | 0) * step]
    return {
      comp,
      items: accs.map((a, id) => ({
        areaMM2: a.n * step * step,
        centreMM: at(a.deepIdx),
        meanMM: [a.sx / a.n, a.sy / a.n] as Pt,
        peakClearMM: a.deepS + r + thr,
        bbox: { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY },
        rings: ringsByComp[id],
        deepIdx: a.deepIdx,
      })),
    }
  }

  const iso0 = level(0)
  if (!iso0.items.length) return []
  const depthOff = Math.max(0, massDepthMM - r)
  const isoD = depthOff > 0 ? level(depthOff) : iso0
  const massesByIsland: SafeMass[][] = iso0.items.map(() => [])
  for (const m of isoD.items) {
    const islandId = iso0.comp[m.deepIdx]
    if (islandId >= 0) massesByIsland[islandId].push({ areaMM2: m.areaMM2, centreMM: m.centreMM, peakClearMM: m.peakClearMM, bbox: m.bbox, rings: m.rings })
  }
  const out: SafeSegment[] = iso0.items.map((it, id) => ({
    areaMM2: it.areaMM2,
    centreMM: it.centreMM,
    meanMM: it.meanMM,
    peakClearMM: it.peakClearMM,
    bbox: it.bbox,
    rings: it.rings,
    masses: massesByIsland[id].sort((a, b) => a.areaMM2 - b.areaMM2),
  }))
  out.sort((a, b) => a.areaMM2 - b.areaMM2)
  return out
}

/** Area centroid of a polygon (shoelace) — the material's weight centre. */
export function centroidOf(pts: ReadonlyArray<Pt>): Pt {
  let a2 = 0, sx = 0, sy = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cross = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    a2 += cross
    sx += (pts[j][0] + pts[i][0]) * cross
    sy += (pts[j][1] + pts[i][1]) * cross
  }
  if (Math.abs(a2) < 1e-9) {
    let mx = 0, my = 0
    for (const p of pts) { mx += p[0]; my += p[1] }
    return [mx / pts.length, my / pts.length]
  }
  return [sx / (3 * a2), sy / (3 * a2)]
}

/** Neutral measurements consumed by the Centre policy; no mode or governor reaches compute. */
export function measureCentreBranches(
  segments: ReadonlyArray<SafeSegment>, boxCentre: Pt, weightCentre: Pt,
): CentreMeasurements {
  let n = 0, sx = 0, sy = 0
  for (const seg of segments) { n += seg.areaMM2; sx += seg.meanMM[0] * seg.areaMM2; sy += seg.meanMM[1] * seg.areaMM2 }
  const core: Pt = segments.length ? [sx / n, sy / n] : boxCentre
  let deepest = segments[0]
  for (const seg of segments) if (!deepest || seg.peakClearMM > deepest.peakClearMM) deepest = seg
  const masses = segments.flatMap((seg) => (seg.masses.length ? seg.masses : [seg]))
  let top = masses[0]
  for (const mass of masses) if (!top || mass.centreMM[1] > top.centreMM[1]) top = mass
  return {
    box: boxCentre,
    weight: weightCentre,
    core,
    deep: deepest?.centreMM ?? boxCentre,
    masses,
    top: top?.centreMM ?? boxCentre,
  }
}

type ExactCentrePoint = readonly [Rational, Rational]

/** Exact affine coefficient of the bbox centre under uniform physical scaling. */
export function exactBoxTargetCoefficient(contour: Contour): ExactCentrePoint {
  const points = contour.outer.pts.map(([x, y]) => [rationalFromNumber(x), rationalFromNumber(y)] as const)
  let minX = points[0][0], maxX = points[0][0], minY = points[0][1], maxY = points[0][1]
  for (const [x, y] of points) {
    if (compareRational(x, minX) < 0) minX = x
    if (compareRational(x, maxX) > 0) maxX = x
    if (compareRational(y, minY) < 0) minY = y
    if (compareRational(y, maxY) > 0) maxY = y
  }
  return [
    multiplyRational(addRational(minX, maxX), rational(1, 2)),
    multiplyRational(addRational(minY, maxY), rational(1, 2)),
  ]
}

/** Exact affine coefficient of the accepted outer-ring material centroid. */
export function exactWeightTargetCoefficient(contour: Contour): ExactCentrePoint {
  const measureRing = (ring: Contour['outer']): { area2: Rational; sx: Rational; sy: Rational } => {
    const points = ring.pts.map(([x, y]) => [rationalFromNumber(x), rationalFromNumber(y)] as const)
    let area2 = rational(0), sx = rational(0), sy = rational(0)
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
      const a = points[previous], b = points[index]
      const cross = subtractRational(multiplyRational(a[0], b[1]), multiplyRational(b[0], a[1]))
      area2 = addRational(area2, cross)
      sx = addRational(sx, multiplyRational(addRational(a[0], b[0]), cross))
      sy = addRational(sy, multiplyRational(addRational(a[1], b[1]), cross))
    }
    if (compareRational(area2, rational(0)) < 0) {
      return {
        area2: multiplyRational(rational(-1), area2),
        sx: multiplyRational(rational(-1), sx),
        sy: multiplyRational(rational(-1), sy),
      }
    }
    return { area2, sx, sy }
  }
  const outer = measureRing(contour.outer)
  let twiceArea = outer.area2, sx = outer.sx, sy = outer.sy
  for (const hole of contour.holes) {
    const measured = measureRing(hole)
    twiceArea = subtractRational(twiceArea, measured.area2)
    sx = subtractRational(sx, measured.sx)
    sy = subtractRational(sy, measured.sy)
  }
  if (compareRational(twiceArea, rational(0)) <= 0) return exactBoxTargetCoefficient(contour)
  return [
    divideRational(sx, multiplyRational(rational(3), twiceArea)),
    divideRational(sy, multiplyRational(rational(3), twiceArea)),
  ]
}
