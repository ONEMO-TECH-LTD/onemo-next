import type { ExactJsonValue, OrderedValueComparatorInput, OrderedValueInput, RationalJson } from "./types.js";
export declare function parseDecimalInteger(value: unknown, path: string): bigint;
export declare function parseNonnegativeDecimalInteger(value: unknown, path: string): bigint;
export declare function validateRational(value: unknown, path: string): RationalJson;
export declare function compareRational(left: RationalJson, right: RationalJson): -1 | 0 | 1;
/** Returns -1 when left is better, +1 when right is better, 0 when tied. */
export declare function compareOrderedValue(left: OrderedValueInput, right: OrderedValueInput, comparator: OrderedValueComparatorInput): -1 | 0 | 1;
export declare function validateExactJson(value: unknown, path: string): ExactJsonValue;
export declare function validateOrderedComparator(value: unknown, path: string): OrderedValueComparatorInput;
export declare function validateOrderedValue(value: unknown, comparator: OrderedValueComparatorInput, path: string): OrderedValueInput;
export declare function nonemptyString(value: unknown, path: string): string;
export declare function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function assertAllowedKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], path: string): void;
