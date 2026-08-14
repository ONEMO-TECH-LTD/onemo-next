export type KernelInputErrorCode = "DUPLICATE_VERTEX" | "INVALID_DECIMAL_INTEGER" | "INVALID_FIELD_EXTENT" | "INVALID_RATIONAL" | "NON_POSITIVE_DISC_DIAMETER" | "NON_POSITIVE_LATTICE_PITCH" | "NON_POSITIVE_SIZE" | "NON_POSITIVE_SOURCE_SIZE" | "POLYGON_NOT_SIMPLE" | "POLYGON_TOO_FEW_VERTICES" | "POLYGON_ZERO_AREA" | "REPEATED_CLOSING_VERTEX" | "ZERO_LENGTH_EDGE";
export declare class KernelInputError extends Error {
    readonly code: KernelInputErrorCode;
    readonly path: string;
    constructor(code: KernelInputErrorCode, path: string, message: string);
}
