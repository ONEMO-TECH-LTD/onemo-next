export type ProductLogicInputErrorCode = "INVALID_INPUT" | "INVALID_SCHEMA" | "INVALID_CANONICAL_INTEGER" | "INVALID_RATIONAL" | "INVALID_EXACT_JSON" | "INVALID_POINTER" | "MISSING_SOURCE_FACT" | "SOURCE_FACT_MISMATCH" | "UNHELD_CANDIDATE_POSITION" | "DUPLICATE_INPUT" | "MISSING_INPUT" | "UNKNOWN_CANDIDATE" | "INVALID_RULE_VALUE" | "INVALID_BAND_POLICY" | "INVALID_ESCALATION" | "INVALID_STATUS_POLICY";
export declare class ProductLogicInputError extends Error {
    readonly code: ProductLogicInputErrorCode;
    readonly path: string;
    constructor(code: ProductLogicInputErrorCode, path: string, message: string);
}
export declare class NonTierableOrderingError extends Error {
    readonly code: "NON_TIERABLE_ORDERING";
    readonly candidateRefs: readonly string[];
    constructor(candidateRefs: readonly string[], message: string);
}
