import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    // Timeouts are not performance gates (T3 measures perf explicitly). The default 5 s is tuned for
    // a quiet laptop; on a loaded CI runner two unrelated suites (composite pixel oracle, Session 59
    // grid ladder) crossed it by fractions of a second and produced false reds on #215 / #216.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    exclude: [
      "node_modules/**",
      "_WIP/**", // vendored GPT Pro delivery packages carry their own runners' suites
      "studio/**",
      "studio-v2/**",
      // The three installed grid-engine packages ship their own node:test suites and run under
      // their own runner (kernel 18, enumerator 13, product logic 15). Vitest cannot execute them
      // — they use node:test, not vitest globals — so collecting them reports "no test suite
      // found" for tests that are green. They are delivered artifacts, not app tests.
      //
      // Named exactly, never globbed: a `compute/*/test/**` pattern would silently swallow the
      // tests of any future module placed beside them.
      "src/lib/grid-engine/compute/magnetic-grid-measurement-kernel/test/**",
      "src/lib/grid-engine/compute/enumerator/test/**",
      "src/lib/grid-engine/logic/magnetic-grid-product-logic/test/**",
      // The engine package ships its own consumer smoke under node:test (npm test inside the package),
      // and its dist is build output — neither belongs to the app suite.
      "src/lib/effect/engine-package/**",
    ],
  },
});
