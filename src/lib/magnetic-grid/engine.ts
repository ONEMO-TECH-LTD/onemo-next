// Magnetic-grid engine: orchestration over spec, compute and Logic.
// One import door for consumers; the modules stay behind it. It sequences — it never judges.

import type { BandId, BandSolveResult, Contour, GridResult, LawLayout, Pt, SolverConfig } from './spec'
import {
  bbox,
  centroidOf,
  enumerateLayouts,
  centredRegistrations,
  latticeAt,
  makeSeatPredicate,
  measureCentreBranches,
  measureExtremeCorners,
  measureGroupRegion,
  measureOverhangs,
  measureParity,
  measureWrap,
  regionExtents,
  regionInMaterial,
  safeSegments,
  splitPerimeter,
  spotRadiusOf,
  type SeatedNode,
} from './compute'
import {
  admitCentre,
  admitFit,
  applyCoverage,
  assignSizes,
  centeringAnchors,
  governMass,
  recommendationRank,
  reduceCountTiers,
} from './logic'

export * from './spec'
export {
  fieldSpanMM,
  contourBoundaryTruth,
  latticeOver,
  scaleContour,
} from './compute'

const mod = (v: number, m: number) => ((v % m) + m) % m

/**
 * ONE INSPECTION PATH. Free/manual and band solving both come here: the selected Centre ruler
 * produces the anchor once, every configured registration is swept, every ruled layout family is
 * enumerated over the seated nodes, and Logic judges each against Centre and Fit. Nothing is
 * scored; nothing lawful is discarded.
 */
export function computeGrid(contourMM: Contour, requestedSizeMM: number, cfg: SolverConfig, forcedPhaseMM: Pt | null = null): GridResult {
  // The configuration arrives complete and validated from Spec. No `??`, no clamp, no local default.
  const pitch = cfg.pitchMM
  const spotRadiusMM = spotRadiusOf(cfg.paddingMM)
  const perimeterOnly = cfg.coverage === 'perimeter'
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  const fits = makeSeatPredicate(outer, spotRadiusMM, { quantumMM: cfg.seatQuantumMM, guardMM: cfg.seatGuardMM })

  // The mass ruler cannot be finer than the spot it measures against — geometry, not a clamp.
  const massDepth = Math.max(spotRadiusMM, cfg.massDepthMM)
  const segments = safeSegments(outer, spotRadiusMM, massDepth, {
    maxVertices: cfg.centreSampleMaxVertices, meshQuantumMM: cfg.centreMeshQuantumMM, refineStepMM: cfg.centreRefineStepMM,
  })

  // LAW 1's anchor — the selected ruler, unchanged. Masses names it through the governor switch.
  const centreMeasurements = measureCentreBranches(segments, [cx, cy], centroidOf(outer))
  const centres = centeringAnchors(cfg.centreMode, centreMeasurements)
  const midY = (bb.minY + bb.maxY) / 2
  const anchor: Pt = cfg.centreMode === 2
    ? (governMass(centreMeasurements.masses, cfg.governor, midY)?.centreMM ?? centres[0])
    : centres[0]

  const ruler = cfg.measurementStepMM
  const onRuler = (mm: number) => Math.floor(Math.abs(mm) / ruler + 0.5) * ruler

  const layoutsAt = (phase: Pt): LawLayout[] => {
    const lattice = latticeAt(bb, pitch, phase[0], phase[1])
    const law = measureWrap(contourMM, lattice, pitch, spotRadiusMM)
    if (!law.seated.length) return []
    const nodes: SeatedNode[] = law.seated.map((p) => ({
      p, col: Math.round((p[0] - bb.minX - phase[0]) / pitch), row: Math.round((p[1] - bb.minY - phase[1]) / pitch),
    }))
    const out: LawLayout[] = []
    for (const candidate of enumerateLayouts(nodes, cfg.maxPopulationStep)) {
      const boxes = measureGroupRegion(candidate, cfg.paddingMM)
      const region = regionExtents(boxes)
      const balance: Pt = [(region.minX + region.maxX) / 2, (region.minY + region.maxY) / 2]
      const centreMissMM: [number, number] = [onRuler(balance[0] - anchor[0]), onRuler(balance[1] - anchor[1])]
      const parity = measureParity(candidate.nodes.map((n) => n.p), anchor, pitch, cfg.parityLineQuantumMM)
      const seated = candidate.nodes.map((n) => n.p)
      const belt = splitPerimeter(seated, pitch).belt
      const population = applyCoverage(seated, perimeterOnly, belt, cfg.minAnchors)
      const anchors = assignSizes(measureExtremeCorners(population, bbox(population)), cfg.magnetPlan)
      const origin = candidate.nodes[0]
      out.push({
        heldKey: candidate.heldKey,
        // scale-free identity: the arrangement in lattice steps, independent of the size it appears at
        shapeKey: `${candidate.family}:${candidate.populationStep}:${candidate.nodes.map((n) => `${n.col - origin.col},${n.row - origin.row}`).sort().join('|')}`,
        family: candidate.family,
        populationStep: candidate.populationStep,
        sizeMM: requestedSizeMM,
        phaseMM: phase,
        anchors,
        seated,
        lattice,
        magnetCount: anchors.length,
        centreMissMM,
        parityTrue: parity.parityTrue,
        contained: regionInMaterial(contourMM, boxes, cfg.measurementStepMM / 2),
        overhangsMM: measureOverhangs(bb, region),
        regionMM: region,
      })
    }
    return out
  }

  // Every configured registration of one periodic cell — the search Dan does by hand.
  const registrations = forcedPhaseMM
    ? [[mod(forcedPhaseMM[0], pitch), mod(forcedPhaseMM[1], pitch)] as Pt]
    : centredRegistrations(bb, pitch, anchor, cfg.measurementStepMM, cfg.registrationStepMM)

  const seen = new Set<string>()
  const lawful: LawLayout[] = []
  const manual: LawLayout[] = []
  for (const phase of registrations) {
    for (const layout of layoutsAt(phase)) {
      if (forcedPhaseMM) { manual.push(layout); continue }
      if (!admitCentre(layout) || !admitFit(layout, cfg)) continue
      if (seen.has(layout.heldKey)) continue
      seen.add(layout.heldKey)
      lawful.push(layout)
    }
  }
  lawful.sort((a, b) => {
    const ra = recommendationRank(a), rb = recommendationRank(b)
    return b.magnetCount - a.magnetCount || ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2]
  })

  // What the tab draws: the marked layout, or exactly the hand-placed registration when forced.
  const display = forcedPhaseMM
    ? [...manual].sort((a, b) => b.magnetCount - a.magnetCount)[0] ?? null
    : lawful[0] ?? null
  const concessions: GridResult['concessions'] = []
  if (display && !admitCentre(display)) concessions.push('CENTRE')
  if (display && !admitFit(display, cfg)) concessions.push('WRAP')

  return {
    anchors: display?.anchors ?? [],
    contactsMM: [],
    pitchCentreMM: pitch,
    lattice: display?.lattice ?? latticeAt(bb, pitch, 0, 0),
    phaseMM: display?.phaseMM ?? [0, 0],
    spotRadiusMM,
    segments,
    centresMM: [anchor],
    centreMainMM: fits ? anchor : centres[0],
    parityTrue: display?.parityTrue ?? false,
    centreErrorMM: display ? Math.max(display.centreMissMM[0], display.centreMissMM[1]) : 0,
    concessions,
    layouts: lawful,
    displaySource: forcedPhaseMM ? 'manual-registration' : display ? 'recommended-layout' : 'no-lawful-layout',
  }
}

/** LAW 3's loop: every configured size in every configured band, inspected once and stored. */
export function solveBands(sized: (sizeMM: number) => Contour, cfg: SolverConfig): BandSolveResult {
  const gridsBySize = new Map<number, GridResult>()
  const lawful: LawLayout[] = []
  for (const band of cfg.bands) {
    for (let mm = band.minMM; mm <= band.maxMM; mm += cfg.sizeStepMM) {
      const grid = computeGrid(sized(mm), mm, cfg)
      gridsBySize.set(mm, grid)
      lawful.push(...grid.layouts)
    }
  }
  return { bands: reduceCountTiers(lawful, cfg), gridsBySize }
}

/** Render a stored layout: the cached per-size result with the chosen layout overlaid.
 *  No geometry, Centre, Fit, Coverage, scaling or Logic call happens here. */
export function fitSizeInBand(solved: BandSolveResult, bandId: BandId, tierIndex: number, layoutIndex: number): GridResult {
  const ladder = solved.bands.find((b) => b.band === bandId)
  const tier = ladder?.rungs[tierIndex]
  const layout = tier?.layouts[layoutIndex]
  const base = tier && solved.gridsBySize.get(tier.sizeMM)
  if (!tier || !layout || !base) throw new Error(`no stored layout for band ${bandId} tier ${tierIndex} layout ${layoutIndex}`)
  return {
    ...base,
    phaseMM: layout.phaseMM,
    lattice: layout.lattice,
    anchors: layout.anchors,
    parityTrue: layout.parityTrue,
    centreErrorMM: Math.max(layout.centreMissMM[0], layout.centreMissMM[1]),
    concessions: [],
    displaySource: 'recommended-layout',
  }
}
