/** C1.3 emitter tests — class contract, formatting law, slot law, §3.5/§3.6 pins, golden emission. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildIr } from '../src/ir.mjs';
import { emit, camelClass, ClassNamer, gradientAngle, cssColor } from '../src/emit.mjs';
import { reverseCheck } from '../src/reverse.mjs';
import { minimalBoxShorthand, minimalRadiusShorthand } from '../src/slot-law.mjs';
import { goldenFrameFixture } from './fixtures/golden-frame.mjs';

test('§3.1 class contract: no underscores, digit guard, ordinal uniquing', () => {
  assert.equal(camelClass('Tool_Icon 2x'), 'toolIcon2x');
  assert.equal(camelClass('2d view'), 'el2dView');
  const n = new ClassNamer();
  assert.equal(n.claim('Status bar'), 'statusBar');
  assert.equal(n.claim('Status Bar'), 'statusBar2'); // bare ordinal, never `_2`
  assert.ok(!n.claim('a_b__c').includes('_'));
});

test('slot law (emit direction): minimal 1→2→4 forms, text equality', () => {
  assert.equal(minimalBoxShorthand('4px', '4px', '4px', '4px'), '4px');
  assert.equal(minimalBoxShorthand('var(--a)', '16px', 'var(--a)', '16px'), 'var(--a) 16px');
  assert.equal(minimalBoxShorthand('1px', '2px', '3px', '2px'), '1px 2px 3px');
  assert.equal(minimalRadiusShorthand('8px', '8px', '0', '0'), '8px 8px 0 0');
});

test('gradientAngle: the one shared function — vertical handles → 180deg', () => {
  assert.equal(gradientAngle([{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }]), 180);
  assert.equal(gradientAngle([{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }]), 90);
});

test('cssColor: opaque → hex, alpha → rgba', () => {
  assert.equal(cssColor({ r: 255, g: 255, b: 255, a: 1 }), '#ffffff');
  assert.equal(cssColor({ r: 0, g: 0, b: 0, a: 0.5 }), 'rgba(0, 0, 0, 0.5)');
});

const frame = (over = {}) => ({
  id: '1:1', name: 'Card', type: 'FRAME', layoutMode: 'VERTICAL',
  absoluteBoundingBox: { width: 100, height: 50 }, children: [], ...over,
});

test('formatting law: one decl per line, `prop: value;`, tokens emitted as var()', () => {
  const vmap = new Map([['V:1', { name: 'standard/m', collection: '3.1-Sem-Dim-Fluid', cssVar: '--sem-dim-fluid-standard-m' }]]);
  const { root } = buildIr(frame({
    paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, itemSpacing: 12,
    boundVariables: { paddingLeft: { type: 'VARIABLE_ALIAS', id: 'V:1' }, paddingRight: { type: 'VARIABLE_ALIAS', id: 'V:1' } },
    clipsContent: true,
  }), vmap);
  const { css } = emit(root, 'Card');
  assert.match(css, /^\.card \{$/m);
  assert.match(css, /^  padding: 8px var\(--sem-dim-fluid-standard-m\);$/m); // slot-preserving 2-form
  assert.match(css, /^  gap: 12px;$/m);
  assert.match(css, /^  overflow: hidden;$/m);
  for (const line of css.split('\n')) {
    if (line.startsWith('  ')) assert.match(line, /^  [a-z-]+: .+;$/); // one decl per line
  }
});

test('§3.3: no-autolayout frame emits a real element; child pinned absolute from Figma coords', () => {
  // Dan's bar: structure/geometry always convert — the BG frame is a positioning context, its
  // child gets position:absolute at the real offset. No placeholder, no data-refused.
  const inner = frame({ id: '1:2', name: 'BG', layoutMode: undefined,
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 50 },
    children: [frame({ id: '1:3', absoluteBoundingBox: { x: 5, y: 8, width: 20, height: 20 } })] });
  const { root } = buildIr(frame({ children: [inner] }));
  const { tsx, css } = emit(root, 'Card');
  assert.ok(!/data-refused/.test(tsx), 'no structural refusal — every layer is a real element');
  assert.match(css, /position: relative;/);                       // BG is the containing block
  assert.match(css, /position: absolute;\n  left: 5px;\n  top: 8px;/); // child pinned from coords
});

test('§3.6: heading promotion by token path; button by name', () => {
  const textNode = {
    id: 't1', name: 'Heading', type: 'TEXT', characters: 'Effect',
    style: { fontFamily: 'Chillax', fontStyle: 'Medium', fontSize: 20 },
    boundVariables: { fontSize: { type: 'VARIABLE_ALIAS', id: 'V:T' } },
    absoluteBoundingBox: { width: 60, height: 20 },
  };
  const vmap = new Map([['V:T', { name: 'title/headline/size', collection: '3.3-Sem-Type-Fluid', cssVar: '--sem-type-fluid-title-headline-size' }]]);
  const btn = frame({ id: 'b1', name: 'Add Button', children: [] });
  const { root } = buildIr(frame({ children: [textNode, btn] }), vmap);
  const { tsx } = emit(root, 'Card');
  assert.match(tsx, /<h4 className=\{styles\.heading\}>Effect<\/h4>/);
  assert.match(tsx, /<button className=\{styles\.addButton\}/);
});

test('§3.5 composition: OUTSIDE ring first, then effect shadows (lead caution 1)', () => {
  const { root } = buildIr(frame({
    strokes: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }], strokeAlign: 'OUTSIDE', strokeWeight: 2,
    effects: [{ type: 'DROP_SHADOW', radius: 4, color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 2 } }],
  }));
  const { css } = emit(root, 'Card');
  assert.match(css, /box-shadow: 0 0 0 2px #ff0000, 0 2px 4px rgba\(0, 0, 0, 0\.25\);/);
});

test('HERMETIC GOLDEN REPLACEMENT: emits — css parses and idMap is 1:1', () => {
  const raw = goldenFrameFixture();
  const { root } = buildIr(raw, null);
  const { tsx, css, pageTsx, idMap, notes, componentName, slug } = emit(root, 'Editor 402 iphone - apple blur glass');
  assert.equal(componentName, 'Editor402IphoneAppleBlurGlass');
  assert.equal(slug, 'editor-402-iphone-apple-blur-glass');
  // idMap covers every IR node exactly once
  let irCount = 0; (function w(n) { irCount++; n.children.forEach(w); })(root);
  assert.equal(idMap.length, irCount);
  // class contract: no underscores anywhere
  assert.ok(!/styles\.[a-zA-Z0-9]*_/.test(tsx), 'no underscore classes');
  // Dan's bar: structure/geometry ALWAYS convert — no refused placeholders anywhere. The ex-'BG'
  // no-autolayout frames now emit as real elements whose children pin absolutely from Figma coords.
  assert.ok(!/data-refused/.test(tsx), 'no structural refusals — every layer is a real element');
  assert.match(css, /position: absolute;/); // no-autolayout child geometry → left/top
  // the dial ring styling proves the visual path — INSIDE-on-HUG law: the ring is an INSET
  // box-shadow, never a border (a border inflates the auto-sized 48px dial to 50 — live-hit)
  assert.match(css, /box-shadow: inset 0 0 0 1px #80838d;/);
  assert.ok(!/border: 1px solid #80838d;/.test(css), 'HUG dial must not carry a size-adding border');
  assert.match(css, /border-radius: 9999px;/);
  // Every report entry, if one is added to the fixture later, must stay actionable text.
  assert.ok(notes.every((n) => typeof n.note === 'string'));
  assert.match(pageTsx, /<Editor402IphoneAppleBlurGlass \/>/);
  console.log(`  golden emit: tsx ${tsx.length}B · css ${css.length}B · ${idMap.length} elements · ${notes.length} notes`);
});

test('jsxSafeSvg: kebab attrs camelize (data-/xmlns exempt); style strings → JSX objects', async () => {
  const { jsxSafeSvg } = await import('../src/assets.mjs');
  const out = jsxSafeSvg('<svg xmlns:xlink="x"><path fill-rule="evenodd" data-x="1" style="mix-blend-mode: multiply; stroke-width: 2px"/></svg>');
  assert.match(out, /fillRule="evenodd"/);
  assert.match(out, /data-x="1"/);
  assert.match(out, /xmlns:xlink="x"/);
  assert.match(out, /style=\{\{ mixBlendMode: 'multiply', strokeWidth: '2px' \}\}/);
});

test('F2 (lead C2): reverse round-trip diffs GEOMETRY values — clean passes, mutation caught', async () => {
  // no-autolayout BG → child pins absolute (left/top) + rotation → transform: the geometry the
  // whole C2 change reproduces. Reverse must diff these VALUES, not just structure.
  const inner = { id: '1:2', name: 'BG', type: 'FRAME', layoutMode: undefined,
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 50 },
    children: [{ id: '1:3', name: 'dot', type: 'FRAME', rotation: Math.PI / 6, // 30° in radians
      absoluteBoundingBox: { x: 5, y: 8, width: 20, height: 20 }, children: [] }] };
  const raw = { id: '1:1', name: 'card', type: 'FRAME', layoutMode: 'VERTICAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 50 }, children: [inner] };
  const { root } = buildIr(raw, new Map());
  const out = emit(root, 'Card');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'f2c-rev-'));
  const tsxPath = path.join(dir, 'Card.tsx');
  const cssPath = path.join(dir, 'card.module.css');
  await fs.writeFile(tsxPath, out.tsx);
  await fs.writeFile(cssPath, out.css);
  try {
    const clean = await reverseCheck({ ir: root, tsxPath, cssPath, images: new Map() });
    assert.ok(clean.pass, `clean output must round-trip: ${JSON.stringify(clean.diff)}`);
    // mutate one geometry value on disk → reverse must catch it (value-agnostic: rotated nodes
    // carry solver-derived positions after the C5 true-size fix, so no literal expectations)
    assert.match(out.css, /top: [\d.]+px;/);
    await fs.writeFile(cssPath, out.css.replace(/top: [\d.]+px;/, 'top: 999px;'));
    const bad = await reverseCheck({ ir: root, tsxPath, cssPath, images: new Map() });
    assert.ok(!bad.pass, 'geometry mutation must fail reverse');
    assert.ok(bad.diff.some((d) => /geometry top/.test(d)), `caught geometry: ${JSON.stringify(bad.diff)}`);
    // rotation too (Math.PI/6 → rotate(-30deg) after rad→deg, C3.1)
    assert.ok(out.css.includes('rotate(-30deg)'), `π/6 rad → -30deg: ${out.css.match(/rotate\([^)]+\)/)}`);
    await fs.writeFile(cssPath, out.css.replace('rotate(-30deg)', 'rotate(-42deg)'));
    const badRot = await reverseCheck({ ir: root, tsxPath, cssPath, images: new Map() });
    assert.ok(badRot.diff.some((d) => /geometry transform/.test(d)), `caught transform: ${JSON.stringify(badRot.diff)}`);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('lead C3 F2 guard: check-IR == convert-IR — reverse passes with a fresh hermetic IR', async () => {
  // The class that broke twice (C2 varMap-null, C3 emit-mutated isFlexChild): `check` builds the IR
  // WITHOUT running emit, so the reverse gate must depend ONLY on buildIr-produced fields. This
  // simulates check's exact path: emit from one IR instance, reverse-verify with a fresh one.
  const raw = goldenFrameFixture();
  const { root: convertIr } = buildIr(raw, null);
  const out = emit(convertIr, 'Editor 402 iphone - apple blur glass'); // emit mutates convertIr
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'f2c-parity-'));
  const tsxPath = path.join(dir, 'C.tsx'); const cssPath = path.join(dir, 'c.module.css');
  await fs.writeFile(tsxPath, out.tsx); await fs.writeFile(cssPath, out.css);
  try {
    const { root: checkIr } = buildIr(raw, null); // FRESH — never touched by emit (check's path)
    const rev = await reverseCheck({ ir: checkIr, tsxPath, cssPath, images: new Map() });
    assert.ok(rev.pass, `check-path reverse must pass on pristine output; diff: ${JSON.stringify(rev.diff.slice(0, 5))}`);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('meta-qa C3 closure: background image-fill values are reverse-guarded (crop drift caught)', async () => {
  // imageTransform crop (C3 F1) must be regression-proof: a drifted background-size/position or a
  // deleted background-image must fail reverse. Fixture: node with a cropped STRETCH image fill.
  const node = { id: '1:2', name: 'card', type: 'RECTANGLE',
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    fills: [{ type: 'IMAGE', scaleMode: 'STRETCH', imageRef: 'ref1', imageTransform: [[0.5, 0, 0.25], [0, 0.8, 0.1]] }],
    children: [] };
  const raw = { id: '1:1', name: 'root', type: 'FRAME', layoutMode: 'VERTICAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 }, children: [node] };
  const { root } = buildIr(raw, new Map());
  const images = new Map([['ref1', { file: 'ref1.png' }]]);
  const out = emit(root, 'Card', { images });
  assert.match(out.css, /background-size: 200% 125%;/);            // 1/0.5, 1/0.8
  assert.match(out.css, /background-position: 50% 50%;/);          // .25/.5, .1/.2
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'f2c-imgt-'));
  const tsxPath = path.join(dir, 'C.tsx'); const cssPath = path.join(dir, 'c.module.css');
  await fs.writeFile(tsxPath, out.tsx);
  try {
    await fs.writeFile(cssPath, out.css);
    const { root: freshIr } = buildIr(raw, new Map()); // check's path (buildIr-only)
    const clean = await reverseCheck({ ir: freshIr, tsxPath, cssPath, images });
    assert.ok(clean.pass, `pristine must pass: ${JSON.stringify(clean.diff)}`);
    await fs.writeFile(cssPath, out.css.replace('background-size: 200% 125%;', 'background-size: 100% 100%;'));
    const drift = await reverseCheck({ ir: freshIr, tsxPath, cssPath, images });
    assert.ok(drift.diff.some((d) => /background-size/.test(d)), `crop drift caught: ${JSON.stringify(drift.diff)}`);
    await fs.writeFile(cssPath, out.css.split('\n').filter((l) => !l.includes('background-image')).join('\n'));
    const del = await reverseCheck({ ir: freshIr, tsxPath, cssPath, images });
    assert.ok(del.diff.some((d) => /background-image/.test(d)), `deleted url caught: ${JSON.stringify(del.diff)}`);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('meta-qa C5 closure: GLASS backdrop-filter drift/drop is reverse-guarded (check path)', async () => {
  const raw = { id: '1:1', name: 'F', type: 'FRAME', layoutMode: 'VERTICAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    children: [{ id: '1:2', name: 'glass', type: 'FRAME',
      absoluteBoundingBox: { x: 0, y: 0, width: 80, height: 40 },
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.1 }],
      effects: [{ type: 'GLASS', visible: true }], children: [] }] };
  const { root } = buildIr(raw, new Map());
  const out = emit(root, 'G');
  assert.match(out.css, /backdrop-filter: blur\(8px\);/);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'f2c-glass-'));
  const tsxPath = path.join(dir, 'G.tsx'); const cssPath = path.join(dir, 'g.module.css');
  await fs.writeFile(tsxPath, out.tsx);
  try {
    const { root: freshIr } = buildIr(raw, new Map()); // check's buildIr-only path
    await fs.writeFile(cssPath, out.css);
    assert.ok((await reverseCheck({ ir: freshIr, tsxPath, cssPath, images: new Map() })).pass, 'pristine passes');
    await fs.writeFile(cssPath, out.css.replace('blur(8px)', 'blur(1px)'));
    const drift = await reverseCheck({ ir: freshIr, tsxPath, cssPath, images: new Map() });
    assert.ok(drift.diff.some((d) => /backdrop-filter/.test(d)), `drift caught: ${JSON.stringify(drift.diff)}`);
    await fs.writeFile(cssPath, out.css.split('\n').filter((l) => !l.includes('backdrop-filter')).join('\n'));
    const del = await reverseCheck({ ir: freshIr, tsxPath, cssPath, images: new Map() });
    assert.ok(del.diff.some((d) => /backdrop-filter/.test(d)), `deletion caught: ${JSON.stringify(del.diff)}`);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('meta-qa C2: an unstyled wrapper <div> (no styles className) FAILS canon', async () => {
  const { canonCheck } = await import('../src/canon-check.mjs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'f2c-slop-'));
  const tsxPath = path.join(dir, 'Card.tsx');
  const cssPath = path.join(dir, 'card.module.css');
  const runPath = path.join(dir, 'convert-run.json');
  // one styled element; a bare <div> wrapper is slop invisible to census (not in idMap), reverse
  // (parser skips unclassed tags) and the styled-className count — canon must still catch it.
  const good = `<div className={styles.a}>hi</div>`;
  await fs.writeFile(cssPath, '.a {\n  color: #000;\n}\n');
  await fs.writeFile(runPath, JSON.stringify({ idMap: [{ figmaId: '1', class: 'a' }], absoluteCount: 0 }));
  try {
    await fs.writeFile(tsxPath, good);
    const clean = await canonCheck({ tsxPath, cssPath, runPath });
    assert.ok(clean.pass, `clean should pass: ${JSON.stringify(clean.violations)}`);
    await fs.writeFile(tsxPath, `<div>\n${good}\n</div>`); // bare wrapper
    const bad = await canonCheck({ tsxPath, cssPath, runPath });
    assert.ok(!bad.pass, 'unstyled wrapper must fail canon');
    assert.ok(bad.violations.some((x) => /without className/.test(x.detail)), `caught wrapper: ${JSON.stringify(bad.violations)}`);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

// ── C9 true-mirror laws (Dan: "no mismatch must take place at all" at design size) ──

test('ruler law part 3: zero-extent line box occupies ZERO layout width (negative half-weight margins)', () => {
  // Figma lays a LINE out by its zero-extent bbox; the emitted strokeWeight-wide box must not
  // shift siblings (live-hit: 41 ticks re-inflated the 320px ruler to 402, ticks 10px apart not 8).
  const { root } = buildIr(frame({
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }], // parent styled → no all-vector coalesce
    children: [{
      id: '1:2', name: 'Tick', type: 'VECTOR',
      absoluteBoundingBox: { x: 0, y: 0, width: 0, height: 12 },
      strokes: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }], strokeWeight: 2,
    }],
  }));
  const { css } = emit(root, 'Card');
  assert.match(css, /width: 2px;/);                    // the box is strokeWeight wide…
  assert.match(css, /margin-inline: -1px;/);           // …but contributes zero layout width
});

test('INSIDE-on-HUG law: ring is an inset box-shadow, never a size-adding border', () => {
  // Figma INSIDE strokes paint WITHIN the node; a CSS border on an auto-sized (HUG) node ADDS
  // to the content box (live-hit: 48px dials rendered 50, every ring displaced on the diff).
  const hug = frame({
    layoutSizingHorizontal: 'HUG', layoutSizingVertical: 'HUG',
    strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }], strokeAlign: 'INSIDE', strokeWeight: 1,
  });
  const { css: hugCss } = emit(buildIr(hug).root, 'Card');
  assert.match(hugCss, /box-shadow: inset 0 0 0 1px #0000ff;/);
  assert.ok(!/border: 1px/.test(hugCss), 'no border on HUG');
  // FIXED nodes keep the border (border-box absorbs it — no size change)
  const fixed = frame({
    layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED',
    strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }], strokeAlign: 'INSIDE', strokeWeight: 1,
  });
  const { css: fixedCss } = emit(buildIr(fixed).root, 'Card');
  assert.match(fixedCss, /border: 1px solid #0000ff;/);
});
