/** P2 graph/schema laws and independent G1/G4/G5 mutation proof. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentGraph, DocumentGraphError } from '../src/document-graph.mjs';
import { buildComponentGraph, ComponentGraphError } from '../src/component-graph.mjs';
import { buildTextGraph, TextGraphError } from '../src/text-graph.mjs';
import { buildAssetGraph, AssetGraphError } from '../src/asset-graph.mjs';
import { buildCanonicalModel, parseCanonicalModel, CanonicalModelError } from '../src/canonical-model.mjs';
import { schemaError, SCHEMA } from '../src/schema.mjs';
import { buildIr } from '../../src/ir.mjs';
import { documentMismatch, componentMismatch, textMismatch, assetMismatch, lossyLegacyFailures } from './p2-oracle.mjs';

const planes = (value = 'fixture') => Object.fromEntries(['document', 'supplement', 'variables', 'components', 'fonts', 'assets', 'dependencies'].map((key) => [key, value]));

function fixture() {
  const document = {
    id: 'root', type: 'FRAME', name: 'Fixture', blendMode: 'PASS_THROUGH', clipsContent: true, opacity: 0.85,
    boundVariables: { opacity: { type: 'VARIABLE_ALIAS', id: 'V:op' } },
    children: [
      { id: 'set', type: 'COMPONENT_SET', name: 'Button', children: [] },
      { id: 'instance', type: 'INSTANCE', name: 'Button instance', children: [] },
      { id: 'text', type: 'TEXT', name: 'Copy', characters: 'Hi 👗', children: [] },
      { id: 'photo', type: 'RECTANGLE', fills: [{ type: 'IMAGE', imageRef: 'img-ref', scaleMode: 'FILL' }], children: [] },
      { id: 'icon', type: 'VECTOR', name: 'Icon', children: [] },
    ],
  };
  const components = {
    componentSets: [{ id: 'set', key: 'SET_BUTTON', name: 'Button', complete: true, propertyDefinitions: { Size: { type: 'VARIANT', defaultValue: 'S', variantOptions: ['S', 'L'] } } }],
    components: [{ id: 'button-s', key: 'CMP_BUTTON_S', name: 'Button/S', componentSetKey: 'SET_BUTTON', complete: true, propertyDefinitions: { Disabled: { type: 'BOOLEAN', defaultValue: false } } }],
  };
  const supplement = { schemaVersion: 1, nodes: [
    { nodeId: 'root', resolvedVariableModes: {} },
    { nodeId: 'set', resolvedVariableModes: {}, componentPropertyDefinitions: components.componentSets[0].propertyDefinitions },
    { nodeId: 'instance', resolvedVariableModes: {}, mainComponentKey: 'CMP_BUTTON_S', componentProperties: { Size: { type: 'VARIANT', value: 'S' }, Disabled: { type: 'BOOLEAN', value: false } }, componentPropertyReferences: {}, overrides: [{ id: 'text', overriddenFields: ['characters'] }] },
    { nodeId: 'text', resolvedVariableModes: {}, styledTextSegments: [
      { start: 0, end: 3, characters: 'Hi ', fontName: { family: 'Inter', style: 'Regular' } },
      { start: 3, end: 5, characters: '👗', fontName: { family: 'Inter', style: 'Bold' }, hyperlink: { type: 'URL', value: 'https://example.test' } },
    ], fontDependencies: [
      { family: 'Inter', style: 'Regular', providerId: 'font-inter-regular', sha256: '1'.repeat(64) },
      { family: 'Inter', style: 'Bold', providerId: 'font-inter-bold', sha256: '2'.repeat(64) },
    ] },
    { nodeId: 'photo', resolvedVariableModes: {} },
    { nodeId: 'icon', resolvedVariableModes: {} },
  ] };
  const assetIndex = [
    { kind: 'image', sourceId: 'img-ref', file: 'assets/photo.png', sha256: 'a'.repeat(64), bytes: 10, mime: 'image/png', width: 100, height: 80 },
    { kind: 'svg', sourceId: 'icon', file: 'assets/icon.svg', sha256: 'b'.repeat(64), bytes: 20, mime: 'image/svg+xml', width: 24, height: 24 },
  ];
  const sealedFiles = Object.fromEntries(assetIndex.map((row) => [row.file, { sha256: row.sha256, bytes: row.bytes }]));
  const variables = {
    variables: [{ id: 'V:op', key: 'K_OPACITY', name: 'opacity/card', variableCollectionId: 'C_THEME', resolvedType: 'FLOAT', valuesByMode: { light: 85 } }],
    variableCollections: [{ id: 'C_THEME', key: 'CK_THEME', name: 'Theme', modes: [{ modeId: 'light', name: 'Light' }], defaultModeId: 'light' }],
  };
  return { document, components, supplement, assetIndex, sealedFiles, variables };
}

test('DocumentGraph preserves every source property, relation, z-order, and refuses duplicate ids', () => {
  const { document } = fixture();
  const graph = buildDocumentGraph({ document, sourcePlanes: planes(), evidenceClass: 'microfixture' });
  assert.equal(graph.schemaVersion, SCHEMA.documentGraph);
  assert.equal(documentMismatch(document, graph), false);
  const lossy = structuredClone(graph); delete lossy.nodes.find((row) => row.id === 'root').properties.blendMode;
  assert.equal(documentMismatch(document, lossy), true); // G1 mutation bites
  const duplicate = structuredClone(document); duplicate.children.push({ id: 'text', type: 'TEXT', characters: '', children: [] });
  assert.throws(() => buildDocumentGraph({ document: duplicate, sourcePlanes: planes(), evidenceClass: 'microfixture' }), DocumentGraphError);
});

test('ComponentGraph preserves complete definitions, typed instance props/references/overrides; flattening fails G4', () => {
  const { document, components, supplement } = fixture();
  const graph = buildComponentGraph({ document, components, supplement, sourcePlanes: planes(), evidenceClass: 'microfixture' });
  assert.equal(graph.schemaVersion, SCHEMA.componentGraph);
  assert.equal(componentMismatch(components, supplement, graph), false);
  const flattened = structuredClone(graph); flattened.instances = [];
  assert.equal(componentMismatch(components, supplement, flattened), true);
  const missing = structuredClone(components); missing.components = [];
  assert.throws(() => buildComponentGraph({ document, components: missing, supplement, sourcePlanes: planes(), evidenceClass: 'microfixture' }), (error) => error instanceof ComponentGraphError && error.state === 'FAILED_COMPONENT');
  const invalidOption = structuredClone(supplement); invalidOption.nodes.find((row) => row.nodeId === 'instance').componentProperties.Size.value = 'XL';
  assert.throws(() => buildComponentGraph({ document, components, supplement: invalidOption, sourcePlanes: planes(), evidenceClass: 'microfixture' }), ComponentGraphError);
  const noProps = structuredClone(components); noProps.components.push({ id: 'plain', key: 'CMP_PLAIN', name: 'Plain', complete: true });
  const normalized = buildComponentGraph({ document, components: noProps, supplement, sourcePlanes: planes(), evidenceClass: 'microfixture' });
  assert.deepEqual(normalized.definitions.find((row) => row.key === 'CMP_PLAIN').propertyDefinitions, {});
});

test('TextGraph preserves UTF-16 ranges, characters, links/styles/fonts; coalescing unequal ranges fails G5', () => {
  const { document, supplement } = fixture();
  const graph = buildTextGraph({ document, supplement, sourcePlanes: planes(), evidenceClass: 'microfixture' });
  assert.equal(graph.schemaVersion, SCHEMA.textGraph);
  assert.equal(textMismatch(document, supplement, graph), false);
  const merged = structuredClone(graph); merged.textNodes[0].segments = [{ start: 0, end: 5, characters: 'Hi 👗' }];
  assert.equal(textMismatch(document, supplement, merged), true);
  const broken = structuredClone(supplement); broken.nodes.find((row) => row.nodeId === 'text').styledTextSegments[1].end = 4;
  assert.throws(() => buildTextGraph({ document, supplement: broken, sourcePlanes: planes(), evidenceClass: 'microfixture' }), TextGraphError);
  const missingFont = structuredClone(supplement); missingFont.nodes.find((row) => row.nodeId === 'text').fontDependencies.pop();
  assert.throws(() => buildTextGraph({ document, supplement: missingFont, sourcePlanes: planes(), evidenceClass: 'microfixture' }), TextGraphError);
});

test('AssetGraph preserves source identity/hash/geometry and refuses missing or stale mappings', () => {
  const { document, assetIndex, sealedFiles } = fixture();
  const graph = buildAssetGraph({ document, assetIndex, assetNodeIds: ['icon'], sealedFiles, sourcePlanes: planes(), evidenceClass: 'microfixture' });
  assert.equal(graph.schemaVersion, SCHEMA.assetGraph);
  assert.equal(assetMismatch(assetIndex, graph), false);
  const stale = structuredClone(assetIndex); stale[0].sha256 = 'bad';
  assert.throws(() => buildAssetGraph({ document, assetIndex: stale, assetNodeIds: ['icon'], sealedFiles, sourcePlanes: planes(), evidenceClass: 'microfixture' }), AssetGraphError);
  assert.throws(() => buildAssetGraph({ document, assetIndex: assetIndex.slice(1), assetNodeIds: ['icon'], sealedFiles, sourcePlanes: planes(), evidenceClass: 'microfixture' }), AssetGraphError);
  const mismatchedSeal = structuredClone(sealedFiles); mismatchedSeal['assets/photo.png'].sha256 = 'c'.repeat(64);
  assert.throws(() => buildAssetGraph({ document, assetIndex, assetNodeIds: ['icon'], sealedFiles: mismatchedSeal, sourcePlanes: planes(), evidenceClass: 'microfixture' }), AssetGraphError);
  const forgedExport = [...assetIndex, { kind: 'export', sourceId: 'forged-node', file: 'assets/forged.png', sha256: 'c'.repeat(64), bytes: 1, mime: 'image/png', width: 1, height: 1 }];
  const exportSeal = { ...sealedFiles, 'assets/forged.png': { sha256: 'c'.repeat(64), bytes: 1 } };
  assert.throws(() => buildAssetGraph({ document, assetIndex: forgedExport, assetNodeIds: ['icon'], sealedFiles: exportSeal, sourcePlanes: planes(), evidenceClass: 'microfixture' }), AssetGraphError);
});

test('all P2 semantic graphs fail before construction on REST_ONLY/PARTIAL provenance and refuse unknown graph schemas', () => {
  const { document, components, supplement, assetIndex, sealedFiles } = fixture();
  const bad = planes('plugin-primary-complete'); bad.supplement = 'rest-only';
  assert.throws(() => buildComponentGraph({ document, components, supplement, sourcePlanes: bad, evidenceClass: 'integration' }), ComponentGraphError);
  assert.throws(() => buildTextGraph({ document, supplement, sourcePlanes: bad, evidenceClass: 'integration' }), TextGraphError);
  const badAssets = planes('plugin-primary-complete'); badAssets.assets = 'plugin-primary-partial';
  assert.throws(() => buildAssetGraph({ document, assetIndex, assetNodeIds: ['icon'], sealedFiles, sourcePlanes: badAssets, evidenceClass: 'integration' }), AssetGraphError);
  assert.match(schemaError('documentGraph', { schemaVersion: 999 }), /unknown/);
});

test('canonical-model pipeline builds all versioned P2 graphs from one snapshot and stops unknown carriers before lowering (G1)', () => {
  const { document, components, supplement, assetIndex, sealedFiles, variables } = fixture();
  const snapshot = {
    manifest: { sourcePlanes: planes(), files: sealedFiles }, document, components, supplement,
    variables,
    dependencies: { assets: assetIndex, assetNodeIds: ['icon'] },
  };
  const model = buildCanonicalModel({ snapshot, evidenceClass: 'microfixture', fileKey: 'FIX' });
  assert.equal(model.schemaVersion, SCHEMA.canonicalModel);
  for (const key of ['documentGraph', 'variableGraph', 'bindingGraph', 'componentGraph', 'textGraph', 'assetGraph']) assert.ok(model[key]?.schemaVersion);
  const persisted = JSON.parse(JSON.stringify(model));
  assert.equal(persisted.variableGraph.variables[0].key, 'K_OPACITY'); // real arrays survive JSON; Map internals must never disappear as `{}`
  assert.equal(persisted.variableGraph.collections[0].key, 'CK_THEME');
  assert.equal(persisted.variableGraph.nodeModeContexts.length, 6);
  assert.equal(persisted.variableGraph.nodeModeContexts.find((row) => row.nodeId === 'root').modeContextId, 'CK_THEME=light');
  assert.ok(Array.isArray(persisted.bindingGraph.resolutionTraces));
  assert.equal(JSON.stringify(persisted).includes('"byId":{}'), false);
  assert.deepEqual(parseCanonicalModel(persisted), persisted);
  const persistedMutations = [
    ['missing document root identity', (value) => { delete value.documentGraph.rootId; }],
    ['empty document node', (value) => { value.documentGraph.nodes[0] = {}; }],
    ['document node loses type', (value) => { delete value.documentGraph.nodes[0].properties.type; }],
    ['broken document relationship', (value) => { value.documentGraph.nodes[0].childIds[0] = 'missing'; }],
    ['malformed variable', (value) => { value.variableGraph.variables[0] = {}; }],
    ['malformed collection', (value) => { value.variableGraph.collections[0].modes = []; }],
    ['malformed node mode context', (value) => { value.variableGraph.nodeModeContexts[0] = {}; }],
    ['forged resolution trace', (value) => { value.variableGraph.resolutionTraces[0].hops[0].key = 'wrong'; }],
    ['binding references missing node', (value) => { value.bindingGraph.records[0].source.nodeId = 'missing'; }],
    ['binding identity disagrees', (value) => { value.bindingGraph.records[0].bindingId = 'forged'; }],
    ['binding and variable contexts disagree', (value) => { value.bindingGraph.nodeModeContexts[0].modeContextId = 'ø'; }],
    ['persisted unknown carrier', (value) => { value.bindingGraph.unknown.push({ nodeId: 'root', jsonPointer: '/novelFeature', variableId: 'V:op' }); }],
    ['persisted forged mirror', (value) => { value.bindingGraph.mirrors.push({ nodeId: 'root', jsonPointer: '/boundVariables/fills/0', variableId: 'V:op', mirrorOf: 'fills' }); }],
    ['persisted forged nonvisual disposition', (value) => { value.bindingGraph.nonvisual.push({ nodeId: 'root', jsonPointer: '/boundVariables/novel', variableId: 'V:op' }); }],
    ['malformed component definition', (value) => { value.componentGraph.definitions[0] = {}; }],
    ['malformed component instance', (value) => { value.componentGraph.instances[0] = {}; }],
    ['component supplement disagrees', (value) => { value.componentGraph.definitionSupplements[0].componentPropertyDefinitions.Size.defaultValue = 'L'; }],
    ['malformed text node', (value) => { value.textGraph.textNodes.push({}); }],
    ['text characters disagree', (value) => { value.textGraph.textNodes[0].segments[0].characters = 'No '; }],
    ['malformed asset', (value) => { value.assetGraph.assets.push({}); }],
    ['asset content identity malformed', (value) => { value.assetGraph.assets[0].sha256 = 'bad'; }],
    ['export references missing source node', (value) => { value.assetGraph.assets.push({ kind: 'export', sourceId: 'forged-node', file: 'assets/forged.png', sha256: 'c'.repeat(64), bytes: 1, mime: 'image/png', width: 1, height: 1 }); }],
  ];
  for (const [name, mutate] of persistedMutations) {
    const corrupted = structuredClone(persisted);
    mutate(corrupted);
    assert.throws(() => parseCanonicalModel(corrupted), CanonicalModelError, name);
  }
  const unknownSchema = structuredClone(persisted); unknownSchema.textGraph.schemaVersion = 999;
  assert.throws(() => parseCanonicalModel(unknownSchema), (error) => error instanceof CanonicalModelError && error.state === 'FAILED_CAPABILITY');
  const missingGraph = structuredClone(persisted); delete missingGraph.componentGraph;
  assert.throws(() => parseCanonicalModel(missingGraph), CanonicalModelError);
  const unknown = structuredClone(snapshot);
  unknown.document.novelFeature = { boundVariables: { glow: { type: 'VARIABLE_ALIAS', id: 'V:unknown' } } };
  assert.throws(() => buildCanonicalModel({ snapshot: unknown, evidenceClass: 'microfixture', fileKey: 'FIX' }), (error) => error instanceof CanonicalModelError && error.state === 'FAILED_CAPABILITY');
  const restOnlyUnknown = structuredClone(unknown); restOnlyUnknown.manifest.sourcePlanes.supplement = 'rest-only';
  assert.throws(() => buildCanonicalModel({ snapshot: restOnlyUnknown, evidenceClass: 'integration', fileKey: 'FIX' }), (error) => error instanceof CanonicalModelError && error.state === 'FAILED_CAPTURE');
  const incompleteSupplement = structuredClone(snapshot); incompleteSupplement.supplement.nodes = incompleteSupplement.supplement.nodes.filter((row) => row.nodeId !== 'photo');
  assert.throws(() => buildCanonicalModel({ snapshot: incompleteSupplement, evidenceClass: 'microfixture', fileKey: 'FIX' }), (error) => error instanceof CanonicalModelError && error.state === 'FAILED_CAPTURE');
});

test('independent G1-G5 oracle rejects the actual legacy thin IR on the same semantic fixture', () => {
  const { document, components, supplement, assetIndex, sealedFiles, variables } = fixture();
  const snapshot = { manifest: { sourcePlanes: planes(), files: sealedFiles }, document, components, supplement, variables, dependencies: { assets: assetIndex, assetNodeIds: ['icon'] } };
  const canonical = buildCanonicalModel({ snapshot, evidenceClass: 'microfixture', fileKey: 'FIX' });
  const legacy = buildIr(document, new Map([['V:op', { cssVar: '--opacity-card', name: 'opacity/card' }]]));
  assert.deepEqual(lossyLegacyFailures(canonical, legacy), { G1: true, G2: true, G3: true, G4: true, G5: true });
});
