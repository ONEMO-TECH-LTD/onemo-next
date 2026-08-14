export type EnumeratorInputErrorCode = "INVALID_MEASUREMENT_SCHEMA" | "INVALID_GRAMMAR_SCHEMA" | "INVALID_GRAMMAR_SHAPE" | "INVALID_CANONICAL_INTEGER" | "INVALID_RATIONAL" | "INVALID_POPULATION_ID" | "DUPLICATE_POPULATION_ID" | "NON_POSITIVE_POPULATION_STEP" | "DUPLICATE_LATTICE_POSITION" | "EMPTY_SIZE_FIELD" | "INCONSISTENT_FIELD" | "INVALID_MEASUREMENT_DOCUMENT";
export declare class EnumeratorInputError extends Error {
    readonly code: EnumeratorInputErrorCode;
    readonly path: string;
    constructor(code: EnumeratorInputErrorCode, path: string, message: string);
}
export declare class MissingKernelFactError extends Error {
    readonly sizeIndex: string;
    readonly column: string;
    readonly row: string;
    readonly expectedFact: string;
    constructor(sizeIndex: bigint, column: bigint, row: bigint);
}
