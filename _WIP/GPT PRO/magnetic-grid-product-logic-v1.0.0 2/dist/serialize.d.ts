/**
 * Deterministic exact JSON serializer. Object keys are lexicographic; arrays
 * preserve schema order. JavaScript number and BigInt are forbidden.
 */
export declare function serializeCanonical(value: unknown): string;
