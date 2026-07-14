/** Host-side C11 §4 capture normalizer. Plugin facts never mint REST/version/font authority. */
import { canonicalJson, sha256 } from './evidence.mjs';

const PAYLOAD_FIELDS = ['assetNodeIds', 'componentCatalog', 'document', 'exports', 'images', 'plugin', 'proofClass', 'rootId', 'schemaVersion', 'supplement', 'variableCollections', 'variables'];
const PLUGIN_FIELDS = ['apiVersion', 'colorProfile', 'currentPageId', 'editorType', 'fileKey'];
const ROOT_FIELDS = ['branchKey', 'colorProfile', 'currentPageId', 'editorType', 'fileKey', 'fileVersion', 'rootIds'];
const PLANES = Object.freeze({
  document: 'plugin-primary-complete', supplement: 'plugin-primary-complete',
  variables: 'plugin-primary-complete', components: 'plugin-primary-complete',
  fonts: 'plugin-primary-complete', assets: 'plugin-primary-complete',
  references: 'rest-cross-check', dependencies: 'plugin-primary-complete',
});

export class PluginCaptureError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_CAPTURE'; }
}

export function normalizePluginCapture({
  payload, expectedRoot, fontRegistry, dependencyLocks,
  externalDependencies = [], backdropDependencies = [],
}) {
  validateClosed(payload, PAYLOAD_FIELDS, 'plugin payload');
  if (payload.schemaVersion !== 1 || payload.proofClass !== 'figma-plugin-capture') fail('plugin payload schema/proof class invalid');
  validateClosed(payload.plugin, PLUGIN_FIELDS, 'plugin identity');
  validateClosed(expectedRoot, ROOT_FIELDS, 'host root identity');
  if (!Array.isArray(expectedRoot.rootIds) || expectedRoot.rootIds.length !== 1 || !text(expectedRoot.rootIds.at(0))) fail('one root per capture transaction required');
  if (payload.rootId !== expectedRoot.rootIds.at(0) || payload.document?.id !== payload.rootId) fail('plugin/document/host root identity mismatch');
  for (const [pluginKey, rootKey] of [['fileKey', 'fileKey'], ['editorType', 'editorType'], ['currentPageId', 'currentPageId'], ['colorProfile', 'colorProfile']]) {
    if (payload.plugin[pluginKey] !== expectedRoot[rootKey]) fail(`plugin ${pluginKey} disagrees with host authority`);
  }
  if (!text(payload.plugin.apiVersion) || !text(expectedRoot.fileVersion) || !text(expectedRoot.branchKey)) fail('plugin or host root version identity incomplete');
  if (!jsonSafe(payload)) fail('plugin payload is not closed canonical JSON');

  const nodes = documentNodes(payload.document);
  const supplement = normalizeSupplement(payload.supplement, nodes);
  const variables = normalizeVariables(payload.variables, payload.variableCollections, supplement);
  const components = normalizeComponents(payload.componentCatalog, supplement);
  const assets = new Map();
  const assetIndex = [];
  normalizeImages(payload.images, payload.document, supplement, assets, assetIndex);
  normalizeExports(payload.exports, payload.assetNodeIds, nodes, assets, assetIndex);
  const { fonts, supplement: fontSupplement } = normalizeFonts(fontRegistry, supplement, nodes, assets);
  const locks = normalizeLocks(dependencyLocks, expectedRoot, externalDependencies, backdropDependencies);

  return {
    document: structuredClone(payload.document),
    supplement: { schemaVersion: 1, nodes: fontSupplement },
    variables,
    components,
    fonts,
    dependencies: {
      locks,
      boundary: {
        closed: true,
        rootIds: [payload.rootId],
        nodeIds: [...nodes.keys()],
        externalDependencies: structuredClone(externalDependencies),
        backdropDependencies: structuredClone(backdropDependencies),
      },
      assets: structuredClone(assetIndex),
      assetNodeIds: structuredClone(payload.assetNodeIds),
    },
    assets,
    sourcePlanes: { ...PLANES },
  };
}

function normalizeSupplement(value, nodes) {
  if (!plain(value) || value.schemaVersion !== 1 || !Array.isArray(value.nodes)) fail('plugin supplement schema invalid');
  const byId = new Map();
  for (const row of value.nodes) {
    if (!plain(row) || !text(row.nodeId) || !text(row.nodeType) || !plain(row.resolvedVariableModes) || !plain(row.explicitVariableModes)) fail(`supplement row ${row?.nodeId ?? '?'} incomplete`);
    if (!nodes.has(row.nodeId) || nodes.get(row.nodeId).type !== row.nodeType || byId.has(row.nodeId)) fail(`supplement node ${row.nodeId} census/type mismatch`);
    byId.set(row.nodeId, row);
  }
  if (byId.size !== nodes.size) fail('supplement node census incomplete');
  for (const nodeId of nodes.keys()) if (!byId.has(nodeId)) fail(`supplement missing node ${nodeId}`);
  return value.nodes.map((row) => structuredClone(row));
}

function normalizeVariables(variableRows, collectionRows, supplement) {
  if (!Array.isArray(variableRows) || !Array.isArray(collectionRows)) fail('variable inventory arrays missing');
  const collections = uniqueRows(collectionRows, 'variable collection');
  const collectionById = new Map(collections.map((row) => [row.id, row]));
  assertUniqueKeys(collections, 'variable collection');
  for (const row of collections) {
    if (!text(row.key) || !text(row.name) || !text(row.defaultModeId) || !Array.isArray(row.modes) || !row.modes.length
      || !row.modes.some((mode) => mode?.modeId === row.defaultModeId)) fail(`variable collection ${row.id} incomplete`);
    const modeIds = row.modes.map((mode) => mode?.modeId);
    if (modeIds.some((id) => !text(id)) || new Set(modeIds).size !== modeIds.length) fail(`variable collection ${row.id} modes invalid/duplicate`);
  }
  const variables = uniqueRows(variableRows, 'variable');
  assertUniqueKeys(variables, 'variable');
  const ids = new Set(variables.map((row) => row.id));
  for (const row of variables) {
    if (!text(row.key) || !text(row.name) || !collectionById.has(row.variableCollectionId)
      || !['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(row.resolvedType) || !plain(row.valuesByMode)) fail(`variable ${row.id} incomplete`);
    const collection = collectionById.get(row.variableCollectionId);
    for (const mode of collection.modes) if (!Object.hasOwn(row.valuesByMode, mode.modeId)) fail(`variable ${row.id} missing mode ${mode.modeId}`);
    for (const modeId of Object.keys(row.valuesByMode)) if (!collection.modes.some((mode) => mode.modeId === modeId)) fail(`variable ${row.id} carries undeclared mode ${modeId}`);
    for (const aliasId of aliasIds(row.valuesByMode)) if (!ids.has(aliasId)) fail(`variable ${row.id} alias ${aliasId} unavailable`);
  }
  for (const row of supplement) {
    for (const [collectionId, modeId] of Object.entries({ ...row.resolvedVariableModes, ...row.explicitVariableModes })) {
      const collection = collectionById.get(collectionId);
      if (!collection || !collection.modes.some((mode) => mode.modeId === modeId)) fail(`node ${row.nodeId} mode ${collectionId}/${modeId} unavailable`);
    }
  }
  return { variables: structuredClone(variables), variableCollections: structuredClone(collections) };
}

function normalizeComponents(rows, supplement) {
  if (!Array.isArray(rows)) fail('component catalog missing');
  const byKey = new Map();
  const byId = new Map();
  for (const row of rows) {
    if (!plain(row) || !['component', 'component-set'].includes(row.kind) || !text(row.id) || !text(row.key) || !text(row.name) || row.complete !== true || !plain(row.propertyDefinitions)) fail(`component catalog row ${row?.id ?? '?'} incomplete`);
    const priorKey = byKey.get(row.key);
    const priorId = byId.get(row.id);
    if ((priorKey && canonicalJson(priorKey) !== canonicalJson(row)) || (priorId && canonicalJson(priorId) !== canonicalJson(row))) fail(`component catalog conflict ${row.key}`);
    byKey.set(row.key, row);
    byId.set(row.id, row);
  }
  for (const row of supplement) if (row.nodeType === 'INSTANCE' && (!text(row.mainComponentKey) || !byKey.has(row.mainComponentKey))) fail(`instance ${row.nodeId} main component unavailable`);
  const componentSets = [...byKey.values()].filter((row) => row.kind === 'component-set').map(({ kind, ...row }) => structuredClone(row));
  const components = [...byKey.values()].filter((row) => row.kind === 'component').map(({ kind, ...row }) => structuredClone(row));
  for (const row of components) {
    if (row.variantProperties !== null && row.variantProperties !== undefined && !text(row.componentSetKey)) fail(`variant component ${row.key} lost its component set`);
    if (row.componentSetKey !== null && row.componentSetKey !== undefined && !componentSets.some((set) => set.key === row.componentSetKey)) fail(`component ${row.key} set unavailable`);
  }
  return { components, componentSets };
}

function normalizeImages(rows, document, supplement, assets, assetIndex) {
  if (!Array.isArray(rows)) fail('image byte inventory missing');
  const required = [...new Set(imageRefs({ document, supplement }))].sort();
  const supplied = uniqueRows(rows, 'image').sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  if (canonicalJson(required) !== canonicalJson(supplied.map((row) => row.sourceId))) fail('image reference/byte census mismatch');
  for (const row of supplied) {
    if (!byteArray(row.bytes) || !positive(row.width) || !positive(row.height)) fail(`image ${row.sourceId} bytes/geometry invalid`);
    const bytes = Buffer.from(row.bytes);
    const { mime, extension } = imageFormat(bytes);
    const file = `assets/images/${sha256(row.sourceId).slice(0, 24)}.${extension}`;
    putAsset(assets, file, bytes);
    assetIndex.push({ kind: 'image', sourceId: row.sourceId, file, sha256: sha256(bytes), bytes: bytes.length, mime, width: row.width, height: row.height });
  }
}

function normalizeExports(rows, assetNodeIds, nodes, assets, assetIndex) {
  if (!Array.isArray(rows) || !Array.isArray(assetNodeIds) || new Set(assetNodeIds).size !== assetNodeIds.length || assetNodeIds.some((id) => !text(id))) fail('declared asset node inventory invalid');
  const supplied = uniqueRows(rows, 'SVG export');
  if (canonicalJson([...assetNodeIds].sort()) !== canonicalJson(supplied.map((row) => row.sourceId).sort())) fail('SVG export/node census mismatch');
  for (const row of supplied) {
    if (!nodes.has(row.sourceId) || !text(row.svg) || !positive(row.width) || !positive(row.height)) fail(`SVG export ${row.sourceId} invalid`);
    const bytes = Buffer.from(row.svg, 'utf8');
    const file = `assets/svg/${sha256(row.sourceId).slice(0, 24)}.svg`;
    putAsset(assets, file, bytes);
    assetIndex.push({ kind: 'svg', sourceId: row.sourceId, file, sha256: sha256(bytes), bytes: bytes.length, mime: 'image/svg+xml', width: row.width, height: row.height });
  }
}

function normalizeFonts(registryRows, supplement, nodes, assets) {
  if (!Array.isArray(registryRows)) fail('host font registry missing');
  const registry = new Map();
  for (const row of registryRows) {
    const identity = `${row?.family ?? ''}\u241f${row?.figmaStyle ?? ''}`;
    if (!text(row?.family) || !text(row.figmaStyle) || !text(row.providerId) || !text(row.source) || !validRelative(row.path)
      || !text(row.licenseId) || !text(row.format) || !(text(row.weight) || Number.isFinite(row.weight)) || !text(row.webStyle)
      || !Buffer.isBuffer(row.bytes) || !row.bytes.length || registry.has(identity)) fail(`host font registry row ${identity} invalid/duplicate`);
    registry.set(identity, row);
  }
  const ranges = new Map();
  const normalized = supplement.map((row) => {
    if (row.nodeType !== 'TEXT') return structuredClone(row);
    const node = nodes.get(row.nodeId);
    if (!Array.isArray(row.styledTextSegments)) fail(`text ${row.nodeId} styled segments missing`);
    const dependencies = new Map();
    let cursor = 0;
    for (const segment of row.styledTextSegments) {
      const font = segment?.fontName;
      const identity = `${font?.family ?? ''}\u241f${font?.style ?? ''}`;
      const registryRow = registry.get(identity);
      if (!registryRow || !Number.isInteger(segment.start) || !Number.isInteger(segment.end) || segment.start !== cursor || segment.end <= segment.start || segment.end > String(node.characters ?? '').length
        || segment.characters !== String(node.characters ?? '').slice(segment.start, segment.end)) fail(`text ${row.nodeId} font/range ${identity} unavailable`);
      const bytesHash = sha256(registryRow.bytes);
      dependencies.set(identity, { family: font.family, style: font.style, providerId: registryRow.providerId, sha256: bytesHash });
      const prior = ranges.get(identity) ?? [];
      ranges.set(identity, prior.concat([{ nodeId: row.nodeId, start: segment.start, end: segment.end }]));
      cursor = segment.end;
    }
    if (cursor !== String(node.characters ?? '').length) fail(`text ${row.nodeId} styled ranges do not cover source characters`);
    return { ...structuredClone(row), fontDependencies: [...dependencies.values()] };
  });
  const families = [];
  for (const [identity, fontRanges] of ranges) {
    const row = registry.get(identity);
    const bytes = Buffer.from(row.bytes);
    putAsset(assets, row.path, bytes);
    families.push({
      figma: { family: row.family, style: row.figmaStyle, available: true, missing: false, ranges: fontRanges },
      web: {
        source: row.source, path: row.path, licenseId: row.licenseId, format: row.format,
        weight: row.weight, style: row.webStyle, bytes: bytes.length, sha256: sha256(bytes),
      },
    });
  }
  return { fonts: { families }, supplement: normalized };
}

function normalizeLocks(rows, expectedRoot, externalDependencies, backdropDependencies) {
  if (!Array.isArray(rows) || !Array.isArray(externalDependencies) || !Array.isArray(backdropDependencies)) fail('dependency authority arrays missing');
  const locks = uniqueIdentityRows(rows, 'dependency lock');
  const root = locks.find((row) => row.fileKey === expectedRoot.fileKey && row.key === 'root');
  if (!root || root.version !== expectedRoot.fileVersion) fail('root version lock missing or disagrees with host authority');
  const ids = new Set(locks.map(lockIdentity));
  for (const dependency of externalDependencies.concat(backdropDependencies)) {
    if (!plain(dependency) || !['captured', 'reference', 'inactive-proven'].includes(dependency.disposition) || !ids.has(lockIdentity(dependency))) fail('boundary dependency lacks matching locked authority');
  }
  return structuredClone(locks);
}

function documentNodes(document) {
  const nodes = new Map();
  const walk = (node) => {
    if (!plain(node) || !text(node.id) || !text(node.type) || nodes.has(node.id) || (node.children !== undefined && !Array.isArray(node.children))) fail(`document node ${node?.id ?? '?'} malformed/duplicate`);
    nodes.set(node.id, node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(document);
  return nodes;
}

function uniqueRows(rows, label) {
  const byId = new Map();
  for (const row of rows) {
    const id = row?.sourceId ?? row?.id;
    if (!text(id) || byId.has(id)) fail(`${label} identity ${id ?? '?'} missing/duplicate`);
    byId.set(id, row);
  }
  return [...byId.values()];
}

function assertUniqueKeys(rows, label) {
  const keys = new Set();
  for (const row of rows) {
    if (!text(row.key) || keys.has(row.key)) fail(`${label} stable key ${row.key ?? '?'} missing/duplicate`);
    keys.add(row.key);
  }
}

function uniqueIdentityRows(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    if (!plain(row) || !text(row.provider) || !text(row.fileKey) || !text(row.key) || (!text(row.version) && !/^[0-9a-f]{64}$/.test(row.fingerprint ?? ''))) fail(`${label} malformed`);
    const id = lockIdentity(row);
    if (seen.has(id)) fail(`${label} duplicate ${id}`);
    seen.add(id);
  }
  return rows;
}

function aliasIds(value) {
  if (Array.isArray(value)) return value.flatMap(aliasIds);
  if (!plain(value)) return [];
  const own = value.type === 'VARIABLE_ALIAS' && text(value.id) ? [value.id] : [];
  return own.concat(Object.values(value).flatMap(aliasIds));
}

function imageRefs(value) {
  if (Array.isArray(value)) return value.flatMap(imageRefs);
  if (!plain(value)) return [];
  const own = Object.entries(value).flatMap(([key, child]) => ((key === 'imageRef' || key === 'imageHash') && text(child) ? [child] : []));
  return own.concat(Object.values(value).flatMap(imageRefs));
}

function imageFormat(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', extension: 'png' };
  if (bytes.length >= 3 && bytes.at(0) === 0xff && bytes.at(1) === 0xd8 && bytes.at(2) === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return { mime: 'image/gif', extension: 'gif' };
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  fail('unsupported image byte format');
}

function putAsset(assets, file, bytes) {
  if (assets.has(file)) fail(`asset path collision ${file}`);
  assets.set(file, bytes);
}

function validateClosed(value, fields, label) {
  if (!plain(value) || Object.keys(value).sort().join(',') !== [...fields].sort().join(',')) fail(`${label} differs from closed contract`);
}
function jsonSafe(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonSafe);
  return plain(value) && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(jsonSafe);
}
function lockIdentity(row) { return `${row.provider}\u241f${row.fileKey}\u241f${row.key}`; }
function fail(message) { throw new PluginCaptureError(message); }
const byteArray = (value) => Array.isArray(value) && value.length > 0 && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255);
const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const validRelative = (value) => text(value) && !value.includes('\\') && !value.startsWith('/') && !value.split('/').some((segment) => !segment || segment === '.' || segment === '..');
const text = (value) => typeof value === 'string' && value.length > 0;
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
