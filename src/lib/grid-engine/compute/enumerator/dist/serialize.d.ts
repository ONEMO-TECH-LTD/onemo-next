/**
 * Deterministic JSON serializer matching the accepted kernel discipline.
 * Object keys are emitted lexicographically; arrays preserve schema order.
 */
export declare function serializeCanonical(value: unknown): string;
