// M2 — CENTRE RELATIONSHIP, GRID-BOX FLAP AND LIMBS. Blueprint §8.0–§8.4, implemented clause by
// clause in the SHAPE FRAME (§2.2: origin at the tested centre, +x right, +y down).
//
// §8.1: gridBox = magnet extent ± padding. Nothing inside it is flap (Dan's ruling).
// §8.2: four exact overhang subtractions are the COMPLETE flap measure; spread is evidence, never
//        a gate. Both switch outcomes reported; passing the larger never implies the smaller.
// §8.3: extremities are outline points ATTAINING a manufactured bound — no radial model.
// §8.4: outside-box boundary chains; limb-candidate exactly when a chain contains an extremity;
//        the exemption is never approved by the engine. No interior-gap diagnostic exists.

import type {
  BoxMM,
  CentreMethod,
  CentreRelationship,
  GridEngineSpec,
  MaterialExtremity,
  OverhangZone,
  PointMM,
  PopulationSlot,
} from './contract'

/** §8.1: the padded grid bounding box of a population arrangement, shape frame. */
export function gridBoxOf(magnets: readonly PointMM[], spec: GridEngineSpec): BoxMM {
  const xs = magnets.map((q) => q[0])
  const ys = magnets.map((q) => q[1])
  return {
    x0: Math.min(...xs) - spec.paddingMM,
    y0: Math.min(...ys) - spec.paddingMM,
    x1: Math.max(...xs) + spec.paddingMM,
    y1: Math.max(...ys) + spec.paddingMM,
  }
}

/** §8.2: the four exact overhang subtractions and their spread. */
export function overhangsOf(
  shapeBounds: BoxMM,
  gridBox: BoxMM,
): { left: number; right: number; top: number; bottom: number; spread: number } {
  const left = Math.max(0, gridBox.x0 - shapeBounds.x0)
  const right = Math.max(0, shapeBounds.x1 - gridBox.x1)
  const top = Math.max(0, gridBox.y0 - shapeBounds.y0)
  const bottom = Math.max(0, shapeBounds.y1 - gridBox.y1)
  const vals = [left, right, top, bottom]
  return { left, right, top, bottom, spread: Math.max(...vals) - Math.min(...vals) }
}

/** §8.2: one switch outcome per guarded limit, ordered one-for-one from flapLimitsMM. */
export function flapOutcomesOf(
  overhang: { left: number; right: number; top: number; bottom: number },
  flapLimitsMM: readonly [number, number],
): readonly [{ limitMM: number; passes: boolean }, { limitMM: number; passes: boolean }] {
  const test = (limit: number) =>
    overhang.left <= limit && overhang.right <= limit && overhang.top <= limit && overhang.bottom <= limit
  return [
    { limitMM: flapLimitsMM[0], passes: test(flapLimitsMM[0]) },
    { limitMM: flapLimitsMM[1], passes: test(flapLimitsMM[1]) },
  ]
}

/** §8.0: z_λ = σ(C_λ − C_κ); μ_s = mean(magnets); Δ = μ − z. Evidence for every tested centre. */
export function centreRelationships(
  magnets: readonly PointMM[],
  centres: ReadonlyArray<{ method: CentreMethod; centreMM: PointMM }>,
  placedCentre: PointMM,
  sigma: number,
): CentreRelationship[] {
  let mx = 0
  let my = 0
  for (const [x, y] of magnets) {
    mx += x
    my += y
  }
  mx /= magnets.length
  my /= magnets.length
  return centres.map(({ method, centreMM }) => {
    const zx = sigma * (centreMM[0] - placedCentre[0])
    const zy = sigma * (centreMM[1] - placedCentre[1])
    const dx = mx - zx
    const dy = my - zy
    return {
      centreMethod: method,
      shapeCentreMM: [zx, zy] as PointMM,
      magnetCentroidMM: [mx, my] as PointMM,
      displacementMM: [dx, dy] as PointMM,
      distanceMM: Math.hypot(dx, dy),
    }
  })
}

/**
 * §8.3: every outline point attaining a manufactured bound — vertices, or collinear boundary
 * segments canonicalised by their ordered endpoints.
 */
export function extremitiesOf(
  shapePoints: readonly PointMM[],
  shapeBounds: BoxMM,
  overhang: { left: number; right: number; top: number; bottom: number },
): MaterialExtremity[] {
  const out: MaterialExtremity[] = []
  const sides: Array<{
    side: 'left' | 'right' | 'top' | 'bottom'
    attains: (p: PointMM) => boolean
    over: number
  }> = [
    { side: 'left', attains: (p) => p[0] === shapeBounds.x0, over: overhang.left },
    { side: 'right', attains: (p) => p[0] === shapeBounds.x1, over: overhang.right },
    { side: 'top', attains: (p) => p[1] === shapeBounds.y0, over: overhang.top },
    { side: 'bottom', attains: (p) => p[1] === shapeBounds.y1, over: overhang.bottom },
  ]
  for (const { side, attains, over } of sides) {
    const attaining = shapePoints.filter(attains)
    if (attaining.length === 0) continue
    // consecutive attaining vertices form collinear boundary segments; canonicalise by ordered endpoints
    const key = (p: PointMM) => `${p[0]},${p[1]}`
    const seen = new Set<string>()
    const runs: PointMM[][] = []
    let current: PointMM[] = []
    for (let i = 0; i < shapePoints.length; i++) {
      const p = shapePoints[i]
      if (attains(p) && !seen.has(key(p))) {
        seen.add(key(p))
        current.push(p)
      } else if (current.length) {
        runs.push(current)
        current = []
      }
    }
    if (current.length) runs.push(current)
    for (const run of runs) {
      out.push({
        side,
        kind: run.length > 1 ? 'segment' : 'vertex',
        pointsMM: run.length > 1 ? [run[0], run[run.length - 1]] : [run[0]],
        sideOverhangMM: over,
      })
    }
  }
  return out
}

/**
 * §8.4: intersect the manufactured boundary with the complement of the grid box; the maximal
 * connected outside-box boundary chains, each reporting sides crossed, ordered coordinates, bbox,
 * max overhang, contained extremities, and its classification. Limb-candidate exactly when it
 * contains a material extremity. Never approved: over-limit chains are exception-pending.
 */
export function overhangZonesOf(
  slot: PopulationSlot,
  shapePoints: readonly PointMM[],
  gridBox: BoxMM,
  overhang: { left: number; right: number; top: number; bottom: number },
  extremities: readonly MaterialExtremity[],
  flapLimitsMM: readonly [number, number],
): OverhangZone[] {
  const outside = (p: PointMM) =>
    p[0] < gridBox.x0 || p[0] > gridBox.x1 || p[1] < gridBox.y0 || p[1] > gridBox.y1
  const n = shapePoints.length
  // walk the ring; group maximal runs of outside points (chains). Exact box-edge crossings split
  // runs by construction because an inside point terminates a run.
  const chains: PointMM[][] = []
  let current: PointMM[] = []
  let startedInside = false
  for (let i = 0; i < n * 2; i++) {
    // walk twice so a chain wrapping the ring start is captured once, then stop after one loop past
    const p = shapePoints[i % n]
    if (i >= n && current.length === 0) break
    if (outside(p)) {
      current.push(p)
    } else {
      startedInside = startedInside || i < n
      if (current.length && i >= 1) {
        chains.push(current)
        current = []
      }
      if (i >= n) break
    }
  }
  if (current.length && chains.length === 0) chains.push(current) // fully-outside ring
  const zones: OverhangZone[] = []
  for (const chain of chains) {
    const xs = chain.map((p) => p[0])
    const ys = chain.map((p) => p[1])
    const bbox: BoxMM = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
    const sidesCrossed: Array<'left' | 'right' | 'top' | 'bottom'> = []
    if (bbox.x0 < gridBox.x0) sidesCrossed.push('left')
    if (bbox.x1 > gridBox.x1) sidesCrossed.push('right')
    if (bbox.y0 < gridBox.y0) sidesCrossed.push('top')
    if (bbox.y1 > gridBox.y1) sidesCrossed.push('bottom')
    const maxOverhang = Math.max(
      ...sidesCrossed.map((s) =>
        s === 'left' ? overhang.left : s === 'right' ? overhang.right : s === 'top' ? overhang.top : overhang.bottom,
      ),
    )
    const contained = extremities.filter((e) =>
      e.pointsMM.some((p) => chain.some((c) => c[0] === p[0] && c[1] === p[1])),
    )
    const overLimit = maxOverhang > Math.max(flapLimitsMM[0], flapLimitsMM[1])
    zones.push({
      population: slot,
      sidesCrossed,
      boundaryMM: chain,
      bboxMM: bbox,
      maxOverhangMM: maxOverhang,
      containedExtremities: contained,
      classification: contained.length > 0 ? 'limb-candidate' : 'unsupported-zone',
      ...(overLimit ? { exception: 'exception-pending' as const } : {}),
    })
  }
  return zones
}
