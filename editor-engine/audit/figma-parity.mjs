// Figma-console ↔ build parity diff (KAI-9383) — Dan's mandated tool: the oracle is the LIVE Figma
// web console, never a hand-written spec. Feed it two dumps produced by figma-census.js (run in the
// Figma tab and in our build tab); it diffs every field's anatomy property-by-property and exits 1
// on any mismatch, naming field + property + figma-value + build-value.
//
// usage: node editor-engine/audit/figma-parity.mjs <figma-census.json> <build-census.json>
//        [--only X-position,Rotation]
import { readFileSync, writeFileSync } from 'node:fs';

const [figmaPath, buildPath, ...rest] = process.argv.slice(2);
if (!figmaPath || !buildPath) { console.error('usage: node figma-parity.mjs <figma-census.json> <build-census.json> [--only a,b]'); process.exit(2); }
const only = (() => { const i = rest.indexOf('--only'); return i >= 0 ? new Set(rest[i + 1].split(',')) : null; })();
const figma = JSON.parse(readFileSync(figmaPath, 'utf8')).fields;
const build = JSON.parse(readFileSync(buildPath, 'utf8')).fields;

// Properties compared, with the comparison law. Colors/edges exact; letterSpacing + height tolerant.
const num = (v) => parseFloat(String(v)) || 0;
const PROPS = {
  fontFamily: (f, b) => f === b,
  fontSize: (f, b) => f === b,
  fontWeight: (f, b) => f === b,
  lineHeight: (f, b) => f === b,
  letterSpacing: (f, b) => Math.abs(num(f) - num(b)) <= 0.01,
  ink: (f, b) => f === b,
  bg: (f, b) => f === b,
  radius: (f, b) => f === b,
  edge: (f, b) => normEdge(f) === normEdge(b),
  height: (f, b) => Math.abs(num(f) - num(b)) <= 1,
};
// normalise an edge rule so "1px rgb(230, 230, 230)" (border) and an equivalent outline/inset-shadow
// with the same width+colour compare equal — we care that the visible 1px rule matches, not how it's drawn.
function normEdge(e) {
  if (!e || e === 'none') return 'none';
  // round the width — browser zoom/DPR renders a 1px rule as 0.909px etc; we care about the
  // intended integer width + the colour, not the sub-pixel raster.
  const w = Math.round(num((e.match(/([\d.]+)px/) || [])[1]));
  const col = ((e.match(/rgba?\([^)]*\)/) || [])[0] ?? e).replace(/\s+/g, '');
  // a fully-transparent edge is "no visible edge" regardless of its nominal width
  if (/rgba\([^)]*,0\)$/.test(col) || col === 'rgba(0,0,0,0)') return 'none';
  return `${w}px ${col}`;
}

const rows = [];
const fields = Object.keys(figma).filter((k) => (!only || only.has(k)) && build[k]);
const missing = Object.keys(figma).filter((k) => (!only || only.has(k)) && !build[k]);
for (const field of fields) {
  for (const [prop, cmp] of Object.entries(PROPS)) {
    const f = figma[field][prop], b = build[field][prop];
    if (f === undefined || b === undefined) continue;
    rows.push({ field, prop, figma: String(f), build: String(b), pass: cmp(f, b) });
  }
}

const fails = rows.filter((r) => !r.pass);
const out = { at: new Date().toISOString(), figmaFieldsNotInBuild: missing, comparedFields: fields.length, total: rows.length, fails: fails.length, rows };
writeFileSync('/tmp/figma-parity.json', JSON.stringify(out, null, 2));

const line = (r) => `${r.pass ? 'MATCH' : 'DIFF '}  ${r.field} · ${r.prop} · figma ${r.figma} · build ${r.build}`;
console.log(rows.map(line).join('\n'));
if (missing.length) console.log(`\n⚠ fields in Figma but not the build: ${missing.join(', ')}`);
console.log(`\n${rows.length - fails.length}/${rows.length} properties match across ${fields.length} fields`);
if (fails.length) { console.error(`\n${fails.length} DIFFS vs the live Figma console (named above).`); process.exit(1); }
