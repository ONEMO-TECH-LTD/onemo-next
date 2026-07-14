import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCanonicalModel } from '../src/canonical-model.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';
import { emptyTokenRegistry, stageTokenRegistry } from '../src/token-registry.mjs';
import { buildTokenPlan } from '../src/token-plan.mjs';
import { buildModeContextPlan } from '../src/mode-context-plan.mjs';
import { lowerSemanticSlice } from '../src/semantic-slice.mjs';
import { buildLayoutRenderPlan } from '../src/layout-render-plan.mjs';
import { buildEmissionPackage } from '../src/emission-package.mjs';
import { buildRuntimeProof, RuntimeProofError } from '../src/runtime-proof.mjs';
import { buildRuntimeBundle, RuntimeBundleError } from '../src/runtime-bundle.mjs';
import { captureRuntimeState } from '../src/runtime-capture.mjs';
import { p3Fixture } from './p3-fixture.mjs';
import { p6Failures } from './p6-oracle.mjs';

const CODEC_POLICY_ID = 'p6-fixture-codecs-v1';
const acceptColorSyntax = ({ domain, syntax }) => domain === 'color' ? syntax : null;
const optionsFor = (record) => record.destinationDomain === 'opacity-normalized' ? { opacityScale: 'percent' } : {};

function fixture() {
  const { snapshot } = p3Fixture();
  const model = buildCanonicalModel({ snapshot, evidenceClass: 'microfixture', fileKey: 'P6_FIXTURE' });
  const registryStage = stageTokenRegistry({ model, baseRegistry: emptyTokenRegistry(), webSyntaxPolicy: acceptColorSyntax });
  const tokenPlan = buildTokenPlan({ model, registry: registryStage.candidateRegistry, registryStageId: registryStage.stageId, registryBaseHash: registryStage.baseHash, codecPolicyId: CODEC_POLICY_ID, codecOptions: optionsFor });
  const modeContextPlan = buildModeContextPlan(model);
  const semanticSlice = lowerSemanticSlice({ model, tokenPlan, modeContextPlan, registryStage, codecPolicyId: CODEC_POLICY_ID, codecOptions: optionsFor });
  const layoutRenderPlan = buildLayoutRenderPlan(model);
  const { packageOutput, editorAuthority } = buildEmissionPackage({ model, tokenPlan, modeContextPlan, semanticSlice, layoutRenderPlan, registryStage, codecPolicyId: CODEC_POLICY_ID, codecOptions: optionsFor });
  const packageHash = sha256(canonicalJson(packageOutput));
  const reference = { fileKey: 'REFERENCE_FILE', version: 'v1', rootId: model.documentGraph.rootId };
  const requiredState = { id: 'light', rootId: model.documentGraph.rootId, viewport: { width: 402, height: 874, dpr: 2 }, collectionModes: { CK_THEME: 'light' }, metricClasses: ['flat-color'], reference };
  const environment = { browser: 'fixture-chrome', userAgent: 'fixture-agent', locale: 'en-GB', viewport: requiredState.viewport, fontsReady: true };
  const environmentId = sha256(canonicalJson(environment));
  const buildFiles = { 'bundle.js': { sha256: '1'.repeat(64), bytes: 10 }, 'bundle.css': { sha256: '2'.repeat(64), bytes: 10 }, 'index.html': { sha256: '3'.repeat(64), bytes: 10 } };
  const artifactHash = sha256(canonicalJson(buildFiles));
  const locality = (id, changedFiles, allowedFiles, requiredFiles) => {
    const beforeFiles = Object.fromEntries([...new Set([...changedFiles, 'stable.txt'])].map((name) => [name, { sha256: '4'.repeat(64), bytes: 10 }]));
    const afterFiles = structuredClone(beforeFiles);
    for (const name of changedFiles) afterFiles[name] = { sha256: '5'.repeat(64), bytes: 11 };
    return { id, beforeFiles, afterFiles, changedFiles, allowedFiles, requiredFiles };
  };
  const runtimeState = {
    id: 'light', rootId: model.documentGraph.rootId, viewport: structuredClone(requiredState.viewport), collectionModes: structuredClone(requiredState.collectionModes), packageHash,
    contexts: Object.fromEntries(modeContextPlan.nodes.map((row) => [row.nodeId, row.modeContextId])),
    bindings: expectedRuntimeBindings(tokenPlan),
    consoleErrors: [], networkRequests: [], runtimeErrors: [],
    environment, environmentId,
    screenshot: { sha256: 'a'.repeat(64), width: 804, height: 1748 },
    reference: { ...reference, sha256: 'b'.repeat(64), width: 804, height: 1748 },
    metrics: { 'flat-color': { changedPct: 0.1, meanDelta: 0.2 } },
  };
  const input = {
    packageOutput, modeContextPlan, tokenPlan,
    compileRequest: { schemaVersion: 1, targetKind: 'screen', rootIds: [model.documentGraph.rootId], requiredStates: [requiredState] },
    builds: [{ id: 'build-a', packageHash, artifactHash, files: buildFiles }, { id: 'build-b', packageHash, artifactHash, files: structuredClone(buildFiles) }],
    localityRuns: [
      locality('token-value', ['tokens.css', 'token-values.ts', 'fidelity-report.json'], ['tokens.css', 'token-values.ts', 'fidelity-report.json'], ['tokens.css']),
      locality('label', ['token-registry.json'], ['token-registry.json'], ['token-registry.json']),
      locality('subtree', ['screens/Screen.tsx', 'styles/Screen.module.css'], ['screens/Screen.tsx', 'styles/Screen.module.css'], ['screens/Screen.tsx']),
    ],
    runtimeStates: [runtimeState],
    fidelityBudgets: { schemaVersion: 1, environmentId, classes: { 'flat-color': { maxChangedPct: 1, maxMeanDelta: 1 } } },
    editorRuns: ['EC1', 'EC2', 'EC3', 'EC4', 'EC5', 'EC6', 'EC7', 'EC8a', 'EC8b'].map((caseId) => ({ caseId, state: 'VERIFIED', changedFiles: ['styles/root.module.css'], allowedFiles: ['styles/root.module.css'], identityPreserved: true, modeOrderPreserved: true, recompiled: true })),
    blockers: [],
  };
  input.promotionAuthority = {
    schemaVersion: 1,
    authorityId: 'p6-fixture-authority-v1',
    evidenceClass: 'integration',
    packageHash,
    compileRequestHash: sha256(canonicalJson(input.compileRequest)),
    fidelityBudgetsHash: sha256(canonicalJson(input.fidelityBudgets)),
    blockersHash: sha256(canonicalJson(input.blockers)),
  };
  return { input, packageHash, editorAuthority };
}

test('P6 yields PROMOTABLE_VERIFIED only for complete deterministic runtime, visual, and editor evidence', () => {
  const { input } = fixture();
  const report = buildRuntimeProof(input);
  assert.equal(report.state, 'PROMOTABLE_VERIFIED');
  assert.deepEqual(report.gates, { G9: 'VERIFIED', G10: 'VERIFIED', G11: 'VERIFIED', G13: 'VERIFIED' });
  assert.deepEqual(p6Failures({ ...input, report }), { G9: false, G10: false, G11: false, G13: false });
  assert.equal(buildRuntimeProof(input).reportHash, report.reportHash);
});

test('P6 fails closed with the specific terminal truth state', () => {
  const missingRuntime = fixture().input; missingRuntime.runtimeStates = [];
  assert.equal(buildRuntimeProof(missingRuntime).state, 'FAILED_RUNTIME');
  const visual = fixture().input; visual.runtimeStates[0].metrics['flat-color'].meanDelta = 2;
  assert.equal(buildRuntimeProof(visual).state, 'FAILED_VISUAL');
  const editor = fixture().input; editor.editorRuns[0].identityPreserved = false;
  assert.equal(buildRuntimeProof(editor).state, 'FAILED_EDITOR');
  const locality = fixture().input; locality.localityRuns[0].changedFiles.push('screens/churn.tsx');
  assert.equal(buildRuntimeProof(locality).state, 'FAILED_STATIC');
});

test('P6 never promotes an unreferenced state or an open upstream blocker', () => {
  const unreferenced = fixture().input; unreferenced.compileRequest.requiredStates[0].reference = null; unreferenced.runtimeStates[0].reference = null;
  assert.equal(buildRuntimeProof(unreferenced).state, 'DIAGNOSTIC_ONLY');
  const blocked = fixture().input; blocked.blockers = ['G-1'];
  assert.equal(buildRuntimeProof(blocked).state, 'DIAGNOSTIC_ONLY');
  const unauthorized = fixture().input; delete unauthorized.promotionAuthority;
  assert.equal(buildRuntimeProof(unauthorized).state, 'DIAGNOSTIC_ONLY');
});

test('P6 validates exact state, context, binding, reference, build, and corpus identities', () => {
  for (const [mutate, state] of [
    [(input) => { input.runtimeStates[0].contexts.root = 'forged'; }, 'FAILED_RUNTIME'],
    [(input) => { input.runtimeStates[0].bindings[Object.keys(input.runtimeStates[0].bindings)[0]].channelId = 'forged'; }, 'FAILED_RUNTIME'],
    [(input) => { input.runtimeStates[0].bindings[Object.keys(input.runtimeStates[0].bindings)[0]].resolvedValue = 'forged'; }, 'FAILED_RUNTIME'],
    [(input) => { input.runtimeStates[0].reference.version = 'v2'; }, 'FAILED_CAPTURE'],
    [(input) => { input.builds[1].packageHash = '0'.repeat(64); }, 'FAILED_STATIC'],
    [(input) => { input.builds[1].files['bundle.js'].sha256 = '9'.repeat(64); }, 'FAILED_STATIC'],
    [(input) => { input.runtimeStates[0].networkRequests.push('https://example.test/data'); }, 'FAILED_RUNTIME'],
    [(input) => { input.runtimeStates[0].environment.userAgent = 'forged'; }, 'FAILED_RUNTIME'],
    [(input) => { input.runtimeStates[0].metrics.extra = { changedPct: 0, meanDelta: 0 }; }, 'FAILED_VISUAL'],
    [(input) => { input.editorRuns[0].changedFiles.push('screens/unrelated.tsx'); }, 'FAILED_EDITOR'],
    [(input) => { input.promotionAuthority.compileRequestHash = '0'.repeat(64); }, 'DIAGNOSTIC_ONLY'],
  ]) {
    const { input } = fixture(); mutate(input);
    assert.equal(buildRuntimeProof(input).state, state);
  }
  const malformed = fixture().input; malformed.compileRequest.requiredStates.push(structuredClone(malformed.compileRequest.requiredStates[0]));
  assert.throws(() => buildRuntimeProof(malformed), RuntimeProofError);
});

function expectedRuntimeBindings(tokenPlan) {
  const rows = [...tokenPlan.tokenData.css, ...tokenPlan.tokenData.react];
  return Object.fromEntries(tokenPlan.bindings.map((binding) => {
    const channel = rows.find((row) => row.channelId === binding.channelId);
    const context = channel.contexts.find((row) => row.modeContextId === binding.modeContextId);
    const resolvedValue = binding.target === 'css' ? serializeCss(context.value) : context.value.value;
    return [binding.bindingId, { channelId: binding.channelId, modeContextId: binding.modeContextId, target: binding.target, resolvedValue }];
  }));
}

function serializeCss(value) {
  if (value.kind === 'number') return `${Number(value.value.toFixed(6))}${value.unit ?? ''}`;
  if (value.kind === 'color') return `rgb(${value.channels.map((channel) => Number((channel * 255).toFixed(6))).join(' ')} / ${Number(value.alpha.toFixed(6))})`;
  if (value.kind === 'string') return JSON.stringify(value.value);
  throw new Error(`unsupported fixture CSS value ${value.kind}`);
}

test('independent P6 oracle rejects a forged promotable report', () => {
  const { input } = fixture();
  const report = buildRuntimeProof(input);
  const forged = structuredClone(report); forged.states[0].reference.version = 'forged'; delete forged.reportHash; forged.reportHash = sha256(canonicalJson(forged));
  assert.equal(p6Failures({ ...input, report: forged }).G11, true);
});

test('P6 production bundle is byte-deterministic and refuses unsafe package paths', async () => {
  const { input } = fixture();
  const root = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-p6-'));
  const nodeModulesDir = path.resolve('node_modules');
  try {
    const first = await buildRuntimeBundle({ packageOutput: input.packageOutput, outDir: path.join(root, 'a'), nodeModulesDir });
    const second = await buildRuntimeBundle({ packageOutput: input.packageOutput, outDir: path.join(root, 'b'), nodeModulesDir });
    assert.equal(first.buildHash, second.buildHash);
    assert.deepEqual(first.files, second.files);
    assert.match(await readFile(path.join(first.publicDir, 'index.html'), 'utf8'), /bundle\.js/);
    assert.deepEqual((await readdir(first.publicDir)).sort(), ['bundle.css', 'bundle.js', 'index.html']);
    const unsafe = structuredClone(input.packageOutput); unsafe.files['../escape.ts'] = 'export {};\n';
    await assert.rejects(buildRuntimeBundle({ packageOutput: unsafe, outDir: path.join(root, 'unsafe'), nodeModulesDir }), RuntimeBundleError);
    const stale = structuredClone(input.packageOutput); stale.files['tokens.css'] += '\n:root { --forged: red; }\n';
    await assert.rejects(buildRuntimeBundle({ packageOutput: stale, outDir: path.join(root, 'stale'), nodeModulesDir }), /manifest inventory drift/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('P6 production bundle renders exact scoped contexts and token values in Chrome', async () => {
  const { input } = fixture();
  const root = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-p6-browser-'));
  const playwrightPath = [process.env.FTC_PLAYWRIGHT, '/opt/homebrew/lib/node_modules/@playwright/test/node_modules/playwright/index.mjs', '/opt/homebrew/lib/node_modules/playwright/index.mjs'].filter(Boolean).find(existsSync);
  assert.ok(playwrightPath, 'pinned P6 browser runtime requires Playwright');
  const chromePath = process.env.FTC_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  assert.ok(existsSync(chromePath), 'pinned P6 browser runtime requires Chrome');
  try {
    const bundle = await buildRuntimeBundle({ packageOutput: input.packageOutput, outDir: root, nodeModulesDir: path.resolve('node_modules') });
    const { chromium } = await import(playwrightPath);
    const first = await captureRuntimeState({ chromium, chromePath, bundle, modeContextPlan: input.modeContextPlan, tokenPlan: input.tokenPlan, requiredState: input.compileRequest.requiredStates[0] });
    const second = await captureRuntimeState({
      chromium, chromePath, bundle, modeContextPlan: input.modeContextPlan, tokenPlan: input.tokenPlan,
      requiredState: input.compileRequest.requiredStates[0],
      reference: { metadata: input.compileRequest.requiredStates[0].reference, bytes: first.screenshotBytes },
      metricRegions: { 'flat-color': null },
    });
    assert.deepEqual(second.runtime.consoleErrors, []);
    assert.deepEqual(second.runtime.networkRequests, []);
    assert.deepEqual(second.runtime.runtimeErrors, []);
    assert.equal(second.runtime.environmentId, sha256(canonicalJson(second.runtime.environment)));
    assert.deepEqual(second.runtime.bindings, expectedRuntimeBindings(input.tokenPlan));
    assert.deepEqual(second.runtime.contexts, Object.fromEntries(input.modeContextPlan.nodes.map((row) => [row.nodeId, row.modeContextId])));
    assert.deepEqual(second.runtime.metrics, { 'flat-color': { changedPct: 0, meanDelta: 0 } });
  } finally { await rm(root, { recursive: true, force: true }); }
});
