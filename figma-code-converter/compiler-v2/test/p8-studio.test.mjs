import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildCandidateProposal, openSandboxProject, readSandboxProject, stageSandboxCandidate,
} from '../src/sandbox-store.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';
import {
  createUnavailableV2Studio, createV2StudioController, openV2StudioFromConfig,
} from '../../studio/v2-studio.mjs';
import { dispatchV2StudioRequest } from '../../studio/v2-http.mjs';

const HASH = (value) => sha256(canonicalJson(value));
const LEGACY = Object.freeze({ operating: true, route: '/converted/sandbox/shape', version: 'legacy-shape-v1' });
const publicPem = (key) => key.export({ type: 'spki', format: 'pem' });

function report(state = 'DIAGNOSTIC_ONLY') {
  const gateState = state === 'PROMOTABLE_VERIFIED' ? 'VERIFIED' : 'DIAGNOSTIC_ONLY';
  const body = {
    schemaVersion: 1,
    state,
    gates: Object.fromEntries(Array.from({ length: 14 }, (_, index) => [`G${index}`, gateState])),
    blockers: state === 'PROMOTABLE_VERIFIED' ? [] : ['integration-corpus'],
    corpusReportHash: HASH('corpus'),
    fidelityBudgetHash: HASH('budget'),
    environmentManifestHash: HASH('environment'),
  };
  return { ...body, reportHash: HASH(body) };
}

function input(transactionId, state = 'DIAGNOSTIC_ONLY') {
  return {
    transactionId,
    registry: { schemaVersion: 1, generation: 0, entries: {} },
    packageFiles: {
      'manifest.json': '{"schemaVersion":1}\n',
      'runtime/index.html': '<!doctype html><link rel="stylesheet" href="/bundle.css"><div id="root"></div><script src="/bundle.js"></script>',
      'runtime/bundle.css': 'body{margin:0}\n',
      'runtime/bundle.js': 'document.getElementById("root").textContent="v2";\n',
    },
    report: report(state),
  };
}

async function fixture(t) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-studio-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const keys = generateKeyPairSync('ed25519');
  const project = openSandboxProject({
    rootDir,
    projectId: 'studio-project',
    promotionAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(keys.publicKey) },
  });
  t.after(() => project.close());
  return { project, keys };
}

test('P8 Studio unconfigured state is explicit and invents no compiler terminal state', () => {
  const studio = createUnavailableV2Studio('promotion authority not configured');
  const snapshot = studio.snapshot(LEGACY);
  assert.equal(snapshot.configured, false);
  assert.equal(snapshot.productionLane, 'legacy');
  assert.deepEqual(snapshot.legacy, { ...LEGACY, lane: 'legacy', untouched: true });
  assert.equal(snapshot.compilerV2.terminalState, null);
  assert.deepEqual(snapshot.compilerV2.blockers, ['promotion authority not configured']);
  assert.deepEqual(snapshot.candidates, []);
  assert.throws(() => studio.commit('tx-any'), /not configured/);
  assert.throws(() => studio.cancel('tx-any'), /not configured/);
});

test('P8 Studio shows a diagnostic v2 candidate beside operating legacy and cannot promote it', async (t) => {
  const { project } = await fixture(t);
  const proposal = buildCandidateProposal(project, input('tx-diagnostic'));
  await stageSandboxCandidate(project, { proposal, promotionSignature: null });
  const studio = createV2StudioController(project);
  const snapshot = studio.snapshot(LEGACY);
  assert.equal(snapshot.configured, true);
  assert.equal(snapshot.productionLane, 'legacy');
  assert.equal(snapshot.legacy.route, LEGACY.route);
  assert.equal(snapshot.candidates.length, 1);
  assert.equal(snapshot.candidates[0].terminalState, 'DIAGNOSTIC_ONLY');
  assert.equal(snapshot.candidates[0].canPromote, false);
  assert.deepEqual(snapshot.candidates[0].blockers, ['integration-corpus']);
  assert.equal(snapshot.candidates[0].runtimeAvailable, true);
  assert.throws(() => studio.commit('tx-diagnostic', LEGACY), /not promotable/);
  assert.equal(readSandboxProject(project).generation, 0);
});

test('P8 Studio runtime reader exposes only the three sealed runtime artifacts', async (t) => {
  const { project } = await fixture(t);
  const proposal = buildCandidateProposal(project, input('tx-runtime'));
  await stageSandboxCandidate(project, { proposal, promotionSignature: null });
  const studio = createV2StudioController(project);
  assert.match(studio.runtime('tx-runtime', 'index.html').toString(), /bundle\.js/);
  assert.match(studio.runtime('tx-runtime', 'bundle.css').toString(), /margin/);
  assert.throws(() => studio.runtime('tx-runtime', '../candidate.json'), /runtime artifact|path/);
  assert.throws(() => studio.runtime('tx-runtime', 'manifest.json'), /runtime artifact/);
});

test('P8 Studio commits a signed verified candidate only to the v2 pointer and keeps legacy identity', async (t) => {
  const { project, keys } = await fixture(t);
  const candidate = input('tx-promotable', 'PROMOTABLE_VERIFIED');
  candidate.registry = { schemaVersion: 1, generation: 1, entries: {} };
  const proposal = buildCandidateProposal(project, candidate);
  const signature = sign(null, Buffer.from(canonicalJson(proposal.receiptPayload)), keys.privateKey).toString('base64');
  await stageSandboxCandidate(project, { proposal, promotionSignature: signature });
  const studio = createV2StudioController(project);
  const before = studio.snapshot(LEGACY);
  assert.equal(before.candidates[0].canPromote, true);
  const committed = studio.commit('tx-promotable', LEGACY);
  assert.equal(committed.project.generation, 1);
  assert.deepEqual(committed.legacy, before.legacy);
  assert.equal(committed.productionLane, 'legacy');
  assert.equal(committed.candidates[0].transactionState, 'PROMOTED');
});

test('P8 Studio HTTP reports unconfigured truth without a fabricated terminal state', () => {
  const studio = createUnavailableV2Studio('promotion authority not configured');
  const response = dispatchV2StudioRequest({
    method: 'GET', pathname: '/api/compiler-v2/status', studio, legacy: LEGACY,
  });
  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.configured, false);
  assert.equal(body.compilerV2.terminalState, null);
  assert.equal(body.productionLane, 'legacy');
});

test('P8 Studio HTTP serves only sealed runtime bytes and rewrites the exact local shell paths', async (t) => {
  const { project } = await fixture(t);
  const proposal = buildCandidateProposal(project, input('tx-http-runtime'));
  await stageSandboxCandidate(project, { proposal, promotionSignature: null });
  const studio = createV2StudioController(project);
  const html = dispatchV2StudioRequest({
    method: 'GET', pathname: '/api/compiler-v2/runtime/tx-http-runtime/index.html', studio, legacy: LEGACY,
  });
  assert.equal(html.status, 200);
  assert.equal(html.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(html.headers['content-security-policy'], /default-src 'none'/);
  assert.match(html.body.toString(), /\/api\/compiler-v2\/runtime\/tx-http-runtime\/bundle\.css/);
  assert.match(html.body.toString(), /\/api\/compiler-v2\/runtime\/tx-http-runtime\/bundle\.js/);
  assert.doesNotMatch(html.body.toString(), /href="\/bundle\.css"|src="\/bundle\.js"/);
  const forbidden = dispatchV2StudioRequest({
    method: 'GET', pathname: '/api/compiler-v2/runtime/tx-http-runtime/manifest.json', studio, legacy: LEGACY,
  });
  assert.equal(forbidden.status, 404);
});

test('P8 Studio HTTP refuses diagnostic commit and can cancel it without moving legacy or v2 pointers', async (t) => {
  const { project } = await fixture(t);
  const proposal = buildCandidateProposal(project, input('tx-http-diagnostic'));
  await stageSandboxCandidate(project, { proposal, promotionSignature: null });
  const studio = createV2StudioController(project);
  const refused = dispatchV2StudioRequest({
    method: 'POST', pathname: '/api/compiler-v2/commit/tx-http-diagnostic', studio, legacy: LEGACY,
  });
  assert.equal(refused.status, 422);
  assert.match(JSON.parse(refused.body).error, /not promotable/);
  assert.equal(readSandboxProject(project).generation, 0);
  const cancelled = dispatchV2StudioRequest({
    method: 'POST', pathname: '/api/compiler-v2/cancel/tx-http-diagnostic', studio, legacy: LEGACY,
  });
  assert.equal(cancelled.status, 200);
  assert.equal(JSON.parse(cancelled.body).candidates[0].transactionState, 'CANCELLED');
  assert.equal(readSandboxProject(project).generation, 0);
});

test('P8 Studio configuration admits only the public verification authority and no signer path', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-studio-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const keys = generateKeyPairSync('ed25519');
  await writeFile(path.join(root, 'public.pem'), publicPem(keys.publicKey));
  const config = {
    rootDir: 'store', projectId: 'configured-project', authorityId: 'qa-meta-v1', publicKeyFile: 'public.pem',
  };
  const studio = openV2StudioFromConfig(config, root);
  t.after(() => studio.close());
  assert.equal(studio.configured, true);
  assert.equal(studio.snapshot(LEGACY).project.generation, 0);
  assert.throws(() => openV2StudioFromConfig({ ...config, privateKeyFile: 'private.pem' }, root), /configuration fields/);
});
