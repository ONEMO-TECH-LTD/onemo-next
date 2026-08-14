import { EnumeratorInputError, MissingKernelFactError } from "./errors.js";
import { coordinateKey, parseDecimalString, parseInteger } from "./integer.js";
import type {
  ArrangementGrammarInput,
  LatticeMeasurementDocumentJson,
  PopulationInput,
  RationalPointJson,
  RunStepDomain,
  OneByOneFullWindowRule,
} from "./types.js";

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

export function validateMeasurement(
  measurement: LatticeMeasurementDocumentJson,
): readonly SizeFacts[] {
  const documentValue = measurement as unknown;
  if (!isRecord(documentValue)) {
    throw new EnumeratorInputError(
      "INVALID_MEASUREMENT_DOCUMENT",
      "measurement",
      "expected an object",
    );
  }
  if (documentValue.schema !== "magnetic-grid-measurement-kernel/lattice/v1") {
    throw new EnumeratorInputError(
      "INVALID_MEASUREMENT_SCHEMA",
      "measurement.schema",
      "expected magnetic-grid-measurement-kernel/lattice/v1",
    );
  }
  if (!Array.isArray(documentValue.sizes)) {
    throw new EnumeratorInputError(
      "INVALID_MEASUREMENT_DOCUMENT",
      "measurement.sizes",
      "expected an array",
    );
  }

  const parsed: SizeFacts[] = [];
  let sizeIndex = 0n;
  for (const sizeValue of documentValue.sizes) {
    parsed.push(validateOneSize(sizeValue, sizeIndex));
    sizeIndex += 1n;
  }

  if (parsed.length > 1) {
    const first = parsed[0]!;
    for (const current of parsed.slice(1)) {
      if (
        current.minColumn !== first.minColumn ||
        current.maxColumn !== first.maxColumn ||
        current.minRow !== first.minRow ||
        current.maxRow !== first.maxRow
      ) {
        throw new EnumeratorInputError(
          "INCONSISTENT_FIELD",
          `measurement.sizes[${current.sourceSizeIndexText}].positions`,
          "kernel size entries must publish the same inclusive lattice field",
        );
      }
    }
  }

  return parsed;
}

function validateOneSize(value: unknown, sizeIndex: bigint): SizeFacts {
  const path = `measurement.sizes[${sizeIndex}]`;
  if (!isRecord(value)) {
    throw new EnumeratorInputError(
      "INVALID_MEASUREMENT_DOCUMENT",
      path,
      "expected an object",
    );
  }
  parseDecimalString(value.size, `${path}.size`);
  if (!Array.isArray(value.positions)) {
    throw new EnumeratorInputError(
      "INVALID_MEASUREMENT_DOCUMENT",
      `${path}.positions`,
      "expected an array",
    );
  }
  if (value.positions.length === 0) {
    throw new EnumeratorInputError(
      "EMPTY_SIZE_FIELD",
      `${path}.positions`,
      "a kernel size entry must publish at least one field position",
    );
  }

  const facts: PositionFact[] = [];
  const factsByIndex = new Map<string, PositionFact>();
  let factCount = 0n;
  let minColumn: bigint | undefined;
  let maxColumn: bigint | undefined;
  let minRow: bigint | undefined;
  let maxRow: bigint | undefined;

  let positionIndex = 0n;
  for (const position of value.positions) {
    const positionPath = `${path}.positions[${positionIndex.toString()}]`;
    if (!isRecord(position)) {
      throw new EnumeratorInputError(
        "INVALID_MEASUREMENT_DOCUMENT",
        positionPath,
        "expected an object",
      );
    }
    const column = parseDecimalString(position.column, `${positionPath}.column`);
    const row = parseDecimalString(position.row, `${positionPath}.row`);
    if (typeof position.fits !== "boolean") {
      throw new EnumeratorInputError(
        "INVALID_MEASUREMENT_DOCUMENT",
        `${positionPath}.fits`,
        "expected a boolean kernel fact",
      );
    }
    const center = validateRationalPoint(position.center, `${positionPath}.center`);
    const key = coordinateKey(column, row);
    if (factsByIndex.has(key)) {
      throw new EnumeratorInputError(
        "DUPLICATE_LATTICE_POSITION",
        positionPath,
        `duplicate kernel lattice index (${column.toString()}, ${row.toString()})`,
      );
    }

    const fact: PositionFact = {
      column,
      row,
      columnText: column.toString(),
      rowText: row.toString(),
      center,
      fits: position.fits,
      kernelFactRef: `/sizes/${sizeIndex.toString()}/positions/${positionIndex.toString()}`,
    };
    facts.push(fact);
    factsByIndex.set(key, fact);
    minColumn = minColumn === undefined || column < minColumn ? column : minColumn;
    maxColumn = maxColumn === undefined || column > maxColumn ? column : maxColumn;
    minRow = minRow === undefined || row < minRow ? row : minRow;
    maxRow = maxRow === undefined || row > maxRow ? row : maxRow;
    factCount += 1n;
    positionIndex += 1n;
  }

  if (
    minColumn === undefined ||
    maxColumn === undefined ||
    minRow === undefined ||
    maxRow === undefined
  ) {
    throw new Error("internal invariant: non-empty field has bounds");
  }

  const expectedCount =
    (maxColumn - minColumn + 1n) * (maxRow - minRow + 1n);
  if (factCount !== expectedCount) {
    locateMissingFieldFact(
      sizeIndex,
      minColumn,
      maxColumn,
      minRow,
      maxRow,
      factsByIndex,
    );
    throw new EnumeratorInputError(
      "INVALID_MEASUREMENT_DOCUMENT",
      `${path}.positions`,
      "position facts do not form one complete rectangular kernel field",
    );
  }
  locateMissingFieldFact(
    sizeIndex,
    minColumn,
    maxColumn,
    minRow,
    maxRow,
    factsByIndex,
  );

  return {
    sourceSizeIndex: sizeIndex,
    sourceSizeIndexText: sizeIndex.toString(),
    sizeText: value.size as string,
    kernelFactRef: `/sizes/${sizeIndex.toString()}`,
    minColumn,
    maxColumn,
    minRow,
    maxRow,
    facts,
    factsByIndex,
  };
}

function locateMissingFieldFact(
  sizeIndex: bigint,
  minColumn: bigint,
  maxColumn: bigint,
  minRow: bigint,
  maxRow: bigint,
  facts: ReadonlyMap<string, PositionFact>,
): void {
  for (let row = minRow; row <= maxRow; row += 1n) {
    for (let column = minColumn; column <= maxColumn; column += 1n) {
      if (!facts.has(coordinateKey(column, row))) {
        throw new MissingKernelFactError(sizeIndex, column, row);
      }
    }
  }
}

function validateRationalPoint(value: unknown, path: string): RationalPointJson {
  if (!isRecord(value)) {
    throw new EnumeratorInputError(
      "INVALID_RATIONAL",
      path,
      "expected an exact rational point",
    );
  }
  return {
    x: validateRational(value.x, `${path}.x`),
    y: validateRational(value.y, `${path}.y`),
  };
}

function validateRational(
  value: unknown,
  path: string,
): { readonly numerator: string; readonly denominator: string } {
  if (!isRecord(value)) {
    throw new EnumeratorInputError(
      "INVALID_RATIONAL",
      path,
      "expected an exact rational",
    );
  }
  const numerator = parseDecimalString(value.numerator, `${path}.numerator`);
  const denominator = parseDecimalString(value.denominator, `${path}.denominator`);
  if (denominator <= 0n) {
    throw new EnumeratorInputError(
      "INVALID_RATIONAL",
      `${path}.denominator`,
      "denominator must be positive",
    );
  }
  return {
    numerator: numerator.toString(),
    denominator: denominator.toString(),
  };
}

export function validateGrammar(grammar: ArrangementGrammarInput): ParsedGrammar {
  const grammarValue = grammar as unknown;
  if (!isRecord(grammarValue)) {
    throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", "grammar", "expected an object");
  }
  assertExactKeys(grammarValue, ["families", "populations", "schema"], "grammar");
  if (grammarValue.schema !== "magnetic-grid-candidate-enumerator/grammar/v1") {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SCHEMA",
      "grammar.schema",
      "expected magnetic-grid-candidate-enumerator/grammar/v1",
    );
  }
  if (!Array.isArray(grammarValue.populations)) {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SHAPE",
      "grammar.populations",
      "expected an array",
    );
  }
  const populations: ParsedPopulation[] = [];
  let populationIndex = 0n;
  for (const population of grammarValue.populations) {
    populations.push(validatePopulation(population as PopulationInput, populationIndex));
    populationIndex += 1n;
  }
  const seenIds = new Set<string>();
  for (const population of populations) {
    if (seenIds.has(population.id)) {
      throw new EnumeratorInputError(
        "DUPLICATE_POPULATION_ID",
        "grammar.populations",
        `duplicate population id ${JSON.stringify(population.id)}`,
      );
    }
    seenIds.add(population.id);
  }
  populations.sort((left, right) => compareText(left.id, right.id));

  if (!isRecord(grammarValue.families)) {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SHAPE",
      "grammar.families",
      "expected an object containing exactly the four authoritative families",
    );
  }
  assertExactKeys(
    grammarValue.families,
    ["corner-triangle", "full-window", "rectangle-corners", "run"],
    "grammar.families",
  );

  const run = grammarValue.families.run;
  if (!isRecord(run)) {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SHAPE",
      "grammar.families.run",
      "expected an object",
    );
  }
  assertExactKeys(run, ["stepDomain"], "grammar.families.run");
  if (
    run.stepDomain !== "unit-population-step-only" &&
    run.stepDomain !== "any-positive-whole-population-step"
  ) {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SHAPE",
      "grammar.families.run.stepDomain",
      "expected one of the two explicit formal readings",
    );
  }

  const rectangleCorners = grammarValue.families["rectangle-corners"];
  if (!isRecord(rectangleCorners)) {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SHAPE",
      "grammar.families.rectangle-corners",
      "expected an empty object",
    );
  }
  assertExactKeys(rectangleCorners, [], "grammar.families.rectangle-corners");

  const cornerTriangle = grammarValue.families["corner-triangle"];
  if (!isRecord(cornerTriangle)) {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SHAPE",
      "grammar.families.corner-triangle",
      "expected an empty object",
    );
  }
  assertExactKeys(cornerTriangle, [], "grammar.families.corner-triangle");

  const fullWindow = grammarValue.families["full-window"];
  if (!isRecord(fullWindow)) {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SHAPE",
      "grammar.families.full-window",
      "expected an object",
    );
  }
  assertExactKeys(fullWindow, ["oneByOne"], "grammar.families.full-window");
  if (fullWindow.oneByOne !== "include" && fullWindow.oneByOne !== "exclude") {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SHAPE",
      "grammar.families.full-window.oneByOne",
      "expected include or exclude",
    );
  }

  return {
    populations,
    runStepDomain: run.stepDomain,
    oneByOneFullWindow: fullWindow.oneByOne,
  };
}

function validatePopulation(value: PopulationInput, index: bigint): ParsedPopulation {
  const path = `grammar.populations[${index}]`;
  if (!isRecord(value)) {
    throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", path, "expected an object");
  }
  assertExactKeys(value, ["id", "indexStep", "origin"], path);
  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new EnumeratorInputError(
      "INVALID_POPULATION_ID",
      `${path}.id`,
      "population id must be a non-empty string",
    );
  }
  if (!isRecord(value.origin)) {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SHAPE",
      `${path}.origin`,
      "expected an object",
    );
  }
  assertExactKeys(value.origin, ["column", "row"], `${path}.origin`);
  const indexStep = parseInteger(value.indexStep, `${path}.indexStep`);
  if (indexStep <= 0n) {
    throw new EnumeratorInputError(
      "NON_POSITIVE_POPULATION_STEP",
      `${path}.indexStep`,
      "population indexStep must be positive",
    );
  }
  return {
    id: value.id,
    originColumn: parseInteger(value.origin.column, `${path}.origin.column`),
    originRow: parseInteger(value.origin.row, `${path}.origin.row`),
    indexStep,
  };
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort(compareText);
  const required = [...expected].sort(compareText);
  if (
    actual.length !== required.length ||
    actual.some((key, index) => key !== required[index])
  ) {
    throw new EnumeratorInputError(
      "INVALID_GRAMMAR_SHAPE",
      path,
      `expected exactly keys [${required.join(", ")}], received [${actual.join(", ")}]`,
    );
  }
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
