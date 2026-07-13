/** Scoped node-mode boundaries (§7.2): root + exact parent/child context changes only. */
import { SCHEMA } from './schema.mjs';
import { parseCanonicalModel } from './canonical-model.mjs';

export function buildModeContextPlan(input) {
  const model = parseCanonicalModel(input);
  const contexts = new Map(model.variableGraph.nodeModeContexts.map((row) => [row.nodeId, row.modeContextId]));
  const boundaries = [];
  const nodes = model.documentGraph.nodes.map((node) => {
    const modeContextId = contexts.get(node.id);
    const parentModeContextId = node.parentId === null ? null : contexts.get(node.parentId);
    const boundary = node.parentId === null || modeContextId !== parentModeContextId;
    if (boundary) boundaries.push({ nodeId: node.id, modeContextId, parentModeContextId, modes: parseContext(modeContextId) });
    return { nodeId: node.id, parentId: node.parentId, modeContextId, boundary };
  });
  return { schemaVersion: SCHEMA.modeContextPlan, rootId: model.documentGraph.rootId, nodes, boundaries };
}

function parseContext(id) {
  if (id === 'ø') return {};
  return Object.fromEntries(String(id).split(',').map((part) => {
    const split = part.indexOf('=');
    return [part.slice(0, split), part.slice(split + 1)];
  }));
}
