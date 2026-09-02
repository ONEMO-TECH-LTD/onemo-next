import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = (await walk(root))
  .map((path) => ({ absolute: path, relative: relative(root, path).replaceAll("\\", "/") }))
  .filter(({ relative }) => relative !== "SHA256SUMS")
  .sort((left, right) => left.relative.localeCompare(right.relative));

const lines = [];
for (const file of files) {
  const digest = createHash("sha256").update(await readFile(file.absolute)).digest("hex");
  lines.push(`${digest}  ${file.relative}`);
}
await writeFile(resolve(root, "SHA256SUMS"), `${lines.join("\n")}\n`);

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}
