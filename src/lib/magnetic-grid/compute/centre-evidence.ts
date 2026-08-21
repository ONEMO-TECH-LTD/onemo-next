// Magnetic-grid centre evidence — neutral measurements from the cloned Centre ruler.

import type { BBox, CentreMeasurements, Contour, ExactReal, Pt, Rational, SafeMass, SafeSegment } from '../spec'
import { addRational, affineExact, canonicalExact, compareRational, divideRational, isRational, multiplyRational, rational, rationalFromNumber, sqrtRationalBounds, subtractRational } from './exact-real'
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

export interface ExactOffsetLineFeature {
  kind: 'offset-line'
  id: string
  ring: string
  scale: ExactReal
  a: readonly [ExactReal, ExactReal]
  b: readonly [ExactReal, ExactReal]
  baseA: readonly [Rational, Rational]
  baseB: readonly [Rational, Rational]
  inwardNormalNumerator: readonly [Rational, Rational]
  normalDenominatorSquared: Rational
  clearance: Rational
}

export interface ExactOffsetArcFeature {
  kind: 'offset-arc'
  id: string
  ring: string
  centre: readonly [ExactReal, ExactReal]
  clearance: Rational
  startDirectionNumerator: readonly [Rational, Rational]
  startDenominatorSquared: Rational
  endDirectionNumerator: readonly [Rational, Rational]
  endDenominatorSquared: Rational
  sweep: 'clockwise' | 'counter-clockwise'
  beforeLineId: string
  afterLineId: string
}

export interface ExactOffsetFeatures {
  lines: readonly ExactOffsetLineFeature[]
  arcs: readonly ExactOffsetArcFeature[]
}

const compareExactPointTuple=(a:Pt,b:Pt):number=>{const x=compareRational(rationalFromNumber(a[0]),rationalFromNumber(b[0]));return x||compareRational(rationalFromNumber(a[1]),rationalFromNumber(b[1]))}
const compareExactPointSequence=(a:readonly Pt[],b:readonly Pt[]):number=>{for(let index=0;index<Math.min(a.length,b.length);index++){const compared=compareExactPointTuple(a[index],b[index]);if(compared)return compared}return a.length-b.length}
const normalizeExactRing=(ring:Contour['outer'],role:'outer'|'hole'):Contour['outer']=>{let points=[...ring.pts];let area=rational(0);for(let i=0,j=points.length-1;i<points.length;j=i++)area=addRational(area,subtractRational(multiplyRational(rationalFromNumber(points[j][0]),rationalFromNumber(points[i][1])),multiplyRational(rationalFromNumber(points[i][0]),rationalFromNumber(points[j][1]))));const desired=role==='outer'?1:-1;if(compareRational(area,rational(0))!==desired)points=points.reverse();let best=points;for(let start=1;start<points.length;start++){const candidate=[...points.slice(start),...points.slice(0,start)];if(compareExactPointSequence(candidate,best)<0)best=candidate}return{pts:best}}

interface RadicalTerm { coefficient: Rational; radicand: Rational }
export interface ExactAffineRadical {
  scale: ExactReal
  scaleCoefficient: Rational
  constant: Rational
  radicals: readonly RadicalTerm[]
}
export interface ExactOffsetIntersection {
  kind: 'line-line' | 'line-circle' | 'circle-circle'
  featureIds: readonly [string, string]
  point: readonly [ExactOffsetExpression, ExactOffsetExpression]
}
export interface ExactOffsetUnresolved { featureIds: readonly string[]; reason: 'EXACT_PREDICATE_UNRESOLVED' }
export interface ExactOffsetIntersectionResult { intersections: readonly ExactOffsetIntersection[]; unresolved: readonly ExactOffsetUnresolved[] }
export type ExactOffsetExpression =
  | { op: 'exact'; value: ExactReal }
  | { op: 'add' | 'subtract' | 'multiply' | 'divide'; left: ExactOffsetExpression; right: ExactOffsetExpression }
  | { op: 'sqrt'; value: ExactOffsetExpression }
export interface ExactOffsetUnresolved { featureIds: readonly string[]; reason: 'EXACT_PREDICATE_UNRESOLVED' }


/** Exact analytic primitives whose arrangement defines one inward material offset. */
export function buildExactOffsetFeatures(
  contour: Contour,
  scale: ExactReal,
  clearance: Rational,
): ExactOffsetFeatures {
  const lines: ExactOffsetLineFeature[] = []
  const arcs: ExactOffsetArcFeature[] = []
  const outer=normalizeExactRing(contour.outer,'outer'),holes=contour.holes.map(hole=>normalizeExactRing(hole,'hole')).sort((a,b)=>compareExactPointSequence(a.pts,b.pts)),occurrences=new Map<string,number>()
  const rings=[{ring:outer,role:'outer' as const,occurrence:0},...holes.map(ring=>{const content=JSON.stringify(ring.pts.map(([x,y])=>[canonicalExact(rationalFromNumber(x)),canonicalExact(rationalFromNumber(y))])),occurrence=occurrences.get(content)??0;occurrences.set(content,occurrence+1);return{ring,role:'hole' as const,occurrence}})]
  rings.forEach(({ring,role,occurrence}) => {
    const ringContent=ring.pts.map(([x,y])=>[canonicalExact(rationalFromNumber(x)),canonicalExact(rationalFromNumber(y))])
    const ringId = `${role}:${JSON.stringify(ringContent)}:${occurrence}`
    const points = ring.pts.map(([x, y]) => [rationalFromNumber(x), rationalFromNumber(y)] as const)
    let area2 = rational(0)
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
      area2 = addRational(area2, subtractRational(
        multiplyRational(points[previous][0], points[index][1]),
        multiplyRational(points[index][0], points[previous][1]),
      ))
    }
    const orientation = compareRational(area2, rational(0)) >= 0 ? 1 : -1
    const materialSide = role === 'outer' ? orientation : -orientation
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
      const a = points[previous], b = points[index]
      const dx = subtractRational(b[0], a[0]), dy = subtractRational(b[1], a[1])
      const normal: readonly [Rational, Rational] = materialSide > 0
        ? [multiplyRational(rational(-1), dy), dx]
        : [dy, multiplyRational(rational(-1), dx)]
      lines.push({
        kind: 'offset-line', id: `${ringId}:line:${index}`, ring: ringId, scale,
        a: [affineExact(scale, a[0], rational(0)), affineExact(scale, a[1], rational(0))],
        b: [affineExact(scale, b[0], rational(0)), affineExact(scale, b[1], rational(0))],
        baseA: a,
        baseB: b,
        inwardNormalNumerator: normal,
        normalDenominatorSquared: addRational(multiplyRational(dx, dx), multiplyRational(dy, dy)),
        clearance,
      })
    }
    for (let index = 0; index < points.length; index++) {
      const previous = points[(index + points.length - 1) % points.length]
      const point = points[index], next = points[(index + 1) % points.length]
      const before = [subtractRational(point[0], previous[0]), subtractRational(point[1], previous[1])] as const
      const after = [subtractRational(next[0], point[0]), subtractRational(next[1], point[1])] as const
      const turn = subtractRational(multiplyRational(before[0], after[1]), multiplyRational(before[1], after[0]))
      const reflex = compareRational(turn, rational(0)) * materialSide < 0
      if (!reflex) continue
      const beforeNormal: readonly [Rational, Rational] = materialSide > 0
        ? [multiplyRational(rational(-1), before[1]), before[0]]
        : [before[1], multiplyRational(rational(-1), before[0])]
      const afterNormal: readonly [Rational, Rational] = materialSide > 0
        ? [multiplyRational(rational(-1), after[1]), after[0]]
        : [after[1], multiplyRational(rational(-1), after[0])]
      arcs.push({
        kind: 'offset-arc', id: `${ringId}:arc:${index}`, ring: ringId,
        centre: [affineExact(scale, point[0], rational(0)), affineExact(scale, point[1], rational(0))],
        clearance,
        startDirectionNumerator: beforeNormal,
        startDenominatorSquared: addRational(multiplyRational(before[0], before[0]), multiplyRational(before[1], before[1])),
        endDirectionNumerator: afterNormal,
        endDenominatorSquared: addRational(multiplyRational(after[0], after[0]), multiplyRational(after[1], after[1])),
        sweep: materialSide > 0 ? 'clockwise' : 'counter-clockwise',
        beforeLineId: `${ringId}:line:${index}`,
        afterLineId: `${ringId}:line:${(index + 1) % points.length}`,
      })
    }
  })
  return { lines, arcs }
}

const lineRightSide = (line: ExactOffsetLineFeature): ExactAffineRadical => ({
  scale: line.scale,
  scaleCoefficient: addRational(
    multiplyRational(line.inwardNormalNumerator[0], line.baseA[0]),
    multiplyRational(line.inwardNormalNumerator[1], line.baseA[1]),
  ),
  constant: rational(0),
  radicals: [{ coefficient: line.clearance, radicand: line.normalDenominatorSquared }],
})

const scaleAffineRadical = (value: ExactAffineRadical, factor: Rational): ExactAffineRadical => ({
  ...value,
  scaleCoefficient: multiplyRational(value.scaleCoefficient, factor),
  constant: multiplyRational(value.constant, factor),
  radicals: value.radicals.map((term) => ({ ...term, coefficient: multiplyRational(term.coefficient, factor) })),
})

const addAffineRadical = (left: ExactAffineRadical, right: ExactAffineRadical): ExactAffineRadical => ({
  scale: left.scale,
  scaleCoefficient: addRational(left.scaleCoefficient, right.scaleCoefficient),
  constant: addRational(left.constant, right.constant),
  radicals: [...left.radicals, ...right.radicals],
})

export function evaluateAffineRadicalBounds(value: ExactAffineRadical, bits = 192): readonly [Rational, Rational] {
  const scaleBounds = isRational(value.scale) ? [value.scale, value.scale] as const : value.scale.isolating
  const scaleProducts = scaleBounds.map((bound) => multiplyRational(value.scaleCoefficient, bound)) as [Rational, Rational]
  let lo = compareRational(scaleProducts[0], scaleProducts[1]) <= 0 ? scaleProducts[0] : scaleProducts[1]
  let hi = compareRational(scaleProducts[0], scaleProducts[1]) >= 0 ? scaleProducts[0] : scaleProducts[1]
  lo = addRational(lo, value.constant); hi = addRational(hi, value.constant)
  for (const term of value.radicals) {
    const root = sqrtRationalBounds(term.radicand, bits)
    const products = root.map((bound) => multiplyRational(term.coefficient, bound)) as [Rational, Rational]
    lo = addRational(lo, compareRational(products[0], products[1]) <= 0 ? products[0] : products[1])
    hi = addRational(hi, compareRational(products[0], products[1]) >= 0 ? products[0] : products[1])
  }
  return [lo, hi]
}

const exactExpression = (value: ExactReal): ExactOffsetExpression => ({ op: 'exact', value })
const binaryExpression = (op: 'add'|'subtract'|'multiply'|'divide', left: ExactOffsetExpression, right: ExactOffsetExpression): ExactOffsetExpression => ({ op, left, right })
const sqrtExpression = (value: ExactOffsetExpression): ExactOffsetExpression => ({ op: 'sqrt', value })
const affineRadicalExpression = (value: ExactAffineRadical): ExactOffsetExpression => {
  let out = binaryExpression('add', binaryExpression('multiply', exactExpression(value.scale), exactExpression(value.scaleCoefficient)), exactExpression(value.constant))
  for (const term of value.radicals) out = binaryExpression('add', out, binaryExpression('multiply', exactExpression(term.coefficient), sqrtExpression(exactExpression(term.radicand))))
  return out
}
const canonicalOffsetExpression = (value: ExactOffsetExpression): string => {
  if (value.op === 'exact') return `e:${canonicalExact(value.value)}`
  if (value.op === 'sqrt') return `s(${canonicalOffsetExpression(value.value)})`
  if (value.op === 'subtract' && canonicalOffsetExpression(value.left) === canonicalOffsetExpression(value.right)) return `e:${canonicalExact(rational(0))}`
  if (value.op === 'add' || value.op === 'multiply') {
    const collect = (node: ExactOffsetExpression): string[] => node.op === value.op ? [...collect(node.left), ...collect(node.right)] : [canonicalOffsetExpression(node)]
    return `${value.op}(${collect(value).sort().join('|')})`
  }
  return `${value.op}(${canonicalOffsetExpression(value.left)},${canonicalOffsetExpression(value.right)})`
}
export function evaluateOffsetExpressionBounds(value: ExactOffsetExpression, bits=192): readonly [Rational,Rational] {
  if (value.op === 'exact') return isRational(value.value) ? [value.value,value.value] : value.value.isolating
  if (value.op === 'sqrt') { const x=evaluateOffsetExpressionBounds(value.value,bits); if(compareRational(x[0],rational(0))<0)throw new RangeError('negative'); return [sqrtRationalBounds(x[0],bits)[0],sqrtRationalBounds(x[1],bits)[1]] }
  const a=evaluateOffsetExpressionBounds(value.left,bits),b=evaluateOffsetExpressionBounds(value.right,bits)
  if(value.op==='add')return[addRational(a[0],b[0]),addRational(a[1],b[1])]
  if(value.op==='subtract')return[subtractRational(a[0],b[1]),subtractRational(a[1],b[0])]
  const terms=value.op==='multiply'?[multiplyRational(a[0],b[0]),multiplyRational(a[0],b[1]),multiplyRational(a[1],b[0]),multiplyRational(a[1],b[1])]:[divideRational(a[0],b[0]),divideRational(a[0],b[1]),divideRational(a[1],b[0]),divideRational(a[1],b[1])]
  if(value.op==='divide'&&compareRational(b[0],rational(0))<=0&&compareRational(b[1],rational(0))>=0)throw new RangeError('zero')
  return[terms.reduce((x,y)=>compareRational(y,x)<0?y:x),terms.reduce((x,y)=>compareRational(y,x)>0?y:x)]
}
export function compareOffsetExpressions(a:ExactOffsetExpression,b:ExactOffsetExpression):-1|0|1|null{
  if(canonicalOffsetExpression(a)===canonicalOffsetExpression(b))return 0
  let previous=''
  for(let bits=64;;bits*=2){let x,y;try{x=evaluateOffsetExpressionBounds(a,bits);y=evaluateOffsetExpressionBounds(b,bits)}catch{return null}if(compareRational(x[1],y[0])<0)return-1;if(compareRational(x[0],y[1])>0)return 1;if(compareRational(x[0],x[1])===0&&compareRational(y[0],y[1])===0&&compareRational(x[0],y[0])===0)return 0;const state=JSON.stringify([x,y]);if(state===previous)return null;previous=state}
}

const re=(value:Rational)=>exactExpression(value)
const mul=(value:ExactOffsetExpression,factor:Rational)=>binaryExpression('multiply',value,re(factor))
const addE=(a:ExactOffsetExpression,b:ExactOffsetExpression)=>binaryExpression('add',a,b)
const subE=(a:ExactOffsetExpression,b:ExactOffsetExpression)=>binaryExpression('subtract',a,b)
const divE=(a:ExactOffsetExpression,b:ExactOffsetExpression)=>binaryExpression('divide',a,b)
const lineEndpoint=(line:ExactOffsetLineFeature,base:readonly[Rational,Rational])=>{const length=sqrtExpression(re(line.normalDenominatorSquared));return[0,1].map(axis=>addE(mul(exactExpression(line.scale),base[axis]),divE(re(multiplyRational(line.inwardNormalNumerator[axis],line.clearance)),length)))as unknown as readonly[ExactOffsetExpression,ExactOffsetExpression]}
const lineSpan=(point:ExactOffsetIntersection['point'],line:ExactOffsetLineFeature):boolean|null=>{const a=lineEndpoint(line,line.baseA),b=lineEndpoint(line,line.baseB);const dx=subtractRational(line.baseB[0],line.baseA[0]),dy=subtractRational(line.baseB[1],line.baseA[1]);const axis=compareRational(multiplyRational(dx,dx),multiplyRational(dy,dy))>=0?0:1;const order=compareOffsetExpressions(a[axis],b[axis]);if(order===null)return null;const lo=order<=0?a[axis]:b[axis],hi=order<=0?b[axis]:a[axis];const l=compareOffsetExpressions(point[axis],lo),h=compareOffsetExpressions(point[axis],hi);return l===null||h===null?null:l>=0&&h<=0}
const crossDir=(d:readonly[Rational,Rational],v:ExactOffsetIntersection['point'])=>subE(mul(v[1],d[0]),mul(v[0],d[1]))
const arcSweep=(point:ExactOffsetIntersection['point'],arc:ExactOffsetArcFeature):boolean|null=>{const v=[subE(point[0],exactExpression(arc.centre[0])),subE(point[1],exactExpression(arc.centre[1]))]as const;const z=re(rational(0));const a=compareOffsetExpressions(crossDir(arc.startDirectionNumerator,v),z),raw=compareOffsetExpressions(crossDir(arc.endDirectionNumerator,v),z);if(a===null||raw===null)return null;const b=-raw;const se=compareRational(subtractRational(multiplyRational(arc.startDirectionNumerator[0],arc.endDirectionNumerator[1]),multiplyRational(arc.startDirectionNumerator[1],arc.endDirectionNumerator[0])),rational(0));return arc.sweep==='counter-clockwise'?(se>=0?a>=0&&b>=0:a>=0||b>=0):(se<=0?a<=0&&b<=0:a<=0||b<=0)}

const lineCircle=(line:ExactOffsetLineFeature,arc:ExactOffsetArcFeature):{points:ExactOffsetIntersection['point'][];unresolved:boolean}=>{if(arc.beforeLineId===line.id||arc.afterLineId===line.id){const length=sqrtExpression(re(line.normalDenominatorSquared)),centre=[exactExpression(arc.centre[0]),exactExpression(arc.centre[1])]as const;return{points:[[0,1].map(axis=>addE(centre[axis],divE(re(multiplyRational(line.inwardNormalNumerator[axis],line.clearance)),length)))as unknown as ExactOffsetIntersection['point']],unresolved:false}}const rhs=affineRadicalExpression(lineRightSide(line)),centre=[exactExpression(arc.centre[0]),exactExpression(arc.centre[1])]as const,n=line.inwardNormalNumerator,l2=re(line.normalDenominatorSquared),signed=subE(rhs,addE(mul(centre[0],n[0]),mul(centre[1],n[1]))),foot=[0,1].map(axis=>addE(centre[axis],divE(mul(signed,n[axis]),l2)))as unknown as ExactOffsetIntersection['point'],remain=subE(re(multiplyRational(arc.clearance,arc.clearance)),divE(binaryExpression('multiply',signed,signed),l2)),sign=compareOffsetExpressions(remain,re(rational(0)));if(sign===null)return{points:[],unresolved:true};if(sign<0)return{points:[],unresolved:false};const along=sqrtExpression(remain),length=sqrtExpression(l2),t=[divE(mul(along,multiplyRational(rational(-1),n[1])),length),divE(mul(along,n[0]),length)]as const;let unresolved=false;const points=[1,-1].map(s=>[addE(foot[0],mul(t[0],rational(s))),addE(foot[1],mul(t[1],rational(s)))]as const).filter(p=>{const span=lineSpan(p,line),sweep=arcSweep(p,arc);if(span===null||sweep===null){unresolved=true;return false}return span&&sweep});return{points,unresolved}}

const circleCircle=(a:ExactOffsetArcFeature,b:ExactOffsetArcFeature):{points:ExactOffsetIntersection['point'][];unresolved:boolean}=>{if(compareRational(a.clearance,b.clearance)!==0)return{points:[],unresolved:false};const ac=[exactExpression(a.centre[0]),exactExpression(a.centre[1])]as const,bc=[exactExpression(b.centre[0]),exactExpression(b.centre[1])]as const,d=[subE(bc[0],ac[0]),subE(bc[1],ac[1])]as const,d2=addE(binaryExpression('multiply',d[0],d[0]),binaryExpression('multiply',d[1],d[1])),dist=sqrtExpression(d2),h2=subE(re(multiplyRational(a.clearance,a.clearance)),divE(d2,re(rational(4)))),sign=compareOffsetExpressions(h2,re(rational(0)));if(sign===null)return{points:[],unresolved:true};if(sign<0)return{points:[],unresolved:false};const mid=[divE(addE(ac[0],bc[0]),re(rational(2))),divE(addE(ac[1],bc[1]),re(rational(2)))]as const,h=sqrtExpression(h2),off=[divE(binaryExpression('multiply',mul(d[1],rational(-1)),h),dist),divE(binaryExpression('multiply',d[0],h),dist)]as const;let unresolved=false;const points=[1,-1].map(s=>[addE(mid[0],mul(off[0],rational(s))),addE(mid[1],mul(off[1],rational(s)))]as const).filter(p=>{const x=arcSweep(p,a),y=arcSweep(p,b);if(x===null||y===null){unresolved=true;return false}return x&&y});return{points,unresolved}}

export function solveExactOffsetIntersections(features:ExactOffsetFeatures):ExactOffsetIntersectionResult{const intersections=[...solveExactOffsetLineIntersections(features)],unresolved:ExactOffsetUnresolved[]=[];for(const line of features.lines)for(const arc of features.arcs){const solved=lineCircle(line,arc);if(solved.unresolved)unresolved.push({featureIds:[line.id,arc.id],reason:'EXACT_PREDICATE_UNRESOLVED'});for(const point of solved.points)intersections.push({kind:'line-circle',featureIds:[line.id,arc.id],point})}for(let i=0;i<features.arcs.length;i++)for(let j=i+1;j<features.arcs.length;j++){const solved=circleCircle(features.arcs[i],features.arcs[j]);if(solved.unresolved)unresolved.push({featureIds:[features.arcs[i].id,features.arcs[j].id],reason:'EXACT_PREDICATE_UNRESOLVED'});for(const point of solved.points)intersections.push({kind:'circle-circle',featureIds:[features.arcs[i].id,features.arcs[j].id],point})}return{intersections,unresolved}}

/** Solved exact line-line vertices of the offset arrangement; parallel pairs are rejected. */
export function solveExactOffsetLineIntersections(features: ExactOffsetFeatures): ExactOffsetIntersection[] {
  const intersections: ExactOffsetIntersection[] = []
  for (let firstIndex = 0; firstIndex < features.lines.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < features.lines.length; secondIndex++) {
      const first = features.lines[firstIndex], second = features.lines[secondIndex]
      const [a, b] = first.inwardNormalNumerator, [c, d] = second.inwardNormalNumerator
      const determinant = subtractRational(multiplyRational(a, d), multiplyRational(b, c))
      if (compareRational(determinant, rational(0)) === 0) continue
      const firstRight = lineRightSide(first), secondRight = lineRightSide(second)
      const x = scaleAffineRadical(addAffineRadical(
        scaleAffineRadical(firstRight, d), scaleAffineRadical(secondRight, multiplyRational(rational(-1), b)),
      ), divideRational(rational(1), determinant))
      const y = scaleAffineRadical(addAffineRadical(
        scaleAffineRadical(secondRight, a), scaleAffineRadical(firstRight, multiplyRational(rational(-1), c)),
      ), divideRational(rational(1), determinant))
      intersections.push({ kind: 'line-line', featureIds: [first.id, second.id], point: [affineRadicalExpression(x), affineRadicalExpression(y)] })
    }
  }
  return intersections
}

export interface ExactOffsetArrangementEdge { featureId: string; from: number; to: number }
export interface ExactOffsetArrangement { vertices: readonly ExactOffsetIntersection['point'][]; edges: readonly ExactOffsetArrangementEdge[]; loops: readonly (readonly number[])[]; unresolved: readonly ExactOffsetUnresolved[] }

const samePoint=(a:ExactOffsetIntersection['point'],b:ExactOffsetIntersection['point']):boolean|null=>{const x=compareOffsetExpressions(a[0],b[0]),y=compareOffsetExpressions(a[1],b[1]);return x===null||y===null?null:x===0&&y===0}
const vectorOrder=(origin:ExactOffsetIntersection['point'],a:ExactOffsetIntersection['point'],b:ExactOffsetIntersection['point']):number|null=>{const av=[subE(a[0],origin[0]),subE(a[1],origin[1])]as const,bv=[subE(b[0],origin[0]),subE(b[1],origin[1])]as const,z=re(rational(0));const half=(v:typeof av)=>{const y=compareOffsetExpressions(v[1],z);if(y===null)return null;if(y!==0)return y>0;const x=compareOffsetExpressions(v[0],z);return x===null?null:x>=0};const ah=half(av),bh=half(bv);if(ah===null||bh===null)return null;if(ah!==bh)return ah?-1:1;const cross=compareOffsetExpressions(subE(binaryExpression('multiply',av[0],bv[1]),binaryExpression('multiply',av[1],bv[0])),z);return cross===null?null:cross>0?-1:cross<0?1:0}

export function buildExactOffsetArrangement(features:ExactOffsetFeatures):ExactOffsetArrangement{
  const solved=solveExactOffsetIntersections(features),unresolved=[...solved.unresolved],accepted:ExactOffsetIntersection[]=[]
  const byLine=new Map(features.lines.map(line=>[line.id,line]))
  for(const item of solved.intersections){if(item.kind!=='line-line'){accepted.push(item);continue}const first=byLine.get(item.featureIds[0])!,second=byLine.get(item.featureIds[1])!;const fi=Number(first.id.split(':').at(-1)),si=Number(second.id.split(':').at(-1)),count=features.lines.filter(x=>x.ring===first.ring).length,adjacent=first.ring===second.ring&&(Math.abs(fi-si)===1||Math.abs(fi-si)===count-1);if(adjacent){accepted.push(item);continue}const a=lineSpan(item.point,first),b=lineSpan(item.point,second);if(a===null||b===null)unresolved.push({featureIds:item.featureIds,reason:'EXACT_PREDICATE_UNRESOLVED'});else if(a&&b)accepted.push(item)}
  const vertices:ExactOffsetIntersection['point'][]=[],refs=new Map<string,number[]>()
  for(const item of accepted){let found=-1,invalid=false;for(let i=0;i<vertices.length;i++){const same=samePoint(item.point,vertices[i]);if(same===null){unresolved.push({featureIds:item.featureIds,reason:'EXACT_PREDICATE_UNRESOLVED'});invalid=true;break}if(same){found=i;break}}if(invalid)continue;if(found<0){found=vertices.length;vertices.push(item.point)}for(const id of item.featureIds){const list=refs.get(id)??[];if(!list.includes(found))list.push(found);refs.set(id,list)}}
  const edges:ExactOffsetArrangementEdge[]=[];const connect=(id:string,indices:number[])=>{for(let i=1;i<indices.length;i++)edges.push({featureId:id,from:indices[i-1],to:indices[i]})}
  for(const line of features.lines){const ids=refs.get(line.id)??[],dx=subtractRational(line.baseB[0],line.baseA[0]),dy=subtractRational(line.baseB[1],line.baseA[1]),axis=compareRational(multiplyRational(dx,dx),multiplyRational(dy,dy))>=0?0:1;let bad=false;ids.sort((a,b)=>{const order=compareOffsetExpressions(vertices[a][axis],vertices[b][axis]);if(order===null)bad=true;return order??0});if(bad)unresolved.push({featureIds:[line.id],reason:'EXACT_PREDICATE_UNRESOLVED'});else connect(line.id,ids)}
  for(const arc of features.arcs){const ids=refs.get(arc.id)??[];let bad=false;ids.sort((a,b)=>{const order=vectorOrder([exactExpression(arc.centre[0]),exactExpression(arc.centre[1])],vertices[a],vertices[b]);if(order===null)bad=true;return arc.sweep==='clockwise'?-(order??0):(order??0)});if(bad)unresolved.push({featureIds:[arc.id],reason:'EXACT_PREDICATE_UNRESOLVED'});else connect(arc.id,ids)}
  const adjacency=new Map<number,number[]>();for(const edge of edges){adjacency.set(edge.from,[...(adjacency.get(edge.from)??[]),edge.to]);adjacency.set(edge.to,[...(adjacency.get(edge.to)??[]),edge.from])}let badOrder=false;for(const[origin,neighbors]of adjacency)neighbors.sort((a,b)=>{const order=vectorOrder(vertices[origin],vertices[a],vertices[b]);if(order===null)badOrder=true;return order??0});if(badOrder)unresolved.push({featureIds:['arrangement:face-order'],reason:'EXACT_PREDICATE_UNRESOLVED'})
  const loops:number[][]=[],used=new Set<string>();if(!badOrder)for(const edge of edges)for(const[start,nextStart]of[[edge.from,edge.to],[edge.to,edge.from]]as const){if(used.has(`${start}:${nextStart}`))continue;const loop=[start];let previous=start,current=nextStart;while(loop.length<=edges.length*2+1){used.add(`${previous}:${current}`);loop.push(current);const neighbors=adjacency.get(current)??[],reverse=neighbors.indexOf(previous);if(reverse<0||!neighbors.length)break;const next=neighbors[(reverse-1+neighbors.length)%neighbors.length];previous=current;current=next;if(previous===start&&current===nextStart){loops.push(loop.slice(0,-1));break}}}
  return{vertices,edges,loops,unresolved}
}

const scaledBasePoint=(point:Pt,scale:ExactReal)=>[mul(exactExpression(scale),rationalFromNumber(point[0])),mul(exactExpression(scale),rationalFromNumber(point[1]))]as const
const expressionDot=(a:readonly[ExactOffsetExpression,ExactOffsetExpression],b:readonly[ExactOffsetExpression,ExactOffsetExpression])=>addE(binaryExpression('multiply',a[0],b[0]),binaryExpression('multiply',a[1],b[1]))
const expressionCross=(a:readonly[ExactOffsetExpression,ExactOffsetExpression],b:readonly[ExactOffsetExpression,ExactOffsetExpression])=>subE(binaryExpression('multiply',a[0],b[1]),binaryExpression('multiply',a[1],b[0]))
const expressionVector=(a:readonly[ExactOffsetExpression,ExactOffsetExpression],b:readonly[ExactOffsetExpression,ExactOffsetExpression])=>[subE(b[0],a[0]),subE(b[1],a[1])]as const

const exactRingLocation=(point:ExactOffsetIntersection['point'],ring:Contour['outer'],scale:ExactReal):'IN'|'OUT'|'ON'|null=>{let winding=0;for(let i=0,j=ring.pts.length-1;i<ring.pts.length;j=i++){const a=scaledBasePoint(ring.pts[j],scale),b=scaledBasePoint(ring.pts[i],scale),ap=expressionVector(a,point),ab=expressionVector(a,b),turn=compareOffsetExpressions(expressionCross(ab,ap),re(rational(0))),ay=compareOffsetExpressions(a[1],point[1]),by=compareOffsetExpressions(b[1],point[1]);if(turn===null||ay===null||by===null)return null;const projection=compareOffsetExpressions(expressionDot(ap,ab),re(rational(0))),length=compareOffsetExpressions(expressionDot(ap,ab),expressionDot(ab,ab));if(projection===null||length===null)return null;if(turn===0&&projection>=0&&length<=0)return'ON';if(ay<=0&&by>0&&turn>0)winding++;else if(ay>0&&by<=0&&turn<0)winding--}return winding===0?'OUT':'IN'}

const exactSegmentDistanceSquared=(point:ExactOffsetIntersection['point'],a:readonly[ExactOffsetExpression,ExactOffsetExpression],b:readonly[ExactOffsetExpression,ExactOffsetExpression]):ExactOffsetExpression|null=>{const ab=expressionVector(a,b),ap=expressionVector(a,point),projection=expressionDot(ap,ab),length=expressionDot(ab,ab),before=compareOffsetExpressions(projection,re(rational(0))),after=compareOffsetExpressions(projection,length);if(before===null||after===null)return null;if(before<=0)return expressionDot(ap,ap);if(after>=0){const bp=expressionVector(b,point);return expressionDot(bp,bp)}return divE(binaryExpression('multiply',expressionCross(ab,ap),expressionCross(ab,ap)),length)}

export function exactMaterialClearance(
  point:ExactOffsetIntersection['point'],contour:Contour,scale:ExactReal,clearance:Rational,
):boolean|null{
  const outer=exactRingLocation(point,contour.outer,scale);if(outer===null)return null;if(outer==='OUT')return false
  for(const hole of contour.holes){const location=exactRingLocation(point,hole,scale);if(location===null)return null;if(location!=='OUT')return false}
  const threshold=re(multiplyRational(clearance,clearance))
  for(const ring of [contour.outer,...contour.holes])for(let i=0,j=ring.pts.length-1;i<ring.pts.length;j=i++){const d=exactSegmentDistanceSquared(point,scaledBasePoint(ring.pts[j],scale),scaledBasePoint(ring.pts[i],scale));if(!d)return null;const comparison=compareOffsetExpressions(d,threshold);if(comparison===null)return null;if(comparison<0)return false}
  return true
}

const midpointPoint=(a:ExactOffsetIntersection['point'],b:ExactOffsetIntersection['point'])=>[
  divE(addE(a[0],b[0]),re(rational(2))),
  divE(addE(a[1],b[1]),re(rational(2))),
]as const

const filterLegalArrangementEdges=(
  arrangement:ExactOffsetArrangement,contour:Contour,scale:ExactReal,clearance:Rational,
):{edges:ExactOffsetArrangementEdge[];unresolved:ExactOffsetUnresolved[]}=>{
  const edges:ExactOffsetArrangementEdge[]=[],unresolved=[...arrangement.unresolved]
  for(const edge of arrangement.edges){const probe=midpointPoint(arrangement.vertices[edge.from],arrangement.vertices[edge.to]),legal=exactMaterialClearance(probe,contour,scale,clearance);if(legal===null)unresolved.push({featureIds:[edge.featureId],reason:'EXACT_PREDICATE_UNRESOLVED'});else if(legal)edges.push(edge)}
  return{edges,unresolved}
}
