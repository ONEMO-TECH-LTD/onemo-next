import type { ApplyProductLogicInput, BandRulesInput, BandSupportAssessmentInput, CandidateEnumerationDocumentJson, CandidateEvaluationJson, CandidateJson, CandidateJudgementInput, CandidateStatusJson, EscalationPolicyInput, EscalationPromotionInput, GravityRuleInput, LatticeMeasurementDocumentJson, RegionalSupportRuleInput, StatusPolicyInput, SupportingKernelFactJson, TightWrapRuleInput } from "./types.js";
export interface ValidatedBandAssessment extends BandSupportAssessmentInput {
    readonly orderIndex: number;
}
export interface ValidatedPromotion extends EscalationPromotionInput {
    readonly inputIndex: number;
    readonly assessment: ValidatedBandAssessment;
}
export interface ValidatedCandidate {
    readonly index: number;
    readonly ref: string;
    readonly candidate: CandidateJson;
    readonly sizeIndex: number;
    readonly bandId: string;
    readonly bandOrderIndex: number;
    readonly judgement: CandidateJudgementInput;
    readonly supportingKernelFacts: readonly SupportingKernelFactJson[];
    readonly status: CandidateStatusJson;
    readonly promotionsAsTarget: readonly ValidatedPromotion[];
}
export interface ValidatedRules {
    readonly gravity: GravityRuleInput;
    readonly tightWrap: TightWrapRuleInput;
    readonly regionalSupport: RegionalSupportRuleInput;
    readonly bands: BandRulesInput;
    readonly bandOrderIndex: ReadonlyMap<string, number>;
    readonly sizeBandByIndex: ReadonlyMap<number, string>;
    readonly escalation: EscalationPolicyInput | undefined;
    readonly bandAssessmentById: ReadonlyMap<string, ValidatedBandAssessment>;
    readonly promotionByTargetAndSourceBand: ReadonlyMap<string, ValidatedPromotion>;
    readonly promotionsByTargetRef: ReadonlyMap<string, readonly ValidatedPromotion[]>;
    readonly statusPolicy: StatusPolicyInput | undefined;
}
export interface ValidatedInput {
    readonly candidateDocument: CandidateEnumerationDocumentJson;
    readonly measurementDocument: LatticeMeasurementDocumentJson;
    readonly rules: ValidatedRules;
    readonly candidates: readonly ValidatedCandidate[];
}
export declare function validateInput(input: ApplyProductLogicInput): ValidatedInput;
export declare function buildCandidateEvaluation(candidate: ValidatedCandidate, rules: ValidatedRules): CandidateEvaluationJson;
