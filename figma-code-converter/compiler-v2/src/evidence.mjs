/**
 * compiler-v2 · immutable evidence snapshots (C11 v3 §4.1–4.4, V1/V2).
 *
 * A snapshot directory is the ONLY input the compiler reads — no phase reads "latest" files
 * outside it (§4.1). This module writes/reads/validates snapshots and computes the
 * schema-versioned fingerprint used by the three-pass stability check. Capture TRANSPORT
 * (REST/bridge) lives in capture.mjs; this module is pure evidence mechanics so fixtures can
 * fabricate snapshots through the exact same code path the live capture uses (one law).
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
export function fingerprint({ document, supplement, variables, components, fonts, assetHashes }) {
  return sha256([
    `fp-schema:${SCHEMA.manifest}`,
    canonicalJson(document ?? null),
    canonicalJson(supplement ?? null),
    canonicalJson(variables ?? null),
    canonicalJson(components ?? null),
    canonicalJson(fonts ?? null),
    canonicalJson(assetHashes ?? null),
  ].join('␞'));
}

const EVIDENCE_FILES = ['document.rest.json', 'supplement.json', 'variables.json', 'components.json', 'fonts.json'];

/**
 * Write a snapshot directory. `parts` carries the JS values; assets is a Map<relPath, Buffer>.
 * Returns { dir, manifest }. The manifest seals SHA-256 + bytes of every file (§4.3).
 */
export async function writeSnapshot(dir, {
  fileKey, fileVersion, rootIds, captureId, sourcePlanes, capturedModes = [],
  document, supplement, variables, components, fonts, assets = new Map(),
  references = [], warnings = [], retries = 0, compilerVersion, capabilityRegistryVersion,
}) {
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  await fs.mkdir(path.join(dir, 'references'), { recursive: true });
  const files = {};
  const put = async (rel, buf) => {
    await fs.writeFile(path.join(dir, rel), buf);
    files[rel] = { sha256: sha256(buf), bytes: buf.length };
  };
  const parts = { 'document.rest.json': document, 'supplement.json': supplement, 'variables.json': variables, 'components.json': components, 'fonts.json': fonts };
  for (const rel of EVIDENCE_FILES) await put(rel, Buffer.from(JSON.stringify(parts[rel] ?? null, null, 1)));
  for (const [rel, buf] of assets) await put(path.join('assets', rel), buf);
  await put('references/manifest.json', Buffer.from(JSON.stringify({ schemaVersion: SCHEMA.manifest, references }, null, 1)));

  const census = censusOf({ document, supplement, variables, components });
  const manifest = {
    schemaVersion: SCHEMA.manifest,
    compilerVersion, capabilityRegistryVersion,
    fileKey, fileVersion, rootIds, captureId,
    capturedModes, sourcePlanes, warnings, retries,
    fingerprint: fingerprint({ document, supplement, variables, components, fonts, assetHashes: Object.fromEntries([...assets.keys()].map((k) => [k, files[path.join('assets', k)].sha256])) }),
    files, census,
  };
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return { dir, manifest };
}

/** Node/alias/variable/component/text-run census (§4.3) — computed, never asserted. */
export function censusOf({ document, supplement, variables, components }) {
  let nodes = 0, aliases = 0, textRuns = 0;
  (function walk(n) {
    if (!n) return;
    nodes++;
    if (n.type === 'TEXT') textRuns += Math.max(1, new Set(Object.values(n.characterStyleOverrides ?? {})).size || 1);
    (function scanAliases(x) {
      if (Array.isArray(x)) return x.forEach(scanAliases);
      if (x !== null && typeof x === 'object') {
        if (x.type === 'VARIABLE_ALIAS' && x.id) aliases++;
        for (const v of Object.values(x)) scanAliases(v);
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

/** Read + validate a snapshot. REFUSES unknown schema, hash mismatch, missing files (G0 core). */
export async function readSnapshot(dir) {
  const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
  const errs = validateManifest(manifest);
  if (errs.length) throw new EvidenceError('FAILED_CAPTURE', `manifest invalid: ${errs.join('; ')}`);
  for (const [rel, meta] of Object.entries(manifest.files)) {
    let buf;
    try { buf = await fs.readFile(path.join(dir, rel)); }
    catch { throw new EvidenceError('FAILED_CAPTURE', `evidence file missing: ${rel}`); }
    const h = sha256(buf);
    if (h !== meta.sha256) throw new EvidenceError('FAILED_CAPTURE', `hash mismatch: ${rel} (manifest ${meta.sha256.slice(0, 12)}… ≠ disk ${h.slice(0, 12)}…)`);
  }
  const read = (rel) => fs.readFile(path.join(dir, rel), 'utf8').then(JSON.parse);
  const snapshot = {
    dir, manifest,
    document: await read('document.rest.json'),
    supplement: await read('supplement.json'),
    variables: await read('variables.json'),
    components: await read('components.json'),
    fonts: await read('fonts.json'),
  };
  // fingerprint re-verification: the manifest cannot lie about its own content
  const assetHashes = {};
  for (const [rel, meta] of Object.entries(manifest.files)) {
    if (rel.startsWith('assets/')) assetHashes[rel.slice('assets/'.length)] = meta.sha256;
  }
  const fp = fingerprint({ ...snapshot, assetHashes });
  if (fp !== manifest.fingerprint) throw new EvidenceError('FAILED_CAPTURE', `fingerprint mismatch (manifest ${manifest.fingerprint.slice(0, 12)}… ≠ recomputed ${fp.slice(0, 12)}…)`);
  return snapshot;
}

export class EvidenceError extends Error {
  constructor(state, message) { super(message); this.state = state; }
}
