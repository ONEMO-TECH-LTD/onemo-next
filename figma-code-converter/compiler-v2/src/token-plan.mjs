/** P3 token planner: registry channels + node-local resolution -> typed CSS/React data. */
import { SCHEMA } from './schema.mjs';
import { parseCanonicalModel } from './canonical-model.mjs';
import { buildVariableGraph } from './variable-graph.mjs';
import { codec, isSupported, tokenLeaf } from './codecs.mjs';
import { registryHash, validateRegistry } from './token-registry.mjs';
import { canonicalJson } from './evidence.mjs';

export class TokenPlanError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_BINDING'; }
}

export function buildTokenPlan({ model: input, registry, codecOptions = () => ({}) }) {
  const model = parseCanonicalModel(input);
  validateRegistry(registry);
  if (typeof codecOptions !== 'function') throw new TokenPlanError('codecOptions must be a function');
  const runtime = buildVariableGraph({ variables: model.variableGraph.variables, variableCollections: model.variableGraph.collections });
  const collectionByKey = new Map(model.variableGraph.collections.map((row) => [row.key, row]));
  const variableByKey = new Map(model.variableGraph.variables.map((row) => [row.key, row]));
  const channelOptions = new Map();
  const bindings = [];

  for (const record of model.bindingGraph.records) {
    const entry = registry.entries[record.variable.key];
    const channel = entry?.channels?.[record.destinationDomain];
    if (!entry || entry.figmaType !== record.variable.figmaType || !channel || channel.target !== record.emissionTarget) throw new TokenPlanError(`registry channel missing/type-wrong for binding ${record.bindingId}`);
    const context = contextFromId(record.modeContextId, collectionByKey);
    let resolved;
    try { resolved = runtime.resolve(record.variable.captureId, context); }
    catch (error) { throw new TokenPlanError(`binding ${record.bindingId} resolution failed: ${error.message}`); }
    if (resolved.traceId !== record.resolutionTraceId || resolved.modeContextId !== record.modeContextId) throw new TokenPlanError(`binding ${record.bindingId} resolution trace/context drift`);
    const options = structuredClone(codecOptions(structuredClone(record)) ?? {});
    const priorOptions = channelOptions.get(channel.channelId);
    if (priorOptions && canonicalJson(priorOptions) !== canonicalJson(options)) throw new TokenPlanError(`channel ${channel.channelId} has conflicting codec options`);
    channelOptions.set(channel.channelId, options);
    const leaf = tokenLeaf({
      variableKey: record.variable.key,
      channelId: channel.channelId,
      target: channel.target,
      figmaType: record.variable.figmaType,
      destinationDomain: record.destinationDomain,
    });
    const expression = codec(record.destinationDomain, leaf, resolved, options);
    if (!isSupported(expression)) throw new TokenPlanError(`bound value ${record.bindingId} unsupported: ${expression.unsupported}`);
    bindings.push({
      bindingId: record.bindingId,
      source: structuredClone(record.source),
      variableKey: record.variable.key,
      channelId: channel.channelId,
      destinationDomain: record.destinationDomain,
      target: channel.target,
      modeContextId: record.modeContextId,
      resolutionTraceId: record.resolutionTraceId,
      expression,
    });
  }

  const usedChannels = new Map();
  for (const binding of bindings) {
    if (!usedChannels.has(binding.channelId)) usedChannels.set(binding.channelId, []);
    usedChannels.get(binding.channelId).push(binding);
  }
  const css = [], react = [];
  for (const [variableKey, entry] of Object.entries(registry.entries).sort()) {
    const variable = variableByKey.get(variableKey);
    if (!variable) continue;
    const collection = model.variableGraph.collections.find((row) => row.id === variable.variableCollectionId);
    if (!collection) throw new TokenPlanError(`variable ${variableKey} collection missing`);
    for (const [domain, channel] of Object.entries(entry.channels).sort()) {
      if (!usedChannels.has(channel.channelId)) continue;
      const options = channelOptions.get(channel.channelId) ?? {};
      const contexts = [...new Set(usedChannels.get(channel.channelId).map((binding) => binding.modeContextId))].sort().map((modeContextId) => {
        const resolved = runtime.resolve(variable.id, contextFromId(modeContextId, collectionByKey));
        return {
          modeContextId,
          resolutionTraceId: resolved.traceId,
          value: channelValue(domain, resolved, options),
        };
      });
      const row = {
        variableKey,
        collectionKey: collection.key,
        figmaType: variable.resolvedType,
        destinationDomain: domain,
        channelId: channel.channelId,
        target: channel.target,
        ...(channel.cssName ? { cssName: channel.cssName } : {}),
        ...(channel.tsSymbol ? { tsSymbol: channel.tsSymbol } : {}),
        contexts,
      };
      (channel.target === 'css' ? css : react).push(row);
    }
  }
  return { schemaVersion: SCHEMA.tokenPlan, registryGeneration: registry.generation, registryHash: registryHash(registry), bindings, tokenData: { css, react } };
}

function contextFromId(id, collectionByKey) {
  if (id === 'ø') return {};
  const context = {};
  for (const part of String(id).split(',')) {
    const split = part.indexOf('=');
    const key = split > 0 ? part.slice(0, split) : '';
    const modeId = split > 0 ? part.slice(split + 1) : '';
    const collection = collectionByKey.get(key);
    if (!collection || !collection.modes.some((mode) => mode.modeId === modeId)) throw new TokenPlanError(`unknown mode context segment ${part}`);
    context[collection.id] = modeId;
  }
  return context;
}

function channelValue(domain, resolved, options) {
  const value = resolved.value;
  switch (domain) {
    case 'color': return { kind: 'color', space: 'srgb', channels: [value.r, value.g, value.b], alpha: value.a ?? 1 };
    case 'length-px': return { kind: 'number', value, unit: 'px' };
    case 'number': return { kind: 'number', value };
    case 'opacity-normalized':
      if (options.opacityScale === 'percent' && value >= 0 && value <= 100) return { kind: 'number', value: value / 100 };
      if (options.opacityScale === 'normalized' && value >= 0 && value <= 1) return { kind: 'number', value };
      throw new TokenPlanError(`opacity channel value ${value} lacks a valid explicit scale`);
    case 'string-typography': return { kind: 'string', value };
    case 'react-content':
    case 'react-visibility':
    case 'react-component-prop': return { kind: 'react-value', figmaType: resolved.figmaType, value: structuredClone(value) };
    default: throw new TokenPlanError(`no channel serializer for ${domain}`);
  }
}
