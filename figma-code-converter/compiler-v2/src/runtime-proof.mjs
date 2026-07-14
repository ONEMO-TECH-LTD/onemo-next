/** P6 verdict builder over authority-backed build, capture, visual, and editor evidence. */
import { canonicalJson, sha256 } from './evidence.mjs';
import { selectComponent, selectFragment, selectSource } from './editor-adapter.mjs';
import { assertRuntimeBuild } from './runtime-bundle.mjs';
import { assertRuntimeCapture } from './runtime-capture.mjs';

const EDITOR_CASES = Object.freeze(['EC1', 'EC2', 'EC3', 'EC4', 'EC5', 'EC6', 'EC7', 'EC8a', 'EC8b']);
const HASH = /^[0-9a-f]{64}$/;
const LOCALITY = Object.freeze({
  label: { required: ['token-registry.json'], allowed: (name) => ['token-registry.json', 'source-map.json', 'manifest.json'].includes(name) },
  'token-value': { required: ['tokens.css'], allowed: (name) => ['tokens.css', 'token-values.ts', 'fidelity-report.json', 'source-map.json', 'manifest.json'].includes(name) },
  subtree: {
    required: [],
    requiredAny: (name) => name.startsWith('screens/') || name.startsWith('styles/') || name.startsWith('components/'),
    allowed: (name) => name === 'manifest.json' || name === 'source-map.json' || name === 'fidelity-report.json' || name.startsWith('screens/') || name.startsWith('styles/') || name.startsWith('components/'),
  },
});

export class RuntimeProofError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_RUNTIME'; }
}

export async function buildRuntimeProof(input) {
  validateShape(input);
  authenticatePackage(input.packageOutput, input.editorAuthority, input.packageOutput.rootId);
  const packageHash = sha256(canonicalJson(input.packageOutput));
  const issues = { G9: [], G10: [], G11: [], G13: [], G0: [] };
  await verifyBuilds(input.builds, packageHash, issues.G9);
  verifyLocality(input.localityRuns, packageHash, issues.G9);
  const expectedContexts = Object.fromEntries(input.modeContextPlan.nodes.map((row) => [row.nodeId, row.modeContextId]));
  const expectedBindings = expectedRuntimeBindings(input.tokenPlan);
  const captureById = new Map(input.runtimeCaptures.map((row) => [row.runtime?.id, row]));
  const states = [];
  for (const required of input.compileRequest.requiredStates) {
    const capture = captureById.get(required.id);
    const runtimeVerified = await verifyRuntime(required, capture, packageHash, input.fidelityBudgets, expectedContexts, expectedBindings, issues.G10);
    if (capture && runtimeVerified) verifyVisual(required, capture.runtime, input.fidelityBudgets, issues.G0, issues.G11);
    else if (required.reference) issues.G11.push(`state ${required.id} lacks authority-backed runtime capture`);
    states.push({
      id: required.id,
      rootId: required.rootId,
      viewport: structuredClone(required.viewport),
      collectionModes: structuredClone(required.collectionModes),
      reference: capture?.runtime?.reference ? structuredClone(capture.runtime.reference) : null,
      screenshot: capture?.runtime?.screenshot ? structuredClone(capture.runtime.screenshot) : null,
      metrics: capture?.runtime?.metrics ? structuredClone(capture.runtime.metrics) : {},
    });
  }
  for (const capture of input.runtimeCaptures) if (!input.compileRequest.requiredStates.some((row) => row.id === capture.runtime?.id)) issues.G10.push(`undeclared runtime state ${capture.runtime?.id ?? '?'}`);
  await verifyEditor(input.editorRuns, issues.G13);

  const gates = Object.fromEntries(['G9', 'G10', 'G11', 'G13'].map((gate) => [gate, issues[gate].length ? 'FAILED' : 'VERIFIED']));
  const unreferenced = input.compileRequest.requiredStates.some((row) => row.reference === null);
  let state = 'DIAGNOSTIC_ONLY';
  if (issues.G0.length) state = 'FAILED_CAPTURE';
  else if (issues.G9.length) state = 'FAILED_STATIC';
  else if (issues.G10.length) state = 'FAILED_RUNTIME';
  else if (issues.G11.length) state = 'FAILED_VISUAL';
  else if (issues.G13.length) state = 'FAILED_EDITOR';
  if (unreferenced) gates.G11 = 'DIAGNOSTIC_ONLY';
  const report = {
    schemaVersion: 1,
    state,
    packageHash,
    environmentManifestHash: input.fidelityBudgets.environmentManifestHash,
    gates,
    blockers: [...input.blockers],
    promotionAuthorityId: null,
    issues,
    states,
    buildIds: input.builds.map((row) => row.id),
    localityRunIds: input.localityRuns.map((row) => row.id).sort(),
    editorCaseIds: input.editorRuns.map((row) => row.caseId).sort(),
  };
  return { ...report, reportHash: sha256(canonicalJson(report)) };
}

function validateShape(input) {
  if (!input || typeof input !== 'object') throw new RuntimeProofError('P6 input must be an object');
  for (const key of ['packageOutput', 'editorAuthority', 'modeContextPlan', 'tokenPlan', 'compileRequest', 'fidelityBudgets']) if (!input[key] || typeof input[key] !== 'object') throw new RuntimeProofError(`${key} missing`);
  for (const key of ['builds', 'localityRuns', 'runtimeCaptures', 'editorRuns', 'blockers']) if (!Array.isArray(input[key])) throw new RuntimeProofError(`${key} must be an array`);
  const request = input.compileRequest;
  if (request.schemaVersion !== 1 || !['screen', 'component', 'component-set'].includes(request.targetKind) || !Array.isArray(request.rootIds) || !request.rootIds.length || !Array.isArray(request.requiredStates) || !request.requiredStates.length) throw new RuntimeProofError('CompileRequest malformed');
  unique(request.requiredStates.map((row) => row.id), 'required state id');
  unique(input.runtimeCaptures.map((row) => row.runtime?.id), 'runtime state id');
  for (const state of request.requiredStates) {
    if (!state.id || !request.rootIds.includes(state.rootId) || !validViewport(state.viewport) || !plainObject(state.collectionModes) || !stringSet(state.metricClasses) || !state.metricClasses.length) throw new RuntimeProofError(`required state ${state.id ?? '?'} malformed`);
    if (state.reference !== null && (!plainObject(state.reference) || !['microfixture', 'figma-export'].includes(state.reference.kind) || !state.reference.fileKey || !state.reference.version || !state.reference.rootId
      || !Number.isFinite(state.reference.exportScale) || state.reference.exportScale <= 0 || state.reference.colorProfile !== 'srgb'
      || (state.reference.kind === 'figma-export' && (!HASH.test(state.reference.manifestHash ?? '') || !state.reference.captureId)))) throw new RuntimeProofError(`required state ${state.id} reference malformed`);
  }
  if (input.fidelityBudgets.schemaVersion !== 1 || !HASH.test(input.fidelityBudgets.environmentManifestHash ?? '') || !plainObject(input.fidelityBudgets.classes)) throw new RuntimeProofError('fidelity budgets malformed');
}

async function verifyBuilds(builds, packageHash, issues) {
  if (builds.length < 2) issues.push('two repeated production builds required');
  uniqueSoft(builds.map((row) => row.id), 'build id', issues);
  for (const row of builds) {
    try {
      await assertRuntimeBuild(row.bundle, row.buildAuthority);
      if (row.bundle.packageHash !== packageHash) throw new Error('package hash drift');
    } catch (error) { issues.push(`build ${row.id ?? '?'} authority refused: ${error.message}`); }
  }
  if (new Set(builds.map((row) => row.bundle?.buildHash)).size !== 1 || canonicalJson(builds[0]?.bundle?.files) !== canonicalJson(builds[1]?.bundle?.files)) issues.push('repeated production build artifacts differ');
}

function verifyLocality(runs, packageHash, issues) {
  uniqueSoft(runs.map((row) => row.id), 'locality run id', issues);
  for (const id of Object.keys(LOCALITY)) if (!runs.some((row) => row.id === id)) issues.push(`missing locality run ${id}`);
  for (const run of runs) {
    const policy = LOCALITY[run.id];
    if (!policy || !run.before?.packageOutput || !run.after?.packageOutput) { issues.push(`locality run ${run.id ?? '?'} malformed`); continue; }
    try {
      authenticatePackage(run.before.packageOutput, run.before.editorAuthority, run.before.packageOutput.rootId);
      authenticatePackage(run.after.packageOutput, run.after.editorAuthority, run.after.packageOutput.rootId);
    } catch (error) { issues.push(`locality run ${run.id} authority refused: ${error.message}`); continue; }
    if (sha256(canonicalJson(run.before.packageOutput)) !== packageHash || run.before.packageOutput.rootId !== run.after.packageOutput.rootId) {
      issues.push(`locality run ${run.id} base package identity drift`);
      continue;
    }
    const changed = changedFiles(run.before.packageOutput.files, run.after.packageOutput.files);
    if (!changed.length || changed.some((name) => !policy.allowed(name)) || policy.required.some((name) => !changed.includes(name))
      || (policy.requiredAny && !changed.some(policy.requiredAny))) issues.push(`locality run ${run.id} violates contract-owned artifact policy: ${changed.join(',') || 'none'}`);
  }
}

async function verifyRuntime(required, capture, packageHash, budgets, contexts, bindings, issues) {
  if (!capture) { issues.push(`required runtime state ${required.id} missing`); return false; }
  const issueCount = issues.length;
  try { await assertRuntimeCapture(capture, capture.captureAuthority); }
  catch (error) { issues.push(`runtime state ${required.id} capture authority refused: ${error.message}`); return false; }
  const runtime = capture.runtime;
  if (canonicalJson(capture.requiredState) !== canonicalJson(required) || canonicalJson(capture.fidelityBudgets) !== canonicalJson(budgets)) issues.push(`runtime state ${required.id} capture contract drift`);
  if (runtime.rootId !== required.rootId || runtime.packageHash !== packageHash || canonicalJson(runtime.viewport) !== canonicalJson(required.viewport) || canonicalJson(runtime.collectionModes) !== canonicalJson(required.collectionModes)) issues.push(`runtime state ${required.id} identity drift`);
  if (canonicalJson(runtime.contexts) !== canonicalJson(contexts)) issues.push(`runtime state ${required.id} scoped context drift`);
  if (canonicalJson(runtime.bindings) !== canonicalJson(bindings)) issues.push(`runtime state ${required.id} binding selection drift`);
  if (runtime.consoleErrors?.length || runtime.networkRequests?.length || runtime.runtimeErrors?.length) issues.push(`runtime state ${required.id} emitted console/network/runtime errors`);
  const width = required.viewport.width * required.viewport.dpr;
  const height = required.viewport.height * required.viewport.dpr;
  if (!HASH.test(runtime.screenshot?.sha256 ?? '') || runtime.screenshot?.width !== width || runtime.screenshot?.height !== height) issues.push(`runtime state ${required.id} screenshot missing or wrong dimensions`);
  return issues.length === issueCount;
}

function verifyVisual(required, runtime, budgets, captureIssues, visualIssues) {
  if (!required.reference) return;
  const reference = runtime?.reference;
  if (!reference || canonicalJson(pickReference(reference)) !== canonicalJson(pickReference(required.reference)) || !HASH.test(reference.sha256 ?? '')) { captureIssues.push(`state ${required.id} authored reference missing or stale`); return; }
  const width = required.viewport.width * required.viewport.dpr;
  const height = required.viewport.height * required.viewport.dpr;
  if (reference.width !== width || reference.height !== height) { captureIssues.push(`state ${required.id} reference dimensions drift`); return; }
  const metrics = runtime?.metrics;
  if (!plainObject(metrics) || canonicalJson(Object.keys(metrics).sort()) !== canonicalJson([...required.metricClasses].sort())) { visualIssues.push(`state ${required.id} calibrated metric class census differs`); return; }
  for (const [kind, metric] of Object.entries(metrics)) {
    const budget = budgets.classes[kind];
    if (!budget || !finiteNonnegative(metric?.changedPct) || !finiteNonnegative(metric?.meanDelta) || !finiteNonnegative(budget.maxChangedPct) || !finiteNonnegative(budget.maxMeanDelta)) visualIssues.push(`state ${required.id} metric ${kind} lacks a valid budget`);
    else if (metric.changedPct > budget.maxChangedPct || metric.meanDelta > budget.maxMeanDelta) visualIssues.push(`state ${required.id} metric ${kind} exceeds budget`);
  }
}

async function verifyEditor(runs, issues) {
  uniqueSoft(runs.map((row) => row.caseId), 'editor case id', issues);
  for (const id of EDITOR_CASES) if (!runs.some((row) => row.caseId === id)) issues.push(`missing editor case ${id}`);
  for (const run of runs) {
    try { await verifyEditorRun(run); }
    catch (error) { issues.push(`editor case ${run.caseId ?? '?'} refused: ${error.message}`); }
  }
}

async function verifyEditorRun(run) {
  if (!EDITOR_CASES.includes(run.caseId) || !run.before?.packageOutput || !run.before?.editorAuthority) throw new Error('raw before package authority missing');
  const before = run.before.packageOutput;
  authenticatePackage(before, run.before.editorAuthority, before.rootId);
  if (run.caseId === 'EC6') {
    if (run.selection?.kind !== 'fragment') throw new Error('EC6 requires fragment selection');
    const fragment = selectFragment(before, run.before.editorAuthority, run.selection.fragmentId);
    if (fragment.owner.nodeId !== run.selection.ownerNodeId) throw new Error('fragment semantic owner drift');
    await assertEditorRuntime(run, before);
    return;
  }
  if (!run.after?.packageOutput || !run.after?.editorAuthority || !run.segmentId) throw new Error('raw edited package/segment authority missing');
  const after = run.after.packageOutput;
  authenticatePackage(after, run.after.editorAuthority, after.rootId);
  assertRotatedAuthority(after, run.before.editorAuthority, run.after.editorAuthority);
  const selected = select(run.selection, before, run.before.editorAuthority);
  const beforeSegment = before.sourceMap.segments.find((row) => row.segmentId === run.segmentId);
  const afterSegment = after.sourceMap.segments.find((row) => row.segmentId === run.segmentId);
  if (!beforeSegment || !afterSegment || beforeSegment.editable !== true || afterSegment.file !== beforeSegment.file) throw new Error('addressed editable segment missing');
  const selectedNodeId = selected.nodeId ?? selected.selectedSourceId ?? selected.sourceId;
  if (beforeSegment.nodeId !== selectedNodeId) throw new Error('selected semantic owner does not own addressed segment');
  assertEditorCaseSegment(run.caseId, beforeSegment);
  const changed = changedFiles(before.files, after.files);
  const allowed = [beforeSegment.file, 'source-map.json', 'manifest.json'];
  if (!changed.length || changed.some((name) => !allowed.includes(name))) throw new Error(`non-local package diff: ${changed.join(',') || 'none'}`);
  assertLocalizedSegmentDiff(before, after, beforeSegment, afterSegment);
  assertEditorIdentityOrder(before.sourceMap, after.sourceMap);
  if (before.rootId !== after.rootId || before.sourceMap.identityHash !== after.sourceMap.identityHash || before.modelContentSeal !== after.modelContentSeal) throw new Error('package identity changed across edit');
  await assertEditorRuntime(run, after);
  if (run.caseId === 'EC8b') {
    authenticatePackage(run.rerun?.packageOutput, run.rerun?.editorAuthority, before.rootId);
    if (sha256(canonicalJson(run.rerun.packageOutput)) !== sha256(canonicalJson(before)) || !run.overwrittenSegmentIds?.includes(run.segmentId)) throw new Error('rerun truth/overwritten segment evidence drift');
  }
}

function assertEditorIdentityOrder(before, after) {
  const identity = (map) => ({
    elements: map.elements.map((row) => row.nodeId),
    components: map.components.map((row) => [row.componentKey, row.sourceId, row.memberKeys, row.memberSourceIds]),
    fragments: map.fragments.map((row) => [row.fragmentId, row.ownerNodeId]),
    segments: map.segments.map((row) => [row.segmentId, row.nodeId, row.kind, row.modeContextId ?? null]),
    bindings: map.bindings.map((row) => [row.bindingId, row.source, row.segmentIds]),
  });
  if (canonicalJson(identity(before)) !== canonicalJson(identity(after))) throw new Error('source identity, mode, or render order drift');
}

async function assertEditorRuntime(run, packageOutput) {
  await assertRuntimeBuild(run.afterBuild?.bundle, run.afterBuild?.buildAuthority);
  if (run.afterBuild.bundle.packageHash !== sha256(canonicalJson(packageOutput))) throw new Error('editor build does not bind selected package');
  await assertRuntimeCapture(run.runtimeCapture, run.runtimeCapture?.captureAuthority);
  if (run.runtimeCapture.bundle.buildHash !== run.afterBuild.bundle.buildHash) throw new Error('editor runtime does not bind editor build');
}

function assertLocalizedSegmentDiff(before, after, beforeSegment, afterSegment) {
  const beforeBytes = Buffer.from(before.files[beforeSegment.file], 'utf8');
  const afterBytes = Buffer.from(after.files[afterSegment.file], 'utf8');
  if (beforeSegment.text === afterSegment.text || beforeBytes.subarray(beforeSegment.startByte, beforeSegment.endByte).toString('utf8') !== beforeSegment.text
    || afterBytes.subarray(afterSegment.startByte, afterSegment.endByte).toString('utf8') !== afterSegment.text
    || !beforeBytes.subarray(0, beforeSegment.startByte).equals(afterBytes.subarray(0, afterSegment.startByte))
    || !beforeBytes.subarray(beforeSegment.endByte).equals(afterBytes.subarray(afterSegment.endByte))) throw new Error('changed bytes escape the addressed source-map segment');
  const afterById = new Map(after.sourceMap.segments.map((row) => [row.segmentId, row]));
  for (const row of before.sourceMap.segments) {
    const next = afterById.get(row.segmentId);
    if (!next || (row.segmentId !== beforeSegment.segmentId && row.text !== next.text) || row.nodeId !== next.nodeId || row.kind !== next.kind || row.modeContextId !== next.modeContextId) throw new Error('unaddressed source-map segment identity/content drift');
  }
}

function select(selection, output, authority) {
  if (selection?.kind === 'node') return selectSource(output, authority, selection.nodeId);
  if (selection?.kind === 'component') return selectComponent(output, authority, selection.componentKey);
  if (selection?.kind === 'fragment') return selectFragment(output, authority, selection.fragmentId);
  throw new Error('selection identity missing');
}

function assertEditorCaseSegment(caseId, segment) {
  if (caseId === 'EC1' && (segment.kind !== 'css-value' || !segment.cssProperty?.startsWith('padding-'))) throw new Error('EC1 requires one padding slot');
  if (caseId === 'EC2' && (segment.kind !== 'css-value' || !/^border-(?:radius|(?:top|bottom)-(?:left|right)-radius)$/.test(segment.cssProperty))) throw new Error('EC2 requires one radius slot');
  if (caseId === 'EC3' && !['token-expression', 'react-token-expression'].includes(segment.kind)) throw new Error('EC3 requires a token-expression segment');
  if (caseId === 'EC4' && segment.kind !== 'jsx-prop-value') throw new Error('EC4 requires a component prop segment');
  if (caseId === 'EC5' && (!segment.modeContextId || segment.modeContextId === 'ø')) throw new Error('EC5 requires a scoped-mode segment');
  if (caseId === 'EC7' && segment.kind !== 'jsx-text') throw new Error('EC7 requires a text segment');
}

function assertRotatedAuthority(after, beforeAuthority, afterAuthority) {
  let staleAccepted = false;
  try { selectSource(after, beforeAuthority, after.rootId); staleAccepted = true; } catch {}
  if (staleAccepted) throw new Error('pre-edit editor authority still accepts edited package');
  selectSource(after, afterAuthority, after.rootId);
}

function authenticatePackage(output, authority, rootId) { selectSource(output, authority, rootId); }
function unique(values, label) { if (!values.every((value) => typeof value === 'string' && value) || new Set(values).size !== values.length) throw new RuntimeProofError(`${label} missing or duplicate`); }
function uniqueSoft(values, label, issues) { if (!values.every((value) => typeof value === 'string' && value) || new Set(values).size !== values.length) issues.push(`${label} missing or duplicate`); }
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validViewport = (row) => plainObject(row) && Number.isInteger(row.width) && row.width > 0 && Number.isInteger(row.height) && row.height > 0 && Number.isFinite(row.dpr) && row.dpr > 0;
const stringSet = (rows) => Array.isArray(rows) && rows.every((row) => typeof row === 'string' && row) && new Set(rows).size === rows.length;
const finiteNonnegative = (value) => Number.isFinite(value) && value >= 0;
const pickReference = (row) => ({ kind: row.kind, fileKey: row.fileKey, version: row.version, rootId: row.rootId, manifestHash: row.manifestHash ?? null, captureId: row.captureId ?? null, exportScale: row.exportScale, colorProfile: row.colorProfile });
const changedFiles = (before, after) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((name) => before[name] !== after[name]).sort();

function expectedRuntimeBindings(tokenPlan) {
  const rows = [...tokenPlan.tokenData.css, ...tokenPlan.tokenData.react];
  return Object.fromEntries(tokenPlan.bindings.map((binding) => {
    const channel = rows.find((row) => row.channelId === binding.channelId && row.target === binding.target);
    const context = channel?.contexts.find((row) => row.modeContextId === binding.modeContextId);
    if (!context) throw new RuntimeProofError(`binding ${binding.bindingId} lacks runtime token data`);
    return [binding.bindingId, { channelId: binding.channelId, modeContextId: binding.modeContextId, target: binding.target, resolvedValue: binding.target === 'css' ? serializeCss(context.value) : structuredClone(context.value.value) }];
  }));
}

function serializeCss(value) {
  if (value?.kind === 'number') return `${format(value.value)}${value.unit ?? ''}`;
  if (value?.kind === 'color') return `rgb(${value.channels.map((channel) => format(channel * 255)).join(' ')} / ${format(value.alpha)})`;
  if (value?.kind === 'string') return JSON.stringify(value.value);
  throw new RuntimeProofError(`unsupported runtime CSS token value ${value?.kind}`);
}

function format(value) {
  if (!Number.isFinite(value)) throw new RuntimeProofError('nonfinite runtime token value');
  return Number(value.toFixed(6)).toString();
}
