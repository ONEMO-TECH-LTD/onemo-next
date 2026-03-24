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
    '../onemo-ssot-global/11-design-system/artifacts/figma-variables-2026-03-10.json',
  ),

  // Naming rules config — ONEMO-specific project config for the converter
  namingRulesPath: join(ROOT, '../onemo-ssot-global/11-design-system/naming-rules.json'),

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

  // CSS output targets — array of named destinations
  outputs: [
    { name: 'onemo-next', path: join(ROOT, 'src/app/tokens') },
    { name: 'onemo-theme', path: join(ROOT, '../onemo-theme/assets/tokens') },
  ],

  // Backwards compatibility: code that reads config.outputDir still works
  get outputDir() { return this.outputs[0].path; },

  // Dark mode strategy — emit both media query and class selector
  darkMode: {
    media: '@media (prefers-color-scheme: dark)',
    class: '[data-theme="dark"]',
  },

  // Color output unit for primitive and semantic colors
  colorUnit: 'oklch',
};
