import type { CandidateResult, ExactRationalString } from "./contracts.js";

export interface ProductGateTrace {
  readonly ruleId: string;
  readonly passed: boolean;
  readonly reason: string;
}

export interface ProductCriterionTrace {
  readonly criterionId: string;
  readonly value: ExactRationalString;
  readonly reason: string;
}

export interface ProductAssessment {
  readonly candidateId: string;
  readonly gates: readonly ProductGateTrace[];
  readonly criteria: readonly ProductCriterionTrace[];
}

export interface ProductPolicy {
  readonly precedence: readonly {
    readonly criterionId: string;
    readonly direction: "higher" | "lower";
  }[];
  readonly tieBreak: "candidate_id_ascending";
}

export interface CandidateEvaluation {
  readonly candidate: CandidateResult;
  readonly accepted: boolean;
  readonly gateTrace: readonly ProductGateTrace[];
  readonly scoreTrace: readonly ProductCriterionTrace[];
  readonly rejectionReasons: readonly string[];
}

export interface OrderingTrace {
  readonly beforeCandidateId: string;
  readonly afterCandidateId: string;
  readonly decisiveRule: string;
  readonly reason: string;
}

export interface ProductEvaluationResult {
  readonly rawCandidates: readonly CandidateResult[];
  readonly evaluations: readonly CandidateEvaluation[];
  readonly acceptedOrder: readonly string[];
  readonly rejectedCandidateIds: readonly string[];
  readonly orderingTrace: readonly OrderingTrace[];
}

interface Fraction {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function deterministicStringCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseFraction(value: ExactRationalString): Fraction {
  const match = /^(-?\d+)(?:\/(\d+))?$/.exec(value);
  if (match === null) throw new Error(`invalid exact rational: ${value}`);
  const denominator = BigInt(match[2] ?? "1");
  if (denominator <= 0n) throw new Error(`invalid rational denominator: ${value}`);
  return { numerator: BigInt(match[1]!), denominator };
}

function compareFractions(left: ExactRationalString, right: ExactRationalString): number {
  const a = parseFraction(left);
  const b = parseFraction(right);
  const delta = a.numerator * b.denominator - b.numerator * a.denominator;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}

function assessmentMap(assessments: readonly ProductAssessment[]): ReadonlyMap<string, ProductAssessment> {
  const result = new Map<string, ProductAssessment>();
  for (const assessment of assessments) {
    if (result.has(assessment.candidateId)) {
      throw new Error(`duplicate product assessment: ${assessment.candidateId}`);
    }
    const gateIds = new Set<string>();
    for (const gate of assessment.gates) {
      if (gateIds.has(gate.ruleId)) throw new Error(`duplicate gate ${gate.ruleId} for ${assessment.candidateId}`);
      gateIds.add(gate.ruleId);
    }
    const criterionIds = new Set<string>();
    for (const criterion of assessment.criteria) {
      if (criterionIds.has(criterion.criterionId)) {
        throw new Error(`duplicate criterion ${criterion.criterionId} for ${assessment.candidateId}`);
      }
      parseFraction(criterion.value);
      criterionIds.add(criterion.criterionId);
    }
    result.set(assessment.candidateId, assessment);
  }
  return result;
}

function criterionById(assessment: ProductAssessment, criterionId: string): ProductCriterionTrace {
  const criterion = assessment.criteria.find((entry) => entry.criterionId === criterionId);
  if (criterion === undefined) {
    throw new Error(`candidate ${assessment.candidateId} has no criterion ${criterionId}`);
  }
  return criterion;
}

function comparisonReason(
  left: ProductAssessment,
  right: ProductAssessment,
  policy: ProductPolicy,
): { readonly order: number; readonly decisiveRule: string; readonly reason: string } {
  for (const precedence of policy.precedence) {
    const leftCriterion = criterionById(left, precedence.criterionId);
    const rightCriterion = criterionById(right, precedence.criterionId);
    const raw = compareFractions(leftCriterion.value, rightCriterion.value);
    if (raw !== 0) {
      const order = precedence.direction === "higher" ? -raw : raw;
      return {
        order,
        decisiveRule: precedence.criterionId,
        reason:
          `${precedence.criterionId} is ordered ${precedence.direction}: ` +
          `${left.candidateId}=${leftCriterion.value}; ${right.candidateId}=${rightCriterion.value}`,
      };
    }
  }
  const order = deterministicStringCompare(left.candidateId, right.candidateId);
  return {
    order,
    decisiveRule: policy.tieBreak,
    reason: `all declared criteria tie; candidate_id_ascending compares ${left.candidateId} and ${right.candidateId}`,
  };
}

/*
 * This function does not create product evidence and does not select a winner.
 * It applies only the gates and precedence supplied by the product-rule owner,
 * retains the raw candidate array, and returns the full accepted ordering.
 */
export function evaluateAndOrderCandidates(
  candidates: readonly CandidateResult[],
  assessments: readonly ProductAssessment[],
  policy: ProductPolicy,
): ProductEvaluationResult {
  const candidateIds = new Set<string>();
  for (const candidate of candidates) {
    if (candidateIds.has(candidate.id)) throw new Error(`duplicate raw candidate id: ${candidate.id}`);
    candidateIds.add(candidate.id);
  }
  const byId = assessmentMap(assessments);
  if (byId.size !== candidates.length) {
    throw new Error("product assessment count does not match immutable candidate count");
  }
  for (const assessmentId of byId.keys()) {
    if (!candidateIds.has(assessmentId)) throw new Error(`assessment references missing candidate: ${assessmentId}`);
  }

  const evaluations: CandidateEvaluation[] = candidates.map((candidate) => {
    const assessment = byId.get(candidate.id);
    if (assessment === undefined) throw new Error(`missing product assessment: ${candidate.id}`);
    for (const precedence of policy.precedence) criterionById(assessment, precedence.criterionId);
    const rejectionReasons = assessment.gates.filter((gate) => !gate.passed).map((gate) => gate.reason);
    return Object.freeze({
      candidate,
      accepted: rejectionReasons.length === 0,
      gateTrace: assessment.gates,
      scoreTrace: assessment.criteria,
      rejectionReasons: Object.freeze(rejectionReasons),
    });
  });

  const acceptedAssessments = evaluations
    .filter((evaluation) => evaluation.accepted)
    .map((evaluation) => byId.get(evaluation.candidate.id) as ProductAssessment);
  acceptedAssessments.sort((left, right) => comparisonReason(left, right, policy).order);

  const orderingTrace: OrderingTrace[] = [];
  for (let index = 1; index < acceptedAssessments.length; index += 1) {
    const before = acceptedAssessments[index - 1]!;
    const after = acceptedAssessments[index]!;
    const explanation = comparisonReason(before, after, policy);
    orderingTrace.push(Object.freeze({
      beforeCandidateId: before.candidateId,
      afterCandidateId: after.candidateId,
      decisiveRule: explanation.decisiveRule,
      reason: explanation.reason,
    }));
  }

  const rejectedCandidateIds = evaluations
    .filter((evaluation) => !evaluation.accepted)
    .map((evaluation) => evaluation.candidate.id)
    .sort(deterministicStringCompare);

  return Object.freeze({
    rawCandidates: candidates,
    evaluations: Object.freeze(evaluations),
    acceptedOrder: Object.freeze(acceptedAssessments.map((assessment) => assessment.candidateId)),
    rejectedCandidateIds: Object.freeze(rejectedCandidateIds),
    orderingTrace: Object.freeze(orderingTrace),
  });
}

export interface ExplicitRegionRule {
  readonly id: string;
  readonly minimumDistinctSites: number;
}

export type ExplicitSiteRegionMembership = Readonly<Record<string, readonly string[]>>;

export function candidateSiteKey(candidate: CandidateResult, baseIndex: readonly [number, number]): string {
  return `${candidate.registration_id}:${baseIndex[0]},${baseIndex[1]}`;
}

/*
 * Region geometry is deliberately not inferred here. The product-rule owner
 * must supply an explicit site-to-region membership table. This helper then
 * measures distinct support without conflating it with disc containment.
 */
export function assessExplicitRegionalCoverage(
  candidate: CandidateResult,
  regions: readonly ExplicitRegionRule[],
  membership: ExplicitSiteRegionMembership,
): ProductAssessment {
  const counts = new Map(regions.map((region) => [region.id, 0]));
  for (const site of candidate.sites) {
    const regionIds = new Set(membership[candidateSiteKey(candidate, site.base_index)] ?? []);
    for (const regionId of regionIds) {
      if (counts.has(regionId)) counts.set(regionId, (counts.get(regionId) ?? 0) + 1);
    }
  }

  const gates: ProductGateTrace[] = regions.map((region) => {
    const count = counts.get(region.id) ?? 0;
    return Object.freeze({
      ruleId: `region.minimum.${region.id}`,
      passed: count >= region.minimumDistinctSites,
      reason:
        `region ${region.id} has ${count} distinct supporting site(s); ` +
        `minimum is ${region.minimumDistinctSites}`,
    });
  });
  const regionCounts = regions.map((region) => counts.get(region.id) ?? 0);
  const worst = regionCounts.length === 0 ? 0 : Math.min(...regionCounts);
  const covered = regionCounts.filter((count) => count > 0).length;

  return Object.freeze({
    candidateId: candidate.id,
    gates: Object.freeze(gates),
    criteria: Object.freeze([
      Object.freeze({
        criterionId: "worst_supported_region",
        value: String(worst),
        reason: `minimum distinct-site count across explicitly supplied regions is ${worst}`,
      }),
      Object.freeze({
        criterionId: "covered_region_count",
        value: String(covered),
        reason: `${covered} explicitly supplied region(s) contain at least one supporting site`,
      }),
    ]),
  });
}

export function mergeProductAssessments(
  candidateId: string,
  fragments: readonly ProductAssessment[],
): ProductAssessment {
  for (const fragment of fragments) {
    if (fragment.candidateId !== candidateId) {
      throw new Error(`assessment fragment belongs to ${fragment.candidateId}, expected ${candidateId}`);
    }
  }
  return Object.freeze({
    candidateId,
    gates: Object.freeze(fragments.flatMap((fragment) => fragment.gates)),
    criteria: Object.freeze(fragments.flatMap((fragment) => fragment.criteria)),
  });
}
