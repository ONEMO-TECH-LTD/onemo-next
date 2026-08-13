import type { DecimalInteger, LatticeMeasurementDocumentJson, RationalPointJson } from "../../magnetic-grid-measurement-kernel/dist/index.js";
/** Exact integer input. Decimal strings must use canonical base-10 spelling. */
export type IntegerInput = bigint | string;
export type CandidateFamily = "single" | "run" | "rectangle-corners" | "corner-triangle" | "full-window";
export type RunStepDomain = "unit-population-step-only" | "any-positive-whole-population-step";
export type OneByOneFullWindowRule = "include" | "exclude";
export interface PopulationOriginInput {
    readonly column: IntegerInput;
    readonly row: IntegerInput;
}
/**
 * A caller-named regular subpopulation of the kernel lattice.
 *
 * A kernel position (column, row) belongs exactly when there are integers u, v
 * such that:
 *
 *   column = origin.column + u * indexStep
 *   row    = origin.row    + v * indexStep
 *
 * The enumerator does not infer this definition from coordinates or pitch.
 */
export interface PopulationInput {
    /** Caller-owned canonical identity. Must be non-empty and unique in the grammar. */
    readonly id: string;
    readonly origin: PopulationOriginInput;
    /** Positive whole number of kernel-index steps on both axes. */
    readonly indexStep: IntegerInput;
}
export interface ArrangementGrammarInput {
    readonly schema: "magnetic-grid-candidate-enumerator/grammar/v1";
    readonly populations: readonly PopulationInput[];
    /** The four authoritative families. Unknown or missing family keys are rejected. */
    readonly families: {
        readonly single: Record<string, never>;
        readonly run: {
            /** Required because “evenly spaced” admits two materially different readings. */
            readonly stepDomain: RunStepDomain;
        };
        readonly "rectangle-corners": Record<string, never>;
        readonly "corner-triangle": Record<string, never>;
        readonly "full-window": {
            /** Required because the brief does not state whether r = c = 1 is lawful. */
            readonly oneByOne: OneByOneFullWindowRule;
        };
    };
}
export interface EnumerateCandidatesInput {
    /** Passed unchanged; the enumerator neither calls nor reimplements the kernel. */
    readonly measurement: LatticeMeasurementDocumentJson;
    readonly grammar: ArrangementGrammarInput;
}
export interface CandidateStepJson {
    /** Signed for runs; non-negative span for the other three families. */
    readonly column: DecimalInteger;
    readonly row: DecimalInteger;
}
export interface CandidateSizeJson {
    /** Zero-based occurrence in measurement.sizes, encoded exactly as a decimal string. */
    readonly kernelSizeIndex: DecimalInteger;
    /** Copied exactly from measurement.sizes[kernelSizeIndex].size. */
    readonly value: DecimalInteger;
    /** JSON Pointer into the supplied kernel measurement document. */
    readonly kernelFactRef: string;
}
export interface CandidatePositionJson {
    readonly column: DecimalInteger;
    readonly row: DecimalInteger;
    /** Copied exactly from the supporting kernel position fact. */
    readonly center: RationalPointJson;
    /** JSON Pointer into the supplied kernel measurement document. */
    readonly kernelFactRef: string;
}
export interface CandidateJson {
    /**
     * Collision-free canonical identity of family, population, steps and position set.
     * Size is intentionally excluded because the authoritative identity sentence excludes it.
     */
    readonly id: string;
    readonly size: CandidateSizeJson;
    readonly family: CandidateFamily;
    readonly population: string;
    readonly steps: CandidateStepJson;
    readonly positions: readonly CandidatePositionJson[];
}
export interface CandidateEnumerationDocumentJson {
    readonly schema: "magnetic-grid-candidate-enumerator/candidates/v1";
    readonly sourceMeasurementSchema: "magnetic-grid-measurement-kernel/lattice/v1";
    /** Source-size occurrence order, then canonical candidate identity order. */
    readonly candidates: readonly CandidateJson[];
}
export type { DecimalInteger, LatticeMeasurementDocumentJson, RationalPointJson };
