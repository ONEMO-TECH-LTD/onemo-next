/**
 * compiler-v2 · atomic generation publish (Meta R3-6: 4× mv is not atomic set promotion).
 *
 * A run builds its complete artifact SET inside a unique staging dir, then publishes with ONE
 * atomic rename into a versioned generation dir, then flips a pointer with ONE atomic rename.
 * A crash at any point leaves the prior generation and pointer byte-identical, no debris, and
 * same-commit concurrent runs never share a path (unique run id in the staging + gen names).
 *
 * Pure fs mechanics — the caller fills the staging dir; this module only publishes it.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** A unique run token: pid + a caller-supplied monotonic stamp (calibrate passes Date.now()). */
export const runToken = (stamp) => `${process.pid}-${stamp}`;

export function stagingDir(outDir, genBase, token) {
  return path.join(outDir, `.stage-${genBase}-${token}`);
}
export function generationDir(outDir, genBase, token) {
  return path.join(outDir, 'generations', `${genBase}-${token}`);
}

/**
 * Publish a fully-built staging dir as a new generation and flip the `latest` pointer.
 * ONE rename promotes the whole set; ONE rename flips the pointer. Returns { genDir, pointer }.
 * Throws if staging is absent (nothing built) — the caller's prior generation stays intact.
 */
export async function publishGeneration({ outDir, genBase, token }) {
  const staging = stagingDir(outDir, genBase, token);
  if (!await exists(staging)) throw new Error(`publish: staging dir absent (${staging}) — nothing to promote`);
  const genDir = generationDir(outDir, genBase, token);
  await fs.mkdir(path.dirname(genDir), { recursive: true });
  await fs.rm(genDir, { recursive: true, force: true }); // a same-token retry; unique token makes this a no-op in practice
  await fs.rename(staging, genDir); // ATOMIC set promotion — one rename, no mid-point

  // pointer flip: write to a temp then ONE rename over the pointer (atomic; a crash keeps the old target)
  const pointer = path.join(outDir, 'latest.json');
  const tmpPointer = path.join(outDir, `.latest-${token}.json`);
  await fs.writeFile(tmpPointer, JSON.stringify({ generation: path.relative(outDir, genDir), token }, null, 1));
  await fs.rename(tmpPointer, pointer);
  return { genDir, pointer };
}

/** Clean a run's staging dir (finally path) — never touches generations or the pointer. */
export async function cleanStaging(outDir, genBase, token) {
  await fs.rm(stagingDir(outDir, genBase, token), { recursive: true, force: true });
}

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
