import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "scripts/device-performance/core/**/*.{js,mjs,ts}",
      "scripts/device-performance/run.mjs",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/**", "**/src/**", "**/lib/effect/**"],
              message: "The neutral device-performance runner must not import feature or engine code.",
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
