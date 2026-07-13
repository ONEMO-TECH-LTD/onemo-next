/** P2 AssetGraph (§5.6): source identity + sealed content identity + geometry, no external URL. */
import { SCHEMA } from './schema.mjs';
import { graphSourcePlaneErrors } from './provenance.mjs';

export class AssetGraphError extends Error {
  constructor(state, message) { super(message); this.state = state; }
}

export function buildAssetGraph({ document, assetIndex, assetNodeIds = [], sealedFiles, sourcePlanes, evidenceClass }) {
  const planeErrors = graphSourcePlaneErrors({ sourcePlanes, evidenceClass, families: ['document', 'assets', 'dependencies'] });
  if (planeErrors.length) throw new AssetGraphError('FAILED_CAPTURE', `AssetGraph provenance: ${planeErrors.join(', ')}`);
  if (!Array.isArray(assetIndex) || !Array.isArray(assetNodeIds) || !sealedFiles || typeof sealedFiles !== 'object') throw new AssetGraphError('FAILED_CAPTURE', 'versioned asset index, sealed files, and asset node ids required');
  const nodeIds = new Set();
  const imageRefs = new Set();
  (function walk(value) {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    if (value.id) nodeIds.add(value.id);
    if (typeof value.imageRef === 'string' && value.imageRef) imageRefs.add(value.imageRef);
    Object.values(value).forEach(walk);
  })(document);
  const assets = assetIndex.map((row) => validateAsset(row));
  const keys = new Set();
  for (const row of assets) {
    const key = `${row.kind}:${row.sourceId}`;
    if (keys.has(key)) throw new AssetGraphError('FAILED_CAPTURE', `duplicate asset identity ${key}`);
    keys.add(key);
    const sealed = sealedFiles[row.file];
    if (!sealed || sealed.sha256 !== row.sha256 || sealed.bytes !== row.bytes) throw new AssetGraphError('FAILED_CAPTURE', `asset ${row.sourceId} identity disagrees with sealed manifest file ${row.file}`);
    if (['svg', 'export'].includes(row.kind) && !nodeIds.has(row.sourceId)) throw new AssetGraphError('FAILED_CAPTURE', `${row.kind} asset ${row.sourceId} has no captured source node`);
  }
  for (const ref of imageRefs) if (!keys.has(`image:${ref}`)) throw new AssetGraphError('FAILED_CAPTURE', `imageRef ${ref} has no sealed asset mapping`);
  for (const nodeId of assetNodeIds) {
    if (!nodeIds.has(nodeId)) throw new AssetGraphError('FAILED_CAPTURE', `asset node ${nodeId} absent from document`);
    if (!keys.has(`svg:${nodeId}`)) throw new AssetGraphError('FAILED_CAPTURE', `asset node ${nodeId} has no sealed SVG mapping`);
  }
  return { schemaVersion: SCHEMA.assetGraph, assets };
}

function validateAsset(row) {
  if (!['image', 'svg', 'export'].includes(row?.kind) || !row.sourceId) throw new AssetGraphError('FAILED_CAPTURE', 'asset kind/sourceId invalid');
  if (typeof row.file !== 'string' || !row.file.startsWith('assets/') || row.file.includes('..') || /^(?:[a-z]+:)?\/\//i.test(row.file)) throw new AssetGraphError('FAILED_CAPTURE', `asset path is not package-confined: ${row.file}`);
  if (!/^[0-9a-f]{64}$/i.test(row.sha256) || !Number.isInteger(row.bytes) || row.bytes < 0 || !row.mime) throw new AssetGraphError('FAILED_CAPTURE', `asset ${row.sourceId} lacks sealed content identity`);
  if (!Number.isFinite(row.width) || !Number.isFinite(row.height) || row.width <= 0 || row.height <= 0) throw new AssetGraphError('FAILED_CAPTURE', `asset ${row.sourceId} lacks valid geometry`);
  return structuredClone(row);
}
