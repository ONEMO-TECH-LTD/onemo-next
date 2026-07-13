import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from '../src/evidence.mjs';
import { tokenLeaves } from '../src/codecs.mjs';
import { emptyTokenRegistry, stageTokenRegistry, assertRegistryStageCurrent, RegistryError } from '../src/token-registry.mjs';
import { buildTokenPlan, TokenPlanError } from '../src/token-plan.mjs';
import { buildModeContextPlan } from '../src/mode-context-plan.mjs';
import { lowerSemanticSlice } from '../src/semantic-slice.mjs';
import { p3Fixture } from './p3-fixture.mjs';
import { p3Failures } from './p3-oracle.mjs';
import { sealCanonicalModelContent } from '../src/canonical-model.mjs';

const acceptColorSyntax = ({ domain, syntax }) => domain === 'color' ? syntax : null;
const optionsFor = (record) => record.destinationDomain === 'opacity-normalized' ? { opacityScale: 'percent' } : {};

function compile(model, baseRegistry = emptyTokenRegistry()) {
  const registryStage = stageTokenRegistry({ model, baseRegistry, webSyntaxPolicy: acceptColorSyntax });
  const tokenPlan = buildTokenPlan({ model, registry: registryStage.candidateRegistry, codecOptions: optionsFor });
  const modeContextPlan = buildModeContextPlan(model);
  const semanticSlice = lowerSemanticSlice({ model, tokenPlan, modeContextPlan });
  return { registryStage, tokenPlan, modeContextPlan, semanticSlice };
}

function resealRegistryStage(stage) {
  stage.candidateHash = sha256(canonicalJson(stage.candidateRegistry));
  const deltaHash = sha256(canonicalJson(stage.delta));
  stage.stageId = sha256(`${stage.baseHash}\u241f${stage.candidateHash}\u241f${deltaHash}`).slice(0, 16);
  return stage;
}

test('P3 registry stages deterministic per-domain channels without mutating persistent identity', () => {
  const { model } = p3Fixture();
  const base = emptyTokenRegistry();
  const before = canonicalJson(base);
  const first = stageTokenRegistry({ model, baseRegistry: base, webSyntaxPolicy: acceptColorSyntax });
  const second = stageTokenRegistry({ model, baseRegistry: base, webSyntaxPolicy: acceptColorSyntax });
  assert.equal(canonicalJson(base), before);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.candidateRegistry.entries.K_COLOR.channels.color.cssName, '--velvet-ink');
  const float = first.candidateRegistry.entries.K_FLOAT.channels;
  assert.ok(float['length-px'].cssName.startsWith('--fg-loose-measure-'));
  assert.notEqual(float['length-px'].channelId, float['opacity-normalized'].channelId);
  assert.notEqual(float['length-px'].cssName, float['opacity-normalized'].cssName);
  assert.equal(first.candidateRegistry.entries.K_COPY.channels['react-content'].target, 'react');
  assert.equal(first.candidateRegistry.entries.K_BOOL.channels['react-component-prop'].target, 'react');
});

test('existing registry identity wins across label/value/WEB-syntax changes; migration is explicit', () => {
  const original = p3Fixture();
  const initial = compile(original.model);
  const changed = p3Fixture({ colorName: 'Renamed readable label', colorWeb: '--renamed-web', darkColor: { r: 0.7, g: 0.2, b: 0.4, a: 1 } });
  const restaged = stageTokenRegistry({ model: changed.model, baseRegistry: initial.registryStage.candidateRegistry, webSyntaxPolicy: acceptColorSyntax });
  assert.deepEqual(restaged.candidateRegistry, initial.registryStage.candidateRegistry);
  assert.deepEqual(restaged.delta.migrations, [{ variableKey: 'K_COLOR', domain: 'color', existing: '--velvet-ink', requested: '--renamed-web' }]);
  const changedOutput = compile(changed.model, initial.registryStage.candidateRegistry);
  assert.equal(canonicalJson(changedOutput.registryStage.candidateRegistry), canonicalJson(initial.registryStage.candidateRegistry));
  assert.equal(canonicalJson(changedOutput.semanticSlice), canonicalJson(initial.semanticSlice));
  assert.notEqual(canonicalJson(changedOutput.tokenPlan.tokenData), canonicalJson(initial.tokenPlan.tokenData));
  const componentRenamed = compile(p3Fixture({ componentName: 'Renamed component label' }).model, initial.registryStage.candidateRegistry);
  assert.equal(canonicalJson(componentRenamed.semanticSlice), canonicalJson(initial.semanticSlice));
});

test('registry type/name collisions and stale commit bases fail without mutating the base', () => {
  const { model } = p3Fixture();
  const base = emptyTokenRegistry();
  const stage = stageTokenRegistry({ model, baseRegistry: base, webSyntaxPolicy: acceptColorSyntax });
  const before = canonicalJson(stage.candidateRegistry);
  const typeConflict = structuredClone(stage.candidateRegistry); typeConflict.entries.K_COLOR.figmaType = 'FLOAT';
  assert.throws(() => stageTokenRegistry({ model, baseRegistry: typeConflict, webSyntaxPolicy: acceptColorSyntax }), RegistryError);
  const duplicateSyntax = structuredClone(model); duplicateSyntax.variableGraph.variables.find((row) => row.key === 'K_FLOAT').codeSyntax = { WEB: '--float-source' };
  Object.assign(duplicateSyntax, sealCanonicalModelContent(duplicateSyntax));
  assert.throws(() => stageTokenRegistry({ model: duplicateSyntax, baseRegistry: base, webSyntaxPolicy: () => '--duplicate' }), RegistryError);
  const invalidSyntax = p3Fixture({ colorWeb: 'var(--unsafe)' });
  assert.throws(() => stageTokenRegistry({ model: invalidSyntax.model, baseRegistry: base, webSyntaxPolicy: acceptColorSyntax }), RegistryError);
  const advanced = structuredClone(base); advanced.generation += 1;
  assert.throws(() => assertRegistryStageCurrent(stage, advanced), RegistryError);
  const forgedStage = structuredClone(stage); forgedStage.candidateHash = 'f'.repeat(64);
  assert.throws(() => assertRegistryStageCurrent(forgedStage, base), RegistryError);
  const forgedDelta = structuredClone(stage); forgedDelta.delta.addedEntries = [];
  assert.throws(() => assertRegistryStageCurrent(forgedDelta, base), RegistryError);
  const noChange = stageTokenRegistry({ model, baseRegistry: stage.candidateRegistry, webSyntaxPolicy: acceptColorSyntax });
  const removedIdentity = structuredClone(noChange); delete removedIdentity.candidateRegistry.entries.K_COLOR;
  resealRegistryStage(removedIdentity);
  assert.throws(() => assertRegistryStageCurrent(removedIdentity, stage.candidateRegistry), RegistryError);
  assert.equal(canonicalJson(stage.candidateRegistry), before);
});

test('token and mode planners preserve every binding, typed channel, nested mode, and token leaf', () => {
  const { model } = p3Fixture();
  const output = compile(model);
  assert.equal(output.tokenPlan.bindings.length, model.bindingGraph.records.length);
  assert.ok(output.tokenPlan.bindings.every((row) => tokenLeaves(row.expression).length === 1));
  const floatBindings = output.tokenPlan.bindings.filter((row) => row.variableKey === 'K_FLOAT');
  assert.deepEqual(new Set(floatBindings.map((row) => row.destinationDomain)), new Set(['length-px', 'opacity-normalized']));
  assert.equal(floatBindings.find((row) => row.destinationDomain === 'opacity-normalized').expression.kind, 'calc');
  assert.ok(output.tokenPlan.tokenData.css.length > 0);
  assert.ok(output.tokenPlan.tokenData.react.length > 0);
  assert.match(output.tokenPlan.registryHash, /^[0-9a-f]{64}$/);
  assert.equal(output.modeContextPlan.boundaries[0].nodeId, 'root');
  assert.ok(output.modeContextPlan.boundaries.some((row) => row.nodeId === 'nested' && row.modeContextId.includes('CK_THEME=dark')));
  const aliasData = output.tokenPlan.tokenData.css.find((row) => row.variableKey === 'K_ALIAS');
  const nestedValue = aliasData.contexts.find((row) => row.modeContextId.includes('CK_THEME=dark'));
  assert.deepEqual(nestedValue.value.channels, [0.9, 0.8, 0.7]);
  assert.match(nestedValue.resolutionTraceId, /^K_ALIAS@CK_ALIAS:base>K_COLOR@CK_THEME:dark$/);
  assert.deepEqual(p3Failures(model, output), { G2: false, G3: false, G4: false, G5: false });
});

test('native components, instances, nested modes, and rich text remain semantic—not flattened', () => {
  const { model } = p3Fixture();
  const output = compile(model);
  assert.equal(output.semanticSlice.componentSets[0].componentKey, 'SET_CHOICE');
  assert.deepEqual(output.semanticSlice.componentSets[0].variantAxes.Size.options, ['S', 'L']);
  assert.equal(output.semanticSlice.componentSets[0].members.length, 2);
  assert.equal(output.semanticSlice.instances[0].componentKey, 'CMP_CHOICE_S');
  assert.deepEqual(output.semanticSlice.instances[0].props.Enabled, { type: 'BOOLEAN', value: true });
  assert.deepEqual(output.semanticSlice.instances[0].overrides, [{ id: 'instance-control', overriddenFields: ['visible'] }]);
  assert.deepEqual(output.semanticSlice.propertyReferences, [{ nodeId: 'instance-control', ownerComponentKey: 'CMP_CHOICE_S', references: { visible: 'Enabled' } }]);
  assert.equal(output.semanticSlice.textNodes[0].segments.length, 2);
  assert.equal(output.semanticSlice.textNodes[0].segments[1].hyperlink.value, 'https://example.test/look');
  assert.match(output.semanticSlice.nodeModes.nested, /CK_THEME=dark/);
  const incomplete = structuredClone(model); incomplete.componentGraph.definitions = incomplete.componentGraph.definitions.filter((row) => row.key !== 'CMP_CHOICE_L');
  Object.assign(incomplete, sealCanonicalModelContent(incomplete));
  assert.throws(() => lowerSemanticSlice({ model: incomplete, tokenPlan: output.tokenPlan, modeContextPlan: output.modeContextPlan }));
  const wrongPropType = p3Fixture({ componentVariable: 'V_COPY' });
  assert.throws(() => compile(wrongPropType.model), /disagrees with native component property type/);
  const foreignTokenPlan = structuredClone(output.tokenPlan); foreignTokenPlan.bindings[0].variableKey = 'K_FORGED';
  assert.throws(() => lowerSemanticSlice({ model, tokenPlan: foreignTokenPlan, modeContextPlan: output.modeContextPlan }));
  const foreignModePlan = structuredClone(output.modeContextPlan); foreignModePlan.nodes.find((row) => row.nodeId === 'nested').modeContextId = 'CK_THEME=light';
  assert.throws(() => lowerSemanticSlice({ model, tokenPlan: output.tokenPlan, modeContextPlan: foreignModePlan }));
});

test('independent P3 G2-G5 mutations bite dropped bindings, swapped channels, flattening, and text merge', () => {
  const { model } = p3Fixture();
  const output = compile(model);
  const dropped = structuredClone(output); dropped.tokenPlan.bindings.pop();
  assert.equal(p3Failures(model, dropped).G2, true);
  const swapped = structuredClone(output); swapped.tokenPlan.bindings[0].target = swapped.tokenPlan.bindings[0].target === 'css' ? 'react' : 'css';
  assert.equal(p3Failures(model, swapped).G3, true);
  const flattened = structuredClone(output); flattened.semanticSlice.instances = [];
  assert.equal(p3Failures(model, flattened).G4, true);
  const merged = structuredClone(output); merged.semanticSlice.textNodes[0].segments = [{ start: 0, end: 4, characters: 'Look' }];
  assert.equal(p3Failures(model, merged).G5, true);
});

test('unsupported bound values stop the plan; no literal fallback is emitted', () => {
  const { model } = p3Fixture();
  const stage = stageTokenRegistry({ model, baseRegistry: emptyTokenRegistry(), webSyntaxPolicy: acceptColorSyntax });
  assert.throws(() => buildTokenPlan({ model, registry: stage.candidateRegistry, codecOptions: () => ({}) }), TokenPlanError);
});
