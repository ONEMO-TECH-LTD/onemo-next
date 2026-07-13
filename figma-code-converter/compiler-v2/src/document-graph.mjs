/** Lossless P2 DocumentGraph (§5.1): source properties stay raw; relations are explicit. */
import { SCHEMA } from './schema.mjs';
import { graphSourcePlaneErrors } from './provenance.mjs';

export class DocumentGraphError extends Error {
  constructor(state, message) { super(message); this.state = state; }
}

export function buildDocumentGraph({ document, sourcePlanes, evidenceClass }) {
  const planeErrors = graphSourcePlaneErrors({ sourcePlanes, evidenceClass, families: ['document'] });
  if (planeErrors.length) throw new DocumentGraphError('FAILED_CAPTURE', `DocumentGraph provenance: ${planeErrors.join(', ')}`);
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new DocumentGraphError('FAILED_CAPTURE', 'document root must be an object');
  const seen = new Set();
  const nodes = [];
  (function walk(node, parentId = null, zIndex = 0) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || !node.id || !node.type) {
      throw new DocumentGraphError('FAILED_CAPABILITY', 'every document node needs stable id and type');
    }
    if (seen.has(node.id)) throw new DocumentGraphError('FAILED_CAPABILITY', `duplicate/cyclic document node id ${node.id}`);
    seen.add(node.id);
    if (node.children !== undefined && !Array.isArray(node.children)) throw new DocumentGraphError('FAILED_CAPABILITY', `node ${node.id} children must be an array`);
    const { children, ...properties } = node;
    const childIds = (children ?? []).map((child) => child?.id);
    if (childIds.some((id) => !id)) throw new DocumentGraphError('FAILED_CAPABILITY', `node ${node.id} has child without stable id`);
    nodes.push({ id: node.id, parentId, zIndex, childIds, childrenPresent: Object.hasOwn(node, 'children'), properties: structuredClone(properties) });
    (children ?? []).forEach((child, index) => walk(child, node.id, index));
  })(document);
  return { schemaVersion: SCHEMA.documentGraph, rootId: document.id, nodes };
}
