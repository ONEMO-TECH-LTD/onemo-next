/**
 * tokens.config.mjs — ONEMO Design Token Pipeline Configuration
 *
 * Separates config from engine logic in build-tokens.mjs.
 * Edit this file to adjust source paths, viewport bounds, and output strategy
 * without touching the converter engine.
 *
 * DEC-DS-027: Script + config now (tokens.config.mjs separates config from engine).
 *             MCP wrapper is the next phase.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

export const CONFIG = {
  // Source JSON from Figma Variables Pro export
  sourcePath: join(
    ROOT,
    '../onemo-ssot-global/11-design-system/artifacts/figma-variables-2026-03-06.json',
  ),

  // Viewport bounds for Utopia fluid clamp() generation
  // min = xs breakpoint (mobile), max = 3xl breakpoint (desktop)
  viewportBounds: {
    min: 375,
    max: 1440,
  },

  // Alias layer emission
  // false = aliases.css is suppressed (internal-only, never emitted to consumers)
  // Alias collections are layer 2 and must NOT produce CSS custom properties.
  emitAlias: false,

  // CSS output directory
  outputDir: join(ROOT, 'src/app/tokens'),

  // Dark mode strategy — emit both media query and class selector
  darkMode: {
    media: '@media (prefers-color-scheme: dark)',
    class: '[data-theme="dark"]',
  },

  // Color output unit for primitive and semantic colors
  colorUnit: 'oklch',
};
