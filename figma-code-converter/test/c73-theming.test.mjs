/** C7.3 theming lock (KAI-9371) — the emit contract behind the live theming assertion:
 *  a single-token icon subtree rewrites its baked hex to currentColor and carries the token on
 *  the class (so a theme flip re-colours it); a multi-token subtree stays baked + ledgered. This
 *  guards the token link the pixel-fidelity gate cannot see. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIr } from '../src/ir.mjs';
import { emit } from '../src/emit.mjs';

const frame = (over = {}) => ({
  id: '1:1', name: 'Card', type: 'FRAME', layoutMode: 'VERTICAL',
  // a fill keeps the Card a real container (not itself vectorish) so only the icon coalesces —
  // mirrors real icons nested inside styled dials.
  fills: [{ type: 'SOLID', visible: true, color: { r: 1, g: 1, b: 1 } }],
  absoluteBoundingBox: { width: 100, height: 50 }, children: [], ...over,
});
const vec = (id, color, varId) => ({
  id, name: `V${id}`, type: 'VECTOR', absoluteBoundingBox: { width: 20, height: 20 },
  fills: [{ type: 'SOLID', visible: true, color }],
  boundVariables: { fills: [{ type: 'VARIABLE_ALIAS', id: varId }] },
});

test('C7.3: single-token icon → currentColor body + class color var (LIVE, not baked)', () => {
  const vmap = new Map([['V:C', { name: 'icon/default', collection: '3.2-Sem-Col', cssVar: '--sem-col-icon-default' }]]);
  const icon = { id: 'ic1', name: 'Icon', type: 'FRAME', absoluteBoundingBox: { width: 20, height: 20 },
    children: [vec('v1', { r: 0.5, g: 0.5, b: 0.5 }, 'V:C')] };
  const { root } = buildIr(frame({ children: [icon] }), vmap);
  const assets = new Map([['ic1', '<svg viewBox="0 0 20 20"><path fill="#808080" d="M0 0h20v20H0z"/></svg>']]);
  const { tsx, css, notes } = emit(root, 'Card', { assets });
  assert.match(tsx, /fill="currentColor"/, 'baked hex rewritten to currentColor');
  assert.ok(!/fill="#808080"/i.test(tsx), 'no baked hex left on the token-aware icon');
  assert.match(css, /color: var\(--sem-col-icon-default\)/, 'class carries the token');
  assert.equal(notes.filter((n) => n.kind === 'approximation').length, 0, 'live token link → not ledgered');
});

test('C7.3 negative: multi-token icon stays baked + ledgered (no false currentColor)', () => {
  const vmap = new Map([
    ['V:A', { name: 'a', collection: 'c', cssVar: '--sem-col-a' }],
    ['V:B', { name: 'b', collection: 'c', cssVar: '--sem-col-b' }],
  ]);
  const icon = { id: 'ic2', name: 'Icon', type: 'FRAME', absoluteBoundingBox: { width: 20, height: 20 },
    children: [vec('va', { r: 1, g: 0, b: 0 }, 'V:A'), vec('vb', { r: 0, g: 0, b: 1 }, 'V:B')] };
  const { root } = buildIr(frame({ children: [icon] }), vmap);
  const assets = new Map([['ic2', '<svg><path fill="#ff0000" d="M0 0h1v1H0z"/><path fill="#0000ff" d="M0 0h1v1H0z"/></svg>']]);
  const { tsx, notes } = emit(root, 'Card', { assets });
  assert.ok(!/currentColor/.test(tsx), 'multi-token svg not rewritten (would be wrong)');
  assert.ok(notes.some((n) => n.kind === 'approximation'), 'multi-token svg is ledgered as baked');
});
