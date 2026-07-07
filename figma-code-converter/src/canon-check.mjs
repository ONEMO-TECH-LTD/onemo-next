/**
 * figma-to-code · C1.4 — canon-check, ONEMO layer (CODE-CANON.md rules 1-9, SPEC §4b layer 2).
 * Zero-tolerance: returns violations[]; ANY entry fails the conversion. Layer-1 (tsc/eslint/
 * stylelint via the app's pinned configs) runs at acceptance — this module is the canon the
 * generic linters can't see. Checks the OUTPUT artifacts only (generator-independent).
 */
import { promises as fs } from 'node:fs';
import { declsOf } from './conformance.mjs';

export async function canonCheck({ tsxPath, cssPath, runPath }) {
  const [tsx, css, runRaw] = await Promise.all([
    fs.readFile(tsxPath, 'utf8'), fs.readFile(cssPath, 'utf8'), fs.readFile(runPath, 'utf8'),
  ]);
  const run = JSON.parse(runRaw);
  const v = [];

  // strip svg subtrees — canon rule 6 exception zone (asset content, not authored style)
  const tsxNoSvg = tsx.replace(/<svg[\s\S]*?<\/svg>|<svg[^>]*\/>/g, '<svg-elided />');

  // 1 (s58-lead C1 F1): the anti-slop count BINDS THE TSX. Every idMap entry emits EXACTLY one
  // element carrying `className={styles.<uniqueClass>}`; inlined svg internals carry Figma's own
  // attrs, never `styles.` — so counting styles-classNames is 1:1 with the idMap and robust to svg
  // internal structure (a hand-injected `{styles.slop}` wrapper → count>idMap → FAIL; a dropped
  // node → count<idMap → FAIL). String-literal wrappers are caught by rule 2 below.
  const styledCount = (tsx.match(/className=\{styles\.[a-zA-Z][a-zA-Z0-9]*\}/g) ?? []).length;
  if (styledCount !== run.idMap.length) {
    v.push({ rule: 1, detail: `TSX element census ${styledCount} != idMap ${run.idMap.length} — slop element or dropped node` });
  }
  // 2: EVERY element carries exactly className={styles.x} — string-literal classNames are
  // invisible to the {…} matcher (s58-lead C1 F1), so check both forms.
  if (/className="/.test(tsxNoSvg)) v.push({ rule: 2, detail: 'string-literal className (must be {styles.x})' });
  for (const m of tsxNoSvg.matchAll(/className=\{([^}]+)\}/g)) {
    if (!/^styles\.[a-zA-Z][a-zA-Z0-9]*$/.test(m[1])) v.push({ rule: 2, detail: `non-plain className: ${m[1].slice(0, 60)}` });
  }
  // 2b (meta-qa C2): EVERY JSX element open-tag must carry className={styles.x}. A bare/unstyled
  // wrapper (e.g. a hand-injected `<div>`) is invisible to the styledCount census (rule 1), to the
  // reverse parser (which only reads styled tags), AND to the raw census (not in the idMap) — so
  // without this, an unstyled wrapper is slop that passes every gate. The emitter never emits a
  // classless element, so any is injected. (svg internals are elided to <svg-elided /> above.)
  for (const m of tsxNoSvg.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*)?)\/?>/g)) {
    const [, tag, attrs] = m;
    if (!/className=\{styles\.[a-zA-Z][a-zA-Z0-9]*\}/.test(attrs)) {
      v.push({ rule: 2, detail: `element <${tag}> without className={styles.x} — unstyled/slop wrapper` });
    }
  }
  // 6: no inline styles outside svg
  if (/style=/.test(tsxNoSvg)) v.push({ rule: 6, detail: 'inline style outside <svg>' });

  // 4: flat selectors only
  for (const m of css.matchAll(/^([^\s{][^{\n]*)\{/gm)) {
    const sel = m[1].trim();
    if (!/^\.[a-zA-Z][a-zA-Z0-9]*$/.test(sel)) v.push({ rule: 4, detail: `non-flat selector: ${sel.slice(0, 60)}` });
  }
  // 5: no !important
  if (css.includes('!important')) v.push({ rule: 5, detail: '!important in generated css' });

  // 7: dead/duplicate code
  const decls = declsOf(css);
  const cssClasses = new Set(decls.map((d) => d.className));
  for (const m of css.matchAll(/^\.([a-zA-Z0-9]+) \{$/gm)) cssClasses.add(m[1]);
  const usedClasses = new Set([...tsx.matchAll(/styles\.([a-zA-Z0-9]+)/g)].map((m) => m[1]));
  for (const c of cssClasses) if (!usedClasses.has(c)) v.push({ rule: 7, detail: `unused class .${c}` });
  for (const c of usedClasses) if (!cssClasses.has(c)) v.push({ rule: 7, detail: `class .${c} used in TSX, missing in css` });
  const seen = new Set();
  for (const d of decls) {
    const k = `${d.className}::${d.prop}`;
    if (seen.has(k)) v.push({ rule: 7, detail: `duplicate ${d.prop} in .${d.className}` });
    seen.add(k);
  }
  // 8 (CANON says ==, s58-lead C1 F4): position:absolute count must EQUAL the IR's sanctioned
  // count (layoutPositioning:ABSOLUTE nodes), carried in the run record as absoluteCount.
  const absCount = decls.filter((d) => d.prop === 'position' && d.value === 'absolute').length;
  if (absCount !== (run.absoluteCount ?? 0)) {
    v.push({ rule: 8, detail: `position:absolute ×${absCount} != sanctioned ${run.absoluteCount ?? 0}` });
  }
  // 9: formatting law — line shape AND pinned property order (meta-qa C1 HIGH: order was
  // specified but never enforced; a reordered decl broke the byte-splice contract silently).
  css.split('\n').forEach((line, i) => {
    if (line === '' || line === '}' || /^\.[a-zA-Z0-9]+ \{$/.test(line)) return;
    if (!/^  [a-z-]+: .+;$/.test(line)) v.push({ rule: 9, detail: `formatting law broken @css:${i + 1}: ${line.slice(0, 50)}` });
  });
  // category ranks: layout(0) → box(1) → visual(2) → typography(3). `overflow` is exempt — the
  // one dual-category property (auto-layout clipsContent AND the text-truncate trio).
  const RANK = {
    'container-type': 0, display: 0, 'flex-direction': 0, 'flex-wrap': 0, 'justify-content': 0, 'align-items': 0, gap: 0, padding: 0,
    width: 1, height: 1, 'max-width': 1, 'margin-inline': 1, 'margin-block': 1, flex: 1, 'flex-shrink': 1, 'margin-left': 1, 'margin-top': 1, 'align-self': 1, 'min-width': 1, position: 1, left: 1, top: 1,
    'background-color': 2, 'background-image': 2, 'background-size': 2, 'background-position': 2, 'background-repeat': 2, 'background-origin': 2, 'background-clip': 2, 'background-blend-mode': 2,
    border: 2, 'border-image': 2, 'border-top': 2, 'border-right': 2, 'border-bottom': 2, 'border-left': 2,
    'box-shadow': 2, filter: 2, 'backdrop-filter': 2, 'border-radius': 2, opacity: 2, 'mix-blend-mode': 2,
    'object-fit': 2, color: 2, transform: 2,
    'font-family': 3, 'font-size': 3, 'font-weight': 3, 'font-style': 3, 'line-height': 3,
    'letter-spacing': 3, 'text-align': 3, 'white-space': 3, 'text-overflow': 3,
  };
  const byClass = new Map();
  for (const d of decls) {
    if (!byClass.has(d.className)) byClass.set(d.className, []);
    byClass.get(d.className).push(d);
  }
  for (const [cls, ds] of byClass) {
    let maxRank = -1;
    for (const d of ds) {
      const r = RANK[d.prop];
      if (r === undefined || d.prop === 'overflow') continue;
      if (r < maxRank) { v.push({ rule: 9, detail: `property order broken in .${cls}: ${d.prop} (rank ${r}) after rank ${maxRank} @css:${d.line}` }); break; }
      maxRank = Math.max(maxRank, r);
    }
  }

  return { pass: v.length === 0, violations: v };
}
