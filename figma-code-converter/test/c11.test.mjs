/** C1.1 unit tests — URL parsing, cssVar naming (via the OWNED ds-pipeline fns), staleness guard. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { parseFrameUrl } from '../src/figma-url.mjs';
import { cssVarName, loadVariableMap, StaleDumpError, dumpPath } from '../src/variable-map.mjs';

test('parseFrameUrl: dash node-id form → API colon form', () => {
  const r = parseFrameUrl('https://www.figma.com/design/t88thL8hKksSpILgkeGRZ0/ONEMO-DS-v2.3.1---1-July--?node-id=4084-25997&m=dev');
  assert.deepEqual(r, { fileKey: 't88thL8hKksSpILgkeGRZ0', nodeId: '4084:25997' });
});

test('parseFrameUrl: rejects non-frame URLs loudly', () => {
  assert.throws(() => parseFrameUrl('https://www.figma.com/design/abc123/NoNode'), /node-id/);
});

test('cssVarName: matches the live ds-pipeline naming law (SPEC §1 row 3)', () => {
  // hidden-collection marker stripped: .1.0-Prim-Col / grey/1 → --prim-col-grey-1 (seen live in tokens.tailwind.css)
  assert.equal(cssVarName('.1.0-Prim-Col', 'grey/1'), '--prim-col-grey-1');
  // non-hidden: 3.4-Sem-Border / m → --sem-border-m
  assert.equal(cssVarName('3.4-Sem-Border', 'm'), '--sem-border-m');
  // multi-segment path with internal case: 3.3-Sem-Type-Fluid / title/headline/size
  assert.equal(cssVarName('3.3-Sem-Type-Fluid', 'title/headline/size'), '--sem-type-fluid-title-headline-size');
});

test('loadVariableMap: missing dump → StaleDumpError with instruction', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'f2c-'));
  await assert.rejects(loadVariableMap(tmp, 'NOFILE', '42'), StaleDumpError);
});

test('loadVariableMap: version mismatch REFUSES; match resolves cssVar', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'f2c-'));
  const p = dumpPath(tmp, 'FK');
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify({
    fileKey: 'FK', fileVersion: '100', dumpedWith: 'test',
    variables: { 'VariableID:1/2:3': { name: 'grey/11', collection: '.1.0-Prim-Col' } },
  }));
  await assert.rejects(loadVariableMap(tmp, 'FK', '101'), StaleDumpError); // stale
  const map = await loadVariableMap(tmp, 'FK', '100');                      // fresh
  assert.equal(map.get('VariableID:1/2:3').cssVar, '--prim-col-grey-11');
});
