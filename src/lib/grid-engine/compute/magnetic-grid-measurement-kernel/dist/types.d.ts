/** Exact integer input. Decimal strings must use canonical base-10 spelling. */
export type IntegerInput = bigint | string;
export interface IntegerPointInput {
    readonly x: IntegerInput;
    readonly y: IntegerInput;
}
export interface RationalInput {
    readonly numerator: IntegerInput;
    readonly denominator: IntegerInput;
}
export interface RationalPointInput {
    readonly x: RationalInput;
    readonly y: RationalInput;
}
export interface CanonicalPolygonInput {
    /**
     * A simple, hole-free polygon cycle. The closing vertex must not be repeated.
     * The kernel validates but never repairs this sequence.
     */
    readonly vertices: readonly IntegerPointInput[];
}
export interface FieldExtentInput {
    /** Inclusive lattice-column bounds. */
    readonly minColumn: IntegerInput;
    readonly maxColumn: IntegerInput;
    /** Inclusive lattice-row bounds. */
    readonly minRow: IntegerInput;
    readonly maxRow: IntegerInput;
}
export interface LatticeParametersInput {
    /** Positive physical pitch between adjacent integer lattice indices. */
    readonly pitch: IntegerInput;
    /** Exact physical coordinate of lattice index (0, 0). */
    readonly origin: RationalPointInput;
    /** Inclusive index rectangle to enumerate. */
    readonly fieldExtent: FieldExtentInput;
}
export interface UniformSizeTransformInput {
    /**
     * Runtime-supplied source measure. For a requested size s, scale = s/sourceSize.
     * The kernel assigns no geometric meaning to this measure.
     */
    readonly sourceSize: IntegerInput;
    /** Exact point about which source coordinates are scaled. */
    readonly sourceAnchor: RationalPointInput;
    /** Exact physical point to which sourceAnchor maps at every requested size. */
    readonly targetAnchor: RationalPointInput;
}
export interface KernelParametersInput {
    readonly lattice: LatticeParametersInput;
    /** Positive full disc diameter in physical units. */
    readonly discDiameter: IntegerInput;
    readonly sizeTransform: UniformSizeTransformInput;
}
export interface MeasureLatticeInput {
    readonly polygon: CanonicalPolygonInput;
    readonly parameters: KernelParametersInput;
    /** Preserved exactly in caller order; duplicate sizes are evaluated independently. */
    readonly sizes: readonly IntegerInput[];
}
export interface LatticePositionInput {
    readonly column: IntegerInput;
    readonly row: IntegerInput;
}
export interface MeasureStraightCapsuleInput {
    readonly polygon: CanonicalPolygonInput;
    readonly parameters: KernelParametersInput;
    readonly size: IntegerInput;
    readonly first: LatticePositionInput;
    readonly second: LatticePositionInput;
}
/** Canonical decimal integer used by all JSON-safe exact outputs. */
export type DecimalInteger = string;
export interface RationalJson {
    readonly numerator: DecimalInteger;
    readonly denominator: DecimalInteger;
}
export interface RationalPointJson {
    readonly x: RationalJson;
    readonly y: RationalJson;
}
export interface SqrtRationalJson {
    readonly kind: "sqrt-rational";
    /** The exact squared value. The exact value is sqrt(radicand). */
    readonly radicand: RationalJson;
}
export type PointLocation = "boundary" | "inside" | "outside";
export type BoundaryFeatureJson = {
    readonly kind: "edge";
    readonly edgeIndex: DecimalInteger;
    readonly startVertexIndex: DecimalInteger;
    readonly endVertexIndex: DecimalInteger;
} | {
    readonly kind: "vertex";
    readonly vertexIndex: DecimalInteger;
};
export interface PointBoundaryContactJson {
    readonly boundaryFeature: BoundaryFeatureJson;
    readonly boundaryPoint: RationalPointJson;
}
export interface LatticePositionMeasurementJson {
    readonly column: DecimalInteger;
    readonly row: DecimalInteger;
    readonly center: RationalPointJson;
    readonly centerLocation: PointLocation;
    readonly clearance: SqrtRationalJson;
    /** True exactly when centerLocation is inside and clearance >= discDiameter/2. */
    readonly fits: boolean;
    /** Every exact nearest boundary feature, in canonical serialization order. */
    readonly limitingContacts: readonly PointBoundaryContactJson[];
}
export interface SizeMeasurementJson {
    readonly size: DecimalInteger;
    readonly scale: RationalJson;
    readonly positions: readonly LatticePositionMeasurementJson[];
}
export interface LatticeMeasurementDocumentJson {
    readonly schema: "magnetic-grid-measurement-kernel/lattice/v1";
    readonly sizes: readonly SizeMeasurementJson[];
}
export interface CapsuleBoundaryContactJson {
    readonly boundaryFeature: BoundaryFeatureJson;
    readonly boundaryPoint: RationalPointJson;
    readonly centrelinePoint: RationalPointJson;
}
export interface CapsuleEndpointJson {
    readonly column: DecimalInteger;
    readonly row: DecimalInteger;
    readonly center: RationalPointJson;
    readonly centerLocation: PointLocation;
}
export interface StraightCapsuleMeasurementJson {
    readonly schema: "magnetic-grid-measurement-kernel/straight-capsule/v1";
    readonly size: DecimalInteger;
    readonly scale: RationalJson;
    readonly first: CapsuleEndpointJson;
    readonly second: CapsuleEndpointJson;
    readonly centrelineIntersectsBoundary: boolean;
    readonly clearance: SqrtRationalJson;
    /**
     * True exactly when both endpoint centres are inside and the complete centreline
     * has boundary distance >= discDiameter/2. Tangency passes.
     */
    readonly fits: boolean;
    /**
     * Deterministic exact witnesses for the minimum distance. A continuous closest
     * locus is represented by finite witness points rather than sampled or rounded.
     */
    readonly limitingContacts: readonly CapsuleBoundaryContactJson[];
}
