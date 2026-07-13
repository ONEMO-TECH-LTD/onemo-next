/**
 * compiler-v2 · P2 VariableGraph (C11 v3 §5.2, §7.1 node-local modes, G3).
 *
 * Builds the lossless variable model from a snapshot's variables.json:
 *   - stable key ↔ capture-local id (stable key is the long-lived identity, §5.2)
 *   - values by mode, per-collection modes + default
 *   - alias edges with CYCLE DETECTION and a persisted resolution TRACE per {variable, context}
 *   - node-local effective mode context: alias resolution runs under the CONSUMING node's
 *     resolvedVariableModes, cross-collection, defaults inserted where a collection is unselected,
 *     root context NEVER substituted for a descendant (V5).
 *
 * Pure over the snapshot — no I/O. Resolution is memoized per {captureId, modeContextId}.
 */
import { SCHEMA } from './schema.mjs';

/** ModeContextId: canonical, order-independent digest of {collectionId → modeId}. */
export function modeContextId(collectionModeMap) {
  if (!collectionModeMap || typeof collectionModeMap !== 'object' || Array.isArray(collectionModeMap)) {
    throw new ResolutionError('FAILED_BINDING', 'mode context must be a collection→mode object');
  }
  const entries = Object.entries(collectionModeMap).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (entries.some(([c, m]) => !c || typeof m !== 'string' || !m)) throw new ResolutionError('FAILED_BINDING', 'mode context keys and mode ids must be non-empty strings');
  return entries.length ? entries.map(([c, m]) => `${c}=${m}`).join(',') : 'ø';
}

export class ResolutionError extends Error {
  constructor(state, message) { super(message); this.state = state; }
}

export function buildVariableGraph(variablesJson) {
  if (!variablesJson || typeof variablesJson !== 'object' || !Array.isArray(variablesJson.variables) || !Array.isArray(variablesJson.variableCollections)) {
    throw new ResolutionError('FAILED_CAPTURE', 'variables.json must contain variables[] and variableCollections[]');
  }
  const vars = variablesJson.variables;
  const colls = variablesJson.variableCollections;
  const collById = uniqueIndex(colls, 'id', 'collection');
  const collByKey = uniqueIndex(colls, 'key', 'collection');
  for (const c of colls) validateCollection(c);
  const byId = uniqueIndex(vars, 'id', 'variable');
  const byKey = new Map();
  for (const v of vars) {
    if (!v.key) throw new ResolutionError('FAILED_BINDING', `variable ${v.id} has no stable key (§6.1)`);
    if (byKey.has(v.key)) throw new ResolutionError('FAILED_BINDING', `duplicate variable stable key ${v.key}`);
    if (!['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(v.resolvedType)) throw new ResolutionError('FAILED_BINDING', `variable ${v.id} has unsupported type ${v.resolvedType}`);
    const collection = collById.get(v.variableCollectionId);
    if (!collection) throw new ResolutionError('FAILED_BINDING', `variable ${v.id} references unknown collection ${v.variableCollectionId}`);
    if (!v.valuesByMode || typeof v.valuesByMode !== 'object' || Array.isArray(v.valuesByMode)) throw new ResolutionError('FAILED_BINDING', `variable ${v.id} has no valuesByMode map`);
    for (const { modeId } of collection.modes) if (!Object.prototype.hasOwnProperty.call(v.valuesByMode, modeId)) {
      throw new ResolutionError('FAILED_BINDING', `variable ${v.id} missing value for mode ${modeId}`);
    }
    for (const modeId of Object.keys(v.valuesByMode)) if (!collection.modes.some((m) => m.modeId === modeId)) {
      throw new ResolutionError('FAILED_BINDING', `variable ${v.id} carries undeclared mode ${modeId}`);
    }
    byKey.set(v.key, v);
  }

  /** the effective mode for a collection under a context: explicit selection, else captured default. */
  const effectiveMode = (collectionId, context) => {
    validateContext(context ?? {}, collById);
    const c = collById.get(collectionId);
    if (!c) throw new ResolutionError('FAILED_BINDING', `unknown collection ${collectionId}`);
    if (Object.prototype.hasOwnProperty.call(context ?? {}, collectionId)) return context[collectionId];
    if (!c.defaultModeId) throw new ResolutionError('FAILED_BINDING', `collection ${collectionId} has no default mode`);
    return c.defaultModeId; // absence is the captured default, never the root's arbitrary selection (V5)
  };

  const traceMemo = new Map();

  /**
   * Resolve a capture-local variable id under a node-effective mode context to a concrete value,
   * following alias chains cross-collection. Returns { value, trace, traceId }. Cycles →
   * FAILED_BINDING (never a silent stop). The trace lists each hop's {captureId, key, collection,
   * modeId} so G3 can diff resolution routes.
   */
  const resolve = (captureId, context) => {
    validateContext(context ?? {}, collById);
    const mcId = graphModeContextId(context ?? {}, collById);
    const memoKey = `${captureId}␟${mcId}`;
    if (traceMemo.has(memoKey)) return traceMemo.get(memoKey);
    const trace = [];
    const seen = new Set();
    let curId = captureId;
    let expectedType = null;
    for (;;) {
      if (seen.has(curId)) throw new ResolutionError('FAILED_BINDING', `alias cycle at ${curId} (chain: ${[...seen].join(' → ')})`);
      seen.add(curId);
      const v = byId.get(curId);
      if (!v) throw new ResolutionError('FAILED_BINDING', `alias target ${curId} not in catalog (remote/library?)`);
      if (expectedType && v.resolvedType !== expectedType) throw new ResolutionError('FAILED_BINDING', `alias type mismatch: expected ${expectedType}, got ${v.resolvedType} at ${curId}`);
      expectedType ??= v.resolvedType;
      const modeId = effectiveMode(v.variableCollectionId, context);
      const collection = collById.get(v.variableCollectionId);
      trace.push({ captureId: curId, key: v.key, collectionId: v.variableCollectionId, collectionKey: collection.key, modeId });
      const raw = v.valuesByMode?.[modeId];
      if (raw && typeof raw === 'object' && raw.type === 'VARIABLE_ALIAS') { curId = raw.id; continue; }
      if (!validLiteral(v.resolvedType, raw)) throw new ResolutionError('FAILED_BINDING', `variable ${v.id} has invalid ${v.resolvedType} value in mode ${modeId}`);
      const out = { value: raw, figmaType: v.resolvedType, modeContextId: mcId, trace, traceId: traceIdOf(trace) };
      traceMemo.set(memoKey, out);
      return out;
    }
  };

  const toJSON = ({ nodeModeContexts = [] } = {}) => ({
    schemaVersion: SCHEMA.variableGraph,
    variables: structuredClone(vars),
    collections: structuredClone(colls),
    nodeModeContexts: structuredClone(nodeModeContexts),
    resolutionTraces: [...traceMemo.values()]
      .map(({ traceId, modeContextId: contextId, trace }) => ({ traceId, modeContextId: contextId, hops: structuredClone(trace) }))
      .sort((a, b) => `${a.traceId}:${a.modeContextId}`.localeCompare(`${b.traceId}:${b.modeContextId}`)),
  });
  return {
    schemaVersion: SCHEMA.variableGraph,
    byId, byKey, collById, collByKey, resolve, effectiveMode,
    modeContextId: (context, usedCollectionIds = Object.keys(context ?? {})) => graphModeContextId(context, collById, usedCollectionIds),
    toJSON,
  };
}

/** Deterministic id for a resolution trace — same route ⇒ same id, different route ⇒ different id. */
export function traceIdOf(trace) {
  return trace.map((h) => `${h.key}@${h.collectionKey ?? h.collectionId}:${h.modeId}`).join('>');
}

function uniqueIndex(items, field, label) {
  const out = new Map();
  for (const item of items) {
    const value = item?.[field];
    if (typeof value !== 'string' || !value) throw new ResolutionError('FAILED_CAPTURE', `${label} missing ${field}`);
    if (out.has(value)) throw new ResolutionError('FAILED_CAPTURE', `duplicate ${label} ${field} ${value}`);
    out.set(value, item);
  }
  return out;
}

function validateCollection(c) {
  if (!Array.isArray(c.modes) || c.modes.length === 0) throw new ResolutionError('FAILED_CAPTURE', `collection ${c.id} has no modes`);
  const seen = new Set();
  for (const mode of c.modes) {
    if (!mode?.modeId || typeof mode.modeId !== 'string' || seen.has(mode.modeId)) throw new ResolutionError('FAILED_CAPTURE', `collection ${c.id} has invalid/duplicate mode id`);
    seen.add(mode.modeId);
  }
  if (!c.defaultModeId || !seen.has(c.defaultModeId)) throw new ResolutionError('FAILED_CAPTURE', `collection ${c.id} default mode is missing or undeclared`);
}

function validateContext(context, collById) {
  modeContextId(context);
  for (const [collectionId, modeId] of Object.entries(context)) {
    const collection = collById.get(collectionId);
    if (!collection) throw new ResolutionError('FAILED_BINDING', `mode context references unknown collection ${collectionId}`);
    if (!collection.modes.some((m) => m.modeId === modeId)) throw new ResolutionError('FAILED_BINDING', `mode context selects unknown mode ${modeId} for ${collectionId}`);
  }
}

function graphModeContextId(context, collById, usedCollectionIds = Object.keys(context ?? {})) {
  validateContext(context, collById);
  const effective = {};
  for (const collectionId of new Set(usedCollectionIds)) {
    const collection = collById.get(collectionId);
    if (!collection) throw new ResolutionError('FAILED_BINDING', `mode context requires unknown collection ${collectionId}`);
    effective[collection.key] = Object.prototype.hasOwnProperty.call(context, collectionId)
      ? context[collectionId]
      : collection.defaultModeId;
  }
  return modeContextId(effective);
}

function validLiteral(type, value) {
  if (type === 'FLOAT') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'STRING') return typeof value === 'string';
  if (type === 'BOOLEAN') return typeof value === 'boolean';
  if (type === 'COLOR') return value && typeof value === 'object' && ['r', 'g', 'b'].every((k) => typeof value[k] === 'number' && Number.isFinite(value[k]));
  return false;
}
