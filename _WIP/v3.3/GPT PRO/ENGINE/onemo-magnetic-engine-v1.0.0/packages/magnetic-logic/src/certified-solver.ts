import {
  COMPUTE_ARTIFACT_HASH,
  adaptiveFeasibleTranslations,
  canonicalHash,
  compareCertifiedScores,
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
  type Direction,
  type GeometryCriterionDescriptor,
  type Point,
  type PreparedPolygon,
  type RegionEvidence,
  type ScoreInterval
} from '@onemo/geometry-compute';
import type {
  BandId,
  CandidateHypothesis,
  CandidateScoreTrace,
  MechanicsCriterionPolicy,
  ProductProfile,
  RegisteredProfile,
  SizeFailure,
  SizeSolution
} from './contracts.js';
import { registerProfile } from './profile-registry.js';
import { classifyAxis, overallBand } from './bands.js';
import { permittedPatterns } from './patterns-permissions.js';
import { frameFits, framesForPattern, patternCellsForFrame, patternOffsetsMm, translationDomain } from './frames-registration.js';
import { buildStructuralEvidence, majorRegionEvidence } from './region-policy.js';
import { criterionDescriptor, criterionTolerances } from './mechanics.js';
import { selectDiscreteIdentity } from './selection.js';

interface ContinuousCandidate {
  readonly hypothesis: CandidateHypothesis;
  readonly regions: readonly RegionEvidence[];
  readonly trace: readonly CandidateScoreTrace[];
  readonly boxes: readonly AdaptiveBox[];
}

function asComponents(score: ScoreInterval | CompoundScoreInterval): readonly ScoreInterval[] {
  return 'components' in score ? score.components : [score];
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

function permissionBoxes(
  polygon: ReturnType<typeof scaleToDominantDimension>,
  offsetsMm: readonly Point[],
  boxes: readonly AdaptiveBox[],
  regions: readonly RegionEvidence[],
  permission: CandidateHypothesis['permission']
): { readonly boxes: readonly AdaptiveBox[]; readonly uncertain: boolean } {
  const descriptor: GeometryCriterionDescriptor = { id: 'REGION_COVERAGE_V1', regions };
  let uncertain = false;
  const allowed = boxes.filter((box) => {
    const [coverage, outside] = asComponents(evaluateCriterionOnBox(polygon, offsetsMm, box, descriptor).score);
    const coveragePass = coverage!.lower >= permission.requiredMajorRegionsCovered;
    const marginalPass = permission.marginalNodesAllowed || outside!.upper === 0;
    if (coveragePass && marginalPass) return true;
    const impossible = coverage!.upper < permission.requiredMajorRegionsCovered || (!permission.marginalNodesAllowed && outside!.lower > 0);
    if (!impossible) uncertain = true;
    return false;
  });
  return { boxes: Object.freeze(allowed), uncertain };
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
): { readonly candidates: readonly ContinuousCandidate[]; readonly reasons: readonly string[]; readonly structuralIndeterminate: boolean } {
  const structural = buildStructuralEvidence(polygon, profile);
  if(structural.status==='INDETERMINATE')return{candidates:Object.freeze([]),reasons:structural.reasons,structuralIndeterminate:true};
  const regions = majorRegionEvidence(structural);
  const domain = translationDomain(profile);
  const radius = profile.safety.effectiveVerificationRadiusMm;
  const candidates: ContinuousCandidate[] = [];
  const reasons: string[] = [];
  const initialTolerance = Math.max(profile.numeric.feasibilityCoarseToleranceMm, profile.numeric.approximationToleranceMm);
  for (const { pattern, permission } of permittedPatterns(profile, band, classX, classY)) {
    for (const frame of framesForPattern(profile, pattern)) {
      if (!frameFits(frame, classX, classY)) continue;
      const offsetsMm = patternOffsetsMm(profile, pattern, frame);
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
      const parityKey=frame.populationOriginParity?.join(',')??'none';
      if (feasible.status === 'INFEASIBLE_CERTIFIED') {
        reasons.push(`${pattern.id}:${parityKey}:NO_ROBUST_FEASIBLE_REGISTRATION`);
        continue;
      }
      const rawBoxes = [...feasible.insideBoxes, ...feasible.boundaryBoxes];
      if (rawBoxes.length === 0) {
        reasons.push(`${pattern.id}:${parityKey}:${feasible.status}`);
        continue;
      }
      const permitted=permissionBoxes(polygon,offsetsMm,rawBoxes,regions,permission);
      if(permitted.boxes.length===0){
        reasons.push(`${pattern.id}:${parityKey}:${permitted.uncertain?'LEGALITY_INDETERMINATE':'PATTERN_PERMISSION_DENIED'}`);
        continue;
      }
      const hypothesis: CandidateHypothesis = {
        id: `${target}:${frame.populationId}:${parityKey}:${pattern.id}`,
        sizeMm: target,
        band,
        classX,
        classY,
        frame,
        pattern,
        permission,
        offsetsMm,
        feasible,
        boxes: permitted.boxes,
        scoreTrace: [],
        polygon
      };
      candidates.push({ hypothesis, regions, trace: [], boxes: permitted.boxes });
    }
  }
  const primary=candidates.filter(candidate=>candidate.hypothesis.permission.primaryOfferAllowed);
  const eligible=primary.length?primary:candidates.filter(candidate=>candidate.hypothesis.permission.fallbackAllowed);
  return { candidates: Object.freeze(eligible), reasons: Object.freeze(reasons), structuralIndeterminate:false };
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
    const comparison = compareCertifiedScores(
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
      const comparison = compareCertifiedScores(a.result.optimum, b.result.optimum, descriptorDirections(a.descriptor), a.tolerances);
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
  readonly profile: ProductProfile | RegisteredProfile;
  readonly targetDominantMm: number;
}

export function certifyPreparedSizeSolution(source:PreparedPolygon,profile:RegisteredProfile,target:number):SizeSolution|SizeFailure{
  if(source.quantumMm!==profile.numeric.coordinateQuantumMm)throw new Error('SOURCE_QUANTUM_MISMATCH');
  return certifyPreparedSize(source,profile,target);
}

function certifyPreparedSize(source:PreparedPolygon,profile:RegisteredProfile,target:number):SizeSolution|SizeFailure {
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
  if(built.structuralIndeterminate){
    return {status:'DECISION_INDETERMINATE',targetDominantMm:target,band,reasons:['STRUCTURAL_EVIDENCE_UNCERTAIN',...built.reasons]};
  }
  let candidates = [...built.candidates];
  if (candidates.length === 0) {
    return { status: 'REJECTED', targetDominantMm: target, band, reasons: built.reasons.length ? built.reasons : ['NO_PERMITTED_PATTERN'] };
  }
  const productCriteria=profile.mechanics.criteria.slice(0,8);
  const discretePolicy=profile.mechanics.criteria[8]!;
  const registrationPolicy=profile.mechanics.criteria[9]!;
  for (const policy of productCriteria) {
    const result = optimiseCriterionAcrossCandidates(candidates, policy, profile);
    if (result.status === 'INDETERMINATE') {
      return {status:'DECISION_INDETERMINATE',targetDominantMm:target,band,reasons:['CRITERION_SCORE_UNCERTAIN', policy.id]};
    }
    candidates = [...result.candidates];
    if (candidates.length === 0) return { status: 'REJECTED', targetDominantMm: target, band, reasons: ['NO_APPROVED_PATTERN'] };
  }
  const selectedHypothesis=selectDiscreteIdentity(candidates.map(candidate=>candidate.hypothesis));
  const winner = candidates.find(candidate=>candidate.hypothesis===selectedHypothesis)!;
  const discreteDescriptor=criterionDescriptor(discretePolicy,winner.hypothesis,profile,winner.regions);
  if(discreteDescriptor.id!=='DISCRETE_KEY_V1')throw new Error('invalid M09 descriptor');
  const discreteTrace:CandidateScoreTrace={criterionId:discretePolicy.id,descriptorId:discreteDescriptor.id,score:{lower:0,upper:0},status:'CERTIFIED',identityKey:discreteDescriptor.key};
  const registrationDescriptor=criterionDescriptor(registrationPolicy,winner.hypothesis,profile,winner.regions);
  if(registrationDescriptor.id!=='FINAL_REGISTRATION_ORDER_V1')throw new Error('invalid M10 descriptor');
  const tie = finalRegistrationTieBreak(polygon,winner.hypothesis.offsetsMm,profile.safety.effectiveVerificationRadiusMm,winner.boxes,registrationDescriptor.canonicalTarget,profile.numeric.coordinateQuantumMm);
  if (tie.status !== 'SELECTED' || !tie.point) return {status:'DECISION_INDETERMINATE',targetDominantMm:target,band,reasons:[tie.status]};
  const selectedCells=patternCellsForFrame(profile,winner.hypothesis.pattern,winner.hypothesis.frame);
  const proofs = selectedCells.map((cell, index) => {const offset=winner.hypothesis.offsetsMm[index]!;const point={x:tie.point!.x+offset.x,y:tie.point!.y+offset.y};const proof=discContainedExact(polygon,point,profile.safety.effectiveVerificationRadiusMm);return{cell,xMm:proof.point.x,yMm:proof.point.y,clearanceMm:proof.clearanceMm,marginMm:proof.marginMm,legal:proof.legal};});
  if (!proofs.every((proof) => proof.legal)) return { status: 'REJECTED', targetDominantMm: target, band, reasons: ['EXACT_REVALIDATION_FAILED'] };
  const centres = proofs.map(({ legal: _legal, ...rest }) => rest);
  const registrationTrace:CandidateScoreTrace={criterionId:registrationPolicy.id,descriptorId:registrationDescriptor.id,score:{components:[{lower:tie.canonicalDistanceSquared!,upper:tie.canonicalDistanceSquared!},{lower:tie.point.x,upper:tie.point.x},{lower:tie.point.y,upper:tie.point.y}]},status:'CERTIFIED',registration:tie.point};
  const result:SizeSolution={status:'ACCEPTED',targetDominantMm:target,widthMm:polygon.metrics.width,heightMm:polygon.metrics.height,scale:polygon.metrics.dominantDimension/source.metrics.dominantDimension,classX,classY,band,frame:winner.hypothesis.frame,patternId:winner.hypothesis.pattern.id,registration:tie.point,centres:Object.freeze(centres),minimumMarginMm:Math.min(...centres.map(centre=>centre.marginMm)),scoreTrace:Object.freeze([...winner.trace,discreteTrace,registrationTrace]),geometryHash:polygon.geometryHash,decisionProof:'CERTIFIED_CONTINUOUS_OPTIMUM',finalRingInt:Object.freeze(polygon.ringInt.map(point=>Object.freeze([point.x,point.y] as const)))};
  void canonicalHash({ result, computeArtifactHash: COMPUTE_ARTIFACT_HASH });
  return Object.freeze(result);
}

/** Certifies one selected physical size. This is intentionally separate from the
 * low-latency preview solve: production specifications must be created from this
 * continuous-domain, dominance-safe path. */
export function certifySizeSolution(input: CertifiedSizeInput): SizeSolution | SizeFailure {
  const profile = registerProfile(input.profile);
  if (profile.approvalState !== 'approved') throw new Error('PROFILE_UNAPPROVED');
  const { targetDominantMm: target } = input;
  const source = preparePolygon(input.outlineMm, {
    quantumMm: profile.numeric.coordinateQuantumMm,
    maxVertices: profile.numeric.maxVertices
  });
  return certifyPreparedSize(source,profile,target);
}
