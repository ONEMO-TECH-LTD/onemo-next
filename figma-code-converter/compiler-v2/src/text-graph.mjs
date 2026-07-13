/** P2 TextGraph (§5.5): exact UTF-16 ranges and plugin semantic segments, never REST coalescing. */
import { SCHEMA } from './schema.mjs';
import { graphSourcePlaneErrors } from './provenance.mjs';

export class TextGraphError extends Error {
  constructor(state, message) { super(message); this.state = state; }
}

export function buildTextGraph({ document, supplement, sourcePlanes, evidenceClass }) {
  const planeErrors = graphSourcePlaneErrors({ sourcePlanes, evidenceClass, families: ['document', 'supplement', 'fonts'] });
  if (planeErrors.length) throw new TextGraphError('FAILED_CAPTURE', `TextGraph provenance: ${planeErrors.join(', ')}`);
  if (!Array.isArray(supplement?.nodes)) throw new TextGraphError('FAILED_CAPTURE', 'complete plugin supplement required for TextGraph');
  const supplementByNode = new Map(supplement.nodes.map((row) => [row.nodeId, row]));
  const textNodes = [];
  (function walk(node) {
    if (!node) return;
    if (node.type === 'TEXT') {
      const semantic = supplementByNode.get(node.id);
      if (!semantic || !Array.isArray(semantic.styledTextSegments) || !Array.isArray(semantic.fontDependencies)) {
        throw new TextGraphError('FAILED_CAPTURE', `text node ${node.id} lacks styled ranges or font dependencies`);
      }
      validateSegments(node, semantic.styledTextSegments);
      validateFonts(node.id, semantic.styledTextSegments, semantic.fontDependencies);
      textNodes.push({ nodeId: node.id, segments: structuredClone(semantic.styledTextSegments), fontDependencies: structuredClone(semantic.fontDependencies) });
    }
    (node.children ?? []).forEach(walk);
  })(document);
  return { schemaVersion: SCHEMA.textGraph, textNodes };
}

function validateFonts(nodeId, segments, dependencies) {
  const mapped = new Set();
  for (const dependency of dependencies) {
    if (!dependency?.family || !dependency.style || !dependency.providerId || !/^[0-9a-f]{64}$/i.test(dependency.sha256 ?? '')) {
      throw new TextGraphError('FAILED_CAPTURE', `text node ${nodeId} has unpinned font dependency`);
    }
    mapped.add(`${dependency.family}\u241f${dependency.style}`);
  }
  for (const segment of segments) {
    const font = segment.fontName;
    if (!font?.family || !font.style || !mapped.has(`${font.family}\u241f${font.style}`)) {
      throw new TextGraphError('FAILED_CAPTURE', `text node ${nodeId} uses an unmapped font ${font?.family ?? '?'} / ${font?.style ?? '?'}`);
    }
  }
}

function validateSegments(node, segments) {
  const chars = node.characters ?? '';
  if (!segments.length && chars.length) throw new TextGraphError('FAILED_CAPTURE', `text node ${node.id} has characters but no styled segments`);
  let cursor = 0;
  for (const segment of segments) {
    if (!Number.isInteger(segment.start) || !Number.isInteger(segment.end) || segment.start !== cursor || segment.end <= segment.start || segment.end > chars.length) {
      throw new TextGraphError('FAILED_CAPTURE', `text node ${node.id} has non-contiguous/invalid UTF-16 range`);
    }
    if (segment.characters !== chars.slice(segment.start, segment.end)) throw new TextGraphError('FAILED_CAPTURE', `text node ${node.id} segment characters do not match source range`);
    cursor = segment.end;
  }
  if (cursor !== chars.length) throw new TextGraphError('FAILED_CAPTURE', `text node ${node.id} styled ranges do not cover all characters`);
}
