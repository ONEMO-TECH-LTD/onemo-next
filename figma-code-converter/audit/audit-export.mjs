// Audit-data exporter (C8.1) — the data backbone for the audit console. Turns a converted
// screen's on-disk artifacts (convert-run.json, module.css, conformance.json) + the raw Figma
// nodes into ONE audit.json keyed by Figma node id: per node, its Figma anatomy ↔ emitted CSS
// (tokens resolved), plus parity-drift / approximation / raw flags. The console fetches this and,
// on a click (data-fc="<id>"), shows that node's entry. Every future mode reads the same file.
//
// usage: node audit/audit-export.mjs <outDir> <raw-nodes.json> <tokens.css> [--out audit.json]
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [, , OUT, NODES, TOKENS, ...rest] = process.argv;
if (!OUT || !NODES || !TOKENS) { console.error('usage: node audit/audit-export.mjs <outDir> <raw-nodes.json> <tokens.css> [--out <file>]'); process.exit(2); }
const outFile = (() => { const i = rest.indexOf('--out'); return i >= 0 ? rest[i + 1] : path.join(OUT, 'audit.json'); })();

const raw = JSON.parse(readFileSync(NODES, 'utf8'));
const run = JSON.parse(readFileSync(path.join(OUT, 'convert-run.json'), 'utf8'));
const css = readFileSync(path.join(OUT, readdirSync(OUT).find((f) => f.endsWith('.module.css'))), 'utf8');
let conf = {}; try { conf = JSON.parse(readFileSync(path.join(OUT, 'conformance.json'), 'utf8')); } catch { /* optional */ }
const tokensCss = readFileSync(TOKENS, 'utf8');

import { themeScopedTokenDefs, resolveVar } from '../src/token-defs.mjs';
const tokenDefs = themeScopedTokenDefs(tokensCss); // theme-scoped (light) — dark overrides mustn't win (meta-qa F1)
const resolve = (v) => resolveVar(tokenDefs, v);

// emitted CSS: class → ordered [prop, value]
const cls2decls = new Map();
for (const block of css.split('}')) {
  const m = block.match(/\.([a-zA-Z0-9]+)\s*\{([\s\S]*)/); if (!m) continue;
  cls2decls.set(m[1], [...m[2].matchAll(/\s*([a-z-]+):\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]));
}
// emitted TSX: class → tag
const tsx = readFileSync(path.join(OUT, readdirSync(OUT).find((f) => /^[A-Z].*\.tsx$/.test(f))), 'utf8');
const cls2tag = new Map();
for (const m of tsx.matchAll(/<([a-zA-Z0-9]+)[^>]*className=\{styles\.([a-zA-Z0-9]+)\}/g)) if (!cls2tag.has(m[2])) cls2tag.set(m[2], m[1]);

const byId = new Map(); (function idx(n) { byId.set(n.id, n); (n.children || []).forEach(idx); })(raw);
const hex = (c) => c ? '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('') + (c.a != null && c.a < 1 ? Math.round(c.a * 255).toString(16).padStart(2, '0') : '') : '';
const rootB = raw.absoluteBoundingBox ?? {};

// flags keyed by className
const driftBy = new Map((conf.valueParity ?? []).map((p) => [p.className, p]));
const approxBy = new Map();
for (const n of run.notes ?? []) if (n.kind === 'approximation') (approxBy.get(n.nodeId) ?? approxBy.set(n.nodeId, []).get(n.nodeId)).push(n.note);

function figAnatomy(n) {
  const L = []; const b = n.absoluteBoundingBox || {};
  L.push(['type', n.type]);
  L.push(['size', `${Math.round(b.width)}×${Math.round(b.height)} · H:${n.layoutSizingHorizontal || '-'} V:${n.layoutSizingVertical || '-'}`]);
  if (Math.abs(n.rotation || 0) > 0.001) L.push(['rotation', `${Math.round(n.rotation * 180 / Math.PI * 100) / 100}°`]);
  if (n.opacity != null && n.opacity < 1) L.push(['opacity', String(n.opacity)]);
  if (n.layoutMode === 'HORIZONTAL' || n.layoutMode === 'VERTICAL')
    L.push(['auto-layout', `${n.layoutMode === 'HORIZONTAL' ? 'row' : 'col'} · gap ${n.itemSpacing ?? 0} · just ${n.primaryAxisAlignItems || 'MIN'} · align ${n.counterAxisAlignItems || 'MIN'}`]);
  for (const f of (n.fills || []).filter((x) => x.visible !== false)) L.push(['fill', f.type === 'SOLID' ? `SOLID ${hex(f.color)}` : f.type === 'IMAGE' ? `IMAGE ${f.scaleMode}` : f.type]);
  for (const s of (n.strokes || []).filter((x) => x.visible !== false)) L.push(['stroke', `${s.type} ${hex(s.color)} · w ${n.strokeWeight} · ${n.strokeAlign}`]);
  for (const e of (n.effects || []).filter((x) => x.visible !== false)) L.push(['effect', `${e.type} r:${e.radius ?? 0}`]);
  if (n.type === 'TEXT') { const st = n.style || {}; L.push(['text', JSON.stringify(n.characters)]); L.push(['font', `${st.fontFamily} ${st.fontStyle} ${st.fontSize}px`]); }
  return L;
}

const nodes = {};
for (const e of run.idMap) {
  const n = byId.get(e.figmaId); if (!n) continue;
  const b = n.absoluteBoundingBox || {};
  const decls = (cls2decls.get(e.class) || []).map(([prop, value]) => {
    const r = resolve(value);
    const token = value.match(/var\((--[a-z0-9-]+)\)/)?.[1] ?? null;
    return { prop, value, resolved: r !== value ? r : null, token, raw: !token };
  });
  nodes[e.figmaId] = {
    class: e.class, tag: cls2tag.get(e.class) || e.kind, name: n.name,
    rel: { x: Math.round((b.x ?? rootB.x) - rootB.x), y: Math.round((b.y ?? rootB.y) - rootB.y), w: Math.round(b.width ?? 0), h: Math.round(b.height ?? 0) },
    figma: figAnatomy(n), css: decls,
    drift: driftBy.get(e.class) ? { figma: driftBy.get(e.class).figma, resolved: driftBy.get(e.class).resolved } : null,
    approximation: approxBy.get(e.figmaId) || null,
  };
}

// ── structure tree (Structure mode): parent id → child ids, in emit order ──
const inIdMap = new Set(run.idMap.map((e) => e.figmaId));
const tree = {};
(function walkTree(n) {
  tree[n.id] = (n.children || []).map((c) => c.id).filter((id) => inIdMap.has(id));
  (n.children || []).forEach(walkTree);
})(raw);
const rootId = run.idMap[0]?.figmaId;

// ── assets (Structure/Assets mode): svg count + image byte-exactness ──
const svgCount = run.idMap.filter((e) => e.kind === 'svg').length;
const assetsDir = path.join(OUT, 'assets');
const images = [];
if (existsSync(assetsDir)) {
  for (const f of readdirSync(assetsDir).filter((x) => /\.(png|jpe?g|webp|gif|svg)$/i.test(x))) {
    const buf = readFileSync(path.join(assetsDir, f));
    const sha1 = createHash('sha1').update(buf).digest('hex');
    const ref = f.replace(/\.[^.]+$/, '');
    images.push({ file: f, bytes: statSync(path.join(assetsDir, f)).size, sha1, byteExact: sha1 === ref });
  }
}

// ── zones (Zone filter): the root's direct children = the screen's regions ──
const zones = (tree[rootId] || []).map((id) => {
  const e = run.idMap.find((x) => x.figmaId === id);
  return e ? { id, class: e.class, name: nodes[id]?.name ?? e.class, rel: nodes[id]?.rel } : null;
}).filter(Boolean);

const audit = {
  screen: run.nodeId, name: raw.name, frame: { w: Math.round(rootB.width ?? 0), h: Math.round(rootB.height ?? 0) },
  summary: { elements: run.idMap.length, refusals: (run.refusals ?? []).length, coverage: conf.tokenCoveragePct ?? null, unresolved: (conf.unresolved ?? []).length, drift: (conf.valueParity ?? []).length, approximations: (run.notes ?? []).filter((n) => n.kind === 'approximation').length },
  structure: { rootId, tree, svgCount, images, refusals: run.refusals ?? [] },
  zones,
  nodes,
};
writeFileSync(outFile, JSON.stringify(audit));
console.log(`audit-export: ${outFile} — ${Object.keys(nodes).length} nodes, coverage ${audit.summary.coverage}%, drift ${audit.summary.drift}, approximations ${audit.summary.approximations}`);
