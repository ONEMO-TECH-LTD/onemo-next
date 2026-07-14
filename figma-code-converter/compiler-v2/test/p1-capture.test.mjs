import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CaptureDependencyError,
  assertCaptureDiagnosticBundle,
  assertCaptureDiagnosticReport,
  runCaptureDiagnostic,
} from '../src/capture-transaction.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';
import { p1CaptureFailures } from './p1-capture-oracle.mjs';

const HASH = (value) => sha256(String(value));
const PLANES = Object.freeze({
  document: 'plugin-primary-complete', supplement: 'plugin-primary-complete',
  variables: 'plugin-primary-complete', components: 'plugin-primary-complete',
  fonts: 'plugin-primary-complete', assets: 'plugin-primary-complete',
  references: 'rest-cross-check', dependencies: 'plugin-primary-complete',
});

function passData(label = 'stable') {
  return {
    document: { id: 'root', type: 'FRAME', name: 'Root', children: [] },
    supplement: { schemaVersion: 1, nodes: [{ nodeId: 'root', nodeType: 'FRAME', resolvedVariableModes: {}, explicitVariableModes: {} }] },
    variables: { variables: [], variableCollections: [] },
    components: { components: [], componentSets: [] },
    fonts: { families: [] },
    dependencies: {
      locks: [{ provider: 'figma-file', fileKey: 'FILE', key: 'root', version: 'v1', fingerprint: HASH(`dependency-${label}`) }],
      boundary: { closed: true, rootIds: ['root'], nodeIds: ['root'], externalDependencies: [], backdropDependencies: [] },
    },
    assets: new Map(),
    sourcePlanes: { ...PLANES },
  };
}

function rootIdentity(overrides = {}) {
  return {
    fileKey: 'FILE', branchKey: 'main', fileVersion: 'v1', editorType: 'figma',
    currentPageId: 'page', rootIds: ['root'], colorProfile: 'sRGB',
    ...overrides,
  };
}

const request = (key, bytes = 10) => ({ provider: 'figma-plugin', fileKey: 'FILE', key, bytes });

function adapter(overrides = {}) {
  return {
    async readRoot({ phase }) {
      return { identity: rootIdentity(), requests: [request(phase, 2)] };
    },
    async capturePass({ pass, attempt }) {
      const value = passData(overrides.passLabel?.({ pass, attempt }) ?? 'stable');
      if (overrides.mutatePass) overrides.mutatePass(value, { pass, attempt });
      return { value, requests: [request(`pass-${pass}`, 20)] };
    },
    async captureReference({ declaration }) {
      const value = {
        state: declaration.state, file: declaration.file, fileKey: declaration.fileKey,
        nodeId: declaration.nodeId, fileVersion: declaration.fileVersion,
        request: structuredClone(declaration.request), bytes: Buffer.from('REFERENCE'),
      };
      if (overrides.mutateReference) overrides.mutateReference(value);
      return { value, requests: [{ provider: 'figma-rest', fileKey: declaration.fileKey, key: declaration.nodeId, bytes: value.bytes.length }] };
    },
    async readAudit() {
      const value = {
        adapterKind: 'dedicated-read-only-plugin', bundleHash: HASH('bundle'),
        staticAuditHash: HASH('static-audit'), forbiddenCalls: [], dynamicAccess: false,
        documentChangeEvents: [],
      };
      if (overrides.mutateAudit) overrides.mutateAudit(value);
      return value;
    },
    ...overrides.methods,
  };
}

function input(adapterValue = adapter(), overrides = {}) {
  const controller = new AbortController();
  return {
    controller,
    value: {
      trialId: 'p1-local', corpusClass: 'local-only', fileKey: 'FILE', rootIds: ['root'],
      referenceDeclarations: [{
        state: 'light', file: 'references/light-root.png', fileKey: 'FILE', nodeId: 'ref-light',
        fileVersion: 'v1', request: { endpoint: '/v1/images/FILE', ids: ['ref-light'], scale: 2, format: 'png' },
      }],
      adapter: adapterValue, signal: controller.signal,
      readPersistentStateHash: async () => HASH('persistent'),
      ...overrides,
    },
  };
}

test('P1 core executes the exact three-pass route and returns a stable non-persisted candidate', async () => {
  const { value } = input();
  const { report, candidate } = await runCaptureDiagnostic(value);
  assert.equal(report.state, 'DIAGNOSTIC_ONLY');
  assert.equal(report.persisted, false);
  assert.deepEqual(report.blockers, ['accepted-operator-envelope', 'plugin-capture-authority']);
  assert.deepEqual(report.identities.versions, { V0: 'v1', V1: 'v1', V2: 'v1' });
  assert.equal(new Set(Object.values(report.identities.fingerprints)).size, 1);
  assert.equal(new Set(Object.values(report.identities.dependencyLocks)).size, 1);
  assert.equal(candidate.references.length, 1);
  assert.equal(candidate.references[0].sha256, HASH('REFERENCE'));
  assert.equal(assertCaptureDiagnosticReport(report), true);
  assert.deepEqual(p1CaptureFailures(report), []);
});

test('P1 core retries one unstable transaction, then fails closed with no candidate', async () => {
  const changing = adapter({ passLabel: ({ pass, attempt }) => pass === 'B' ? `changed-${attempt}` : 'stable' });
  const { report, candidate } = await runCaptureDiagnostic(input(changing).value);
  assert.equal(report.state, 'FAILED_CAPTURE');
  assert.equal(report.attempts, 2);
  assert.equal(candidate, null);
  assert.match(report.issues.join('\n'), /fingerprint|dependency/);
});

test('P1 core refuses REST_ONLY or partial semantic source planes before candidate success', async () => {
  for (const [family, value] of [['supplement', 'rest-only'], ['components', 'plugin-primary-partial']]) {
    const bad = adapter({ mutatePass: (pass) => { pass.sourcePlanes[family] = value; } });
    const result = await runCaptureDiagnostic(input(bad).value);
    assert.equal(result.report.state, 'FAILED_CAPTURE', `${family}/${value}`);
    assert.equal(result.candidate, null);
    assert.match(result.report.issues.join('\n'), new RegExp(family));
  }
});

test('P1 core rejects reference version/request drift and any source mutation event', async () => {
  const wrongReference = adapter({ mutateReference: (ref) => { ref.fileVersion = 'v2'; } });
  const referenceResult = await runCaptureDiagnostic(input(wrongReference).value);
  assert.equal(referenceResult.report.state, 'FAILED_CAPTURE');
  assert.match(referenceResult.report.issues.join('\n'), /reference.*version/i);

  const mutating = adapter({ mutateAudit: (audit) => { audit.documentChangeEvents.push({ documentId: 'FILE', type: 'PROPERTY_CHANGE' }); } });
  const mutationResult = await runCaptureDiagnostic(input(mutating).value);
  assert.equal(mutationResult.report.state, 'FAILED_CAPTURE');
  assert.match(mutationResult.report.issues.join('\n'), /documentchange/i);
});

test('P1 core refuses an open boundary and a changed active file identity', async () => {
  const open = adapter({ mutatePass: (pass) => { pass.dependencies.boundary.closed = false; } });
  const openResult = await runCaptureDiagnostic(input(open).value);
  assert.equal(openResult.report.state, 'FAILED_CAPTURE');
  assert.match(openResult.report.issues.join('\n'), /boundary/i);

  let reads = 0;
  const changed = adapter({ methods: { async readRoot({ phase }) {
    reads++;
    return { identity: rootIdentity({ fileKey: phase === 'version-v2' ? 'OTHER' : 'FILE' }), requests: [request(phase, 2)] };
  } } });
  const changedResult = await runCaptureDiagnostic(input(changed).value);
  assert.equal(reads, 3);
  assert.equal(changedResult.report.state, 'FAILED_CAPTURE');
  assert.match(changedResult.report.issues.join('\n'), /active Figma file changed/i);
});

test('P1 core refuses missing root locks and unowned render-boundary dependencies', async () => {
  const noRootLock = adapter({ mutatePass: (pass) => { pass.dependencies.locks = []; } });
  const noRootResult = await runCaptureDiagnostic(input(noRootLock).value);
  assert.equal(noRootResult.report.state, 'FAILED_CAPTURE');
  assert.match(noRootResult.report.issues.join('\n'), /root dependency lock/);

  const unknownBackdrop = adapter({ mutatePass: (pass) => {
    pass.dependencies.boundary.backdropDependencies.push({ provider: 'figma-file', fileKey: 'REMOTE', key: 'backdrop', disposition: 'captured' });
  } });
  const backdropResult = await runCaptureDiagnostic(input(unknownBackdrop).value);
  assert.equal(backdropResult.report.state, 'FAILED_CAPTURE');
  assert.match(backdropResult.report.issues.join('\n'), /backdropDependencies.*matching lock/);
});

test('P1 core binds page/color-profile identity and reports typed dependency permission failures', async () => {
  const rootDrift = adapter({ methods: { async readRoot({ phase }) {
    return { identity: rootIdentity({ colorProfile: phase === 'version-v1' ? 'Display-P3' : 'sRGB' }), requests: [request(phase, 2)] };
  } } });
  const driftResult = await runCaptureDiagnostic(input(rootDrift).value);
  assert.equal(driftResult.report.state, 'FAILED_CAPTURE');
  assert.match(driftResult.report.issues.join('\n'), /dependency lock/);

  const nonJsonRoot = adapter({ methods: { async readRoot({ phase }) {
    const identity = rootIdentity(); identity.dynamic = () => phase;
    return { identity, requests: [request(phase, 2)] };
  } } });
  const nonJsonResult = await runCaptureDiagnostic(input(nonJsonRoot).value);
  assert.equal(nonJsonResult.report.state, 'FAILED_CAPTURE');
  assert.match(nonJsonResult.report.issues.join('\n'), /closed JSON contract/);

  const unavailable = adapter({ methods: { async capturePass() {
    throw new CaptureDependencyError({
      provider: 'figma-library', fileKey: 'REMOTE', key: 'component-set', fact: 'component definition',
      requiredPermission: 'library view', nextAction: 'grant library view access and retry',
    });
  } } });
  const unavailableResult = await runCaptureDiagnostic(input(unavailable).value);
  assert.equal(unavailableResult.report.state, 'FAILED_CAPTURE');
  assert.match(unavailableResult.report.issues.join('\n'), /figma-library.*REMOTE.*component-set.*library view/);

  const referenceUnavailable = adapter({ methods: { async captureReference() {
    throw new CaptureDependencyError({
      provider: 'figma-rest', fileKey: 'FILE', key: 'ref-light', fact: 'authored reference',
      requiredPermission: 'file read', nextAction: 'grant file read access and retry',
    });
  } } });
  const referenceUnavailableResult = await runCaptureDiagnostic(input(referenceUnavailable).value);
  assert.equal(referenceUnavailableResult.report.state, 'FAILED_CAPTURE');
  assert.match(referenceUnavailableResult.report.issues.join('\n'), /figma-rest.*ref-light.*file read/);
});

test('P1 core rejects escaping asset/reference paths and incomplete font provenance', async () => {
  const escapingAsset = adapter({ mutatePass: (pass) => { pass.assets.set('../escape.svg', Buffer.from('x')); } });
  const assetResult = await runCaptureDiagnostic(input(escapingAsset).value);
  assert.equal(assetResult.report.state, 'FAILED_CAPTURE');
  assert.match(assetResult.report.issues.join('\n'), /confined.*byte map/);

  await assert.rejects(() => runCaptureDiagnostic(input(adapter(), {
    referenceDeclarations: [{
      state: 'light', file: 'references/../escape.png', fileKey: 'FILE', nodeId: 'ref-light',
      fileVersion: 'v1', request: { endpoint: '/v1/images/FILE' },
    }],
  }).value), /reference declaration invalid/);

  const badFont = adapter({ mutatePass: (pass) => { pass.fonts.families.push({ figma: { family: 'Inter' }, web: null }); } });
  const fontResult = await runCaptureDiagnostic(input(badFont).value);
  assert.equal(fontResult.report.state, 'FAILED_CAPTURE');
  assert.match(fontResult.report.issues.join('\n'), /font provenance/);

  const validFont = adapter({ mutatePass: (pass) => {
    const bytes = Buffer.from('FONT-BYTES');
    pass.document.children.push({ id: 'text', type: 'TEXT', characters: 'A', children: [] });
    pass.supplement.nodes.push({ nodeId: 'text', nodeType: 'TEXT', resolvedVariableModes: {}, explicitVariableModes: {} });
    pass.dependencies.boundary.nodeIds.push('text');
    pass.assets.set('fonts/inter.woff2', bytes);
    pass.fonts.families.push({
      figma: { family: 'Inter', style: 'Regular', available: true, missing: false, ranges: [{ nodeId: 'text', start: 0, end: 1 }] },
      web: { source: 'package', path: 'fonts/inter.woff2', licenseId: 'ofl-1.1', format: 'woff2', weight: 400, style: 'normal', bytes: bytes.length, sha256: sha256(bytes) },
    });
  } });
  assert.equal((await runCaptureDiagnostic(input(validFont).value)).report.state, 'DIAGNOSTIC_ONLY');
});

test('P1 core cancellation and persistent-state drift discard every in-memory candidate', async () => {
  const cancelled = input();
  cancelled.value.adapter = adapter({ methods: { async capturePass(context) {
    if (context.pass === 'B') cancelled.controller.abort('operator cancelled');
    return { value: passData(), requests: [request(`pass-${context.pass}`, 20)] };
  } } });
  const cancelledResult = await runCaptureDiagnostic(cancelled.value);
  assert.equal(cancelledResult.report.state, 'CANCELLED');
  assert.equal(cancelledResult.candidate, null);

  let reads = 0;
  const persistent = input(adapter(), { readPersistentStateHash: async () => HASH(reads++ === 0 ? 'before' : 'after') });
  const persistentResult = await runCaptureDiagnostic(persistent.value);
  assert.equal(persistentResult.report.state, 'FAILED_CAPTURE');
  assert.equal(persistentResult.candidate, null);
  assert.match(persistentResult.report.issues.join('\n'), /persistent registry\/package state changed/);
});

test('P1 production and independent readers reject re-sealed identity, authority, and promotion lies', async () => {
  const bundle = await runCaptureDiagnostic(input().value);
  const { report } = bundle;
  for (const mutate of [
    (value) => { value.persisted = true; },
    (value) => { value.blockers = []; },
    (value) => { value.identities.fingerprints.F1 = HASH('forged'); },
    (value) => { value.readOnlyProof.bundleHash = HASH('forged-bundle'); },
  ]) {
    const forged = structuredClone(report);
    mutate(forged);
    delete forged.reportHash;
    forged.reportHash = sha256(canonicalJson(forged));
    assert.throws(() => assertCaptureDiagnosticReport(forged));
    assert.notDeepEqual(p1CaptureFailures(forged), []);
  }
  bundle.candidate.document.name = 'forged-after-capture';
  assert.throws(() => assertCaptureDiagnosticBundle(bundle), /fingerprint|candidate hash/);
});
