/**
 * Deterministic JSON serializer used for golden files and byte-stable interchange.
 * Object keys are emitted lexicographically; arrays preserve caller/schema order.
 */
export declare function serializeCanonical(value: unknown): string;
