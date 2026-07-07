/**
 * figma-to-code · C1.1 — variable-map (SPEC §1 rows 2-3: ID→name via plugin dump,
 * name→CSS custom property via the OWNED ds-pipeline naming — imported, never copied).
 *
 * Dump artifact: cache/<fileKey>.variables.json
 *   { fileKey, fileVersion, dumpedWith, variables: { "<VariableID>": { name, collection } } }
 * produced plugin-side (figma.variables.getLocalVariablesAsync() — ungated on any plan).
 *
 * Staleness guard (SPEC §1, s58-designer + s58-lead F6): the dump is stamped with the
 * file version it was taken at; a version mismatch REFUSES the run (stale ID→name maps
 * silently mislabel tokens). Auto-refresh via the desktop bridge is attempted by the
 * CLI before refusing (bin/figma-to-code.mjs dump-variables).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { cacheDir } from './fetch.mjs';

// The one naming authority — ds-pipeline's structural naming (DEC APM-104),
// via the dependency-free naming.mjs (importing build-scan would drag its deps + CLI).
import { tokenSegs, flatName } from './ds-naming.mjs'; // vendored naming authority (see header there)

const CSS_TARGET = { prefix: '--', sep: '-', case: 'kebab' };

/** Figma variable name ("title/headline/size") + collection (".2.2-Al-Type") → CSS custom property. */
export function cssVarName(collection, variableName) {
  return flatName(tokenSegs(collection, String(variableName).split('/')), CSS_TARGET);
}

export function dumpPath(root, fileKey) {
  return path.join(cacheDir(root), `${fileKey}.variables.json`);
}

export class StaleDumpError extends Error {
  constructor(fileKey, dumpVersion, fileVersion) {
    super(
      `figma-to-code: variable dump for ${fileKey} is stale (dump@${dumpVersion} vs file@${fileVersion}). ` +
      `Refusing — a stale ID→name map silently mislabels tokens. Refresh: bun run dump-variables (Figma desktop ` +
      `open with the Desktop Bridge plugin running), or re-run after the bridge dump completes.`,
    );
    this.code = 'STALE_DUMP';
    this.fileKey = fileKey;
  }
}

/**
 * Load the ID→{name, collection, cssVar} map, staleness-guarded against the fetched file version.
 * Missing dump throws with the same one-step instruction (fail = instruction, never a guess).
 */
export async function loadVariableMap(root, fileKey, fileVersion, { allowStale = false } = {}) {
  const p = dumpPath(root, fileKey);
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    throw new StaleDumpError(fileKey, 'none', fileVersion);
  }
  if (fileVersion != null && raw.fileVersion !== fileVersion) {
    // watch mode (C6.3): every edit bumps the file version, but variable ids are stable and
    // renames are rare — allowStale converts with a LOUD warning instead of refusing; an id the
    // dump doesn't know falls back to raw + report (existing law), so a stale dump can't mislabel
    // silently. Non-watch runs keep the hard refusal.
    if (!allowStale) throw new StaleDumpError(fileKey, raw.fileVersion, fileVersion);
    console.error(`variable-map: STALE dump (dump@${raw.fileVersion} vs file@${fileVersion}) — converting anyway (--allow-stale-dump); refresh via dump-variables when possible`);
  }
  const map = new Map();
  for (const [id, v] of Object.entries(raw.variables ?? {})) {
    map.set(id, { name: v.name, collection: v.collection, cssVar: cssVarName(v.collection, v.name) });
  }
  return map;
}

/** The exact plugin-side dump snippet (fallback path when the bridge is unreachable). */
export function dumpSnippet(fileKey) {
  return `// Figma → Plugins → Development → console (or Desktop Bridge figma_execute):
const vars = await figma.variables.getLocalVariablesAsync();
const colls = await figma.variables.getLocalVariableCollectionsAsync();
const byId = Object.fromEntries(colls.map(c => [c.id, c.name]));
console.log(JSON.stringify({
  fileKey: '${fileKey}',
  fileVersion: 'FILL_FROM_META', // must equal cache/<fileKey>-<node>.meta.json fileVersion
  dumpedWith: 'plugin-console',
  variables: Object.fromEntries(vars.map(v => [v.id, { name: v.name, collection: byId[v.variableCollectionId] }])),
}));
// paste the logged JSON into cache/${fileKey}.variables.json`;
}
