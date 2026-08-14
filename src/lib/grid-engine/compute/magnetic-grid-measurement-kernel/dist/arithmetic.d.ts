import type { IntegerInput, RationalInput, RationalJson, RationalPointInput, RationalPointJson } from "./types.js";
export interface Rational {
    readonly numerator: bigint;
    readonly denominator: bigint;
}
export interface RationalPoint {
    readonly x: Rational;
    readonly y: Rational;
}
export declare function parseInteger(value: IntegerInput, path: string): bigint;
export declare function abs(value: bigint): bigint;
export declare function gcd(left: bigint, right: bigint): bigint;
export declare function lcm(left: bigint, right: bigint): bigint;
export declare function makeRational(numerator: bigint, denominator: bigint): Rational;
export declare function parseRational(input: RationalInput, path: string): Rational;
export declare function parseRationalPoint(input: RationalPointInput, path: string): RationalPoint;
export declare function compareFractions(leftNumerator: bigint, leftDenominator: bigint, rightNumerator: bigint, rightDenominator: bigint): -1 | 0 | 1;
export declare function rationalJson(value: Rational): RationalJson;
export declare function rationalPointJson(value: RationalPoint): RationalPointJson;
export declare function rationalFromScaledInteger(value: bigint, denominator: bigint): Rational;
export declare function rationalPointFromScaledIntegers(x: bigint, y: bigint, denominator: bigint): RationalPoint;
export declare function multiplyRationals(left: Rational, right: Rational): Rational;
export declare function approximateSqrtRational(value: RationalJson): number;
