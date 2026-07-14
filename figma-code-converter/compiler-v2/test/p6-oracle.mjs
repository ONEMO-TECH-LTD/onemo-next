/** Independent P6 G9-G11/G13 oracle. No production proof/planner imports. */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const EDITOR_CASES = ['EC1', 'EC2', 'EC3', 'EC4', 'EC5', 'EC6', 'EC7', 'EC8a', 'EC8b'];
const HASH = /^[0-9a-f]{64}$/;
const FONT_ROOTS = ['/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library/Fonts')];
const LOCALITY = {
  label: { required: ['token-registry.json'], allowed: ['manifest.json', 'source-map.json', 'token-registry.json'] },
  'token-value': { required: ['tokens.css'], allowed: ['manifest.json', 'source-map.json', 'tokens.css', 'token-values.ts', 'fidelity-report.json'] },
};

export async function p6Failures({ packageOutput, compileRequest, builds, localityRuns, runtimeCaptures, fidelityBudgets, editorRuns, modeContextPlan, tokenPlan, report }) {
  const packageHash = sha256(canonicalJson(packageOutput));
  let G9 = !Array.isArray(builds) || builds.length < 2;
  if (new Set((builds ?? []).map((row) => row.id)).size !== (builds ?? []).length || new Set((localityRuns ?? []).map((row) => row.id)).size !== (localityRuns ?? []).length) G9 = true;
  const buildHashes = new Set();
  for (const row of builds ?? []) {
    if (!(await validBuild(row.bundle, packageHash))) G9 = true;
    else buildHashes.add(row.bundle.buildHash);
  }
  if (buildHashes.size !== 1) G9 = true;
  for (const id of ['label', 'subtree', 'token-value']) if (!(localityRuns ?? []).some((row) => row.id === id)) G9 = true;
  for (const row of localityRuns ?? []) {
    const before = row.before?.packageOutput?.files;
    const after = row.after?.packageOutput?.files;
    const changed = before && after ? changedFiles(before, after) : [];
    const policy = LOCALITY[row.id];
    if ((!policy && row.id !== 'subtree') || !validPackage(row.before?.packageOutput) || !validPackage(row.after?.packageOutput)
      || sha256(canonicalJson(row.before?.packageOutput)) !== packageHash || row.before?.packageOutput?.rootId !== row.after?.packageOutput?.rootId || !changed.length
      || (policy && (changed.some((name) => !policy.allowed.includes(name)) || policy.required.some((name) => !changed.includes(name))))
      || (row.id === 'subtree' && (changed.some((name) => !subtreeFile(name)) || !changed.some(generatedSubtreeFile)))) G9 = true;
  }

  const expectedContexts = Object.fromEntries((modeContextPlan?.nodes ?? []).map((row) => [row.nodeId, row.modeContextId]));
  const expectedBindings = expectedRuntimeBindings(tokenPlan);
  const requested = compileRequest?.requiredStates ?? [];
  let G10 = requested.length !== runtimeCaptures?.length;
  if (new Set((runtimeCaptures ?? []).map((row) => row.runtime?.id)).size !== (runtimeCaptures ?? []).length) G10 = true;
  let G11 = false;
  let G0 = false;
  for (const state of requested) {
    const evidence = runtimeCaptures?.find((row) => row.runtime?.id === state.id);
    const runtime = evidence?.runtime;
    const width = state.viewport?.width * state.viewport?.dpr;
    const height = state.viewport?.height * state.viewport?.dpr;
    if (!(await validCapture(evidence)) || canonicalJson(evidence?.requiredState) !== canonicalJson(state) || canonicalJson(evidence?.fidelityBudgets) !== canonicalJson(fidelityBudgets)
      || runtime?.packageHash !== packageHash || canonicalJson(runtime?.contexts) !== canonicalJson(expectedContexts) || canonicalJson(runtime?.bindings) !== canonicalJson(expectedBindings)
      || runtime?.consoleErrors?.length || runtime?.runtimeErrors?.length || runtime?.networkRequests?.length
      || !(await validEnvironment(evidence, state.viewport)) || runtime?.environmentManifestHash !== fidelityBudgets?.environmentManifestHash
      || runtime?.screenshot?.width !== width || runtime?.screenshot?.height !== height) G10 = true;
    if (!state.reference) continue;
    if (!runtime?.reference || canonicalJson(pickReference(runtime.reference)) !== canonicalJson(pickReference(state.reference))
      || runtime.reference.sha256 !== sha256(evidence?.referenceBytes) || runtime.reference.width !== width || runtime.reference.height !== height) G0 = true;
    if (canonicalJson(Object.keys(runtime?.metrics ?? {}).sort()) !== canonicalJson([...(state.metricClasses ?? [])].sort())) G11 = true;
    for (const [kind, metric] of Object.entries(runtime?.metrics ?? {})) {
      const budget = fidelityBudgets?.classes?.[kind];
      if (!budget || !finite(metric.changedPct) || !finite(metric.meanDelta) || !finite(budget.maxChangedPct) || !finite(budget.maxMeanDelta)
        || metric.changedPct > budget.maxChangedPct || metric.meanDelta > budget.maxMeanDelta) G11 = true;
    }
    try {
      const derived = await measureRegions(evidence.screenshotBytes, evidence.referenceBytes, evidence.metricRegions);
      if (canonicalJson(derived) !== canonicalJson(runtime.metrics)) G11 = true;
    } catch { G11 = true; }
  }

  let G13 = EDITOR_CASES.some((id) => !(editorRuns ?? []).some((row) => row.caseId === id)) || new Set((editorRuns ?? []).map((row) => row.caseId)).size !== (editorRuns ?? []).length;
  for (const row of editorRuns ?? []) if (!(await validEditorRun(row))) G13 = true;
  const { reportHash: ignored, ...hashable } = report ?? {};
  if (report?.reportHash !== sha256(canonicalJson(hashable))) return allFailed();
  if (report?.state === 'PROMOTABLE_VERIFIED' || report?.promotionAuthorityId !== null) return allFailed();
  if (report?.gates?.G9 !== (G9 ? 'FAILED' : 'VERIFIED')) G9 = true;
  if (report?.gates?.G10 !== (G10 ? 'FAILED' : 'VERIFIED')) G10 = true;
  const expectedG11 = requested.some((row) => row.reference === null) && !G11 ? 'DIAGNOSTIC_ONLY' : G11 ? 'FAILED' : 'VERIFIED';
  if (report?.gates?.G11 !== expectedG11) G11 = true;
  if (report?.gates?.G13 !== (G13 ? 'FAILED' : 'VERIFIED')) G13 = true;
  const expectedState = G0 ? 'FAILED_CAPTURE' : G9 ? 'FAILED_STATIC' : G10 ? 'FAILED_RUNTIME' : G11 ? 'FAILED_VISUAL' : G13 ? 'FAILED_EDITOR' : 'DIAGNOSTIC_ONLY';
  if (report?.state !== expectedState) return { G9: G9 || report?.state === 'PROMOTABLE_VERIFIED', G10, G11: G11 || report?.state === 'PROMOTABLE_VERIFIED', G13 };
  return { G9, G10, G11, G13 };
}

async function validBuild(bundle, packageHash = bundle?.packageHash) {
  try {
    const hashable = { schemaVersion: bundle.schemaVersion, packageHash: bundle.packageHash, entrySymbol: bundle.entrySymbol, files: bundle.files, artifactHash: bundle.artifactHash };
    if (bundle.packageHash !== packageHash || bundle.artifactHash !== sha256(canonicalJson(bundle.files)) || bundle.buildHash !== sha256(canonicalJson(hashable))) return false;
    const names = ['bundle.js', 'bundle.css', 'index.html'];
    if (canonicalJson((await fs.readdir(bundle.publicDir)).sort()) !== canonicalJson(names.slice().sort())) return false;
    for (const name of names) {
      const bytes = await fs.readFile(path.join(bundle.publicDir, name));
      if (bundle.files[name]?.sha256 !== sha256(bytes) || bundle.files[name]?.bytes !== bytes.length) return false;
    }
    return true;
  } catch { return false; }
}

async function validCapture(evidence) {
  try {
    if (!evidence || !(await validBuild(evidence.bundle)) || evidence.runtime.buildHash !== evidence.bundle.buildHash || evidence.runtime.packageHash !== evidence.bundle.packageHash) return false;
    const screenshot = await sharp(evidence.screenshotBytes).metadata();
    if (evidence.runtime.screenshot.sha256 !== sha256(evidence.screenshotBytes) || evidence.runtime.screenshot.width !== screenshot.width || evidence.runtime.screenshot.height !== screenshot.height
      || evidence.runtime.screenshot.colorProfile !== screenshot.space || screenshot.space !== evidence.environmentManifest.color.browserColorProfile) return false;
    if (evidence.requiredState.reference) {
      const reference = await sharp(evidence.referenceBytes).metadata();
      if (evidence.runtime.reference.sha256 !== sha256(evidence.referenceBytes) || evidence.runtime.reference.width !== reference.width || evidence.runtime.reference.height !== reference.height
        || evidence.runtime.reference.decodedColorProfile !== reference.space || reference.space !== evidence.environmentManifest.color.figmaColorProfile) return false;
    }
    return true;
  } catch { return false; }
}

async function validEnvironment(evidence, viewport) {
  try {
    const manifest = evidence.environmentManifest;
    const { browser, os: operatingSystem, fonts, color, render } = manifest;
    if (manifest.schemaVersion !== 1 || !['microfixture', 'integration'].includes(manifest.evidenceClass) || !path.isAbsolute(browser.executablePath) || !HASH.test(browser.sha256)
      || !browser.version || !browser.provenanceId || sha256(await fs.readFile(await fs.realpath(browser.executablePath))) !== browser.sha256) return false;
    if (operatingSystem.platform !== os.platform() || operatingSystem.release !== os.release() || operatingSystem.arch !== os.arch() || !operatingSystem.imageId || !operatingSystem.provenanceId
      || !path.isAbsolute(operatingSystem.receiptPath) || !HASH.test(operatingSystem.receiptSha256) || sha256(await fs.readFile(await fs.realpath(operatingSystem.receiptPath))) !== operatingSystem.receiptSha256) return false;
    if (!Array.isArray(fonts) || !fonts.length) return false;
    const mappings = new Set();
    for (const font of fonts) {
      if (!font.figmaFamily || !font.figmaStyle || !font.webFamily || !font.provenanceId || !font.licenseId || !path.isAbsolute(font.filePath) || !HASH.test(font.sha256)) return false;
      const realFont = await fs.realpath(font.filePath);
      const mapping = `${font.figmaFamily}\u0000${font.figmaStyle}`;
      if (!FONT_ROOTS.some((root) => within(root, realFont)) || sha256(await fs.readFile(realFont)) !== font.sha256 || mappings.has(mapping)) return false;
      mappings.add(mapping);
    }
    if (!(color.figmaExportScale > 0) || color.figmaColorProfile !== 'srgb' || color.browserColorProfile !== 'srgb') return false;
    if (!Number.isSafeInteger(render.stableTimeMs) || render.stableTimeMs < 0 || render.animations !== 'disabled' || render.transitions !== 'disabled'
      || render.imageDecoding !== 'complete' || render.fontReadiness !== 'ready' || !render.backgroundColor || !render.locale || !['ltr', 'rtl'].includes(render.direction)
      || !['reduce', 'no-preference'].includes(render.reducedMotion)) return false;
    const observed = evidence.runtime.environment;
    const webFonts = new Set(fonts.map((font) => font.webFamily));
    if (observed.browserVersion !== browser.version || observed.locale !== render.locale || observed.direction !== render.direction || observed.reducedMotion !== render.reducedMotion
      || observed.fontsReady !== true || observed.imagesDecoded !== true || observed.backgroundColor !== render.backgroundColor || observed.stableTimeMs !== render.stableTimeMs
      || observed.animationsDisabled !== true || observed.transitionsDisabled !== true || observed.deviceScaleFactor !== viewport.dpr || canonicalJson(observed.viewport) !== canonicalJson(viewport)
      || !Array.isArray(observed.fontFamilies) || !observed.fontFamilies.every((family) => family.split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, '')).some((name) => webFonts.has(name)))) return false;
    const manifestHash = sha256(canonicalJson(manifest));
    return evidence.runtime.environmentManifestHash === manifestHash && evidence.fidelityBudgets.environmentManifestHash === manifestHash
      && (!evidence.requiredState.reference || (evidence.requiredState.reference.exportScale === color.figmaExportScale && evidence.requiredState.reference.colorProfile === color.figmaColorProfile));
  } catch { return false; }
}

async function validEditorRun(row) {
  try {
    const before = row.before?.packageOutput;
    if (!EDITOR_CASES.includes(row.caseId) || !validPackage(before)) return false;
    if (row.caseId === 'EC6') {
      const fragment = before.sourceMap.fragments.find((item) => item.fragmentId === row.selection?.fragmentId);
      return fragment?.ownerNodeId === row.selection?.ownerNodeId && await validBuild(row.afterBuild?.bundle, sha256(canonicalJson(before))) && await validCapture(row.runtimeCapture)
        && row.runtimeCapture.bundle.buildHash === row.afterBuild.bundle.buildHash;
    }
    const after = row.after?.packageOutput;
    if (!validPackage(after)) return false;
    const sourceId = selectionSourceId(before.sourceMap, row.selection);
    const beforeSegment = before.sourceMap.segments.find((item) => item.segmentId === row.segmentId);
    const afterSegment = after.sourceMap.segments.find((item) => item.segmentId === row.segmentId);
    if (!beforeSegment || !afterSegment || beforeSegment.nodeId !== sourceId || !caseSegment(row.caseId, beforeSegment)) return false;
    if (!localized(before, after, beforeSegment, afterSegment) || canonicalJson(identityOrder(before.sourceMap)) !== canonicalJson(identityOrder(after.sourceMap))) return false;
    if (!(await validBuild(row.afterBuild?.bundle, sha256(canonicalJson(after)))) || !(await validCapture(row.runtimeCapture)) || row.runtimeCapture.bundle.buildHash !== row.afterBuild.bundle.buildHash) return false;
    if (row.caseId === 'EC8b' && (sha256(canonicalJson(row.rerun?.packageOutput)) !== sha256(canonicalJson(before)) || !row.overwrittenSegmentIds?.includes(row.segmentId))) return false;
    return true;
  } catch { return false; }
}

function validPackage(output) {
  try {
    const manifest = JSON.parse(output.files['manifest.json']);
    const sourceMap = JSON.parse(output.files['source-map.json']);
    const inventory = Object.fromEntries(Object.entries(output.files).filter(([name]) => name !== 'manifest.json').sort().map(([name, content]) => [name, { sha256: sha256(content), bytes: Buffer.byteLength(content) }]));
    const identityHash = sha256(canonicalJson({
      nodes: output.sourceMap.elements.map((row) => row.nodeId).sort(), components: output.sourceMap.components.map((row) => [row.componentKey, row.sourceId]).sort(),
      fragments: output.sourceMap.fragments.map((row) => [row.fragmentId, row.ownerNodeId]).sort(), bindings: output.sourceMap.bindings.map((row) => [row.bindingId, row.source]).sort(),
    }));
    return canonicalJson(manifest) === canonicalJson(output.manifest) && canonicalJson(sourceMap) === canonicalJson(output.sourceMap) && canonicalJson(inventory) === canonicalJson(output.manifest.files)
      && identityHash === output.sourceMap.identityHash;
  } catch { return false; }
}

function localized(before, after, first, second) {
  const changed = changedFiles(before.files, after.files);
  if (!changed.length || changed.some((name) => ![first.file, 'source-map.json', 'manifest.json'].includes(name))) return false;
  const a = Buffer.from(before.files[first.file]);
  const b = Buffer.from(after.files[second.file]);
  return first.text !== second.text && a.subarray(first.startByte, first.endByte).toString() === first.text && b.subarray(second.startByte, second.endByte).toString() === second.text
    && a.subarray(0, first.startByte).equals(b.subarray(0, second.startByte)) && a.subarray(first.endByte).equals(b.subarray(second.endByte));
}

function identityOrder(map) {
  return {
    elements: map.elements.map((row) => row.nodeId), components: map.components.map((row) => [row.componentKey, row.sourceId, row.memberKeys, row.memberSourceIds]),
    fragments: map.fragments.map((row) => [row.fragmentId, row.ownerNodeId]), segments: map.segments.map((row) => [row.segmentId, row.nodeId, row.kind, row.modeContextId ?? null]),
    bindings: map.bindings.map((row) => [row.bindingId, row.source, row.segmentIds]),
  };
}

function selectionSourceId(map, selection) {
  if (selection?.kind === 'node') return map.elements.find((row) => row.nodeId === selection.nodeId)?.nodeId;
  if (selection?.kind === 'component') return map.components.find((row) => row.componentKey === selection.componentKey)?.sourceId;
  if (selection?.kind === 'fragment') return map.fragments.find((row) => row.fragmentId === selection.fragmentId)?.ownerNodeId;
  return null;
}

function caseSegment(caseId, row) {
  if (caseId === 'EC1') return row.kind === 'css-value' && row.cssProperty?.startsWith('padding-');
  if (caseId === 'EC2') return row.kind === 'css-value' && row.cssProperty === 'border-radius';
  if (caseId === 'EC3') return ['token-expression', 'react-token-expression'].includes(row.kind);
  if (caseId === 'EC4') return row.kind === 'jsx-prop-value';
  if (caseId === 'EC5') return row.modeContextId && row.modeContextId !== 'ø';
  if (caseId === 'EC7') return row.kind === 'jsx-text';
  return ['EC8a', 'EC8b'].includes(caseId);
}

async function measureRegions(actualBytes, referenceBytes, regions) {
  const out = {};
  for (const [kind, region] of Object.entries(regions ?? {})) {
    const a = await (region ? sharp(actualBytes).flatten({ background: '#ffffff' }).extract(region) : sharp(actualBytes).flatten({ background: '#ffffff' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await (region ? sharp(referenceBytes).flatten({ background: '#ffffff' }).extract(region) : sharp(referenceBytes).flatten({ background: '#ffffff' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (a.data.length !== b.data.length) throw new Error('region size');
    let changed = 0, delta = 0;
    for (let index = 0; index < a.data.length; index += a.info.channels) {
      const difference = Math.max(Math.abs(a.data[index] - b.data[index]), Math.abs(a.data[index + 1] - b.data[index + 1]), Math.abs(a.data[index + 2] - b.data[index + 2]));
      if (difference > 2) changed++;
      delta += difference;
    }
    const pixels = a.data.length / a.info.channels;
    out[kind] = { changedPct: changed / pixels * 100, meanDelta: delta / pixels };
  }
  if (!Object.keys(out).length) throw new Error('regions missing');
  return out;
}

const allFailed = () => ({ G9: true, G10: true, G11: true, G13: true });
const subtreeFile = (name) => name === 'manifest.json' || name === 'source-map.json' || name === 'fidelity-report.json' || ['screens/', 'styles/', 'components/'].some((prefix) => name.startsWith(prefix));
const generatedSubtreeFile = (name) => ['screens/', 'styles/', 'components/'].some((prefix) => name.startsWith(prefix));
const pickReference = (row) => row && ({ kind: row.kind, fileKey: row.fileKey, version: row.version, rootId: row.rootId, manifestHash: row.manifestHash ?? null, captureId: row.captureId ?? null, exportScale: row.exportScale, colorProfile: row.colorProfile });
const finite = (value) => Number.isFinite(value) && value >= 0;
const changedFiles = (before, after) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((name) => before[name] !== after[name]).sort();
const within = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);

function expectedRuntimeBindings(tokenPlan) {
  const rows = [...(tokenPlan?.tokenData?.css ?? []), ...(tokenPlan?.tokenData?.react ?? [])];
  return Object.fromEntries((tokenPlan?.bindings ?? []).map((binding) => {
    const channel = rows.find((row) => row.channelId === binding.channelId && row.target === binding.target);
    const context = channel?.contexts.find((row) => row.modeContextId === binding.modeContextId);
    const resolvedValue = binding.target === 'css' ? serializeCss(context?.value) : context?.value?.value;
    return [binding.bindingId, { channelId: binding.channelId, modeContextId: binding.modeContextId, target: binding.target, resolvedValue }];
  }));
}

function serializeCss(value) {
  if (value?.kind === 'number') return `${format(value.value)}${value.unit ?? ''}`;
  if (value?.kind === 'color') return `rgb(${value.channels.map((channel) => format(channel * 255)).join(' ')} / ${format(value.alpha)})`;
  if (value?.kind === 'string') return JSON.stringify(value.value);
  return null;
}
const format = (value) => Number(value.toFixed(6)).toString();
