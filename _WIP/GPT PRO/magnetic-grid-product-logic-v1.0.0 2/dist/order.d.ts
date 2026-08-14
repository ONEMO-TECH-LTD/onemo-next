import type { RankedTierJson, TierBoundaryJson } from "./types.js";
import type { ValidatedCandidate, ValidatedRules } from "./validate.js";
export declare function buildOrdering(candidates: readonly ValidatedCandidate[], rules: ValidatedRules): {
    readonly tiers: readonly RankedTierJson[];
    readonly boundaries: readonly TierBoundaryJson[];
};
