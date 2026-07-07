// VENDORED from onemo-ssot-global tools/ds-pipeline/naming.mjs (the DEC APM-104 naming
// authority) when the converter moved into onemo-next — a cross-repo relative import can't
// survive the move. Drift guard: if this ever diverges from the pipeline that generates
// tokens.css, variables stop resolving and the conformance gate fails loudly (unresolved>0).
/**
 * ds-pipeline · structural naming — THE naming authority (DEC APM-104: var names are
 * structural = token paths). Extracted verbatim from build-scan.mjs so dependency-free
 * consumers (figma-to-code's variable-map) can import the law without pulling the build's
 * deps (culori) or CLI plumbing. build-scan re-exports these — existing imports unchanged.
 *
 * `--{collection-category}-{path}` (`Sem-Dim-Fluid/standard/m → --sem-dim-fluid-standard-m`).
 */

export const kebab = (s) => String(s).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

// strip the ordering prefix incl. an optional leading `.` (Figma's hidden-collection marker,
// e.g. `.1.0-Prim-Col` → `prim-col`; non-hidden `3.0-Sem-Col` → `sem-col`). (v2.3.1)
export const categorySegs = (collName) => collName.replace(/^\.?\d+(?:\.\d+)?-/, '').split(/[-_\s]+/).map((s) => s.toLowerCase()).filter(Boolean);

export const tokenSegs = (collName, path) => [...categorySegs(collName), ...path.map((p) => kebab(p))];

export const camelJoin = (segs) => segs.map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1))).join('');

export function flatName(segs, target) {
  const t = target; // {prefix, sep, case}
  // Join, then normalize ALL separators to the target sep — a multi-word path
  // segment ('line-height', 'brand-white') carries an internal '-'; snake-case
  // targets (Liquid) must convert it too, else the name mixes '_' and '-'.
  const out = segs.join(t.sep).replace(/[-_]+/g, t.sep);
  return (t.prefix || '') + out;
}
