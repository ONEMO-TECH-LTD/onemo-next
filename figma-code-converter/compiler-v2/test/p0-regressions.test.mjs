import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildIr } from '../../src/ir.mjs';
import { emit } from '../../src/emit.mjs';
import { BROKEN_BASELINE_COMMIT, disposeBrokenBaseline, loadBrokenBaseline } from '../../test/broken-baseline.mjs';
import { buildCanonicalModel } from '../src/canonical-model.mjs';
import { readSnapshot, writeSnapshot } from '../src/evidence.mjs';
import { buildLayoutRenderPlan } from '../src/layout-render-plan.mjs';
import { p3Fixture } from './p3-fixture.mjs';
import { p4Failures } from './p4-oracle.mjs';

const converterRoot = fileURLToPath(new URL('../../', import.meta.url));
after(disposeBrokenBaseline);
const alias = (id) => ({ type: 'VARIABLE_ALIAS', id });
const vars = new Map([
  ['V_BG', { cssVar: '--bg-app-primary', name: 'bg/app/primary' }],
  ['V_A', { cssVar: '--gradient-a', name: 'gradient/a' }],
  ['V_B', { cssVar: '--gradient-b', name: 'gradient/b' }],
  ['V_EFFECT', { cssVar: '--effect-measure', name: 'effect/measure' }],
  ['V_OPACITY', { cssVar: '--tab-opacity', name: 'tab/opacity' }],
  ['V_STROKE', { cssVar: '--stroke-width', name: 'stroke/width' }],
]);

const frame = (overrides = {}) => ({
  id: 'root', name: 'Shape evidence', type: 'FRAME', layoutMode: 'VERTICAL',
  absoluteBoundingBox: { x: 0, y: 0, width: 320, height: 640 }, children: [],
  ...overrides,
});

function paintFixture() {
  return frame({
    fills: [
      { type: 'IMAGE', imageRef: 'grain', scaleMode: 'FILL' },
      {
        type: 'SOLID', color: { r: 0.9, g: 0.92, b: 0.94, a: 1 },
        boundVariables: { color: alias('V_BG') },
      },
    ],
    // The REST mirror is compacted: one bound paint produces one entry, not a fill-indexed array.
    boundVariables: { fills: [alias('V_BG')] },
    children: [{
      id: 'content', name: 'Content', type: 'FRAME', layoutMode: 'VERTICAL',
      absoluteBoundingBox: { x: 0, y: 0, width: 1, height: 1 }, children: [],
    }],
  });
}

function gradientFixture() {
  return frame({
    fills: [{
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 }, boundVariables: { color: alias('V_A') } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 }, boundVariables: { color: alias('V_B') } },
      ],
      gradientHandlePositions: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    }],
  });
}

function v2RecoveryFixture() {
  const { snapshot } = p3Fixture();
  const root = snapshot.document;
  root.fills = [
    { type: 'IMAGE', imageRef: 'grain', scaleMode: 'FILL' },
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 }, boundVariables: { color: alias('V_COLOR') } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 }, boundVariables: { color: alias('V_COLOR') } },
      ],
      gradientHandlePositions: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    },
    { type: 'SOLID', color: { r: 0.9, g: 0.92, b: 0.94, a: 1 }, boundVariables: { color: alias('V_COLOR') } },
  ];
  root.effects = [{
    type: 'DROP_SHADOW', radius: 8, spread: 2, offset: { x: 0, y: 4 },
    color: { r: 0, g: 0, b: 0, a: 0.3 },
    boundVariables: {
      radius: alias('V_FLOAT'), spread: alias('V_FLOAT'), offsetY: alias('V_FLOAT'), color: alias('V_COLOR'),
    },
  }];
  root.strokes = [{
    type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 },
    boundVariables: { color: alias('V_COLOR') },
  }];
  root.strokeAlign = 'INSIDE';
  root.individualStrokeWeights = { top: 1, right: 2, bottom: 3, left: 4 };
  Object.assign(root.boundVariables, {
    fills: [alias('V_COLOR'), alias('V_COLOR'), alias('V_COLOR')],
    strokes: [alias('V_COLOR')],
    effects: [alias('V_FLOAT')],
    individualStrokeWeights: {
      BORDER_TOP_WEIGHT: alias('V_FLOAT'), BORDER_RIGHT_WEIGHT: alias('V_FLOAT'),
      BORDER_BOTTOM_WEIGHT: alias('V_FLOAT'), BORDER_LEFT_WEIGHT: alias('V_FLOAT'),
    },
  });
  const nested = root.children.find((node) => node.id === 'nested');
  Object.assign(nested, {
    type: 'VECTOR', relativeTransform: [[0, -1, 40], [1, 0, 50]],
    vectorNetwork: { vertices: [], segments: [] },
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.15, b: 0.2, a: 1 }, boundVariables: { color: alias('V_COLOR') } }],
  });
  snapshot.dependencies.assets = [{
    kind: 'image', sourceId: 'grain', file: 'assets/grain.png', sha256: 'a'.repeat(64),
    bytes: 1, mime: 'image/png', width: 320, height: 640,
  }];
  snapshot.manifest.files['assets/grain.png'] = { sha256: 'a'.repeat(64), bytes: 1 };
  return buildCanonicalModel({ snapshot, evidenceClass: 'microfixture', fileKey: 'P0_RECOVERY' });
}

test('P0 E1/E2/E7: preserved baseline bakes carrier-local paints; operating delta fixes binding and invert', async () => {
  const broken = await loadBrokenBaseline();
  const images = new Map([['grain', { file: 'grain.png' }]]);

  const oldPaint = broken.emit.emit(broken.ir.buildIr(paintFixture(), vars).root, 'Shape evidence', { images });
  assert.doesNotMatch(oldPaint.css, /var\(--bg-app-primary\)/, 'E1 baseline must bake the bound solid');
  assert.match(oldPaint.css, /background-blend-mode: difference;/, 'E7 baseline must activate the invert heuristic');

  const newPaint = emit(buildIr(paintFixture(), vars).root, 'Shape evidence', { images });
  assert.match(newPaint.css, /var\(--bg-app-primary\)/, 'carrier-local binding must survive');
  assert.doesNotMatch(newPaint.css, /background-blend-mode: difference;/, 'a token-bound surface must not invert');

  const oldGradient = broken.emit.emit(broken.ir.buildIr(gradientFixture(), vars).root, 'Spec Pill');
  assert.doesNotMatch(oldGradient.css, /var\(--gradient-[ab]\)/, 'E2 baseline must bake both stops');
  const newGradient = emit(buildIr(gradientFixture(), vars).root, 'Spec Pill');
  assert.match(newGradient.css, /var\(--gradient-a\).*var\(--gradient-b\)/, 'stop-local bindings must survive');
});

test('P0 E8: the broken reverse gate passes its own lossy E1 output', async () => {
  const broken = await loadBrokenBaseline();
  const images = new Map([['grain', { file: 'grain.png' }]]);
  const root = broken.ir.buildIr(paintFixture(), vars).root;
  const output = broken.emit.emit(root, 'Shape evidence', { images });
  assert.doesNotMatch(output.css, /var\(--bg-app-primary\)/, 'precondition: output is already lossy');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'f2c-e8-'));
  try {
    const tsxPath = path.join(dir, 'ShapeEvidence.tsx');
    const cssPath = path.join(dir, 'shape-evidence.module.css');
    await fs.writeFile(tsxPath, output.tsx);
    await fs.writeFile(cssPath, output.css);
    const result = await broken.reverse.reverseCheck({ ir: root, tsxPath, cssPath, images });
    assert.equal(result.pass, true, `E8 false green must reproduce: ${JSON.stringify(result.diff)}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('P0 E3/E4/E5: effect, opacity, and per-side bindings are demonstrably absent from legacy IR', async () => {
  const broken = await loadBrokenBaseline();
  const raw = frame({
    opacity: 0.85,
    effects: [{
      type: 'DROP_SHADOW', radius: 8, spread: 2, offset: { x: 0, y: 4 },
      color: { r: 0, g: 0, b: 0, a: 0.3 },
      boundVariables: {
        radius: alias('V_EFFECT'), spread: alias('V_EFFECT'), offsetY: alias('V_EFFECT'), color: alias('V_BG'),
      },
    }],
    strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
    strokeAlign: 'INSIDE',
    individualStrokeWeights: { top: 1, right: 2, bottom: 3, left: 4 },
    boundVariables: {
      opacity: alias('V_OPACITY'),
      individualStrokeWeights: {
        top: alias('V_STROKE'), right: alias('V_STROKE'), bottom: alias('V_STROKE'), left: alias('V_STROKE'),
      },
    },
  });
  for (const build of [broken.ir.buildIr, buildIr]) {
    const root = build(raw, vars).root;
    assert.equal(root.style.opacity, 0.85);
    assert.equal(root.style.effects[0].ref, undefined);
    assert.equal(root.style.strokes.weight.ref, undefined);
    assert.equal(root.style.strokes.weight.top, 1);
  }
  const css = emit(buildIr(raw, vars).root, 'Bound controls').css;
  assert.match(css, /opacity: 0\.85;/);
  assert.match(css, /box-shadow: 0 4px 8px 2px rgba\(0, 0, 0, 0\.3\);/);
  assert.doesNotMatch(css, /var\(--(?:tab-opacity|effect-measure|stroke-width)\)/);
});

test('P0 E6/E10: legacy substitutes scalar rotation and skips root-vector paint bindings', async () => {
  const broken = await loadBrokenBaseline();
  const rotated = frame({ rotation: Math.PI / 2, relativeTransform: [[0, -1, 40], [1, 0, 50]] });
  for (const build of [broken.ir.buildIr, buildIr]) {
    const root = build(rotated, vars).root;
    assert.equal(root.rotation, Math.PI / 2);
    assert.equal(root.relativeTransform, undefined);
  }
  assert.match(emit(buildIr(rotated, vars).root, 'Rail').css, /transform: rotate\(-90deg\);/);

  const vector = {
    id: 'vector-root', name: 'Dock icon', type: 'VECTOR',
    absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, boundVariables: { color: alias('V_BG') } }],
    boundVariables: { fills: [alias('V_BG')] }, children: [],
  };
  assert.equal(broken.ir.buildIr(vector, vars).root.svgTokenColor, undefined);
  assert.equal(buildIr(vector, vars).root.svgTokenColor, undefined);
});

test('P0 E9: legacy paint serialization reverses Figma top-first order', async () => {
  const broken = await loadBrokenBaseline();
  const images = new Map([['grain', { file: 'grain.png' }]]);
  for (const convert of [
    () => broken.emit.emit(broken.ir.buildIr(paintFixture(), vars).root, 'Paint order', { images }),
    () => emit(buildIr(paintFixture(), vars).root, 'Paint order', { images }),
  ]) {
    const line = convert().css.split('\n').find((row) => row.includes('background-image:'));
    assert.ok(line.indexOf('linear-gradient') < line.indexOf("url('./assets/grain.png')"), `E9 reversed order: ${line}`);
  }
});

test('P0 E13: fixed-box vertical alignment is absent on baseline and present on operating delta', async () => {
  const broken = await loadBrokenBaseline();
  const label = {
    id: 'label', name: 'Done label', type: 'TEXT', characters: 'Done',
    absoluteBoundingBox: { x: 0, y: 0, width: 40, height: 16 },
    layoutSizingVertical: 'FIXED',
    style: {
      fontFamily: 'Inter', fontStyle: 'Regular', fontSize: 12, lineHeightPx: 12,
      lineHeightUnit: 'PIXELS', textAlignVertical: 'CENTER', textAutoResize: 'NONE',
    },
  };
  const raw = frame({ children: [label] });
  const oldCss = broken.emit.emit(broken.ir.buildIr(raw, vars).root, 'Pill Done').css;
  const newCss = emit(buildIr(raw, vars).root, 'Pill Done').css;
  assert.doesNotMatch(oldCss, /align-content: center;/);
  assert.match(newCss, /align-content: center;/);
});

test('P0 E11/E12: preserved source contains the non-atomic and unversioned legacy mechanisms', () => {
  const at = (file) => execFileSync('git', [
    'show', `${BROKEN_BASELINE_COMMIT}:figma-code-converter/${file}`,
  ], { cwd: converterRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const server = at('studio/server.mjs');
  const assets = at('src/assets.mjs');
  assert.ok(
    server.indexOf('await fsp.writeFile(path.join(TOOL, `cache/${fileKey}.variables.json`)')
      < server.indexOf("await run('node', [cfg.dsBuildScan"),
    'E11 dump published before token build',
  );
  assert.match(server, /fidelityPair\(parsed, slug\)\.catch\(/, 'E12 fidelity capture was fire-and-forget');
  assert.match(assets, /`\$\{id\.replace\(\/\[:;\]\/g, '-'\)\}\.svg`/, 'E12 SVG cache omitted version identity');
});

test('P0 E1-E6/E9/E10: Compiler v2 owns every binding and preserves paint order plus affine truth', () => {
  const model = v2RecoveryFixture();
  const plan = buildLayoutRenderPlan(model);
  const root = plan.render.nodes.find((row) => row.nodeId === 'root');
  assert.deepEqual(root.fragments.filter((row) => row.role === 'paint').map((row) => row.sourceIndex), [0, 1, 2], 'E9 source order');

  const binding = (propertyPath) => plan.sourceMap.bindings.find((row) => row.sourceNodeId === 'root' && row.sourcePath === propertyPath);
  for (const propertyPath of [
    '/fills/1/stops/0/color', '/fills/1/stops/1/color', '/fills/2/color',
    '/effects/0/radius', '/effects/0/spread', '/effects/0/offsetY', '/effects/0/color',
    '/opacity',
    '/individualStrokeWeights/BORDER_TOP_WEIGHT', '/individualStrokeWeights/BORDER_RIGHT_WEIGHT',
    '/individualStrokeWeights/BORDER_BOTTOM_WEIGHT', '/individualStrokeWeights/BORDER_LEFT_WEIGHT',
  ]) {
    const row = binding(propertyPath);
    assert.ok(row, `${propertyPath} binding conserved`);
    assert.equal(row.ownerKind, 'fragment', `${propertyPath} has fragment ownership`);
    assert.ok(root.fragments.some((fragment) => fragment.fragmentId === row.ownerId && fragment.tokenBindingIds.includes(row.bindingId)));
    const dropped = structuredClone(plan);
    const droppedBinding = dropped.sourceMap.bindings.find((candidate) => candidate.bindingId === row.bindingId);
    const owner = dropped.render.nodes.flatMap((node) => node.fragments).find((fragment) => fragment.fragmentId === droppedBinding.ownerId);
    owner.tokenBindingIds = owner.tokenBindingIds.filter((bindingId) => bindingId !== row.bindingId);
    assert.ok(Object.values(p4Failures(model, dropped)).some(Boolean), `${propertyPath} conservation mutation bites`);
  }

  const nested = plan.layout.nodes.find((row) => row.nodeId === 'nested');
  assert.deepEqual(nested.transform, [[0, -1, 40], [1, 0, 50], [0, 0, 1]], 'E6 exact affine matrix');
  const nestedPaint = plan.sourceMap.bindings.find((row) => row.sourceNodeId === 'nested' && row.sourcePath === '/fills/0/color');
  assert.equal(nestedPaint.ownerKind, 'fragment', 'E10 vector-root binding has an emitted owner');
  assert.ok(plan.render.nodes.find((row) => row.nodeId === 'nested').fragments.some((fragment) => fragment.fragmentId === nestedPaint.ownerId));
  assert.equal(root.fragments.some((fragment) => fragment.payload?.blendMode === 'difference'), false, 'E7 has no synthetic invert operation');
  assert.deepEqual(p4Failures(model, plan), { G6: false, G7: false });

  const wrongMatrix = structuredClone(plan);
  wrongMatrix.layout.nodes.find((row) => row.nodeId === 'nested').transform[0][1] = 1;
  assert.equal(p4Failures(model, wrongMatrix).G6, true, 'E6 affine mutation bites');
  const fakeInvert = structuredClone(plan);
  fakeInvert.render.nodes.find((row) => row.nodeId === 'root').fragments.find((fragment) => fragment.role === 'paint').blendMode = 'DIFFERENCE';
  assert.equal(p4Failures(model, fakeInvert).G7, true, 'E7 synthetic invert mutation bites');

  const reversed = structuredClone(plan);
  const reversedRoot = reversed.render.nodes.find((row) => row.nodeId === 'root');
  const paintIndexes = reversedRoot.fragments.map((fragment, index) => fragment.role === 'paint' ? index : -1).filter((index) => index >= 0);
  [reversedRoot.fragments[paintIndexes[0]], reversedRoot.fragments[paintIndexes[1]]] = [reversedRoot.fragments[paintIndexes[1]], reversedRoot.fragments[paintIndexes[0]]];
  reversedRoot.fragments.forEach((fragment, index) => { fragment.order = index; });
  assert.equal(p4Failures(model, reversed).G7, true, 'E8 independent oracle bites paint-order drift');
});

test('P0 E11/E12: Compiler v2 seals variables, assets, references, and source version as one snapshot', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'cv2-p0-snapshot-'));
  const dir = path.join(base, 'capture');
  const sourcePlanes = Object.fromEntries(
    ['document', 'variables', 'supplement', 'components', 'fonts', 'assets', 'references', 'dependencies']
      .map((name) => [name, 'fixture']),
  );
  try {
    await writeSnapshot(dir, {
      fileKey: 'P0', fileVersion: 'version-42', rootIds: ['root'], captureId: 'p0-e11-e12', sourcePlanes,
      document: frame(), supplement: { schemaVersion: 1, nodes: [] },
      variables: { variables: [], variableCollections: [] }, components: { components: [], componentSets: [] },
      fonts: {}, dependencies: { locks: [] }, assets: new Map([['grain-v42.png', Buffer.from('grain-v42')]]),
      references: [{ state: 'light', file: 'references/shape-v42.png', bytes: Buffer.from('shape-v42') }],
      compilerVersion: 'v2-test', capabilityRegistryVersion: 1,
    });
    const snapshot = await readSnapshot(dir);
    assert.equal(snapshot.manifest.fileVersion, 'version-42');
    assert.ok(snapshot.manifest.files['variables.json']);
    assert.ok(snapshot.manifest.files['assets/grain-v42.png']);
    assert.ok(snapshot.manifest.files['references/shape-v42.png']);

    await fs.writeFile(path.join(dir, 'assets/grain-v42.png'), 'cross-version-grain');
    await assert.rejects(() => readSnapshot(dir), /hash|byte/i, 'cross-version asset substitution must refuse');
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});

test('P0 E13: Compiler v2 carries fixed-box vertical alignment as exact content geometry', () => {
  const { snapshot } = p3Fixture();
  const text = snapshot.document.children.find((node) => node.id === 'text');
  Object.assign(text, {
    layoutSizingVertical: 'FIXED', size: { x: 40, y: 16 },
    style: { textAlignVertical: 'CENTER', textAutoResize: 'NONE', lineHeightPx: 12 },
  });
  const model = buildCanonicalModel({ snapshot, evidenceClass: 'microfixture', fileKey: 'P0_E13' });
  const content = buildLayoutRenderPlan(model).render.nodes
    .find((node) => node.nodeId === 'text').fragments.find((fragment) => fragment.role === 'content');
  assert.deepEqual(content.payload.textLayout, {
    alignVertical: 'CENTER', autoResize: 'NONE', sizingVertical: 'FIXED', lineHeightPx: 12,
  });
});
