import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  mkdtemp, readFile, readdir, rename, rm, symlink, writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  buildCandidateProposal,
  buildDualRunView,
  cancelSandboxCandidate,
  commitSandboxCandidate,
  openSandboxProject,
  readCandidateStatus,
  readSandboxProject,
  recoverSandboxProject,
  stageSandboxCandidate,
} from '../src/sandbox-store.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const HASH = (value) => sha256(canonicalJson(value));
const run = promisify(execFile);
const WORKER = fileURLToPath(new URL('./p8-commit-worker.mjs', import.meta.url));
const OPEN_WORKER = fileURLToPath(new URL('./p8-open-worker.mjs', import.meta.url));
const STAGE_WORKER = fileURLToPath(new URL('./p8-stage-worker.mjs', import.meta.url));
const keyPair = () => generateKeyPairSync('ed25519');
const publicPem = (key) => key.export({ type: 'spki', format: 'pem' });

function report(state = 'PROMOTABLE_VERIFIED') {
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

function registry(generation = 1, value = 'one') {
  return { schemaVersion: 1, generation, entries: { color: { variableKey: 'color', figmaType: 'COLOR', stableBase: 'color', channels: { color: { channelId: 'c1', target: 'css', cssName: '--color' } }, value } } };
}

function candidateInput(transactionId, state = 'PROMOTABLE_VERIFIED', generation = 1) {
  return {
    transactionId,
    registry: registry(generation),
    packageFiles: {
      'manifest.json': JSON.stringify({ schemaVersion: 1, transactionId }),
      'screens/Screen.tsx': `export const Screen = ${JSON.stringify(transactionId)};\n`,
      'styles/Screen.module.css': '.root{color:var(--color)}\n',
    },
    report: report(state),
  };
}

function signature(payload, privateKey) {
  return sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString('base64');
}

async function fixture(t) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-p8-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const keys = keyPair();
  const project = openSandboxProject({
    rootDir,
    projectId: 'project-one',
    promotionAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(keys.publicKey) },
  });
  t.after(() => project.close());
  return { rootDir, project, keys };
}

async function signedStage(project, keys, input) {
  const proposal = buildCandidateProposal(project, input);
  return stageSandboxCandidate(project, { proposal, promotionSignature: signature(proposal.receiptPayload, keys.privateKey) });
}

test('P8 keeps legacy operating beside an authority-checked v2 candidate without overwriting either lane', async (t) => {
  const { project, keys } = await fixture(t);
  const staged = await signedStage(project, keys, candidateInput('tx-one'));
  const before = readSandboxProject(project);
  assert.equal(before.generation, 0);
  assert.equal(before.registryGeneration, 0);
  assert.equal(before.generationName, null);
  const status = readCandidateStatus(project, staged.transactionId);
  assert.equal(status.state, 'STAGED');
  assert.equal(status.reportState, 'PROMOTABLE_VERIFIED');
  assert.equal(status.promotionReceiptVerified, true);
  assert.equal(status.canPromote, true);
  const view = buildDualRunView(project, { operating: true, route: '/converted/shape', version: 'legacy-live' }, staged.transactionId);
  assert.deepEqual(view.legacy, { lane: 'legacy', operating: true, route: '/converted/shape', version: 'legacy-live', untouched: true });
  assert.equal(view.v2.terminalState, 'PROMOTABLE_VERIFIED');
  assert.equal(view.v2.canPromote, true);
  assert.equal(view.productionLane, 'legacy');
});

test('P8 atomic commit moves registry and package through one sandbox pointer and survives restart', async (t) => {
  const { rootDir, project, keys } = await fixture(t);
  const staged = await signedStage(project, keys, candidateInput('tx-commit'));
  const committed = commitSandboxCandidate(project, staged.transactionId);
  assert.equal(committed.generation, 1);
  assert.equal(committed.registryGeneration, 1);
  assert.equal(committed.registryHash, staged.candidateRegistryHash);
  assert.equal(committed.packageHash, staged.packageHash);
  project.close();
  const reopened = openSandboxProject({ rootDir, projectId: 'project-one', promotionAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(keys.publicKey) } });
  t.after(() => reopened.close());
  assert.deepEqual(recoverSandboxProject(reopened).project, committed);
  assert.equal(readCandidateStatus(reopened, staged.transactionId).state, 'PROMOTED');
});

test('P8 refuses diagnostic/failed/cancelled candidates and preserves the project pointer', async (t) => {
  const { project } = await fixture(t);
  const diagnostic = buildCandidateProposal(project, candidateInput('tx-diagnostic', 'DIAGNOSTIC_ONLY'));
  await stageSandboxCandidate(project, { proposal: diagnostic, promotionSignature: null });
  assert.equal(readCandidateStatus(project, 'tx-diagnostic').canPromote, false);
  assert.throws(() => commitSandboxCandidate(project, 'tx-diagnostic'), /not promotable/);
  const before = readSandboxProject(project);
  cancelSandboxCandidate(project, 'tx-diagnostic');
  assert.equal(readCandidateStatus(project, 'tx-diagnostic').state, 'CANCELLED');
  assert.deepEqual(readSandboxProject(project), before);
  assert.throws(() => commitSandboxCandidate(project, 'tx-diagnostic'), /CANCELLED/);
});

test('P8 signed receipt binds project/base/registry/package/report/corpus/budget/environment exactly', async (t) => {
  const { project, keys } = await fixture(t);
  const proposal = buildCandidateProposal(project, candidateInput('tx-receipt'));
  const good = signature(proposal.receiptPayload, keys.privateKey);
  const mutations = [
    (row) => { row.receiptPayload.projectId = 'other'; },
    (row) => { row.receiptPayload.baseRegistryGeneration = 99; },
    (row) => { row.receiptPayload.baseRegistryHash = HASH('other'); },
    (row) => { row.receiptPayload.candidateRegistryHash = HASH('other'); },
    (row) => { row.receiptPayload.packageHash = HASH('other'); },
    (row) => { row.receiptPayload.reportHash = HASH('other'); },
    (row) => { row.receiptPayload.corpusReportHash = HASH('other'); },
    (row) => { row.receiptPayload.fidelityBudgetHash = HASH('other'); },
    (row) => { row.receiptPayload.environmentManifestHash = HASH('other'); },
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(proposal); mutate(forged);
    await assert.rejects(() => stageSandboxCandidate(project, { proposal: forged, promotionSignature: good }), /proposal|signature|receipt/);
  }
  const wrongKeys = keyPair();
  await assert.rejects(() => stageSandboxCandidate(project, { proposal, promotionSignature: signature(proposal.receiptPayload, wrongKeys.privateKey) }), /signature/);
});

test('P8 package/registry bytes are re-read at commit; tamper cannot move the pointer', async (t) => {
  const { project, keys } = await fixture(t);
  const staged = await signedStage(project, keys, candidateInput('tx-tamper'));
  await writeFile(path.join(staged.generationDir, 'package/screens/Screen.tsx'), 'forged\n');
  const before = readSandboxProject(project);
  assert.throws(() => commitSandboxCandidate(project, staged.transactionId), /hash|inventory|bytes/);
  assert.deepEqual(readSandboxProject(project), before);
  assert.throws(() => readCandidateStatus(project, staged.transactionId), /hash|inventory|bytes/);
});

test('P8 persisted candidate record is an exact derivation, not mutable descriptive metadata', async (t) => {
  const { project, keys } = await fixture(t);
  const staged = await signedStage(project, keys, candidateInput('tx-record'));
  const candidateFile = path.join(staged.generationDir, 'candidate.json');
  const candidate = JSON.parse(await readFile(candidateFile, 'utf8'));
  candidate.baseGeneration = 99;
  await writeFile(candidateFile, canonicalJson(candidate));
  assert.throws(() => readCandidateStatus(project, staged.transactionId), /record|generation|proposal/);
  assert.equal(readSandboxProject(project).generation, 0);
});

test('P8 generation/hash race is first-winner; stale second candidate never last-write-wins', async (t) => {
  const { project, keys } = await fixture(t);
  const firstProposal = buildCandidateProposal(project, candidateInput('tx-race-a'));
  const secondInput = candidateInput('tx-race-b');
  secondInput.registry.entries.color.value = 'two';
  const secondProposal = buildCandidateProposal(project, secondInput);
  const first = await stageSandboxCandidate(project, { proposal: firstProposal, promotionSignature: signature(firstProposal.receiptPayload, keys.privateKey) });
  const second = await stageSandboxCandidate(project, { proposal: secondProposal, promotionSignature: signature(secondProposal.receiptPayload, keys.privateKey) });
  const winner = commitSandboxCandidate(project, first.transactionId);
  assert.throws(() => commitSandboxCandidate(project, second.transactionId), /base generation\/hash conflict/);
  assert.deepEqual(readSandboxProject(project), winner);
});

test('P8 real cross-process race serializes at SQLite commit and produces exactly one winner', async (t) => {
  const { rootDir, project, keys } = await fixture(t);
  const firstProposal = buildCandidateProposal(project, candidateInput('tx-process-a'));
  const secondInput = candidateInput('tx-process-b');
  secondInput.registry.entries.color.value = 'two';
  const secondProposal = buildCandidateProposal(project, secondInput);
  await stageSandboxCandidate(project, { proposal: firstProposal, promotionSignature: signature(firstProposal.receiptPayload, keys.privateKey) });
  await stageSandboxCandidate(project, { proposal: secondProposal, promotionSignature: signature(secondProposal.receiptPayload, keys.privateKey) });
  const publicKeyPath = path.join(rootDir, 'promotion-public.pem');
  await writeFile(publicKeyPath, publicPem(keys.publicKey));
  const invoke = (transactionId) => run(process.execPath, [WORKER, rootDir, 'project-one', 'qa-meta-v1', publicKeyPath, transactionId], { maxBuffer: 1_000_000 });
  const results = (await Promise.all([invoke('tx-process-a'), invoke('tx-process-b')])).map(({ stdout }) => JSON.parse(stdout));
  assert.equal(results.filter((row) => row.ok).length, 1, JSON.stringify(results));
  assert.equal(results.filter((row) => !row.ok && /base generation\/hash conflict/.test(row.error)).length, 1, JSON.stringify(results));
  const state = readSandboxProject(project);
  assert.equal(state.generation, 1);
  assert.equal(state.packageHash, results.find((row) => row.ok).state.packageHash);
});

test('P8 real cross-process duplicate staging has one owner and cannot delete the winner generation', async (t) => {
  const { rootDir, project, keys } = await fixture(t);
  const publicKeyPath = path.join(rootDir, 'stage-public.pem');
  await writeFile(publicKeyPath, publicPem(keys.publicKey));
  const invoke = () => run(process.execPath, [STAGE_WORKER, rootDir, 'project-one', 'qa-meta-v1', publicKeyPath, 'tx-stage-race'], { maxBuffer: 1_000_000 });
  const results = (await Promise.all(Array.from({ length: 8 }, invoke))).map(({ stdout }) => JSON.parse(stdout));
  assert.equal(results.filter((row) => row.ok).length, 1, JSON.stringify(results));
  assert.equal(results.filter((row) => !row.ok).length, 7, JSON.stringify(results));
  assert.equal(readCandidateStatus(project, 'tx-stage-race').state, 'STAGED');
});

test('P8 concurrent first open converges on one immutable project authority and initial pointer', async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-p8-open-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const keys = keyPair();
  const publicKeyPath = path.join(rootDir, 'open-public.pem');
  await writeFile(publicKeyPath, publicPem(keys.publicKey));
  const invoke = () => run(process.execPath, [OPEN_WORKER, rootDir, 'project-open', 'qa-meta-v1', publicKeyPath], { maxBuffer: 1_000_000 });
  const results = (await Promise.all(Array.from({ length: 8 }, invoke))).map(({ stdout }) => JSON.parse(stdout));
  assert.equal(results.filter((row) => row.ok).length, 8, JSON.stringify(results));
  assert.equal(new Set(results.map((row) => canonicalJson(row.state))).size, 1);
});

test('P8 injected crash after pointer update rolls back, leaves staged evidence, and restart is coherent', async (t) => {
  const { rootDir, project, keys } = await fixture(t);
  const staged = await signedStage(project, keys, candidateInput('tx-crash'));
  const before = readSandboxProject(project);
  assert.throws(() => commitSandboxCandidate(project, staged.transactionId, { inject: 'after-pointer-update' }), /injected crash/);
  assert.deepEqual(readSandboxProject(project), before);
  assert.equal(readCandidateStatus(project, staged.transactionId).state, 'STAGED');
  project.close();
  const reopened = openSandboxProject({ rootDir, projectId: 'project-one', promotionAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(keys.publicKey) } });
  t.after(() => reopened.close());
  assert.deepEqual(recoverSandboxProject(reopened).project, before);
  assert.equal(readCandidateStatus(reopened, staged.transactionId).state, 'STAGED');
});

test('P8 authority identity is immutable and paths stay inside the v2 sandbox namespace', async (t) => {
  const { rootDir, project } = await fixture(t);
  const other = keyPair();
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(() => openSandboxProject({ rootDir, projectId: 'project-one', promotionAuthority: { authorityId: 'other', publicKeyPem: publicPem(other.publicKey) } }), /authority mismatch/);
  assert.throws(() => openSandboxProject({ rootDir, projectId: 'project-rsa', promotionAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(rsa.publicKey) } }), /Ed25519/);
  assert.throws(() => openSandboxProject({ rootDir, projectId: '../escape', promotionAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(other.publicKey) } }), /project id/);
  assert.equal((await readFile(path.join(project.projectDir, 'project.json'), 'utf8')).includes('compiler-v2-sandbox-v1'), true);
});

test('P8 refuses symlinked store topology before staging can mutate an outside directory', async (t) => {
  const { project } = await fixture(t);
  const proposal = buildCandidateProposal(project, candidateInput('tx-topology'));
  const before = readSandboxProject(project);
  const outside = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-p8-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, 'sentinel'), 'unchanged');

  for (const dir of [project.generationsDir, project.stagingDir]) {
    const backup = `${dir}-real`;
    await rename(dir, backup);
    await symlink(outside, dir, 'dir');
    try {
      await assert.rejects(() => stageSandboxCandidate(project, { proposal, promotionSignature: null }), /topology|symlink/);
      assert.deepEqual(await readdir(outside), ['sentinel']);
    } finally {
      await rm(dir);
      await rename(backup, dir);
    }
  }
  assert.deepEqual(readSandboxProject(project), before);
});

test('P8 refuses symlinked generation control files and package roots even when targets stay confined', async (t) => {
  const { project, keys } = await fixture(t);
  const staged = await signedStage(project, keys, candidateInput('tx-control-link'));
  const candidateFile = path.join(staged.generationDir, 'candidate.json');
  const candidateReal = path.join(staged.generationDir, 'candidate.real.json');
  await rename(candidateFile, candidateReal);
  await symlink('candidate.real.json', candidateFile);
  assert.throws(() => readCandidateStatus(project, staged.transactionId), /symlink/);
  await rm(candidateFile);
  await rename(candidateReal, candidateFile);

  const packageDir = path.join(staged.generationDir, 'package');
  const packageReal = path.join(staged.generationDir, 'package-real');
  await rename(packageDir, packageReal);
  await symlink('package-real', packageDir, 'dir');
  assert.throws(() => commitSandboxCandidate(project, staged.transactionId), /symlink/);
  assert.equal(readSandboxProject(project).generation, 0);
});

test('P8 report grammar refuses invented gate states and malformed blockers before staging', async (t) => {
  const { project } = await fixture(t);
  for (const [id, mutate] of [
    ['gate', (value) => { value.gates.G7 = 'TRUST_ME'; }],
    ['blocker-type', (value) => { value.blockers = [{ id: 'not-a-string' }]; }],
    ['blocker-duplicate', (value) => { value.blockers = ['same', 'same']; }],
  ]) {
    const input = candidateInput(`tx-report-${id}`);
    const body = structuredClone(input.report);
    delete body.reportHash;
    mutate(body);
    input.report = { ...body, reportHash: HASH(body) };
    assert.throws(() => buildCandidateProposal(project, input), /report|gate|blocker/);
  }
});

test('P8 package-only promotion preserves the independently versioned registry generation and hash', async (t) => {
  const { project, keys } = await fixture(t);
  const first = await signedStage(project, keys, candidateInput('tx-registry-first'));
  const firstState = commitSandboxCandidate(project, first.transactionId);
  const secondInput = candidateInput('tx-package-only', 'PROMOTABLE_VERIFIED', firstState.registryGeneration);
  secondInput.registry = registry(firstState.registryGeneration);
  secondInput.packageFiles['screens/Screen.tsx'] = 'export const Screen = "package-only";\n';
  const second = await signedStage(project, keys, secondInput);
  const secondState = commitSandboxCandidate(project, second.transactionId);
  assert.equal(secondState.generation, firstState.generation + 1);
  assert.equal(secondState.registryGeneration, firstState.registryGeneration);
  assert.equal(secondState.registryHash, firstState.registryHash);
  assert.notEqual(secondState.packageHash, firstState.packageHash);
});
