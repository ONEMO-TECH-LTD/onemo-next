import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { measureLattice } from "../../magnetic-grid-measurement-kernel/dist/index.js";
import {
  MissingKernelFactError,
  enumerateCandidates,
  serializeCanonical,
} from "../dist/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const allFamiliesGrammar = grammar({
  populations: [population("base", 0, 0, 1)],
  runStepDomain: "any-positive-whole-population-step",
  oneByOne: "exclude",
});

test("each authoritative family is produced, including the required nontrivial constructions", () => {
  const measurement = allHeldKernelMeasurement(0, 3, 0, 3);
  const output = enumerateCandidates({ measurement, grammar: allFamiliesGrammar });

  assertCandidate(output, {
    family: "run",
    population: "base",
    steps: [1, 1],
    positions: [[0, 0], [1, 1], [2, 2]],
  });
  assertCandidate(output, {
    family: "rectangle-corners",
    population: "base",
    steps: [3, 2],
    positions: [[0, 0], [3, 0], [0, 2], [3, 2]],
  });
  assertCandidate(output, {
    family: "rectangle-corners",
    population: "base",
    steps: [1, 3],
    positions: [[1, 0], [2, 0], [1, 3], [2, 3]],
  });
  assertCandidate(output, {
    family: "corner-triangle",
    population: "base",
    steps: [1, 1],
    positions: [[0, 0], [1, 0], [0, 1]],
  });
  assertCandidate(output, {
    family: "full-window",
    population: "base",
    steps: [2, 1],
    positions: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  });
});

test("a held fourth corner does not suppress any of the four corner triangles", () => {
  const measurement = makeMeasurement({
    minColumn: 0,
    maxColumn: 1,
    minRow: 0,
    maxRow: 1,
    held: [[0, 0], [1, 0], [0, 1], [1, 1]],
  });
  const output = enumerateCandidates({ measurement, grammar: allFamiliesGrammar });
  const triangles = output.candidates.filter(
    (candidate) =>
      candidate.family === "corner-triangle" &&
      candidate.population === "base" &&
      candidate.steps.column === "1" &&
      candidate.steps.row === "1",
  );
  assert.equal(triangles.length, 4);
  assert.deepEqual(
    new Set(triangles.map((candidate) => positionSetKey(candidate.positions))),
    new Set([
      "0,0;1,0;0,1",
      "0,0;1,0;1,1",
      "0,0;0,1;1,1",
      "1,0;0,1;1,1",
    ]),
  );
});

test("small completeness golden equals the hand-enumerated set exactly", () => {
  const inputBytes = readFileSync(resolve(root, "fixtures/inputs/completeness-two-held.json"), "utf8");
  const expectedBytes = readFileSync(
    resolve(root, "fixtures/expected/completeness-two-held.canonical.json"),
    "utf8",
  );
  const input = JSON.parse(inputBytes);
  const first = serializeCanonical(enumerateCandidates(input));
  const second = serializeCanonical(enumerateCandidates(JSON.parse(inputBytes)));

  assert.equal(first, expectedBytes);
  assert.equal(second, expectedBytes);
  const output = enumerateCandidates(input);
  assert.equal(output.candidates.length, 2);
  assert.deepEqual(
    output.candidates.map((candidate) => candidate.family).sort(),
    ["full-window", "run"],
  );
});

test("the same held set is enumerated independently on base and sparse populations", () => {
  const measurement = makeMeasurement({
    minColumn: 0,
    maxColumn: 4,
    minRow: 0,
    maxRow: 0,
    held: [[0, 0], [2, 0], [4, 0]],
  });
  const suppliedGrammar = grammar({
    populations: [population("base", 0, 0, 1), population("sparse", 0, 0, 2)],
    runStepDomain: "any-positive-whole-population-step",
    oneByOne: "exclude",
  });
  const output = enumerateCandidates({ measurement, grammar: suppliedGrammar });
  const shared = [[0, 0], [2, 0], [4, 0]];

  assertCandidate(output, {
    family: "run",
    population: "base",
    steps: [2, 0],
    positions: shared,
  });
  assertCandidate(output, {
    family: "run",
    population: "sparse",
    steps: [1, 0],
    positions: shared,
  });
  assertCandidate(output, {
    family: "full-window",
    population: "sparse",
    steps: [2, 0],
    positions: shared,
  });
  assert.equal(
    findCandidate(output, {
      family: "full-window",
      population: "base",
      steps: [4, 0],
      positions: shared,
    }),
    undefined,
  );
});

test("one position set reached by two families returns two distinct records", () => {
  const measurement = makeMeasurement({
    minColumn: 0,
    maxColumn: 1,
    minRow: 0,
    maxRow: 0,
    held: [[0, 0], [1, 0]],
  });
  const output = enumerateCandidates({ measurement, grammar: allFamiliesGrammar });
  const sameSet = output.candidates.filter(
    (candidate) => positionSetKey(candidate.positions) === "0,0;1,0",
  );

  assert.deepEqual(
    sameSet.map((candidate) => candidate.family).sort(),
    ["full-window", "run"],
  );
  assert.notEqual(sameSet[0].id, sameSet[1].id);
});

test("a 2 x 2 held block remains both rectangle corners and a full window", () => {
  const measurement = makeMeasurement({
    minColumn: 0,
    maxColumn: 1,
    minRow: 0,
    maxRow: 1,
    held: [[0, 0], [1, 0], [0, 1], [1, 1]],
  });
  const output = enumerateCandidates({ measurement, grammar: allFamiliesGrammar });
  const set = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const rectangle = findCandidate(output, {
    family: "rectangle-corners",
    population: "base",
    steps: [1, 1],
    positions: set,
  });
  const window = findCandidate(output, {
    family: "full-window",
    population: "base",
    steps: [1, 1],
    positions: set,
  });
  assert.ok(rectangle);
  assert.ok(window);
  assert.notEqual(rectangle.id, window.id);
});

test("larger arrangements never suppress their subruns or skipped-step runs", () => {
  const measurement = makeMeasurement({
    minColumn: 0,
    maxColumn: 3,
    minRow: 0,
    maxRow: 0,
    held: [[0, 0], [1, 0], [2, 0], [3, 0]],
  });
  const output = enumerateCandidates({ measurement, grammar: allFamiliesGrammar });

  assertCandidate(output, {
    family: "run",
    population: "base",
    steps: [1, 0],
    positions: [[0, 0], [1, 0], [2, 0], [3, 0]],
  });
  assertCandidate(output, {
    family: "run",
    population: "base",
    steps: [1, 0],
    positions: [[1, 0], [2, 0]],
  });
  assertCandidate(output, {
    family: "run",
    population: "base",
    steps: [3, 0],
    positions: [[0, 0], [3, 0]],
  });
});

test("the two exposed formal readings are supplied by grammar data, not chosen by the enumerator", () => {
  const oneHeld = makeMeasurement({
    minColumn: 0,
    maxColumn: 0,
    minRow: 0,
    maxRow: 0,
    held: [[0, 0]],
  });
  const includeOne = enumerateCandidates({
    measurement: oneHeld,
    grammar: grammar({
      populations: [population("base", 0, 0, 1)],
      runStepDomain: "any-positive-whole-population-step",
      oneByOne: "include",
    }),
  });
  const excludeOne = enumerateCandidates({
    measurement: oneHeld,
    grammar: grammar({
      populations: [population("base", 0, 0, 1)],
      runStepDomain: "any-positive-whole-population-step",
      oneByOne: "exclude",
    }),
  });
  assert.equal(includeOne.candidates.length, 1);
  assert.equal(includeOne.candidates[0].family, "full-window");
  assert.equal(excludeOne.candidates.length, 0);

  const skippedPair = makeMeasurement({
    minColumn: 0,
    maxColumn: 2,
    minRow: 0,
    maxRow: 0,
    held: [[0, 0], [2, 0]],
  });
  const anyStep = enumerateCandidates({
    measurement: skippedPair,
    grammar: grammar({
      populations: [population("base", 0, 0, 1)],
      runStepDomain: "any-positive-whole-population-step",
      oneByOne: "exclude",
    }),
  });
  const unitOnly = enumerateCandidates({
    measurement: skippedPair,
    grammar: grammar({
      populations: [population("base", 0, 0, 1)],
      runStepDomain: "unit-population-step-only",
      oneByOne: "exclude",
    }),
  });
  assert.ok(anyStep.candidates.some((candidate) => candidate.family === "run"));
  assert.equal(unitOnly.candidates.some((candidate) => candidate.family === "run"), false);
});

test("identical input bytes produce identical canonical output bytes and input is not mutated", () => {
  const inputBytes = readFileSync(resolve(root, "fixtures/inputs/completeness-two-held.json"), "utf8");
  const firstInput = JSON.parse(inputBytes);
  const secondInput = JSON.parse(inputBytes);
  const before = JSON.stringify(firstInput);
  const first = serializeCanonical(enumerateCandidates(firstInput));
  const second = serializeCanonical(enumerateCandidates(secondInput));

  assert.equal(first, second);
  assert.equal(JSON.stringify(firstInput), before);
});


test("duplicate size values remain distinct source occurrences while arrangement identity stays structural", () => {
  const measurement = makeMeasurement({
    minColumn: 0,
    maxColumn: 1,
    minRow: 0,
    maxRow: 0,
    held: [[0, 0], [1, 0]],
  });
  measurement.sizes.push(structuredClone(measurement.sizes[0]));
  const output = enumerateCandidates({ measurement, grammar: allFamiliesGrammar });
  assert.equal(output.candidates.length, 4);

  const firstRun = output.candidates.find(
    (candidate) => candidate.family === "run" && candidate.size.kernelSizeIndex === "0",
  );
  const secondRun = output.candidates.find(
    (candidate) => candidate.family === "run" && candidate.size.kernelSizeIndex === "1",
  );
  assert.ok(firstRun);
  assert.ok(secondRun);
  assert.equal(firstRun.size.value, secondRun.size.value);
  assert.equal(firstRun.id, secondRun.id);
  assert.equal(firstRun.size.kernelFactRef, "/sizes/0");
  assert.equal(secondRun.size.kernelFactRef, "/sizes/1");
});

test("population input order does not alter canonical output order", () => {
  const measurement = makeMeasurement({
    minColumn: 0,
    maxColumn: 2,
    minRow: 0,
    maxRow: 0,
    held: [[0, 0], [1, 0], [2, 0]],
  });
  const forward = grammar({
    populations: [population("base", 0, 0, 1), population("phase", 0, 0, 2)],
    runStepDomain: "any-positive-whole-population-step",
    oneByOne: "exclude",
  });
  const reverse = grammar({
    populations: [population("phase", 0, 0, 2), population("base", 0, 0, 1)],
    runStepDomain: "any-positive-whole-population-step",
    oneByOne: "exclude",
  });
  assert.equal(
    serializeCanonical(enumerateCandidates({ measurement, grammar: forward })),
    serializeCanonical(enumerateCandidates({ measurement, grammar: reverse })),
  );
});

test("candidate centres are copied from kernel facts rather than reconstructed from indices", () => {
  const measurement = makeMeasurement({
    minColumn: 0,
    maxColumn: 1,
    minRow: 0,
    maxRow: 0,
    held: [[0, 0], [1, 0]],
  });
  measurement.sizes[0].positions[0].center = {
    x: { numerator: "17", denominator: "3" },
    y: { numerator: "-29", denominator: "5" },
  };
  const output = enumerateCandidates({ measurement, grammar: allFamiliesGrammar });
  const run = output.candidates.find((candidate) => candidate.family === "run");
  assert.ok(run);
  assert.deepEqual(run.positions[0].center, {
    x: { numerator: "17", denominator: "3" },
    y: { numerator: "-29", denominator: "5" },
  });
  assert.equal(run.positions[0].kernelFactRef, "/sizes/0/positions/0");
});

test("a missing field fact is named and enumeration stops", () => {
  const malformed = makeMeasurement({
    minColumn: 0,
    maxColumn: 2,
    minRow: 0,
    maxRow: 0,
    held: [[0, 0], [2, 0]],
  });
  malformed.sizes[0].positions.splice(1, 1);

  assert.throws(
    () => enumerateCandidates({ measurement: malformed, grammar: allFamiliesGrammar }),
    (error) =>
      error instanceof MissingKernelFactError &&
      error.sizeIndex === "0" &&
      error.column === "1" &&
      error.row === "0",
  );
});

function allHeldKernelMeasurement(minColumn, maxColumn, minRow, maxRow) {
  return measureLattice({
    polygon: {
      vertices: [
        { x: "-1000", y: "-1000" },
        { x: "1000", y: "-1000" },
        { x: "1000", y: "1000" },
        { x: "-1000", y: "1000" },
      ],
    },
    parameters: {
      lattice: {
        pitch: "10",
        origin: {
          x: { numerator: "0", denominator: "1" },
          y: { numerator: "0", denominator: "1" },
        },
        fieldExtent: {
          minColumn: String(minColumn),
          maxColumn: String(maxColumn),
          minRow: String(minRow),
          maxRow: String(maxRow),
        },
      },
      discDiameter: "2",
      sizeTransform: {
        sourceSize: "1",
        sourceAnchor: {
          x: { numerator: "0", denominator: "1" },
          y: { numerator: "0", denominator: "1" },
        },
        targetAnchor: {
          x: { numerator: "0", denominator: "1" },
          y: { numerator: "0", denominator: "1" },
        },
      },
    },
    sizes: ["1"],
  });
}

function makeMeasurement({ minColumn, maxColumn, minRow, maxRow, held, size = "100" }) {
  const heldKeys = new Set(held.map(([column, row]) => `${column},${row}`));
  const positions = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const fits = heldKeys.has(`${column},${row}`);
      positions.push({
        column: String(column),
        row: String(row),
        center: {
          x: { numerator: String(column), denominator: "1" },
          y: { numerator: String(row), denominator: "1" },
        },
        centerLocation: fits ? "inside" : "outside",
        clearance: {
          kind: "sqrt-rational",
          radicand: { numerator: fits ? "100" : "0", denominator: "1" },
        },
        fits,
        limitingContacts: [],
      });
    }
  }
  return {
    schema: "magnetic-grid-measurement-kernel/lattice/v1",
    sizes: [
      {
        size,
        scale: { numerator: "1", denominator: "1" },
        positions,
      },
    ],
  };
}

function population(id, originColumn, originRow, indexStep) {
  return {
    id,
    origin: { column: String(originColumn), row: String(originRow) },
    indexStep: String(indexStep),
  };
}

function grammar({ populations, runStepDomain, oneByOne }) {
  return {
    schema: "magnetic-grid-candidate-enumerator/grammar/v1",
    populations,
    families: {
      run: { stepDomain: runStepDomain },
      "rectangle-corners": {},
      "corner-triangle": {},
      "full-window": { oneByOne },
    },
  };
}

function assertCandidate(output, expected) {
  const candidate = findCandidate(output, expected);
  assert.ok(candidate, `missing candidate ${JSON.stringify(expected)}`);
  for (const position of candidate.positions) {
    assert.match(position.kernelFactRef, /^\/sizes\/0\/positions\/[0-9]+$/);
    assert.equal(typeof position.center.x.numerator, "string");
    assert.equal(typeof position.center.y.numerator, "string");
  }
}

function findCandidate(output, expected) {
  const expectedKey = positionSetKey(
    expected.positions.map(([column, row]) => ({ column: String(column), row: String(row) })),
  );
  return output.candidates.find(
    (candidate) =>
      candidate.family === expected.family &&
      candidate.population === expected.population &&
      candidate.steps.column === String(expected.steps[0]) &&
      candidate.steps.row === String(expected.steps[1]) &&
      positionSetKey(candidate.positions) === expectedKey,
  );
}

function positionSetKey(positions) {
  return positions
    .map((position) => `${position.column},${position.row}`)
    .sort((left, right) => {
      const [leftColumn, leftRow] = left.split(",").map(BigInt);
      const [rightColumn, rightRow] = right.split(",").map(BigInt);
      return leftRow < rightRow
        ? -1
        : leftRow > rightRow
          ? 1
          : leftColumn < rightColumn
            ? -1
            : leftColumn > rightColumn
              ? 1
              : 0;
    })
    .join(";");
}
