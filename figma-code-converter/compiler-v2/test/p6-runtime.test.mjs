import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCanonicalModel } from '../src/canonical-model.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';
import { emptyTokenRegistry, stageTokenRegistry } from '../src/token-registry.mjs';
import { buildTokenPlan } from '../src/token-plan.mjs';
import { buildModeContextPlan } from '../src/mode-context-plan.mjs';
import { lowerSemanticSlice } from '../src/semantic-slice.mjs';
import { buildLayoutRenderPlan } from '../src/layout-render-plan.mjs';
import { buildEmissionPackage } from '../src/emission-package.mjs';
import { saveSegmentEdit } from '../src/editor-adapter.mjs';
import { buildRuntimeProof, RuntimeProofError } from '../src/runtime-proof.mjs';
import { assertRuntimeBuild, buildRuntimeBundle, RuntimeBundleError } from '../src/runtime-bundle.mjs';
import { assertRuntimeCapture, captureRuntimeState, createMicrofixtureEnvironmentAuthority } from '../src/runtime-capture.mjs';
import { p3Fixture } from './p3-fixture.mjs';
import { p6EditorRunFailures, p6Failures } from './p6-oracle.mjs';

const CODEC_POLICY_ID = 'p6-fixture-codecs-v1';
const NODE_MODULES = path.dirname(path.dirname(fileURLToPath(import.meta.resolve('react'))));
const PLAYWRIGHT = [process.env.FTC_PLAYWRIGHT, '/opt/homebrew/lib/node_modules/@playwright/test/node_modules/playwright/index.mjs', '/opt/homebrew/lib/node_modules/playwright/index.mjs'].filter(Boolean).find(existsSync);
const CHROME = process.env.FTC_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FONT_PATH = process.env.FTC_FONT ?? '/System/Library/Fonts/Times.ttc';
const FONT_SHA256 = existsSync(FONT_PATH) ? sha256(readFileSync(FONT_PATH)) : null;
const OS_RECEIPT = '/System/Library/CoreServices/SystemVersion.plist';
const OS_RECEIPT_SHA256 = existsSync(OS_RECEIPT) ? sha256(readFileSync(OS_RECEIPT)) : null;
const acceptColorSyntax = ({ domain, syntax }) => domain === 'color' ? syntax : null;
const optionsFor = (record) => record.destinationDomain === 'opacity-normalized' ? { opacityScale: 'percent' } : {};
let sharedFixture;
let sharedRoot;

after(async () => { if (sharedRoot) await rm(sharedRoot, { recursive: true, force: true }); });

function compileFixture({ fixtureOptions = {}, mutate } = {}) {
  const { snapshot } = p3Fixture(fixtureOptions);
  Object.assign(snapshot.document, { layoutMode: 'VERTICAL', itemSpacing: 0, paddingTop: 8, paddingRight: 8, paddingBottom: 8, paddingLeft: 8, cornerRadius: 10 });
  snapshot.document.children.push({
    id: 'radius-box', type: 'RECTANGLE', name: 'Slot-preserving radii', size: { x: 40, y: 24 },
    rectangleCornerRadii: [2, 4, 6, 8], children: [],
  });
  snapshot.supplement.nodes.push({ nodeId: 'radius-box', resolvedVariableModes: { C_THEME: 'light' } });
  const textSupplement = snapshot.supplement.nodes.find((row) => row.nodeId === 'text');
  textSupplement.fontDependencies = [{ family: 'Arial', style: 'Regular', providerId: 'font-apple-arial-regular', sha256: FONT_SHA256 }];
  for (const segment of textSupplement.styledTextSegments) segment.fontName = { family: 'Arial', style: 'Regular' };
  mutate?.(snapshot);
  const model = buildCanonicalModel({ snapshot, evidenceClass: 'microfixture', fileKey: 'P6_FIXTURE' });
  const registryStage = stageTokenRegistry({ model, baseRegistry: emptyTokenRegistry(), webSyntaxPolicy: acceptColorSyntax });
  const tokenPlan = buildTokenPlan({ model, registry: registryStage.candidateRegistry, registryStageId: registryStage.stageId, registryBaseHash: registryStage.baseHash, codecPolicyId: CODEC_POLICY_ID, codecOptions: optionsFor });
  const modeContextPlan = buildModeContextPlan(model);
  const semanticSlice = lowerSemanticSlice({ model, tokenPlan, modeContextPlan, registryStage, codecPolicyId: CODEC_POLICY_ID, codecOptions: optionsFor });
  const layoutRenderPlan = buildLayoutRenderPlan(model);
  const emitted = buildEmissionPackage({ model, tokenPlan, modeContextPlan, semanticSlice, layoutRenderPlan, registryStage, codecPolicyId: CODEC_POLICY_ID, codecOptions: optionsFor });
  return { ...emitted, model, tokenPlan, modeContextPlan };
}

async function fixture() {
  if (sharedFixture) return sharedFixture;
  sharedFixture = (async () => {
    assert.ok(PLAYWRIGHT, 'pinned P6 browser runtime requires Playwright');
    assert.ok(existsSync(CHROME), 'pinned P6 browser runtime requires Chrome');
    assert.ok(FONT_SHA256, 'pinned P6 browser runtime requires the approved font file');
    assert.ok(OS_RECEIPT_SHA256, 'pinned P6 browser runtime requires the OS image receipt');
    sharedRoot = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-p6-evidence-'));
    const base = compileFixture();
    const label = compileFixture({ fixtureOptions: { colorName: 'Velvet / Renamed' } });
    const tokenValue = compileFixture({ fixtureOptions: { darkColor: { r: 0.2, g: 0.3, b: 0.4, a: 1 } } });
    const subtree = compileFixture({ mutate: (snapshot) => { snapshot.document.children[3].opacity = 0.7; } });
    const metadataOnly = compileFixture({ mutate: (snapshot) => { snapshot.document.name = 'Renamed metadata'; } });
    const bundleA = await buildRuntimeBundle({ packageOutput: base.packageOutput, editorAuthority: base.editorAuthority, outDir: path.join(sharedRoot, 'a'), nodeModulesDir: NODE_MODULES });
    const bundleB = await buildRuntimeBundle({ packageOutput: base.packageOutput, editorAuthority: base.editorAuthority, outDir: path.join(sharedRoot, 'b'), nodeModulesDir: NODE_MODULES });
    const { chromium } = await import(PLAYWRIGHT);
    const browserProbe = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb'] });
    const browserVersion = await browserProbe.version();
    await browserProbe.close();
    const environmentManifest = {
      schemaVersion: 1,
      evidenceClass: 'microfixture',
      browser: { executablePath: CHROME, sha256: sha256(await readFile(CHROME)), version: browserVersion, provenanceId: 'system-google-chrome' },
      os: {
        platform: os.platform(), release: os.release(), arch: os.arch(), imageId: `local-${os.platform()}-${os.release()}-${os.arch()}`, provenanceId: 'local-microfixture-host',
        receiptPath: OS_RECEIPT, receiptSha256: OS_RECEIPT_SHA256,
      },
      fonts: [{ figmaFamily: 'Arial', figmaStyle: 'Regular', webFamily: 'Times', filePath: FONT_PATH, sha256: FONT_SHA256, provenanceId: 'apple-system-font', licenseId: 'apple-system-font-license' }],
      color: { figmaExportScale: 1, figmaColorProfile: 'srgb', browserColorProfile: 'srgb' },
      render: {
        animations: 'disabled', transitions: 'disabled', stableTimeMs: 1783987200000, imageDecoding: 'complete', fontReadiness: 'ready',
        backgroundColor: 'rgba(0, 0, 0, 0)', locale: 'en-US', direction: 'ltr', reducedMotion: 'no-preference',
      },
    };
    const environmentManifestHash = sha256(canonicalJson(environmentManifest));
    const environmentAuthority = await createMicrofixtureEnvironmentAuthority({ environmentManifest, chromePath: CHROME });
    const viewport = { width: 120, height: 200, dpr: 1 };
    const bootstrapState = { id: 'light', rootId: base.model.documentGraph.rootId, viewport, collectionModes: { CK_THEME: 'light' }, metricClasses: ['flat-color'], reference: null };
    const fidelityBudgets = { schemaVersion: 1, environmentManifestHash, classes: { 'flat-color': { maxChangedPct: 0, maxMeanDelta: 0 } } };
    const bootstrap = await captureRuntimeState({ chromium, chromePath: CHROME, bundle: bundleA, modeContextPlan: base.modeContextPlan, tokenPlan: base.tokenPlan, requiredState: bootstrapState, fidelityBudgets, environmentManifest, environmentAuthority });
    const reference = { kind: 'microfixture', fileKey: 'P6_MICRO_REFERENCE', version: 'fixture-v1', rootId: base.model.documentGraph.rootId, exportScale: 1, colorProfile: 'srgb' };
    const requiredState = { ...bootstrapState, reference };
    const capture = await captureRuntimeState({
      chromium, chromePath: CHROME, bundle: bundleA, modeContextPlan: base.modeContextPlan, tokenPlan: base.tokenPlan,
      requiredState, fidelityBudgets, environmentManifest, environmentAuthority, reference: { metadata: reference, bytes: bootstrap.screenshotBytes }, metricRegions: { 'flat-color': null },
    });
    const padding = base.packageOutput.sourceMap.segments.find((row) => row.nodeId === base.model.documentGraph.rootId && row.cssProperty === 'padding-top' && row.editable);
    assert.ok(padding, 'P6 editor fixture requires one addressable padding slot');
    const edited = saveSegmentEdit(base.packageOutput, base.editorAuthority, { segmentId: padding.segmentId, value: '12px' });
    const editedBundle = await buildRuntimeBundle({ packageOutput: edited.packageOutput, editorAuthority: edited.editorAuthority, outDir: path.join(sharedRoot, 'edited'), nodeModulesDir: NODE_MODULES });
    const editedCapture = await captureRuntimeState({
      chromium, chromePath: CHROME, bundle: editedBundle, modeContextPlan: base.modeContextPlan, tokenPlan: base.tokenPlan,
      requiredState, fidelityBudgets, environmentManifest, environmentAuthority, reference: { metadata: reference, bytes: bootstrap.screenshotBytes }, metricRegions: { 'flat-color': null },
    });
    const editorRun = {
      caseId: 'EC1', before: base, after: edited, selection: { kind: 'node', nodeId: base.model.documentGraph.rootId }, segmentId: padding.segmentId,
      afterBuild: { bundle: editedBundle, buildAuthority: editedBundle.buildAuthority }, runtimeCapture: editedCapture,
    };
    const radius = base.packageOutput.sourceMap.segments.find((row) => row.nodeId === 'radius-box' && row.cssProperty === 'border-top-right-radius' && row.editable);
    assert.ok(radius, 'P6 editor fixture requires one addressable radius slot');
    const radiusEdited = saveSegmentEdit(base.packageOutput, base.editorAuthority, { segmentId: radius.segmentId, value: '14px' });
    const radiusBundle = await buildRuntimeBundle({ packageOutput: radiusEdited.packageOutput, editorAuthority: radiusEdited.editorAuthority, outDir: path.join(sharedRoot, 'edited-radius'), nodeModulesDir: NODE_MODULES });
    const radiusCapture = await captureRuntimeState({
      chromium, chromePath: CHROME, bundle: radiusBundle, modeContextPlan: base.modeContextPlan, tokenPlan: base.tokenPlan,
      requiredState, fidelityBudgets, environmentManifest, environmentAuthority, reference: { metadata: reference, bytes: bootstrap.screenshotBytes }, metricRegions: { 'flat-color': null },
    });
    const radiusEditorRun = {
      caseId: 'EC2', before: base, after: radiusEdited, selection: { kind: 'node', nodeId: 'radius-box' }, segmentId: radius.segmentId,
      afterBuild: { bundle: radiusBundle, buildAuthority: radiusBundle.buildAuthority }, runtimeCapture: radiusCapture,
    };
    const input = {
      packageOutput: base.packageOutput,
      editorAuthority: base.editorAuthority,
      modeContextPlan: base.modeContextPlan,
      tokenPlan: base.tokenPlan,
      compileRequest: { schemaVersion: 1, targetKind: 'screen', rootIds: [base.model.documentGraph.rootId], requiredStates: [requiredState] },
      builds: [{ id: 'build-a', bundle: bundleA, buildAuthority: bundleA.buildAuthority }, { id: 'build-b', bundle: bundleB, buildAuthority: bundleB.buildAuthority }],
      localityRuns: [
        { id: 'label', before: base, after: label },
        { id: 'token-value', before: base, after: tokenValue },
        { id: 'subtree', before: base, after: subtree },
      ],
      runtimeCaptures: [capture],
      fidelityBudgets,
      editorRuns: [],
      blockers: ['G-1', 'G-2'],
    };
    return { input, base, bundleA, bundleB, capture, editorRun, radiusEditorRun, metadataOnly, environmentManifest, environmentAuthority, chromium, requiredState, fidelityBudgets };
  })();
  return sharedFixture;
}

function forkInput(input) {
  return { ...input, builds: [...input.builds], localityRuns: [...input.localityRuns], runtimeCaptures: [...input.runtimeCaptures], editorRuns: [...input.editorRuns], blockers: [...input.blockers] };
}

test('P6 proves G9-G11 from authority-backed artifacts while the incomplete editor corpus stays non-promotable', async () => {
  const { input } = await fixture();
  const report = await buildRuntimeProof(input);
  assert.equal(report.state, 'FAILED_EDITOR');
  assert.deepEqual(report.gates, { G9: 'VERIFIED', G10: 'VERIFIED', G11: 'VERIFIED', G13: 'FAILED' });
  assert.equal(report.promotionAuthorityId, null);
  assert.deepEqual(await p6Failures({ ...input, report }), { G9: false, G10: false, G11: false, G13: true });
  assert.equal((await buildRuntimeProof(input)).reportHash, report.reportHash);
});

test('P6 refuses caller-minted empty evidence, claimed editor booleans, and promotion labels', async () => {
  const { input } = await fixture();
  const forged = forkInput(input);
  forged.builds = ['a', 'b'].map((id) => ({ id, bundle: { packageHash: sha256(canonicalJson(input.packageOutput)), files: {}, artifactHash: sha256(canonicalJson({})) } }));
  forged.localityRuns = ['label', 'subtree', 'token-value'].map((id) => ({ id, beforeFiles: {}, afterFiles: {}, changedFiles: [], allowedFiles: [], requiredFiles: [] }));
  forged.runtimeCaptures = [{ runtime: { id: 'light' } }];
  forged.editorRuns = ['EC1', 'EC2', 'EC3', 'EC4', 'EC5', 'EC6', 'EC7', 'EC8a', 'EC8b'].map((caseId) => ({ caseId, state: 'VERIFIED', changedFiles: [], allowedFiles: [], identityPreserved: true, modeOrderPreserved: true, recompiled: true }));
  forged.promotionAuthority = { schemaVersion: 1, evidenceClass: 'integration', authorityId: 'self-minted' };
  const report = await buildRuntimeProof(forged);
  assert.notEqual(report.state, 'PROMOTABLE_VERIFIED');
  assert.deepEqual(report.gates, { G9: 'FAILED', G10: 'FAILED', G11: 'FAILED', G13: 'FAILED' });
  assert.equal(report.promotionAuthorityId, null);
});

test('P6 authorities bite independently for build, capture bytes, reference bytes, budgets, and state identity', async () => {
  const { input, metadataOnly } = await fixture();
  const mutations = [
    (copy) => { copy.builds[0] = { ...copy.builds[0], bundle: { ...copy.builds[0].bundle, files: {} } }; },
    (copy) => { const row = copy.localityRuns[0]; copy.localityRuns[0] = { ...row, before: row.after, after: row.before }; },
    (copy) => { const row = copy.localityRuns.find((item) => item.id === 'subtree'); copy.localityRuns[copy.localityRuns.indexOf(row)] = { ...row, after: metadataOnly }; },
    (copy) => { copy.runtimeCaptures[0] = { ...copy.runtimeCaptures[0], screenshotBytes: Buffer.from('forged') }; },
    (copy) => { copy.runtimeCaptures[0] = { ...copy.runtimeCaptures[0], referenceBytes: Buffer.from('forged') }; },
    (copy) => { copy.runtimeCaptures[0] = { ...copy.runtimeCaptures[0], fidelityBudgets: { ...copy.fidelityBudgets, environmentManifestHash: 'f'.repeat(64) } }; },
    (copy) => { copy.runtimeCaptures[0] = { ...copy.runtimeCaptures[0], metricRegions: { invented: null } }; },
    (copy) => { copy.runtimeCaptures[0] = { ...copy.runtimeCaptures[0], runtime: { ...copy.runtimeCaptures[0].runtime, rootId: 'forged' } }; },
  ];
  for (const mutate of mutations) {
    const copy = forkInput(input); mutate(copy);
    const report = await buildRuntimeProof(copy);
    assert.ok(report.gates.G9 === 'FAILED' || report.gates.G10 === 'FAILED', JSON.stringify(report.issues));
  }
});

test('P6 G13 derives exact segment locality, rotated package authority, rebuild, and runtime evidence', async () => {
  const { input, editorRun, radiusEditorRun } = await fixture();
  const accepted = forkInput(input);
  accepted.editorRuns = [editorRun, radiusEditorRun];
  const report = await buildRuntimeProof(accepted);
  assert.equal(report.gates.G13, 'FAILED');
  assert.ok(!report.issues.G13.some((issue) => issue.startsWith('editor case EC1 refused:')), report.issues.G13.join('\n'));
  assert.ok(!report.issues.G13.some((issue) => issue.startsWith('editor case EC2 refused:')), report.issues.G13.join('\n'));
  assert.deepEqual(await p6EditorRunFailures([editorRun, radiusEditorRun]), []);
  const forged = forkInput(input);
  forged.editorRuns = [{ ...editorRun, segmentId: 'forged-segment' }];
  const forgedReport = await buildRuntimeProof(forged);
  assert.ok(forgedReport.issues.G13.some((issue) => issue.startsWith('editor case EC1 refused:')));
  assert.deepEqual(await p6EditorRunFailures([{ ...radiusEditorRun, segmentId: 'forged-segment' }]), ['EC2']);
});

test('P6 production bundle authenticates the rotating P5 package authority and remains byte-deterministic', async () => {
  const { input, base, bundleA, bundleB } = await fixture();
  await assertRuntimeBuild(bundleA, bundleA.buildAuthority);
  assert.equal(bundleA.buildHash, bundleB.buildHash);
  assert.deepEqual(bundleA.files, bundleB.files);
  assert.match(await readFile(path.join(bundleA.publicDir, 'index.html'), 'utf8'), /bundle\.js/);
  assert.deepEqual((await readdir(bundleA.publicDir)).sort(), ['bundle.css', 'bundle.js', 'index.html']);
  const forged = structuredClone(base.packageOutput);
  forged.sourceMap.elements[0].nodeId = 'forged';
  forged.files['source-map.json'] = `${canonicalJson(forged.sourceMap)}\n`;
  resealTestPackage(forged);
  const outDir = path.join(sharedRoot, 'forged');
  await assert.rejects(buildRuntimeBundle({ packageOutput: forged, editorAuthority: input.editorAuthority, outDir, nodeModulesDir: NODE_MODULES }), /P5 package authority refused/);
  await assert.rejects(buildRuntimeBundle({ packageOutput: base.packageOutput, editorAuthority: {}, outDir: path.join(sharedRoot, 'missing-authority'), nodeModulesDir: NODE_MODULES }), RuntimeBundleError);
  const diskBundle = await buildRuntimeBundle({ packageOutput: base.packageOutput, editorAuthority: base.editorAuthority, outDir: path.join(sharedRoot, 'disk-drift'), nodeModulesDir: NODE_MODULES });
  await writeFile(path.join(diskBundle.publicDir, 'bundle.js'), 'forged');
  await assert.rejects(assertRuntimeBuild(diskBundle, diskBundle.buildAuthority), /runtime build artifact bundle\.js drift/);
});

test('P6 capture binds actual build, browser environment, screenshot/reference bytes, regions, and budget identity', async () => {
  const { capture } = await fixture();
  await assertRuntimeCapture(capture, capture.captureAuthority);
  assert.deepEqual(capture.runtime.consoleErrors, []);
  assert.deepEqual(capture.runtime.networkRequests, []);
  assert.deepEqual(capture.runtime.runtimeErrors, []);
  assert.equal(capture.runtime.buildHash, capture.bundle.buildHash);
  assert.equal(capture.runtime.screenshot.sha256, sha256(capture.screenshotBytes));
  assert.equal(capture.runtime.reference.sha256, sha256(capture.referenceBytes));
  assert.equal(capture.runtime.environmentManifestHash, sha256(canonicalJson(capture.environmentManifest)));
  assert.deepEqual(capture.runtime.metrics, { 'flat-color': { changedPct: 0, meanDelta: 0 } });
});

test('P6 environment identity binds browser, OS image, fonts, color profile, and render settings', async () => {
  const { input, capture, bundleA, base, chromium, requiredState, fidelityBudgets, environmentAuthority } = await fixture();
  const mutations = [
    (manifest) => { manifest.browser.sha256 = 'f'.repeat(64); },
    (manifest) => { manifest.os.imageId = 'different-image'; },
    (manifest) => { manifest.os.receiptSha256 = 'f'.repeat(64); },
    (manifest) => { manifest.fonts[0].sha256 = 'f'.repeat(64); },
    (manifest) => { delete manifest.fonts[0].provenanceId; },
    (manifest) => { delete manifest.fonts[0].licenseId; },
    (manifest) => { manifest.fonts[0].webFamily = 'forged'; },
    (manifest) => { manifest.color.figmaColorProfile = 'display-p3'; },
    (manifest) => { manifest.render.backgroundColor = 'rgb(255, 255, 255)'; },
    (manifest) => { manifest.render.stableTimeMs += 1; },
  ];
  for (const mutate of mutations) {
    const unapprovedManifest = structuredClone(capture.environmentManifest);
    mutate(unapprovedManifest);
    await assert.rejects(captureRuntimeState({
      chromium, chromePath: CHROME, bundle: bundleA, modeContextPlan: base.modeContextPlan, tokenPlan: base.tokenPlan, requiredState, fidelityBudgets,
      environmentManifest: unapprovedManifest, environmentAuthority, reference: { metadata: requiredState.reference, bytes: capture.referenceBytes }, metricRegions: { 'flat-color': null },
    }), /environment manifest lacks its approved authority/);
    const copy = forkInput(input);
    const evidence = { ...capture, environmentManifest: structuredClone(capture.environmentManifest), runtime: structuredClone(capture.runtime), fidelityBudgets: structuredClone(capture.fidelityBudgets) };
    mutate(evidence.environmentManifest);
    evidence.runtime.environmentManifestHash = sha256(canonicalJson(evidence.environmentManifest));
    evidence.fidelityBudgets.environmentManifestHash = evidence.runtime.environmentManifestHash;
    copy.fidelityBudgets = evidence.fidelityBudgets;
    copy.runtimeCaptures = [evidence];
    const report = await buildRuntimeProof(copy);
    assert.equal(report.gates.G10, 'FAILED', JSON.stringify(report.issues));
    assert.equal((await p6Failures({ ...copy, report })).G10, true);
  }
});

test('P6 shape parser refuses malformed required-state structure', async () => {
  const { input } = await fixture();
  const malformed = forkInput(input);
  malformed.compileRequest = structuredClone(input.compileRequest);
  malformed.compileRequest.requiredStates.push(structuredClone(malformed.compileRequest.requiredStates[0]));
  await assert.rejects(buildRuntimeProof(malformed), RuntimeProofError);
  const unsealedReference = forkInput(input);
  unsealedReference.compileRequest = structuredClone(input.compileRequest);
  unsealedReference.compileRequest.requiredStates[0].reference = { kind: 'figma-export', fileKey: 'F', version: 'v', rootId: 'root' };
  await assert.rejects(buildRuntimeProof(unsealedReference), /reference malformed/);
});

function resealTestPackage(output) {
  output.manifest.files = Object.fromEntries(Object.entries(output.files).filter(([name]) => name !== 'manifest.json').sort().map(([name, content]) => [name, { sha256: sha256(content), bytes: Buffer.byteLength(content) }]));
  output.files['manifest.json'] = `${canonicalJson(output.manifest)}\n`;
}
