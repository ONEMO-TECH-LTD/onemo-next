import type { IntegerInput } from "./types.js";
export declare function parseInteger(input: IntegerInput, path: string): bigint;
export declare function parseDecimalString(input: unknown, path: string): bigint;
export declare function compareBigInt(left: bigint, right: bigint): -1 | 0 | 1;
export declare function absolute(value: bigint): bigint;
export declare function coordinateKey(column: bigint, row: bigint): string;
