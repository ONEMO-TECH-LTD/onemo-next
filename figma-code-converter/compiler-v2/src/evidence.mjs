/**
 * compiler-v2 · immutable evidence snapshots (C11 v3 §4.1–4.4, V1/V2).
 *
 * A snapshot directory is the ONLY input the compiler reads — no phase reads "latest" files
 * outside it (§4.1). Snapshots are IMMUTABLE (V1): writes stage to a temp candidate and
 * atomically rename; an existing sealed target is refused; a failed write leaves no partial
 * candidate. Every read re-verifies sha256 AND byte length; any absence/mismatch surfaces
 * EvidenceError(FAILED_CAPTURE) — never a raw ENOENT.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { SCHEMA, validateManifest } from './schema.mjs';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Canonical JSON: stable key order, no whitespace variance — fingerprint determinism (V12). */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * §4.1 fingerprint: hashes the canonical document + the semantic facts the compiler uses.
 * A node count/timestamp/name is NOT an adequate fingerprint — this hashes content.
 */
export function fingerprint({ document, supplement, variables, components, fonts, dependencies, assetHashes }) {
  return sha256([
    `fp-schema:${SCHEMA.manifest}`,
    canonicalJson(document ?? null),
    canonicalJson(supplement ?? null),
    canonicalJson(variables ?? null),
    canonicalJson(components ?? null),
    canonicalJson(fonts ?? null),
    canonicalJson(dependencies ?? null),
    canonicalJson(assetHashes ?? null),
  ].join('␞'));
}

/** The contracted evidence set (§4.3) — validateManifest refuses a manifest missing any. */
export const REQUIRED_EVIDENCE_FILES = Object.freeze([
  'document.rest.json', 'supplement.json', 'variables.json', 'components.json', 'fonts.json',
  'dependencies.json', 'references/manifest.json',
]);

/**
 * Write a sealed snapshot. Stages into `<dir>.staging-<captureId>`, atomically renames to
 * `dir` on success, removes the staged partial on ANY failure. Refuses an existing sealed dir.
 */
export async function writeSnapshot(dir, {
  fileKey, fileVersion, rootIds, captureId, sourcePlanes, capturedModes = [],
  document, supplement, variables, components, fonts, dependencies = { locks: [] },
  assets = new Map(), references = [], warnings = [], retries = 0,
  compilerVersion, capabilityRegistryVersion,
}) {
  if (await exists(path.join(dir, 'manifest.json'))) {
    throw new EvidenceError('FAILED_CAPTURE', `snapshot target already sealed: ${dir} — snapshots are immutable (V1); capture to a new directory`);
  }
  const staging = `${dir}.staging-${captureId}`;
  await fs.rm(staging, { recursive: true, force: true }); // a matching stale partial from a crashed run
  try {
    await fs.mkdir(path.join(staging, 'assets'), { recursive: true });
    await fs.mkdir(path.join(staging, 'references'), { recursive: true });
    const files = {};
    const put = async (rel, buf) => {
      if (!Buffer.isBuffer(buf)) throw new EvidenceError('FAILED_CAPTURE', `evidence part ${rel} is not byte content`);
      const abs = resolveUnder(staging, rel); // V13 confinement — the ONE helper, write side
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, buf);
      files[rel] = { sha256: sha256(buf), bytes: buf.length };
    };
    const parts = {
      'document.rest.json': document, 'supplement.json': supplement, 'variables.json': variables,
      'components.json': components, 'fonts.json': fonts, 'dependencies.json': dependencies,
    };
    for (const rel of Object.keys(parts)) await put(rel, Buffer.from(JSON.stringify(parts[rel] ?? null, null, 1)));
    for (const [rel, buf] of assets) await put(`assets/${rel}`, buf);
    // §4.5: every DECLARED reference artifact must be sealed with the snapshot — a reference
    // row without sealed bytes is a refusal, not a dangling promise.
    for (const ref of references) {
      if (!ref.file) throw new EvidenceError('FAILED_CAPTURE', `reference ${ref.state ?? '?'} declares no artifact file`);
      if (!String(ref.file).startsWith('references/')) throw new EvidenceError('FAILED_CAPTURE', `reference artifact must live under references/: ${ref.file}`);
      if (!Buffer.isBuffer(ref.bytes)) throw new EvidenceError('FAILED_CAPTURE', `reference artifact not provided as bytes: ${ref.file}`);
      await put(ref.file, ref.bytes);
    }
    await put('references/manifest.json', Buffer.from(JSON.stringify({
      schemaVersion: SCHEMA.manifest,
      references: references.map(({ bytes, ...meta }) => ({ ...meta, sha256: sha256(bytes) })),
    }, null, 1)));

    const census = censusOf({ document, supplement, variables, components });
    const assetHashes = Object.fromEntries([...assets.keys()].map((k) => [k, files[path.join('assets', k)].sha256]));
    const manifest = {
      schemaVersion: SCHEMA.manifest,
      compilerVersion, capabilityRegistryVersion,
      fileKey, fileVersion, rootIds, captureId,
      capturedModes, sourcePlanes, warnings, retries,
      fingerprint: fingerprint({ document, supplement, variables, components, fonts, dependencies, assetHashes }),
      files, census,
    };
    const errs = validateManifest(manifest);
    if (errs.length) throw new EvidenceError('FAILED_CAPTURE', `refusing to seal an invalid manifest: ${errs.join('; ')}`);
    await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 1));
    await fs.rename(staging, dir); // atomic seal
    return { dir, manifest };
  } catch (e) {
    await fs.rm(staging, { recursive: true, force: true }); // no partial candidates (V1/V17 posture)
    throw e instanceof EvidenceError ? e : new EvidenceError('FAILED_CAPTURE', `snapshot staging failed: ${e.message}`);
  }
}

/**
 * Node/alias/variable/component/text-run census (§4.3) — computed, never asserted.
 * Alias scan EXCLUDES children per node (they are counted as their own nodes — double-count
 * was Meta probe finding 3). Text runs: plugin styled segments when present (authoritative),
 * else transition-based runs over REST characterStyleOverrides (contiguous style spans).
 */
export function censusOf({ document, supplement, variables, components }) {
  const segmentsByNode = new Map((supplement?.nodes ?? [])
    .filter((n) => Array.isArray(n.styledTextSegments))
    .map((n) => [n.nodeId, n.styledTextSegments.length]));
  let nodes = 0, aliases = 0, textRuns = 0;
  (function walk(n) {
    if (!n) return;
    nodes++;
    if (n.type === 'TEXT') textRuns += segmentsByNode.get(n.id) ?? restTextRuns(n);
    (function scanAliases(x) {
      if (Array.isArray(x)) return x.forEach(scanAliases);
      if (x !== null && typeof x === 'object') {
        if (x.type === 'VARIABLE_ALIAS' && x.id) aliases++;
        for (const [k, v] of Object.entries(x)) {
          if (k === 'children') continue; // children are walked as their own nodes
          scanAliases(v);
        }
      }
    })(n);
    (n.children ?? []).forEach(walk);
  })(document);
  return {
    nodes, aliases, textRuns,
    variables: variables?.variables?.length ?? 0,
    components: components?.components?.length ?? 0,
    supplementNodes: supplement?.nodes?.length ?? 0,
  };
}

/** Contiguous style spans from REST per-character overrides (default style id = 0). */
export function restTextRuns(node) {
  const chars = node.characters ?? '';
  if (chars.length === 0) return 0;
  const ov = node.characterStyleOverrides;
  const idAt = (i) => (Array.isArray(ov) ? (ov[i] ?? 0) : (ov?.[i] ?? 0));
  let runs = 1;
  for (let i = 1; i < chars.length; i++) if (idAt(i) !== idAt(i - 1)) runs++;
  return runs;
}

/** Read + validate a snapshot. REFUSES unknown schema, hash/byte mismatch, missing files. */
export async function readSnapshot(dir) {
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8')); }
  catch (e) { throw new EvidenceError('FAILED_CAPTURE', `manifest unreadable at ${dir}: ${e.code ?? e.message}`); }
  const errs = validateManifest(manifest);
  if (errs.length) throw new EvidenceError('FAILED_CAPTURE', `manifest invalid: ${errs.join('; ')}`);
  const rootReal = await fs.realpath(dir).catch(() => { throw new EvidenceError('FAILED_CAPTURE', `snapshot dir unreadable: ${dir}`); });
  for (const [rel, meta] of Object.entries(manifest.files)) {
    let buf;
    try {
      const abs = resolveUnder(dir, rel); // confinement on READ too — a malicious manifest cannot reach outside
      // symlink law: the REAL path must also stay under the snapshot — a symlink planted inside
      // the directory cannot smuggle bytes from outside the sealed evidence (Meta round-3 escape)
      const real = await fs.realpath(abs);
      if (real !== rootReal && !real.startsWith(rootReal + path.sep)) {
        throw new EvidenceError('FAILED_CAPTURE', `evidence file resolves outside the snapshot (symlink): ${rel}`);
      }
      buf = await fs.readFile(real);
    }
    catch (e) { throw e instanceof EvidenceError ? e : new EvidenceError('FAILED_CAPTURE', `evidence file missing: ${rel}`); }
    if (buf.length !== meta.bytes) throw new EvidenceError('FAILED_CAPTURE', `byte-length mismatch: ${rel} (manifest ${meta.bytes} ≠ disk ${buf.length})`);
    const h = sha256(buf);
    if (h !== meta.sha256) throw new EvidenceError('FAILED_CAPTURE', `hash mismatch: ${rel} (manifest ${meta.sha256.slice(0, 12)}… ≠ disk ${h.slice(0, 12)}…)`);
  }
  const read = async (rel) => {
    try { return JSON.parse(await fs.readFile(resolveUnder(dir, rel), 'utf8')); }
    catch (e) { throw e instanceof EvidenceError ? e : new EvidenceError('FAILED_CAPTURE', `evidence part unreadable: ${rel}: ${e.code ?? e.message}`); }
  };
  // every declared reference must resolve to exactly one sealed file (metadata-only forbidden).
  // The read side stands ALONE: a crafted/checked-in snapshot cannot rely on write-side honesty,
  // so rows REQUIRE a sha256, must live under references/, and must match the sealed bytes.
  const refManifest = await read('references/manifest.json');
  for (const ref of refManifest?.references ?? []) {
    if (!ref.file || !String(ref.file).startsWith('references/')) throw new EvidenceError('FAILED_CAPTURE', `reference row outside references/: ${ref.file}`);
    if (!ref.sha256) throw new EvidenceError('FAILED_CAPTURE', `reference row missing sha256: ${ref.file}`);
    if (!manifest.files[ref.file]) throw new EvidenceError('FAILED_CAPTURE', `declared reference not sealed in manifest.files: ${ref.file}`);
    if (manifest.files[ref.file].sha256 !== ref.sha256) throw new EvidenceError('FAILED_CAPTURE', `reference sha mismatch: ${ref.file}`);
  }
  const snapshot = {
    dir, manifest,
    document: await read('document.rest.json'),
    supplement: await read('supplement.json'),
    variables: await read('variables.json'),
    components: await read('components.json'),
    fonts: await read('fonts.json'),
    dependencies: await read('dependencies.json'),
  };
  const assetHashes = {};
  for (const [rel, meta] of Object.entries(manifest.files)) {
    if (rel.startsWith('assets/')) assetHashes[rel.slice('assets/'.length)] = meta.sha256;
  }
  const fp = fingerprint({ ...snapshot, assetHashes });
  if (fp !== manifest.fingerprint) throw new EvidenceError('FAILED_CAPTURE', `fingerprint mismatch (manifest ${manifest.fingerprint.slice(0, 12)}… ≠ recomputed ${fp.slice(0, 12)}…)`);
  return snapshot;
}

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

/**
 * V13 path confinement — THE single resolve-under-root helper, used by BOTH write and read.
 * Rejects absolute, empty, non-normalized, '.'/'..'-bearing, and escaping paths, so a
 * checked-in malicious manifest can never read outside its evidence directory.
 */
export function resolveUnder(root, rel) {
  if (typeof rel !== 'string' || rel.length === 0) throw new EvidenceError('FAILED_CAPTURE', 'empty evidence path');
  if (path.isAbsolute(rel)) throw new EvidenceError('FAILED_CAPTURE', `absolute evidence path forbidden: ${rel}`);
  const segs = rel.split('/');
  if (segs.some((s) => s === '' || s === '.' || s === '..')) throw new EvidenceError('FAILED_CAPTURE', `non-normalized evidence path forbidden: ${rel}`);
  const abs = path.resolve(root, rel);
  if (abs !== path.resolve(root) && !abs.startsWith(path.resolve(root) + path.sep)) {
    throw new EvidenceError('FAILED_CAPTURE', `evidence path escapes the snapshot: ${rel}`);
  }
  return abs;
}

export class EvidenceError extends Error {
  constructor(state, message) { super(message); this.state = state; }
}
