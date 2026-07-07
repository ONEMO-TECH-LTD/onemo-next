/** C7.1 mask discipline (KAI-9369) — only pixel-visible approximations mask the fidelity gate;
 *  visual:false notes (baked svg bindings) never mask, so icon regions can't hide regressions. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { writeGatePage } from '../audit/fidelity-gate.mjs';

async function gateFixture(notes, glassBox = { x: 10, y: 20, width: 50, height: 40 }) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'c71-'));
  const raw = {
    id: '1:0', absoluteBoundingBox: { x: 0, y: 0, width: 402, height: 871 },
    children: [
      { id: '1:1', absoluteBoundingBox: glassBox, children: [] },
      { id: '1:2', absoluteBoundingBox: { x: 100, y: 200, width: 20, height: 20 }, children: [] },
    ],
  };
  const nodesPath = path.join(dir, 'nodes.json');
  await fs.writeFile(nodesPath, JSON.stringify(raw));
  await fs.writeFile(path.join(dir, 'convert-run.json'), JSON.stringify({ notes }));
  const png = path.join(dir, 'x.png');
  await fs.writeFile(png, 'png'); // copied verbatim; content irrelevant to mask math
  return { out: writeGatePage({ outDir: dir, figmaPng: png, convPng: png, nodesPath }), dir };
}

test('C7.1 — visual:false approximations do NOT mask; pixel-visible ones do', async () => {
  const { out } = await gateFixture([
    { nodeId: '1:1', kind: 'approximation', note: 'GLASS effect → backdrop-filter' },        // pixel-visible → masks
    { nodeId: '1:2', kind: 'approximation', visual: false, note: 'svg coalescing baked 3' }, // semantic-only → must not
  ]);
  const region = out.masks.filter((m) => !m.badge);
  assert.equal(region.length, 1, 'exactly the pixel-visible note masks');
  assert.equal(region[0].w, 100); // 50 × scale 2
  assert.equal(region[0].h, 80);
});

test('C7.1 — mask-area cap: >8% of frame is computed and reported', async () => {
  const { out } = await gateFixture(
    [{ nodeId: '1:1', kind: 'approximation', note: 'GLASS' }],
    { x: 0, y: 0, width: 402, height: 100 }, // 100/871 ≈ 11.5% of the frame
  );
  assert.ok(out.maskedPct > 8, `maskedPct ${out.maskedPct} must exceed the 8% cap`);
});
