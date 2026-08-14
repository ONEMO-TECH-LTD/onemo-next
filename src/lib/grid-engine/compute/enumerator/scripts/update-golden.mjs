import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { enumerateCandidates, serializeCanonical } from "../dist/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = JSON.parse(
  readFileSync(resolve(root, "fixtures/inputs/completeness-two-held.json"), "utf8"),
);
const output = serializeCanonical(enumerateCandidates(input));
writeFileSync(
  resolve(root, "fixtures/expected/completeness-two-held.canonical.json"),
  output,
  "utf8",
);
