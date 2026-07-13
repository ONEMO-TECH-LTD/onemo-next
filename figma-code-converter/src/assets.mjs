/**
 * figma-to-code · C1.3b — asset export (SPEC §3.5 vectors + image fills; §6 AC4 asset scope).
 *
 * Vector subtree roots → Figma's own svg renderer (GET /v1/images?format=svg) — faithful,
 * cached per node id + file version. Image fills → GET /v1/files/:key/images (imageRef→url).
 * Determinism scope (AC4/F7): code+report byte-identical; assets recorded by CONTENT HASH —
 * Figma's exports aren't guaranteed byte-stable across runs.
 *
 * JSX-safe inlining: Figma svg uses kebab-case presentation attributes (fill-rule, stroke-width…)
 * which React DOM warns on — and AC13 demands a zero-warning console. Deterministic rule:
 * kebab attribute names camelize, EXCEPT data-, aria- and xmlns prefixes which stay verbatim.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { figmaToken, cacheDir } from './fetch.mjs';

const API = 'https://api.figma.com';
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function assetDir(root, fileKey) {
  return path.join(cacheDir(root), 'assets', fileKey);
}

/** Camelize kebab-case JSX-hostile svg attributes (deterministic; data-, aria-, xmlns exempt),
 *  and convert string `style="a: b"` attrs to JSX object syntax (React rejects style strings). */
export function jsxSafeSvg(svg) {
  const camelized = svg.replace(/([a-zA-Z][\w:-]*)=/g, (m, name) => {
    if (name.startsWith('data-') || name.startsWith('aria-') || name.startsWith('xmlns')) return m;
    if (!name.includes('-')) return m;
    return `${name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}=`;
  });
  // foreignObject children: Figma emits `<div xmlns="http://www.w3.org/1999/xhtml" …>` — React's
  // div type has no xmlns prop (TS2322); the xhtml namespace is implied in React rendering. Drop it.
  const noDivXmlns = camelized.replace(/(<div[^>]*?) xmlns="[^"]*"/g, '$1');
  return noDivXmlns.replace(/style="([^"]*)"/g, (_, body) => {
    const entries = body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(':');
      const prop = d.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return `${prop}: '${d.slice(i + 1).trim().replace(/'/g, "\\'")}'`;
    });
    return `style={{ ${entries.join(', ')} }}`;
  });
}

/** Export svg for the given node ids (batched), cache to assets/<fileKey>/<id>-<version>.svg.
 *  The cache key CARRIES THE FILE VERSION (C11 G7/E12): an id-only key serves a stale export
 *  forever after any vector edit (live-hit: removed icon shadow + fixed mirror kept rendering). */
export async function exportSvgs(root, fileKey, ids, { offline = false, version = 'v0' } = {}) {
  const dir = assetDir(root, fileKey);
  await fs.mkdir(dir, { recursive: true });
  const fileFor = (id) => path.join(dir, `${id.replace(/[:;]/g, '-')}-${version}.svg`);

  const missing = [];
  const out = new Map();
  for (const id of ids) {
    try {
      out.set(id, jsxSafeSvg(await fs.readFile(fileFor(id), 'utf8')));
    } catch { missing.push(id); }
  }
  if (missing.length === 0 || offline) {
    return { assets: out, missing: offline ? missing : [], hashes: hashMap(out) };
  }

  const token = await figmaToken();
  for (let i = 0; i < missing.length; i += 50) { // API id-count limits — batch
    const batch = missing.slice(i, i + 50);
    const res = await fetch(`${API}/v1/images/${fileKey}?ids=${encodeURIComponent(batch.join(','))}&format=svg`, {
      headers: { 'X-Figma-Token': token },
    });
    if (!res.ok) throw new Error(`figma-to-code: svg export ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const { images = {} } = await res.json();
    for (const [id, url] of Object.entries(images)) {
      if (!url) continue; // Figma returns null for un-renderable nodes — stays "missing", reported
      const svg = await (await fetch(url)).text();
      await fs.writeFile(fileFor(id), svg);
      out.set(id, jsxSafeSvg(svg));
    }
  }
  const stillMissing = ids.filter((id) => !out.has(id));
  return { assets: out, missing: stillMissing, hashes: hashMap(out) };
}

function hashMap(assets) {
  const h = {};
  for (const [id, body] of assets) h[id] = sha256(body).slice(0, 16);
  return h;
}

/** Collect svg-root node ids from an IR tree. */
export function svgIdsOf(ir) {
  const ids = [];
  (function walk(n) {
    if (n.kind === 'svg') ids.push(n.id);
    n.children.forEach(walk);
  })(ir);
  return ids;
}

/**
 * Image fills → ORIGINALS (Dan pin 2026-07-04: complete package, no recompression).
 * GET /v1/files/:key/images returns URLs to the original uploaded bytes per imageRef.
 * Saved verbatim into the package's assets/ dir; returns ref → {file, hash}.
 */
export async function exportImageFills(fileKey, imageRefs, destDir, { offline = false } = {}) {
  const out = new Map();
  const missing = [];
  await fs.mkdir(destDir, { recursive: true });
  const fileFor = (ref) => path.join(destDir, `${ref}.png`);

  const toFetch = [];
  for (const ref of imageRefs) {
    try {
      const buf = await fs.readFile(fileFor(ref));
      out.set(ref, { file: `${ref}.png`, hash: sha256(buf).slice(0, 16) });
    } catch { toFetch.push(ref); }
  }
  if (toFetch.length === 0 || offline) return { images: out, missing: offline ? toFetch : [] };

  const token = await figmaToken();
  const res = await fetch(`${API}/v1/files/${fileKey}/images`, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) throw new Error(`figma-to-code: image-fills endpoint ${res.status}`);
  const { meta } = await res.json();
  for (const ref of toFetch) {
    const url = meta?.images?.[ref];
    if (!url) { missing.push(ref); continue; }
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer()); // verbatim — no recompression
    await fs.writeFile(fileFor(ref), bytes);
    out.set(ref, { file: `${ref}.png`, hash: sha256(bytes).slice(0, 16) });
  }
  return { images: out, missing };
}

/** Collect image-fill refs from an IR tree. */
export function imageRefsOf(ir) {
  const refs = new Set();
  (function walk(n) {
    for (const l of n.style?.fills?.layers ?? []) if (l.type === 'image' && l.imageRef) refs.add(l.imageRef);
    n.children.forEach(walk);
  })(ir);
  return [...refs];
}
