/** One P2 entry point: a single sealed snapshot becomes one versioned canonical model. */
import { SCHEMA, schemaError, validateBindingRecord } from './schema.mjs';
import { collectOccurrences, classifyOccurrences } from './inventory.mjs';
import { buildDocumentGraph } from './document-graph.mjs';
import { buildVariableGraph } from './variable-graph.mjs';
import { buildBindingGraph } from './binding-graph.mjs';
import { buildComponentGraph } from './component-graph.mjs';
import { buildTextGraph } from './text-graph.mjs';
import { buildAssetGraph } from './asset-graph.mjs';
import { graphSourcePlaneErrors } from './provenance.mjs';

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
    return { schemaVersion: SCHEMA.canonicalModel, documentGraph, variableGraph: variableGraph.toJSON(), bindingGraph, componentGraph, textGraph, assetGraph };
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
    ['variableGraph', 'variableGraph', ['variables', 'collections', 'resolutionTraces']],
    ['bindingGraph', 'bindingGraph', ['records', 'resolutionTraces']],
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
  if (errors.length) throw new CanonicalModelError('FAILED_CAPABILITY', `canonical model schema refused: ${errors.join('; ')}`);
  return structuredClone(value);
}
