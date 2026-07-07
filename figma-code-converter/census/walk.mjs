#!/usr/bin/env node
/**
 * figma-to-code · C1.4 — INDEPENDENT raw-census walker (SPEC §4b.4, s58-lead F1).
 *
 * Deliberately shares NO code with the converter (separate directory, zero src/ imports) —
 * it re-derives the census from the SPEC's own rules, so a normalizer that silently drops
 * or merges nodes cannot pass its own count. One census unit per node that must appear in
 * the emitted ID map:
 *   · invisible nodes (visible === false): not counted, subtree skipped        (SPEC §3 visibility)
 *   · vector subtree root (VECTOR/BOOLEAN_OPERATION/LINE/STAR/POLYGON/
 *     REGULAR_POLYGON/ELLIPSE, or GROUP/paint-less FRAME whose whole subtree is vector-ish):
 *     ONE unit, subtree not descended (svg internals verified by asset hash)   (SPEC §3.5 vector pin)
 *   · everything else visible: ONE unit, descend. Structure/geometry never refuse (Dan) — a
 *     no-autolayout frame, a rotated container, a negative-gap flex are all real elements, so the
 *     census counts them and recurses exactly like any other node.
 *
 * usage: node census/walk.mjs <raw-nodes.json> <convert-run.json>
 * exit 0 = census matches ID map exactly; exit 1 = mismatch (diff printed).
 */
import { readFileSync } from 'node:fs';

const VEC = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'LINE', 'STAR', 'POLYGON', 'REGULAR_POLYGON', 'ELLIPSE']);
// mirrors ir.mjs isVectorish: GROUP (always) or paint-less FRAME with an all-vector subtree = one svg unit.
const hasOwnPaint = (n) => (n.fills ?? []).some((f) => f.visible !== false && f.type) || (n.strokes ?? []).some((s) => s.visible !== false) || (n.effects ?? []).some((e) => e.visible !== false);
const vecish = (n) => VEC.has(n.type)
  || (n.type === 'GROUP' && n.children?.length > 0 && n.children.every(vecish))
  // Dan's ruler law: token-spaced auto-layout vector rows stay containers (mirrors ir.mjs)
  || (n.type === 'FRAME' && n.children?.length > 0 && !hasOwnPaint(n)
      && !(n.layoutMode && n.layoutMode !== 'NONE' && n.boundVariables?.itemSpacing)
      && n.children.every(vecish));

// No structural refusals (Dan: geometry is math, layer tree = DOM tree). Every visible node is one
// unit and recurses; a vector-subtree root collapses to one svg unit (internals hash-verified).
function census(node, isRoot, out) {
  if (node.visible === false) return;
  out.push(node.id);
  if (vecish(node)) return; // svg root — internals not DOM elements
  (node.children ?? []).filter((c) => c.visible !== false).forEach((c) => census(c, false, out));
}

const [rawPath, runPath] = process.argv.slice(2);
if (!rawPath || !runPath) { console.error('usage: walk.mjs <raw-nodes.json> <convert-run.json>'); process.exit(2); }

const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
const run = JSON.parse(readFileSync(runPath, 'utf8'));

const expected = [];
census(raw, true, expected);
const emitted = run.idMap.map((e) => e.figmaId);

const expectedSet = new Set(expected);
const emittedSet = new Set(emitted);
const missing = expected.filter((id) => !emittedSet.has(id)); // in design, not in output — data LOSS
const extra = emitted.filter((id) => !expectedSet.has(id));   // in output, not in census — slop

if (missing.length === 0 && extra.length === 0 && expected.length === emitted.length) {
  console.log(`census OK: ${expected.length} units — raw tree and emitted ID map agree exactly`);
  process.exit(0);
}
console.error(`census MISMATCH: expected ${expected.length}, emitted ${emitted.length}`);
if (missing.length) console.error(`  MISSING from output (data loss): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` …+${missing.length - 10}` : ''}`);
if (extra.length) console.error(`  EXTRA in output (slop): ${extra.slice(0, 10).join(', ')}${extra.length > 10 ? ` …+${extra.length - 10}` : ''}`);
process.exit(1);
