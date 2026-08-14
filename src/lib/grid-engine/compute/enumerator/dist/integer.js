import { EnumeratorInputError } from "./errors.js";
const CANONICAL_INTEGER = /^(?:0|-?[1-9][0-9]*)$/;
export function parseInteger(input, path) {
    if (typeof input === "bigint") {
        return input;
    }
    if (typeof input !== "string" || !CANONICAL_INTEGER.test(input)) {
        throw new EnumeratorInputError("INVALID_CANONICAL_INTEGER", path, "expected a canonical base-10 integer string or BigInt");
    }
    return BigInt(input);
}
export function parseDecimalString(input, path) {
    if (typeof input !== "string" || !CANONICAL_INTEGER.test(input)) {
        throw new EnumeratorInputError("INVALID_CANONICAL_INTEGER", path, "expected a canonical base-10 integer string");
    }
    return BigInt(input);
}
export function compareBigInt(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
export function absolute(value) {
    return value < 0n ? -value : value;
}
export function coordinateKey(column, row) {
    return `${column.toString()},${row.toString()}`;
}
