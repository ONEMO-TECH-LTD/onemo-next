/**
 * compiler-v2 · atomic generation publish (Meta R3-6/R3-7).
 *
 * A run builds its complete artifact SET inside a unique staging dir, then:
 *   1. ONE rename promotes staging → generations/<base>-<token>/ (published to disk, NOT yet
 *      referenced by the pointer),
 *   2. ONE rename flips latest.json to reference it.
 * The current generation changes ONLY at step 2's single atomic rename, so a crash at ANY point
 * preserves the current generation IMMEDIATELY (latest.json still names the prior one).
 *
 * On an ordinary exception between steps 1 and 2, the just-promoted (unreferenced) generation and
 * the owned temp pointer are cleaned. A hard crash cannot run that cleanup, so those become debris
 * that `recoverGenerations()` clears idempotently on restart (temp pointers + every generation not
 * named by latest.json). Same-commit concurrent runs never share a path (unique token).
 *
 * Pure fs mechanics — the caller fills the staging dir; this module only publishes/recovers it.
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
const tmpPointerPath = (outDir, token) => path.join(outDir, `.latest-${token}.json`);
const pointerPath = (outDir) => path.join(outDir, 'latest.json');

/**
 * Publish a fully-built staging dir as a new generation and flip the `latest` pointer.
 * @param _injectAfterGen  test-only seam: an async hook run AFTER the generation rename and
 *                         BEFORE the pointer temp write — throws to exercise the exact crash window.
 * @returns { genDir, pointer }
 */
export async function publishGeneration({ outDir, genBase, token, _injectAfterGen }) {
  const staging = stagingDir(outDir, genBase, token);
  if (!await exists(staging)) throw new Error(`publish: staging dir absent (${staging}) — nothing to promote`);
  const genDir = generationDir(outDir, genBase, token);
  await fs.mkdir(path.dirname(genDir), { recursive: true });
  await fs.rm(genDir, { recursive: true, force: true }); // unique token ⇒ no-op in practice
  await fs.rename(staging, genDir); // step 1: atomic set promotion (unreferenced)
  const tmpPointer = tmpPointerPath(outDir, token);
  try {
    if (_injectAfterGen) await _injectAfterGen(); // the real after-generation/before-pointer window
    await fs.writeFile(tmpPointer, JSON.stringify({ generation: path.relative(outDir, genDir), token }, null, 1));
    await fs.rename(tmpPointer, pointerPath(outDir)); // step 2: ONE atomic rename flips the referenced generation
    return { genDir, pointer: pointerPath(outDir) };
  } catch (e) {
    // ordinary exception: latest.json still points at the PRIOR generation (current preserved).
    // Clean the unreferenced generation + our owned temp pointer so no debris is left.
    await fs.rm(genDir, { recursive: true, force: true });
    await fs.rm(tmpPointer, { force: true });
    throw e;
  }
}

/** Clean a run's staging dir (finally path) — never touches generations or the pointer. */
export async function cleanStaging(outDir, genBase, token) {
  await fs.rm(stagingDir(outDir, genBase, token), { recursive: true, force: true });
}

/**
 * Idempotent restart recovery: remove every temp pointer, every staging dir, and every generation
 * NOT named by latest.json. The referenced (current) generation is preserved. Running twice yields
 * the identical state (idempotence). Returns { referenced, removedGenerations, removedTemp }.
 */
export async function recoverGenerations(outDir) {
  let referenced = null;
  try { referenced = JSON.parse(await fs.readFile(pointerPath(outDir), 'utf8')).generation; } catch { /* no pointer yet */ }
  const removedTemp = [], removedGenerations = [];
  for (const f of await fs.readdir(outDir).catch(() => [])) {
    if ((f.startsWith('.latest-') && f.endsWith('.json'))) { await fs.rm(path.join(outDir, f), { force: true }); removedTemp.push(f); }
    else if (f.startsWith('.stage-')) { await fs.rm(path.join(outDir, f), { recursive: true, force: true }); removedTemp.push(f); }
  }
  const gensDir = path.join(outDir, 'generations');
  for (const g of await fs.readdir(gensDir).catch(() => [])) {
    const rel = path.join('generations', g);
    if (rel !== referenced) { await fs.rm(path.join(gensDir, g), { recursive: true, force: true }); removedGenerations.push(rel); }
  }
  return { referenced, removedGenerations, removedTemp };
}

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
