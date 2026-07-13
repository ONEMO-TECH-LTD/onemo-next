/** P3 semantic slice: native components/instances + exact rich text, before TSX emission. */
import { SCHEMA, schemaError } from './schema.mjs';
import { parseCanonicalModel } from './canonical-model.mjs';
import { canonicalJson, sha256 } from './evidence.mjs';
import { unescapePointerToken } from './inventory.mjs';
import { buildModeContextPlan } from './mode-context-plan.mjs';
import { validateTokenPlan } from './token-plan.mjs';

export class SemanticSliceError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_COMPONENT'; }
}

export function lowerSemanticSlice({ model: input, tokenPlan, modeContextPlan, registryStage, codecPolicyId, codecOptions }) {
  const model = parseCanonicalModel(input);
  if (schemaError('tokenPlan', tokenPlan)) throw new SemanticSliceError('versioned TokenPlan required');
  if (schemaError('modeContextPlan', modeContextPlan)) throw new SemanticSliceError('versioned ModeContextPlan required');
  try { validateTokenPlan({ model, tokenPlan, registryStage, codecPolicyId, codecOptions }); }
  catch (error) { throw new SemanticSliceError(`TokenPlan refused: ${error.message}`); }
  validatePlanConservation(model, tokenPlan, modeContextPlan);
  const bindingsByNode = new Map();
  for (const binding of tokenPlan.bindings) {
    if (!bindingsByNode.has(binding.source.nodeId)) bindingsByNode.set(binding.source.nodeId, []);
    bindingsByNode.get(binding.source.nodeId).push(structuredClone(binding));
  }
  const definitions = new Map(model.componentGraph.definitions.map((row) => [row.key, row]));
  const componentSets = model.componentGraph.definitions.filter((row) => !row.componentSetKey && model.componentGraph.definitions.some((member) => member.componentSetKey === row.key)).map((set) => {
    const variantAxes = {};
    const publicProps = {};
    for (const [name, definition] of Object.entries(set.propertyDefinitions ?? {})) {
      if (definition.type === 'VARIANT') variantAxes[name] = { default: definition.defaultValue, options: structuredClone(definition.variantOptions) };
      else publicProps[name] = structuredClone(definition);
    }
    const sourceMembers = model.componentGraph.definitions.filter((row) => row.componentSetKey === set.key);
    validateComponentSet(set, sourceMembers, variantAxes, publicProps);
    const members = sourceMembers.map((row) => ({
      componentKey: row.key,
      sourceId: row.id,
      variantProps: structuredClone(row.variantProperties ?? {}),
      propertyDefinitions: structuredClone(row.propertyDefinitions),
    }));
    return { componentKey: set.key, sourceId: set.id, reactName: componentSymbol(set.key), variantAxes, publicProps, members };
  });
  const components = model.componentGraph.definitions.filter((row) => !row.componentSetKey && !componentSets.some((set) => set.componentKey === row.key)).map((row) => ({
    componentKey: row.key,
    sourceId: row.id,
    reactName: componentSymbol(row.key),
    componentSetKey: row.componentSetKey ?? null,
    propertyDefinitions: structuredClone(row.propertyDefinitions),
  }));
  const instances = model.componentGraph.instances.map((row) => {
    if (!definitions.has(row.mainComponentKey)) throw new SemanticSliceError(`instance ${row.nodeId} component missing`);
    const tokenBindings = (bindingsByNode.get(row.nodeId) ?? []).filter((binding) => binding.destinationDomain === 'react-component-prop');
    validateComponentTokenTypes(row, definitions, model.bindingGraph.records, tokenBindings);
    const component = definitions.get(row.mainComponentKey);
    const set = component?.componentSetKey ? definitions.get(component.componentSetKey) : null;
    return {
      nodeId: row.nodeId,
      componentKey: set?.key ?? row.mainComponentKey,
      sourceComponentKey: row.mainComponentKey,
      reactName: componentSymbol(set?.key ?? row.mainComponentKey),
      props: structuredClone(row.componentProperties),
      references: structuredClone(row.componentPropertyReferences),
      overrides: structuredClone(row.overrides),
      tokenBindings,
    };
  });
  const textNodes = model.textGraph.textNodes.map((row) => ({
    nodeId: row.nodeId,
    segments: structuredClone(row.segments),
    fontDependencies: structuredClone(row.fontDependencies),
    tokenBindings: (bindingsByNode.get(row.nodeId) ?? []).filter((binding) => binding.destinationDomain === 'react-content' || binding.source.slot?.kind === 'text-range'),
  }));
  const nodeModes = Object.fromEntries(modeContextPlan.nodes.map((row) => [row.nodeId, row.modeContextId]));
  const nodes = model.documentGraph.nodes.map((row) => ({
    nodeId: row.id,
    parentId: row.parentId,
    childIds: structuredClone(row.childIds),
    type: row.properties.type,
    name: row.properties.name ?? '',
    modeContextId: nodeModes[row.id],
    tokenBindings: structuredClone(bindingsByNode.get(row.id) ?? []),
  }));
  return {
    schemaVersion: SCHEMA.semanticSlice,
    tokenPlanHash: sha256(canonicalJson(tokenPlan)),
    rootId: model.documentGraph.rootId,
    nodes,
    componentSets,
    components,
    instances,
    propertyReferences: structuredClone(model.componentGraph.propertyReferences),
    textNodes,
    nodeModes,
    modeBoundaries: structuredClone(modeContextPlan.boundaries),
  };
}

function componentSymbol(key) {
  return `FigmaComponent_${sha256(String(key)).slice(0, 8)}`;
}

function validatePlanConservation(model, tokenPlan, modeContextPlan) {
  const expectedModes = buildModeContextPlan(model);
  if (canonicalJson(expectedModes) !== canonicalJson(modeContextPlan)) throw new SemanticSliceError('ModeContextPlan disagrees with canonical node contexts');
  const expected = model.bindingGraph.records.map((record) => ({
    bindingId: record.bindingId,
    source: record.source,
    variableKey: record.variable.key,
    destinationDomain: record.destinationDomain,
    target: record.emissionTarget,
    modeContextId: record.modeContextId,
    resolutionTraceId: record.resolutionTraceId,
  })).sort(byBindingId);
  const actual = tokenPlan.bindings.map((binding) => ({
    bindingId: binding.bindingId,
    source: binding.source,
    variableKey: binding.variableKey,
    destinationDomain: binding.destinationDomain,
    target: binding.target,
    modeContextId: binding.modeContextId,
    resolutionTraceId: binding.resolutionTraceId,
  })).sort(byBindingId);
  if (canonicalJson(expected) !== canonicalJson(actual)) throw new SemanticSliceError('TokenPlan bindings disagree with canonical BindingGraph');
}

const byBindingId = (a, b) => String(a.bindingId).localeCompare(String(b.bindingId));

function validateComponentSet(set, members, variantAxes, publicProps) {
  const axisNames = Object.keys(variantAxes).sort();
  const actual = new Set();
  for (const member of members) {
    const properties = member.variantProperties ?? {};
    if (canonicalJson(Object.keys(properties).sort()) !== canonicalJson(axisNames)) throw new SemanticSliceError(`component set ${set.key} member ${member.key} has incomplete variant axes`);
    for (const name of axisNames) if (!variantAxes[name].options.includes(properties[name])) throw new SemanticSliceError(`component set ${set.key} member ${member.key} has illegal ${name} variant`);
    for (const [name, definition] of Object.entries(publicProps)) if (canonicalJson(member.propertyDefinitions?.[name]) !== canonicalJson(definition)) throw new SemanticSliceError(`component set ${set.key} member ${member.key} disagrees on public prop ${name}`);
    const combination = axisNames.map((name) => `${name}=${properties[name]}`).join(',');
    if (actual.has(combination)) throw new SemanticSliceError(`component set ${set.key} duplicates variant ${combination}`);
    actual.add(combination);
  }
  if (members.length === 0) throw new SemanticSliceError(`component set ${set.key} has no authored members`);
  for (const name of axisNames) {
    const captured = new Set(members.map((member) => member.variantProperties?.[name]));
    const missing = variantAxes[name].options.filter((option) => !captured.has(option));
    if (missing.length) throw new SemanticSliceError(`component set ${set.key} has uncaptured ${name} option(s): ${missing.join(', ')}`);
  }
}

function validateComponentTokenTypes(instance, definitions, records, tokenBindings) {
  const component = definitions.get(instance.mainComponentKey);
  const parent = component?.componentSetKey ? definitions.get(component.componentSetKey) : null;
  const propertyDefinitions = { ...(parent?.propertyDefinitions ?? {}), ...(component?.propertyDefinitions ?? {}) };
  const recordsById = new Map(records.map((record) => [record.bindingId, record]));
  const figmaTypeForProperty = { BOOLEAN: 'BOOLEAN', TEXT: 'STRING', INSTANCE_SWAP: 'STRING', VARIANT: 'STRING' };
  for (const binding of tokenBindings) {
    const record = recordsById.get(binding.bindingId);
    const match = record?.source?.propertyPath?.match(/^\/componentProperties\/([^/]+)$/);
    const name = match ? unescapePointerToken(match[1]) : null;
    const property = name ? propertyDefinitions[name] : null;
    if (!property || record.variable.figmaType !== figmaTypeForProperty[property.type]) throw new SemanticSliceError(`instance ${instance.nodeId} token binding ${binding.bindingId} disagrees with native component property type`);
  }
}
