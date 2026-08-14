import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    exclude: [
      "node_modules/**",
      "studio/**",
      "studio-v2/**",
      // The three installed grid-engine packages ship their own node:test suites and run under
      // their own runner (kernel 18, enumerator 13, product logic 15). Vitest cannot execute them
      // — they use node:test, not vitest globals — so collecting them reports "no test suite
      // found" for tests that are green. They are delivered artifacts, not app tests.
      "src/lib/grid-engine/compute/*/test/**",
      "src/lib/grid-engine/logic/*/test/**",
      // Archive hygiene, and pre-existing rather than caused by the installation: the delivery
      // archive carries the same suites and vitest has always collected them. tsconfig already
      // excludes _WIP for the same reason — the archive is not app source.
      "_WIP/**",
    ],
  },
});
