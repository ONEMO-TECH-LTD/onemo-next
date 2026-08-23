// Magnetic-grid engine: orchestration over spec, compute and Logic.
// One import door for consumers; the modules stay behind it.

import type { BandId, BandSolveResult, CentreMode, Contour, Governor, GridConfig, GridResult, Placement, PlacementCandidate, Pt, WrapPolicy } from './spec'
import {
  BANDS,
  CENTRE_MODE,
  DEFAULT_PITCH_MM,
  FLAP_MM,
  GOVERNOR,
  MASS_DEPTH_MM,
  MIN_TOUCH,
  PADDING_FLOOR_MM,
  RELEASED_PADDING_MM,
  SIZE_STEP_MM,
} from './spec'
import {
  bbox,
  centroidOf,
  latticeAt,
  makeSeatPredicate,
  measureCentreBranches,
  measureCentrePlacements,
  measureExtremeCorners,
  measureParity,
  measureWrap,
  safeSegments,
  spotRadiusOf,
} from './compute'
import {
  applyCoverage,
  assignSizes,
  centrePhaseCandidates,
  centeringAnchors,
  chooseCentrePlacement,
  evaluateWrap,
  governMass,
  inspectionConcessions,
  reduceBandLadders,
} from './logic'

export * from './spec'
export {
  fieldSpanMM,
  contourBoundaryTruth,
  latticeOver,
  scaleContour,
} from './compute'

/** Assemble one fixed-size inspection from frozen Centre placements and the final seat/Wrap measurement. */
const mod = (v: number, m: number) => ((v % m) + m) % m

export function computeGrid(contourMM: Contour, requestedSizeMM: number, cfg: GridConfig = {}): GridResult {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM)
  // The spot radius is the only reach Centre ever sees; the flap allowance reaches Wrap policy alone.
  const spotRadiusMM = spotRadiusOf(pad)
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  const fits = makeSeatPredicate(outer, spotRadiusMM)

  const massDepth = Math.max(spotRadiusMM, cfg.massDepthMM ?? MASS_DEPTH_MM)
  const segments = safeSegments(outer, spotRadiusMM, massDepth)

  // THE shape's centres — chosen by the centre-mode switch (logic's table). Every returned
  // point anchors the slide walk; single-target modes also fix the balance target.
  const mode = (cfg.centreMode ?? CENTRE_MODE) as CentreMode
  const governor = (cfg.governor ?? GOVERNOR) as Governor
  const centreMeasurements = measureCentreBranches(segments, [cx, cy], centroidOf(outer))
  const centres = centeringAnchors(mode, centreMeasurements)
  // Under CENTRE RULES one point rules outright; Masses names it via the governor switch.
  const midY = (bb.minY + bb.maxY) / 2
  const ruleTarget: Pt = mode === 2 ? (governMass(centreMeasurements.masses, governor, midY)?.centreMM ?? centres[0]) : centres[0]

  // One render-complete candidate per phase. The frozen Centre prescreen only SELECTS a phase;
  // the final Law population is the regenerated lattice filtered by the one signed whole-mm
  // clearance, Coverage and the magnet plan act on that population, and parity is measured.
  // The candidate's size is the caller's requested ladder size, never the (offset) geometry's bbox.
  const sizeMM = requestedSizeMM
  const candidateAt = (phaseMM: Pt, placement: Placement): PlacementCandidate => {
    const lattice = latticeAt(bb, pitch, phaseMM[0], phaseMM[1])
    const law = measureWrap(contourMM, lattice, pitch, spotRadiusMM)
    const output = applyCoverage(law.seated, perimeterOnly, law.belt)
    const anchors = assignSizes(measureExtremeCorners(output, bbox(output)), plan)
    const parity = measureParity(law.seated, ruleTarget, pitch)
    return {
      sizeMM, placement, phaseMM, lattice, seated: law.seated, anchors, magnetCount: anchors.length,
      parityTrue: parity.parityTrue, centreErrorMM: parity.centreErrorMM, wrapMeasurement: law.wrapMeasurement,
    }
  }
  // CENTRE RULES — no voting. Parity is DERIVED from the bbox axis classes: each axis's class
  // fixes its magnet-line count, odd count puts a NODE on the centre, even count puts the GAP on
  // it. All four parity placements are measured and returned; the display pick keeps the frozen
  // Centre ordering (a parity seating more wins; at equal seats the canonical frame).
  const measured = fits ? measureCentrePlacements(bb, pitch, centrePhaseCandidates(ruleTarget, bb, pitch), fits, outer, spotRadiusMM) : []
  const candidates = measured.map((m, i) => candidateAt(m.phaseMM, { xHalf: i === 1 || i === 3, yHalf: i === 2 || i === 3 }))
  const best = chooseCentrePlacement(measured)
  let display: PlacementCandidate
  if (fits && cfg.forcePhaseMM) {
    // Manual calibration: seat exactly at the given registration, no search. The centre law
    // is NOT satisfied by construction here — a hand-placed grid may sit anywhere — so its
    // truth is MEASURED and reported as a concession.
    display = candidateAt([mod(cfg.forcePhaseMM[0], pitch), mod(cfg.forcePhaseMM[1], pitch)], { xHalf: false, yHalf: false })
  } else {
    display = best ? candidates[measured.indexOf(best)] : candidateAt([0, 0], { xHalf: false, yHalf: false })
  }
  const mainCentre: Pt = fits ? ruleTarget : centres[0]

  const wrap = evaluateWrap(display.wrapMeasurement, wrapPolicyOf(cfg))
  const concessions = inspectionConcessions({ parityTrue: display.parityTrue, centreErrorMM: display.centreErrorMM }, wrap)

  return {
    anchors: display.anchors,
    // Truth dots come only from returned witnesses on a lawful result; refusals draw none.
    contactsMM: wrap.status === 'lawful' ? wrap.witnesses.map((witness) => witness.outlinePointMM) : [],
    pitchCentreMM: pitch,
    lattice: display.lattice,
    phaseMM: display.phaseMM,
    spotRadiusMM,
    segments,
    centresMM: [ruleTarget],
    centreMainMM: mainCentre,
    wrap,
    parityTrue: display.parityTrue,
    centreErrorMM: display.centreErrorMM,
    concessions,
    candidates,
  }
}

/** The Wrap policy the config asks for — whole millimetres, read once, handed to Logic. */
function wrapPolicyOf(cfg: GridConfig): WrapPolicy {
  const minTouch = Math.max(1, Math.floor(cfg.minTouch ?? MIN_TOUCH))
  return cfg.wrapMode === 'auto'
    ? { mode: 'auto', capMM: Math.max(0, cfg.autoFlapCapMM ?? cfg.flapMM ?? FLAP_MM), minTouch }
    : { mode: 'fixed', allowanceMM: Math.max(0, cfg.flapMM ?? FLAP_MM), minTouch }
}

/** MAGNET-QUANTITY SCALING: the one production loop over the even-size ladder. Every even size in
 *  every band is computed once (all four placements) and stored; Logic reduces the candidates. */
export function solveBands(sized: (evenSizeMM: number) => Contour, cfg: GridConfig = {}): BandSolveResult {
  const gridsBySize = new Map<number, GridResult>()
  const candidates: PlacementCandidate[] = []
  for (const band of BANDS) {
    for (let mm = band.minMM; mm <= band.maxMM; mm += SIZE_STEP_MM) {
      const grid = computeGrid(sized(mm), mm, cfg)
      gridsBySize.set(mm, grid)
      candidates.push(...grid.candidates)
    }
  }
  return { bands: reduceBandLadders(candidates, wrapPolicyOf(cfg)), gridsBySize }
}

/** Render a stored rung layout: the cached per-size result with the chosen lawful layout overlaid.
 *  No geometry, Centre, Wrap, Coverage, scaling or Logic call happens here. */
export function fitSizeInBand(solved: BandSolveResult, bandId: BandId, rungIndex: number, layoutIndex: number): GridResult {
  const ladder = solved.bands.find((b) => b.band === bandId)
  const rung = ladder?.rungs[rungIndex]
  const layout = rung?.layouts[layoutIndex]
  const base = rung && solved.gridsBySize.get(rung.sizeMM)
  if (!rung || !layout || !base) throw new Error(`no stored layout for band ${bandId} rung ${rungIndex} layout ${layoutIndex}`)
  const { candidate, wrap } = layout
  return {
    ...base,
    phaseMM: candidate.phaseMM,
    lattice: candidate.lattice,
    anchors: candidate.anchors,
    wrap,
    parityTrue: candidate.parityTrue,
    centreErrorMM: candidate.centreErrorMM,
    contactsMM: wrap.witnesses.map((witness) => witness.outlinePointMM),
    concessions: [],
  }
}

/** The same solve with the Auto policy: Logic keeps the minimum whole-mm allowance within the cap; no scan. */
export function autoFlapInBand(sized: (evenSizeMM: number) => Contour, cfg: GridConfig, capMM: number): BandSolveResult {
  return solveBands(sized, { ...cfg, wrapMode: 'auto', autoFlapCapMM: Math.max(0, capMM) })
}
