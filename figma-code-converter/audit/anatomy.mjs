// Full-anatomy conformance: every node's Figma properties ↔ the emitted CSS/React, side by side.
// Same principle as token traceability, applied to the ENTIRE css+react output.
// Full-anatomy audit: node <outDir> <raw-nodes.json> <tokens.css> → <outDir>/anatomy.html
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const [, , OUT, NODES, TOKENS] = process.argv;
if (!OUT || !NODES || !TOKENS) { console.error('usage: node audit/anatomy.mjs <outDir> <raw-nodes.json> <tokens.css>'); process.exit(2); }
const raw = JSON.parse(readFileSync(NODES, 'utf8'));
const run = JSON.parse(readFileSync(OUT + '/convert-run.json', 'utf8'));
const css = readFileSync(OUT + '/' + readdirSync(OUT).find((f) => f.endsWith('.module.css')), 'utf8');
const tsx = readFileSync(OUT + '/' + readdirSync(OUT).find((f) => /^[A-Z].*\.tsx$/.test(f)), 'utf8');
const tokensCss = readFileSync(TOKENS, 'utf8');

import { themeScopedTokenDefs, resolveVar } from '../src/token-defs.mjs';
const tokenDefs = themeScopedTokenDefs(tokensCss); // theme-scoped (light) — dark overrides mustn't win (meta-qa F1)
const resolve = (v) => resolveVar(tokenDefs, v);

// emitted CSS: class → ordered [prop,value]
const cls2decls = new Map();
for (const block of css.split('}')) {
  const m = block.match(/\.([a-zA-Z0-9]+)\s*\{([\s\S]*)/); if (!m) continue;
  cls2decls.set(m[1], [...m[2].matchAll(/\s*([a-z-]+):\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]));
}
// emitted TSX: class → tag
const cls2tag = new Map();
for (const m of tsx.matchAll(/<([a-zA-Z0-9]+)[^>]*className=\{styles\.([a-zA-Z0-9]+)\}/g)) if (!cls2tag.has(m[2])) cls2tag.set(m[2], m[1]);

const byId = new Map(); (function idx(n) { byId.set(n.id, n); (n.children || []).forEach(idx); })(raw);

// C7.2 (KAI-9370): the matrix must SEE inside coalesced svgs — list every bound property the
// bake froze (with its token name from the variable dump), marked BAKED. Same inventory as the
// emit detector, independently derived (audit principle: two surfaces, one truth).
import path from 'node:path';
let varNames = new Map();
try {
  const dump = JSON.parse(readFileSync(path.join(path.dirname(NODES), `${run.fileKey}.variables.json`), 'utf8'));
  varNames = new Map(Object.entries(dump.variables ?? {}).map(([id, v]) => [id, v.name]));
} catch { /* dump unavailable → ids shown raw */ }
function bakedRows(n) {
  const out = [];
  (function scan(x, depth) {
    if (depth > 0) {
      for (const [prop, b] of Object.entries(x.boundVariables ?? {})) {
        const a = Array.isArray(b) ? b[0] : b;
        const id = a?.id ?? (typeof a === 'object' ? JSON.stringify(a).slice(0, 24) : String(a));
        out.push([`${x.name} · ${prop}`, varNames.get(id) ?? id]);
      }
      if (x.layoutMode && x.layoutMode !== 'NONE') out.push([`${x.name} · auto-layout`, `${x.layoutMode} gap:${x.itemSpacing ?? 0}`]);
    }
    (x.children ?? []).forEach((c) => scan(c, depth + 1));
  })(n, 0);
  return out;
}
const hex = (c) => c ? '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('') + (c.a != null && c.a < 1 ? Math.round(c.a * 255).toString(16).padStart(2, '0') : '') : '';
const bv = (n, k) => { const b = n.boundVariables?.[k]; const a = Array.isArray(b) ? b[0] : b; return a ? '◈' : ''; };

// ── Figma anatomy → list of {k, v} property lines ──
function figAnatomy(n) {
  const L = []; const b = n.absoluteBoundingBox || {};
  L.push(['tag/type', n.type]);
  L.push(['size', `${Math.round(b.width)}×${Math.round(b.height)}  (H:${n.layoutSizingHorizontal || '-'} V:${n.layoutSizingVertical || '-'}) ${bv(n, 'width') || bv(n, 'height')}`]);
  if (Math.abs(n.rotation || 0) > 0.001) L.push(['rotation', `${Math.round((n.rotation) * 180 / Math.PI * 100) / 100}°`]);
  if (n.opacity != null && n.opacity < 1) L.push(['opacity', String(n.opacity)]);
  if (n.layoutMode === 'HORIZONTAL' || n.layoutMode === 'VERTICAL') {
    const pad = `${n.paddingTop || 0} ${n.paddingRight || 0} ${n.paddingBottom || 0} ${n.paddingLeft || 0}`;
    L.push(['auto-layout', `${n.layoutMode === 'HORIZONTAL' ? 'row' : 'col'}  gap:${n.itemSpacing ?? 0}${bv(n, 'itemSpacing')}  pad:[${pad}]  just:${n.primaryAxisAlignItems || 'MIN'} align:${n.counterAxisAlignItems || 'MIN'}${n.clipsContent ? '  clip' : ''}`]);
  }
  for (const f of (n.fills || []).filter((x) => x.visible !== false)) {
    if (f.type === 'SOLID') L.push(['fill', `SOLID ${hex(f.color)}${f.opacity != null && f.opacity < 1 ? ' o' + f.opacity : ''} ${bv(n, 'fills')}`]);
    else if (f.type === 'IMAGE') L.push(['fill', `IMAGE ${f.scaleMode} ref:${(f.imageRef || '').slice(0, 8)}`]);
    else L.push(['fill', f.type]);
  }
  for (const s of (n.strokes || []).filter((x) => x.visible !== false)) L.push(['stroke', `${s.type} ${hex(s.color)} w:${n.strokeWeight}${bv(n, 'strokeWeight')} align:${n.strokeAlign}`]);
  for (const e of (n.effects || []).filter((x) => x.visible !== false)) L.push(['effect', `${e.type} r:${e.radius ?? 0}${e.offset ? ` off:${e.offset.x},${e.offset.y}` : ''}${e.color ? ' ' + hex(e.color) : ''}`]);
  const cr = n.rectangleCornerRadii;
  if (cr) L.push(['radius', `[${cr.join(' ')}] ${bv(n, 'rectangleCornerRadii')}`]);
  else if (n.cornerRadius) L.push(['radius', `${n.cornerRadius} ${bv(n, 'cornerRadius')}`]);
  if (n.type === 'TEXT') {
    const st = n.style || {};
    L.push(['text', JSON.stringify(n.characters)]);
    L.push(['font', `${st.fontFamily} ${st.fontStyle} ${st.fontSize}px/${st.lineHeightPercentFontSize ? Math.round(st.lineHeightPercentFontSize) + '%' : st.lineHeightPx + 'px'} ls:${st.letterSpacing ?? 0} ${bv(n, 'fontSize') || bv(n, 'fontFamily')}`]);
    L.push(['align', `${st.textAlignHorizontal}/${st.textAlignVertical}`]);
  }
  return L;
}

// ── build HTML ──
const rows = run.idMap.map((e) => {
  const n = byId.get(e.figmaId); if (!n) return '';
  const fig = figAnatomy(n);
  const decls = cls2decls.get(e.class) || [];
  const tag = cls2tag.get(e.class) || e.kind;
  let cssHtml = decls.map(([p, v]) => {
    const r = resolve(v); const res = r !== v ? ` <span class=res>→ ${r}</span>` : '';
    return `<div class=line><span class=k>${p}</span><span class=v>${v}${res}</span></div>`;
  }).join('') || '<div class=line><span class=v style="color:#888">(no css — structural only)</span></div>';
  if (e.kind === 'svg') { // C7.2 — baked subtree bindings, visible in the audit surface
    // C7.3: a `color: var(--…)` on the svg class means fills/strokes bindings were rewritten to
    // currentColor — those rows are LIVE, not baked; geometry bindings (strokeWeight/size) stay BAKED.
    const themed = decls.some(([p, v]) => p === 'color' && v.includes('var('));
    cssHtml += bakedRows(n).map(([k, v]) => {
      const isColor = / · (fills|strokes)$/.test(k);
      return themed && isColor
        ? `<div class=line><span class=k res>LIVE</span><span class=v>${esc(k)} → ${esc(v)} <span class=res>(currentColor ← class token)</span></span></div>`
        : `<div class=line><span class=k baked>BAKED</span><span class=v><span class=baked>${esc(k)}</span> → ${esc(v)} <span class=baked>(frozen in svg)</span></span></div>`;
    }).join('');
  }
  const figHtml = fig.map(([k, v]) => `<div class=line><span class=k>${k}</span><span class=v>${esc(v)}</span></div>`).join('');
  return `<div class=node>
    <div class=hdr><b>&lt;${tag}&gt;</b> ${esc(n.name)} <span class=meta>${e.figmaId} → .${e.class}</span></div>
    <div class=cols><div class=col><div class=coltitle>FIGMA</div>${figHtml}</div>
    <div class=col><div class=coltitle>CONVERTED CSS/React</div><div class=line><span class=k>element</span><span class=v>&lt;${tag} className={styles.${e.class}}&gt;</span></div>${cssHtml}</div></div></div>`;
}).join('\n');
function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

const html = `<!doctype html><html><head><meta charset=utf-8><style>
body{margin:0;background:#16161a;color:#e6e6ea;font:13px/1.5 ui-monospace,Menlo,monospace;padding:20px}
h1{font-family:-apple-system,sans-serif;font-size:20px}
.sub{color:#8a8a92;font-family:-apple-system,sans-serif;margin-bottom:18px}
.node{border:1px solid #2a2a32;border-radius:10px;margin-bottom:12px;overflow:hidden}
.hdr{background:#20202a;padding:8px 12px;font-family:-apple-system,sans-serif}
.hdr .meta{color:#7a7a86;font-size:11px;float:right}
.cols{display:grid;grid-template-columns:1fr 1fr}
.col{padding:8px 12px}.col:first-child{border-right:1px solid #2a2a32;background:#191920}
.coltitle{color:#6cf;font-size:10px;letter-spacing:.08em;margin-bottom:6px;font-family:-apple-system,sans-serif}
.line{display:flex;gap:10px;padding:1px 0}
.k{color:#8a8a92;min-width:78px}.v{color:#e6e6ea;white-space:pre-wrap;word-break:break-word}
.res{color:#7d7}
.baked{color:#e8a94c}
</style></head><body>
<h1>Full anatomy — Figma ↔ converted (mother screen 4084:25997)</h1>
<div class=sub>Every node: Figma properties on the left, the exact emitted CSS/React on the right. Token vars show their resolved value in green. ${run.idMap.length} nodes.</div>
${rows}
</body></html>`;
writeFileSync(OUT + '/anatomy.html', html);
console.log('anatomy.html written,', html.length, 'bytes,', run.idMap.length, 'nodes');
