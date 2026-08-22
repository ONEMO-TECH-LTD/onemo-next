// Magnetic-grid engine: orchestration over spec, compute and Logic.
// One import door for consumers; the modules stay behind it.

import type {
  AlgebraicReal, AllBandsResult, Band, BandResult, BandSnapPoint, CandidateInspection, CandidateLawEvaluation,
  CentreBranchMeasurement, CentreMode, ComparisonEngineConfig, Contour, EvaluationPolicy, ExactReal,
  FixedSizeInspection, Governor, GridConfig, GridResult, InspectFixedSizeInput, LawfulLayout,
  LawfulRung, MagneticGridEngine, Pt, Rational, RootedCandidateGeometry, SolveBandsInput,
} from './spec'
import {
  CENTRE_MODE,
  BANDS,
  DEFAULT_PITCH_MM,
  FLAP_MM,
  GOVERNOR,
  MASS_DEPTH_MM,
  MIN_EFFECT_MM,
  PADDING_FLOOR_MM,
  RELEASED_PADDING_MM,
  CONTACT_TOLERANCE_MM,
} from './spec'
import {
  bbox,
  centroidOf,
  fieldSpanMM,
  latticeAt,
  makeCircleSeatPredicate,
  makeSeatPredicate,
  measureCentreBranches,
  measureCentrePlacements,
  measureExtremeCorners,
  measureWrap,
  approximateExact,
  addRational,
  affineExact,
  canonicalExact,
  compareExact,
  divideRational,
  certifyContactWitness,
  contourBoundaryTruth,
  enumerateAffineContactEvents,
  enumerateAffinePointContactEvents,
  enumerateParityClassEvents,
  exactBoxTargetCoefficient,
  exactBandDomain,
  exactWeightTargetCoefficient,
  measureExactAffineCandidate,
  measureExactScaleWrap,
  measureFrozenMeshCentreEvidence,
  measureFullOuterCentreEvidence,
  multiplyRational,
  prepareContour,
  rational,
  rationalFromNumber,
  quadraticRootsWithin,
  rationalBetweenExact,
  safeSegments,
  scaleInBand,
  sha256Text,
  signQuadraticAtExact,
  splitPerimeter,
  spotRadiusOf,
} from './compute'
import {
  applyCoverage,
  assignSizes,
  bandOf,
  centrePhaseCandidates,
  centeringAnchors,
  chooseCentrePlacement,
  evaluateWrap,
  evaluateCandidateLaws,
  evaluateCentreLaw,
  governMass,
  inspectCandidateLaws,
  reduceBandLadders,
} from './logic'

export * from './spec'
export {
  fieldSpanMM,
  contourBoundaryTruth,
  latticeOver,
  safeSegments,
  scaleContour,
  spotRadiusOf,
} from './compute'
export { bandOf } from './logic'

/** Sweep the lattice phase at the placement step (ruled 1mm), seat exactly, score, apply coverage, report. */
const mod = (v: number, m: number) => ((v % m) + m) % m

export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM)
  // Coverage reach from a magnet centre: the spot plus the dialled flap allowance.
  const reach = spotRadiusOf(pad) + Math.max(0, cfg.flapMM ?? FLAP_MM)
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  const fits = cfg.circle
    ? makeCircleSeatPredicate(cx, cy, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, spotRadiusOf(pad) + Math.max(0, cfg.seatMarginMM ?? 0))
    : makeSeatPredicate(outer, spotRadiusOf(pad) + Math.max(0, cfg.seatMarginMM ?? 0))

  const massDepth = Math.max(spotRadiusOf(pad), cfg.massDepthMM ?? MASS_DEPTH_MM)
  const segments = safeSegments(outer, spotRadiusOf(pad), massDepth, cfg.segmentsDetail ?? 'full')

  // THE shape's centres — chosen by the centre-mode switch (logic's table). Every returned
  // point anchors the slide walk; single-target modes also fix the balance target.
  const mode = (cfg.centreMode ?? CENTRE_MODE) as CentreMode
  const governor = (cfg.governor ?? GOVERNOR) as Governor
  const centreMeasurements = measureCentreBranches(segments, [cx, cy], centroidOf(outer))
  const centres = centeringAnchors(mode, centreMeasurements)
  // Under CENTRE RULES one point rules outright; Masses names it via the governor switch.
  const midY = (bb.minY + bb.maxY) / 2
  const ruleTarget: Pt = mode === 2 ? (governMass(centreMeasurements.masses, governor, midY)?.centreMM ?? centres[0]) : centres[0]

  let bestSeated: Pt[] = []
  let bestOx = 0, bestOy = 0, bestKx = 0, bestKy = 0
  let mainCentre: Pt = centres[0]
  if (fits && cfg.forcePhaseMM) {
    // Manual calibration: seat exactly at the given registration, no search. The centre law
    // is NOT satisfied by construction here — a hand-placed grid may sit anywhere — so its
    // truth is MEASURED and reported (pixel full-eval F1: silence read as compliance).
    bestOx = mod(cfg.forcePhaseMM[0], pitch)
    bestOy = mod(cfg.forcePhaseMM[1], pitch)
    bestKx = mod(bestOx - (bb.maxX - bb.minX) / 2, pitch)
    bestKy = mod(bestOy - (bb.maxY - bb.minY) / 2, pitch)
    bestSeated = latticeAt(bb, pitch, bestOx, bestOy).filter(fits)
    mainCentre = ruleTarget
  } else if (fits) {
    // CENTRE RULES — no voting. Parity is DERIVED from the bbox axis classes (canon §4/§6):
    // each axis's class fixes its magnet-line count, odd count puts a NODE on the centre,
    // even count puts the GAP on it — so a 108x91 (class 2x2) shape is judged as a 2x2 frame
    // whose centre IS the governed centre. Magnets still govern first: a parity seating more
    // wins; at EQUAL seats the canonical frame parity always beats the rest, and coverage
    // only sorts the non-canonical remainder. Centring is exact by construction.
    const measured = measureCentrePlacements(bb, pitch, centrePhaseCandidates(ruleTarget, bb, pitch), fits, outer, reach)
    const best = chooseCentrePlacement(measured)
    if (best) { bestSeated = best.seated; bestOx = best.phaseMM[0]; bestOy = best.phaseMM[1] }
    mainCentre = ruleTarget
  }

  const lattice = latticeAt(bb, pitch, bestOx, bestOy)

  const split = splitPerimeter(bestSeated, pitch)
  const belt = bestSeated.length <= 4 ? bestSeated : split.belt
  const coverage = applyCoverage(bestSeated, perimeterOnly, split)
  const anchors = assignSizes(measureExtremeCorners(coverage.seated, bbox(coverage.seated)), plan)
  const preparedWrap=prepareContour(contourMM,contourBoundaryTruth(contourMM))
  const wrapGeometry=measureWrap(preparedWrap,belt,spotRadiusOf(pad))
  const wrapMeasured={...wrapGeometry,witnesses:wrapGeometry.witnesses.map(certifyContactWitness)}
  const wrap = cfg.wrapMode === 'auto'
    ? evaluateWrap(wrapMeasured, {
      mode: 'auto',
      cap: rationalFromNumber(Math.max(0, cfg.autoFlapCapMM ?? cfg.flapMM ?? FLAP_MM)),
      capApproxMM: Math.max(0, cfg.autoFlapCapMM ?? cfg.flapMM ?? FLAP_MM),
    })
    : evaluateWrap(wrapMeasured, {
      mode: 'fixed',
      allowance: rationalFromNumber(Math.max(0, cfg.flapMM ?? FLAP_MM)),
      allowanceApproxMM: Math.max(0, cfg.flapMM ?? FLAP_MM),
    })

  return {
    anchors,
    // Truth dots are projections stored by exact segment witnesses; no guard/tolerance can draw one.
    contactsMM: wrap.status === 'lawful' ? wrap.witnesses.map((witness) => [
      approximateExact(witness.tangency.x), approximateExact(witness.tangency.y),
    ] as Pt) : [],
    pitchCentreMM: pitch,
    lattice,
    phaseMM: [bestOx, bestOy],
    panMM: [bestKx, bestKy],
    spotRadiusMM: spotRadiusOf(pad),
    segments,
    centresMM: [ruleTarget],
    centreMainMM: mainCentre,
    wrap,
  }
}

/** The walk range: the band as a RANGE; above the last band, up to the derived field span. */
function snapRange(cfg: GridConfig, fromMM: number): [number, number] {
  const band = bandOf(fromMM)
  if (band) return [band.minMM, band.maxMM]
  return [fromMM, fieldSpanMM(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM))]
}

/** Pre-scaling diagnostic call boundary. Exact Wrap is already measured in every returned grid. */
export function bandSnapPoints(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): BandSnapPoint[] {
  return bandWalk(sized, cfg, fromMM, stepMM).points
}

/** One pass over the band: the per-count contact sizes AND the best-seated rung (fallback). */
function bandWalk(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { points: BandSnapPoint[]; bestSeatedMM: number } {
  const [lo, hi] = snapRange(cfg, fromMM)
  // Interim scaling candidate generator only. Exact Wrap is evaluated by computeGrid;
  // this sampled walk never measures or grants contact.
  const walkCfg: GridConfig = { ...cfg, segmentsDetail: 'light', seatMarginMM: 0 }
  const solve = (mm: number): GridResult => {
    let g = cfg.solveCache?.get(mm)
    if (!g) { g = computeGrid(sized(mm), walkCfg); cfg.solveCache?.set(mm, g) }
    return g
  }
  // Counts already seating just below the band reached contact earlier — loose here, not rungs.
  const below = lo - stepMM >= MIN_EFFECT_MM ? solve(lo - stepMM).anchors.length : 0
  const points: BandSnapPoint[] = []
  const seen = new Set<number>()
  for (let c = 1; c <= below; c++) seen.add(c)
  let bestSeatedMM = lo, bestSeats = -1
  for (let mm = lo; mm <= hi; mm += stepMM) {
    const grid = solve(mm)
    const count = grid.anchors.length
    if (count > bestSeats) { bestSeats = count; bestSeatedMM = mm }
    if (count >= 1 && !seen.has(count)) {
      // Legacy diagnostic count-transition refinement; this is not the scaling law.
      let lo2 = Math.max(MIN_EFFECT_MM, mm - stepMM), hi2 = mm
      for (let it = 0; it < 8 && hi2 - lo2 > CONTACT_TOLERANCE_MM / 2; it++) {
        const midMM = (lo2 + hi2) / 2
        const gm = computeGrid(sized(midMM), walkCfg)
        if (gm.anchors.length >= count) hi2 = midMM; else lo2 = midMM
      }
      const rungMM = hi2
      const gr = computeGrid(sized(rungMM), walkCfg)
      const ok = gr.anchors.length === count && gr.wrap.status === 'lawful'
      if (ok) { seen.add(count); points.push({ sizeMM: rungMM, count }) }
    }
  }
  return { points, bestSeatedMM }
}

/** Pre-scaling diagnostic band output; no production scaling claim is made in this phase. */
export function fitSizeInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { sizeMM: number; grid: GridResult; ladder: BandSnapPoint[]; pickIdx: number } {
  const { points, bestSeatedMM } = bandWalk(sized, cfg, fromMM, stepMM)
  const dispCfg: GridConfig = { ...cfg, seatMarginMM: 0 }
  if (points.length) {
    const maxCount = Math.max(...points.map((p) => p.count))
    const pickIdx = points.findIndex((p) => p.count === maxCount)
    return { sizeMM: points[pickIdx].sizeMM, grid: computeGrid(sized(points[pickIdx].sizeMM), dispCfg), ladder: points, pickIdx }
  }
  return { sizeMM: bestSeatedMM, grid: computeGrid(sized(bestSeatedMM), dispCfg), ladder: [], pickIdx: 0 }
}

/**
 * Exact Auto Wrap: the geometry derives its worst-belt requirement once; Logic compares it
 * to the cap. No allowance scan or millimetre grant exists in this replacement body.
 */
export function autoFlapInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number, maxFlapMM: number,
  cacheFor?: (flapMM: number) => Map<number, GridResult> | undefined,
): { flapMM: number; fit: ReturnType<typeof fitSizeInBand> } {
  const cap = Math.max(0, maxFlapMM)
  const fit = fitSizeInBand(sized, {
    ...cfg,
    wrapMode: 'auto',
    autoFlapCapMM: cap,
    solveCache: cacheFor?.(cap),
  }, fromMM, stepMM)
  const flapMM = fit.grid.wrap.status === 'lawful' ? fit.grid.wrap.appliedFlapApproxMM : cap
  return { flapMM, fit }
}

const exactScale = (exact: ExactReal) => ({ exact, approximateMM: approximateExact(exact) })
type EventScale = Rational | AlgebraicReal
const exactPointKey = (point: { x: ExactReal; y: ExactReal }) => `${canonicalExact(point.x)}:${canonicalExact(point.y)}`
const policyIdentityOf = (config: ComparisonEngineConfig) => sha256Text(JSON.stringify([
  'magnetic-grid-policy-v1', config.centrePolicy, config.coverage, config.magnetPlan, config.flap,
]))
const bandRelations = (band: Band) => {
  const gap = band.id % 2 === 0
  return [[gap, gap], [!gap, gap], [gap, !gap], [!gap, !gap]] as const
}
const allowedWrap = (config: ComparisonEngineConfig): Rational =>
  config.flap.mode === 'fixed' ? config.flap.allowance : config.flap.maxAllowance

const validatedNormalizedContour = (input: SolveBandsInput['contour']): Contour => {
  const prepared = prepareContour(input.displayContour, input.truth)
  const canonicalBoundary = (boundary: typeof input.boundary) => boundary.map((element) => [
    element.kind, element.id,
    canonicalExact(element.a[0]), canonicalExact(element.a[1]),
    canonicalExact(element.b[0]), canonicalExact(element.b[1]),
  ])
  if (contourBoundaryTruth(input.displayContour).contourIdentity !== input.truth.contourIdentity
    || JSON.stringify(canonicalBoundary(prepared.boundary)) !== JSON.stringify(canonicalBoundary(input.boundary))) {
    throw new RangeError('REGIME_UNRESOLVED: normalized boundary/display provenance mismatch')
  }
  return prepared.source
}

const exactMeshDimensionSites = (contour: Contour, band: Band): Rational[] => {
  const points = contour.outer.pts
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1])
  const spans = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
  const domain = exactBandDomain(band), sites: Rational[] = []
  for (const span of spans) {
    if (!(span > 0)) continue
    const coefficient = rationalFromNumber(span)
    for (let rounded = 0; ; rounded++) {
      const site = divideRational(rational(2 * rounded + 1), coefficient)
      if (scaleInBand(site, band)) sites.push(site)
      if (compareExact(site, domain.hiExclusive) >= 0) break
    }
  }
  return sites
}

const comparisonRoots = (
  equation: readonly [Rational, Rational, Rational],
  band: Band,
): EventScale[] => {
  const domain = exactBandDomain(band), [a, b, c] = equation
  if (a.numerator === '0') {
    if (b.numerator === '0') return []
    const normalized = multiplyRational(rational(-1), divideRational(c, b))
    return scaleInBand(normalized, band) ? [normalized] : []
  }
  return quadraticRootsWithin(a, b, c, domain.lo, domain.hiExclusive, 8).filter((root) => scaleInBand(root, band))
}

type ExactSiteEvaluation = {
  centres: ReturnType<typeof evaluateCentreLaw>[]
  candidates: CandidateLawEvaluation[]
  evidence: CentreBranchMeasurement['evidence'] | null
  measurement: ReturnType<typeof measureFrozenMeshCentreEvidence>
}

const evaluateExactSite = (
  contour: Contour,
  truth: SolveBandsInput['contour']['truth'],
  band: Band,
  scale: ExactReal,
  policy: EvaluationPolicy,
  forcedPhaseMM?: readonly [number, number],
): ExactSiteEvaluation => {
  const spotRadius = rational(RELEASED_PADDING_MM), massDepth = rational(MASS_DEPTH_MM)
  const measured = policy.centrePolicy.mode === 'box' || policy.centrePolicy.mode === 'weight'
    ? measureFullOuterCentreEvidence(contour, scale)
    : measureFrozenMeshCentreEvidence(contour, scale, spotRadius, massDepth)
  if (measured.status === 'unresolved') return { centres: [], candidates: [], evidence: null, measurement: measured }
  const comparisonDisposition = measured.transitionComparisons.map((comparison) => [
    comparison.kind, comparison.leftId, comparison.rightId, signQuadraticAtExact(...comparison.equation, scale),
  ])
  const siteId = sha256Text(JSON.stringify(['site', band.id, canonicalExact(scale), comparisonDisposition]))
  const context = {
    band: band.id, scale: exactScale(scale), regimeId: sha256Text(JSON.stringify(['regime', band.id, siteId])), siteId,
  }
  const branch: CentreBranchMeasurement = { context, evidence: measured.evidence, frozenMasses: measured.frozenMasses }
  const centre = evaluateCentreLaw(branch, policy.centrePolicy)
  const targets = new Map(measured.affineTargets.map((target) => [exactPointKey(target.point), target.affine]))
  const candidates: CandidateLawEvaluation[] = []
  for (const decision of centre.decisions) {
    const target = targets.get(exactPointKey(decision.target))
    if (!target) continue
    const placements = forcedPhaseMM ? [[false, false] as const] : bandRelations(band)
    for (const [xGap, yGap] of placements) {
      const placementCoefficient = forcedPhaseMM ? [rational(0), rational(0)] as const : target.coefficient
      const placementOffset = forcedPhaseMM
        ? [rationalFromNumber(forcedPhaseMM[0]), rationalFromNumber(forcedPhaseMM[1])] as const
        : target.offset
      const seated = measureExactAffineCandidate(contour, placementCoefficient, placementOffset, scale, xGap, yGap, DEFAULT_PITCH_MM, spotRadius)
      if (!seated.seated.length || !seated.affineBelt.length) continue
      const wrap = measureExactScaleWrap(contour, truth, seated.affineBelt, scale, spotRadius, context.regimeId)
      if (!wrap.witnesses.length) continue
      const orientation = seated.xLineCount === 1 && seated.yLineCount === 1 ? 'single'
        : seated.xLineCount === 1 ? 'vertical' : seated.yLineCount === 1 ? 'horizontal' : 'two-dimensional'
      const phase = seated.nodes[Math.floor(seated.nodes.length / 2)]
      const centreErrorMM = Math.hypot(
        phase.approximateMM[0] - decision.target.approximateMM[0],
        phase.approximateMM[1] - decision.target.approximateMM[1],
      )
      const centreTrue = compareExact(phase.x, decision.target.x) === 0 && compareExact(phase.y, decision.target.y) === 0
      const centreRelation = centreErrorMM === 0 ? 'node' : 'gap'
      const measuredId = sha256Text(JSON.stringify(['measured', context.siteId, decision.policy, xGap, yGap]))
      const rooted: RootedCandidateGeometry = {
        band: band.id, scale: context.scale, phase, xParity: xGap ? 'gap' : 'node', yParity: yGap ? 'gap' : 'node',
        parityEvidence: {
          x: { lineCount: seated.xLineCount, centreRelation: forcedPhaseMM ? centreRelation : xGap ? 'gap' : 'node' },
          y: { lineCount: seated.yLineCount, centreRelation: forcedPhaseMM ? centreRelation : yGap ? 'gap' : 'node' },
        },
        centre: decision, centreEvidence: measured.evidence, seated: seated.seated, belt: seated.belt,
        seatedCount: seated.seated.length, beltCount: seated.belt.length, requiredFlap: wrap.requiredFlap,
        requiredFlapApproxMM: wrap.requiredFlapApproxMM,
        orientation, measuredId, geometryLayoutId: sha256Text(JSON.stringify(['layout', measuredId, seated.seated.map(exactPointKey)])),
        regimeId: context.regimeId, contacts: wrap.witnesses as RootedCandidateGeometry['contacts'],
        seatedExtremeCorners: seated.seatedExtremeCorners, beltExtremeCorners: seated.beltExtremeCorners,
        centreErrorMM,
        centreTrue,
      }
      candidates.push(evaluateCandidateLaws(rooted, policy))
    }
  }
  return { centres: [centre], candidates, evidence: measured.evidence, measurement: measured }
}

const enumerateBandSites = (contour: Contour, band: Band, config: ComparisonEngineConfig): EventScale[] => {
  const eventKey = (site: EventScale) => 'polynomial' in site
    ? JSON.stringify([site.polynomial, site.rootIndex])
    : canonicalExact(site)
  const addTo = (sites: Map<string, EventScale>, site: EventScale) => {
    if (!scaleInBand(site, band)) return
    sites.set(eventKey(site), site)
  }
  const sortedUniqueExact = (sites: Iterable<EventScale>): EventScale[] => {
    const ordered = [...sites].sort((left, right) => compareExact(left, right))
    return ordered.filter((site, index) => index === 0 || compareExact(ordered[index - 1], site) !== 0)
  }
  const representatives = (boundaries: EventScale[]) => {
    const values: Rational[] = []
    for (let index = 0; index + 1 < boundaries.length; index++) values.push(rationalBetweenExact(boundaries[index], boundaries[index + 1]))
    const hi = exactBandDomain(band).hiExclusive, last = boundaries[boundaries.length - 1]
    if (compareExact(last, hi) < 0) values.push(rationalBetweenExact(last, hi))
    return values
  }
  const structuralSites = new Map<string, EventScale>()
  const pointEventCache = new Map<string, readonly ReturnType<typeof enumerateAffinePointContactEvents>[number][]>()
  const pointRootCache = new Map<string, readonly EventScale[]>()
  addTo(structuralSites, exactBandDomain(band).lo)
  for (const event of enumerateParityClassEvents(contour, BANDS)) addTo(structuralSites, event.scale)
  const meshCentrePolicy = config.centrePolicy.mode !== 'box' && config.centrePolicy.mode !== 'weight'
  if (meshCentrePolicy) for (const site of exactMeshDimensionSites(contour, band)) addTo(structuralSites, site)
  const baseStructuralBoundaries = sortedUniqueExact(structuralSites.values())
  const structuralHi = exactBandDomain(band).hiExclusive
  if (meshCentrePolicy) for (let baseIndex = 0; baseIndex < baseStructuralBoundaries.length; baseIndex++) {
    const lo = baseStructuralBoundaries[baseIndex]
    const hi = baseStructuralBoundaries[baseIndex + 1] ?? structuralHi
    if (compareExact(lo, hi) >= 0) continue
    const intervalSites = new Map<string, EventScale>([[eventKey(lo), lo]])
    const initialScale = rationalBetweenExact(lo, hi)
    const initialMeasured = measureFrozenMeshCentreEvidence(contour, initialScale, rational(RELEASED_PADDING_MM), rational(MASS_DEPTH_MM))
    if (initialMeasured.status === 'unresolved') continue
    for (const { affine } of initialMeasured.transitionAnchors) {
      const anchorQueue: Array<readonly [EventScale, EventScale]> = [[lo, hi]]
      while (anchorQueue.length) {
        const [left, right] = anchorQueue.shift()!
        if (compareExact(left, right) >= 0) continue
        const scale = rationalBetweenExact(left, right)
        const roots = new Map<string, EventScale>()
        for (const threshold of [rational(0), rational(RELEASED_PADDING_MM), rational(MASS_DEPTH_MM)]) {
          for (const event of enumerateAffinePointContactEvents(initialMeasured.transitionContour, affine, band, threshold, scale, pointEventCache, pointRootCache)) {
            if (compareExact(event.scale, left) > 0 && compareExact(event.scale, right) < 0) roots.set(eventKey(event.scale), event.scale)
          }
        }
        if (!roots.size) continue
        const split = sortedUniqueExact([left, ...roots.values(), right])
        for (const root of roots.values()) {
          intervalSites.set(eventKey(root), root)
          structuralSites.set(eventKey(root), root)
        }
        for (let index = 0; index + 1 < split.length; index++) anchorQueue.push([split[index], split[index + 1]])
      }
    }
    const initialGovernorBoundaries = sortedUniqueExact(intervalSites.values())
    const governorQueue = initialGovernorBoundaries.map((left, index) => [left, initialGovernorBoundaries[index + 1] ?? hi] as const)
    while (governorQueue.length) {
      const [left, right] = governorQueue.shift()!
      if (compareExact(left, right) >= 0) continue
      const scale = rationalBetweenExact(left, right)
      const measured = measureFrozenMeshCentreEvidence(contour, scale, rational(RELEASED_PADDING_MM), rational(MASS_DEPTH_MM))
      if (measured.status === 'unresolved') continue
      const roots = new Map<string, EventScale>()
      for (const comparison of measured.transitionComparisons) {
        const comparisonEventRoots = comparisonRoots(comparison.equation, band)
        for (const root of comparisonEventRoots) {
          if (compareExact(root, left) > 0 && compareExact(root, right) < 0) roots.set(eventKey(root), root)
        }
      }
      if (!roots.size) continue
      const split = sortedUniqueExact([left, ...roots.values(), right])
      for (const root of roots.values()) {
        intervalSites.set(eventKey(root), root)
        structuralSites.set(eventKey(root), root)
      }
      for (let index = 0; index + 1 < split.length; index++) governorQueue.push([split[index], split[index + 1]])
    }
  }
  const radius = addRational(rational(RELEASED_PADDING_MM), allowedWrap(config))
  const lawSites = new Map(structuralSites)
  const structuralBoundaries = sortedUniqueExact(structuralSites.values())
  for (let index = 0; index < structuralBoundaries.length; index++) {
    const lo = structuralBoundaries[index]
    const hi = structuralBoundaries[index + 1] ?? structuralHi
    if (compareExact(lo, hi) >= 0) continue
    const branchScale = rationalBetweenExact(lo, hi)
    const affineTargets = meshCentrePolicy
      ? measureFrozenMeshCentreEvidence(contour, branchScale, rational(RELEASED_PADDING_MM), rational(MASS_DEPTH_MM))
      : null
    if (affineTargets?.status === 'unresolved') continue
    const targetAffines = affineTargets?.status === 'measured'
      ? affineTargets.affineTargets.map(({ affine }) => affine)
      : [{
          coefficient: config.centrePolicy.mode === 'weight'
            ? exactWeightTargetCoefficient(contour)
            : exactBoxTargetCoefficient(contour),
          offset: [rational(0), rational(0)] as const,
        }]
    const lawQueue: Array<readonly [EventScale, EventScale]> = [[lo, hi]]
    while (lawQueue.length) {
      const [left, right] = lawQueue.shift()!
      if (compareExact(left, right) >= 0) continue
      const scale = rationalBetweenExact(left, right)
      const roots = new Map<string, EventScale>()
      for (const affine of targetAffines) {
        for (const event of enumerateAffineContactEvents(contour, affine.coefficient, band, DEFAULT_PITCH_MM, radius, scale, affine.offset)) {
          if (compareExact(event.scale, left) > 0 && compareExact(event.scale, right) < 0) roots.set(eventKey(event.scale), event.scale)
        }
      }
      if (!roots.size) continue
      const split = sortedUniqueExact([left, ...roots.values(), right])
      for (const root of roots.values()) lawSites.set(eventKey(root), root)
      for (let splitIndex = 0; splitIndex + 1 < split.length; splitIndex++) lawQueue.push([split[splitIndex], split[splitIndex + 1]])
    }
  }
  const boundaries = sortedUniqueExact(lawSites.values())
  const complete = [...boundaries, ...representatives(boundaries)]
  return complete.sort((left, right) => compareExact(left, right))
}

function solveBandsExact(input: SolveBandsInput): AllBandsResult {
  let contour: Contour
  try { contour = validatedNormalizedContour(input.contour) } catch {
    const refusal = { status: 'refused' as const, code: 'REGIME_UNRESOLVED' as const, evidence: { boundaryTruth: input.contour.truth.contourIdentity } }
    return { status: 'refused', refusal, bands: BANDS.map((band) => ({ band: band.id, rungs: [], refusal })), centreEvidenceById: {} }
  }
  const policy: EvaluationPolicy = { ...input.config, policyIdentity: policyIdentityOf(input.config) }
  const centreEvaluations: ReturnType<typeof evaluateCentreLaw>[] = [], candidateEvaluations: CandidateLawEvaluation[] = []
  const evidenceById: Record<string, CentreBranchMeasurement['evidence']> = {}
  for (const band of BANDS) {
    const sites = enumerateBandSites(contour, band, input.config)
    for (const scale of sites) {
      const evaluated = evaluateExactSite(contour, input.contour.truth, band, scale, policy)
      centreEvaluations.push(...evaluated.centres)
      candidateEvaluations.push(...evaluated.candidates)
      if (evaluated.evidence) evidenceById[evaluated.evidence.id] = evaluated.evidence
    }
  }
  const reduced = reduceBandLadders(centreEvaluations, candidateEvaluations)
  const bands: BandResult[] = reduced.bands.map((band) => ({
    band: band.band,
    rungs: band.rungs.map((rung): LawfulRung => ({
      band: rung.band, scale: rung.scale, magnetCount: rung.magnetCount, firstLawful: rung.firstLawful,
      layouts: rung.candidates.map((candidate): LawfulLayout => ({
        candidateId: candidate.measuredId, layoutId: candidate.geometryLayoutId, anchors: candidate.anchors,
        belt: candidate.belt, centre: candidate.centre, centreEvidenceId: candidate.centreEvidence.id,
        requiredFlap: candidate.requiredFlap, appliedFlap: candidate.appliedFlap, contacts: candidate.contacts,
        phase: candidate.phase, pitchMM: DEFAULT_PITCH_MM, spotRadiusMM: RELEASED_PADDING_MM,
      })),
    })),
    ...(band.refusal ? { refusal: { code: band.refusal.code, evidence: band.refusal.evidence } } : {}),
  }))
  return reduced.globalRefusal
    ? { status: 'refused', refusal: reduced.globalRefusal, bands, centreEvidenceById: evidenceById }
    : { status: 'evaluated', bands, centreEvidenceById: evidenceById }
}

function inspectFixedSizeExact(input: InspectFixedSizeInput): FixedSizeInspection {
  const scale = rationalFromNumber(input.sizeMM), contour = validatedNormalizedContour(input.contour)
  const band = BANDS.find((candidate) => scaleInBand(scale, candidate)) ?? BANDS[BANDS.length - 1]
  const policy: EvaluationPolicy = { ...input.config, policyIdentity: policyIdentityOf(input.config) }
  const evaluated = evaluateExactSite(contour, input.contour.truth, band, scale, policy, input.forcedPhaseMM)
  const candidates: CandidateInspection[] = evaluated.candidates.map((result) => inspectCandidateLaws(result, policy))
  return { status: 'inspection', candidates }
}

export const magneticGridEngine: MagneticGridEngine = {
  solveBands: solveBandsExact,
  inspectFixedSize: inspectFixedSizeExact,
  policyIdentityOf,
}
export const solveBands = solveBandsExact
export const inspectFixedSize = inspectFixedSizeExact
