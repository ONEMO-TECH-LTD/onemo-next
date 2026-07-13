/** Independent P2 semantic oracle: no graph-builder/normalizer imports. */
import { canonicalJson } from '../src/evidence.mjs';

export function documentMismatch(document, graph) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const rebuild = (id) => {
    const row = byId.get(id);
    if (!row) return null;
    return { ...structuredClone(row.properties), ...(row.childrenPresent ? { children: row.childIds.map(rebuild) } : {}) };
  };
  return canonicalJson(document) !== canonicalJson(rebuild(graph.rootId));
}

export function componentMismatch(components, supplement, graph) {
  const expectedDefinitions = [...(components.componentSets ?? []), ...(components.components ?? [])]
    .map((row) => structuredClone(row)).sort(byStableKey);
  const expectedInstances = (supplement.nodes ?? []).filter((row) => row.mainComponentKey).map((row) => ({
    nodeId: row.nodeId,
    mainComponentKey: row.mainComponentKey,
    componentProperties: structuredClone(row.componentProperties ?? {}),
    componentPropertyReferences: structuredClone(row.componentPropertyReferences ?? {}),
    overrides: structuredClone(row.overrides ?? []),
  })).sort(byNodeId);
  const expectedSupplements = (supplement.nodes ?? []).filter((row) => row.componentPropertyDefinitions !== undefined).map((row) => ({
    nodeId: row.nodeId,
    componentPropertyDefinitions: structuredClone(row.componentPropertyDefinitions),
  })).sort(byNodeId);
  return canonicalJson(expectedDefinitions) !== canonicalJson([...graph.definitions].sort(byStableKey)) ||
    canonicalJson(expectedSupplements) !== canonicalJson([...graph.definitionSupplements].sort(byNodeId)) ||
    canonicalJson(expectedInstances) !== canonicalJson([...graph.instances].sort(byNodeId));
}

export function textMismatch(document, supplement, graph) {
  const textIds = [];
  (function walk(node) { if (!node) return; if (node.type === 'TEXT') textIds.push(node.id); (node.children ?? []).forEach(walk); })(document);
  const supp = new Map((supplement.nodes ?? []).map((row) => [row.nodeId, row]));
  const expected = textIds.map((nodeId) => ({
    nodeId,
    segments: structuredClone(supp.get(nodeId)?.styledTextSegments ?? []),
    fontDependencies: structuredClone(supp.get(nodeId)?.fontDependencies ?? []),
  })).sort(byNodeId);
  return canonicalJson(expected) !== canonicalJson([...graph.textNodes].sort(byNodeId));
}

export function assetMismatch(assetIndex, graph) {
  return canonicalJson([...assetIndex].sort(byAsset)) !== canonicalJson([...graph.assets].sort(byAsset));
}

/** Independent G1-G5 challenge against the old thin IR shape. */
export function lossyLegacyFailures(canonical, legacy) {
  const legacyRows = [];
  (function walk(node) { if (!node) return; legacyRows.push(node); (node.children ?? []).forEach(walk); })(legacy.root);
  const rootSource = canonical.documentGraph.nodes.find((row) => row.id === canonical.documentGraph.rootId)?.properties;
  return {
    G1: rootSource?.clipsContent === true && legacy.root?.layout?.clips !== true,
    G2: canonical.bindingGraph.records.length > 0 && !legacy.bindingRecords,
    G3: canonical.variableGraph.variables.length > 0 && !legacy.modeContexts && !legacy.resolutionTraces,
    G4: canonical.componentGraph.instances.length > 0 && !legacyRows.some((row) => row.mainComponentKey || row.componentKey),
    G5: canonical.textGraph.textNodes.some((row) => row.segments.length > 1) && !legacyRows.some((row) => row.segments || row.styledTextSegments),
  };
}

const byStableKey = (a, b) => String(a.key).localeCompare(String(b.key));
const byNodeId = (a, b) => String(a.nodeId).localeCompare(String(b.nodeId));
const byAsset = (a, b) => `${a.kind}:${a.sourceId}`.localeCompare(`${b.kind}:${b.sourceId}`);
