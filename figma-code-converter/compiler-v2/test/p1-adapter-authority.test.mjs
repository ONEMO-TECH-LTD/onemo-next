import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  adapterReceiptPayload,
  assertAdapterAuthorityProof,
  auditCaptureAdapterBundle,
  composeCaptureAudit,
  verifyCaptureAdapterAuthority,
} from '../src/capture-adapter-authority.mjs';
import { canonicalJson } from '../src/evidence.mjs';
import { p1AdapterAuthorityFailures, p1CaptureRuntimeFailures } from './p1-adapter-oracle.mjs';

const SAFE = Buffer.from(`
export function createCaptureAdapter(figma) {
  return Object.freeze({
    readRoot() { return { fileKey: figma.fileKey, pageId: figma.currentPage.id }; },
    async exportNode(node) { return node.exportAsync({ format: "JSON_REST_V1" }); },
    modes(node) { return node.resolvedVariableModes; },
  });
}
`);

function authorityFixture() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const authority = {
    authorityId: 'adapter-review-1',
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
  const audit = auditCaptureAdapterBundle({ bundleBytes: SAFE, entryFile: 'capture-adapter.mjs' });
  const body = {
    schemaVersion: 1,
    kind: 'capture-adapter-authority',
    authorityId: authority.authorityId,
    scope: 'diagnostic',
    bundleHash: audit.bundleHash,
    staticAuditHash: audit.staticAuditHash,
    issuedAt: '2026-07-14T10:00:00.000Z',
    expiresAt: '2026-07-15T10:00:00.000Z',
  };
  const receipt = { ...body, signature: sign(null, adapterReceiptPayload(body), privateKey).toString('base64') };
  return { authority, audit, receipt, now: '2026-07-14T12:00:00.000Z' };
}

test('P1 adapter audit inventories exact safe bundle calls and Ed25519 authority binds its bytes', () => {
  const fixture = authorityFixture();
  assert.deepEqual(fixture.audit.calls, ['Object.freeze', 'node.exportAsync']);
  assert.ok(fixture.audit.properties.includes('figma.currentPage'));
  assert.equal(fixture.audit.forbiddenCalls.length, 0);
  assert.equal(fixture.audit.dynamicAccess, false);
  const proof = verifyCaptureAdapterAuthority({ bundleBytes: SAFE, ...fixture });
  assert.equal(proof.authorityScope, 'diagnostic');
  assert.equal(assertAdapterAuthorityProof(proof, { bundleBytes: SAFE, ...fixture }), true);
  assert.deepEqual(p1AdapterAuthorityFailures({ proof, bundleBytes: SAFE, ...fixture }), []);
  const runtime = composeCaptureAudit({
    authorityProof: proof,
    bundleBytes: SAFE,
    ...fixture,
    transactionId: 'capture-1',
    observerStartedAt: '2026-07-14T12:00:01.000Z',
    observerStoppedAt: '2026-07-14T12:00:02.000Z',
    documentChangeEvents: [],
  });
  assert.equal(runtime.adapterKind, 'dedicated-read-only-plugin');
  assert.equal(runtime.authorityVerifiedAt, proof.verifiedAt);
  assert.deepEqual(runtime.documentChangeEvents, []);
  assert.deepEqual(p1CaptureRuntimeFailures({ runtime, proof, receipt: fixture.receipt }), []);
  const forgedRuntime = structuredClone(runtime); forgedRuntime.authorityVerifiedAt = '2026-07-14T12:00:02.000Z';
  assert.notDeepEqual(p1CaptureRuntimeFailures({ runtime: forgedRuntime, proof, receipt: fixture.receipt }), []);
});

test('P1 adapter audit rejects mutation, import, dynamic access, property writes, and runtime escapes', () => {
  assert.doesNotThrow(() => auditCaptureAdapterBundle({
    bundleBytes: Buffer.from('export function createCaptureAdapter(figma){ return Object.freeze({ absent(){ return !figma.fileKey; } }); }'),
    entryFile: 'read-only-negation.mjs',
  }));
  const attacks = [
    'export function createCaptureAdapter(figma){ return figma.createRectangle(); }',
    'export function createCaptureAdapter(figma){ const n=figma.currentPage; n.remove(); }',
    'export function createCaptureAdapter(figma){ return figma["currentPage"]; }',
    'export function createCaptureAdapter(figma){ figma.currentPage.opacity=0; return {}; }',
    'export async function createCaptureAdapter(figma){ return import("x"); }',
    'export function createCaptureAdapter(figma){ return require("x"); }',
    'export function createCaptureAdapter(figma){ return eval("figma"); }',
    'export function createCaptureAdapter(figma){ return Function("return figma")(); }',
    'export function createCaptureAdapter(figma){ return fetch("https://x"); }',
    'export function createCaptureAdapter(figma){ return new WebSocket("wss://x"); }',
    'export function createCaptureAdapter(figma){ return Object.assign({},figma.currentPage); }',
    'export function createCaptureAdapter(figma){ return Reflect.set(figma.currentPage,"opacity",0); }',
    'export function createCaptureAdapter(figma){ return figma.currentPage.clone(); }',
    'export function createCaptureAdapter(figma){ figma.currentPage.setRangeFills(0,1,[]); return {}; }',
    'export function createCaptureAdapter(figma){ figma.currentPage.moveDown(); return {}; }',
    'export function createCaptureAdapter(figma){ figma.currentPage.resetOverrides(); return {}; }',
    'export function createCaptureAdapter(figma){ figma.currentPage.addDevResourceAsync("https://x"); return {}; }',
    'export function createCaptureAdapter(figma){ figma.saveVersionHistoryAsync("x"); return {}; }',
    'export function createCaptureAdapter(figma){ const invoke=(fn)=>fn(); return invoke; }',
    'figma.currentPage; export function createCaptureAdapter(figma){ return {}; }',
    'export function createCaptureAdapter(figma){ return globalThis.navigator; }',
    'export function createCaptureAdapter(figma){ return document.body; }',
    'export function createCaptureAdapter(figma){ ({opacity:figma.currentPage.opacity}={opacity:0}); return {}; }',
    'export function createCaptureAdapter(figma){ figma.currentPage.opacity++; return {}; }',
    'export function createCaptureAdapter(figma){ delete figma.currentPage.name; return {}; }',
  ];
  for (const source of attacks) assert.throws(() => auditCaptureAdapterBundle({ bundleBytes: Buffer.from(source), entryFile: 'attack.mjs' }));
  assert.throws(() => auditCaptureAdapterBundle({ bundleBytes: Buffer.from('export function {'), entryFile: 'syntax.mjs' }), /syntax/);
  assert.throws(() => auditCaptureAdapterBundle({ bundleBytes: Buffer.from([0xc3, 0x28]), entryFile: 'utf8.mjs' }), /UTF-8/);
});

test('P1 adapter authority rejects RSA, substituted keys, receipt drift, expiry, and bundle/audit substitution', () => {
  const fixture = authorityFixture();
  const { publicKey: rsa } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(() => verifyCaptureAdapterAuthority({
    bundleBytes: SAFE, ...fixture,
    authority: { authorityId: 'adapter-review-1', publicKeyPem: rsa.export({ type: 'spki', format: 'pem' }).toString() },
  }), /Ed25519/);

  const other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();
  assert.throws(() => verifyCaptureAdapterAuthority({ bundleBytes: SAFE, ...fixture, authority: { ...fixture.authority, publicKeyPem: other } }), /signature/);
  assert.throws(() => verifyCaptureAdapterAuthority({ bundleBytes: SAFE, ...fixture, now: '2026-07-16T00:00:00.000Z' }), /expired/);
  assert.throws(() => verifyCaptureAdapterAuthority({ bundleBytes: SAFE, ...fixture, now: 'not-a-date' }), /verification time invalid/);
  assert.throws(() => verifyCaptureAdapterAuthority({ bundleBytes: Buffer.concat([SAFE, Buffer.from('\n// drift')]), ...fixture }), /bundle|audit/);
  const audit = structuredClone(fixture.audit); audit.calls.push('figma.createRectangle');
  assert.throws(() => verifyCaptureAdapterAuthority({ bundleBytes: SAFE, ...fixture, audit }), /audit/);
  const receipt = { ...fixture.receipt, scope: 'integration' };
  assert.throws(() => verifyCaptureAdapterAuthority({ bundleBytes: SAFE, ...fixture, receipt }), /signature/);
});

test('P1 adapter production and independent readers reject re-sealed proof/runtime lies', () => {
  const fixture = authorityFixture();
  const proof = verifyCaptureAdapterAuthority({ bundleBytes: SAFE, ...fixture });
  for (const mutate of [
    (value) => { value.bundleHash = '0'.repeat(64); },
    (value) => { value.authorityScope = 'integration'; },
    (value) => { value.adapterKind = 'plugin'; },
    (value) => { value.forbiddenCalls = ['figma.createRectangle']; },
    (value) => { value.dynamicAccess = true; },
  ]) {
    const forged = structuredClone(proof); mutate(forged);
    assert.throws(() => assertAdapterAuthorityProof(forged, fixture));
    assert.notDeepEqual(p1AdapterAuthorityFailures({ proof: forged, bundleBytes: SAFE, ...fixture }), []);
  }
  assert.notDeepEqual(p1AdapterAuthorityFailures({ proof, bundleBytes: SAFE, ...fixture, now: 'not-a-date' }), []);
  assert.throws(() => composeCaptureAudit({
    authorityProof: proof, bundleBytes: SAFE, ...fixture, transactionId: 'capture-1',
    observerStartedAt: '2026-07-14T12:00:01.000Z', observerStoppedAt: '2026-07-14T12:00:00.000Z',
    documentChangeEvents: [],
  }), /observer/);
  assert.throws(() => composeCaptureAudit({
    authorityProof: proof, bundleBytes: SAFE, ...fixture, transactionId: 'capture-1',
    observerStartedAt: '2026-07-14T12:00:00.000Z', observerStoppedAt: '2026-07-14T12:00:01.000Z',
    documentChangeEvents: [{ type: 'PROPERTY_CHANGE' }],
  }), /documentchange/);
  assert.doesNotThrow(() => composeCaptureAudit({
    authorityProof: proof, bundleBytes: SAFE, ...fixture, transactionId: 'capture-1',
    observerStartedAt: '2026-07-14T12:00:01.000Z', observerStoppedAt: '2026-07-14T12:00:02.000Z',
    documentChangeEvents: [],
  }));
  assert.throws(() => composeCaptureAudit({
    authorityProof: proof, bundleBytes: SAFE, ...fixture, transactionId: 'capture-1',
    observerStartedAt: '2026-07-14T11:59:59.000Z', observerStoppedAt: '2026-07-14T12:00:02.000Z',
    documentChangeEvents: [],
  }), /precede|authority/);
  assert.throws(() => composeCaptureAudit({
    authorityProof: proof, bundleBytes: SAFE, ...fixture, transactionId: 'capture-1',
    observerStartedAt: '2026-07-14T12:00:01.000Z', observerStoppedAt: '2026-07-15T10:00:01.000Z',
    documentChangeEvents: [],
  }), /expired/);
  assert.equal(canonicalJson(fixture.audit), canonicalJson(auditCaptureAdapterBundle({ bundleBytes: SAFE, entryFile: 'capture-adapter.mjs' })));
});
