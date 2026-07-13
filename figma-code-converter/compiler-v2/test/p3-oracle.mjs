import { canonicalJson, sha256 } from '../src/evidence.mjs';

const count = (items, key) => {
  const out = new Map();
  for (const item of items) { const value = key(item); out.set(value, (out.get(value) ?? 0) + 1); }
  return Object.fromEntries([...out].sort());
};

export function p3Failures(model, output) {
  const rawBindings = count(model.bindingGraph.records, (row) => row.bindingId);
  const plannedBindings = count(output.tokenPlan.bindings, (row) => row.bindingId);
  const expectedBindingChannels = count(model.bindingGraph.records, (row) => `${row.bindingId}:${output.registryStage?.candidateRegistry?.entries?.[row.variable.key]?.channels?.[row.destinationDomain]?.channelId}`);
  const actualBindingChannels = count(output.tokenPlan.bindings, (row) => `${row.bindingId}:${row.channelId}`);
  const expectedChannels = count(model.bindingGraph.records, (row) => `${row.variable.key}:${row.destinationDomain}:${row.emissionTarget}`);
  const actualChannels = count(output.tokenPlan.bindings, (row) => `${row.variableKey}:${row.destinationDomain}:${row.target}`);
  const expectedInstances = model.componentGraph.instances.map((row) => ({
    nodeId: row.nodeId, componentKey: row.mainComponentKey, props: row.componentProperties,
    references: row.componentPropertyReferences, overrides: row.overrides,
  }));
  const actualInstances = output.semanticSlice.instances.map((row) => ({
    nodeId: row.nodeId, componentKey: row.sourceComponentKey, props: row.props,
    references: row.references, overrides: row.overrides,
  }));
  const expectedComponentSets = model.componentGraph.definitions.filter((row) => !row.componentSetKey && model.componentGraph.definitions.some((member) => member.componentSetKey === row.key)).map((set) => ({
    componentKey: set.key,
    variantAxes: Object.fromEntries(Object.entries(set.propertyDefinitions ?? {}).filter(([, definition]) => definition.type === 'VARIANT').map(([name, definition]) => [name, { default: definition.defaultValue, options: definition.variantOptions }])),
    members: model.componentGraph.definitions.filter((member) => member.componentSetKey === set.key).map((member) => ({ componentKey: member.key, variantProps: member.variantProperties })),
  }));
  const actualComponentSets = output.semanticSlice.componentSets.map((set) => ({ componentKey: set.componentKey, variantAxes: set.variantAxes, members: set.members.map((member) => ({ componentKey: member.componentKey, variantProps: member.variantProps })) }));
  const missingDefaultMember = expectedComponentSets.some((set) => !set.members.some((member) => Object.entries(set.variantAxes).every(([name, axis]) => member.variantProps?.[name] === axis.default)));
  const expectedText = model.textGraph.textNodes.map((row) => ({ nodeId: row.nodeId, segments: row.segments, fontDependencies: row.fontDependencies }));
  const actualText = output.semanticSlice.textNodes.map((row) => ({ nodeId: row.nodeId, segments: row.segments, fontDependencies: row.fontDependencies }));
  const expectedTraceContexts = count(model.bindingGraph.records, (row) => `${row.bindingId}:${row.modeContextId}:${row.resolutionTraceId}`);
  const actualTraceContexts = count(output.tokenPlan.bindings, (row) => `${row.bindingId}:${row.modeContextId}:${row.resolutionTraceId}`);
  return {
    G2: canonicalJson(rawBindings) !== canonicalJson(plannedBindings) || canonicalJson(expectedBindingChannels) !== canonicalJson(actualBindingChannels),
    G3: canonicalJson(expectedChannels) !== canonicalJson(actualChannels) || canonicalJson(expectedTraceContexts) !== canonicalJson(actualTraceContexts) || output.tokenPlan.bindings.some((row) => row.expression?.unsupported) || sha256(canonicalJson(output.tokenPlan)) !== output.semanticSlice.tokenPlanHash || output.tokenPlan.registryHash !== output.registryStage?.candidateHash || output.tokenPlan.registryGeneration !== output.registryStage?.candidateRegistry?.generation || output.tokenPlan.registryStageId !== output.registryStage?.stageId || output.tokenPlan.registryBaseHash !== output.registryStage?.baseHash || output.tokenPlan.codecPolicyId !== output.approvedCodecPolicyId,
    G4: missingDefaultMember || canonicalJson(expectedInstances) !== canonicalJson(actualInstances) || canonicalJson(expectedComponentSets) !== canonicalJson(actualComponentSets) || output.semanticSlice.componentSets.some((set) => set.members.some((member) => Object.hasOwn(member, 'reactName'))) || output.semanticSlice.components.some((component) => component.componentSetKey),
    G5: canonicalJson(expectedText) !== canonicalJson(actualText),
  };
}
