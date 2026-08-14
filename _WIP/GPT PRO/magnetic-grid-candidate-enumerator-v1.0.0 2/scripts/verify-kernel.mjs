import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kernelRoot = resolve(packageRoot, "magnetic-grid-measurement-kernel");
const manifest = readFileSync(resolve(kernelRoot, "SHA256SUMS"), "utf8");

for (const line of manifest.split("\n")) {
  if (line.length === 0) {
    continue;
  }
  const match = /^([0-9a-f]{64})  \.\/(.+)$/.exec(line);
  if (match === null) {
    throw new Error(`invalid kernel checksum manifest line: ${JSON.stringify(line)}`);
  }
  const [, expected, relativePath] = match;
  const bytes = readFileSync(resolve(kernelRoot, relativePath));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(
      `accepted kernel file changed: ${relativePath}\nexpected ${expected}\nactual   ${actual}`,
    );
  }
}

console.log("accepted kernel SHA-256 manifest verified unchanged");
