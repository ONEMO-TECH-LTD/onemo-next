import type { ArrangementGrammarInput, LatticeMeasurementDocumentJson, RationalPointJson, RunStepDomain, OneByOneFullWindowRule } from "./types.js";
export interface ParsedPopulation {
    readonly id: string;
    readonly originColumn: bigint;
    readonly originRow: bigint;
    readonly indexStep: bigint;
}
export interface PositionFact {
    readonly column: bigint;
    readonly row: bigint;
    readonly columnText: string;
    readonly rowText: string;
    readonly center: RationalPointJson;
    readonly fits: boolean;
    readonly kernelFactRef: string;
}
export interface SizeFacts {
    readonly sourceSizeIndex: bigint;
    readonly sourceSizeIndexText: string;
    readonly sizeText: string;
    readonly kernelFactRef: string;
    readonly minColumn: bigint;
    readonly maxColumn: bigint;
    readonly minRow: bigint;
    readonly maxRow: bigint;
    readonly facts: readonly PositionFact[];
    readonly factsByIndex: ReadonlyMap<string, PositionFact>;
}
export interface ParsedGrammar {
    readonly populations: readonly ParsedPopulation[];
    readonly runStepDomain: RunStepDomain;
    readonly oneByOneFullWindow: OneByOneFullWindowRule;
}
export declare function validateMeasurement(measurement: LatticeMeasurementDocumentJson): readonly SizeFacts[];
export declare function validateGrammar(grammar: ArrangementGrammarInput): ParsedGrammar;
