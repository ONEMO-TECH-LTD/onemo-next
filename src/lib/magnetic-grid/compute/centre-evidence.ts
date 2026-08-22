// Magnetic-grid centre evidence — neutral measurements from the cloned Centre ruler.

import type { BBox, CentreBranchMeasurement, CentreEvidence, CentreMeasurements, Contour, ExactPoint, ExactReal, MassEvidence, Pt, Rational, RegionEvidence, SafeMass, SafeSegment } from '../spec'
import {
  addRational,
  affineExact,
  approximateExact,
  canonicalExact,
  compareExact,
  compareExactToRational,
  compareRational,
  divideRational,
  multiplyRational,
  rational,
  rationalFromNumber,
  signQuadraticAtExact,
  subtractRational,
} from './exact-real'
import { certifySqrtQuadraticExpression, sha256Text } from './identity'
import { bbox, edgeDistMM, measureExactAffineClearance, pointInOuter, type ExactAffinePointInput, type SeatQuadratic } from './seat'

type FrozenMassGovernorEvidence = CentreBranchMeasurement['frozenMasses'][number]

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

export type ExactCentreCoefficient = readonly [Rational, Rational]

/** Exact affine coefficient of the frozen full-outer bbox centre. */
export function exactBoxTargetCoefficient(contour: Contour): ExactCentreCoefficient {
  const points = contour.outer.pts.map(([x, y]) => [rationalFromNumber(x), rationalFromNumber(y)] as const)
  if (!points.length) return [rational(0), rational(0)]
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

/** Exact affine coefficient of frozen `centroidOf(outer)`; supplied holes remain ignored. */
export function exactWeightTargetCoefficient(contour: Contour): ExactCentreCoefficient {
  const points = contour.outer.pts.map(([x, y]) => [rationalFromNumber(x), rationalFromNumber(y)] as const)
  let area2 = rational(0), sx = rational(0), sy = rational(0)
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[previous], b = points[index]
    const cross = addRational(multiplyRational(a[0], b[1]), multiplyRational(rational(-1), multiplyRational(b[0], a[1])))
    area2 = addRational(area2, cross)
    sx = addRational(sx, multiplyRational(addRational(a[0], b[0]), cross))
    sy = addRational(sy, multiplyRational(addRational(a[1], b[1]), cross))
  }
  if (compareRational(area2, rational(0)) === 0) return exactBoxTargetCoefficient(contour)
  return [
    divideRational(sx, multiplyRational(rational(3), area2)),
    divideRational(sy, multiplyRational(rational(3), area2)),
  ]
}

export type FrozenMeshCentreMeasurement =
  | {
      status: 'measured'
      evidence: CentreEvidence
      frozenMasses: readonly FrozenMassGovernorEvidence[]
      affineTargets: readonly { point: ExactPoint; affine: ExactAffinePointInput }[]
      transitionAnchors: readonly { sampleId: number; affine: ExactAffinePointInput }[]
      transitionComparisons: readonly {
        kind: 'DEEPEST' | 'PEAK' | 'TOP' | 'UPPER_HALF'
        leftId: string
        rightId: string
        equation: SeatQuadratic
      }[]
      transitionContour: Contour
    }
  | { status: 'unresolved'; reason: 'CENTRE_EVIDENCE_UNRESOLVED' }

const exactPointFromAffine = (point: ExactAffinePointInput, scale: ExactReal): ExactPoint => {
  const x = affineExact(scale, point.coefficient[0], point.offset[0])
  const y = affineExact(scale, point.coefficient[1], point.offset[1])
  return { x, y, approximateMM: [approximateExact(x), approximateExact(y)] }
}

const exactPointFromCoefficient = (coefficient: ExactCentreCoefficient, scale: ExactReal): ExactPoint =>
  exactPointFromAffine({ coefficient, offset: [rational(0), rational(0)] }, scale)

const compareQuadraticAt = (left: SeatQuadratic, right: SeatQuadratic, scale: ExactReal) =>
  signQuadraticAtExact(
    subtractRational(left[0], right[0]), subtractRational(left[1], right[1]), subtractRational(left[2], right[2]), scale,
  )

const roundedPositiveProduct = (coefficient: Rational, scale: ExactReal): number => {
  if (compareRational(coefficient, rational(0)) <= 0) return 0
  for (let rounded = 0; rounded < 10000; rounded++) {
    const threshold = divideRational(rational(2 * rounded + 1, 2), coefficient)
    if (compareExactToRational(scale, threshold) < 0) return rounded
  }
  throw new RangeError('frozen mesh dimension exceeds admitted field')
}

/** Exact evaluation of the frozen 2mm/800-point Centre ruler at one exact site. */
export function measureFrozenMeshCentreEvidence(
  contour: Contour,
  scale: ExactReal,
  spotRadius: Rational,
  massDepth: Rational,
): FrozenMeshCentreMeasurement {
  if (contour.outer.pts.length < 3) return { status: 'unresolved', reason: 'CENTRE_EVIDENCE_UNRESOLVED' }
  try {
    const stride = Math.max(1, Math.ceil(contour.outer.pts.length / 800))
    const donor: Pt[] = []
    for (let index = 0; index < contour.outer.pts.length; index += stride) donor.push(contour.outer.pts[index])
    const donorContour: Contour = { outer: { pts: donor }, holes: [] }
    const points = donor.map(([x, y]) => [rationalFromNumber(x), rationalFromNumber(y)] as const)
    let minX = points[0][0], maxX = points[0][0], minY = points[0][1], maxY = points[0][1]
    for (const [x, y] of points) {
      if (compareRational(x, minX) < 0) minX = x
      if (compareRational(x, maxX) > 0) maxX = x
      if (compareRational(y, minY) < 0) minY = y
      if (compareRational(y, maxY) > 0) maxY = y
    }
    const nx = Math.max(2, roundedPositiveProduct(multiplyRational(subtractRational(maxX, minX), rational(1, 2)), scale) + 3)
    const ny = Math.max(2, roundedPositiveProduct(multiplyRational(subtractRational(maxY, minY), rational(1, 2)), scale) + 3)
    if (!Number.isInteger(nx) || !Number.isInteger(ny)) return { status: 'unresolved', reason: 'CENTRE_EVIDENCE_UNRESOLVED' }
    const radiusSquared: SeatQuadratic = [rational(0), rational(0), multiplyRational(spotRadius, spotRadius)]
    const depthOffset = compareRational(massDepth, spotRadius) > 0 ? subtractRational(massDepth, spotRadius) : rational(0)
    const depthDistance = addRational(spotRadius, depthOffset)
    const depthSquared: SeatQuadratic = [rational(0), rational(0), multiplyRational(depthDistance, depthDistance)]
    type Sample = { index: number; affine: ExactAffinePointInput; exact: ExactPoint; nearest: SeatQuadratic; legal: boolean; depth: boolean }
    const samples: Sample[] = []
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const affine: ExactAffinePointInput = {
        coefficient: [minX, minY],
        offset: [rational(-2 + ix * 2), rational(-2 + iy * 2)],
      }
      const clearance = measureExactAffineClearance(donorContour, affine, scale)
      samples.push({
        index: iy * nx + ix,
        affine,
        exact: exactPointFromAffine(affine, scale),
        nearest: clearance.nearestSquared,
        legal: clearance.inside && compareQuadraticAt(clearance.nearestSquared, radiusSquared, scale) >= 0,
        depth: clearance.inside && compareQuadraticAt(clearance.nearestSquared, depthSquared, scale) >= 0,
      })
    }
    type Component = { sampleIds: number[]; deepest: number }
    const components = (active: (sample: Sample) => boolean): { componentBySample: Int32Array; values: Component[] } => {
      const componentBySample = new Int32Array(samples.length).fill(-1), values: Component[] = []
      for (const seed of samples) {
        if (!active(seed) || componentBySample[seed.index] >= 0) continue
        const id = values.length, stack = [seed.index], sampleIds: number[] = []
        let deepest = seed.index
        componentBySample[seed.index] = id
        while (stack.length) {
          const index = stack.pop()!, ix = index % nx
          sampleIds.push(index)
          if (compareQuadraticAt(samples[index].nearest, samples[deepest].nearest, scale) > 0) deepest = index
          for (const next of [index - 1, index + 1, index - nx, index + nx]) {
            if (next < 0 || next >= samples.length || componentBySample[next] >= 0 || !active(samples[next])) continue
            if (Math.abs((next % nx) - ix) > 1) continue
            componentBySample[next] = id
            stack.push(next)
          }
        }
        values.push({ sampleIds, deepest })
      }
      return { componentBySample, values }
    }
    const legal = components((sample) => sample.legal)
    const depth = compareRational(depthOffset, rational(0)) > 0 ? components((sample) => sample.depth) : legal
    const meanPoint = (component: Component): ExactPoint => {
      let sx = rational(0), sy = rational(0)
      for (const sampleId of component.sampleIds) {
        sx = addRational(sx, samples[sampleId].affine.offset[0])
        sy = addRational(sy, samples[sampleId].affine.offset[1])
      }
      const divisor = rational(component.sampleIds.length)
      return exactPointFromAffine({ coefficient: [minX, minY], offset: [divideRational(sx, divisor), divideRational(sy, divisor)] }, scale)
    }
    const region = (component: Component, threshold: Rational, kind: string): RegionEvidence => {
      const deepest = samples[component.deepest]
      const peakClear = certifySqrtQuadraticExpression(scale, deepest.nearest, multiplyRational(rational(-1), threshold))
      const centres = [deepest.exact]
      const area = rational(component.sampleIds.length * 4)
      const id = sha256Text(JSON.stringify([kind, component.sampleIds, canonicalExact(area), canonicalExact(peakClear)]))
      return { id, centres, area, peakClear, rings: [] }
    }
    const orderedIslands = legal.values.map((component, sourceOrder) => ({ component, sourceOrder }))
      .sort((left, right) => left.component.sampleIds.length - right.component.sampleIds.length || left.sourceOrder - right.sourceOrder)
    const islands = orderedIslands.map(({ component }) => region(component, rational(0), 'island'))
    const islandOrder = new Map(orderedIslands.map(({ sourceOrder }, index) => [sourceOrder, index]))
    const massesByIsland = orderedIslands.map(() => [] as Array<{
      component: Component
      evidence: MassEvidence
      peakOffset: Rational
      sourceOrder: number
    }>)
    for (const component of depth.values) {
      const sourceIsland = legal.componentBySample[component.deepest]
      const island = islandOrder.get(sourceIsland)
      if (island !== undefined) massesByIsland[island].push({
        component,
        evidence: region(component, depthOffset, 'mass'),
        peakOffset: depthOffset,
        sourceOrder: massesByIsland[island].length,
      })
    }
    for (const owned of massesByIsland) {
      owned.sort((left, right) => left.component.sampleIds.length - right.component.sampleIds.length || left.sourceOrder - right.sourceOrder)
    }
    const massRecords = massesByIsland.flatMap((owned, index) => owned.length ? owned : [{
      component: orderedIslands[index].component,
      evidence: islands[index],
      peakOffset: rational(0),
      sourceOrder: 0,
    }])
    const peakOffset = massRecords[0]?.peakOffset ?? rational(0)
    if (massRecords.some((record) => compareRational(record.peakOffset, peakOffset) !== 0)) {
      return { status: 'unresolved', reason: 'CENTRE_EVIDENCE_UNRESOLVED' }
    }
    const masses = massRecords.map(({ evidence }) => evidence)
    const transitionComparisons: Array<{
      kind: 'DEEPEST' | 'PEAK' | 'TOP' | 'UPPER_HALF'
      leftId: string
      rightId: string
      equation: SeatQuadratic
    }> = []
    const difference = (left: SeatQuadratic, right: SeatQuadratic): SeatQuadratic => [
      subtractRational(left[0], right[0]), subtractRational(left[1], right[1]), subtractRational(left[2], right[2]),
    ]
    for (const component of legal.values) {
      const members = new Set(component.sampleIds), pairs = new Set<string>()
      const addDeepestPair = (left: number, right: number) => {
        if (left === right) return
        const a = Math.min(left, right), b = Math.max(left, right), key = `${a}:${b}`
        if (pairs.has(key)) return
        pairs.add(key)
        transitionComparisons.push({
          kind: 'DEEPEST', leftId: `sample:${a}`, rightId: `sample:${b}`,
          equation: difference(samples[a].nearest, samples[b].nearest),
        })
      }
      for (const sampleId of component.sampleIds) {
        for (const neighbour of [sampleId + 1, sampleId + nx]) if (members.has(neighbour)) addDeepestPair(sampleId, neighbour)
      }
      for (const challenger of component.sampleIds) {
        const neighbours = [challenger - 1, challenger + 1, challenger - nx, challenger + nx].filter((id) => members.has(id))
        const localMaximum = neighbours.every((id) => compareQuadraticAt(samples[challenger].nearest, samples[id].nearest, scale) >= 0)
        if (localMaximum) addDeepestPair(component.deepest, challenger)
      }
    }
    if (massRecords.length) {
      let peakIncumbent = massRecords[0], topIncumbent = massRecords[0]
      for (const candidate of massRecords.slice(1)) {
        if (compareQuadraticAt(samples[candidate.component.deepest].nearest, samples[peakIncumbent.component.deepest].nearest, scale) > 0) peakIncumbent = candidate
        if (compareExact(candidate.evidence.centres[0].y, topIncumbent.evidence.centres[0].y) > 0) topIncumbent = candidate
      }
      for (const challenger of massRecords) {
        if (challenger !== peakIncumbent) transitionComparisons.push({
          kind: 'PEAK', leftId: peakIncumbent.evidence.id, rightId: challenger.evidence.id,
          equation: difference(samples[peakIncumbent.component.deepest].nearest, samples[challenger.component.deepest].nearest),
        })
        if (challenger !== topIncumbent) {
          const left = samples[topIncumbent.component.deepest].affine, right = samples[challenger.component.deepest].affine
          transitionComparisons.push({
            kind: 'TOP', leftId: topIncumbent.evidence.id, rightId: challenger.evidence.id,
            equation: [rational(0), subtractRational(left.coefficient[1], right.coefficient[1]), subtractRational(left.offset[1], right.offset[1])],
          })
        }
      }
    }
    const boxCoefficient = exactBoxTargetCoefficient(contour)
    for (const record of massRecords) {
      const centre = samples[record.component.deepest].affine
      transitionComparisons.push({
        kind: 'UPPER_HALF', leftId: record.evidence.id, rightId: 'box-midline',
        equation: [rational(0), subtractRational(centre.coefficient[1], boxCoefficient[1]), centre.offset[1]],
      })
    }
    const box = exactPointFromCoefficient(exactBoxTargetCoefficient(contour), scale)
    const weight = exactPointFromCoefficient(exactWeightTargetCoefficient(contour), scale)
    const affineTargets: Array<{ point: ExactPoint; affine: ExactAffinePointInput }> = [
      { point: box, affine: { coefficient: exactBoxTargetCoefficient(contour), offset: [rational(0), rational(0)] } },
      { point: weight, affine: { coefficient: exactWeightTargetCoefficient(contour), offset: [rational(0), rational(0)] } },
    ]
    for (const component of legal.values) {
      affineTargets.push({ point: samples[component.deepest].exact, affine: samples[component.deepest].affine })
      affineTargets.push({ point: meanPoint(component), affine: {
        coefficient: [minX, minY],
        offset: [
          divideRational(component.sampleIds.reduce((sum, id) => addRational(sum, samples[id].affine.offset[0]), rational(0)), rational(component.sampleIds.length)),
          divideRational(component.sampleIds.reduce((sum, id) => addRational(sum, samples[id].affine.offset[1]), rational(0)), rational(component.sampleIds.length)),
        ],
      } })
    }
    for (const component of depth.values) affineTargets.push({ point: samples[component.deepest].exact, affine: samples[component.deepest].affine })
    if (!islands.length) {
      const evidence = { id: '', box, core: box, weight, deepest: [box], islands: [], masses: [] } satisfies CentreEvidence
      return {
        status: 'measured', evidence: { ...evidence, id: sha256Text(JSON.stringify(evidence)) }, frozenMasses: [], affineTargets,
        transitionAnchors: samples.map((sample) => ({ sampleId: sample.index, affine: sample.affine })),
        transitionComparisons,
        transitionContour: donorContour,
      }
    }
    const allLegalIds = legal.values.flatMap((component) => component.sampleIds)
    const core = meanPoint({ sampleIds: allLegalIds, deepest: legal.values[0].deepest })
    affineTargets.push({ point: core, affine: {
      coefficient: [minX, minY],
      offset: [
        divideRational(allLegalIds.reduce((sum, id) => addRational(sum, samples[id].affine.offset[0]), rational(0)), rational(allLegalIds.length)),
        divideRational(allLegalIds.reduce((sum, id) => addRational(sum, samples[id].affine.offset[1]), rational(0)), rational(allLegalIds.length)),
      ],
    } })
    let deepest = legal.values[0].deepest
    for (const component of legal.values) if (compareQuadraticAt(samples[component.deepest].nearest, samples[deepest].nearest, scale) > 0) deepest = component.deepest
    const rank = (compare: (left: typeof massRecords[number], right: typeof massRecords[number]) => number) => {
      const ordered = massRecords.map((record, stableOrder) => ({ record, stableOrder }))
        .sort((left, right) => compare(left.record, right.record) || left.stableOrder - right.stableOrder)
      return new Map(ordered.map(({ record }, order) => [record, order]))
    }
    const areaOrder = rank((left, right) => left.component.sampleIds.length - right.component.sampleIds.length)
    const peakOrder = rank((left, right) => -compareQuadraticAt(
      samples[left.component.deepest].nearest,
      samples[right.component.deepest].nearest,
      scale,
    ))
    const topOrder = rank((left, right) => -compareExact(left.evidence.centres[0].y, right.evidence.centres[0].y))
    const frozenMasses: FrozenMassGovernorEvidence[] = massRecords.map((record, stableOrder) => {
      const samplePoints = record.component.sampleIds.map((sampleId) => samples[sampleId].exact)
      let bboxMinX = samplePoints[0].x, bboxMaxX = samplePoints[0].x, bboxMinY = samplePoints[0].y, bboxMaxY = samplePoints[0].y
      for (const point of samplePoints.slice(1)) {
        if (compareExact(point.x, bboxMinX) < 0) bboxMinX = point.x
        if (compareExact(point.x, bboxMaxX) > 0) bboxMaxX = point.x
        if (compareExact(point.y, bboxMinY) < 0) bboxMinY = point.y
        if (compareExact(point.y, bboxMaxY) > 0) bboxMaxY = point.y
      }
      return {
        massId: record.evidence.id,
        stableOrder,
        centre: record.evidence.centres[0],
        area: record.evidence.area,
        peakClear: record.evidence.peakClear,
        bbox: { minX: bboxMinX, minY: bboxMinY, maxX: bboxMaxX, maxY: bboxMaxY },
        upperHalf: compareExact(record.evidence.centres[0].y, box.y) >= 0,
        areaOrder: areaOrder.get(record)!,
        peakOrder: peakOrder.get(record)!,
        topOrder: topOrder.get(record)!,
      }
    })
    const evidence = { id: '', box, core, weight, deepest: [samples[deepest].exact], islands, masses } satisfies CentreEvidence
    return {
      status: 'measured', evidence: { ...evidence, id: sha256Text(JSON.stringify(evidence)) }, frozenMasses, affineTargets,
      transitionAnchors: samples.map((sample) => ({ sampleId: sample.index, affine: sample.affine })),
      transitionComparisons,
      transitionContour: donorContour,
    }
  } catch {
    return { status: 'unresolved', reason: 'CENTRE_EVIDENCE_UNRESOLVED' }
  }
}
