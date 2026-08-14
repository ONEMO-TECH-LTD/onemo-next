import { ProductLogicInputError } from "./errors.js";
import { parseNonnegativeDecimalInteger } from "./exact.js";

const CANDIDATE_POINTER = /^\/candidates\/(0|[1-9][0-9]*)$/;
const SIZE_POINTER = /^\/sizes\/(0|[1-9][0-9]*)$/;
const POSITION_POINTER = /^\/sizes\/(0|[1-9][0-9]*)\/positions\/(0|[1-9][0-9]*)$/;

export function candidatePointer(index: number): string {
  return `/candidates/${index}`;
}

export function parseCandidatePointer(value: unknown, path: string): number {
  if (typeof value !== "string") {
    throw new ProductLogicInputError("INVALID_POINTER", path, "expected a string pointer");
  }
  const match = CANDIDATE_POINTER.exec(value);
  if (match === null) {
    throw new ProductLogicInputError(
      "INVALID_POINTER",
      path,
      "expected canonical pointer /candidates/<zero-based-index>",
    );
  }
  return safeArrayIndex(match[1]!, path);
}

export function parseSizePointer(value: unknown, path: string): number {
  if (typeof value !== "string") {
    throw new ProductLogicInputError("INVALID_POINTER", path, "expected a string pointer");
  }
  const match = SIZE_POINTER.exec(value);
  if (match === null) {
    throw new ProductLogicInputError(
      "INVALID_POINTER",
      path,
      "expected canonical pointer /sizes/<zero-based-index>",
    );
  }
  return safeArrayIndex(match[1]!, path);
}

export function parsePositionPointer(
  value: unknown,
  path: string,
): { readonly sizeIndex: number; readonly positionIndex: number } {
  if (typeof value !== "string") {
    throw new ProductLogicInputError("INVALID_POINTER", path, "expected a string pointer");
  }
  const match = POSITION_POINTER.exec(value);
  if (match === null) {
    throw new ProductLogicInputError(
      "INVALID_POINTER",
      path,
      "expected canonical pointer /sizes/<index>/positions/<index>",
    );
  }
  return {
    sizeIndex: safeArrayIndex(match[1]!, path),
    positionIndex: safeArrayIndex(match[2]!, path),
  };
}

function safeArrayIndex(text: string, path: string): number {
  const exact = parseNonnegativeDecimalInteger(text, path);
  if (exact > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ProductLogicInputError(
      "INVALID_POINTER",
      path,
      "array index exceeds JavaScript safe array indexing range",
    );
  }
  return Number(exact);
}
