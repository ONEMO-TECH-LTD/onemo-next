/** C4.3 — token value-parity layer: Figma raw vs token-resolved at frame width (KAI-9344). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildConformance } from '../src/conformance.mjs';

const mkFixture = async (tokenValue) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'f2c-par-'));
  // raw doc: frame 400 wide, one auto-layout row with itemSpacing 24 bound to a token
  const rawDoc = {
    id: '1:1', name: 'F', type: 'FRAME', layoutMode: 'VERTICAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 100 },
    children: [{ id: '1:2', name: 'row', type: 'FRAME', layoutMode: 'HORIZONTAL', itemSpacing: 24,
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 50 }, children: [] }],
  };
  await fs.writeFile(path.join(dir, 'raw.json'), JSON.stringify(rawDoc));
  await fs.writeFile(path.join(dir, 'c.module.css'), '.f {\n  width: 400px;\n}\n\n.row {\n  gap: var(--gap-xl);\n}\n');
  await fs.writeFile(path.join(dir, 'run.json'), JSON.stringify({
    fileKey: 'k', nodeId: '1:1', fileVersion: 'v', refusals: [], notes: [],
    idMap: [{ figmaId: '1:1', class: 'f' }, { figmaId: '1:2', class: 'row' }],
  }));
  await fs.writeFile(path.join(dir, 'tokens.css'), `:root {\n  --gap-xl: ${tokenValue};\n}\n`);
  return dir;
};

const run = (dir) => buildConformance({
  cssPath: path.join(dir, 'c.module.css'), runPath: path.join(dir, 'run.json'),
  tokensCssPath: path.join(dir, 'tokens.css'), rawNodesPath: path.join(dir, 'raw.json'),
  mdPath: path.join(dir, 'CONFORMANCE.md'), jsonPath: path.join(dir, 'conformance.json'),
});

test('C4.3: matching token (clamp resolves to the Figma value at frame width) → no parity rows', async () => {
  // clamp middle at W=400: 1rem + 2cqi = 16 + 8 = 24 → matches Figma itemSpacing 24
  const dir = await mkFixture('clamp(1rem, 1rem + 2cqi, 2rem)');
  try {
    const rep = await run(dir);
    assert.equal(rep.valueParity.length, 0, JSON.stringify(rep.valueParity));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('C4.3: DRIFTED token (resolves 32, Figma says 24) → parity row with both values', async () => {
  const dir = await mkFixture('2rem'); // 32px ≠ 24
  try {
    const rep = await run(dir);
    assert.equal(rep.valueParity.length, 1, JSON.stringify(rep.valueParity));
    const p = rep.valueParity[0];
    assert.equal(p.prop, 'gap');
    assert.equal(p.token, '--gap-xl');
    assert.equal(p.figma, 24);
    assert.equal(p.resolved, 32);
    const md = await fs.readFile(path.join(dir, 'CONFORMANCE.md'), 'utf8');
    assert.match(md, /TOKEN VALUE PARITY.*⚠️|\*\*1\*\* ⚠️/s);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
