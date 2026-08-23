// Magnetic-grid Logic: the three laws over completed neutral measurements. No geometry lives here.

import type { Anchor, BandId, BandLadder, CentreMeasurements, CentreMode, CountTier, ExtremeCornerMeasurement, Governor, LawLayout, MagnetPlan, Pt, SolverConfig } from './spec'
import { MAGNET_DIA_LARGE_MM, MAGNET_DIA_SMALL_MM } from './spec'

type BandRange = { id: BandId; minMM: number; maxMM: number }

/** Which band a size falls in — dominant side against the CONFIGURED band ranges. */
export function bandOf(sizeMM: number, bands: ReadonlyArray<BandRange>): BandRange | null {
  for (const b of bands) if (sizeMM >= b.minMM && sizeMM <= b.maxMM) return b
  return null
}

/** Which mass rules — the switchable governor: 0 smallest area · 1 deepest · 2 top (gravity) ·
 *  3 top-small — RULED 2026-08-19: among masses in the shape's upper half the smallest governs;
 *  if nothing lives in the upper half, the topmost governs. Unchanged by v3.5.4. */
export function governMass<M extends { areaMM2: number; centreMM: Pt; peakClearMM?: number }>(
  masses: ReadonlyArray<M>, governor: Governor, midY?: number,
): M | null {
  if (!masses.length) return null
  if (governor === 3) {
    const mid = midY ?? Math.min(...masses.map((m) => m.centreMM[1]))
    const upper = masses.filter((m) => m.centreMM[1] >= mid)
    if (upper.length) return governMass(upper, 0)
    return governMass(masses, 2)
  }
  let best = masses[0]
  for (const m of masses) {
    if (governor === 0 && m.areaMM2 < best.areaMM2) best = m
    if (governor === 1 && (m.peakClearMM ?? 0) > (best.peakClearMM ?? 0)) best = m
    if (governor === 2 && m.centreMM[1] > best.centreMM[1]) best = m
  }
  return best
}

/** The centres a mode aims at — the switchable test system, unchanged by v3.5.4. */
export function centeringAnchors(mode: CentreMode, measured: CentreMeasurements): Pt[] {
  if (mode === 0) return [measured.box]
  if (mode === 3) return [measured.weight]
  if (mode === 1) return [measured.core]
  if (mode === 4) return [measured.deep]
  if (mode === 5) return [measured.top]
  return measured.masses.length ? measured.masses.map((m) => m.centreMM) : [measured.box]
}


/**
 * LAW 1 — CENTRE (Dan, 2026-08-23: "center means find the anchor, no floating around").
 * The selected ruler produces the governed anchor; a layout is centred only when its ruled group
 * region BALANCES on that anchor — both axis misses zero on the configured ruler — and its lattice
 * parity evidence holds. Parity alone never suffices, and the group may not slide to an easier fit.
 */
export function admitCentre(layout: Pick<LawLayout, 'centreMissMM' | 'parityTrue'>): boolean {
  return layout.parityTrue && layout.centreMissMM[0] === 0 && layout.centreMissMM[1] === 0
}

/**
 * LAW 2 — FIT (grid-laws.md L18: "whether the bounding box fits inside the shape").
 * The ruled group region must be encapsulated by the shape, and no outer overhang may exceed the
 * configured flap limit. Tangency may happen; it is never required of any disc.
 */
export function admitFit(
  layout: Pick<LawLayout, 'contained' | 'overhangsMM'>,
  cfg: Pick<SolverConfig, 'flapEnabled' | 'flapLimitMM'>,
): boolean {
  if (!layout.contained) return false
  if (!cfg.flapEnabled) return true
  return Math.max(...layout.overhangsMM) <= cfg.flapLimitMM
}

/** The recommendation order over layouts the laws already admitted — it marks, never discards. */
export function recommendationRank(layout: LawLayout): [number, number, number] {
  const gravity = layout.overhangsMM[2]                                   // holds the top
  const tightness = layout.overhangsMM.reduce((sum, mm) => sum + mm, 0)   // least unsupported edge
  const cornerOptimum = layout.magnetCount >= 4 && layout.overhangsMM.every((mm) => mm === 0) ? 0 : 1
  return [gravity, tightness, cornerOptimum]
}

/**
 * LAW 3 — SCALE. Inside each band independently: magnet counts ascending from the lowest that
 * fits, each count at the first size where it is lawful, and EVERY distinct lawful layout retained
 * there. A count published in one band never suppresses the same count in another. One layout per
 * count is marked as the recommendation; none is hidden.
 */
export function reduceCountTiers(lawful: ReadonlyArray<LawLayout>, cfg: Pick<SolverConfig, 'bands'>): BandLadder[] {
  return cfg.bands.map((band) => {
    const inBand = [...lawful]
      .filter((l) => l.sizeMM >= band.minMM && l.sizeMM <= band.maxMM)
      .sort((a, b) => a.sizeMM - b.sizeMM)
    const byCount = new Map<number, LawLayout[]>()
    for (const layout of inBand) {
      const kept = byCount.get(layout.magnetCount) ?? []
      // Identity is the physical layout, never the count: the same arrangement is kept once, at
      // its first lawful size; a DIFFERENT arrangement of the same count is kept alongside it.
      if (!kept.some((existing) => existing.shapeKey === layout.shapeKey)) kept.push(layout)
      byCount.set(layout.magnetCount, kept)
    }
    const rungs: CountTier[] = [...byCount.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([magnetCount, layouts]) => {
        const ordered = [...layouts].sort((a, b) => {
          const ra = recommendationRank(a), rb = recommendationRank(b)
          return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2] || a.sizeMM - b.sizeMM
        })
        return { band: band.id, magnetCount, sizeMM: ordered[0].sizeMM, layouts: ordered, recommendedLayoutIndex: 0 }
      })
    return { band: band.id, rungs, refusal: rungs.length ? null : { code: 'NO_LAWFUL_LAYOUT_IN_BAND' } }
  })
}

/** Perimeter coverage: above the minimum population, the output is the measured belt. */
export function applyCoverage(seated: Pt[], perimeterOnly: boolean, belt: Pt[], minAnchors: number): Pt[] {
  if (!perimeterOnly || seated.length <= 4) return seated
  return belt.length >= minAnchors ? belt : seated
}

/** Per-anchor magnet size. corners8 → the large body on the extreme corners, small elsewhere. */
export function assignSizes(measured: ReadonlyArray<ExtremeCornerMeasurement>, plan: MagnetPlan): Anchor[] {
  if (plan === 'all8') return measured.map(({ p }) => ({ p, dia: MAGNET_DIA_LARGE_MM }))
  if (plan === 'all6') return measured.map(({ p }) => ({ p, dia: MAGNET_DIA_SMALL_MM }))
  return measured.map(({ p, extremeCorner }) => ({ p, dia: extremeCorner ? MAGNET_DIA_LARGE_MM : MAGNET_DIA_SMALL_MM }))
}
