import { EnumeratorInputError, MissingKernelFactError } from "./errors.js";
import { coordinateKey, parseDecimalString, parseInteger } from "./integer.js";
export function validateMeasurement(measurement) {
    const documentValue = measurement;
    if (!isRecord(documentValue)) {
        throw new EnumeratorInputError("INVALID_MEASUREMENT_DOCUMENT", "measurement", "expected an object");
    }
    if (documentValue.schema !== "magnetic-grid-measurement-kernel/lattice/v1") {
        throw new EnumeratorInputError("INVALID_MEASUREMENT_SCHEMA", "measurement.schema", "expected magnetic-grid-measurement-kernel/lattice/v1");
    }
    if (!Array.isArray(documentValue.sizes)) {
        throw new EnumeratorInputError("INVALID_MEASUREMENT_DOCUMENT", "measurement.sizes", "expected an array");
    }
    const parsed = [];
    let sizeIndex = 0n;
    for (const sizeValue of documentValue.sizes) {
        parsed.push(validateOneSize(sizeValue, sizeIndex));
        sizeIndex += 1n;
    }
    if (parsed.length > 1) {
        const first = parsed[0];
        for (const current of parsed.slice(1)) {
            if (current.minColumn !== first.minColumn ||
                current.maxColumn !== first.maxColumn ||
                current.minRow !== first.minRow ||
                current.maxRow !== first.maxRow) {
                throw new EnumeratorInputError("INCONSISTENT_FIELD", `measurement.sizes[${current.sourceSizeIndexText}].positions`, "kernel size entries must publish the same inclusive lattice field");
            }
        }
    }
    return parsed;
}
function validateOneSize(value, sizeIndex) {
    const path = `measurement.sizes[${sizeIndex}]`;
    if (!isRecord(value)) {
        throw new EnumeratorInputError("INVALID_MEASUREMENT_DOCUMENT", path, "expected an object");
    }
    parseDecimalString(value.size, `${path}.size`);
    if (!Array.isArray(value.positions)) {
        throw new EnumeratorInputError("INVALID_MEASUREMENT_DOCUMENT", `${path}.positions`, "expected an array");
    }
    if (value.positions.length === 0) {
        throw new EnumeratorInputError("EMPTY_SIZE_FIELD", `${path}.positions`, "a kernel size entry must publish at least one field position");
    }
    const facts = [];
    const factsByIndex = new Map();
    let factCount = 0n;
    let minColumn;
    let maxColumn;
    let minRow;
    let maxRow;
    let positionIndex = 0n;
    for (const position of value.positions) {
        const positionPath = `${path}.positions[${positionIndex.toString()}]`;
        if (!isRecord(position)) {
            throw new EnumeratorInputError("INVALID_MEASUREMENT_DOCUMENT", positionPath, "expected an object");
        }
        const column = parseDecimalString(position.column, `${positionPath}.column`);
        const row = parseDecimalString(position.row, `${positionPath}.row`);
        if (typeof position.fits !== "boolean") {
            throw new EnumeratorInputError("INVALID_MEASUREMENT_DOCUMENT", `${positionPath}.fits`, "expected a boolean kernel fact");
        }
        const center = validateRationalPoint(position.center, `${positionPath}.center`);
        const key = coordinateKey(column, row);
        if (factsByIndex.has(key)) {
            throw new EnumeratorInputError("DUPLICATE_LATTICE_POSITION", positionPath, `duplicate kernel lattice index (${column.toString()}, ${row.toString()})`);
        }
        const fact = {
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
    if (minColumn === undefined ||
        maxColumn === undefined ||
        minRow === undefined ||
        maxRow === undefined) {
        throw new Error("internal invariant: non-empty field has bounds");
    }
    const expectedCount = (maxColumn - minColumn + 1n) * (maxRow - minRow + 1n);
    if (factCount !== expectedCount) {
        locateMissingFieldFact(sizeIndex, minColumn, maxColumn, minRow, maxRow, factsByIndex);
        throw new EnumeratorInputError("INVALID_MEASUREMENT_DOCUMENT", `${path}.positions`, "position facts do not form one complete rectangular kernel field");
    }
    locateMissingFieldFact(sizeIndex, minColumn, maxColumn, minRow, maxRow, factsByIndex);
    return {
        sourceSizeIndex: sizeIndex,
        sourceSizeIndexText: sizeIndex.toString(),
        sizeText: value.size,
        kernelFactRef: `/sizes/${sizeIndex.toString()}`,
        minColumn,
        maxColumn,
        minRow,
        maxRow,
        facts,
        factsByIndex,
    };
}
function locateMissingFieldFact(sizeIndex, minColumn, maxColumn, minRow, maxRow, facts) {
    for (let row = minRow; row <= maxRow; row += 1n) {
        for (let column = minColumn; column <= maxColumn; column += 1n) {
            if (!facts.has(coordinateKey(column, row))) {
                throw new MissingKernelFactError(sizeIndex, column, row);
            }
        }
    }
}
function validateRationalPoint(value, path) {
    if (!isRecord(value)) {
        throw new EnumeratorInputError("INVALID_RATIONAL", path, "expected an exact rational point");
    }
    return {
        x: validateRational(value.x, `${path}.x`),
        y: validateRational(value.y, `${path}.y`),
    };
}
function validateRational(value, path) {
    if (!isRecord(value)) {
        throw new EnumeratorInputError("INVALID_RATIONAL", path, "expected an exact rational");
    }
    const numerator = parseDecimalString(value.numerator, `${path}.numerator`);
    const denominator = parseDecimalString(value.denominator, `${path}.denominator`);
    if (denominator <= 0n) {
        throw new EnumeratorInputError("INVALID_RATIONAL", `${path}.denominator`, "denominator must be positive");
    }
    return {
        numerator: numerator.toString(),
        denominator: denominator.toString(),
    };
}
export function validateGrammar(grammar) {
    const grammarValue = grammar;
    if (!isRecord(grammarValue)) {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", "grammar", "expected an object");
    }
    assertExactKeys(grammarValue, ["families", "populations", "schema"], "grammar");
    if (grammarValue.schema !== "magnetic-grid-candidate-enumerator/grammar/v1") {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SCHEMA", "grammar.schema", "expected magnetic-grid-candidate-enumerator/grammar/v1");
    }
    if (!Array.isArray(grammarValue.populations)) {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", "grammar.populations", "expected an array");
    }
    const populations = [];
    let populationIndex = 0n;
    for (const population of grammarValue.populations) {
        populations.push(validatePopulation(population, populationIndex));
        populationIndex += 1n;
    }
    const seenIds = new Set();
    for (const population of populations) {
        if (seenIds.has(population.id)) {
            throw new EnumeratorInputError("DUPLICATE_POPULATION_ID", "grammar.populations", `duplicate population id ${JSON.stringify(population.id)}`);
        }
        seenIds.add(population.id);
    }
    populations.sort((left, right) => compareText(left.id, right.id));
    if (!isRecord(grammarValue.families)) {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", "grammar.families", "expected an object containing exactly the five authoritative families");
    }
    assertExactKeys(grammarValue.families, ["corner-triangle", "full-window", "rectangle-corners", "run", "single"], "grammar.families");
    const run = grammarValue.families.run;
    if (!isRecord(run)) {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", "grammar.families.run", "expected an object");
    }
    assertExactKeys(run, ["stepDomain"], "grammar.families.run");
    if (run.stepDomain !== "unit-population-step-only" &&
        run.stepDomain !== "any-positive-whole-population-step") {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", "grammar.families.run.stepDomain", "expected one of the two explicit formal readings");
    }
    const rectangleCorners = grammarValue.families["rectangle-corners"];
    if (!isRecord(rectangleCorners)) {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", "grammar.families.rectangle-corners", "expected an empty object");
    }
    assertExactKeys(rectangleCorners, [], "grammar.families.rectangle-corners");
    const cornerTriangle = grammarValue.families["corner-triangle"];
    if (!isRecord(cornerTriangle)) {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", "grammar.families.corner-triangle", "expected an empty object");
    }
    assertExactKeys(cornerTriangle, [], "grammar.families.corner-triangle");
    const fullWindow = grammarValue.families["full-window"];
    if (!isRecord(fullWindow)) {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", "grammar.families.full-window", "expected an object");
    }
    assertExactKeys(fullWindow, ["oneByOne"], "grammar.families.full-window");
    if (fullWindow.oneByOne !== "include" && fullWindow.oneByOne !== "exclude") {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", "grammar.families.full-window.oneByOne", "expected include or exclude");
    }
    return {
        populations,
        runStepDomain: run.stepDomain,
        oneByOneFullWindow: fullWindow.oneByOne,
    };
}
function validatePopulation(value, index) {
    const path = `grammar.populations[${index}]`;
    if (!isRecord(value)) {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", path, "expected an object");
    }
    assertExactKeys(value, ["id", "indexStep", "origin"], path);
    if (typeof value.id !== "string" || value.id.length === 0) {
        throw new EnumeratorInputError("INVALID_POPULATION_ID", `${path}.id`, "population id must be a non-empty string");
    }
    if (!isRecord(value.origin)) {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", `${path}.origin`, "expected an object");
    }
    assertExactKeys(value.origin, ["column", "row"], `${path}.origin`);
    const indexStep = parseInteger(value.indexStep, `${path}.indexStep`);
    if (indexStep <= 0n) {
        throw new EnumeratorInputError("NON_POSITIVE_POPULATION_STEP", `${path}.indexStep`, "population indexStep must be positive");
    }
    return {
        id: value.id,
        originColumn: parseInteger(value.origin.column, `${path}.origin.column`),
        originRow: parseInteger(value.origin.row, `${path}.origin.row`),
        indexStep,
    };
}
function assertExactKeys(value, expected, path) {
    const actual = Object.keys(value).sort(compareText);
    const required = [...expected].sort(compareText);
    if (actual.length !== required.length ||
        actual.some((key, index) => key !== required[index])) {
        throw new EnumeratorInputError("INVALID_GRAMMAR_SHAPE", path, `expected exactly keys [${required.join(", ")}], received [${actual.join(", ")}]`);
    }
}
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
