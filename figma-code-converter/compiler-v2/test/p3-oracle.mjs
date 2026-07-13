import { canonicalJson, sha256 } from '../src/evidence.mjs';

const count = (items, key) => {
  const out = new Map();
  for (const item of items) { const value = key(item); out.set(value, (out.get(value) ?? 0) + 1); }
  return Object.fromEntries([...out].sort());
};

export function p3Failures(model, output) {
  const rawBindings = count(model.bindingGraph.records, (row) => row.bindingId);
  const plannedBindings = count(output.tokenPlan.bindings, (row) => row.bindingId);
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
  const expectedText = model.textGraph.textNodes.map((row) => ({ nodeId: row.nodeId, segments: row.segments, fontDependencies: row.fontDependencies }));
  const actualText = output.semanticSlice.textNodes.map((row) => ({ nodeId: row.nodeId, segments: row.segments, fontDependencies: row.fontDependencies }));
  const expectedTraceContexts = count(model.bindingGraph.records, (row) => `${row.bindingId}:${row.modeContextId}:${row.resolutionTraceId}`);
  const actualTraceContexts = count(output.tokenPlan.bindings, (row) => `${row.bindingId}:${row.modeContextId}:${row.resolutionTraceId}`);
  return {
    G2: canonicalJson(rawBindings) !== canonicalJson(plannedBindings),
    G3: canonicalJson(expectedChannels) !== canonicalJson(actualChannels) || canonicalJson(expectedTraceContexts) !== canonicalJson(actualTraceContexts) || output.tokenPlan.bindings.some((row) => row.expression?.unsupported) || sha256(canonicalJson(output.tokenPlan)) !== output.semanticSlice.tokenPlanHash,
    G4: canonicalJson(expectedInstances) !== canonicalJson(actualInstances),
    G5: canonicalJson(expectedText) !== canonicalJson(actualText),
  };
}
