#!/usr/bin/env node
/**
 * blueprint-validator.mjs — ONEMO Design Token Semantic Naming Validator
 *
 * Reads a Figma Variables Pro JSON export and validates every token path against
 * the ONEMO naming blueprint (naming-rules.json). Produces structured per-token
 * results with violations, segment pointers, and suggested fixes.
 *
 * Zero dependencies. Node.js 18+ built-in only.
 *
 * Usage:
 *   node scripts/blueprint-validator.mjs [figma-json-path]
 *
 *   If no argument is given, reads sourcePath from tokens.config.mjs.
 *
 * Outputs:
 *   - JSON to stdout
 *   - scripts/blueprint-validation-report.json
 *   - Summary line to stderr: "Blueprint validation: N tokens checked, X errors, Y warnings"
 *
 * KAI-1052
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './tokens.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Path resolution ──────────────────────────────────────────────────────────

const NAMING_RULES_PATH = CONFIG.namingRulesPath;
const REPORT_PATH = join(__dirname, 'blueprint-validation-report.json');

// ─── Variable collection ──────────────────────────────────────────────────────

/**
 * Recursively collect all variable token objects from a nested Figma collection
 * mode object.
 * @param {Record<string, unknown>} obj
 * @param {string} [prefix]
 * @returns {{ path: string; token: Record<string, unknown> }[]}
 */
function collectVariables(obj, prefix = '') {
  const results = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const currentPath = prefix ? `${prefix}/${key}` : key;
    if (value && typeof value === 'object') {
      if ('$type' in value) {
        results.push({ path: currentPath, token: /** @type {any} */ (value) });
      } else {
        results.push(...collectVariables(/** @type {any} */ (value), currentPath));
      }
    }
  }
  return results;
}

// ─── 12-step segment transformation (per naming-rules.json) ──────────────────

/**
 * Transform a single path segment (no slashes) to CSS-safe kebab-case.
 * Applies steps 3-11 of the 12-step algorithm from naming-rules.json.
 * Step 1 (stripCollectionPrefix) is handled at call site.
 * Step 2 (slashToHyphen) is not applied here — we keep slash separators intact.
 * Step 12 (prependDashes) is done at the CSS property level.
 *
 * @param {string} segment
 * @returns {string}
 */
function transformSegment(segment) {
  return segment
    .toLowerCase()                                    // step 3: lowercase
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // step 4: normalize accents
    .replace(/\s*\([^)]*\)\s*/g, '')                  // step 5: strip parentheticals
    .replace(/\u2024/g, '-')                          // step 6: Unicode One Dot Leader
    .replace(/\s+/g, '-')                             // step 7: spaces to hyphens
    .replace(/_/g, '-')                               // step 8: underscores to hyphens
    .replace(/-{2,}/g, '-')                           // step 10: collapse hyphens
    .replace(/^-|-$/g, '');                           // step 11: trim leading/trailing hyphens
}

/**
 * Produce a corrected full token path by transforming each segment individually.
 * Preserves slash separators between segments.
 *
 * @param {string} tokenPath
 * @returns {string}
 */
function suggestedTokenPath(tokenPath) {
  return tokenPath
    .split('/')
    .map(seg => transformSegment(seg))
    .join('/');
}

// ─── Alias collection detection ───────────────────────────────────────────────

/**
 * Build the set of alias collection names from naming-rules.json.
 *
 * Alias collections are:
 *   1. converterCollections keys that start with "alias" (each maps to an array of names)
 *   2. collections.alias.collections array (the canonical list)
 *   3. converterCollections.legacy sub-object entries
 *   4. Any collection name starting with "2." (Figma naming convention)
 *
 * @param {Record<string, unknown>} namingRules
 * @returns {Set<string>}
 */
function buildAliasCollectionSet(namingRules) {
  const aliasNames = new Set();
  const cc = /** @type {Record<string, unknown>} */ (namingRules.converterCollections || {});

  // converterCollections keys starting with "alias"
  for (const [key, value] of Object.entries(cc)) {
    if (key.startsWith('alias') && Array.isArray(value)) {
      for (const name of value) aliasNames.add(name);
    }
  }

  // collections.alias.collections array
  const collectionsSection = /** @type {any} */ (namingRules.collections || {});
  const collectionsAliasSection = collectionsSection.alias;
  if (collectionsAliasSection && Array.isArray(collectionsAliasSection.collections)) {
    for (const name of collectionsAliasSection.collections) aliasNames.add(name);
  }

  // converterCollections.legacy sub-object
  const legacy = /** @type {any} */ (cc.legacy);
  if (legacy && typeof legacy === 'object') {
    for (const value of Object.values(legacy)) {
      if (Array.isArray(value)) {
        for (const name of value) aliasNames.add(name);
      }
    }
  }

  return aliasNames;
}

/**
 * Determine whether a collection name is an alias-tier collection.
 *
 * @param {string} collectionName
 * @param {Set<string>} aliasSet
 * @returns {boolean}
 */
function isAliasCollection(collectionName, aliasSet) {
  return aliasSet.has(collectionName) || collectionName.startsWith('2.');
}

// ─── Check implementations ────────────────────────────────────────────────────

/**
 * Check 1 — name-case: each segment must be lowercase-kebab /^[a-z][a-z0-9-]*$/
 * Severity: warn
 *
 * @param {string} tokenPath
 * @param {string} suggestedFix
 * @returns {import('.').Violation[]}
 */
function checkCasing(tokenPath, suggestedFix) {
  const violations = [];
  const segments = tokenPath.split('/');
  const KEBAB_RE = /^[a-z][a-z0-9-]*$/;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === '') continue; // caught by empty-segment check
    if (!KEBAB_RE.test(seg)) {
      violations.push({
        ruleId: 'name-case',
        severity: /** @type {"warn"} */ ('warn'),
        segment: seg,
        segmentIndex: i,
        description: `Segment ${i} ("${seg}") is not lowercase-kebab — contains uppercase, underscore, digit-start, or invalid characters`,
        suggestedFix,
      });
    }
  }
  return violations;
}

/**
 * Check 2 — name-safety: within a segment only hyphens are allowed as word separators.
 * Severity: error
 *
 * @param {string} tokenPath
 * @param {string} suggestedFix
 * @returns {import('.').Violation[]}
 */
function checkSeparators(tokenPath, suggestedFix) {
  const violations = [];
  const segments = tokenPath.split('/');

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === '') continue;

    if (/_/.test(seg)) {
      violations.push({
        ruleId: 'name-safety',
        severity: /** @type {"error"} */ ('error'),
        segment: seg,
        segmentIndex: i,
        description: `Segment ${i} ("${seg}") contains underscore — use hyphens as word separators within segments`,
        suggestedFix,
      });
    }
    if (/\s/.test(seg)) {
      violations.push({
        ruleId: 'name-safety',
        severity: /** @type {"error"} */ ('error'),
        segment: seg,
        segmentIndex: i,
        description: `Segment ${i} ("${seg}") contains whitespace — use hyphens as word separators`,
        suggestedFix,
      });
    }
  }
  return violations;
}

/**
 * Check 3 — name-safety: DTCG forbidden characters {, }, . must not appear in token path.
 * Severity: error
 *
 * @param {string} tokenPath
 * @param {string} suggestedFix
 * @returns {import('.').Violation[]}
 */
function checkForbiddenChars(tokenPath, suggestedFix) {
  const violations = [];
  const segments = tokenPath.split('/');

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (/[{}.]/.test(seg)) {
      const chars = [...new Set([...seg.matchAll(/[{}.]/g)].map(m => m[0]))].join(', ');
      violations.push({
        ruleId: 'name-safety',
        severity: /** @type {"error"} */ ('error'),
        segment: seg,
        segmentIndex: i,
        description: `Segment ${i} ("${seg}") contains DTCG-forbidden characters: ${chars}`,
        suggestedFix,
      });
    }
  }
  return violations;
}

/**
 * Check 5 — empty-segment: no path segment may be empty.
 * Covers double-slash and trailing/leading slash cases.
 * Severity: error
 *
 * @param {string} tokenPath
 * @param {string} suggestedFix
 * @returns {import('.').Violation[]}
 */
function checkEmptySegments(tokenPath, suggestedFix) {
  const violations = [];
  const segments = tokenPath.split('/');

  for (let i = 0; i < segments.length; i++) {
    if (segments[i] === '') {
      violations.push({
        ruleId: 'empty-segment',
        severity: /** @type {"error"} */ ('error'),
        segment: '',
        segmentIndex: i,
        description: `Segment ${i} is empty (double-slash or trailing/leading slash in path "${tokenPath}")`,
        suggestedFix,
      });
    }
  }
  return violations;
}

// ─── Per-token validation ─────────────────────────────────────────────────────

/**
 * Validate a single token path against all semantic naming checks.
 *
 * @param {string} tokenPath
 * @param {string} collectionName
 * @param {Set<string>} aliasSet
 * @returns {{ tokenPath: string; collection: string; status: string; violations: any[] }}
 */
function validateToken(tokenPath, collectionName, aliasSet) {
  // Check 4: Alias tier — mark as info immediately, skip all other checks
  if (isAliasCollection(collectionName, aliasSet)) {
    return {
      tokenPath,
      collection: collectionName,
      status: 'info',
      violations: [
        {
          ruleId: 'alias-suppression',
          severity: 'info',
          segment: 'full-path',
          segmentIndex: -1,
          description: 'Alias collection — intentionally suppressed in CSS output (emitAlias: false)',
          suggestedFix: tokenPath,
        },
      ],
    };
  }

  const fix = suggestedTokenPath(tokenPath);

  const violations = [
    ...checkEmptySegments(tokenPath, fix),
    ...checkForbiddenChars(tokenPath, fix),
    ...checkSeparators(tokenPath, fix),
    ...checkCasing(tokenPath, fix),
  ];

  let status = 'pass';
  for (const v of violations) {
    if (v.severity === 'error') { status = 'error'; break; }
    if (v.severity === 'warn' && status !== 'error') status = 'warn';
  }

  return {
    tokenPath,
    collection: collectionName,
    status,
    violations,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const figmaJsonPath = process.argv[2] || CONFIG.sourcePath;

  // ─── Load inputs ──────────────────────────────────────────────────────────

  let figmaData;
  try {
    const raw = await readFile(figmaJsonPath, 'utf8');
    figmaData = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`ERROR: Cannot read Figma JSON at "${figmaJsonPath}": ${e.message}\n`);
    process.exit(1);
  }

  let namingRules;
  try {
    const raw = await readFile(NAMING_RULES_PATH, 'utf8');
    namingRules = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`ERROR: Cannot read naming-rules.json at "${NAMING_RULES_PATH}": ${e.message}\n`);
    process.exit(1);
  }

  // ─── Build alias set ──────────────────────────────────────────────────────

  const aliasSet = buildAliasCollectionSet(namingRules);

  // ─── Collect and validate all tokens ──────────────────────────────────────

  const results = [];

  for (const entry of figmaData) {
    const collectionName = Object.keys(entry)[0];
    const collection = entry[collectionName];
    const modes = Object.keys(collection.modes || {});

    // Deduplicate token paths across modes — naming is mode-independent
    const seenPaths = new Set();
    for (const modeName of modes) {
      const modeVars = collection.modes[modeName];
      const variables = collectVariables(modeVars);
      for (const { path } of variables) {
        if (seenPaths.has(path)) continue;
        seenPaths.add(path);
        results.push(validateToken(path, collectionName, aliasSet));
      }
    }
  }

  // ─── Tally ────────────────────────────────────────────────────────────────

  let errorCount = 0;
  let warnCount = 0;
  let infoCount = 0;
  let passCount = 0;

  for (const r of results) {
    switch (r.status) {
      case 'error': errorCount++; break;
      case 'warn':  warnCount++;  break;
      case 'info':  infoCount++;  break;
      case 'pass':  passCount++;  break;
    }
  }

  // ─── Build report ─────────────────────────────────────────────────────────

  const report = {
    timestamp: new Date().toISOString(),
    source: basename(figmaJsonPath),
    namingRules: basename(NAMING_RULES_PATH),
    summary: {
      total: results.length,
      pass: passCount,
      info: infoCount,
      warn: warnCount,
      error: errorCount,
    },
    results,
  };

  // ─── Write report file ────────────────────────────────────────────────────

  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  // ─── Output JSON to stdout ────────────────────────────────────────────────

  process.stdout.write(JSON.stringify(report, null, 2));
  process.stdout.write('\n');

  // ─── Summary to stderr ────────────────────────────────────────────────────

  process.stderr.write(
    `Blueprint validation: ${results.length} tokens checked, ${errorCount} errors, ${warnCount} warnings\n`
  );
  process.stderr.write(`Report written to: ${REPORT_PATH}\n`);
}

main().catch(err => {
  process.stderr.write(`Unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
