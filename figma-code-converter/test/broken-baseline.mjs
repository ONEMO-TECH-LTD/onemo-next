import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BROKEN_BASELINE_COMMIT = '6c36475f4b4afd04999cf6e110f8cb42c9b3e9a9';

const SOURCES = Object.freeze({
  'ir.mjs': '1fa1557dbfea3b5840d8bff8bcf00c8886359a4eae0987a67139092c8f04ece7',
  'emit.mjs': '9cbeede988245e1ee1a2b2d08ee156ba64434bf446785adfd38a38450ddf7745',
  'reverse.mjs': '185422e02900e1cf9bb03987d78be087c6ebcc9f5b8fa66e1616982d5418062b',
  'conformance.mjs': 'd95bb1aa5fa8e2221d690b71ee27dd7f5e5aa958b7c3690f10cf0ccfe3948ee9',
  'slot-law.mjs': 'a720dea9437ca8b991dc0644e5588dd466f6462c64367e8f2b64cd51e915a7e3',
  'token-defs.mjs': 'ac96391aca6903a0b97f446c0816a0e87dd17393daebb8fb695cd0319c806dca',
});

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const converterRoot = fileURLToPath(new URL('../', import.meta.url));
let loaded;

/**
 * Load the preserved broken converter byte-for-byte from Git history.
 *
 * The source hashes make history rewriting or an accidental baseline change fail loudly. The
 * modules run from a temporary directory, so this proof never mutates or imports current source.
 */
export function loadBrokenBaseline() {
  loaded ??= (async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'f2c-broken-baseline-'));
    for (const [file, expectedHash] of Object.entries(SOURCES)) {
      const source = execFileSync('git', [
        'show', `${BROKEN_BASELINE_COMMIT}:figma-code-converter/src/${file}`,
      ], { cwd: converterRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
      if (expectedHash) assert.equal(sha256(source), expectedHash, `${file} baseline hash drift`);
      await fs.writeFile(path.join(dir, file), source);
    }
    const [ir, emit, reverse] = await Promise.all([
      import(pathToFileURL(path.join(dir, 'ir.mjs')).href),
      import(pathToFileURL(path.join(dir, 'emit.mjs')).href),
      import(pathToFileURL(path.join(dir, 'reverse.mjs')).href),
    ]);
    return { dir, ir, emit, reverse };
  })();
  return loaded;
}

export async function disposeBrokenBaseline() {
  if (!loaded) return;
  const { dir } = await loaded;
  await fs.rm(dir, { recursive: true, force: true });
  loaded = undefined;
}
