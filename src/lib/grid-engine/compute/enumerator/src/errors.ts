export type EnumeratorInputErrorCode =
  | "INVALID_MEASUREMENT_SCHEMA"
  | "INVALID_GRAMMAR_SCHEMA"
  | "INVALID_GRAMMAR_SHAPE"
  | "INVALID_CANONICAL_INTEGER"
  | "INVALID_RATIONAL"
  | "INVALID_POPULATION_ID"
  | "DUPLICATE_POPULATION_ID"
  | "NON_POSITIVE_POPULATION_STEP"
  | "DUPLICATE_LATTICE_POSITION"
  | "EMPTY_SIZE_FIELD"
  | "INCONSISTENT_FIELD"
  | "INVALID_MEASUREMENT_DOCUMENT";

export class EnumeratorInputError extends Error {
  public readonly code: EnumeratorInputErrorCode;
  public readonly path: string;

  public constructor(code: EnumeratorInputErrorCode, path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "EnumeratorInputError";
    this.code = code;
    this.path = path;
  }
}

export class MissingKernelFactError extends Error {
  public readonly sizeIndex: string;
  public readonly column: string;
  public readonly row: string;
  public readonly expectedFact: string;

  public constructor(sizeIndex: bigint, column: bigint, row: bigint) {
    const sizeText = sizeIndex.toString();
    const columnText = column.toString();
    const rowText = row.toString();
    const expectedFact = `/sizes/${sizeText}/positions/<fact at column ${columnText}, row ${rowText}>`;
    super(`kernel document does not publish required fact ${expectedFact}`);
    this.name = "MissingKernelFactError";
    this.sizeIndex = sizeText;
    this.column = columnText;
    this.row = rowText;
    this.expectedFact = expectedFact;
  }
}
