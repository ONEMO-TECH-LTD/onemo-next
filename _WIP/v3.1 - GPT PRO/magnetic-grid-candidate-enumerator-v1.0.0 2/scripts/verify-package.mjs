import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = readFileSync(resolve(packageRoot, "PACKAGE-SHA256SUMS"), "utf8");

for (const line of manifest.split("\n")) {
  if (line.length === 0) {
    continue;
  }
  const match = /^([0-9a-f]{64})  \.\/(.+)$/.exec(line);
  if (match === null) {
    throw new Error(`invalid package checksum manifest line: ${JSON.stringify(line)}`);
  }
  const [, expected, relativePath] = match;
  const bytes = readFileSync(resolve(packageRoot, relativePath));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(
      `package file changed: ${relativePath}\nexpected ${expected}\nactual   ${actual}`,
    );
  }
}

console.log("complete package SHA-256 manifest verified");
