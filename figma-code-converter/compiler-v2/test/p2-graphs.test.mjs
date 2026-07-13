/**
 * compiler-v2 P2 tests — variable graph (mode resolution, cycles, traces), binding graph
 * (canonical records, G2 conservation), codecs (typed domain transforms), and the deprecated
 * `background` carrier rule. Every test encodes a contract law (WHY).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectOccurrences, classifyOccurrences } from '../src/inventory.mjs';
import { buildVariableGraph, modeContextId, ResolutionError } from '../src/variable-graph.mjs';
import { buildBindingGraph, conservationDiff, BindingGraphError } from '../src/binding-graph.mjs';
import { codec, tokenLeaf, isSupported, tokenLeaves } from '../src/codecs.mjs';
import { sourceBindingIdentity } from '../src/schema.mjs';

const vjson = () => ({
  variables: [
    { id: 'V:a', key: 'KA', name: 'bg/x', variableCollectionId: 'C1', resolvedType: 'COLOR', valuesByMode: { light: { r: 1, g: 1, b: 1 }, dark: { r: 0, g: 0, b: 0 } } },
    { id: 'V:alias', key: 'KAL', name: 'alias/x', variableCollectionId: 'C1', resolvedType: 'COLOR', valuesByMode: { light: { type: 'VARIABLE_ALIAS', id: 'V:a' }, dark: { type: 'VARIABLE_ALIAS', id: 'V:a' } } },
    { id: 'V:op', key: 'KOP', name: 'op/x', variableCollectionId: 'C1', resolvedType: 'FLOAT', valuesByMode: { light: 85, dark: 85 } },
    { id: 'V:cyc', key: 'KC', name: 'cyc', variableCollectionId: 'C1', resolvedType: 'COLOR', valuesByMode: { light: { type: 'VARIABLE_ALIAS', id: 'V:cyc' }, dark: { type: 'VARIABLE_ALIAS', id: 'V:cyc' } } },
  ],
  variableCollections: [{ id: 'C1', key: 'CK1', name: 'coll', modes: [{ modeId: 'light', name: 'light' }, { modeId: 'dark', name: 'dark' }], defaultModeId: 'light' }],
});

const microfixturePlanes = () => ({ document: 'fixture', variables: 'fixture', supplement: 'fixture' });

test('variable graph resolves under node-local mode context; default inserted when unselected (V5)', () => {
  const vg = buildVariableGraph(vjson());
  assert.deepEqual(vg.resolve('V:a', { C1: 'dark' }).value, { r: 0, g: 0, b: 0 });
  assert.deepEqual(vg.resolve('V:a', {}).value, { r: 1, g: 1, b: 1 }); // {} → captured default 'light', not an arbitrary root pick
});

test('alias chains resolve cross-mode with a stable trace id; cycles are FAILED_BINDING (never silent)', () => {
  const vg = buildVariableGraph(vjson());
  const r = vg.resolve('V:alias', { C1: 'dark' });
  assert.deepEqual(r.value, { r: 0, g: 0, b: 0 });
  assert.equal(r.traceId, 'KAL@CK1:dark>KA@CK1:dark'); // stable keys, never capture-local ids
  assert.throws(() => vg.resolve('V:cyc', {}), (e) => e instanceof ResolutionError && e.state === 'FAILED_BINDING');
});

test('ModeContextId inserts captured defaults for every collection used by the reachable subtree, not unrelated catalog collections (V5/V14)', () => {
  const data = vjson();
  data.variableCollections.push({ id: 'C2', key: 'CK2', name: 'other', modes: [{ modeId: 'base', name: 'base' }, { modeId: 'alt', name: 'alt' }], defaultModeId: 'base' });
  data.variableCollections.push({ id: 'UNUSED', key: 'CK_UNUSED', name: 'unused', modes: [{ modeId: 'u', name: 'u' }], defaultModeId: 'u' });
  const vg = buildVariableGraph(data);
  assert.equal(vg.modeContextId({ C1: 'dark' }, ['C1', 'C2']), 'CK1=dark,CK2=base');
  assert.equal(vg.modeContextId({}, ['C2']), 'CK2=base');
});

test('a variable with no stable key is refused at graph build (§6.1)', () => {
  const bad = vjson(); delete bad.variables[0].key;
  assert.throws(() => buildVariableGraph(bad), ResolutionError);
});

test('binding graph builds ONE canonical record per slot with the full G2 identity', () => {
  const doc = {
    id: '1:0', type: 'FRAME',
    fills: [{ type: 'SOLID', boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:a' } } }],
    boundVariables: { opacity: { type: 'VARIABLE_ALIAS', id: 'V:op' }, fills: [{ type: 'VARIABLE_ALIAS', id: 'V:a' }] },
    children: [],
  };
  const vg = buildVariableGraph(vjson());
  const classified = classifyOccurrences(collectOccurrences(doc));
  const supplement = { schemaVersion: 1, nodes: [{ nodeId: '1:0', resolvedVariableModes: {} }] };
  const { records } = buildBindingGraph({ fileKey: 'F', document: doc, supplement, sourcePlanes: microfixturePlanes(), evidenceClass: 'microfixture', classified, variableGraph: vg });
  assert.equal(records.length, 2); // fill color + opacity (the bv.fills mirror is NOT a record)
  const fill = records.find((r) => r.source.propertyPath === '/fills/0/color');
  assert.equal(fill.variable.key, 'KA');
  assert.equal(fill.variable.collectionKey, 'CK1'); // wired from the collection map (no stub)
  assert.equal(fill.destinationDomain, 'color');
  assert.doesNotThrow(() => sourceBindingIdentity(fill)); // full identity present
  const op = records.find((r) => r.source.propertyPath === '/opacity');
  assert.equal(op.destinationDomain, 'opacity-normalized');
  assert.equal(op.modeContextId, 'CK1=light'); // absent selection inserts the captured default
  const graph = buildBindingGraph({ fileKey: 'F', document: doc, supplement, sourcePlanes: microfixturePlanes(), evidenceClass: 'microfixture', classified, variableGraph: vg });
  assert.equal(graph.resolutionTraces.length, 2);
  assert.ok(graph.resolutionTraces.every((trace) => trace.traceId && trace.hops.length));
});

test('BindingGraph fails before graphs when a required fact plane is REST-only/partial or fixture is relabelled integration (G0/G5)', () => {
  const doc = { id: '1:0', type: 'FRAME', fills: [{ type: 'SOLID', boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:a' } } }], children: [] };
  const supplement = { schemaVersion: 1, nodes: [{ nodeId: '1:0', resolvedVariableModes: {} }] };
  const variableGraph = buildVariableGraph(vjson());
  const classified = classifyOccurrences(collectOccurrences(doc));
  const build = (sourcePlanes, evidenceClass = 'integration') => buildBindingGraph({ fileKey: 'F', document: doc, supplement, sourcePlanes, evidenceClass, classified, variableGraph });
  assert.throws(() => build({ document: 'rest-only', variables: 'plugin-primary-complete', supplement: 'plugin-primary-complete' }), (e) => e instanceof BindingGraphError && e.state === 'FAILED_CAPTURE');
  assert.throws(() => build({ document: 'plugin-primary-complete', variables: 'plugin-primary-partial', supplement: 'plugin-primary-complete' }), (e) => e instanceof BindingGraphError && e.state === 'FAILED_CAPTURE');
  assert.throws(() => build({ document: 'plugin-primary-complete', variables: 'plugin-primary-complete', supplement: 'rest-only' }), (e) => e instanceof BindingGraphError && e.state === 'FAILED_CAPTURE');
  assert.throws(() => build(microfixturePlanes(), 'integration'), (e) => e instanceof BindingGraphError && e.state === 'FAILED_CAPTURE');
  assert.doesNotThrow(() => build({ document: 'plugin-primary-complete', variables: 'plugin-primary-complete', supplement: 'plugin-primary-complete' }));
});

test('BindingGraph context identity includes defaulted collections used by descendants, while the child excludes unrelated ancestors (V5/V14)', () => {
  const data = vjson();
  data.variableCollections.push({ id: 'C2', key: 'CK2', name: 'other', modes: [{ modeId: 'base', name: 'base' }], defaultModeId: 'base' });
  data.variables.push({ id: 'V:b', key: 'KB', name: 'fg/x', variableCollectionId: 'C2', resolvedType: 'COLOR', valuesByMode: { base: { r: 0.5, g: 0.5, b: 0.5 } } });
  const doc = {
    id: 'root', type: 'FRAME', boundVariables: { opacity: { type: 'VARIABLE_ALIAS', id: 'V:op' } },
    children: [{ id: 'child', type: 'RECTANGLE', fills: [{ type: 'SOLID', boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:b' } } }], children: [] }],
  };
  const supplement = { schemaVersion: 1, nodes: [
    { nodeId: 'root', resolvedVariableModes: {} },
    { nodeId: 'child', resolvedVariableModes: {} },
  ] };
  const variableGraph = buildVariableGraph(data);
  const classified = classifyOccurrences(collectOccurrences(doc));
  const { records } = buildBindingGraph({ fileKey: 'F', document: doc, supplement, sourcePlanes: microfixturePlanes(), evidenceClass: 'microfixture', classified, variableGraph });
  assert.equal(records.find((r) => r.source.nodeId === 'root').modeContextId, 'CK1=light,CK2=base');
  assert.equal(records.find((r) => r.source.nodeId === 'child').modeContextId, 'CK2=base');
});

test('G2 conservation: identical record sets conserve; a swapped variable key is caught', () => {
  const base = () => ({
    schemaVersion: 1, bindingId: 'b', source: { fileKey: 'F', nodeId: '1', propertyPath: '/fills/0/color', slot: { kind: 'paint', index: 0 } },
    variable: { key: 'KA', captureId: 'V:a', collectionKey: 'CK1', figmaType: 'COLOR' }, modeContextId: 'm', resolutionTraceId: 't', destinationDomain: 'color', emissionTarget: 'css', disposition: 'pending',
  });
  assert.ok(conservationDiff([base()], [base()]).conserved);
  const swapped = { ...base(), variable: { ...base().variable, key: 'KB' } };
  const d = conservationDiff([base()], [swapped]);
  assert.equal(d.conserved, false);
  assert.equal(d.missing.length + d.extra.length, 2);
});

test('STRICT background mirror: an EXACT-duplicate background paint mirrors fills, one canonical, no double-count', () => {
  const paint = { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:a' } } };
  const doc = { id: '1:0', type: 'FRAME', fills: [paint], background: [structuredClone(paint)], children: [] };
  const { canonical, mirrors, unknown } = classifyOccurrences(collectOccurrences(doc), doc);
  assert.equal(unknown.length, 0);
  assert.equal(canonical.filter((c) => c.propertyPath.startsWith('/fills')).length, 1); // exactly ONE canonical
  assert.equal(mirrors.filter((m) => m.proven === 'background-structural').length, 1); // background proven-mirrored
});

test('STRICT background mirror proof is structural and key-order independent', () => {
  const alias = { type: 'VARIABLE_ALIAS', id: 'V:a' };
  const fill = { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, boundVariables: { color: alias } };
  const background = { boundVariables: { color: { id: 'V:a', type: 'VARIABLE_ALIAS' } }, color: { b: 1, g: 1, r: 1 }, type: 'SOLID' };
  const doc = { id: '1:0', type: 'FRAME', fills: [fill], background: [background], children: [] };
  const { mirrors, unknown } = classifyOccurrences(collectOccurrences(doc), doc);
  assert.equal(unknown.length, 0);
  assert.equal(mirrors.filter((m) => m.proven === 'background-structural').length, 1);
});

test('STRICT background mirror: divergence fails LOUD — missing fills / different paint / stop mismatch / no context', () => {
  const bound = (id) => ({ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id } } });
  // missing fills[0]
  const d1 = { id: 'n', type: 'FRAME', fills: [], background: [bound('V:a')], children: [] };
  assert.ok(classifyOccurrences(collectOccurrences(d1), d1).unknown.some((u) => /no matching fills/.test(u.reason)));
  // same variable but structurally different containing paint (different color)
  const d2 = { id: 'n', type: 'FRAME', fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:a' } } }], background: [bound('V:a')], children: [] };
  assert.ok(classifyOccurrences(collectOccurrences(d2), d2).unknown.some((u) => /not structurally equal/.test(u.reason)));
  // gradient stop index mismatch
  const g = (id, pos) => ({ type: 'GRADIENT_LINEAR', gradientStops: [{ position: pos, boundVariables: { color: { type: 'VARIABLE_ALIAS', id } } }] });
  const d3 = { id: 'n', type: 'FRAME', fills: [g('V:a', 0)], background: [g('V:a', 0.5)], children: [] };
  assert.ok(classifyOccurrences(collectOccurrences(d3), d3).unknown.length > 0);
  // no document context → cannot prove a mirror → unknown
  const d4 = { id: 'n', type: 'FRAME', background: [bound('V:a')], children: [] };
  assert.ok(classifyOccurrences(collectOccurrences(d4)).unknown.some((u) => /needs document context/.test(u.reason)));
});

test('deprecated backgroundColor scalar has NO accepted binding shape — stays UNKNOWN (no live evidence)', () => {
  const doc = { id: 'n', type: 'FRAME', fills: [{ type: 'SOLID', boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:a' } } }], boundVariables: { backgroundColor: { type: 'VARIABLE_ALIAS', id: 'V:a' } }, children: [] };
  const { unknown } = classifyOccurrences(collectOccurrences(doc), doc);
  assert.ok(unknown.some((u) => /backgroundColor/.test(u.jsonPointer))); // fail-loud, not silently mirrored
});

// ── codecs (§6.2): typed transforms; token leaf never replaced by the literal ───────────────
const leaf = (target = 'css') => tokenLeaf({ variableKey: 'K', channelId: 'ch1', target, figmaType: 'FLOAT', destinationDomain: 'opacity-normalized' });

test('opacity codec: Figma 0–100 → calc(var/100), token leaf preserved (never bare 85)', () => {
  const expr = codec('opacity-normalized', leaf(), { figmaType: 'FLOAT', value: 85 }, { opacityScale: 'percent' });
  assert.equal(expr.kind, 'calc');
  assert.equal(expr.op, 'div');
  assert.equal(tokenLeaves(expr).length, 1); // the bound leaf survives inside the calc
  // an already-normalized 0–1 value passes the leaf through
  assert.equal(codec('opacity-normalized', leaf(), { figmaType: 'FLOAT', value: 0.85 }, { opacityScale: 'normalized' }).kind, 'token');
});

test('codec type validation: wrong Figma type → unsupported, not silently-valid-but-wrong CSS', () => {
  assert.equal(isSupported(codec('color', leaf(), { figmaType: 'FLOAT' })), false); // color needs COLOR
  assert.equal(isSupported(codec('length-px', leaf(), { figmaType: 'STRING' })), false);
  const bad = codec('string-typography', tokenLeaf({ variableKey: 'K', channelId: 'c', target: 'css', figmaType: 'STRING', destinationDomain: 'string-typography' }), { figmaType: 'STRING', value: 'NotAWeight' });
  assert.equal(isSupported(bad), false);
});

test('react-plane domains must emit on the react target, never as inert CSS text', () => {
  const cssLeaf = tokenLeaf({ variableKey: 'K', channelId: 'c', target: 'css', figmaType: 'STRING', destinationDomain: 'react-content' });
  assert.equal(isSupported(codec('react-content', cssLeaf, { figmaType: 'STRING', value: 'Hi' })), false);
  const reactLeaf = tokenLeaf({ variableKey: 'K', channelId: 'c', target: 'react', figmaType: 'STRING', destinationDomain: 'react-content' });
  assert.equal(isSupported(codec('react-content', reactLeaf, { figmaType: 'STRING', value: 'Hi' })), true);
});

test('CSS-plane domains reject React-channel leaves instead of emitting a valid token in the wrong plane', () => {
  const reactColor = tokenLeaf({ variableKey: 'K', channelId: 'c', target: 'react', figmaType: 'COLOR', destinationDomain: 'color' });
  assert.equal(isSupported(codec('color', reactColor, { figmaType: 'COLOR', value: { r: 1, g: 1, b: 1 } })), false);
});
