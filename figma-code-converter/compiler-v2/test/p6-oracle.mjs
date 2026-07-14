/** Independent P6 G9-G11/G13 oracle. No runtime-proof/compiler emitter imports. */
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const EDITOR_CASES = ['EC1', 'EC2', 'EC3', 'EC4', 'EC5', 'EC6', 'EC7', 'EC8a', 'EC8b'];
const LOCALITY_CASES = ['label', 'subtree', 'token-value'];
const HASH = /^[0-9a-f]{64}$/;

export function p6Failures({ packageOutput, compileRequest, builds, localityRuns, runtimeStates, fidelityBudgets, editorRuns, modeContextPlan, tokenPlan, blockers = [], promotionAuthority, report }) {
  const packageHash = sha256(canonicalJson(packageOutput));
  const packageHashes = new Set((builds ?? []).map((row) => row.packageHash));
  const G9 = builds?.length < 2 || packageHashes.size !== 1 || !packageHashes.has(packageHash)
    || (builds ?? []).some((row) => row.artifactHash !== sha256(canonicalJson(row.files)))
    || new Set((builds ?? []).map((row) => row.artifactHash)).size !== 1
    || LOCALITY_CASES.some((id) => !(localityRuns ?? []).some((row) => row.id === id))
    || (localityRuns ?? []).some((row) => canonicalJson(changedFiles(row.beforeFiles, row.afterFiles)) !== canonicalJson([...(row.changedFiles ?? [])].sort()) || !exactSubset(row.changedFiles, row.allowedFiles) || !exactSubset(row.requiredFiles, row.changedFiles));
  const expectedContexts = Object.fromEntries((modeContextPlan?.nodes ?? []).map((row) => [row.nodeId, row.modeContextId]));
  const expectedBindings = expectedRuntimeBindings(tokenPlan);
  const requested = compileRequest?.requiredStates ?? [];
  let G10 = requested.length !== runtimeStates?.length;
  let G11 = false;
  let G0 = false;
  for (const state of requested) {
    const runtime = runtimeStates?.find((row) => row.id === state.id);
    const width = state.viewport?.width * state.viewport?.dpr;
    const height = state.viewport?.height * state.viewport?.dpr;
    if (!runtime || runtime.packageHash !== packageHash || canonicalJson(runtime.contexts) !== canonicalJson(expectedContexts) || canonicalJson(runtime.bindings) !== canonicalJson(expectedBindings)
      || canonicalJson(runtime.viewport) !== canonicalJson(state.viewport) || canonicalJson(runtime.collectionModes) !== canonicalJson(state.collectionModes)
      || runtime.consoleErrors?.length || runtime.runtimeErrors?.length || runtime.networkRequests?.length
      || runtime.environmentId !== sha256(canonicalJson(runtime.environment)) || runtime.environmentId !== fidelityBudgets?.environmentId
      || !HASH.test(runtime.screenshot?.sha256 ?? '') || runtime.screenshot?.width !== width || runtime.screenshot?.height !== height) G10 = true;
    if (!state.reference) continue;
    if (!runtime?.reference || canonicalJson(pickReference(runtime.reference)) !== canonicalJson(state.reference) || !HASH.test(runtime.reference.sha256 ?? '') || runtime.reference.width !== width || runtime.reference.height !== height) G0 = true;
    if (canonicalJson(Object.keys(runtime?.metrics ?? {}).sort()) !== canonicalJson([...(state.metricClasses ?? [])].sort())) G11 = true;
    for (const [kind, metric] of Object.entries(runtime?.metrics ?? {})) {
      const budget = fidelityBudgets?.classes?.[kind];
      if (!budget || !finite(metric.changedPct) || !finite(metric.meanDelta) || !finite(budget.maxChangedPct) || !finite(budget.maxMeanDelta)
        || metric.changedPct > budget.maxChangedPct || metric.meanDelta > budget.maxMeanDelta) G11 = true;
    }
  }
  let G13 = EDITOR_CASES.some((id) => !(editorRuns ?? []).some((row) => row.caseId === id))
    || editorRuns.some((row) => row.state !== 'VERIFIED' || !row.identityPreserved || !row.modeOrderPreserved || !row.recompiled || !exactSubset(row.changedFiles, row.allowedFiles));
  const { reportHash: ignored, ...hashable } = report ?? {};
  const expectedHash = sha256(canonicalJson(hashable));
  if (report?.reportHash !== expectedHash) return { G9: true, G10: true, G11: true, G13: true };
  if (canonicalJson(report.states?.map((row) => ({ id: row.id, reference: row.reference }))) !== canonicalJson(runtimeStates?.map((row) => ({ id: row.id, reference: row.reference })))) G11 = true;
  if (report.gates?.G9 !== (G9 ? 'FAILED' : 'VERIFIED')) return { G9: true, G10, G11, G13 };
  if (report.gates?.G10 !== (G10 ? 'FAILED' : 'VERIFIED')) G10 = true;
  const expectedG11 = requested.some((row) => row.reference === null) && !G11 ? 'DIAGNOSTIC_ONLY' : G11 ? 'FAILED' : 'VERIFIED';
  if (report.gates?.G11 !== expectedG11) G11 = true;
  if (report.gates?.G13 !== (G13 ? 'FAILED' : 'VERIFIED')) G13 = true;
  const authorityValid = promotionAuthority?.schemaVersion === 1 && promotionAuthority.evidenceClass === 'integration'
    && promotionAuthority.packageHash === packageHash
    && promotionAuthority.compileRequestHash === sha256(canonicalJson(compileRequest))
    && promotionAuthority.fidelityBudgetsHash === sha256(canonicalJson(fidelityBudgets))
    && promotionAuthority.blockersHash === sha256(canonicalJson(blockers));
  const expectedState = G0 ? 'FAILED_CAPTURE' : G9 ? 'FAILED_STATIC' : G10 ? 'FAILED_RUNTIME' : G11 ? 'FAILED_VISUAL' : G13 ? 'FAILED_EDITOR'
    : requested.some((row) => row.reference === null) || blockers.length || !authorityValid ? 'DIAGNOSTIC_ONLY' : 'PROMOTABLE_VERIFIED';
  if (report.state !== expectedState) return { G9: G9 || report.state === 'PROMOTABLE_VERIFIED', G10, G11: G11 || report.state === 'PROMOTABLE_VERIFIED', G13 };
  return { G9, G10, G11, G13 };
}

const exactSubset = (subset = [], superset = []) => subset.every((value) => superset.includes(value)) && new Set(subset).size === subset.length;
const pickReference = (row) => row && ({ fileKey: row.fileKey, version: row.version, rootId: row.rootId });

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
const finite = (value) => Number.isFinite(value) && value >= 0;
const changedFiles = (before = {}, after = {}) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((name) => canonicalJson(before[name]) !== canonicalJson(after[name])).sort();
