/**
 * figma-to-code · C1.1 — fetcher (SPEC §1 row 1, §2 "fetcher", §3.7 determinism).
 *
 * REST-only: GET /v1/files/:key/nodes?ids=:id with FIGMA_TOKEN (file-content read-only).
 * The raw response is cached content-hash-stamped; the emit pipeline runs OFFLINE from
 * cache — same input bytes, same output bytes. `--offline` forbids network entirely.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const API = 'https://api.figma.com';

/**
 * FIGMA_TOKEN from env, else onemo-next/.env.local (the repo's secrets convention).
 * Absolute anchor, not relative: this tool runs from worktrees whose depth varies.
 */
export async function figmaToken() {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  const envLocal = path.join(os.homedir(), 'Dev/onemo-dev/onemo-next/.env.local');
  try {
    const raw = await fs.readFile(envLocal, 'utf8');
    const line = raw.split('\n').find((l) => l.startsWith('FIGMA_TOKEN='));
    if (line) return line.slice('FIGMA_TOKEN='.length).trim();
  } catch { /* fall through */ }
  throw new Error(`figma-to-code: FIGMA_TOKEN not set (env or ${envLocal})`);
}

export function cacheDir(root) {
  return path.join(root, 'cache');
}

export function cachePaths(root, fileKey, nodeId) {
  const base = path.join(cacheDir(root), `${fileKey}-${nodeId.replace(':', '-')}`);
  return { nodes: `${base}.nodes.json`, meta: `${base}.meta.json` };
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/**
 * Fetch the frame's raw node document (or read cache when offline / fresh).
 * Returns { document, fileVersion, contentHash, fromCache }.
 */
export async function fetchFrame(root, fileKey, nodeId, { offline = false } = {}) {
  const { nodes: nodesPath, meta: metaPath } = cachePaths(root, fileKey, nodeId);

  if (offline) {
    const raw = await fs.readFile(nodesPath, 'utf8').catch(() => {
      throw new Error(`figma-to-code: --offline but no cache at ${nodesPath} — run a fetch first`);
    });
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    return { document: JSON.parse(raw), fileVersion: meta.fileVersion, contentHash: meta.contentHash, fromCache: true };
  }

  const token = await figmaToken();
  const res = await fetch(`${API}/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&geometry=paths`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) {
    throw new Error(`figma-to-code: Figma API ${res.status} for ${fileKey}/${nodeId}: ${(await res.text()).slice(0, 200)}`);
  }
  const body = await res.json();
  const entry = body.nodes?.[nodeId];
  if (!entry?.document) {
    throw new Error(`figma-to-code: node ${nodeId} not in response (deleted, or no access to it)`);
  }

  // Cache the raw document alone (stable input); version/name live in meta.
  const docJson = JSON.stringify(entry.document);
  const meta = {
    fileKey,
    nodeId,
    fileVersion: body.version ?? null,
    fileName: body.name ?? null,
    lastModified: body.lastModified ?? null,
    contentHash: sha256(docJson),
  };
  await fs.mkdir(path.dirname(nodesPath), { recursive: true });
  await fs.writeFile(nodesPath, docJson);
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n');
  return { document: entry.document, fileVersion: meta.fileVersion, contentHash: meta.contentHash, fromCache: false };
}

/** Lightweight file-version probe for watch mode (C6.3) — depth=1 returns pages only, tiny. */
export async function fetchFileVersion(fileKey) {
  const token = await figmaToken();
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) throw new Error(`figma version probe ${res.status}`);
  return (await res.json()).version;
}
