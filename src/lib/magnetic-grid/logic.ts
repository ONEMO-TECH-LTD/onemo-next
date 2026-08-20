// The centre law. No geometry construction: measurements come in, a decision goes out.
//
// Two layers live here deliberately. The CLONED donor selection (`governMass`,
// `evaluateCentrePolicy`, `chooseCentreRulesCandidate`) is preserved verbatim so the accepted
// centring behaviour can be proved unchanged against the bench. The EXACT selection below applies
// the same nine ruled policies to certified evidence instead of mesh samples — same branches, same
// meanings, same governor set — and differs only where the old ruler was measurably wrong.
//
// Import law: logic's only arithmetic is `compareExact` on rationals. It ranks branches by area,
// depth and height, all published by compute as certified enclosures, and never reaches into
// geometry to find a coordinate. It decides WHICH branch governs, never where anything is.

import { compareExact } from './compute'
import type {
  Bounds,
  BoundedPoint,
  CentreBranchEvidence,
  CentreChoice,
  CentreBranchName,
  CentreDecision,
  CentreMeasurements,
  CentrePolicy,
  CentreRefusalCode,
  ExactCentreInput,
  ExactCentreVerdict,
  Governor,
  ParityCandidateMeasurement,
  Pt,
} from './spec'

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

const governorNumber = (policy: Extract<CentrePolicy, { mode: 'masses' }>): Governor =>
  policy.governor === 'smallest' ? 0
    : policy.governor === 'deepest' ? 1
      : policy.governor === 'top' ? 2 : 3

function decision(policy: CentrePolicy, target: [number, number], branch: CentreDecision['branch'], regionIndex: number | null, massIndex: number | null): CentreDecision {
  return { policy, target, branch, regionIndex, massIndex }
}

export function evaluateCentrePolicy(measured: CentreMeasurements, policy: CentrePolicy): CentreDecision {
  if (policy.mode === 'box') return decision(policy, measured.box, 'box', null, null)
  if (policy.mode === 'weight') return decision(policy, measured.weight, 'weight', null, null)
  if (policy.mode === 'core') return decision(policy, measured.core, 'core', null, null)
  const masses = measured.masses
  if (!masses.length) return decision(policy, measured.box, policy.mode === 'masses' ? 'mass' : policy.mode, null, null)
  if (policy.mode === 'deep') {
    let best = measured.regions[0]
    let regionIndex = 0
    for (let index = 1; index < measured.regions.length; index++) {
      if (measured.regions[index].peakClearMM > best.peakClearMM) { best = measured.regions[index]; regionIndex = index }
    }
    return decision(policy, best.centreMM, 'deep', regionIndex, null)
  }
  if (policy.mode === 'top') {
    let best = masses[0]
    for (const candidate of masses) if (candidate.region.centreMM[1] > best.region.centreMM[1]) best = candidate
    return decision(policy, best.region.centreMM, 'top', best.regionIndex, best.massIndex)
  }
  const governed = governMass(masses.map((item) => item.region), governorNumber(policy), measured.midY)
  const selected = masses.find((item) => item.region === governed) ?? masses[0]
  return decision(policy, selected.region.centreMM, 'mass', selected.regionIndex, selected.massIndex)
}

export function chooseCentreRulesCandidate(candidates: readonly ParityCandidateMeasurement[]): ParityCandidateMeasurement | null {
  let best: ParityCandidateMeasurement | null = null
  for (const candidate of candidates) {
    if (!candidate.seated.length) continue
    const wins = !best
      || candidate.seated.length > best.seated.length
      || (candidate.seated.length === best.seated.length && candidate.canonAxes > best.canonAxes)
      || (candidate.seated.length === best.seated.length && candidate.canonAxes === best.canonAxes && candidate.excessMM < best.excessMM)
    if (wins) best = candidate
  }
  return best
}

// ---- the exact centre law ---------------------------------------------------------------------

/**
 * Order two certified quantities.
 *
 * Separated enclosures decide. EQUALITY is only ever claimed for identical ZERO-WIDTH bounds: two
 * different values can share the same enclosure, so identical wide bounds prove nothing and calling
 * them equal would manufacture a tie. Everything else is genuinely unresolved at this precision and
 * is reported, because the governor reads this ranking and a silent choice here is a silent centre.
 *
 * A known boundary, stated rather than papered over: an AREA that includes an arc carries π, so it
 * is a certified enclosure and not an exact algebraic value. Two congruent islands — the dumbbell's
 * two lobes — therefore have areas that no refinement can prove EQUAL, only ever fail to separate.
 * Ranking by area on such a shape reports unresolved, which R14 §7.1b sanctions explicitly ("if
 * bounds cannot separate ... return CENTRE_EVIDENCE_UNRESOLVED — never a sampled point"). Clearance
 * and coordinates are exact algebraic values and do not share this limit; the donor's float
 * comparison merely picked one lobe and called it smallest.
 */
function rank(a: Bounds, b: Bounds): -1 | 0 | 1 | null {
  if (compareExact(a.hi, b.lo) < 0) return -1
  if (compareExact(a.lo, b.hi) > 0) return 1
  const aExact = compareExact(a.lo, a.hi) === 0
  const bExact = compareExact(b.lo, b.hi) === 0
  if (aExact && bExact && compareExact(a.lo, b.lo) === 0) return 0
  return null
}

type Extreme =
  | { readonly kind: 'winners'; readonly winners: readonly CentreBranchEvidence[] }
  | { readonly kind: 'unresolved'; readonly reason: string }

/**
 * The branches that are extreme under `of`, keeping every exact tie.
 *
 * A branch whose measurement is absent is NOT skipped: it could have been the winner, so dropping it
 * would select another branch on incomplete evidence. Its absence is propagated as unresolved.
 */
function extremes(
  branches: readonly CentreBranchEvidence[],
  of: (branch: CentreBranchEvidence) => Bounds | null,
  want: -1 | 1,
  what: string,
): Extreme {
  const winners: CentreBranchEvidence[] = []
  for (const branch of branches) {
    const value = of(branch)
    if (!value) {
      return { kind: 'unresolved', reason: `a branch has no ${what} (${branch.maximum}), so the ranking is incomplete` }
    }
    if (!winners.length) { winners.push(branch); continue }
    const order = rank(value, of(winners[0])!)
    if (order === null) return { kind: 'unresolved', reason: `two branches' ${what} could not be ordered exactly` }
    if (order === want) { winners.length = 0; winners.push(branch) }
    else if (order === 0) winners.push(branch)
  }
  return { kind: 'winners', winners }
}

/**
 * Turn a settled ranking into one of the three authorized outcomes.
 *
 * A branch whose own maximum is a finite TIE still yields centres a grid can be placed on, so
 * its co-equal points are enumerated into the tie. A RIDGE yields none — it establishes no unique
 * governed centre and no finite set — so it refuses, naming the continuum rather than posing as an
 * answer parity cannot use.
 */
function choicesOf(branch: CentreBranchEvidence, name: CentreBranchName): readonly CentreChoice[] {
  const identity = { branch: name, islandIndex: branch.islandIndex, massIndex: branch.massIndex }
  if (branch.centre) return [{ target: branch.centre, ...identity }]
  return branch.coEqual.map((target) => ({ target, ...identity }))
}

function verdictFrom(result: Extreme, policy: CentrePolicy, evidenceId: string, name: CentreBranchName, what: string): ExactCentreVerdict {
  if (result.kind === 'unresolved') return { status: 'refused', policy, evidenceId, code: 'CENTRE_EVIDENCE_UNRESOLVED', reason: result.reason }
  const { winners } = result
  if (!winners.length) return { status: 'refused', policy, evidenceId, code: 'NO_SAFE_CORE', reason: `no branch offers ${what}` }
  const continuum = winners.find((candidate) => !candidate.centre && !candidate.coEqual.length)
  if (continuum) {
    return {
      status: 'refused',
      policy,
      evidenceId,
      code: 'CENTRE_TIE_UNRESOLVED',
      reason: `the governing branch's maximum is a ${continuum.maximum}, which establishes no unique governed centre`,
    }
  }
  const choices = winners.flatMap((winner) => choicesOf(winner, name))
  if (!choices.length) return { status: 'refused', policy, evidenceId, code: 'NO_CENTRE', reason: 'the governing branch names no centre' }
  if (choices.length === 1) return { status: 'decided', policy, evidenceId, decision: choices[0] }
  return { status: 'tie', policy, evidenceId, decisions: [choices[0], choices[1], ...choices.slice(2)] }
}

/**
 * Apply one of the nine ruled policies to certified evidence. The branch meanings are the donor's,
 * unchanged: box and weight are shape-only points, core is the area-weighted mean of the islands,
 * deep takes the island of greatest peak clearance, top the highest mass, and Masses governs by the
 * chosen dial — smallest area, greatest depth, highest, or the top-small hybrid. What differs is
 * that every comparison is exact, and anything unresolvable is named instead of settled by luck.
 */
export function evaluateExactCentre(input: ExactCentreInput, policy: CentrePolicy): ExactCentreVerdict {
  const { evidenceId } = input
  const fixedPoint = (target: BoundedPoint | null, branch: CentreBranchName, code: CentreRefusalCode, why: string): ExactCentreVerdict =>
    target
      ? { status: 'decided', policy, evidenceId, decision: { target, branch, islandIndex: null, massIndex: null } }
      : { status: 'refused', policy, evidenceId, code, reason: why }

  // Box and weight are read from the supplied shape alone, so an unresolved island cannot affect
  // them and must not block them. Every other branch governs by island or mass evidence, and an
  // incomplete region set makes that ranking unsound — so it refuses, naming the reason.
  if (policy.mode === 'box') return fixedPoint(input.box, 'box', 'NO_CENTRE', 'no bounding box')
  if (policy.mode === 'weight') return fixedPoint(input.weight, 'weight', 'NO_CENTRE', 'no material weight centre')
  if (input.unresolved.length) {
    return { status: 'refused', policy, evidenceId, code: 'CENTRE_EVIDENCE_UNRESOLVED', reason: input.unresolved[0] }
  }
  if (policy.mode === 'core') return fixedPoint(input.core, 'core', 'NO_SAFE_CORE', 'no legal island to weight')
  if (policy.mode === 'deep') return verdictFrom(extremes(input.islands, (b) => b.peakClear, 1, 'peak clearance'), policy, evidenceId, 'deep', 'a peak clearance')

  // Every mass-governed policy falls back to the box when the shape has no depth mass at all —
  // the donor's behaviour, preserved.
  const masses = input.masses
  if (!masses.length) return fixedPoint(input.box, policy.mode === 'top' ? 'top' : 'mass', 'NO_SAFE_CORE', 'no depth mass and no bounding box')
  if (policy.mode === 'top') return verdictFrom(extremes(masses, (b) => b.centre?.y ?? null, 1, 'governed height'), policy, evidenceId, 'top', 'a governed height')

  if (policy.governor === 'smallest') return verdictFrom(extremes(masses, (b) => b.area, -1, 'area'), policy, evidenceId, 'mass', 'an area')
  if (policy.governor === 'deepest') return verdictFrom(extremes(masses, (b) => b.peakClear, 1, 'peak clearance'), policy, evidenceId, 'mass', 'a peak clearance')
  if (policy.governor === 'top') return verdictFrom(extremes(masses, (b) => b.centre?.y ?? null, 1, 'governed height'), policy, evidenceId, 'mass', 'a governed height')

  // top-small: the smallest mass in the upper half, or the highest mass when none qualifies — the
  // hybrid ruled to stop a foot-sliver governing a body.
  const upper: CentreBranchEvidence[] = []
  for (const branch of masses) {
    const y = branch.centre?.y
    if (!y) return { status: 'refused', policy, evidenceId, code: 'CENTRE_EVIDENCE_UNRESOLVED', reason: `a mass has no governed height (${branch.maximum}), so upper-half membership is undecided` }
    if (compareExact(y.lo, input.midY) >= 0) upper.push(branch)
    else if (compareExact(y.hi, input.midY) >= 0) {
      return { status: 'refused', policy, evidenceId, code: 'CENTRE_EVIDENCE_UNRESOLVED', reason: 'a mass straddles the mid-height line' }
    }
  }
  if (upper.length) return verdictFrom(extremes(upper, (b) => b.area, -1, 'area'), policy, evidenceId, 'mass', 'an area above mid-height')
  return verdictFrom(extremes(masses, (b) => b.centre?.y ?? null, 1, 'governed height'), policy, evidenceId, 'mass', 'a governed height')
}
