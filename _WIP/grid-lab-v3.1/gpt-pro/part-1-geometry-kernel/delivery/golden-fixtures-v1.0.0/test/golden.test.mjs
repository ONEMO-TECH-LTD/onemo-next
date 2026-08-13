import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  KernelInputError,
  measureLattice,
  measureStraightCapsule,
  serializeCanonical,
} from "../dist/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = readJson("fixtures/manifest.json");

for (const fixture of manifest.lattice) {
  test(`lattice golden: ${fixture.name}`, () => {
    const input = readJson(`fixtures/${fixture.input}`);
    const expected = readFileSync(resolve(root, "fixtures", fixture.expected), "utf8");
    const first = serializeCanonical(measureLattice(input));
    const second = serializeCanonical(measureLattice(input));
    assert.equal(first, expected);
    assert.equal(second, expected, "repeated evaluation must be byte-stable");
  });
}

for (const fixture of manifest.straightCapsule) {
  test(`straight-capsule golden: ${fixture.name}`, () => {
    const input = readJson(`fixtures/${fixture.input}`);
    const expected = readFileSync(resolve(root, "fixtures", fixture.expected), "utf8");
    const first = serializeCanonical(measureStraightCapsule(input));
    const second = serializeCanonical(measureStraightCapsule(input));
    assert.equal(first, expected);
    assert.equal(second, expected, "repeated evaluation must be byte-stable");
  });
}

test("each requested size is evaluated independently and input order is preserved", () => {
  const input = readJson("fixtures/inputs/disc-boundary-exact.json");
  input.sizes = ["21", "20", "21"];
  const output = measureLattice(input);
  assert.deepEqual(
    output.sizes.map((entry) => entry.size),
    ["21", "20", "21"],
  );
  assert.equal(output.sizes[0].positions[0].fits, true);
  assert.equal(output.sizes[1].positions[0].fits, false);
  assert.deepEqual(output.sizes[0], output.sizes[2]);
});

test("the kernel rejects a repeated closing vertex instead of repairing it", () => {
  const input = readJson("fixtures/inputs/disc-boundary-exact.json");
  input.polygon.vertices.push({ ...input.polygon.vertices[0] });
  assert.throws(
    () => measureLattice(input),
    (error) => error instanceof KernelInputError && error.code === "REPEATED_CLOSING_VERTEX",
  );
});

test("the kernel rejects a self-intersection instead of repairing it", () => {
  const input = readJson("fixtures/inputs/disc-boundary-exact.json");
  input.polygon.vertices = [
    { x: "-10", y: "-10" },
    { x: "10", y: "10" },
    { x: "-10", y: "10" },
    { x: "10", y: "-10" },
  ];
  assert.throws(
    () => measureLattice(input),
    (error) =>
      error instanceof KernelInputError &&
      (error.code === "POLYGON_ZERO_AREA" || error.code === "POLYGON_NOT_SIMPLE"),
  );
});

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
}
