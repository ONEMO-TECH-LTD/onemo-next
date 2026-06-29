import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
    // ONEMO 3D Studio — has its own lint config
    "studio/**",
    "studio-v2/**",
  ]),
]);

export default eslintConfig;
