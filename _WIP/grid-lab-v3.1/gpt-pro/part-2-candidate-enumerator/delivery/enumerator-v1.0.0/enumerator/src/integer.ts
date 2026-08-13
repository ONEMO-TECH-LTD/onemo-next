import { EnumeratorInputError } from "./errors.js";
import type { IntegerInput } from "./types.js";

const CANONICAL_INTEGER = /^(?:0|-?[1-9][0-9]*)$/;

export function parseInteger(input: IntegerInput, path: string): bigint {
  if (typeof input === "bigint") {
    return input;
  }
  if (typeof input !== "string" || !CANONICAL_INTEGER.test(input)) {
    throw new EnumeratorInputError(
      "INVALID_CANONICAL_INTEGER",
      path,
      "expected a canonical base-10 integer string or BigInt",
    );
  }
  return BigInt(input);
}

export function parseDecimalString(input: unknown, path: string): bigint {
  if (typeof input !== "string" || !CANONICAL_INTEGER.test(input)) {
    throw new EnumeratorInputError(
      "INVALID_CANONICAL_INTEGER",
      path,
      "expected a canonical base-10 integer string",
    );
  }
  return BigInt(input);
}

export function compareBigInt(left: bigint, right: bigint): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function coordinateKey(column: bigint, row: bigint): string {
  return `${column.toString()},${row.toString()}`;
}
