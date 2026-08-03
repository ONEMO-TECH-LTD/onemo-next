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
      // ── GRID SUITES PAUSED — Dan, 2026-08-03: "stop automated tests we need to rewrite them in the
      // end on the fully locked verified engine - file the task and pause the tests - unplug for now".
      //
      // They assert couplings Dan overruled on 08-03: Light hardcoded to 96mm, Standard to 48mm,
      // Pattern Auto, and ONE being absent rather than merely not offered. Stale, not broken code.
      // Repairing them against an engine still mid-cut would pin transitional values as truth, which
      // is what law 8.9 and Grid QA's test classification both forbid.
      //
      // UNPAUSING IS A DELIVERABLE, NOT A CHORE — KAI-10090, once the engine is locked and verified.
      // Nothing here may be deleted: the four-shape censuses, composition, delivery and perimeter
      // coverage these files carry must survive the rewrite.
      "src/lib/effect/__tests__/grid*.test.ts",
      "scripts/device-performance/report.test.ts",
    ],
  },
});
