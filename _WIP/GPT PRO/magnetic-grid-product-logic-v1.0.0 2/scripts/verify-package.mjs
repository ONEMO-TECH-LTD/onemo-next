import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "SHA256SUMS");
const manifestText = await readFile(manifestPath, "utf8");
const expected = new Map();

for (const line of manifestText.split("\n")) {
  if (line.length === 0) continue;
  const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
  if (match === null) {
    throw new Error(`invalid SHA256SUMS line: ${JSON.stringify(line)}`);
  }
  expected.set(match[2], match[1]);
}

const files = await walk(root);
const actualFiles = files
  .map((path) => relative(root, path).replaceAll("\\", "/"))
  .filter((path) => path !== "SHA256SUMS")
  .sort();
const expectedFiles = [...expected.keys()].sort();

if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(
    `package file set differs from SHA256SUMS\nactual=${JSON.stringify(actualFiles)}\nexpected=${JSON.stringify(expectedFiles)}`,
  );
}

for (const path of actualFiles) {
  const bytes = await readFile(resolve(root, path));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== expected.get(path)) {
    throw new Error(`SHA-256 mismatch for ${path}: ${digest} != ${expected.get(path)}`);
  }
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
  if (packageJson[field] !== undefined && Object.keys(packageJson[field]).length !== 0) {
    throw new Error(`zero-dependency contract violated by package.json ${field}`);
  }
}

for (const forbidden of [
  "magnetic-grid-measurement-kernel",
  "magnetic-grid-candidate-enumerator",
  "node_modules",
]) {
  if (actualFiles.some((path) => path === forbidden || path.startsWith(`${forbidden}/`))) {
    throw new Error(`forbidden bundled upstream/dependency path: ${forbidden}`);
  }
}

console.log(`Verified ${actualFiles.length} product-logic package files.`);

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await walk(path));
    } else if (entry.isFile()) {
      output.push(path);
    }
  }
  return output;
}
