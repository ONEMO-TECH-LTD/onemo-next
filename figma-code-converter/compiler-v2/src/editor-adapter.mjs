/** P5 source-address selection and deterministic byte-splice Save-to-code. */
import { canonicalJson, sha256 } from './evidence.mjs';
import { assertSafeCssValue } from './security.mjs';

const CSS_NAME = /^--[A-Za-z_][A-Za-z0-9_-]*$/;

export class EditorError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_EDITOR'; }
}

export function selectSource(packageOutput, editorAuthority, nodeId) {
  assertPackageIntegrity(packageOutput, editorAuthority);
  const matches = packageOutput?.sourceMap?.elements?.filter((row) => row.nodeId === nodeId) ?? [];
  if (matches.length !== 1) throw new EditorError(`source ${nodeId} is missing or ambiguous`);
  return structuredClone(matches[0]);
}

export function selectComponent(packageOutput, editorAuthority, componentKey) {
  assertPackageIntegrity(packageOutput, editorAuthority);
  const matches = packageOutput?.sourceMap?.components?.flatMap((row) => {
    if (row.componentKey === componentKey) return [{ ...row, selectedComponentKey: componentKey, selectedSourceId: row.sourceId }];
    const index = row.memberKeys?.indexOf(componentKey) ?? -1;
    return index < 0 ? [] : [{ ...row, selectedComponentKey: componentKey, selectedSourceId: row.memberSourceIds[index], ownerComponentKey: row.componentKey }];
  }) ?? [];
  if (matches.length !== 1) throw new EditorError(`component ${componentKey} is missing or ambiguous`);
  return structuredClone(matches[0]);
}

export function selectFragment(packageOutput, editorAuthority, fragmentId) {
  assertPackageIntegrity(packageOutput, editorAuthority);
  const matches = packageOutput?.sourceMap?.fragments?.filter((row) => row.fragmentId === fragmentId) ?? [];
  if (matches.length !== 1) throw new EditorError(`fragment ${fragmentId} is missing or ambiguous`);
  const fragment = structuredClone(matches[0]);
  return { ...fragment, owner: selectSource(packageOutput, editorAuthority, fragment.ownerNodeId) };
}

export function saveSegmentEdit(packageOutput, editorAuthority, edit) {
  assertPackageIntegrity(packageOutput, editorAuthority);
  const output = structuredClone(packageOutput);
  const segment = output.sourceMap?.segments?.find((row) => row.segmentId === edit?.segmentId);
  if (!segment || segment.editable !== true) throw new EditorError(`editable segment ${edit?.segmentId} missing`);
  if (segment.kind === 'token-expression' || segment.kind === 'react-token-expression') validateTokenRebind(output, segment, edit);
  const replacement = replacementFor(segment, edit);
  const source = Buffer.from(output.files?.[segment.file] ?? '', 'utf8');
  if (segment.endByte > source.length || source.subarray(segment.startByte, segment.endByte).toString('utf8') !== segment.text) throw new EditorError('segment range/text is stale');
  const replacementBytes = Buffer.from(replacement, 'utf8');
  const updated = Buffer.concat([source.subarray(0, segment.startByte), replacementBytes, source.subarray(segment.endByte)]);
  const delta = replacementBytes.length - (segment.endByte - segment.startByte);
  for (const row of allRanges(output.sourceMap).filter((row) => row.file === segment.file)) {
    if (row.segmentId === segment.segmentId) row.endByte = row.startByte + replacementBytes.length;
    else if (row.startByte >= segment.endByte) { row.startByte += delta; row.endByte += delta; }
    else if (row.startByte <= segment.startByte && row.endByte >= segment.endByte) row.endByte += delta;
    else if (row.endByte > segment.startByte && row.startByte < segment.endByte) throw new EditorError(`segment ${row.segmentId ?? row.nodeId ?? row.fragmentId} partially overlaps edit`);
  }
  output.files[segment.file] = updated.toString('utf8');
  for (const row of allRanges(output.sourceMap).filter((row) => row.file === segment.file && row.text !== undefined)) row.text = updated.subarray(row.startByte, row.endByte).toString('utf8');
  if (segment.kind === 'token-expression' || segment.kind === 'react-token-expression') {
    if (!edit.binding?.variableKey || !edit.binding?.channelId) throw new EditorError('token rebind needs variableKey/channelId');
    const binding = output.sourceMap.bindings.find((row) => row.segmentIds?.includes(segment.segmentId));
    if (!binding) throw new EditorError('token segment has no binding owner');
    binding.variableKey = edit.binding.variableKey;
    binding.channelId = edit.binding.channelId;
  }
  refreshMetadata(output);
  return { packageOutput: output, editorAuthority: authorityFor(output) };
}

function assertPackageIntegrity(output, authority) {
  try {
    if (authority?.schemaVersion !== 1 || authority.packageSeal !== authorityFor(output).packageSeal) throw new Error('trusted editor authority mismatch');
    if (output?.schemaVersion !== 1 || output?.sourceMap?.schemaVersion !== 1 || output?.manifest?.schemaVersion !== 1) throw new Error('schema');
    const parsedSourceMap = JSON.parse(output.files?.['source-map.json']);
    const parsedManifest = JSON.parse(output.files?.['manifest.json']);
    if (canonicalJson(parsedSourceMap) !== canonicalJson(output.sourceMap) || canonicalJson(parsedManifest) !== canonicalJson(output.manifest)) throw new Error('persisted metadata drift');
    const inventory = Object.fromEntries(Object.entries(output.files).filter(([name]) => name !== 'manifest.json').sort().map(([name, content]) => [name, { sha256: sha256(content), bytes: Buffer.byteLength(content) }]));
    if (canonicalJson(inventory) !== canonicalJson(output.manifest.files) || output.modelContentSeal !== output.manifest.modelContentSeal || output.rootId !== output.manifest.rootId) throw new Error('inventory/source drift');
    const identityHash = sha256(canonicalJson({
      nodes: output.sourceMap.elements.map((row) => row.nodeId).sort(),
      components: output.sourceMap.components.map((row) => [row.componentKey, row.sourceId]).sort(),
      fragments: output.sourceMap.fragments.map((row) => [row.fragmentId, row.ownerNodeId]).sort(),
      bindings: output.sourceMap.bindings.map((row) => [row.bindingId, row.source]).sort(),
    }));
    if (identityHash !== output.sourceMap.identityHash) throw new Error('source identity hash drift');
  } catch (error) {
    throw new EditorError(`emission package integrity refused: ${error.message}`);
  }
}

function authorityFor(output) {
  return Object.freeze({
    schemaVersion: 1,
    packageSeal: sha256(canonicalJson({
      manifestSha256: sha256(output.files['manifest.json']),
      sourceMapSha256: sha256(output.files['source-map.json']),
      modelContentSeal: output.modelContentSeal,
      rootId: output.rootId,
    })),
  });
}

function validateTokenRebind(output, segment, edit) {
  if (!edit.binding?.variableKey || !edit.binding?.channelId) throw new EditorError('token rebind needs variableKey/channelId');
  let registry;
  try { registry = JSON.parse(output.files?.['token-registry.json']); } catch { throw new EditorError('token registry missing or invalid'); }
  const binding = output.sourceMap.bindings.find((row) => row.segmentIds?.includes(segment.segmentId));
  if (!binding) throw new EditorError('token segment has no binding owner');
  const entry = registry.entries?.[edit.binding.variableKey];
  const channelEntry = Object.entries(entry?.channels ?? {}).find(([, channel]) => channel.channelId === edit.binding.channelId);
  if (!channelEntry) throw new EditorError('token rebind identity is absent from the emitted registry');
  const [domain, channel] = channelEntry;
  const target = segment.kind === 'token-expression' ? 'css' : 'react';
  const emittedName = target === 'css' ? channel.cssName : channel.tsSymbol;
  if (channel.target !== target || domain !== binding.destinationDomain || edit.value !== emittedName) throw new EditorError('token rebind channel/domain/name disagrees with the addressed binding');
}

function replacementFor(segment, edit) {
  switch (segment.kind) {
    case 'css-value': return editableCssValue(String(edit.value), segment.cssProperty);
    case 'token-expression':
      if (!CSS_NAME.test(edit.value ?? '')) throw new EditorError('CSS token edit needs one legal custom-property name');
      return `var(${edit.value})`;
    case 'react-token-expression':
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(edit.value ?? '')) throw new EditorError('React token edit needs one legal symbol');
      return `resolveReactToken(${JSON.stringify(edit.value)}, ${JSON.stringify(segment.modeContextId)})`;
    case 'jsx-prop-value':
      if (segment.valueType === 'BOOLEAN' && typeof edit.value !== 'boolean') throw new EditorError('BOOLEAN component prop edit needs a boolean');
      if (['TEXT', 'INSTANCE_SWAP'].includes(segment.valueType) && typeof edit.value !== 'string') throw new EditorError(`${segment.valueType} component prop edit needs a string`);
      if (segment.valueType === 'VARIANT' && (!Array.isArray(segment.allowedValues) || !segment.allowedValues.includes(edit.value))) throw new EditorError('VARIANT component prop edit is outside captured options');
      return JSON.stringify(edit.value);
    case 'jsx-text': return JSON.stringify(String(edit.value));
    default: throw new EditorError(`segment kind ${segment.kind} is not editable`);
  }
}

function editableCssValue(value, property) {
  assertSafeCssValue(value, property);
  if (['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-radius',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
    'width', 'height'].includes(property)
    && !/^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%)|var\(--[A-Za-z_][A-Za-z0-9_-]*\)|calc\(.+\))$/.test(value)) {
    throw new EditorError(`${property} edit is outside the supported length grammar`);
  }
  return value;
}

function refreshMetadata(output) {
  output.files['source-map.json'] = `${canonicalJson(output.sourceMap)}\n`;
  const files = {};
  for (const [name, content] of Object.entries(output.files).sort()) if (name !== 'manifest.json') files[name] = { sha256: sha256(content), bytes: Buffer.byteLength(content) };
  output.manifest.files = files;
  output.files['manifest.json'] = `${canonicalJson(output.manifest)}\n`;
}

const allRanges = (sourceMap) => [...(sourceMap.elements ?? []), ...(sourceMap.components ?? []), ...(sourceMap.fragments ?? []), ...(sourceMap.segments ?? [])];
