import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const cli = resolve(root, "build/onemo-magnetic-cli");
const request = resolve(root, "fixtures/benchmark_request.json");
const expectedBytes = readFileSync(resolve(root, "fixtures/benchmark_result.json"));

function runSolve() {
  const run = spawnSync(cli, [request], {
    cwd: root,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) {
    throw new Error(`benchmark solve failed (${run.status}): ${String(run.stderr)}`);
  }
  return run.stdout;
}

const first = runSolve();
const second = runSolve();
if (!first.equals(second)) throw new Error("two cold benchmark solves were not byte-identical");
if (!first.equals(expectedBytes)) throw new Error("benchmark result differs from the checked canonical fixture");

const parsed = JSON.parse(first.toString("utf8"));
const expected = {
  prepared_vertex_count: 16,
  site_facts_computed: 2592,
  corridor_facts_computed: 21,
  placements_tested: 374720,
  candidates_emitted: 88,
};
for (const [key, value] of Object.entries(expected)) {
  if (parsed.metrics?.[key] !== value) {
    throw new Error(`benchmark metric ${key}: expected ${value}, received ${parsed.metrics?.[key]}`);
  }
}
console.log("PASS full guarded-profile enumeration and canonical fixture bytes");
