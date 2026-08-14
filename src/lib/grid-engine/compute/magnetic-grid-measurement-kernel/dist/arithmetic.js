import { KernelInputError } from "./errors.js";
const CANONICAL_INTEGER = /^(?:0|-[1-9][0-9]*|[1-9][0-9]*)$/;
export function parseInteger(value, path) {
    if (typeof value === "bigint") {
        return value;
    }
    if (!CANONICAL_INTEGER.test(value)) {
        throw new KernelInputError("INVALID_DECIMAL_INTEGER", path, "expected a canonical base-10 integer string with no leading zeroes or -0");
    }
    return BigInt(value);
}
export function abs(value) {
    return value < 0n ? -value : value;
}
export function gcd(left, right) {
    let a = abs(left);
    let b = abs(right);
    while (b !== 0n) {
        const remainder = a % b;
        a = b;
        b = remainder;
    }
    return a;
}
export function lcm(left, right) {
    if (left === 0n || right === 0n) {
        return 0n;
    }
    return abs((left / gcd(left, right)) * right);
}
export function makeRational(numerator, denominator) {
    if (denominator === 0n) {
        throw new Error("internal invariant: rational denominator must be non-zero");
    }
    let n = numerator;
    let d = denominator;
    if (d < 0n) {
        n = -n;
        d = -d;
    }
    const divisor = gcd(n, d);
    return { numerator: n / divisor, denominator: d / divisor };
}
export function parseRational(input, path) {
    const numerator = parseInteger(input.numerator, `${path}.numerator`);
    const denominator = parseInteger(input.denominator, `${path}.denominator`);
    if (denominator <= 0n) {
        throw new KernelInputError("INVALID_RATIONAL", `${path}.denominator`, "denominator must be positive");
    }
    return makeRational(numerator, denominator);
}
export function parseRationalPoint(input, path) {
    return {
        x: parseRational(input.x, `${path}.x`),
        y: parseRational(input.y, `${path}.y`),
    };
}
export function compareFractions(leftNumerator, leftDenominator, rightNumerator, rightDenominator) {
    const left = leftNumerator * rightDenominator;
    const right = rightNumerator * leftDenominator;
    return left < right ? -1 : left > right ? 1 : 0;
}
export function rationalJson(value) {
    return {
        numerator: value.numerator.toString(),
        denominator: value.denominator.toString(),
    };
}
export function rationalPointJson(value) {
    return {
        x: rationalJson(value.x),
        y: rationalJson(value.y),
    };
}
export function rationalFromScaledInteger(value, denominator) {
    return makeRational(value, denominator);
}
export function rationalPointFromScaledIntegers(x, y, denominator) {
    return {
        x: rationalFromScaledInteger(x, denominator),
        y: rationalFromScaledInteger(y, denominator),
    };
}
export function multiplyRationals(left, right) {
    return makeRational(left.numerator * right.numerator, left.denominator * right.denominator);
}
export function approximateSqrtRational(value) {
    return Math.sqrt(Number(value.numerator) / Number(value.denominator));
}
