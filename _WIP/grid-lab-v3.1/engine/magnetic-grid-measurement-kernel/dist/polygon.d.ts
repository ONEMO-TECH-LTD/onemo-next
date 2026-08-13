import type { CanonicalPolygonInput } from "./types.js";
export interface IntegerPoint {
    readonly x: bigint;
    readonly y: bigint;
}
export interface IntegerEdge {
    readonly index: number;
    readonly startVertexIndex: number;
    readonly endVertexIndex: number;
    readonly a: IntegerPoint;
    readonly b: IntegerPoint;
}
export interface PreparedPolygon {
    /** Canonical CCW cycle, rotated to its lexicographically smallest vertex. */
    readonly vertices: readonly IntegerPoint[];
    readonly edges: readonly IntegerEdge[];
}
export declare function pointEquals(left: IntegerPoint, right: IntegerPoint): boolean;
export declare function subtract(left: IntegerPoint, right: IntegerPoint): IntegerPoint;
export declare function dot(left: IntegerPoint, right: IntegerPoint): bigint;
export declare function cross(left: IntegerPoint, right: IntegerPoint): bigint;
export declare function orientation(a: IntegerPoint, b: IntegerPoint, c: IntegerPoint): bigint;
export declare function squaredLength(vector: IntegerPoint): bigint;
export declare function pointOnSegment(point: IntegerPoint, a: IntegerPoint, b: IntegerPoint): boolean;
export declare function segmentsIntersectInclusive(a: IntegerPoint, b: IntegerPoint, c: IntegerPoint, d: IntegerPoint): boolean;
export declare function preparePolygon(input: CanonicalPolygonInput): PreparedPolygon;
