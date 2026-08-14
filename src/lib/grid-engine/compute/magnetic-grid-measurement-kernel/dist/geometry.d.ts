import { type Rational } from "./arithmetic.js";
import type { CapsuleBoundaryContactJson, PointBoundaryContactJson, PointLocation, SqrtRationalJson } from "./types.js";
export interface WorkPoint {
    readonly x: bigint;
    readonly y: bigint;
}
export interface WorkEdge {
    readonly index: number;
    readonly startVertexIndex: number;
    readonly endVertexIndex: number;
    readonly a: WorkPoint;
    readonly b: WorkPoint;
    readonly minX: bigint;
    readonly maxX: bigint;
    readonly minY: bigint;
    readonly maxY: bigint;
}
interface WorkBounds {
    readonly minX: bigint;
    readonly maxX: bigint;
    readonly minY: bigint;
    readonly maxY: bigint;
}
interface WorkSpatialLeaf extends WorkBounds {
    readonly kind: "leaf";
    readonly edges: readonly WorkEdge[];
}
interface WorkSpatialBranch extends WorkBounds {
    readonly kind: "branch";
    readonly left: WorkSpatialNode;
    readonly right: WorkSpatialNode;
}
type WorkSpatialNode = WorkSpatialLeaf | WorkSpatialBranch;
export interface WorkPolygon {
    readonly vertices: readonly WorkPoint[];
    readonly edges: readonly WorkEdge[];
    readonly spatialIndex: WorkSpatialNode;
}
export declare function buildWorkPolygon(vertices: readonly WorkPoint[], edges: readonly WorkEdge[]): WorkPolygon;
export interface PointBoundaryMeasurement {
    readonly location: PointLocation;
    readonly squaredClearance: Rational;
    readonly clearance: SqrtRationalJson;
    readonly limitingContacts: readonly PointBoundaryContactJson[];
    /** Minimum squared distance in work-coordinate units. */
    readonly workDistanceNumerator: bigint;
    readonly workDistanceDenominator: bigint;
}
export interface SegmentBoundaryMeasurement {
    readonly squaredClearance: Rational;
    readonly clearance: SqrtRationalJson;
    readonly limitingContacts: readonly CapsuleBoundaryContactJson[];
    readonly workDistanceNumerator: bigint;
    readonly workDistanceDenominator: bigint;
}
export declare function locatePoint(point: WorkPoint, polygon: WorkPolygon): PointLocation;
export declare function measurePointBoundary(point: WorkPoint, polygon: WorkPolygon, workDenominator: bigint): PointBoundaryMeasurement;
export declare function measureSegmentBoundary(start: WorkPoint, end: WorkPoint, polygon: WorkPolygon, workDenominator: bigint): SegmentBoundaryMeasurement;
export declare function squaredDistanceAtLeastRadius(distanceNumerator: bigint, distanceDenominator: bigint, radiusWork: bigint): boolean;
export {};
