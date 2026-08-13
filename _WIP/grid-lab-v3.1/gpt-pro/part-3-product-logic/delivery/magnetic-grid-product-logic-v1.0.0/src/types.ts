/** Canonical exact integer spelling used by accepted upstream documents. */
export type DecimalInteger = string;

export interface RationalJson {
  readonly numerator: DecimalInteger;
  readonly denominator: DecimalInteger;
}

export interface RationalPointJson {
  readonly x: RationalJson;
  readonly y: RationalJson;
}

export interface SqrtRationalJson {
  readonly kind: "sqrt-rational";
  readonly radicand: RationalJson;
}

export type PointLocation = "boundary" | "inside" | "outside";

export type BoundaryFeatureJson =
  | {
      readonly kind: "edge";
      readonly edgeIndex: DecimalInteger;
      readonly startVertexIndex: DecimalInteger;
      readonly endVertexIndex: DecimalInteger;
    }
  | {
      readonly kind: "vertex";
      readonly vertexIndex: DecimalInteger;
    };

export interface PointBoundaryContactJson {
  readonly boundaryFeature: BoundaryFeatureJson;
  readonly boundaryPoint: RationalPointJson;
}

export interface LatticePositionMeasurementJson {
  readonly column: DecimalInteger;
  readonly row: DecimalInteger;
  readonly center: RationalPointJson;
  readonly centerLocation: PointLocation;
  readonly clearance: SqrtRationalJson;
  readonly fits: boolean;
  readonly limitingContacts: readonly PointBoundaryContactJson[];
}

export interface SizeMeasurementJson {
  readonly size: DecimalInteger;
  readonly scale: RationalJson;
  readonly positions: readonly LatticePositionMeasurementJson[];
}

export interface LatticeMeasurementDocumentJson {
  readonly schema: "magnetic-grid-measurement-kernel/lattice/v1";
  readonly sizes: readonly SizeMeasurementJson[];
}

export type CandidateFamily =
  | "single"
  | "run"
  | "rectangle-corners"
  | "corner-triangle"
  | "full-window";

export interface CandidateSizeJson {
  readonly kernelSizeIndex: DecimalInteger;
  readonly value: DecimalInteger;
  readonly kernelFactRef: string;
}

export interface CandidatePositionJson {
  readonly column: DecimalInteger;
  readonly row: DecimalInteger;
  readonly center: RationalPointJson;
  readonly kernelFactRef: string;
}

export interface CandidateJson {
  readonly id: string;
  readonly size: CandidateSizeJson;
  readonly family: CandidateFamily;
  readonly population: string;
  readonly steps: {
    readonly column: DecimalInteger;
    readonly row: DecimalInteger;
  };
  readonly positions: readonly CandidatePositionJson[];
}

/**
 * Structural view of the accepted candidate document after the caller-side
 * addition of the `single` family. Runtime output preserves the complete input
 * object, including exact member values and any upstream metadata.
 */
export interface CandidateEnumerationDocumentJson {
  readonly schema: "magnetic-grid-candidate-enumerator/candidates/v1";
  readonly sourceMeasurementSchema: "magnetic-grid-measurement-kernel/lattice/v1";
  readonly candidates: readonly CandidateJson[];
}

/** Exact JSON permits no JavaScript number or BigInt. Numeric data is textual. */
export type ExactJsonValue =
  | null
  | boolean
  | string
  | readonly ExactJsonValue[]
  | { readonly [key: string]: ExactJsonValue };

export type OrderedValueComparatorInput =
  | {
      readonly kind: "exact-rational";
      readonly direction: "higher-is-better" | "lower-is-better";
    }
  | {
      readonly kind: "ordered-classes";
      /** Complete explicit order. Equal class names tie. */
      readonly bestToWorst: readonly string[];
    };

export type OrderedValueInput =
  | {
      readonly kind: "exact-rational";
      readonly value: RationalJson;
    }
  | {
      readonly kind: "ordered-class";
      readonly value: string;
    };

export type RegionalPrecedence =
  | "report-only"
  | "before-gravity"
  | "between-gravity-and-tight-wrap"
  | "after-tight-wrap";

export interface GravityRuleInput {
  readonly definitionId: string;
  /** Caller-owned exact description or reference for “upper material”. */
  readonly definition: ExactJsonValue;
}

export interface TightWrapRuleInput {
  readonly definitionId: string;
  /** Caller-owned exact description or reference for the wrap measure. */
  readonly definition: ExactJsonValue;
  readonly comparator: OrderedValueComparatorInput;
}

export interface RegionalSupportRuleInput {
  readonly definitionId: string;
  /** Caller-owned exact description or reference for masses/regions. */
  readonly definition: ExactJsonValue;
  readonly comparator: OrderedValueComparatorInput;
  readonly precedence: RegionalPrecedence;
}

export interface SizeBandAssignmentInput {
  readonly kernelSizeIndex: DecimalInteger;
  readonly band: string;
}

export interface BandRulesInput {
  /** Explicit traversal order used only to identify the next band; not a preference. */
  readonly order: readonly string[];
  /** Every kernel size occurrence must be assigned exactly once. */
  readonly sizeAssignments: readonly SizeBandAssignmentInput[];
}

export interface BandSupportAssessmentInput {
  readonly band: string;
  /** Caller ruling; never derived from candidates or regional values here. */
  readonly supportInsufficient: boolean;
  readonly triggerDefinitionId: string;
  readonly triggerInput: ExactJsonValue;
}

export interface EscalationPromotionInput {
  readonly sourceBand: string;
  readonly targetBand: string;
  /** Candidate pointer in the candidate document. */
  readonly targetCandidateRef: string;
  /** Caller definition of “stronger arrangement”. */
  readonly strengthDefinitionId: string;
  readonly strengthInput: ExactJsonValue;
}

export interface EscalationPolicyInput {
  readonly policyId: string;
  /** Exactly one explicit assessment per band. */
  readonly bandAssessments: readonly BandSupportAssessmentInput[];
  /**
   * Each record explicitly declares one next-band candidate stronger than every
   * candidate in sourceBand when that source band is assessed insufficient.
   */
  readonly promotions: readonly EscalationPromotionInput[];
}

export interface StatusAssignmentInput {
  readonly candidateRef: string;
  readonly status: string;
  readonly policyInput: ExactJsonValue;
}

export interface StatusPolicyInput {
  readonly policyId: string;
  readonly definition: ExactJsonValue;
  /** Exactly one assignment per candidate. Status never orders candidates. */
  readonly assignments: readonly StatusAssignmentInput[];
}

export interface ProductRulesInput {
  readonly schema: "magnetic-grid-product-logic/rules/v1";
  readonly gravity: GravityRuleInput;
  readonly tightWrap: TightWrapRuleInput;
  readonly regionalSupport: RegionalSupportRuleInput;
  readonly bands: BandRulesInput;
  readonly escalation?: EscalationPolicyInput;
  readonly statusPolicy?: StatusPolicyInput;
}

export interface CandidateJudgementInput {
  /** Canonical JSON pointer `/candidates/<zero-based-index>`. */
  readonly candidateRef: string;
  readonly gravity: {
    readonly holdsUpperMaterial: boolean;
    readonly basis: ExactJsonValue;
  };
  readonly tightWrap: {
    readonly value: OrderedValueInput;
    readonly basis: ExactJsonValue;
  };
  readonly regionalSupport: {
    readonly value: OrderedValueInput;
    readonly basis: ExactJsonValue;
  };
}

export interface ApplyProductLogicInput {
  readonly candidateDocument: CandidateEnumerationDocumentJson;
  readonly measurementDocument: LatticeMeasurementDocumentJson;
  readonly rules: ProductRulesInput;
  /** Exactly one complete judgement record per candidate. */
  readonly judgements: readonly CandidateJudgementInput[];
}

export interface SupportingKernelFactJson {
  readonly candidatePositionRef: string;
  readonly kernelFactRef: string;
  /** Exact fact copied from the supplied measurement document. */
  readonly fact: LatticePositionMeasurementJson;
}

export type CandidateStatusJson =
  | {
      readonly kind: "not-supplied";
    }
  | {
      readonly kind: "assigned";
      readonly policyId: string;
      readonly status: string;
      readonly policyInput: ExactJsonValue;
    };

export interface CandidateEvaluationJson {
  readonly candidateRef: string;
  readonly candidateId: string;
  readonly band: {
    readonly id: string;
    readonly orderIndex: DecimalInteger;
  };
  readonly supportingKernelFacts: readonly SupportingKernelFactJson[];
  readonly judgements: {
    readonly gravity: {
      readonly definitionId: string;
      readonly holdsUpperMaterial: boolean;
      readonly basis: ExactJsonValue;
    };
    readonly tightWrap: {
      readonly definitionId: string;
      readonly eligibleUnderGravity: boolean;
      readonly comparator: OrderedValueComparatorInput;
      readonly value: OrderedValueInput;
      readonly basis: ExactJsonValue;
    };
    readonly regionalSupport: {
      readonly definitionId: string;
      readonly precedence: RegionalPrecedence;
      readonly comparator: OrderedValueComparatorInput;
      readonly value: OrderedValueInput;
      readonly basis: ExactJsonValue;
    };
    readonly escalation:
      | {
          readonly kind: "not-supplied";
        }
      | {
          readonly kind: "supplied";
          readonly policyId: string;
          readonly bandSupportInsufficient: boolean;
          readonly triggerDefinitionId: string;
          readonly triggerInput: ExactJsonValue;
          readonly promotionsAsTarget: readonly {
            readonly sourceBand: string;
            readonly targetBand: string;
            readonly strengthDefinitionId: string;
            readonly strengthInput: ExactJsonValue;
          }[];
        };
  };
  readonly status: CandidateStatusJson;
}

export type TierBoundaryDecisionJson =
  | {
      readonly rule: "gravity";
      readonly higherCandidateRef: string;
      readonly lowerCandidateRef: string;
      readonly definitionId: string;
      readonly higherValue: { readonly holdsUpperMaterial: true };
      readonly lowerValue: { readonly holdsUpperMaterial: false };
    }
  | {
      readonly rule: "tight-wrap";
      readonly higherCandidateRef: string;
      readonly lowerCandidateRef: string;
      readonly definitionId: string;
      readonly comparator: OrderedValueComparatorInput;
      readonly higherValue: OrderedValueInput;
      readonly lowerValue: OrderedValueInput;
    }
  | {
      readonly rule: "regional-support";
      readonly higherCandidateRef: string;
      readonly lowerCandidateRef: string;
      readonly definitionId: string;
      readonly precedence: Exclude<RegionalPrecedence, "report-only">;
      readonly comparator: OrderedValueComparatorInput;
      readonly higherValue: OrderedValueInput;
      readonly lowerValue: OrderedValueInput;
    }
  | {
      readonly rule: "escalation";
      readonly higherCandidateRef: string;
      readonly lowerCandidateRef: string;
      readonly policyId: string;
      readonly sourceBand: string;
      readonly targetBand: string;
      readonly sourceBandSupportInsufficient: true;
      readonly triggerDefinitionId: string;
      readonly triggerInput: ExactJsonValue;
      readonly strengthDefinitionId: string;
      readonly strengthInput: ExactJsonValue;
    };

export interface RankedTierJson {
  readonly tierIndex: DecimalInteger;
  /** Source candidate order is serialization only and has no preference meaning. */
  readonly candidateRefs: readonly string[];
  readonly sharedMeaning: "unresolved-by-supplied-ordering-rules";
}

export interface TierBoundaryJson {
  readonly higherTierIndex: DecimalInteger;
  readonly lowerTierIndex: DecimalInteger;
  /** Every adjacent-tier candidate pair, with the exact first rule that separates it. */
  readonly decisions: readonly TierBoundaryDecisionJson[];
}

export interface ProductLogicDocumentJson {
  readonly schema: "magnetic-grid-product-logic/result/v1";
  readonly sourceCandidateSchema: "magnetic-grid-candidate-enumerator/candidates/v1";
  readonly sourceMeasurementSchema: "magnetic-grid-measurement-kernel/lattice/v1";
  /** Exact structural copy of the supplied candidate document; no candidate removed. */
  readonly candidateDocument: CandidateEnumerationDocumentJson;
  readonly ruleDefinitions: {
    readonly gravity: GravityRuleInput;
    readonly tightWrap: TightWrapRuleInput;
    readonly regionalSupport: RegionalSupportRuleInput;
    readonly bands: BandRulesInput;
    readonly escalation:
      | { readonly kind: "not-supplied" }
      | ({ readonly kind: "supplied" } & EscalationPolicyInput);
    readonly statusPolicy:
      | { readonly kind: "not-supplied" }
      | ({ readonly kind: "supplied" } & Omit<StatusPolicyInput, "assignments">);
  };
  readonly evaluations: readonly CandidateEvaluationJson[];
  readonly ordering: {
    readonly tiers: readonly RankedTierJson[];
    readonly boundaries: readonly TierBoundaryJson[];
    readonly serializationOrderWithinTier: "source-candidate-order-only";
  };
}
