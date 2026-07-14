import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  buildCandidateProposal,
  commitSandboxCandidate,
  openSandboxProject,
  stageSandboxCandidate,
} from '../src/sandbox-store.mjs';
import {
  activateProductionCutover,
  buildProductionCutoverProposal,
  openProductionProject,
  readCutoverStatus,
  readProductionProject,
  recoverProductionProject,
  rollbackProductionCutover,
  stageProductionCutover,
} from '../src/production-cutover.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';
import { p9Failures } from './p9-oracle.mjs';

const HASH = (value) => sha256(canonicalJson(value));
const run = promisify(execFile);
const ACTIVATE_WORKER = fileURLToPath(new URL('./p9-activate-worker.mjs', import.meta.url));
const STAGE_WORKER = fileURLToPath(new URL('./p9-stage-worker.mjs', import.meta.url));
const keys = () => generateKeyPairSync('ed25519');
const publicPem = (key) => key.export({ type: 'spki', format: 'pem' });
const signature = (payload, privateKey) => sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString('base64');

function report(state = 'PROMOTABLE_VERIFIED') {
  const gateState = state === 'PROMOTABLE_VERIFIED' ? 'VERIFIED' : 'DIAGNOSTIC_ONLY';
  const body = {
    schemaVersion: 1,
    state,
    gates: Object.fromEntries(Array.from({ length: 14 }, (_, index) => [`G${index}`, gateState])),
    blockers: state === 'PROMOTABLE_VERIFIED' ? [] : ['integration-corpus'],
    corpusReportHash: HASH('required-onemo-corpus-v1'),
    fidelityBudgetHash: HASH('approved-fidelity-budgets-v1'),
    environmentManifestHash: HASH('approved-render-environment-v1'),
  };
  return { ...body, reportHash: HASH(body) };
}

function registry(generation = 1, value = 'one') {
  return {
    schemaVersion: 1,
    generation,
    entries: {
      color: {
        variableKey: 'color', figmaType: 'COLOR', stableBase: 'color',
        channels: { color: { channelId: 'c1', target: 'css', cssName: '--color' } }, value,
      },
    },
  };
}

function candidateInput(transactionId, value = 'one') {
  return {
    transactionId,
    registry: registry(1, value),
    packageFiles: {
      'manifest.json': JSON.stringify({ schemaVersion: 1, transactionId }),
      'screens/Screen.tsx': `export const Screen = ${JSON.stringify(value)};\n`,
      'styles/Screen.module.css': '.root{color:var(--color)}\n',
    },
    report: report(),
  };
}

async function fixture(t, suffix = '') {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), `compiler-v2-p9-${suffix}`));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const promotion = keys();
  const review = keys();
  const dan = keys();
  const sandbox = openSandboxProject({
    rootDir,
    projectId: 'project-one',
    promotionAuthority: { authorityId: 'promotion-v1', publicKeyPem: publicPem(promotion.publicKey) },
  });
  const production = openProductionProject({
    rootDir,
    projectId: 'project-one',
    reviewAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(review.publicKey) },
    danAuthority: { authorityId: 'dan-cutover-v1', publicKeyPem: publicPem(dan.publicKey) },
    initialLegacy: {
      route: '/converted/shape', version: 'legacy-live', artifactHash: HASH('legacy-package'),
    },
  });
  t.after(() => { production.close(); sandbox.close(); });
  return { rootDir, sandbox, production, promotion, review, dan };
}

async function promoteSandbox(sandbox, promotion, transactionId = 'tx-release', value = 'one') {
  const proposal = buildCandidateProposal(sandbox, candidateInput(transactionId, value));
  const staged = await stageSandboxCandidate(sandbox, {
    proposal,
    promotionSignature: signature(proposal.receiptPayload, promotion.privateKey),
  });
  commitSandboxCandidate(sandbox, transactionId);
  return staged;
}

function authorize(proposal, review, dan) {
  return {
    proposal,
    reviewSignature: signature(proposal.authorizationPayload, review.privateKey),
    danSignature: signature(proposal.authorizationPayload, dan.privateKey),
  };
}

async function stageAuthorized(production, sandbox, review, dan) {
  const proposal = buildProductionCutoverProposal(production, sandbox);
  return stageProductionCutover(production, sandbox, authorize(proposal, review, dan));
}

test('P9 proposal requires the exact current PROMOTED sandbox generation and leaves legacy operating', async (t) => {
  const { production, sandbox, promotion } = await fixture(t, 'source-');
  const initial = readProductionProject(production);
  assert.equal(initial.activeLane, 'legacy');
  assert.throws(() => buildProductionCutoverProposal(production, sandbox), /promoted sandbox generation|required/i);

  await promoteSandbox(sandbox, promotion);
  const proposal = buildProductionCutoverProposal(production, sandbox);
  assert.equal(proposal.authorizationPayload.baseProductionGenerationName, initial.activeGenerationName);
  assert.equal(proposal.authorizationPayload.corpusReportHash, report().corpusReportHash);
  assert.equal(proposal.authorizationPayload.rollbackExercise.exactPriorIdentityRestored, true);
  assert.deepEqual(readProductionProject(production), initial);

  await promoteSandbox(sandbox, promotion, 'a'.repeat(80), 'one');
  const longIdProposal = buildProductionCutoverProposal(production, sandbox);
  assert.equal(longIdProposal.cutoverId.length <= 80, true);
  assert.equal(longIdProposal.candidateGenerationName.length <= 80, true);
});

test('P9 production authorities are distinct Ed25519 verification keys and no signer enters the store', async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'compiler-v2-p9-authority-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const ed = keys();
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const base = {
    rootDir, projectId: 'project-one',
    initialLegacy: { route: '/converted/shape', version: 'legacy-live', artifactHash: HASH('legacy') },
  };
  assert.throws(() => openProductionProject({
    ...base,
    reviewAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(rsa.publicKey) },
    danAuthority: { authorityId: 'dan-v1', publicKeyPem: publicPem(ed.publicKey) },
  }), /Ed25519/);
  assert.throws(() => openProductionProject({
    ...base,
    reviewAuthority: { authorityId: 'same', publicKeyPem: publicPem(ed.publicKey) },
    danAuthority: { authorityId: 'same', publicKeyPem: publicPem(ed.publicKey) },
  }), /distinct/);
  assert.throws(() => openProductionProject({
    ...base,
    reviewAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(ed.publicKey), privateKeyPem: 'forbidden' },
    danAuthority: { authorityId: 'dan-v1', publicKeyPem: publicPem(keys().publicKey) },
  }), /public|private|field/);
  assert.throws(() => openProductionProject({
    ...base,
    initialLegacy: { route: '//remote.example/escape', version: 'legacy-live', artifactHash: HASH('legacy') },
    reviewAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(ed.publicKey) },
    danAuthority: { authorityId: 'dan-v1', publicKeyPem: publicPem(keys().publicKey) },
  }), /legacy/);
});

test('P9 dual authorization binds source, corpus, budgets, environment, base, and rollback exercise exactly', async (t) => {
  const { production, sandbox, promotion, review, dan } = await fixture(t, 'binding-');
  await promoteSandbox(sandbox, promotion);
  const proposal = buildProductionCutoverProposal(production, sandbox);
  const good = authorize(proposal, review, dan);
  const mutations = [
    (value) => { value.authorizationPayload.sandboxSourceHash = HASH('other'); },
    (value) => { value.authorizationPayload.corpusReportHash = HASH('other'); },
    (value) => { value.authorizationPayload.fidelityBudgetHash = HASH('other'); },
    (value) => { value.authorizationPayload.environmentManifestHash = HASH('other'); },
    (value) => { value.authorizationPayload.baseProductionGenerationName = 'g-forged'; },
    (value) => { value.authorizationPayload.rollbackExercise.proofHash = HASH('other'); },
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(proposal);
    mutate(forged);
    forged.proposalHash = HASH({
      schemaVersion: forged.schemaVersion,
      cutoverId: forged.cutoverId,
      candidateGenerationName: forged.candidateGenerationName,
      authorizationPayload: forged.authorizationPayload,
    });
    assert.throws(() => stageProductionCutover(production, sandbox, {
      proposal: forged,
      reviewSignature: signature(forged.authorizationPayload, review.privateKey),
      danSignature: signature(forged.authorizationPayload, dan.privateKey),
    }), /proposal|source|rollback|base|drift/);
  }
  const wrong = keys();
  assert.throws(() => stageProductionCutover(production, sandbox, {
    ...good,
    danSignature: signature(proposal.authorizationPayload, wrong.privateKey),
  }), /Dan|signature/);
  assert.equal(readProductionProject(production).activeLane, 'legacy');
});

test('P9 staging is immutable and non-activating; atomic activation switches package and registry together', async (t) => {
  const { production, sandbox, promotion, review, dan } = await fixture(t, 'activate-');
  const stagedSandbox = await promoteSandbox(sandbox, promotion);
  const before = readProductionProject(production);
  const staged = await stageAuthorized(production, sandbox, review, dan);
  assert.equal(staged.state, 'STAGED');
  assert.deepEqual(readProductionProject(production), before);
  assert.equal((await readFile(path.join(staged.generationDir, 'cutover.json'), 'utf8')).includes('dan-cutover-v1'), true);

  assert.throws(() => activateProductionCutover(production, staged.cutoverId, { inject: 'after-pointer-update' }), /injected crash/);
  assert.deepEqual(readProductionProject(production), before);
  assert.equal(readCutoverStatus(production, staged.cutoverId).state, 'STAGED');

  const active = activateProductionCutover(production, staged.cutoverId);
  assert.equal(active.activeLane, 'compiler-v2');
  assert.equal(active.packageHash, stagedSandbox.packageHash);
  assert.equal(active.registryHash, stagedSandbox.candidateRegistryHash);
  assert.equal(active.registryGeneration, 1);
  assert.equal(readCutoverStatus(production, staged.cutoverId).state, 'ACTIVE');
  assert.deepEqual(p9Failures({ projectDir: production.projectDir, reviewPublicKeyPem: publicPem(review.publicKey), danPublicKeyPem: publicPem(dan.publicKey) }), []);
});

test('P9 re-reads staged bytes and topology; tamper or symlink cannot move production', async (t) => {
  const { production, sandbox, promotion, review, dan } = await fixture(t, 'tamper-');
  await promoteSandbox(sandbox, promotion);
  const staged = await stageAuthorized(production, sandbox, review, dan);
  const before = readProductionProject(production);
  await writeFile(path.join(staged.generationDir, 'package/screens/Screen.tsx'), 'forged\n');
  assert.throws(() => activateProductionCutover(production, staged.cutoverId), /hash|inventory|drift/);
  assert.deepEqual(readProductionProject(production), before);

  const packageDir = path.join(staged.generationDir, 'package');
  const packageReal = path.join(staged.generationDir, 'package-real');
  await rename(packageDir, packageReal);
  await symlink('package-real', packageDir, 'dir');
  assert.throws(() => readCutoverStatus(production, staged.cutoverId), /symlink/);
  assert.deepEqual(readProductionProject(production), before);
});

test('P9 rollback restores the exact prior production identity and survives restart', async (t) => {
  const { rootDir, production, sandbox, promotion, review, dan } = await fixture(t, 'rollback-');
  await promoteSandbox(sandbox, promotion);
  const before = readProductionProject(production);
  const staged = await stageAuthorized(production, sandbox, review, dan);
  activateProductionCutover(production, staged.cutoverId);

  assert.throws(() => rollbackProductionCutover(production, staged.cutoverId, { inject: 'after-pointer-update' }), /injected crash/);
  assert.equal(readProductionProject(production).activeLane, 'compiler-v2');
  const rolledBack = rollbackProductionCutover(production, staged.cutoverId);
  assert.equal(rolledBack.activeLane, 'legacy');
  assert.equal(rolledBack.activeGenerationName, before.activeGenerationName);
  assert.equal(rolledBack.activeIdentityHash, before.activeIdentityHash);
  assert.equal(readCutoverStatus(production, staged.cutoverId).state, 'ROLLED_BACK');
  production.close();

  const reopened = openProductionProject({
    rootDir,
    projectId: 'project-one',
    reviewAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: publicPem(review.publicKey) },
    danAuthority: { authorityId: 'dan-cutover-v1', publicKeyPem: publicPem(dan.publicKey) },
    initialLegacy: { route: '/converted/shape', version: 'legacy-live', artifactHash: HASH('legacy-package') },
  });
  t.after(() => reopened.close());
  const recovered = recoverProductionProject(reopened);
  assert.equal(recovered.project.activeLane, 'legacy');
  assert.equal(recovered.project.activeIdentityHash, before.activeIdentityHash);
  assert.equal(recovered.cutovers[0].state, 'ROLLED_BACK');
  assert.deepEqual(p9Failures({ projectDir: reopened.projectDir, reviewPublicKeyPem: publicPem(review.publicKey), danPublicKeyPem: publicPem(dan.publicKey) }), []);
});

test('P9 independent oracle rejects a package/registry split and forged signed-record metadata', async (t) => {
  const first = await fixture(t, 'oracle-split-');
  await promoteSandbox(first.sandbox, first.promotion);
  const staged = await stageAuthorized(first.production, first.sandbox, first.review, first.dan);
  activateProductionCutover(first.production, staged.cutoverId);
  const db = new DatabaseSync(path.join(first.production.projectDir, 'state.sqlite'));
  db.prepare('UPDATE project_state SET registry_hash=? WHERE id=1').run(HASH('split-registry'));
  db.close();
  assert.throws(() => readProductionProject(first.production), /pointer|generation|registry/);
  assert.equal(p9Failures({
    projectDir: first.production.projectDir,
    reviewPublicKeyPem: publicPem(first.review.publicKey),
    danPublicKeyPem: publicPem(first.dan.publicKey),
  }).some((failure) => /pointer registry split/.test(failure)), true);

  const second = await fixture(t, 'oracle-record-');
  await promoteSandbox(second.sandbox, second.promotion);
  const secondStage = await stageAuthorized(second.production, second.sandbox, second.review, second.dan);
  const cutoverFile = path.join(secondStage.generationDir, 'cutover.json');
  const cutover = JSON.parse(await readFile(cutoverFile, 'utf8'));
  cutover.authorizationPayload.corpusReportHash = HASH('forged-corpus');
  await writeFile(cutoverFile, canonicalJson(cutover));
  assert.throws(() => readCutoverStatus(second.production, secondStage.cutoverId), /authorization|signature|proposal/);
  assert.equal(p9Failures({
    projectDir: second.production.projectDir,
    reviewPublicKeyPem: publicPem(second.review.publicKey),
    danPublicKeyPem: publicPem(second.dan.publicKey),
  }).length > 0, true);

  const third = await fixture(t, 'oracle-state-');
  await promoteSandbox(third.sandbox, third.promotion);
  const thirdStage = await stageAuthorized(third.production, third.sandbox, third.review, third.dan);
  activateProductionCutover(third.production, thirdStage.cutoverId);
  const stateDb = new DatabaseSync(path.join(third.production.projectDir, 'state.sqlite'));
  stateDb.prepare('UPDATE cutovers SET state=? WHERE cutover_id=?').run('SUPERSEDED', thirdStage.cutoverId);
  stateDb.close();
  assert.throws(() => readProductionProject(third.production), /authority|ACTIVE/);
  assert.equal(p9Failures({
    projectDir: third.production.projectDir,
    reviewPublicKeyPem: publicPem(third.review.publicKey),
    danPublicKeyPem: publicPem(third.dan.publicKey),
  }).some((failure) => /ACTIVE cutover/.test(failure)), true);
});

test('P9 real cross-process activation race has exactly one pointer winner', async (t) => {
  const { rootDir, production, sandbox, promotion, review, dan } = await fixture(t, 'process-');
  await promoteSandbox(sandbox, promotion);
  const staged = await stageAuthorized(production, sandbox, review, dan);
  const reviewKeyFile = path.join(rootDir, 'review-public.pem');
  const danKeyFile = path.join(rootDir, 'dan-public.pem');
  const legacyFile = path.join(rootDir, 'legacy.json');
  await writeFile(reviewKeyFile, publicPem(review.publicKey));
  await writeFile(danKeyFile, publicPem(dan.publicKey));
  await writeFile(legacyFile, canonicalJson({ route: '/converted/shape', version: 'legacy-live', artifactHash: HASH('legacy-package') }));
  const invoke = () => run(process.execPath, [
    ACTIVATE_WORKER, rootDir, 'project-one', reviewKeyFile, danKeyFile, legacyFile, staged.cutoverId,
  ], { maxBuffer: 1_000_000 });
  const results = (await Promise.all([invoke(), invoke()])).map(({ stdout }) => JSON.parse(stdout));
  assert.equal(results.filter((row) => row.ok).length, 1, JSON.stringify(results));
  assert.equal(results.filter((row) => !row.ok && /ACTIVE/.test(row.error)).length, 1, JSON.stringify(results));
  const active = readProductionProject(production);
  assert.equal(active.pointerGeneration, 1);
  assert.equal(active.activeLane, 'compiler-v2');
});

test('P9 restart adopts only a byte-exact signed generation orphan and reports unknown debris without deleting it', async (t) => {
  const { production, sandbox, promotion, review, dan } = await fixture(t, 'orphan-');
  await promoteSandbox(sandbox, promotion);
  const proposal = buildProductionCutoverProposal(production, sandbox);
  const staged = stageProductionCutover(production, sandbox, authorize(proposal, review, dan));
  const db = new DatabaseSync(path.join(production.projectDir, 'state.sqlite'));
  db.prepare('DELETE FROM cutovers WHERE cutover_id=?').run(staged.cutoverId);
  db.close();
  assert.deepEqual(recoverProductionProject(production).orphanedGenerations, [staged.candidateGenerationName]);

  const recovered = stageProductionCutover(production, sandbox, authorize(proposal, review, dan));
  assert.equal(recovered.recoveredOrphan, true);
  assert.equal(recovered.state, 'STAGED');
  assert.deepEqual(recoverProductionProject(production).orphanedGenerations, []);
  assert.equal(readProductionProject(production).activeLane, 'legacy');
});

test('P9 sequential v2 releases supersede exactly one authority and rollback restores it atomically', async (t) => {
  const { production, sandbox, promotion, review, dan } = await fixture(t, 'sequential-');
  await promoteSandbox(sandbox, promotion, 'tx-release-one', 'one');
  const first = await stageAuthorized(production, sandbox, review, dan);
  const firstActive = activateProductionCutover(production, first.cutoverId);

  await promoteSandbox(sandbox, promotion, 'tx-release-two', 'one');
  const second = await stageAuthorized(production, sandbox, review, dan);
  const secondActive = activateProductionCutover(production, second.cutoverId);
  assert.equal(secondActive.pointerGeneration, firstActive.pointerGeneration + 1);
  assert.equal(readCutoverStatus(production, first.cutoverId).state, 'SUPERSEDED');
  assert.equal(readCutoverStatus(production, second.cutoverId).state, 'ACTIVE');
  assert.deepEqual(p9Failures({
    projectDir: production.projectDir,
    reviewPublicKeyPem: publicPem(review.publicKey),
    danPublicKeyPem: publicPem(dan.publicKey),
  }), []);

  const restored = rollbackProductionCutover(production, second.cutoverId);
  assert.equal(restored.activeGenerationName, firstActive.activeGenerationName);
  assert.equal(restored.activeIdentityHash, firstActive.activeIdentityHash);
  assert.equal(readCutoverStatus(production, first.cutoverId).state, 'ACTIVE');
  assert.equal(readCutoverStatus(production, second.cutoverId).state, 'ROLLED_BACK');
  assert.deepEqual(p9Failures({
    projectDir: production.projectDir,
    reviewPublicKeyPem: publicPem(review.publicKey),
    danPublicKeyPem: publicPem(dan.publicKey),
  }), []);
});

test('P9 real cross-process staging has one owner and leaves no orphaned staging or generations', async (t) => {
  const { rootDir, production, sandbox, promotion, review, dan } = await fixture(t, 'stage-process-');
  await promoteSandbox(sandbox, promotion);
  const proposal = buildProductionCutoverProposal(production, sandbox);
  const authorization = authorize(proposal, review, dan);
  const files = {
    promotion: path.join(rootDir, 'promotion-public.pem'),
    review: path.join(rootDir, 'review-public.pem'),
    dan: path.join(rootDir, 'dan-public.pem'),
    legacy: path.join(rootDir, 'legacy.json'),
    proposal: path.join(rootDir, 'proposal.json'),
    reviewSignature: path.join(rootDir, 'review.sig'),
    danSignature: path.join(rootDir, 'dan.sig'),
  };
  await Promise.all([
    writeFile(files.promotion, publicPem(promotion.publicKey)),
    writeFile(files.review, publicPem(review.publicKey)),
    writeFile(files.dan, publicPem(dan.publicKey)),
    writeFile(files.legacy, canonicalJson({ route: '/converted/shape', version: 'legacy-live', artifactHash: HASH('legacy-package') })),
    writeFile(files.proposal, canonicalJson(proposal)),
    writeFile(files.reviewSignature, authorization.reviewSignature),
    writeFile(files.danSignature, authorization.danSignature),
  ]);
  const invoke = () => run(process.execPath, [
    STAGE_WORKER, rootDir, 'project-one', files.promotion, files.review, files.dan, files.legacy,
    files.proposal, files.reviewSignature, files.danSignature,
  ], { maxBuffer: 1_000_000 });
  const results = (await Promise.all(Array.from({ length: 8 }, invoke))).map(({ stdout }) => JSON.parse(stdout));
  assert.equal(results.filter((row) => row.ok).length, 1, JSON.stringify(results));
  assert.equal(results.filter((row) => !row.ok).length, 7, JSON.stringify(results));
  assert.equal(readCutoverStatus(production, proposal.cutoverId).state, 'STAGED');
  const recovered = recoverProductionProject(production);
  assert.deepEqual(recovered.orphanedGenerations, []);
  assert.deepEqual(recovered.orphanedStaging, []);
});
