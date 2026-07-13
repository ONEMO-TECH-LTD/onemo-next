/**
 * compiler-v2 · P2 BindingGraph (C11 v3 §5.3, §7, G2/G3).
 *
 * Turns classified alias occurrences (inventory.classifyOccurrences) into canonical
 * BindingRecords, resolved under each consuming node's effective mode context (variable-graph),
 * with:
 *   - one record per destination SLOT (never per occurrence-count; four shadow slots on one
 *     variable = four records — §5.3),
 *   - the full G2 source identity + a resolution trace id (G3),
 *   - unknown-carrier occurrences kept FATAL (the caller must not lower when unknown.length>0),
 *   - mirror occurrences linked, never emitted as their own record.
 *
 * Pure over {document, classified, variableGraph}. No I/O.
 */
import { SCHEMA, sourceBindingIdentity, validateBindingRecord } from './schema.mjs';
import { graphSourcePlaneErrors } from './provenance.mjs';

export class BindingGraphError extends Error {
  constructor(state, message) { super(message); this.state = state; }
}

/** Index nodes by id, capturing each bound node's resolvedVariableModes from the supplement. */
function nodeContexts(document, supplement, requiredNodeIds) {
  if (!supplement || supplement.schemaVersion !== SCHEMA.supplement || !Array.isArray(supplement.nodes)) {
    throw new BindingGraphError('FAILED_CAPTURE', 'complete versioned plugin supplement required before BindingGraph');
  }
  const modesByNode = new Map();
  for (const n of supplement.nodes) {
    if (!n?.nodeId || modesByNode.has(n.nodeId) || !n.resolvedVariableModes || typeof n.resolvedVariableModes !== 'object' || Array.isArray(n.resolvedVariableModes)) {
      throw new BindingGraphError('FAILED_CAPTURE', `invalid or duplicate supplement node ${n?.nodeId ?? '?'}`);
    }
    modesByNode.set(n.nodeId, n.resolvedVariableModes);
  }
  for (const nodeId of requiredNodeIds) if (!modesByNode.has(nodeId)) {
    throw new BindingGraphError('FAILED_CAPTURE', `supplement missing resolvedVariableModes for bound node ${nodeId}`);
  }
  const ctxByNode = new Map();
  (function walk(n) {
    if (!n) return;
    ctxByNode.set(n.id, modesByNode.get(n.id) ?? {});
    (n.children ?? []).forEach(walk);
  })(document);
  return ctxByNode;
}

/**
 * @param fileKey            the snapshot's file key (source identity)
 * @param document           raw REST document (for node contexts)
 * @param supplement         complete plugin supplement (resolvedVariableModes); REST_ONLY/PARTIAL
 *                           fails before graphs. Fixture provenance is legal only for §14.1 tests.
 * @param classified         { canonical, mirrors, nonvisual, unknown } from inventory
 * @param variableGraph      buildVariableGraph(variables.json)
 * @returns { records, unknown, mirrors, nonvisual } — records are canonical BindingRecords.
 */
export function buildBindingGraph({ fileKey, document, supplement, sourcePlanes, evidenceClass, classified, variableGraph }) {
  assertGraphSourcePlanes(sourcePlanes, evidenceClass);
  if (!fileKey || !document || !classified || !variableGraph) throw new BindingGraphError('FAILED_CAPTURE', 'BindingGraph input incomplete');
  if (classified.unknown?.length) throw new BindingGraphError('FAILED_CAPABILITY', `${classified.unknown.length} unknown binding carrier(s) block BindingGraph`);
  const requiredNodeIds = new Set(classified.canonical.map((o) => o.nodeId));
  const ctxByNode = nodeContexts(document, supplement, requiredNodeIds);
  const pending = [];
  for (const occ of classified.canonical) {
    const context = ctxByNode.get(occ.nodeId) ?? {};
    const v = variableGraph.byId.get(occ.variableId);
    if (!v) throw new BindingGraphError('FAILED_BINDING', `${occ.nodeId}${occ.propertyPath}: variable ${occ.variableId} absent from captured catalog`);
    let resolution;
    try { resolution = variableGraph.resolve(occ.variableId, context); }
    catch (e) { throw new BindingGraphError(e.state ?? 'FAILED_BINDING', `${occ.nodeId}${occ.propertyPath}: ${e.message}`); }
    const collectionKey = variableGraph.collById.get(v.variableCollectionId)?.key;
    if (!collectionKey) throw new BindingGraphError('FAILED_BINDING', `${occ.nodeId}${occ.propertyPath}: variable collection has no stable key`);
    pending.push({ occ, context, v, collectionKey, resolution });
  }
  const usedBySubtree = subtreeCollections(document, pending);
  const records = pending.map(({ occ, context, v, collectionKey, resolution }) => makeRecord({
    fileKey, occ, v, collectionKey, resolution,
    modeContextId: variableGraph.modeContextId(context, usedBySubtree.get(occ.nodeId) ?? []),
  }));
  const resolutionTraces = [...new Map(pending.map(({ resolution }) => [resolution.traceId, {
    traceId: resolution.traceId,
    hops: structuredClone(resolution.trace),
  }])).values()].sort((a, b) => a.traceId.localeCompare(b.traceId));
  return { schemaVersion: SCHEMA.bindingGraph, records, resolutionTraces, unknown: classified.unknown, mirrors: classified.mirrors, nonvisual: classified.nonvisual };
}

function makeRecord({ fileKey, occ, v, collectionKey, resolution, modeContextId }) {
  const rec = {
    schemaVersion: SCHEMA.bindingRecord,
    bindingId: 'pending',
    source: {
      fileKey, nodeId: occ.nodeId, propertyPath: occ.propertyPath,
      ...(occ.slot ? { slot: occ.slot } : {}),
      ...(occ.textRange ? { textRange: occ.textRange } : {}),
    },
    variable: {
      key: v.key,
      captureId: occ.variableId,
      collectionKey,
      figmaType: v.resolvedType,
    },
    modeContextId,
    resolutionTraceId: resolution.traceId,
    destinationDomain: occ.destinationDomain,
    emissionTarget: reactDomain(occ.destinationDomain) ? 'react' : 'css',
    disposition: 'pending',
  };
  rec.bindingId = sourceBindingIdentity(rec);
  const errors = validateBindingRecord(rec);
  if (errors.length) throw new BindingGraphError('FAILED_BINDING', `${occ.nodeId}${occ.propertyPath}: invalid BindingRecord: ${errors.join('; ')}`);
  return rec;
}

const REACT_DOMAINS = new Set(['react-content', 'react-visibility', 'react-component-prop']);
const reactDomain = (d) => REACT_DOMAINS.has(d);

function assertGraphSourcePlanes(sourcePlanes, evidenceClass) {
  const errors = graphSourcePlaneErrors({ sourcePlanes, evidenceClass, families: ['document', 'variables', 'supplement'] });
  if (errors.length) throw new BindingGraphError('FAILED_CAPTURE', `${evidenceClass ?? 'unknown'} graph source incomplete: ${errors.join(', ')}`);
}

/** Collections used by a node's reachable bound subtree, propagated child → ancestors (V5/V14). */
function subtreeCollections(document, pending) {
  const parentById = new Map();
  (function walk(node, parent = null) {
    if (!node) return;
    parentById.set(node.id, parent);
    (node.children ?? []).forEach((child) => walk(child, node.id));
  })(document);
  const used = new Map();
  for (const { occ, resolution } of pending) {
    for (let nodeId = occ.nodeId; nodeId; nodeId = parentById.get(nodeId)) {
      if (!used.has(nodeId)) used.set(nodeId, new Set());
      for (const hop of resolution.trace) used.get(nodeId).add(hop.collectionId);
    }
  }
  return used;
}

/**
 * G2 conservation multiset: the identity of every canonical binding in the raw document must
 * equal the identity multiset the IR carries. Returns { raw, ir, missing, extra } — missing/extra
 * non-empty is a G2 fatal. Keyed on the full sourceBindingIdentity (variable stable key required).
 */
export function conservationDiff(rawRecords, irRecords) {
  const key = (r) => sourceBindingIdentity(r);
  const count = (list) => { const m = new Map(); for (const r of list) m.set(key(r), (m.get(key(r)) ?? 0) + 1); return m; };
  const raw = count(rawRecords), ir = count(irRecords);
  const missing = [], extra = [];
  for (const [k, n] of raw) if ((ir.get(k) ?? 0) < n) missing.push(k);
  for (const [k, n] of ir) if ((raw.get(k) ?? 0) < n) extra.push(k);
  return { missing, extra, conserved: missing.length === 0 && extra.length === 0 };
}
