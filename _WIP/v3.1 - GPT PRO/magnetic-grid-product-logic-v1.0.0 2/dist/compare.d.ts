import type { TierBoundaryDecisionJson } from "./types.js";
import type { ValidatedCandidate, ValidatedRules } from "./validate.js";
export type PairComparison = {
    readonly relation: "tie";
} | {
    readonly relation: "left-higher";
    readonly decision: TierBoundaryDecisionJson;
} | {
    readonly relation: "right-higher";
    readonly decision: TierBoundaryDecisionJson;
};
export declare function compareCandidates(left: ValidatedCandidate, right: ValidatedCandidate, rules: ValidatedRules): PairComparison;
