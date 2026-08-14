import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  measureLattice,
  measureStraightCapsule,
  serializeCanonical,
} from "../dist/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "fixtures/manifest.json"), "utf8"));
const generated = new Map();

for (const fixture of manifest.lattice) {
  emit(fixture, measureLattice);
}
for (const fixture of manifest.straightCapsule) {
  emit(fixture, measureStraightCapsule);
}

function emit(fixture, operation) {
  const input = JSON.parse(readFileSync(resolve(root, "fixtures", fixture.input), "utf8"));
  const output = serializeCanonical(operation(input));
  const path = resolve(root, "fixtures", fixture.expected);
  const prior = generated.get(path);
  if (prior !== undefined && prior !== output) {
    throw new Error(
      `fixtures targeting the same expected file disagree: ${fixture.expected}`,
    );
  }
  generated.set(path, output);
  writeFileSync(path, output);
}
