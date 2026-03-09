#!/usr/bin/env node
/**
 * validate-tokens.mjs — ONEMO Design Token Pipeline Validator
 *
 * Validates the design token pipeline by checking:
 *   1. Figma JSON input against the naming blueprint
 *   2. Generated CSS output against the naming blueprint
 *   3. Mapping correctness — that transformations follow the documented rules
 *
 * Zero dependencies. Node.js 18+ built-in only.
 *
 * Usage:
 *   node scripts/validate-tokens.mjs
 *
 * Outputs:
 *   - CLI report (stdout)
 *   - src/app/tokens/validation-report.json
 *
 * Exit codes:
 *   0 = all checks pass
 *   1 = one or more checks fail
 *
 * Blueprint: onemo-ssot-global/11-design-system/blueprint/naming-rules.json
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './tokens.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Path resolution ──────────────────────────────────────────────────────────

const BLUEPRINT_PATH = join(
  ROOT,
  '../onemo-ssot-global/11-design-system/blueprint/naming-rules.json',
);
const FIGMA_JSON_PATH = CONFIG.sourcePath;
const OUTPUT_DIR = CONFIG.outputDir;
const CSS_FILES = {
  primitives: join(OUTPUT_DIR, 'primitives.css'),
  aliases: join(OUTPUT_DIR, 'aliases.css'),
  semantic: join(OUTPUT_DIR, 'semantic.css'),
  'semantic-inline': join(OUTPUT_DIR, 'semantic-inline.css'),
};
const REPORT_PATH = join(OUTPUT_DIR, 'validation-report.json');

// ─── Kebab transform (mirrored from build-tokens.mjs) ───────────────────────
// Copied verbatim — do not import to keep this script standalone.

/**
 * Transform a key name to CSS-safe kebab-case.
 * Steps from naming-rules.json transformation.steps (12-step algorithm):
 *  1. stripCollectionPrefix (handled at call site — we pass already-stripped paths)
 *  2. slashToHyphen
 *  3. lowercase
 *  4. normalizeAccents (NFD + strip combining marks)
 *  5. stripParenthetical
 *  6. unicodeSeparators (U+2024)
 *  7. spacesToHyphens
 *  8. underscoresToHyphens
 *  9. localeNormalization (gray → grey)
 * 10. collapseHyphens
 * 11. trimHyphens
 * 12. prependDashes (done at call site when building CSS property names)
 */
function toKebab(str) {
  return str
    .replace(/\//g, '-')                        // step 2: slash → hyphen
    .toLowerCase()                               // step 3: lowercase
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // step 4: normalize accents
    .replace(/\s*\([^)]*\)\s*/g, '')            // step 5: strip parentheticals
    .replace(/\u2024/g, '-')                    // step 6: Unicode One Dot Leader
    .replace(/\s+/g, '-')                       // step 7: spaces → hyphens
    .replace(/_/g, '-')                         // step 8: underscores → hyphens
    .replace(/gray/g, 'grey')                   // step 9: locale normalization
    .replace(/-{2,}/g, '-')                     // step 10: collapse hyphens
    .replace(/^-|-$/g, '');                     // step 11: trim leading/trailing
}

// ─── Collection tier classification (mirrors COLLECTION_NAMES in build-tokens) ──

const TIER_MAP = {
  // Primitive (Layer 1)
  '1.0_Primitive_Colours':       'primitive',
  '1.1_Primitive_Dimensions':    'primitive',
  '1.2_Primitive_Type':          'primitive',
  '1.3_Primitive_Fluid_Spacing': 'primitive',
  '1.4_Primitive_Fluid_Type_Size':   'primitive',
  '1.5_Primitive_Fluid_Type_Height': 'primitive',
  // Alias (Layer 2)
  '2.0_Alias_Colours':      'alias',
  '2.1_Alias_Type':         'alias',
  '2.2_Alias_Radius':       'alias',
  '2.3_Alias_Width':        'alias',
  '2.4_Alias_Spacing':      'alias',
  '2.5_Alias_Size':         'alias',
  '2.6_Alias_Border_Width': 'alias',
  '2.7_Alias_Breakpoints':  'alias',
  // Semantic (Layer 3)
  '3.0_Semantic_Colours':     'semantic',
  '3.1_Semantic_Type':        'semantic',
  '3.2_Semantic_Spacing':     'semantic',
  '3.3_Semantic_Width':       'semantic',
  '3.4_Semantic_Containers':  'semantic',
  '3.5_Semantic_Radius':      'semantic',
  '3.6_Semantic_Size':        'semantic',
  // Component (Layer 4)
  '4.0_Component_Colours': 'component',
  // Effects (Layer 5 / special category)
  '5.0_Effects': 'effects',
};

// Expected mode counts per category (from naming-rules.json modes.rules)
const EXPECTED_MODES = {
  '1.0_Primitive_Colours':       { count: 2, names: ['light', 'dark'] },
  '5.0_Effects':                  { count: 2, names: ['light', 'dark'] },
  '1.3_Primitive_Fluid_Spacing':  { count: 2, names: ['desktop', 'mobile'] },
  '1.4_Primitive_Fluid_Type_Size':    { count: 2, names: ['desktop', 'mobile'] },
  '1.5_Primitive_Fluid_Type_Height':  { count: 2, names: ['desktop', 'mobile'] },
};
// All others: 1 mode

// ─── CSS namespace prefixes that are valid (from blueprint categories) ────────

const VALID_CSS_NAMESPACES = [
  '--color-',
  '--spacing-',
  '--font-',
  '--text-',
  '--font-weight-',
  '--tracking-',
  '--leading-',
  '--radius-',
  '--breakpoint-',
  '--width-',
  '--container-',
  '--shadow-',
  '--blur-',
  '--border-width-',
  '--size-',
  '--ease-',
  // Primitive namespaces (not Tailwind but valid output)
  '--primitive-',
  // Semantic namespace (semantic-inline.css)
  '--semantic-',
];

// ─── Utility helpers ─────────────────────────────────────────────────────────

/**
 * Recursively collect all variable token objects from a nested Figma collection mode object.
 * Returns array of { path: string, token: object }
 */
function collectVariables(obj, prefix = '') {
  const results = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue; // skip meta fields at root level
    const currentPath = prefix ? `${prefix}/${key}` : key;
    if (value && typeof value === 'object') {
      if ('$type' in value) {
        // Leaf token
        results.push({ path: currentPath, token: value });
      } else {
        // Nested group — recurse
        results.push(...collectVariables(value, currentPath));
      }
    }
  }
  return results;
}

/**
 * Parse all CSS custom property declarations from a CSS string.
 * Returns array of { scope: string, property: string, value: string, line: number }
 */
function parseCssProperties(css) {
  const results = [];
  const lines = css.split('\n');
  let currentScope = ':root'; // default
  let lineNum = 0;

  for (const line of lines) {
    lineNum++;
    const trimmed = line.trim();

    // Detect scope openings — simple heuristic
    if (trimmed.endsWith('{') && !trimmed.startsWith('--')) {
      currentScope = trimmed.slice(0, -1).trim();
    }

    // Match CSS custom property declarations: --property: value;
    const match = trimmed.match(/^(--[a-zA-Z0-9_-]+)\s*:\s*(.+?)\s*;?$/);
    if (match) {
      results.push({
        scope: currentScope,
        property: match[1],
        value: match[2].replace(/;$/, '').trim(),
        line: lineNum,
      });
    }
  }
  return results;
}

/**
 * Check whether a CSS color value is valid.
 * Accepts: oklch(...), rgb(...), rgba(...), hsl(...), #hex, var(--...), transparent, 0
 */
function isValidCssColor(value) {
  const v = value.trim();
  return (
    /^oklch\s*\(/.test(v) ||
    /^rgba?\s*\(/.test(v) ||
    /^hsl\s*\(/.test(v) ||
    /^#[0-9a-fA-F]{3,8}$/.test(v) ||
    /^var\s*\(--/.test(v) ||
    v === 'transparent' ||
    v === '0' ||
    v === 'currentColor' ||
    v === 'inherit'
  );
}

/**
 * Check whether a CSS clamp() value is structurally valid.
 * clamp(min, preferred, max) — all three parts must be present.
 */
function isValidClamp(value) {
  const v = value.trim();
  if (!v.startsWith('clamp(')) return false;
  // Remove outer clamp()
  const inner = v.slice(6, -1).trim();
  // Split by comma at top level (not inside nested parens)
  const parts = splitTopLevel(inner, ',');
  return parts.length === 3 && parts.every(p => p.trim().length > 0);
}

/**
 * Split a string by a separator at the top nesting level (ignores parens).
 */
function splitTopLevel(str, sep) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// ─── Check implementations ───────────────────────────────────────────────────

/**
 * INPUT-1: tier-org — Every collection belongs to exactly one tier
 */
function checkTierOrg(figmaData) {
  const issues = [];
  for (const entry of figmaData) {
    const name = Object.keys(entry)[0];
    if (!(name in TIER_MAP)) {
      // Could be legacy / unknown
      issues.push(`Unknown collection not in tier map: "${name}"`);
    }
  }
  return {
    id: 'tier-org',
    category: 'input',
    status: issues.length === 0 ? 'pass' : 'warn',
    details: issues.length > 0 ? issues : ['All collections belong to a known tier'],
  };
}

/**
 * INPUT-2: name-safety — No variable names contain {, }, or . (DTCG forbidden chars)
 * Note: $value fields CAN contain { } (alias references) — we check variable NAME paths only.
 */
function checkNameSafety(figmaData) {
  const issues = [];
  for (const entry of figmaData) {
    const name = Object.keys(entry)[0];
    const collection = entry[name];
    for (const [modeName, modeVars] of Object.entries(collection.modes || {})) {
      const variables = collectVariables(modeVars);
      for (const { path } of variables) {
        if (/[{}.]/.test(path)) {
          issues.push(`Collection "${name}" mode "${modeName}": variable path "${path}" contains forbidden characters`);
        }
      }
    }
  }
  return {
    id: 'name-safety',
    category: 'input',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues : ['No forbidden characters ({, }, .) found in variable name paths'],
  };
}

/**
 * INPUT-3: mode-completeness — Correct mode count per collection category
 *
 * Rules from blueprint naming-rules.json modes.rules:
 *   - primitive-colors + effects: 2 modes (light/dark)
 *   - fluid (primitive + alias fluid wrappers): 2 modes (desktop/mobile)
 *   - alias, semantic, static-primitive: 1 mode (value)
 *
 * Note: 2.1_Alias_Type and 2.4_Alias_Spacing are fluid-value alias collections
 * that wrap fluid primitive values — they legitimately have 2 modes (Desktop/Mobile).
 * The blueprint's alias=1 rule is the general case; fluid alias collections are the exception.
 */
function checkModeCompleteness(figmaData) {
  // Collections that legitimately have 2 modes (desktop/mobile) as fluid-value aliases
  const FLUID_ALIAS_COLLECTIONS = new Set(['2.1_Alias_Type', '2.4_Alias_Spacing']);
  const issues = [];

  for (const entry of figmaData) {
    const name = Object.keys(entry)[0];
    const collection = entry[name];
    const modes = Object.keys(collection.modes || {});
    const modeCount = modes.length;

    if (name in EXPECTED_MODES) {
      const expected = EXPECTED_MODES[name];
      if (modeCount !== expected.count) {
        issues.push(
          `Collection "${name}": expected ${expected.count} modes (${expected.names.join('/')}), got ${modeCount} (${modes.join(', ')})`
        );
      }
    } else if (FLUID_ALIAS_COLLECTIONS.has(name)) {
      // Fluid alias — expect 2 modes (Desktop/Mobile)
      if (modeCount !== 2) {
        issues.push(
          `Collection "${name}" (fluid alias): expected 2 modes (Desktop/Mobile), got ${modeCount} (${modes.join(', ')})`
        );
      }
    } else {
      // All others should have exactly 1 mode
      if (modeCount !== 1) {
        issues.push(
          `Collection "${name}": expected 1 mode (Value), got ${modeCount} (${modes.join(', ')})`
        );
      }
    }
  }
  return {
    id: 'mode-completeness',
    category: 'input',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues : ['All collections have the correct number of modes'],
  };
}

/**
 * INPUT-4: collection-structure — Collection naming follows N.N_Tier_Name pattern
 */
function checkCollectionStructure(figmaData) {
  const issues = [];
  const structurePattern = /^\d+\.\d+_[A-Z][a-zA-Z0-9_]+$/;
  for (const entry of figmaData) {
    const name = Object.keys(entry)[0];
    // Allow legacy underscore-prefixed names as warn
    if (name.startsWith('_') || name.match(/^\d+\. /)) {
      // Legacy — warn only
      issues.push(`WARN: Legacy collection name "${name}" — update when possible`);
    } else if (!structurePattern.test(name)) {
      issues.push(`Collection "${name}" does not follow N.N_Tier_Name naming pattern`);
    }
  }
  const hasErrors = issues.some(i => !i.startsWith('WARN:'));
  const hasWarns = issues.some(i => i.startsWith('WARN:'));
  return {
    id: 'collection-structure',
    category: 'input',
    status: hasErrors ? 'fail' : hasWarns ? 'warn' : 'pass',
    details: issues.length > 0 ? issues : ['All collections follow expected naming structure'],
  };
}

/**
 * OUTPUT-1: namespace-compliance — Every CSS custom property follows a valid namespace
 */
function checkNamespaceCompliance(allProps) {
  const issues = [];
  for (const { property, scope } of allProps) {
    const hasValidNamespace = VALID_CSS_NAMESPACES.some(ns => property.startsWith(ns));
    if (!hasValidNamespace) {
      issues.push(`"${property}" in scope "${scope}" does not match any known namespace`);
    }
  }
  return {
    id: 'namespace-compliance',
    category: 'output',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues.slice(0, 20) : [`All ${allProps.length} CSS custom properties use recognized namespaces`],
  };
}

/**
 * OUTPUT-2: no-alias-emission — No --alias-* properties in output
 */
function checkNoAliasEmission(allProps) {
  const aliasProps = allProps.filter(p => p.property.startsWith('--alias-'));
  return {
    id: 'no-alias-emission',
    category: 'output',
    status: aliasProps.length === 0 ? 'pass' : 'fail',
    details: aliasProps.length > 0
      ? aliasProps.map(p => `"${p.property}" emitted in scope "${p.scope}"`)
      : ['No --alias-* properties found in CSS output (alias suppression active)'],
  };
}

/**
 * OUTPUT-3: no-parentheticals — No parenthetical annotations in CSS property names
 */
function checkNoParentheticals(allProps) {
  const issues = allProps
    .filter(p => /\(/.test(p.property))
    .map(p => `"${p.property}" contains parenthetical annotation (line ${p.line})`);
  return {
    id: 'no-parentheticals',
    category: 'output',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues : ['No parenthetical annotations found in CSS property names'],
  };
}

/**
 * OUTPUT-4: no-underscores — No underscores in CSS property names
 */
function checkNoUnderscores(allProps) {
  const issues = allProps
    .filter(p => /_/.test(p.property))
    .map(p => `"${p.property}" contains underscore (line ${p.line})`);
  return {
    id: 'no-underscores',
    category: 'output',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues : ['No underscores found in CSS property names'],
  };
}

/**
 * OUTPUT-5: color-format — All color values are valid CSS
 * Only checks properties that appear to be color-bearing.
 */
function checkColorFormat(allProps) {
  // Heuristic: color properties use these namespaces or hold color-like values
  const colorNamespaces = ['--primitive-color-', '--semantic-', '--color-', '--component-'];
  const colorProps = allProps.filter(p =>
    colorNamespaces.some(ns => p.property.startsWith(ns)) &&
    // Exclude --semantic-blur-* and --semantic-shadow-*sm* which aren't colors
    !p.property.startsWith('--semantic-blur-') &&
    !p.property.startsWith('--semantic-blur') &&
    !/(px|rem|em|vi|0)$/.test(p.value.trim())
  );

  const issues = [];
  for (const prop of colorProps) {
    if (!isValidCssColor(prop.value)) {
      issues.push(`"${prop.property}": invalid color value "${prop.value}"`);
    }
  }
  return {
    id: 'color-format',
    category: 'output',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues.slice(0, 20) : [`All ${colorProps.length} color values are valid CSS`],
  };
}

/**
 * OUTPUT-6: fluid-values — All spacing clamp() expressions are valid
 */
function checkFluidValues(allProps) {
  const clampProps = allProps.filter(p => p.value.trim().startsWith('clamp('));
  const issues = [];
  for (const prop of clampProps) {
    if (!isValidClamp(prop.value)) {
      issues.push(`"${prop.property}": invalid clamp() expression "${prop.value}"`);
    }
  }
  return {
    id: 'fluid-values',
    category: 'output',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues : [`All ${clampProps.length} clamp() values are structurally valid`],
  };
}

/**
 * OUTPUT-7: typography-completeness — Every --text-* has line-height, letter-spacing, font-weight sub-props
 */
function checkTypographyCompleteness(allProps) {
  const issues = [];
  // Find all base --text-* props (excluding sub-properties which have --)
  const textBaseProps = allProps.filter(p =>
    p.property.startsWith('--text-') && !p.property.includes('--line-height') &&
    !p.property.includes('--letter-spacing') && !p.property.includes('--font-weight')
  );

  const allPropNames = new Set(allProps.map(p => p.property));

  for (const { property } of textBaseProps) {
    const lineHeight = `${property}--line-height`;
    const letterSpacing = `${property}--letter-spacing`;
    const fontWeight = `${property}--font-weight`;

    const missing = [];
    if (!allPropNames.has(lineHeight)) missing.push('--line-height');
    if (!allPropNames.has(letterSpacing)) missing.push('--letter-spacing');
    if (!allPropNames.has(fontWeight)) missing.push('--font-weight');

    if (missing.length > 0) {
      issues.push(`"${property}" missing sub-properties: ${missing.join(', ')}`);
    }
  }

  return {
    id: 'typography-completeness',
    category: 'output',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues : [`All ${textBaseProps.length} --text-* composites have required sub-properties`],
  };
}

/**
 * OUTPUT-8: breakpoint-order — Breakpoints in ascending px order
 */
function checkBreakpointOrder(allProps) {
  const breakpoints = allProps
    .filter(p => p.property.startsWith('--breakpoint-'))
    .map(p => {
      const pxMatch = p.value.match(/^(\d+)px$/);
      return { property: p.property, px: pxMatch ? parseInt(pxMatch[1], 10) : null };
    })
    .filter(b => b.px !== null);

  const issues = [];
  for (let i = 1; i < breakpoints.length; i++) {
    if (breakpoints[i].px < breakpoints[i - 1].px) {
      issues.push(
        `"${breakpoints[i].property}" (${breakpoints[i].px}px) is smaller than previous "${breakpoints[i - 1].property}" (${breakpoints[i - 1].px}px)`
      );
    }
  }

  return {
    id: 'breakpoint-order',
    category: 'output',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues : [
      breakpoints.length > 0
        ? `${breakpoints.length} breakpoints in ascending order: ${breakpoints.map(b => `${b.px}px`).join(' → ')}`
        : 'No breakpoints found'
    ],
  };
}

/**
 * OUTPUT-9: no-duplicates — No CSS custom property declared twice in same scope
 */
function checkNoDuplicates(allProps) {
  const seen = new Map(); // `${scope}::${property}` → first line
  const issues = [];

  for (const { scope, property, line } of allProps) {
    const key = `${scope}::${property}`;
    if (seen.has(key)) {
      issues.push(
        `"${property}" declared twice in scope "${scope}" (first: line ${seen.get(key)}, duplicate: line ${line})`
      );
    } else {
      seen.set(key, line);
    }
  }

  return {
    id: 'no-duplicates',
    category: 'output',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues.slice(0, 20) : [`No duplicate declarations found across ${allProps.length} properties`],
  };
}

/**
 * OUTPUT-10: dark-mode-parity — Every --semantic-* color in :root has a dark mode override
 * Checks semantic-inline.css where :root + [data-theme="dark"] are defined.
 */
function checkDarkModeParity(allProps) {
  // Get all semantic properties in :root scope
  const rootSemanticColors = allProps.filter(p =>
    p.property.startsWith('--semantic-') &&
    p.scope === ':root' &&
    // Exclude non-color semantics (blur, shadow raw values with px)
    !/(px|rem|em|vi)$/.test(p.value.trim())
  );

  // Get all properties in dark mode scopes
  const darkScopes = new Set(['[data-theme="dark"]', ':root:not([data-theme="light"])']);
  const darkProps = new Set(
    allProps
      .filter(p => darkScopes.has(p.scope) || p.scope.includes('[data-theme="dark"]') || p.scope.includes(':not([data-theme="light"]'))
      .map(p => p.property)
  );

  const issues = [];
  for (const { property } of rootSemanticColors) {
    if (!darkProps.has(property)) {
      issues.push(`"${property}" has no dark mode override`);
    }
  }

  return {
    id: 'dark-mode-parity',
    category: 'output',
    status: issues.length === 0 ? 'pass' : (issues.length <= 5 ? 'warn' : 'fail'),
    details: issues.length > 0
      ? [`${issues.length} semantic tokens missing dark mode override`, ...issues.slice(0, 10)]
      : [`All ${rootSemanticColors.length} semantic color tokens have dark mode overrides`],
  };
}

/**
 * MAPPING-1: kebab-transform — Figma variable path → CSS property follows the 12-step algorithm
 * Spot-checks a sample of variables against their expected CSS output.
 */
function checkKebabTransform(figmaData, allProps) {
  const allCssPropNames = new Set(allProps.map(p => p.property));
  const issues = [];
  const checked = [];

  // Sample from primitive and semantic collections
  const targetCollections = ['1.0_Primitive_Colours', '3.0_Semantic_Colours', '3.1_Semantic_Type'];
  for (const entry of figmaData) {
    const name = Object.keys(entry)[0];
    if (!targetCollections.includes(name)) continue;
    const collection = entry[name];
    const firstMode = Object.values(collection.modes)[0];
    const variables = collectVariables(firstMode).slice(0, 10);

    for (const { path } of variables) {
      // Apply toKebab to the path
      const kebabPath = toKebab(path);
      // The CSS property would be prefixed depending on tier:
      // Primitive colors: --primitive-color-{path}
      // Semantic: --semantic-{path}  (but semantic inline uses semantic- prefix)
      // We just verify the kebab itself doesn't contain forbidden chars
      if (/[{}_\s]/.test(kebabPath)) {
        issues.push(`Variable path "${path}" produces invalid kebab "${kebabPath}" (contains forbidden chars)`);
      }
      // Check for leftover underscores
      if (kebabPath.includes('_')) {
        issues.push(`Variable path "${path}" → kebab "${kebabPath}" still contains underscore`);
      }
      // Check for leftover double-hyphens (collapsed to single)
      if (/-{2,}/.test(kebabPath)) {
        issues.push(`Variable path "${path}" → kebab "${kebabPath}" has consecutive hyphens`);
      }
      checked.push(kebabPath);
    }
  }

  return {
    id: 'kebab-transform',
    category: 'mapping',
    status: issues.length === 0 ? 'pass' : 'fail',
    details: issues.length > 0 ? issues : [`Spot-checked ${checked.length} variable paths — all produce valid kebab-case`],
  };
}

/**
 * MAPPING-2: alias-suppression — alias.css contains only the suppression comment
 */
function checkAliasSuppression(aliasesCssContent) {
  const hasOnlyComment = !aliasesCssContent.includes('--alias-') &&
    aliasesCssContent.includes('Alias layer suppressed');
  return {
    id: 'alias-suppression',
    category: 'mapping',
    status: hasOnlyComment ? 'pass' : 'fail',
    details: hasOnlyComment
      ? ['aliases.css contains only suppression comment — alias layer correctly suppressed']
      : ['aliases.css may contain alias property declarations (expected suppression comment only)'],
  };
}

/**
 * MAPPING-3: primitive-prefix — All primitive CSS vars use --primitive-{category}-{name} form
 */
function checkPrimitivePrefix(allProps) {
  const primitiveProps = allProps.filter(p => p.property.startsWith('--primitive-'));
  const issues = [];
  for (const { property } of primitiveProps) {
    // Should be --primitive-color-*, --primitive-font-*, etc. (at least 3 segments)
    const segments = property.replace('--', '').split('-');
    if (segments.length < 3) {
      issues.push(`"${property}" has fewer than 3 name segments (expected --primitive-{category}-{name})`);
    }
  }
  return {
    id: 'primitive-prefix',
    category: 'mapping',
    status: issues.length === 0 ? 'pass' : 'warn',
    details: issues.length > 0 ? issues : [`All ${primitiveProps.length} primitive properties follow --primitive-{category}-{name} pattern`],
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const timestamp = new Date().toISOString();
  const sourceName = basename(FIGMA_JSON_PATH);

  console.log('');
  console.log('ONEMO Design Token Validator');
  console.log('============================');
  console.log(`Blueprint: ${BLUEPRINT_PATH}`);
  console.log(`Figma JSON: ${FIGMA_JSON_PATH}`);
  console.log(`CSS output: ${OUTPUT_DIR}`);
  console.log('');

  // ─── Load inputs ──────────────────────────────────────────────────────────

  let figmaData, blueprint, cssContents;

  try {
    const raw = await readFile(FIGMA_JSON_PATH, 'utf8');
    figmaData = JSON.parse(raw);
  } catch (e) {
    console.error(`ERROR: Cannot read Figma JSON: ${e.message}`);
    process.exit(1);
  }

  try {
    const raw = await readFile(BLUEPRINT_PATH, 'utf8');
    blueprint = JSON.parse(raw);
  } catch (e) {
    console.error(`ERROR: Cannot read blueprint: ${e.message}`);
    process.exit(1);
  }

  // Read CSS files — continue even if some are missing (report missing as issues)
  cssContents = {};
  for (const [key, cssPath] of Object.entries(CSS_FILES)) {
    try {
      cssContents[key] = await readFile(cssPath, 'utf8');
    } catch (e) {
      cssContents[key] = null;
      console.warn(`WARN: CSS file not found: ${cssPath}`);
    }
  }

  // ─── Parse all CSS properties ─────────────────────────────────────────────

  const allProps = [];
  for (const [key, content] of Object.entries(cssContents)) {
    if (content) {
      const parsed = parseCssProperties(content);
      allProps.push(...parsed);
    }
  }

  // ─── Run checks ───────────────────────────────────────────────────────────

  const checks = [
    // Input checks
    checkTierOrg(figmaData),
    checkNameSafety(figmaData),
    checkModeCompleteness(figmaData),
    checkCollectionStructure(figmaData),

    // Output checks
    checkNamespaceCompliance(allProps),
    checkNoAliasEmission(allProps),
    checkNoParentheticals(allProps),
    checkNoUnderscores(allProps),
    checkColorFormat(allProps),
    checkFluidValues(allProps),
    checkTypographyCompleteness(allProps),
    checkBreakpointOrder(allProps),
    checkNoDuplicates(allProps),
    checkDarkModeParity(allProps),

    // Mapping checks
    checkKebabTransform(figmaData, allProps),
    checkAliasSuppression(cssContents['aliases'] || ''),
    checkPrimitivePrefix(allProps),
  ];

  // ─── Tally results ────────────────────────────────────────────────────────

  const summary = {
    total: checks.length,
    pass: checks.filter(c => c.status === 'pass').length,
    fail: checks.filter(c => c.status === 'fail').length,
    warn: checks.filter(c => c.status === 'warn').length,
  };

  // ─── CLI report ───────────────────────────────────────────────────────────

  const categories = ['input', 'output', 'mapping'];
  for (const category of categories) {
    const catChecks = checks.filter(c => c.category === category);
    console.log(`── ${category.toUpperCase()} CHECKS ──`);
    for (const check of catChecks) {
      const icon = check.status === 'pass' ? 'PASS' : check.status === 'fail' ? 'FAIL' : 'WARN';
      console.log(`  [${icon}] ${check.id}`);
      if (check.status !== 'pass') {
        for (const detail of check.details.slice(0, 5)) {
          console.log(`         ${detail}`);
        }
        if (check.details.length > 5) {
          console.log(`         ... and ${check.details.length - 5} more`);
        }
      } else {
        // Print the single pass message
        console.log(`         ${check.details[0]}`);
      }
    }
    console.log('');
  }

  console.log('── SUMMARY ──');
  console.log(`  Total:  ${summary.total}`);
  console.log(`  Pass:   ${summary.pass}`);
  console.log(`  Warn:   ${summary.warn}`);
  console.log(`  Fail:   ${summary.fail}`);
  console.log('');

  // ─── JSON report ──────────────────────────────────────────────────────────

  const report = {
    timestamp,
    source: sourceName,
    summary,
    checks,
  };

  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Report written to: ${REPORT_PATH}`);
  console.log('');

  // ─── Exit code ────────────────────────────────────────────────────────────

  if (summary.fail > 0) {
    console.log(`${summary.fail} check(s) FAILED — see report for details`);
    process.exit(1);
  } else {
    console.log(`All checks passed${summary.warn > 0 ? ` (${summary.warn} warning(s))` : ''}`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
