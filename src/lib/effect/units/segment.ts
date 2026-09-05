// units/segment.ts — SEGMENT: the legal magnet-centre area, measured.
//
// Moved from grid-magnet-compute.ts byte-identical (S2 step 2). It stands on foundation, not on
// the file it left — the first attempt imported back into compute and made a cycle.

import type { BBox, Contour, Pt, SafeMass, SafeSegment } from '../types'
import { bbox, edgeDistToContourMM, pointInContour } from '../foundation/geometry'
import { insetOffsetPath, pathFromRingFit, type OutlinePath } from '../foundation/path'

/** How closely a drawn edge sample sits on the exact clearance curve, and how closely the curve fitted
 *  through those samples must follow them — both far inside the 0.05mm manufacturing tolerance. */
const ISO_SNAP_MM = 0.002
const ISO_FIT_MM = 0.01

/** Point-identity key quantum — 0.01mm hash resolution, not a law value. */
const KEY_QUANTUM_MM = 0.01

/** Marching-squares topology: per corner-sign mask (array position), the cell-edge pairs a
 *  contour crosses. Edges 0=top 1=right 2=bottom 3=left. */
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
  contour: Contour, spotRadiusMM: number,
  detail: 'full' | 'light' = 'full',
): SafeSegment[] {
  if (contour.outer.pts.length < 3) return []
  // Dense traced outlines are decimated for this measurement — display grain, not legality.
  const MAXV = 800
  const decimate = (pts: ReadonlyArray<Pt>): Pt[] => {
    const k = Math.max(1, Math.ceil(pts.length / MAXV))
    const out: Pt[] = []
    for (let i = 0; i < pts.length; i += k) out.push(pts[i])
    return out
  }
  const ring = decimate(contour.outer.pts)
  // A supplied hole is a MATERIAL BOUNDARY: the legal area must stop at its edge exactly as it
  // stops at the outline. Measuring the outer ring alone put legal-area centres inside holes.
  //
  // WHERE THE OUTLINE IS A PATH, IT IS MEASURED AS ONE. The decimation is a cost control for a ring
  // born as thousands of traced points, and it moves the edge by up to 0.03mm — which the drawn
  // island curve then sat on exactly, being a faithful curve through a slightly wrong field. A path
  // costs nothing to keep here (its rings carry their own curves) and the field becomes the true one.
  const measured: Contour = contour.outer.path
    ? { outer: contour.outer, holes: contour.holes.map((h) => (h.path ? h : { pts: decimate(h.pts) })) }
    : { outer: { pts: ring }, holes: contour.holes.map((h) => ({ pts: decimate(h.pts) })) }
  const r = spotRadiusMM
  const signed = (p: Pt): number => {
    const d = edgeDistToContourMM(measured, p)
    return pointInContour(p, measured) ? d - r : -(d + r)
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
    // The field's gradient is a UNIT vector away from the nearest edge point, so the step is the
    // shortfall itself. It was read from a half-millimetre finite difference, which near any curved
    // edge is an average over that half millimetre, not the gradient — and two steps of it left the
    // samples ~0.015mm off the true edge, which the drawn curve then inherited exactly. A tenth of
    // that span, and enough steps to converge, put them on it.
    const e = 0.05
    for (let it = 0; it < 8; it++) {
      const s = signed(q) - thr
      if (Math.abs(s) < ISO_SNAP_MM) break
      const gx = (signed([q[0] + e, q[1]]) - signed([q[0] - e, q[1]])) / (2 * e)
      const gy = (signed([q[0], q[1] + e]) - signed([q[0], q[1] - e])) / (2 * e)
      const g2 = gx * gx + gy * gy
      if (g2 < 1e-9) break
      q = [q[0] - s * gx / g2, q[1] - s * gy / g2]
    }
    return q
  }
  /** Three points inserted per mesh edge (samples every ~0.5mm), then every point snapped to the
   *  exact curve — the samples the drawn curve is fitted through. */
  const smoothLoop = (loop: Pt[], thr: number): Pt[] => {
    const dense: Pt[] = []
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length]
      for (let k = 0; k < 4; k++) dense.push([a[0] + (b[0] - a[0]) * k / 4, a[1] + (b[1] - a[1]) * k / 4])
    }
    return dense.map((p) => snapToIso(p, thr))
  }
  /** The drawn outline: a smooth curve through the snapped samples, never the chords between them.
   *
   *  The one place it is not exact is a RIDGE of the clearance field — where the legal area comes to a
   *  point because two parts of the cut line are equally near, as at a heart's notch. The field has no
   *  gradient to snap along there, so the samples straddle the point and the curve rounds it by up to
   *  0.04mm at a 160mm shape. That is under the manufacturing tolerance, it is display only — the
   *  measurement is the mesh, unchanged — and it is a rounded tip, never a facet. */
  const curvesOf = (rings: Pt[][]): OutlinePath[] => rings.map((ring) => pathFromRingFit(ring, ISO_FIT_MM))

  interface LevelItem { areaMM2: number; centreMM: Pt; meanMM: Pt; peakClearMM: number; bbox: BBox; rings: Pt[][]; paths: OutlinePath[]; deepIdx: number }
  /** Regions of S ≥ thr: connectivity, deepest point, bbox and traced outlines. */
  const level = (thr: number): { comp: Int32Array; items: LevelItem[] } => {
    const comp = new Int32Array(nx * ny).fill(-1)
    type Acc = { n: number; sx: number; sy: number; minX: number; minY: number; maxX: number; maxY: number; deepIdx: number; deepS: number; deepTies: number[] }
    const accs: Acc[] = []
    for (let seed = 0; seed < nx * ny; seed++) {
      if (S[seed] < thr || comp[seed] >= 0) continue
      const id = accs.length
      const acc: Acc = { n: 0, sx: 0, sy: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, deepIdx: seed, deepS: -Infinity, deepTies: [] }
      accs.push(acc)
      const stack = [seed]
      comp[seed] = id
      while (stack.length) {
        const i = stack.pop()!
        const ix = i % nx, iy = (i / nx) | 0
        const px = x0 + ix * step, py = y0 + iy * step
        acc.n++
        acc.sx += px; acc.sy += py
        if (S[i] > acc.deepS) { acc.deepS = S[i]; acc.deepIdx = i; acc.deepTies = [i] }
        else if (S[i] === acc.deepS) acc.deepTies.push(i)
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
    const at = (i: number): Pt => [x0 + (i % nx) * step, y0 + ((i / nx) | 0) * step]
    /** Keep the deepest clearance; resolve only equal-depth samples toward the component mean. */
    const deepCentre = (a: Acc, id: number): Pt => {
      const mean: Pt = [a.sx / a.n, a.sy / a.n]
      const ix = Math.max(0, Math.min(nx - 1, Math.round((mean[0] - x0) / step)))
      const iy = Math.max(0, Math.min(ny - 1, Math.round((mean[1] - y0) / step)))
      if (comp[iy * nx + ix] === id && signed(mean) >= a.deepS) return mean
      let best = a.deepTies[0]
      let bestD = Infinity
      for (const i of a.deepTies) {
        const p = at(i)
        const d = (p[0] - mean[0]) ** 2 + (p[1] - mean[1]) ** 2
        if (d < bestD) { best = i; bestD = d }
      }
      return at(best)
    }
    // Level-crossing segments per mesh cell, lerped; chained into closed rings.
    // 'light' skips outlines entirely — scoring needs centres/areas/boxes, only display needs rings.
    const segs: Array<[Pt, Pt]> = []
    if (detail === 'light') {
      return {
        comp,
        items: accs.map((a, id) => ({
          areaMM2: a.n * step * step,
          centreMM: deepCentre(a, id),
          meanMM: [a.sx / a.n, a.sy / a.n] as Pt,
          peakClearMM: a.deepS + r + thr,
          bbox: { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY },
          rings: [],
          paths: [],
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
    return {
      comp,
      items: accs.map((a, id) => ({
        areaMM2: a.n * step * step,
        centreMM: deepCentre(a, id),
        meanMM: [a.sx / a.n, a.sy / a.n] as Pt,
        peakClearMM: a.deepS + r + thr,
        bbox: { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY },
        rings: ringsByComp[id],
        paths: curvesOf(ringsByComp[id]),
        deepIdx: a.deepIdx,
      })),
    }
  }

  const iso0 = level(0)
  if (!iso0.items.length) return []
  // ONE DEPTH. A mass is an island — the region where a magnet centre may sit. The second, deeper
  // cut went with the mass-depth dial (Dan, 2026-08-30): probing 4mm past the legal area returned a
  // region 8mm narrower than the one magnets actually seat in, which cost the classifier a whole
  // position per axis and moved with a centring control.
  const isoD = iso0
  const massesByIsland: SafeMass[][] = iso0.items.map(() => [])
  for (const m of isoD.items) {
    const islandId = iso0.comp[m.deepIdx]
    if (islandId >= 0) massesByIsland[islandId].push({ areaMM2: m.areaMM2, centreMM: m.centreMM, peakClearMM: m.peakClearMM, bbox: m.bbox, rings: m.rings, paths: m.paths })
  }
  const out: SafeSegment[] = iso0.items.map((it, id) => ({
    areaMM2: it.areaMM2,
    centreMM: it.centreMM,
    meanMM: it.meanMM,
    peakClearMM: it.peakClearMM,
    bbox: it.bbox,
    rings: it.rings,
    paths: it.paths,
    masses: massesByIsland[id].sort((a, b) => a.areaMM2 - b.areaMM2),
  }))
  out.sort((a, b) => a.areaMM2 - b.areaMM2)
  // THE EXACT ISLAND where one exists. A canon outline is lines and arcs of one radius, or a convex
  // polygon; its legal area is the same construction shrunk by the rim, closed-form, so the single
  // island's outline is that and not a fit. Measurement is unchanged: the mesh still scores the
  // island; only what the screen draws changes (Dan, 2026-09-05).
  if (out.length === 1 && contour.outer.path && !contour.holes.length) {
    const exact = insetOffsetPath(contour.outer.path, r)
    if (exact) out[0] = { ...out[0], paths: [exact], masses: out[0].masses.map((m) => ({ ...m, paths: [exact] })) }
  }
  return out
}
