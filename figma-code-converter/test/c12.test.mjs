/** C1.2 unit tests — one per SPEC mapping rule, plus a committed hermetic structural run. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildIr, fontWeightOf, isVectorish } from '../src/ir.mjs';
import { goldenFrameFixture } from './fixtures/golden-frame.mjs';

const vmap = new Map([
  ['VariableID:1', { name: 'standard/m', collection: '3.1-Sem-Dim-Fluid', cssVar: '--sem-dim-fluid-standard-m' }],
]);
const alias = { type: 'VARIABLE_ALIAS', id: 'VariableID:1' };

const frame = (over = {}) => ({
  id: '1:1', name: 'box', type: 'FRAME', layoutMode: 'VERTICAL',
  absoluteBoundingBox: { width: 100, height: 50 }, children: [], ...over,
});

test('§3.2: SPACE_BETWEEN ignores itemSpacing (no gap emitted)', () => {
  const { root } = buildIr(frame({ itemSpacing: 8, primaryAxisAlignItems: 'SPACE_BETWEEN' }), vmap);
  assert.equal(root.layout.gap, undefined);
});

test('§3.4: bound padding resolves to cssVar; unbound stays raw value', () => {
  const { root } = buildIr(frame({ paddingLeft: 16, paddingTop: 4, boundVariables: { paddingLeft: alias } }), vmap);
  assert.equal(root.layout.padding.left.ref.cssVar, '--sem-dim-fluid-standard-m');
  assert.equal(root.layout.padding.top.ref, undefined);
  assert.equal(root.layout.padding.top.value, 4);
});

test('§3.3: no-autolayout frame → element (NEVER refused); children pinned from Figma coords', () => {
  // Dan: the layer tree IS the DOM tree; a container without auto-layout is a positioning
  // context, its children absolute at their real Figma offsets — not a placeholder hole.
  const inner = frame({ id: '1:2', name: 'legacy', layoutMode: undefined,
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 50 },
    children: [frame({ id: '1:3', absoluteBoundingBox: { x: 10, y: 20, width: 30, height: 30 } })] });
  const { root, refusals } = buildIr(frame({ children: [inner] }), vmap);
  const innerIr = root.children[0];
  assert.equal(innerIr.kind, 'element');                 // structure converts, no placeholder
  assert.equal(innerIr.hasAbsoluteChild, true);          // → position:relative in emit
  assert.deepEqual(innerIr.children[0].absolute, { x: 10, y: 20 }); // Figma coords → left/top
  assert.equal(refusals.some((r) => r.reason === 'no-autolayout'), false); // geometry is math
});

test('§3.5: negative itemSpacing → element with layout (no refusal, no vanish)', () => {
  const inner = frame({ id: '1:2', itemSpacing: -6, children: [frame({ id: '1:3' })] });
  const { root, refusals } = buildIr(frame({ children: [inner] }), vmap);
  assert.equal(root.children[0].kind, 'element');
  assert.equal(root.children[0].layout.gap.value, -6); // carried; emit guards non-positive gap
  assert.equal(refusals.some((r) => r.reason === 'negative-gap'), false);
});

test('§3.5: rotated FRAME → transform, not refused; vector rotation carried too', () => {
  const rot = frame({ id: '1:2', rotation: 12, children: [] });
  const vec = { id: '1:9', name: 'icon', type: 'VECTOR', rotation: 45, absoluteBoundingBox: { width: 10, height: 10 } };
  const { root, refusals } = buildIr(frame({ children: [rot, vec] }), vmap);
  assert.equal(root.children[0].kind, 'element');
  assert.equal(root.children[0].rotation, 12);  // emit → transform: rotate(-12deg)
  assert.equal(root.children[1].kind, 'svg');
  assert.equal(root.children[1].rotation, 45);  // vector rotation carried, not dropped
  assert.equal(refusals.some((r) => r.reason === 'rotated-container'), false);
});

test('§3.5 C5: GLASS effect CONVERTS (backdrop-blur approximation), never refused', () => {
  const { root, refusals } = buildIr(frame({ effects: [{ type: 'GLASS' }, { type: 'DROP_SHADOW', radius: 2, color: { r: 0, g: 0, b: 0, a: 0.5 }, offset: { x: 0, y: 1 } }] }), vmap);
  assert.equal(root.kind, 'element');
  assert.equal(refusals.some((r) => r.reason === 'unknown-effect'), false);
  assert.equal(root.style.effects.length, 2); // GLASS carried + drop shadow
  assert.ok(root.style.effects.some((e) => e.type === 'GLASS'));
});

test('§3.5 C3.2: CENTER stroke converts (no refusal); fills stack splits bottom solid', () => {
  const { root, refusals } = buildIr(frame({
    strokes: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }], strokeAlign: 'CENTER', strokeWeight: 1,
    fills: [
      { type: 'SOLID', color: { r: 1, g: 1, b: 1 } },
      { type: 'GRADIENT_LINEAR', gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0 } }] },
    ],
  }), vmap);
  assert.equal(refusals.some((r) => r.reason === 'center-stroke'), false); // converts → box-shadow ring
  assert.equal(root.style.strokes.align, 'CENTER');
  assert.equal(root.style.strokes.color.r, 255);
  assert.equal(root.style.fills.backgroundColor.color.r, 255); // bottom solid → background-color
  assert.equal(root.style.fills.layers[0].type, 'linear');     // top layer first (CSS order)
});

test('§3.5 C3.2: gradient stroke captured as gradient descriptor (→ border-image), not refused', () => {
  const { root, refusals } = buildIr(frame({
    strokes: [{ type: 'GRADIENT_LINEAR', gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0 } }, { position: 1, color: { r: 0.4, g: 0.4, b: 0.4 } }] }],
    strokeAlign: 'INSIDE', strokeWeight: 10,
  }), vmap);
  assert.equal(refusals.some((r) => r.reason === 'non-solid-stroke'), false);
  assert.equal(root.style.strokes.gradient.type, 'linear');
  assert.equal(root.style.strokes.gradient.stops.length, 2);
  assert.equal(root.style.strokes.weight.all, 10);
});

test('F3.7: font-weight table + italic; unknown style refuses', () => {
  assert.deepEqual(fontWeightOf('SemiBold'), { weight: 600, italic: false });
  assert.deepEqual(fontWeightOf('Light Italic'), { weight: 300, italic: true });
  assert.equal(fontWeightOf('Extra Chunky'), null);
});

test('vector pin: GROUP of vectors is one svg subtree root', () => {
  const g = { id: '2:1', name: 'icon', type: 'GROUP', absoluteBoundingBox: { width: 20, height: 20 },
    children: [{ id: '2:2', type: 'VECTOR', name: 'p' }, { id: '2:3', type: 'BOOLEAN_OPERATION', name: 'b', children: [] }] };
  assert.equal(isVectorish(g), true);
  // wrapper carries its own fill so it stays a real container — a PAINTLESS frame wrapping only
  // vectors is itself an icon and would collapse too (correct), which would hide the group.
  const { root } = buildIr(frame({ fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }], children: [g] }), vmap);
  assert.equal(root.kind, 'element');
  assert.equal(root.children[0].kind, 'svg');
});

test('§3 visibility: invisible nodes are skipped entirely', () => {
  const { root } = buildIr(frame({ children: [frame({ id: '1:2', visible: false })] }), vmap);
  assert.equal(root.children.length, 0);
});

test('HERMETIC GOLDEN REPLACEMENT: full IR builds — structure/geometry always convert', () => {
  const raw = goldenFrameFixture();
  const { root, refusals } = buildIr(raw, null); // no dump yet — refs carry varId, cssVar undefined
  assert.ok(root, 'root builds');
  // count IR nodes + geometry produced (svg roots count as one each; no placeholders exist anymore)
  let count = 0, absCount = 0, rotCount = 0;
  (function walk(n) { count++; if (n.absolute) absCount++; if (n.rotation) rotCount++; n.children.forEach(walk); })(root);
  assert.ok(count > 50, `IR has substance (${count} nodes)`);
  // Dan's bar: structure IS math — no-autolayout and rotation are faithfully reproduced, NEVER refused.
  const structural = refusals.filter((r) => ['no-autolayout', 'rotated-container', 'negative-gap'].includes(r.reason));
  assert.equal(structural.length, 0, `zero structural refusals, got ${JSON.stringify(structural)}`);
  // the ex-'BG' no-autolayout frames now convert: their children pin absolutely from Figma coords
  assert.ok(absCount >= 3, `absolute-positioned children emitted from no-autolayout frames (${absCount})`);
  assert.ok(rotCount >= 1, `rotations carried as transform (${rotCount})`);
  // The fixture contains only supported visible properties; no property-level refusal is legal.
  assert.equal(refusals.filter((r) => r.reason === 'unknown-effect').length, 0);
  assert.equal(refusals.filter((r) => r.reason === 'center-stroke').length, 0);
  console.log(`  golden IR: ${count} nodes, ${absCount} absolute, ${rotCount} rotated, ${refusals.length} refusal records:`,
    Object.entries(refusals.reduce((m, r) => ((m[r.reason] = (m[r.reason] ?? 0) + 1), m), {})));
});

test('TEXT bound-vars: array shape (real Figma) AND scalar shape both resolve', () => {
  const vmap = new Map([['V:T', { name: 'title/headline/size', collection: '3.3-Sem-Type-Fluid', cssVar: '--sem-type-fluid-title-headline-size' }]]);
  const arrText = { id: 't', name: 'H', type: 'TEXT', characters: 'x', style: { fontSize: 20, fontStyle: 'Medium' },
    boundVariables: { fontSize: [{ type: 'VARIABLE_ALIAS', id: 'V:T' }] }, absoluteBoundingBox: { width: 10, height: 10 } };
  const { root } = buildIr({ id: '1', name: 'F', type: 'FRAME', layoutMode: 'VERTICAL', absoluteBoundingBox: { width: 1, height: 1 }, children: [arrText] }, vmap);
  assert.equal(root.children[0].text.fontSize.ref.cssVar, '--sem-type-fluid-title-headline-size');
  assert.equal(root.children[0].text.tokenPath, 'title/headline/size'); // §3.6 heading key resolves
});
