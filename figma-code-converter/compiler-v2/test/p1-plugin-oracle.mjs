import { canonicalJson, sha256 } from '../src/evidence.mjs';

const PLANES = Object.freeze({
  document: 'plugin-primary-complete', supplement: 'plugin-primary-complete',
  variables: 'plugin-primary-complete', components: 'plugin-primary-complete',
  fonts: 'plugin-primary-complete', assets: 'plugin-primary-complete',
  references: 'rest-cross-check', dependencies: 'plugin-primary-complete',
});

export function p1PluginCaptureFailures({ payload, pass, expectedRoot, fontRegistry }) {
  const failures = [];
  if (payload?.schemaVersion !== 1 || payload?.proofClass !== 'figma-plugin-capture') failures.push('payload schema');
  if (payload?.plugin?.fileKey !== expectedRoot?.fileKey || payload?.plugin?.currentPageId !== expectedRoot?.currentPageId
    || payload?.plugin?.editorType !== expectedRoot?.editorType || payload?.plugin?.colorProfile !== expectedRoot?.colorProfile) failures.push('plugin identity');
  if (expectedRoot?.rootIds?.length !== 1 || payload?.rootId !== expectedRoot?.rootIds?.[0] || payload?.document?.id !== payload?.rootId) failures.push('root identity');
  if (canonicalJson(pass?.sourcePlanes) !== canonicalJson(PLANES)) failures.push('source planes');
  if (canonicalJson(pass?.document) !== canonicalJson(payload?.document)) failures.push('document conservation');
  if (canonicalJson(pass?.variables?.variables) !== canonicalJson(payload?.variables)
    || canonicalJson(pass?.variables?.variableCollections) !== canonicalJson(payload?.variableCollections)) failures.push('variable conservation');
  const catalog = new Map((payload?.componentCatalog ?? []).map((row) => [row.key, row]));
  const expectedComponents = [...catalog.values()].filter((row) => row.kind === 'component').map(({ kind, ...row }) => row);
  const expectedSets = [...catalog.values()].filter((row) => row.kind === 'component-set').map(({ kind, ...row }) => row);
  if (canonicalJson(pass?.components?.components) !== canonicalJson(expectedComponents)
    || canonicalJson(pass?.components?.componentSets) !== canonicalJson(expectedSets)) failures.push('component conservation');
  const payloadNodes = new Map((payload?.supplement?.nodes ?? []).map((row) => [row.nodeId, row]));
  const registry = new Map((fontRegistry ?? []).map((row) => [`${row.family}\u241f${row.figmaStyle}`, row]));
  for (const row of pass?.supplement?.nodes ?? []) {
    const source = payloadNodes.get(row.nodeId);
    const { fontDependencies, ...base } = row;
    if (!source || canonicalJson(base) !== canonicalJson(source)) failures.push(`supplement ${row.nodeId}`);
    for (const dependency of row.fontDependencies ?? []) {
      const font = registry.get(`${dependency.family}\u241f${dependency.style}`);
      if (!font || dependency.sha256 !== sha256(font.bytes) || dependency.providerId !== font.providerId) failures.push(`font dependency ${row.nodeId}`);
    }
  }
  if ((pass?.supplement?.nodes?.length ?? -1) !== payloadNodes.size) failures.push('supplement census');
  for (const row of pass?.fonts?.families ?? []) {
    const source = registry.get(`${row?.figma?.family}\u241f${row?.figma?.style}`);
    if (!source || row.web.sha256 !== sha256(source.bytes) || row.web.bytes !== source.bytes.length) failures.push(`font ${row?.figma?.family}`);
  }
  for (const asset of pass?.dependencies?.assets ?? []) {
    const bytes = pass?.assets instanceof Map ? pass.assets.get(asset.file) : null;
    if (!bytes || sha256(bytes) !== asset.sha256 || bytes.length !== asset.bytes) failures.push(`asset ${asset.file}`);
    const normalizedBytes = bytes ? Buffer.from(bytes) : null;
    const image = (payload?.images ?? []).find((row) => row.sourceId === asset.sourceId);
    const vector = (payload?.exports ?? []).find((row) => row.sourceId === asset.sourceId);
    if (asset.kind === 'image' && (!image || !normalizedBytes?.equals(Buffer.from(image.bytes)))) failures.push(`image bytes ${asset.sourceId}`);
    if (asset.kind === 'svg' && (!vector || !normalizedBytes?.equals(Buffer.from(vector.svg, 'utf8')))) failures.push(`svg bytes ${asset.sourceId}`);
  }
  const rootLock = (pass?.dependencies?.locks ?? []).find((row) => row.fileKey === expectedRoot?.fileKey && row.key === 'root');
  if (rootLock?.version !== expectedRoot?.fileVersion) failures.push('root version lock');
  return [...new Set(failures)].sort();
}
