import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureAdapter } from '../src/plugin-capture-adapter.mjs';
import { normalizePluginCapture, PluginCaptureError } from '../src/plugin-capture-normalizer.mjs';
import { auditCaptureAdapterBundle } from '../src/capture-adapter-authority.mjs';
import { runCaptureDiagnostic } from '../src/capture-transaction.mjs';
import { sha256 } from '../src/evidence.mjs';
import { p1PluginCaptureFailures } from './p1-plugin-oracle.mjs';

const FONT_BYTES = Buffer.from('PINNED-INTER-REGULAR');
const IMAGE_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const PLANES = Object.freeze({
  document: 'plugin-primary-complete', supplement: 'plugin-primary-complete',
  variables: 'plugin-primary-complete', components: 'plugin-primary-complete',
  fonts: 'plugin-primary-complete', assets: 'plugin-primary-complete',
  references: 'rest-cross-check', dependencies: 'plugin-primary-complete',
});

function fixture() {
  const rest = {
    id: 'root', type: 'FRAME', name: 'Shape', children: [
      { id: 'set', type: 'COMPONENT_SET', name: 'Choice', children: [{ id: 'choice', type: 'COMPONENT', name: 'Choice/S', children: [] }] },
      { id: 'instance', type: 'INSTANCE', name: 'Choice instance', children: [{ id: 'instance-layer', type: 'RECTANGLE', name: 'Layer', children: [] }] },
      { id: 'text', type: 'TEXT', name: 'Copy', characters: 'Look', children: [] },
      { id: 'photo', type: 'RECTANGLE', name: 'Photo', fills: [{ type: 'IMAGE', imageRef: 'IMG' }], children: [] },
      { id: 'icon', type: 'VECTOR', name: 'Icon', children: [] },
    ],
  };
  const common = (id, type, extra = {}) => ({
    id, type, resolvedVariableModes: { C_THEME: 'light' }, explicitVariableModes: {},
    componentPropertyReferences: null, children: [], ...extra,
  });
  const set = common('set', 'COMPONENT_SET', {
    key: 'SET_CHOICE', name: 'Choice', componentPropertyDefinitions: {
      Size: { type: 'VARIANT', defaultValue: 'S', variantOptions: ['S'] },
    },
  });
  const choice = common('choice', 'COMPONENT', {
    key: 'CMP_CHOICE_S', name: 'Choice/S', parent: set, variantProperties: { Size: 'S' },
    componentPropertyDefinitions: {},
  });
  set.children = [choice];
  const instanceLayer = common('instance-layer', 'RECTANGLE');
  const instance = common('instance', 'INSTANCE', {
    componentProperties: { Size: { type: 'VARIANT', value: 'S' } },
    overrides: [{ id: 'instance-layer', overriddenFields: ['visible'] }],
    children: [instanceLayer], async getMainComponentAsync() { return choice; },
  });
  const text = common('text', 'TEXT', {
    characters: 'Look', getStyledTextSegments() {
      return [{
        start: 0, end: 4, characters: 'Look', fontName: { family: 'Inter', style: 'Regular' },
        fontSize: 16, fontWeight: 400, fontStyle: 'REGULAR', textDecoration: 'NONE',
        lineHeight: { unit: 'PIXELS', value: 20 }, letterSpacing: { unit: 'PIXELS', value: 0 },
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }], textStyleId: '', fillStyleId: '',
        listOptions: { type: 'NONE' }, listSpacing: 0, indentation: 0, paragraphIndent: 0,
        paragraphSpacing: 0, hyperlink: null, openTypeFeatures: {}, boundVariables: {}, textStyleOverrides: [],
      }];
    },
  });
  const photo = common('photo', 'RECTANGLE');
  const icon = common('icon', 'VECTOR', {
    width: 24, height: 24, async exportAsync(settings) {
      assert.equal(settings.format, 'SVG_STRING'); return '<svg xmlns="http://www.w3.org/2000/svg"/>';
    },
  });
  const root = common('root', 'FRAME', {
    name: 'Shape', children: [set, instance, text, photo, icon], async exportAsync(settings) {
      assert.equal(settings.format, 'JSON_REST_V1'); return { document: structuredClone(rest) };
    },
  });
  const nodes = new Map([root, set, choice, instance, instanceLayer, text, photo, icon].map((node) => [node.id, node]));
  const collection = {
    id: 'C_THEME', key: 'CK_THEME', name: 'Theme', remote: false, isExtension: false,
    defaultModeId: 'light', modes: [{ modeId: 'light', name: 'Light' }], variableIds: ['V_INK'], hiddenFromPublishing: false,
  };
  const variable = {
    id: 'V_INK', key: 'K_INK', name: 'text/primary', description: '', remote: false,
    variableCollectionId: 'C_THEME', resolvedType: 'COLOR', valuesByMode: { light: { r: 0, g: 0, b: 0 } },
    scopes: ['ALL_SCOPES'], codeSyntax: { WEB: '--text-primary' }, hiddenFromPublishing: false,
  };
  const listeners = [];
  const figma = {
    fileKey: 'FILE', apiVersion: '1.0.0', editorType: 'figma', currentPage: { id: 'page' },
    root: { documentColorProfile: 'SRGB' },
    async getNodeByIdAsync(id) { return nodes.get(id) ?? null; },
    variables: {
      async getLocalVariablesAsync() { return [variable]; },
      async getVariableByIdAsync(id) { return id === variable.id ? variable : null; },
      async getLocalVariableCollectionsAsync() { return [collection]; },
      async getVariableCollectionByIdAsync(id) { return id === collection.id ? collection : null; },
    },
    getImageByHash(hash) {
      if (hash !== 'IMG') return null;
      return { async getBytesAsync() { return IMAGE_BYTES; }, async getSizeAsync() { return { width: 80, height: 60 }; } };
    },
    on(type, callback) { assert.equal(type, 'documentchange'); listeners.push(callback); },
    off(type, callback) { assert.equal(type, 'documentchange'); assert.equal(listeners.includes(callback), true); listeners.splice(listeners.indexOf(callback), 1); },
  };
  const expectedRoot = {
    fileKey: 'FILE', branchKey: 'main', fileVersion: 'v42', editorType: 'figma',
    currentPageId: 'page', rootIds: ['root'], colorProfile: 'SRGB',
  };
  const fontRegistry = [{
    family: 'Inter', figmaStyle: 'Regular', providerId: 'font-inter-regular', source: 'package',
    path: 'fonts/inter-regular.woff2', licenseId: 'ofl-1.1', format: 'woff2', weight: 400,
    webStyle: 'normal', bytes: FONT_BYTES,
  }];
  const dependencyLocks = [{ provider: 'figma-file', fileKey: 'FILE', key: 'root', version: 'v42' }];
  return { figma, listeners, expectedRoot, fontRegistry, dependencyLocks };
}

async function captureFixture() {
  const value = fixture();
  const adapter = createCaptureAdapter(value.figma);
  adapter.beginObservation();
  const payload = await adapter.captureRoot({ rootId: 'root', assetNodeIds: ['icon'] });
  const documentChangeEvents = adapter.endObservation();
  const pass = normalizePluginCapture({
    payload, expectedRoot: value.expectedRoot, fontRegistry: value.fontRegistry,
    dependencyLocks: value.dependencyLocks, externalDependencies: [], backdropDependencies: [],
  });
  return { ...value, adapter, payload, pass, documentChangeEvents };
}

test('P1 standalone reader captures plugin semantics and host normalizer supplies only separately locked facts', async () => {
  const source = await readFile(new URL('../src/plugin-capture-adapter.mjs', import.meta.url));
  const audit = auditCaptureAdapterBundle({ bundleBytes: source, entryFile: 'plugin-capture-adapter.mjs' });
  assert.deepEqual(audit.forbiddenCalls, []);
  const value = await captureFixture();
  assert.deepEqual(value.documentChangeEvents, []);
  assert.equal(value.payload.plugin.fileKey, 'FILE');
  assert.equal(Object.hasOwn(value.payload, 'fileVersion'), false);
  assert.equal(value.payload.supplement.nodes.length, 8);
  assert.deepEqual(value.pass.sourcePlanes, PLANES);
  assert.equal(value.pass.dependencies.locks[0].version, 'v42');
  assert.equal(value.pass.dependencies.assets.length, 2);
  assert.equal(value.pass.fonts.families[0].web.sha256, sha256(FONT_BYTES));
  assert.equal(value.pass.supplement.nodes.find((row) => row.nodeId === 'instance').mainComponentKey, 'CMP_CHOICE_S');
  value.adapter.beginObservation();
  assert.deepEqual(value.adapter.endObservation(), []); // observation windows never inherit prior events
  const rangeImage = structuredClone(value.payload);
  delete rangeImage.document.children.find((row) => row.id === 'photo').fills;
  rangeImage.supplement.nodes.find((row) => row.nodeId === 'text').styledTextSegments[0].fills = [{ type: 'IMAGE', imageHash: 'IMG' }];
  assert.doesNotThrow(() => normalizePluginCapture({
    payload: rangeImage, expectedRoot: value.expectedRoot, fontRegistry: value.fontRegistry,
    dependencyLocks: value.dependencyLocks, externalDependencies: [], backdropDependencies: [],
  }));
  assert.deepEqual(p1PluginCaptureFailures({
    payload: value.payload, pass: value.pass, expectedRoot: value.expectedRoot, fontRegistry: value.fontRegistry,
  }), []);
});

test('P1 normalized plugin pass is accepted by the existing three-pass capture transaction', async () => {
  const value = await captureFixture();
  const txAdapter = {
    async readRoot() { return { identity: structuredClone(value.expectedRoot), requests: [] }; },
    async capturePass() { return { value: value.pass, requests: [] }; },
    async captureReference() { throw new Error('no references declared'); },
    async readAudit() {
      return { adapterKind: 'dedicated-read-only-plugin', bundleHash: 'a'.repeat(64), staticAuditHash: 'b'.repeat(64), forbiddenCalls: [], dynamicAccess: false, documentChangeEvents: [] };
    },
  };
  const result = await runCaptureDiagnostic({
    trialId: 'p1-plugin-fixture', corpusClass: 'local-only', fileKey: 'FILE', rootIds: ['root'],
    referenceDeclarations: [], adapter: txAdapter, signal: new AbortController().signal,
    readPersistentStateHash: async () => 'c'.repeat(64),
  });
  assert.equal(result.report.state, 'DIAGNOSTIC_ONLY');
  assert.equal(result.candidate.document.id, 'root');
});

test('P1 reader observer records source mutation and normalizer refuses fabricated or incomplete capture facts', async () => {
  const observed = fixture();
  const observer = createCaptureAdapter(observed.figma);
  observer.beginObservation();
  observed.listeners[0]({ documentChanges: [{ type: 'PROPERTY_CHANGE', id: 'text' }] });
  assert.deepEqual(observer.endObservation(), [{ count: 1 }]);

  const base = await captureFixture();
  const mutations = [
    ['multi-root authority', ({ expectedRoot }) => { expectedRoot.rootIds.push('other'); }],
    ['plugin file identity', ({ payload }) => { payload.plugin.fileKey = 'OTHER'; }],
    ['fabricated version plane', ({ payload }) => { payload.fileVersion = 'v42'; }],
    ['document root mismatch', ({ payload }) => { payload.document.id = 'other'; }],
    ['missing supplement row', ({ payload }) => { payload.supplement.nodes.pop(); }],
    ['node type drift', ({ payload }) => { payload.supplement.nodes[0].nodeType = 'ELLIPSE'; }],
    ['missing image bytes', ({ payload }) => { payload.images = []; }],
    ['extra image bytes', ({ payload }) => { payload.images.push({ sourceId: 'EXTRA', bytes: [1], width: 1, height: 1 }); }],
    ['missing web font authority', ({ fontRegistry }) => { fontRegistry.splice(0); }],
    ['conflicting component key', ({ payload }) => { payload.componentCatalog.push({ ...payload.componentCatalog[0], id: 'other' }); }],
    ['missing variable collection', ({ payload }) => { payload.variableCollections = []; }],
    ['node mode collection missing', ({ payload }) => { payload.supplement.nodes[0].resolvedVariableModes.C_REMOTE = 'mode'; }],
    ['duplicate variable stable key', ({ payload }) => { payload.variables.push({ ...payload.variables[0], id: 'V_OTHER' }); }],
    ['duplicate collection mode', ({ payload }) => { payload.variableCollections[0].modes.push({ ...payload.variableCollections[0].modes[0] }); }],
    ['variable carries undeclared mode', ({ payload }) => { payload.variables[0].valuesByMode.extra = { r: 1, g: 1, b: 1 }; }],
    ['invalid styled range coverage', ({ payload }) => { payload.supplement.nodes.find((row) => row.nodeId === 'text').styledTextSegments[0].end = 3; }],
    ['variant component loses its set', ({ payload }) => { delete payload.componentCatalog.find((row) => row.kind === 'component').componentSetKey; }],
    ['font path collides with captured asset', ({ payload, fontRegistry }) => { fontRegistry[0].path = `assets/images/${sha256('IMG').slice(0, 24)}.png`; }],
    ['unversioned root lock', ({ dependencyLocks }) => { delete dependencyLocks[0].version; }],
  ];
  for (const [name, mutate] of mutations) {
    const value = {
      payload: structuredClone(base.payload), expectedRoot: structuredClone(base.expectedRoot),
      fontRegistry: base.fontRegistry.map((row) => ({ ...row, bytes: Buffer.from(row.bytes) })),
      dependencyLocks: structuredClone(base.dependencyLocks), externalDependencies: [], backdropDependencies: [],
    };
    mutate(value);
    assert.throws(() => normalizePluginCapture(value), PluginCaptureError, name);
  }
});

test('independent P1 plugin oracle bites payload/pass identity, byte, and provenance substitutions', async () => {
  const base = await captureFixture();
  const attacks = [
    ({ pass }) => { pass.sourcePlanes.supplement = 'rest-only'; },
    ({ pass }) => { pass.document.name = 'forged'; },
    ({ pass }) => { pass.dependencies.assets[0].sha256 = '0'.repeat(64); },
    ({ pass }) => { pass.supplement.nodes.find((row) => row.nodeId === 'text').fontDependencies[0].sha256 = '0'.repeat(64); },
    ({ pass }) => { pass.variables.variables[0].key = 'FORGED'; },
    ({ pass }) => { pass.components.components[0].key = 'FORGED'; },
    ({ payload }) => { payload.plugin.currentPageId = 'other'; },
  ];
  for (const mutate of attacks) {
    const value = { payload: structuredClone(base.payload), pass: structuredClone(base.pass), expectedRoot: structuredClone(base.expectedRoot), fontRegistry: base.fontRegistry };
    mutate(value);
    assert.notDeepEqual(p1PluginCaptureFailures(value), []);
  }
});
