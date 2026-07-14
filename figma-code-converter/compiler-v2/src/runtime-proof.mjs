/** P6 pure verdict builder over production-build, browser-runtime, visual, and editor evidence. */
import { canonicalJson, sha256 } from './evidence.mjs';

const EDITOR_CASES = Object.freeze(['EC1', 'EC2', 'EC3', 'EC4', 'EC5', 'EC6', 'EC7', 'EC8a', 'EC8b']);
const LOCALITY_CASES = Object.freeze(['label', 'subtree', 'token-value']);
const HASH = /^[0-9a-f]{64}$/;

export class RuntimeProofError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_RUNTIME'; }
}

export function buildRuntimeProof(input) {
  validateShape(input);
  const packageHash = sha256(canonicalJson(input.packageOutput));
  const issues = { G9: [], G10: [], G11: [], G13: [], G0: [] };
  verifyBuilds(input.builds, packageHash, issues.G9);
  verifyLocality(input.localityRuns, issues.G9);
  const expectedContexts = Object.fromEntries(input.modeContextPlan.nodes.map((row) => [row.nodeId, row.modeContextId]));
  const expectedBindings = expectedRuntimeBindings(input.tokenPlan);
  const runtimeById = new Map(input.runtimeStates.map((row) => [row.id, row]));
  const states = [];
  for (const required of input.compileRequest.requiredStates) {
    const runtime = runtimeById.get(required.id);
    verifyRuntime(required, runtime, packageHash, input.fidelityBudgets.environmentId, expectedContexts, expectedBindings, issues.G10);
    if (runtime) verifyVisual(required, runtime, input.fidelityBudgets, issues.G0, issues.G11);
    states.push({
      id: required.id,
      rootId: required.rootId,
      viewport: structuredClone(required.viewport),
      collectionModes: structuredClone(required.collectionModes),
      reference: runtime?.reference ? structuredClone(runtime.reference) : null,
      screenshot: runtime?.screenshot ? structuredClone(runtime.screenshot) : null,
      metrics: runtime?.metrics ? structuredClone(runtime.metrics) : {},
    });
  }
  for (const runtime of input.runtimeStates) if (!input.compileRequest.requiredStates.some((row) => row.id === runtime.id)) issues.G10.push(`undeclared runtime state ${runtime.id}`);
  verifyEditor(input.editorRuns, issues.G13);

  const gates = Object.fromEntries(['G9', 'G10', 'G11', 'G13'].map((gate) => [gate, issues[gate].length ? 'FAILED' : 'VERIFIED']));
  const unreferenced = input.compileRequest.requiredStates.some((row) => row.reference === null);
  const authorityValid = validPromotionAuthority(input.promotionAuthority, input, packageHash);
  let state = 'PROMOTABLE_VERIFIED';
  if (issues.G0.length) state = 'FAILED_CAPTURE';
  else if (issues.G9.length) state = 'FAILED_STATIC';
  else if (issues.G10.length) state = 'FAILED_RUNTIME';
  else if (issues.G11.length) state = 'FAILED_VISUAL';
  else if (issues.G13.length) state = 'FAILED_EDITOR';
  else if (unreferenced || input.blockers.length || !authorityValid) state = 'DIAGNOSTIC_ONLY';
  if (unreferenced) gates.G11 = 'DIAGNOSTIC_ONLY';
  const report = {
    schemaVersion: 1,
    state,
    packageHash,
    environmentId: input.fidelityBudgets.environmentId,
    gates,
    blockers: [...input.blockers],
    promotionAuthorityId: authorityValid ? input.promotionAuthority.authorityId : null,
    issues,
    states,
    buildIds: input.builds.map((row) => row.id),
    localityRunIds: input.localityRuns.map((row) => row.id).sort(),
    editorCaseIds: input.editorRuns.map((row) => row.caseId).sort(),
  };
  return { ...report, reportHash: hashReport(report) };
}

function validateShape(input) {
  if (!input || typeof input !== 'object') throw new RuntimeProofError('P6 input must be an object');
  for (const key of ['packageOutput', 'modeContextPlan', 'tokenPlan', 'compileRequest', 'fidelityBudgets']) if (!input[key] || typeof input[key] !== 'object') throw new RuntimeProofError(`${key} missing`);
  for (const key of ['builds', 'localityRuns', 'runtimeStates', 'editorRuns', 'blockers']) if (!Array.isArray(input[key])) throw new RuntimeProofError(`${key} must be an array`);
  const request = input.compileRequest;
  if (request.schemaVersion !== 1 || !['screen', 'component', 'component-set'].includes(request.targetKind) || !Array.isArray(request.rootIds) || !request.rootIds.length || !Array.isArray(request.requiredStates) || !request.requiredStates.length) throw new RuntimeProofError('CompileRequest malformed');
  unique(request.requiredStates.map((row) => row.id), 'required state id');
  unique(input.runtimeStates.map((row) => row.id), 'runtime state id');
  for (const state of request.requiredStates) {
    if (!state.id || !request.rootIds.includes(state.rootId) || !validViewport(state.viewport) || !plainObject(state.collectionModes) || !stringSet(state.metricClasses) || !state.metricClasses.length) throw new RuntimeProofError(`required state ${state.id ?? '?'} malformed`);
    if (state.reference !== null && (!plainObject(state.reference) || !state.reference.fileKey || !state.reference.version || !state.reference.rootId)) throw new RuntimeProofError(`required state ${state.id} reference malformed`);
  }
  if (input.fidelityBudgets.schemaVersion !== 1 || !input.fidelityBudgets.environmentId || !plainObject(input.fidelityBudgets.classes)) throw new RuntimeProofError('fidelity budgets malformed');
}

function verifyBuilds(builds, packageHash, issues) {
  if (builds.length < 2) issues.push('two repeated production builds required');
  uniqueSoft(builds.map((row) => row.id), 'build id', issues);
  for (const build of builds) {
    if (!build.id || build.packageHash !== packageHash) issues.push(`build ${build.id ?? '?'} package hash drift`);
    if (!plainObject(build.files) || build.artifactHash !== sha256(canonicalJson(build.files))) issues.push(`build ${build.id ?? '?'} artifact inventory drift`);
  }
  if (new Set(builds.map((row) => row.artifactHash)).size !== 1 || canonicalJson(builds[0]?.files) !== canonicalJson(builds[1]?.files)) issues.push('repeated production build artifacts differ');
}

function verifyLocality(runs, issues) {
  uniqueSoft(runs.map((row) => row.id), 'locality run id', issues);
  for (const required of LOCALITY_CASES) if (!runs.some((row) => row.id === required)) issues.push(`missing locality run ${required}`);
  for (const run of runs) {
    if (!plainObject(run.beforeFiles) || !plainObject(run.afterFiles) || !stringSet(run.changedFiles) || !stringSet(run.allowedFiles) || !stringSet(run.requiredFiles)) { issues.push(`locality run ${run.id ?? '?'} malformed`); continue; }
    const derived = changedFiles(run.beforeFiles, run.afterFiles);
    if (canonicalJson(derived) !== canonicalJson([...run.changedFiles].sort())) issues.push(`locality run ${run.id} reported diff disagrees with inventories`);
    if (!subset(run.changedFiles, run.allowedFiles)) issues.push(`locality run ${run.id} changed forbidden files`);
    if (!subset(run.requiredFiles, run.changedFiles)) issues.push(`locality run ${run.id} missed required files`);
  }
}

function verifyRuntime(required, runtime, packageHash, environmentId, contexts, bindings, issues) {
  if (!runtime) { issues.push(`required runtime state ${required.id} missing`); return; }
  if (runtime.rootId !== required.rootId || runtime.packageHash !== packageHash || canonicalJson(runtime.viewport) !== canonicalJson(required.viewport) || canonicalJson(runtime.collectionModes) !== canonicalJson(required.collectionModes)) issues.push(`runtime state ${required.id} identity drift`);
  if (canonicalJson(runtime.contexts) !== canonicalJson(contexts)) issues.push(`runtime state ${required.id} scoped context drift`);
  if (canonicalJson(runtime.bindings) !== canonicalJson(bindings)) issues.push(`runtime state ${required.id} binding selection drift`);
  if (runtime.consoleErrors?.length || runtime.networkRequests?.length || runtime.runtimeErrors?.length) issues.push(`runtime state ${required.id} emitted console/network/runtime errors`);
  if (!plainObject(runtime.environment) || runtime.environmentId !== sha256(canonicalJson(runtime.environment)) || runtime.environmentId !== environmentId) issues.push(`runtime state ${required.id} environment identity drift`);
  const width = required.viewport.width * required.viewport.dpr;
  const height = required.viewport.height * required.viewport.dpr;
  if (!HASH.test(runtime.screenshot?.sha256 ?? '') || runtime.screenshot?.width !== width || runtime.screenshot?.height !== height) issues.push(`runtime state ${required.id} screenshot missing or wrong dimensions`);
}

function verifyVisual(required, runtime, budgets, captureIssues, visualIssues) {
  if (!required.reference) return;
  const reference = runtime?.reference;
  if (!reference || canonicalJson(pickReference(reference)) !== canonicalJson(required.reference) || !HASH.test(reference.sha256 ?? '')) { captureIssues.push(`state ${required.id} authored reference missing or stale`); return; }
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

function verifyEditor(runs, issues) {
  uniqueSoft(runs.map((row) => row.caseId), 'editor case id', issues);
  for (const id of EDITOR_CASES) if (!runs.some((row) => row.caseId === id)) issues.push(`missing editor case ${id}`);
  for (const run of runs) if (run.state !== 'VERIFIED' || !stringSet(run.changedFiles) || !stringSet(run.allowedFiles) || !subset(run.changedFiles, run.allowedFiles) || !run.identityPreserved || !run.modeOrderPreserved || !run.recompiled) issues.push(`editor case ${run.caseId ?? '?'} failed locality/recompile identity`);
}

function unique(values, label) { if (!values.every((value) => typeof value === 'string' && value) || new Set(values).size !== values.length) throw new RuntimeProofError(`${label} missing or duplicate`); }
function uniqueSoft(values, label, issues) { if (!values.every((value) => typeof value === 'string' && value) || new Set(values).size !== values.length) issues.push(`${label} missing or duplicate`); }
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validViewport = (row) => plainObject(row) && Number.isInteger(row.width) && row.width > 0 && Number.isInteger(row.height) && row.height > 0 && Number.isFinite(row.dpr) && row.dpr > 0;
const stringSet = (rows) => Array.isArray(rows) && rows.every((row) => typeof row === 'string' && row) && new Set(rows).size === rows.length;
const subset = (rows, allowed) => rows.every((row) => allowed.includes(row));
const finiteNonnegative = (value) => Number.isFinite(value) && value >= 0;
const pickReference = (row) => ({ fileKey: row.fileKey, version: row.version, rootId: row.rootId });
const hashReport = (report) => sha256(canonicalJson(report));
const changedFiles = (before, after) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((name) => canonicalJson(before[name]) !== canonicalJson(after[name])).sort();

function validPromotionAuthority(authority, input, packageHash) {
  return authority?.schemaVersion === 1 && authority.evidenceClass === 'integration' && typeof authority.authorityId === 'string' && authority.authorityId
    && authority.packageHash === packageHash
    && authority.compileRequestHash === sha256(canonicalJson(input.compileRequest))
    && authority.fidelityBudgetsHash === sha256(canonicalJson(input.fidelityBudgets))
    && authority.blockersHash === sha256(canonicalJson(input.blockers));
}

function expectedRuntimeBindings(tokenPlan) {
  const rows = [...tokenPlan.tokenData.css, ...tokenPlan.tokenData.react];
  return Object.fromEntries(tokenPlan.bindings.map((binding) => {
    const channel = rows.find((row) => row.channelId === binding.channelId && row.target === binding.target);
    const context = channel?.contexts.find((row) => row.modeContextId === binding.modeContextId);
    if (!context) throw new RuntimeProofError(`binding ${binding.bindingId} lacks runtime token data`);
    return [binding.bindingId, {
      channelId: binding.channelId,
      modeContextId: binding.modeContextId,
      target: binding.target,
      resolvedValue: binding.target === 'css' ? serializeCss(context.value) : structuredClone(context.value.value),
    }];
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
