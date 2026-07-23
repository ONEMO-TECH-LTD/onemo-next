import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "src/app/(dev)/effect-creator/grid-lab/GridWorkbenchUserPanel*.{ts,tsx}",
      "src/app/(dev)/effect-creator/v5.3.1/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/effect/grid-admin",
                "@/lib/effect/grid-core",
                "@/lib/effect/grid",
                "**/lib/effect/grid-admin",
                "**/lib/effect/grid-core",
                "**/lib/effect/grid",
              ],
              message: "Creator user code must use @/lib/effect/grid-user; admin and core grid modules are ringfenced.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Storybook build output (gitignored bundles, not source)
    "storybook-static/**",
    // Non-runtime: backup copies, archives, not linted
    "asset-library/**",
    "?archive/**",
    // Standalone prototype labs (dc.html/Babel runtimes, Vite apps) — not Next app source
    "_prototypes/**",
    // ONEMO 3D Studio — has its own lint config
    "studio/**",
    "studio-v2/**",
  ]),
]);

export default eslintConfig;
