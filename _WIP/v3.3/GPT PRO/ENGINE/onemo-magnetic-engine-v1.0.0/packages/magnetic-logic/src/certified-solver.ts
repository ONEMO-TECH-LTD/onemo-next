import {
  COMPUTE_ARTIFACT_HASH,
  adaptiveFeasibleTranslations,
  canonicalHash,
  computeGlobalAnchor,
  descriptorDirections,
  discContainedExact,
  evaluateCriterionOnBox,
  finalRegistrationTieBreak,
  optimizeCriterion,
  possiblyEquivalentToAnchor,
  preparePolygon,
  restrictCriterionToAnchor,
  scaleToDominantDimension,
  type AdaptiveBox,
  type CompoundScoreInterval,
  type GeometryCriterionDescriptor,
  type Point,
  type RegionEvidence,
  type ScoreInterval
} from '@onemo/geometry-compute';
import type {
  BandId,
  CandidateHypothesis,
  CandidateScoreTrace,
  MechanicsCriterionPolicy,
  RegisteredProfile,
  SizeFailure,
  SizeSolution
} from './contracts.js';
import { classifyAxis, overallBand } from './bands.js';
import { permittedPatterns } from './patterns-permissions.js';
import { frameFits, frameForPattern, patternOffsetsMm, translationDomain } from './frames-registration.js';
import { buildStructuralEvidence, majorRegionEvidence } from './region-policy.js';
import { candidateDiscreteKey, criterionDescriptor, criterionTolerances } from './mechanics.js';

interface ContinuousCandidate {
  readonly hypothesis: CandidateHypothesis;
  readonly regions: readonly RegionEvidence[];
  readonly trace: readonly CandidateScoreTrace[];
  readonly boxes: readonly AdaptiveBox[];
}

type Direction = 'MIN' | 'MAX';

function asComponents(score: ScoreInterval | CompoundScoreInterval): readonly ScoreInterval[] {
  return 'components' in score ? score.components : [score];
}

function symmetricEquivalent(
  a: ScoreInterval,
  b: ScoreInterval,
  direction: Direction,
  tolerance: number
): boolean {
  return direction === 'MIN'
    ? a.upper <= b.lower + tolerance && b.upper <= a.lower + tolerance
    : a.lower >= b.upper - tolerance && b.lower >= a.upper - tolerance;
}

/** Returns -1 when a is certified better, +1 when b is certified better, 0 when
 * certified equivalent, and null when the current intervals are not decisive. */
function compareCertified(
  aScore: ScoreInterval | CompoundScoreInterval,
  bScore: ScoreInterval | CompoundScoreInterval,
  directions: readonly Direction[],
  tolerances: readonly number[]
): -1 | 0 | 1 | null {
  const a = asComponents(aScore);
  const b = asComponents(bScore);
  for (let index = 0; index < directions.length; index += 1) {
    const direction = directions[index]!;
    const tolerance = tolerances[index] ?? 0;
    const x = a[index]!;
    const y = b[index]!;
    if (symmetricEquivalent(x, y, direction, tolerance)) continue;
    if (direction === 'MIN') {
      if (x.upper < y.lower - tolerance) return -1;
      if (y.upper < x.lower - tolerance) return 1;
    } else {
      if (x.lower > y.upper + tolerance) return -1;
      if (y.lower > x.upper + tolerance) return 1;
    }
    return null;
  }
  return 0;
}


function boxCertifiedEquivalentToAnchor(
  score: ScoreInterval | CompoundScoreInterval,
  anchor: ScoreInterval | CompoundScoreInterval,
  directions: readonly Direction[],
  tolerances: readonly number[]
): boolean {
  const values = asComponents(score);
  const anchors = asComponents(anchor);
  return directions.every((direction, index) => {
    const value = values[index]!;
    const reference = anchors[index]!;
    const tolerance = tolerances[index] ?? 0;
    return direction === 'MIN'
      ? value.upper <= reference.lower + tolerance
      : value.lower >= reference.upper - tolerance;
  });
}

function compareDiscreteKey(a: readonly (string | number)[], b: readonly (string | number)[]): number {
  const count = Math.max(a.length, b.length);
  for (let index = 0; index < count; index += 1) {
    const x = a[index];
    const y = b[index];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x).localeCompare(String(y));
  }
  return 0;
}

function expectedBandForTarget(target: number, profile: RegisteredProfile): BandId | undefined {
  return profile.sizeDomain.bands.find((band) =>
    target >= band.minMm - 1e-12 && (band.maxInclusive ? target <= band.maxMm + 1e-12 : target < band.maxMm - 1e-12)
  )?.id;
}

function makeHypotheses(
  polygon: ReturnType<typeof scaleToDominantDimension>,
  target: number,
  band: BandId,
  classX: NonNullable<ReturnType<typeof classifyAxis>>,
  classY: NonNullable<ReturnType<typeof classifyAxis>>,
  profile: RegisteredProfile
): { readonly candidates: readonly ContinuousCandidate[]; readonly reasons: readonly string[] } {
  const structural = buildStructuralEvidence(polygon, profile);
  const regions = majorRegionEvidence(structural);
  const domain = translationDomain(profile);
  const radius = profile.safety.effectiveVerificationRadiusMm;
  const candidates: ContinuousCandidate[] = [];
  const reasons: string[] = [];
  const initialTolerance = Math.max(profile.numeric.feasibilityCoarseToleranceMm, profile.numeric.approximationToleranceMm);
  for (const { pattern, permission } of permittedPatterns(profile, band, classX, classY)) {
    const frame = frameForPattern(pattern);
    if (!frameFits(frame, classX, classY)) continue;
    const offsetsMm = patternOffsetsMm(profile, pattern);
    const feasible = adaptiveFeasibleTranslations(
      polygon,
      offsetsMm,
      radius,
      domain,
      {
        toleranceMm: initialTolerance,
        maxCells: profile.numeric.maxAdaptiveCells,
        quantumMm: profile.numeric.coordinateQuantumMm,
        maxDepth: 32,
        witnessIterations: 20
      },
      { x: 0, y: 0 }
    );
    if (feasible.status === 'INFEASIBLE_CERTIFIED') {
      reasons.push(`${pattern.id}:NO_ROBUST_FEASIBLE_REGISTRATION`);
      continue;
    }
    const boxes = [...feasible.insideBoxes, ...feasible.boundaryBoxes];
    if (boxes.length === 0) {
      reasons.push(`${pattern.id}:${feasible.status}`);
      continue;
    }
    const hypothesis: CandidateHypothesis = {
      id: `${target}:${pattern.id}`,
      sizeMm: target,
      band,
      classX,
      classY,
      frame,
      pattern,
      permission,
      offsetsMm,
      feasible,
      boxes,
      scoreTrace: [],
      polygon
    };
    candidates.push({ hypothesis, regions, trace: [], boxes });
  }
  return { candidates: Object.freeze(candidates), reasons: Object.freeze(reasons) };
}

function optimiseCriterionAcrossCandidates(
  input: readonly ContinuousCandidate[],
  policy: MechanicsCriterionPolicy,
  profile: RegisteredProfile
): { readonly status: 'CERTIFIED'; readonly candidates: readonly ContinuousCandidate[] } | { readonly status: 'INDETERMINATE' } {
  if (input.length === 0) return { status: 'CERTIFIED', candidates: [] };
  const local = input.map((candidate) => {
    const descriptor = criterionDescriptor(policy, candidate.hypothesis, profile, candidate.regions);
    const tolerances = criterionTolerances(policy, candidate.hypothesis, profile);
    const result = optimizeCriterion(
      candidate.hypothesis.polygon,
      candidate.hypothesis.offsetsMm,
      profile.safety.effectiveVerificationRadiusMm,
      candidate.boxes,
      descriptor,
      tolerances,
      {
        toleranceMm: profile.numeric.approximationToleranceMm,
        maxCells: profile.numeric.maxAdaptiveCells,
        quantumMm: profile.numeric.coordinateQuantumMm,
        maxDepth: 32,
        witnessIterations: 20
      }
    );
    return { candidate, descriptor, tolerances, result };
  });

  // Dominance-safe pruning: a candidate is removed only if another candidate is
  // certified better under the complete current scalar/compound comparator.

  const survivingLocal = local.filter((item, index) => !local.some((other, otherIndex) => {
    if (index === otherIndex) return false;
    const comparison = compareCertified(
      item.result.optimum,
      other.result.optimum,
      descriptorDirections(item.descriptor),
      item.tolerances
    );
    return comparison === 1;
  }));
  if (survivingLocal.length === 0) return { status: 'INDETERMINATE' };

  // Earlier components must be certified equivalent before a later criterion may
  // run. Overlap without equivalence is uncertainty, not a tie.
  for (let left = 0; left < survivingLocal.length; left += 1) {
    for (let right = left + 1; right < survivingLocal.length; right += 1) {
      const a = survivingLocal[left]!;
      const b = survivingLocal[right]!;
      const comparison = compareCertified(a.result.optimum, b.result.optimum, descriptorDirections(a.descriptor), a.tolerances);
      if (comparison === null || comparison === -1 || comparison === 1) return { status: 'INDETERMINATE' };
    }
  }

  const directions = descriptorDirections(survivingLocal[0]!.descriptor);
  const anchor = computeGlobalAnchor(survivingLocal.map((item) => item.result.optimum), directions, survivingLocal[0]!.tolerances);
  const restricted: ContinuousCandidate[] = [];
  for (const item of survivingLocal) {
    if (!possiblyEquivalentToAnchor(item.result.optimum, anchor, directions, item.tolerances)) continue;
    const result = restrictCriterionToAnchor(
      item.candidate.hypothesis.polygon,
      item.candidate.hypothesis.offsetsMm,
      profile.safety.effectiveVerificationRadiusMm,
      item.candidate.boxes,
      item.descriptor,
      anchor,
      item.tolerances,
      {
        toleranceMm: profile.numeric.approximationToleranceMm,
        maxCells: profile.numeric.maxAdaptiveCells,
        quantumMm: profile.numeric.coordinateQuantumMm,
        maxDepth: 32,
        witnessIterations: 20
      }
    );
    if (result.survivingBoxes.length === 0) continue;
    if (result.status !== 'CERTIFIED') {
      const everySurvivorEquivalent = result.survivingBoxes.every((box) =>
        boxCertifiedEquivalentToAnchor(
          evaluateCriterionOnBox(item.candidate.hypothesis.polygon, item.candidate.hypothesis.offsetsMm, box, item.descriptor).score,
          anchor,
          directions,
          item.tolerances
        )
      );
      if (!everySurvivorEquivalent) return { status: 'INDETERMINATE' };
    }
    const trace: CandidateScoreTrace = {
      criterionId: policy.id,
      descriptorId: item.descriptor.id,
      score: item.result.optimum,
      status: 'CERTIFIED'
    };
    restricted.push({
      ...item.candidate,
      boxes: result.survivingBoxes,
      trace: Object.freeze([...item.candidate.trace, trace])
    });
  }
  return { status: 'CERTIFIED', candidates: Object.freeze(restricted) };
}

export interface CertifiedSizeInput {
  readonly outlineMm: readonly Point[];
  readonly profile: RegisteredProfile;
  readonly targetDominantMm: number;
}

/** Certifies one selected physical size. This is intentionally separate from the
 * low-latency preview solve: production specifications must be created from this
 * continuous-domain, dominance-safe path. */
export function certifySizeSolution(input: CertifiedSizeInput): SizeSolution | SizeFailure {
  const { profile, targetDominantMm: target } = input;
  const source = preparePolygon(input.outlineMm, {
    quantumMm: profile.numeric.coordinateQuantumMm,
    maxVertices: profile.numeric.maxVertices
  });
  const polygon = scaleToDominantDimension(source, target);
  const classX = classifyAxis(polygon.metrics.width, profile.sizeDomain.bands);
  const classY = classifyAxis(polygon.metrics.height, profile.sizeDomain.bands);
  const expectedBand = expectedBandForTarget(target, profile);
  if (!classX || !classY) {
    return expectedBand
      ? { status: 'REJECTED', targetDominantMm: target, band: expectedBand, reasons: ['NO_AXIS_CLASS'] }
      : { status: 'REJECTED', targetDominantMm: target, reasons: ['NO_AXIS_CLASS'] };
  }
  const band = overallBand(classX, classY);
  const built = makeHypotheses(polygon, target, band, classX, classY, profile);
  let candidates = [...built.candidates];
  if (candidates.length === 0) {
    return { status: 'REJECTED', targetDominantMm: target, band, reasons: built.reasons.length ? built.reasons : ['NO_PERMITTED_PATTERN'] };
  }
  for (const policy of profile.mechanics.criteria) {
    const result = optimiseCriterionAcrossCandidates(candidates, policy, profile);
    if (result.status === 'INDETERMINATE') {
      return {
        status: 'DECISION_INDETERMINATE',
        targetDominantMm: target,
        band,
        reasons: ['CRITERION_SCORE_UNCERTAIN', policy.id]
      };
    }
    candidates = [...result.candidates];
    if (candidates.length === 0) {
      return { status: 'REJECTED', targetDominantMm: target, band, reasons: ['NO_APPROVED_PATTERN'] };
    }
  }

  candidates.sort((a, b) => compareDiscreteKey(candidateDiscreteKey(a.hypothesis), candidateDiscreteKey(b.hypothesis)));
  const winner = candidates[0]!;
  const tie = finalRegistrationTieBreak(
    polygon,
    winner.hypothesis.offsetsMm,
    profile.safety.effectiveVerificationRadiusMm,
    winner.boxes,
    { x: 0, y: 0 },
    profile.numeric.coordinateQuantumMm
  );
  if (tie.status !== 'SELECTED' || !tie.point) {
    return {
      status: tie.status === 'FEASIBLE_BELOW_OUTPUT_QUANTUM' ? 'DECISION_INDETERMINATE' : 'DECISION_INDETERMINATE',
      targetDominantMm: target,
      band,
      reasons: [tie.status]
    };
  }
  const proofs = winner.hypothesis.pattern.cells.map((cell, index) => {
    const offset = winner.hypothesis.offsetsMm[index]!;
    const point = { x: tie.point!.x + offset.x, y: tie.point!.y + offset.y };
    const proof = discContainedExact(polygon, point, profile.safety.effectiveVerificationRadiusMm);
    return { cell, xMm: proof.point.x, yMm: proof.point.y, clearanceMm: proof.clearanceMm, marginMm: proof.marginMm, legal: proof.legal };
  });
  if (!proofs.every((proof) => proof.legal)) {
    return { status: 'REJECTED', targetDominantMm: target, band, reasons: ['EXACT_REVALIDATION_FAILED'] };
  }
  const centres = proofs.map(({ legal: _legal, ...rest }) => rest);
  const result: SizeSolution = {
    status: 'ACCEPTED',
    targetDominantMm: target,
    widthMm: polygon.metrics.width,
    heightMm: polygon.metrics.height,
    scale: polygon.metrics.dominantDimension / source.metrics.dominantDimension,
    classX,
    classY,
    band,
    frame: winner.hypothesis.frame,
    patternId: winner.hypothesis.pattern.id,
    registration: tie.point,
    centres: Object.freeze(centres),
    minimumMarginMm: Math.min(...centres.map((centre) => centre.marginMm)),
    scoreTrace: Object.freeze(winner.trace),
    geometryHash: polygon.geometryHash,
    decisionProof: 'CERTIFIED_CONTINUOUS_OPTIMUM',
    finalRingInt: Object.freeze(polygon.ringInt.map((point) => Object.freeze([point.x, point.y] as const)))
  };
  // Materialise the result once through the canonicaliser during tests/callers;
  // this catches accidental non-serialisable evidence early.
  void canonicalHash({ result, computeArtifactHash: COMPUTE_ARTIFACT_HASH });
  return Object.freeze(result);
}
