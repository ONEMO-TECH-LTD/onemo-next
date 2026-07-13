/** One P2 entry point: a single sealed snapshot becomes one versioned canonical model. */
import { SCHEMA, schemaError, sourceBindingIdentity, validateBindingRecord } from './schema.mjs';
import { collectOccurrences, classifyOccurrences } from './inventory.mjs';
import { buildDocumentGraph } from './document-graph.mjs';
import { buildVariableGraph, traceIdOf } from './variable-graph.mjs';
import { buildBindingGraph } from './binding-graph.mjs';
import { buildComponentGraph } from './component-graph.mjs';
import { buildTextGraph } from './text-graph.mjs';
import { buildAssetGraph } from './asset-graph.mjs';
import { graphSourcePlaneErrors } from './provenance.mjs';
import { canonicalJson } from './evidence.mjs';

export class CanonicalModelError extends Error {
  constructor(state, message, options) { super(message, options); this.state = state; }
}

export function buildCanonicalModel({ snapshot, evidenceClass, fileKey = snapshot?.manifest?.fileKey }) {
  if (!snapshot?.manifest || !snapshot.document || !snapshot.variables || !snapshot.components || !snapshot.supplement || !snapshot.dependencies) {
    throw new CanonicalModelError('FAILED_CAPTURE', 'canonical model requires one complete sealed snapshot');
  }
  const sourcePlanes = snapshot.manifest.sourcePlanes;
  const planeErrors = graphSourcePlaneErrors({
    sourcePlanes,
    evidenceClass,
    families: ['document', 'supplement', 'variables', 'components', 'fonts', 'assets', 'dependencies'],
  });
  if (planeErrors.length) throw new CanonicalModelError('FAILED_CAPTURE', `canonical model provenance incomplete: ${planeErrors.join(', ')}`);
  const classified = classifyOccurrences(collectOccurrences(snapshot.document), snapshot.document);
  if (classified.unknown.length) {
    throw new CanonicalModelError('FAILED_CAPABILITY', `${classified.unknown.length} unknown alias carrier(s) block every downstream graph`);
  }
  try {
    const documentGraph = buildDocumentGraph({ document: snapshot.document, sourcePlanes, evidenceClass });
    const variableGraph = buildVariableGraph(snapshot.variables);
    const bindingGraph = buildBindingGraph({
      fileKey, document: snapshot.document, supplement: snapshot.supplement, sourcePlanes,
      evidenceClass, classified, variableGraph,
    });
    const componentGraph = buildComponentGraph({ document: snapshot.document, components: snapshot.components, supplement: snapshot.supplement, sourcePlanes, evidenceClass });
    const textGraph = buildTextGraph({ document: snapshot.document, supplement: snapshot.supplement, sourcePlanes, evidenceClass });
    const assetGraph = buildAssetGraph({
      document: snapshot.document,
      assetIndex: snapshot.dependencies.assets ?? [],
      assetNodeIds: snapshot.dependencies.assetNodeIds ?? [],
      sealedFiles: snapshot.manifest.files,
      sourcePlanes,
      evidenceClass,
    });
    return {
      schemaVersion: SCHEMA.canonicalModel,
      documentGraph,
      variableGraph: variableGraph.toJSON({ nodeModeContexts: bindingGraph.nodeModeContexts }),
      bindingGraph,
      componentGraph,
      textGraph,
      assetGraph,
    };
  } catch (error) {
    if (error instanceof CanonicalModelError) throw error;
    throw new CanonicalModelError(error.state ?? 'FAILED_CAPABILITY', error.message, { cause: error });
  }
}

/** Refuse-on-read parser for the persisted P2 boundary; unknown/missing nested schemas never flow on. */
export function parseCanonicalModel(value) {
  const errors = [];
  const modelError = schemaError('canonicalModel', value);
  if (modelError) errors.push(modelError);
  const graphKinds = [
    ['documentGraph', 'documentGraph', ['nodes']],
    ['variableGraph', 'variableGraph', ['variables', 'collections', 'resolutionTraces', 'nodeModeContexts']],
    ['bindingGraph', 'bindingGraph', ['records', 'resolutionTraces', 'nodeModeContexts']],
    ['componentGraph', 'componentGraph', ['definitions', 'definitionSupplements', 'instances']],
    ['textGraph', 'textGraph', ['textNodes']],
    ['assetGraph', 'assetGraph', ['assets']],
  ];
  for (const [field, kind, arrays] of graphKinds) {
    const graph = value?.[field];
    const versionError = schemaError(kind, graph);
    if (versionError) errors.push(versionError);
    for (const name of arrays) if (!Array.isArray(graph?.[name])) errors.push(`${field}.${name} must be an array`);
  }
  for (const [index, record] of (value?.bindingGraph?.records ?? []).entries()) {
    errors.push(...validateBindingRecord(record).map((error) => `bindingGraph.records[${index}]: ${error}`));
  }
  if (errors.length === 0) validatePersistedGraphs(value, errors);
  if (errors.length) throw new CanonicalModelError('FAILED_CAPABILITY', `canonical model schema refused: ${errors.join('; ')}`);
  return structuredClone(value);
}

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value) => typeof value === 'string' && value.length > 0;
const add = (errors, path, condition, message = 'invalid') => { if (!condition) errors.push(`${path} ${message}`); };

function validatePersistedGraphs(model, errors) {
  const documentNodes = validateDocument(model.documentGraph, errors);
  const variables = validateVariables(model.variableGraph, errors);
  const contexts = validateContexts(model.variableGraph, model.bindingGraph, documentNodes, variables, errors);
  validateBindingInventory(model.documentGraph, model.bindingGraph, documentNodes, errors);
  validateBindings(model.bindingGraph, documentNodes, variables, contexts, errors);
  validateComponents(model.componentGraph, documentNodes, errors);
  validateText(model.textGraph, documentNodes, errors);
  validateAssets(model.assetGraph, documentNodes, errors);
}

function validateBindingInventory(documentGraph, bindingGraph, documentNodes, errors) {
  const rebuild = (nodeId) => {
    const row = documentNodes.get(nodeId);
    if (!row) return null;
    return {
      ...structuredClone(row.properties),
      ...(row.childrenPresent ? { children: row.childIds.map(rebuild) } : {}),
    };
  };
  const document = rebuild(documentGraph.rootId);
  const classified = classifyOccurrences(collectOccurrences(document), document);
  if (classified.unknown.length) errors.push(`bindingGraph source reconstruction has ${classified.unknown.length} unknown carrier(s)`);
  for (const name of ['unknown', 'mirrors', 'nonvisual']) {
    if (canonicalJson(classified[name]) !== canonicalJson(bindingGraph[name])) errors.push(`bindingGraph.${name} disagrees with reconstructed source classification`);
  }
  const occurrenceKey = (row) => canonicalJson({
    nodeId: row.nodeId,
    propertyPath: row.propertyPath,
    slot: row.slot ?? null,
    variableId: row.variableId,
    destinationDomain: row.destinationDomain,
  });
  const recordKey = (row) => canonicalJson({
    nodeId: row.source?.nodeId,
    propertyPath: row.source?.propertyPath,
    slot: row.source?.slot ?? null,
    variableId: row.variable?.captureId,
    destinationDomain: row.destinationDomain,
  });
  const expected = multiset(classified.canonical.map(occurrenceKey));
  const actual = multiset(bindingGraph.records.map(recordKey));
  if (canonicalJson(Object.fromEntries([...expected].sort())) !== canonicalJson(Object.fromEntries([...actual].sort()))) {
    errors.push('bindingGraph.records disagree with reconstructed canonical source slots');
  }
}

function multiset(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function validateDocument(graph, errors) {
  add(errors, 'documentGraph.rootId', string(graph.rootId), 'missing');
  add(errors, 'documentGraph.nodes', graph.nodes.length > 0, 'must not be empty');
  const byId = new Map();
  for (const [index, node] of graph.nodes.entries()) {
    const path = `documentGraph.nodes[${index}]`;
    add(errors, `${path}.id`, string(node?.id), 'missing');
    add(errors, `${path}.parentId`, node?.parentId === null || string(node?.parentId));
    add(errors, `${path}.zIndex`, Number.isInteger(node?.zIndex) && node.zIndex >= 0);
    add(errors, `${path}.childIds`, Array.isArray(node?.childIds) && node.childIds.every(string));
    add(errors, `${path}.childrenPresent`, typeof node?.childrenPresent === 'boolean');
    add(errors, `${path}.properties`, object(node?.properties));
    add(errors, `${path}.properties.id`, node?.properties?.id === node?.id, 'must equal node id');
    add(errors, `${path}.properties.type`, string(node?.properties?.type), 'missing');
    if (string(node?.id)) {
      if (byId.has(node.id)) errors.push(`${path}.id duplicate ${node.id}`);
      byId.set(node.id, node);
    }
  }
  const root = byId.get(graph.rootId);
  add(errors, 'documentGraph.rootId', Boolean(root), 'does not reference a node');
  if (root) add(errors, 'documentGraph.root.parentId', root.parentId === null, 'must be null');
  for (const node of byId.values()) {
    if (!Array.isArray(node.childIds)) continue;
    if (node.childrenPresent === false && node.childIds.length) errors.push(`documentGraph node ${node.id} hides declared children`);
    if (new Set(node.childIds).size !== node.childIds.length) errors.push(`documentGraph node ${node.id} has duplicate child ids`);
    node.childIds.forEach((childId, index) => {
      const child = byId.get(childId);
      if (!child) errors.push(`documentGraph node ${node.id} references missing child ${childId}`);
      else {
        if (child.parentId !== node.id) errors.push(`documentGraph child ${childId} parent mismatch`);
        if (child.zIndex !== index) errors.push(`documentGraph child ${childId} zIndex mismatch`);
      }
    });
    if (node.id !== graph.rootId) {
      const parent = byId.get(node.parentId);
      if (!parent || !parent.childIds?.includes(node.id)) errors.push(`documentGraph node ${node.id} has no reciprocal parent relationship`);
    }
  }
  if (root) {
    const reached = new Set();
    const visit = (node) => {
      if (reached.has(node.id)) { errors.push(`documentGraph cycle/repeated reach at ${node.id}`); return; }
      reached.add(node.id);
      for (const childId of node.childIds ?? []) { const child = byId.get(childId); if (child) visit(child); }
    };
    visit(root);
    if (reached.size !== byId.size) errors.push('documentGraph contains disconnected nodes');
  }
  return byId;
}

function validateVariables(graph, errors) {
  try { buildVariableGraph({ variables: graph.variables, variableCollections: graph.collections }); }
  catch (error) { errors.push(`variableGraph catalog invalid: ${error.message}`); }
  const byKey = new Map();
  const collectionKeyById = new Map();
  const modesByCollectionKey = new Map();
  for (const collection of graph.collections) {
    if (string(collection?.id) && string(collection?.key)) collectionKeyById.set(collection.id, collection.key);
    if (string(collection?.key)) modesByCollectionKey.set(collection.key, new Set((collection.modes ?? []).map((mode) => mode?.modeId)));
  }
  for (const [index, variable] of graph.variables.entries()) {
    add(errors, `variableGraph.variables[${index}].name`, string(variable?.name), 'missing');
    if (string(variable?.key)) byKey.set(variable.key, variable);
  }
  validateResolutionTraces(graph.resolutionTraces, 'variableGraph.resolutionTraces', errors, true, { byKey, collectionKeyById });
  return { byKey, collectionKeyById, modesByCollectionKey };
}

function validateContexts(variableGraph, bindingGraph, documentNodes, variables, errors) {
  const inspect = (rows, path) => {
    const byNode = new Map();
    for (const [index, row] of rows.entries()) {
      add(errors, `${path}[${index}].nodeId`, string(row?.nodeId), 'missing');
      add(errors, `${path}[${index}].modeContextId`, string(row?.modeContextId), 'missing');
      if (string(row?.modeContextId)) validateModeContextId(row.modeContextId, `${path}[${index}].modeContextId`, variables.modesByCollectionKey, errors);
      if (string(row?.nodeId)) {
        if (byNode.has(row.nodeId)) errors.push(`${path} duplicate node ${row.nodeId}`);
        byNode.set(row.nodeId, row.modeContextId);
      }
    }
    for (const id of documentNodes.keys()) if (!byNode.has(id)) errors.push(`${path} missing document node ${id}`);
    for (const id of byNode.keys()) if (!documentNodes.has(id)) errors.push(`${path} references missing document node ${id}`);
    return byNode;
  };
  const variableContexts = inspect(variableGraph.nodeModeContexts, 'variableGraph.nodeModeContexts');
  const bindingContexts = inspect(bindingGraph.nodeModeContexts, 'bindingGraph.nodeModeContexts');
  for (const [nodeId, contextId] of variableContexts) {
    if (bindingContexts.get(nodeId) !== contextId) errors.push(`node mode context disagreement at ${nodeId}`);
  }
  return variableContexts;
}

function validateBindings(graph, documentNodes, variables, contexts, errors) {
  validateResolutionTraces(graph.resolutionTraces, 'bindingGraph.resolutionTraces', errors, false, variables);
  const traceIds = new Set(graph.resolutionTraces.map((trace) => trace?.traceId));
  const ids = new Set();
  for (const [index, record] of graph.records.entries()) {
    const path = `bindingGraph.records[${index}]`;
    if (ids.has(record?.bindingId)) errors.push(`${path}.bindingId duplicate`);
    ids.add(record?.bindingId);
    if (documentNodes.has(record?.source?.nodeId) === false) errors.push(`${path}.source.nodeId missing from DocumentGraph`);
    const variable = variables.byKey.get(record?.variable?.key);
    if (!variable || variable.id !== record?.variable?.captureId || variable.resolvedType !== record?.variable?.figmaType) errors.push(`${path}.variable disagrees with VariableGraph`);
    else if (variables.collectionKeyById.get(variable.variableCollectionId) !== record.variable.collectionKey) errors.push(`${path}.variable.collectionKey disagrees with VariableGraph`);
    if (contexts.get(record?.source?.nodeId) !== record?.modeContextId) errors.push(`${path}.modeContextId disagrees with node context`);
    if (!traceIds.has(record?.resolutionTraceId)) errors.push(`${path}.resolutionTraceId missing from BindingGraph traces`);
    try { if (record.bindingId !== sourceBindingIdentity(record)) errors.push(`${path}.bindingId disagrees with identity fields`); }
    catch (error) { errors.push(`${path}.bindingId cannot be recomputed: ${error.message}`); }
  }
  for (const name of ['unknown', 'mirrors', 'nonvisual']) add(errors, `bindingGraph.${name}`, Array.isArray(graph[name]), 'must be an array');
}

function validateResolutionTraces(traces, path, errors, requireContext, variables) {
  const ids = new Set();
  for (const [index, trace] of traces.entries()) {
    const at = `${path}[${index}]`;
    add(errors, `${at}.traceId`, string(trace?.traceId), 'missing');
    if (requireContext) add(errors, `${at}.modeContextId`, string(trace?.modeContextId), 'missing');
    add(errors, `${at}.hops`, Array.isArray(trace?.hops) && trace.hops.length > 0, 'must be a non-empty array');
    if (string(trace?.traceId)) {
      const identity = requireContext ? `${trace.traceId}\u241f${trace.modeContextId}` : trace.traceId;
      if (ids.has(identity)) errors.push(`${at}.traceId duplicate`);
      ids.add(identity);
      if (Array.isArray(trace?.hops) && trace.hops.length && traceIdOf(trace.hops) !== trace.traceId) errors.push(`${at}.traceId disagrees with hops`);
    }
    for (const [hopIndex, hop] of (trace?.hops ?? []).entries()) {
      for (const field of ['captureId', 'key', 'collectionId', 'collectionKey', 'modeId']) add(errors, `${at}.hops[${hopIndex}].${field}`, string(hop?.[field]), 'missing');
      const variable = variables?.byKey?.get(hop?.key);
      if (!variable || variable.id !== hop?.captureId || variable.variableCollectionId !== hop?.collectionId || variables.collectionKeyById.get(hop?.collectionId) !== hop?.collectionKey) {
        errors.push(`${at}.hops[${hopIndex}] disagrees with VariableGraph`);
      }
    }
  }
}

function validateModeContextId(value, path, modesByCollectionKey, errors) {
  if (value === 'ø') return;
  const seen = new Set();
  for (const part of value.split(',')) {
    const split = part.indexOf('=');
    const collectionKey = split > 0 ? part.slice(0, split) : '';
    const modeId = split > 0 ? part.slice(split + 1) : '';
    if (!string(collectionKey) || !string(modeId) || seen.has(collectionKey) || !modesByCollectionKey.get(collectionKey)?.has(modeId)) {
      errors.push(`${path} contains unknown or malformed collection/mode ${part}`);
    }
    seen.add(collectionKey);
  }
}

function validateComponents(graph, documentNodes, errors) {
  const byKey = new Map();
  const byId = new Map();
  for (const [index, definition] of graph.definitions.entries()) {
    const path = `componentGraph.definitions[${index}]`;
    for (const field of ['id', 'key', 'name']) add(errors, `${path}.${field}`, string(definition?.[field]), 'missing');
    add(errors, `${path}.complete`, definition?.complete === true, 'must be true');
    validatePropertyDefinitions(definition?.propertyDefinitions, `${path}.propertyDefinitions`, errors);
    if (string(definition?.key)) {
      if (byKey.has(definition.key)) errors.push(`${path}.key duplicate`);
      byKey.set(definition.key, definition);
    }
    if (string(definition?.id)) byId.set(definition.id, definition);
  }
  for (const [index, definition] of graph.definitions.entries()) {
    if (definition?.componentSetKey && !byKey.has(definition.componentSetKey)) errors.push(`componentGraph.definitions[${index}].componentSetKey missing from catalog`);
  }
  for (const [index, row] of graph.definitionSupplements.entries()) {
    const path = `componentGraph.definitionSupplements[${index}]`;
    const node = documentNodes.get(row?.nodeId);
    add(errors, `${path}.nodeId`, Boolean(node) && ['COMPONENT', 'COMPONENT_SET'].includes(node?.properties?.type), 'must reference a native component node');
    validatePropertyDefinitions(row?.componentPropertyDefinitions, `${path}.componentPropertyDefinitions`, errors);
    const catalog = byId.get(row?.nodeId);
    add(errors, `${path}.catalog`, Boolean(catalog), 'definition missing from catalog');
    if (catalog && canonicalJson(catalog.propertyDefinitions ?? {}) !== canonicalJson(row.componentPropertyDefinitions ?? {})) errors.push(`${path} disagrees with catalog property definitions`);
  }
  const seenInstances = new Set();
  for (const [index, row] of graph.instances.entries()) {
    const path = `componentGraph.instances[${index}]`;
    add(errors, `${path}.nodeId`, string(row?.nodeId), 'missing');
    add(errors, `${path}.mainComponentKey`, string(row?.mainComponentKey) && byKey.has(row.mainComponentKey), 'missing from catalog');
    add(errors, `${path}.componentProperties`, object(row?.componentProperties));
    add(errors, `${path}.componentPropertyReferences`, object(row?.componentPropertyReferences));
    add(errors, `${path}.overrides`, Array.isArray(row?.overrides));
    add(errors, `${path}.documentNode`, documentNodes.get(row?.nodeId)?.properties?.type === 'INSTANCE', 'must reference INSTANCE');
    const component = byKey.get(row?.mainComponentKey);
    const parent = component?.componentSetKey ? byKey.get(component.componentSetKey) : null;
    const definitions = { ...(parent?.propertyDefinitions ?? {}), ...(component?.propertyDefinitions ?? {}) };
    for (const [name, property] of Object.entries(row?.componentProperties ?? {})) {
      const definition = definitions[name];
      if (!definition || property?.type !== definition.type || !Object.hasOwn(property ?? {}, 'value')) errors.push(`${path}.componentProperties.${name} disagrees with typed API`);
      else if (definition.type === 'VARIANT' && !definition.variantOptions?.includes(property.value)) errors.push(`${path}.componentProperties.${name} has illegal variant`);
      else if (definition.type === 'BOOLEAN' && typeof property.value !== 'boolean') errors.push(`${path}.componentProperties.${name} must be boolean`);
      else if (definition.type === 'TEXT' && typeof property.value !== 'string') errors.push(`${path}.componentProperties.${name} must be string`);
    }
    for (const [overrideIndex, override] of (row?.overrides ?? []).entries()) {
      add(errors, `${path}.overrides[${overrideIndex}].id`, string(override?.id), 'missing');
      add(errors, `${path}.overrides[${overrideIndex}].overriddenFields`, Array.isArray(override?.overriddenFields) && override.overriddenFields.every(string));
    }
    if (seenInstances.has(row?.nodeId)) errors.push(`${path}.nodeId duplicate`);
    seenInstances.add(row?.nodeId);
  }
  for (const node of documentNodes.values()) if (node.properties?.type === 'INSTANCE' && !seenInstances.has(node.id)) errors.push(`componentGraph missing INSTANCE ${node.id}`);
}

function validatePropertyDefinitions(definitions, path, errors) {
  add(errors, path, object(definitions));
  if (!object(definitions)) return;
  for (const [name, definition] of Object.entries(definitions)) {
    add(errors, `${path}.${name}.type`, ['BOOLEAN', 'TEXT', 'INSTANCE_SWAP', 'VARIANT'].includes(definition?.type));
    add(errors, `${path}.${name}.defaultValue`, Object.hasOwn(definition ?? {}, 'defaultValue'), 'missing');
    if (definition?.type === 'VARIANT') add(errors, `${path}.${name}.variantOptions`, Array.isArray(definition.variantOptions) && definition.variantOptions.includes(definition.defaultValue));
  }
}

function validateText(graph, documentNodes, errors) {
  const seen = new Set();
  for (const [index, row] of graph.textNodes.entries()) {
    const path = `textGraph.textNodes[${index}]`;
    const node = documentNodes.get(row?.nodeId);
    add(errors, `${path}.nodeId`, node?.properties?.type === 'TEXT', 'must reference TEXT node');
    add(errors, `${path}.segments`, Array.isArray(row?.segments));
    add(errors, `${path}.fontDependencies`, Array.isArray(row?.fontDependencies));
    if (seen.has(row?.nodeId)) errors.push(`${path}.nodeId duplicate`);
    seen.add(row?.nodeId);
    const fonts = new Set();
    for (const [fontIndex, font] of (row?.fontDependencies ?? []).entries()) {
      const fontPath = `${path}.fontDependencies[${fontIndex}]`;
      add(errors, `${fontPath}.family`, string(font?.family), 'missing');
      add(errors, `${fontPath}.style`, string(font?.style), 'missing');
      add(errors, `${fontPath}.providerId`, string(font?.providerId), 'missing');
      add(errors, `${fontPath}.sha256`, /^[0-9a-f]{64}$/i.test(font?.sha256 ?? ''));
      fonts.add(`${font?.family}\u241f${font?.style}`);
    }
    const characters = node?.properties?.characters ?? '';
    let cursor = 0;
    for (const [segmentIndex, segment] of (row?.segments ?? []).entries()) {
      const segmentPath = `${path}.segments[${segmentIndex}]`;
      const rangeValid = Number.isInteger(segment?.start) && Number.isInteger(segment?.end) && segment.start === cursor && segment.end > segment.start && segment.end <= characters.length;
      add(errors, `${segmentPath}.range`, rangeValid);
      if (rangeValid) {
        add(errors, `${segmentPath}.characters`, segment.characters === characters.slice(segment.start, segment.end), 'does not match source');
        cursor = segment.end;
      }
      add(errors, `${segmentPath}.fontName`, fonts.has(`${segment?.fontName?.family}\u241f${segment?.fontName?.style}`), 'has no pinned dependency');
    }
    add(errors, `${path}.segments`, cursor === characters.length, 'do not cover source characters');
  }
  for (const node of documentNodes.values()) if (node.properties?.type === 'TEXT' && !seen.has(node.id)) errors.push(`textGraph missing TEXT node ${node.id}`);
}

function validateAssets(graph, documentNodes, errors) {
  const identities = new Set();
  for (const [index, row] of graph.assets.entries()) {
    const path = `assetGraph.assets[${index}]`;
    add(errors, `${path}.kind`, ['image', 'svg', 'export'].includes(row?.kind));
    add(errors, `${path}.sourceId`, string(row?.sourceId), 'missing');
    add(errors, `${path}.file`, typeof row?.file === 'string' && row.file.startsWith('assets/') && !row.file.includes('..') && !/^(?:[a-z]+:)?\/\//i.test(row.file));
    add(errors, `${path}.sha256`, /^[0-9a-f]{64}$/i.test(row?.sha256 ?? ''));
    add(errors, `${path}.bytes`, Number.isInteger(row?.bytes) && row.bytes >= 0);
    add(errors, `${path}.mime`, string(row?.mime), 'missing');
    add(errors, `${path}.width`, Number.isFinite(row?.width) && row.width > 0);
    add(errors, `${path}.height`, Number.isFinite(row?.height) && row.height > 0);
    const identity = `${row?.kind}:${row?.sourceId}`;
    if (identities.has(identity)) errors.push(`${path} duplicate identity ${identity}`);
    identities.add(identity);
    if (['svg', 'export'].includes(row?.kind)) add(errors, `${path}.sourceId`, documentNodes.has(row.sourceId), 'does not reference a document node');
  }
  const imageRefs = new Set();
  for (const node of documentNodes.values()) collectImageRefs(node.properties, imageRefs);
  for (const ref of imageRefs) if (!identities.has(`image:${ref}`)) errors.push(`assetGraph missing imageRef ${ref}`);
}

function collectImageRefs(value, refs) {
  if (Array.isArray(value)) { value.forEach((item) => collectImageRefs(item, refs)); return; }
  if (!object(value)) return;
  if (string(value.imageRef)) refs.add(value.imageRef);
  Object.values(value).forEach((item) => collectImageRefs(item, refs));
}
