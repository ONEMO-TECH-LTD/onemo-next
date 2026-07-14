/** P9 fail-closed production cutover/rollback kernel. It contains no signer and performs no cutover without Dan authority. */
import {
  createPublicKey, randomUUID, verify as verifySignature,
} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonicalJson, sha256 } from './evidence.mjs';
import { readPromotedSandboxGeneration } from './sandbox-store.mjs';

const NAMESPACE = 'compiler-v2-production-v1';
const HASH = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const AUTHORITY_FIELDS = 'authorityId,publicKeyPem';
const LEGACY_FIELDS = 'artifactHash,route,version';
const LEGACY_GENERATION = 'g-0-legacy';
const GATES = Object.freeze(Array.from({ length: 14 }, (_, index) => `G${index}`));

export class ProductionCutoverError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_STATIC'; }
}

export function openProductionProject({
  rootDir, projectId, reviewAuthority, danAuthority, initialLegacy,
}) {
  if (typeof rootDir !== 'string' || !path.isAbsolute(rootDir)) throw new ProductionCutoverError('production root must be absolute');
  if (!ID.test(projectId ?? '')) throw new ProductionCutoverError('production project id invalid');
  const review = normalizeAuthority(reviewAuthority, 'review');
  const dan = normalizeAuthority(danAuthority, 'Dan');
  if (review.authorityId === dan.authorityId || review.publicKeyHash === dan.publicKeyHash) throw new ProductionCutoverError('review and Dan cutover authorities must be distinct');
  const legacy = normalizeLegacy(initialLegacy);

  fs.mkdirSync(rootDir, { recursive: true });
  const rootReal = fs.realpathSync(rootDir);
  const namespaceDir = path.join(rootReal, NAMESPACE);
  const projectDir = path.join(namespaceDir, 'projects', projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  const projectReal = fs.realpathSync(projectDir);
  if (!within(rootReal, projectReal)) throw new ProductionCutoverError('production project escapes root');
  const generationsDir = path.join(projectReal, 'generations');
  const stagingDir = path.join(projectReal, 'staging');
  for (const dir of [generationsDir, stagingDir]) fs.mkdirSync(dir, { recursive: true });

  const projectFile = path.join(projectReal, 'project.json');
  const expectedProject = {
    schemaVersion: 1,
    namespace: NAMESPACE,
    projectId,
    reviewAuthorityId: review.authorityId,
    reviewPublicKeyHash: review.publicKeyHash,
    danAuthorityId: dan.authorityId,
    danPublicKeyHash: dan.publicKeyHash,
    initialLegacy: legacy,
  };
  ensureExactFile(projectFile, expectedProject, 'production project metadata');
  const legacyRecord = ensureLegacyGeneration(generationsDir, legacy);

  const dbPath = path.join(projectReal, 'state.sqlite');
  if (fs.existsSync(dbPath) && fs.lstatSync(dbPath).isSymbolicLink()) throw new ProductionCutoverError('production database symlink forbidden');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout=5000;');
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_state (
      id INTEGER PRIMARY KEY CHECK (id = 1), pointer_generation INTEGER NOT NULL,
      active_generation_name TEXT NOT NULL, active_lane TEXT NOT NULL,
      active_identity_hash TEXT NOT NULL, package_hash TEXT,
      registry_generation INTEGER, registry_hash TEXT, report_hash TEXT,
      source_hash TEXT NOT NULL, cutover_id TEXT
    ) STRICT;
    CREATE TABLE IF NOT EXISTS cutovers (
      cutover_id TEXT PRIMARY KEY, state TEXT NOT NULL,
      base_pointer_generation INTEGER NOT NULL,
      base_generation_name TEXT NOT NULL, base_identity_hash TEXT NOT NULL,
      candidate_generation_name TEXT NOT NULL, candidate_identity_hash TEXT NOT NULL,
      sandbox_source_hash TEXT NOT NULL, package_hash TEXT NOT NULL,
      registry_generation INTEGER NOT NULL, registry_hash TEXT NOT NULL,
      report_hash TEXT NOT NULL, corpus_report_hash TEXT NOT NULL,
      fidelity_budget_hash TEXT NOT NULL, environment_manifest_hash TEXT NOT NULL,
      rollback_proof_hash TEXT NOT NULL, proposal_hash TEXT NOT NULL,
      review_signature TEXT NOT NULL, dan_signature TEXT NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;
    INSERT OR IGNORE INTO project_state(
      id,pointer_generation,active_generation_name,active_lane,active_identity_hash,source_hash
    ) VALUES (1,0,'${LEGACY_GENERATION}','legacy','${legacyRecord.generationHash}','${legacy.artifactHash}');
  `);
  let closed = false;
  const project = {
    schemaVersion: 1,
    namespace: NAMESPACE,
    projectId,
    rootDir: rootReal,
    projectDir: projectReal,
    generationsDir,
    stagingDir,
    initialLegacy: Object.freeze(legacy),
    reviewAuthority: Object.freeze(review.public),
    danAuthority: Object.freeze(dan.public),
    _reviewKey: review.key,
    _danKey: dan.key,
    _db: db,
    _dbPath: dbPath,
    get closed() { return closed; },
    close() { if (!closed) { db.close(); closed = true; } },
  };
  try {
    assertProject(project);
    readProductionProject(project);
  } catch (error) {
    project.close();
    throw error;
  }
  return Object.freeze(project);
}

export function buildProductionCutoverProposal(project, sandboxProject) {
  assertProject(project);
  const source = readPromotedSandboxGeneration(sandboxProject);
  if (source.projectId !== project.projectId) throw new ProductionCutoverError('sandbox/production project mismatch');
  const current = readProductionProject(project);
  const cutoverId = derivedCutoverId(current.pointerGeneration, source.sourceHash);
  const candidateGenerationName = derivedGenerationName(current.pointerGeneration, source.sourceHash);
  const rollbackExercise = exercisePointerCycle(project, current, source, candidateGenerationName);
  const authorizationPayload = {
    schemaVersion: 1,
    namespace: NAMESPACE,
    projectId: project.projectId,
    reviewAuthorityId: project.reviewAuthority.authorityId,
    danAuthorityId: project.danAuthority.authorityId,
    cutoverId,
    basePointerGeneration: current.pointerGeneration,
    baseProductionGenerationName: current.activeGenerationName,
    baseProductionIdentityHash: current.activeIdentityHash,
    candidateGenerationName,
    sandboxNamespace: source.namespace,
    sandboxGeneration: source.sandboxGeneration,
    sandboxGenerationName: source.sandboxGenerationName,
    sandboxTransactionId: source.transactionId,
    sandboxSourceHash: source.sourceHash,
    sandboxPromotionReceiptHash: source.promotionReceiptHash,
    packageHash: source.packageHash,
    registryGeneration: source.sandboxRegistryGeneration,
    registryHash: source.sandboxRegistryHash,
    reportHash: source.reportHash,
    corpusReportHash: source.report.corpusReportHash,
    fidelityBudgetHash: source.report.fidelityBudgetHash,
    environmentManifestHash: source.report.environmentManifestHash,
    rollbackExercise,
  };
  const body = { schemaVersion: 1, cutoverId, candidateGenerationName, authorizationPayload };
  return { ...structuredClone(body), proposalHash: sha256(canonicalJson(body)) };
}

export function stageProductionCutover(project, sandboxProject, {
  proposal, reviewSignature, danSignature,
}) {
  assertProject(project);
  const derived = buildProductionCutoverProposal(project, sandboxProject);
  if (canonicalJson(proposal) !== canonicalJson(derived)) throw new ProductionCutoverError('cutover proposal/source/base/rollback drift');
  verifyAuthoritySignature(project._reviewKey, project.reviewAuthority.authorityId, proposal.authorizationPayload, reviewSignature, 'review');
  verifyAuthoritySignature(project._danKey, project.danAuthority.authorityId, proposal.authorizationPayload, danSignature, 'Dan');
  if (cutoverRow(project._db, proposal.cutoverId)) throw new ProductionCutoverError(`cutover already exists: ${proposal.cutoverId}`);

  const source = readPromotedSandboxGeneration(sandboxProject);
  if (source.sourceHash !== proposal.authorizationPayload.sandboxSourceHash) throw new ProductionCutoverError('sandbox source changed before cutover staging');
  const stageDir = confined(project.projectDir, `staging/${proposal.cutoverId}-${randomUUID()}`);
  const generationDir = confined(project.projectDir, `generations/${proposal.candidateGenerationName}`);
  if (fs.existsSync(generationDir)) {
    verifyUntrackedGeneration(project, proposal, reviewSignature, danSignature);
    insertCutoverRow(project, proposal, reviewSignature, danSignature);
    return { ...readCutoverStatus(project, proposal.cutoverId), generationDir, recoveredOrphan: true };
  }
  fs.mkdirSync(path.join(stageDir, 'package'), { recursive: true });
  let generationOwned = false;
  try {
    for (const [relative, bytes] of Object.entries(source.packageFiles)) {
      const target = confined(path.join(stageDir, 'package'), relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      writeDurable(target, Buffer.from(bytes));
    }
    writeDurable(path.join(stageDir, 'registry.json'), Buffer.from(canonicalJson(source.registry)));
    writeDurable(path.join(stageDir, 'report.json'), Buffer.from(canonicalJson(source.report)));
    const generation = candidateGenerationRecord(proposal);
    const cutover = cutoverRecord(project, proposal, reviewSignature, danSignature);
    writeDurable(path.join(stageDir, 'generation.json'), Buffer.from(canonicalJson(generation)));
    writeDurable(path.join(stageDir, 'cutover.json'), Buffer.from(canonicalJson(cutover)));
    fsyncDirectoryTree(stageDir);
    assertTopology(project);
    fs.renameSync(stageDir, generationDir);
    generationOwned = true;
    fsyncDirectory(project.generationsDir);
    fsyncDirectory(project.stagingDir);

    insertCutoverRow(project, proposal, reviewSignature, danSignature);
  } catch (error) {
    fs.rmSync(stageDir, { recursive: true, force: true });
    if (generationOwned && !cutoverRow(project._db, proposal.cutoverId)) fs.rmSync(generationDir, { recursive: true, force: true });
    throw error instanceof ProductionCutoverError ? error : new ProductionCutoverError(`cutover staging failed: ${error.message}`);
  }
  return { ...readCutoverStatus(project, proposal.cutoverId), generationDir };
}

export function activateProductionCutover(project, cutoverId, { inject = null } = {}) {
  assertProject(project);
  validateId(cutoverId, 'cutover id');
  const db = project._db;
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = cutoverRow(db, cutoverId);
    if (!row) throw new ProductionCutoverError(`cutover missing: ${cutoverId}`);
    if (row.state !== 'STAGED') throw new ProductionCutoverError(`cutover ${cutoverId} is ${row.state}`);
    const current = normalizedProjectRow(projectRow(db), project.projectId);
    if (current.pointerGeneration !== row.base_pointer_generation
      || current.activeGenerationName !== row.base_generation_name
      || current.activeIdentityHash !== row.base_identity_hash) throw new ProductionCutoverError('production base generation/hash conflict; re-authorize cutover');
    const candidate = verifyCandidateGeneration(project, row);
    const base = verifyGenerationByName(project, row.base_generation_name);
    if (base.generationHash !== row.base_identity_hash) throw new ProductionCutoverError('rollback base identity drift');
    if (inject === 'after-verification') throw new ProductionCutoverError('injected crash after verification');
    if (current.cutoverId) {
      const prior = cutoverRow(db, current.cutoverId);
      if (!prior || prior.state !== 'ACTIVE') throw new ProductionCutoverError('current production cutover authority is not ACTIVE');
      db.prepare('UPDATE cutovers SET state=? WHERE cutover_id=?').run('SUPERSEDED', current.cutoverId);
    }
    updatePointer(db, current.pointerGeneration + 1, candidate);
    db.prepare('UPDATE cutovers SET state=? WHERE cutover_id=?').run('ACTIVE', cutoverId);
    if (inject === 'after-pointer-update') throw new ProductionCutoverError('injected crash after pointer update');
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error instanceof ProductionCutoverError ? error : new ProductionCutoverError(`production activation failed: ${error.message}`);
  }
  return readProductionProject(project);
}

export function rollbackProductionCutover(project, cutoverId, { inject = null } = {}) {
  assertProject(project);
  validateId(cutoverId, 'cutover id');
  const db = project._db;
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = cutoverRow(db, cutoverId);
    if (!row) throw new ProductionCutoverError(`cutover missing: ${cutoverId}`);
    if (row.state !== 'ACTIVE') throw new ProductionCutoverError(`cutover ${cutoverId} is ${row.state}`);
    const current = normalizedProjectRow(projectRow(db), project.projectId);
    if (current.activeGenerationName !== row.candidate_generation_name
      || current.activeIdentityHash !== row.candidate_identity_hash) throw new ProductionCutoverError('active production candidate identity drift');
    verifyCandidateGeneration(project, row);
    const rollback = verifyGenerationByName(project, row.base_generation_name);
    if (rollback.generationHash !== row.base_identity_hash) throw new ProductionCutoverError('rollback package identity drift');
    if (inject === 'after-verification') throw new ProductionCutoverError('injected crash after verification');
    if (rollback.cutoverId) {
      const prior = cutoverRow(db, rollback.cutoverId);
      if (!prior || prior.state !== 'SUPERSEDED') throw new ProductionCutoverError('rollback target cutover authority is not SUPERSEDED');
      db.prepare('UPDATE cutovers SET state=? WHERE cutover_id=?').run('ACTIVE', rollback.cutoverId);
    }
    updatePointer(db, current.pointerGeneration + 1, rollback);
    db.prepare('UPDATE cutovers SET state=? WHERE cutover_id=?').run('ROLLED_BACK', cutoverId);
    if (inject === 'after-pointer-update') throw new ProductionCutoverError('injected crash after pointer update');
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error instanceof ProductionCutoverError ? error : new ProductionCutoverError(`production rollback failed: ${error.message}`);
  }
  return readProductionProject(project);
}

export function readProductionProject(project) {
  assertProject(project);
  const state = normalizedProjectRow(projectRow(project._db), project.projectId);
  const generation = verifyGenerationByName(project, state.activeGenerationName);
  const expected = stateFromGeneration(project.projectId, state.pointerGeneration, generation);
  if (canonicalJson(state) !== canonicalJson(expected)) throw new ProductionCutoverError('production pointer disagrees with active generation');
  const activeRows = project._db.prepare('SELECT cutover_id,candidate_generation_name,candidate_identity_hash FROM cutovers WHERE state=?').all('ACTIVE');
  if (state.activeLane === 'compiler-v2') {
    if (activeRows.length !== 1 || activeRows[0].cutover_id !== state.cutoverId
      || activeRows[0].candidate_generation_name !== state.activeGenerationName
      || activeRows[0].candidate_identity_hash !== state.activeIdentityHash) throw new ProductionCutoverError('active production pointer/cutover authority mismatch');
  } else if (activeRows.length) throw new ProductionCutoverError('legacy production pointer retains an ACTIVE cutover authority');
  return state;
}

export function readCutoverStatus(project, cutoverId) {
  assertProject(project);
  validateId(cutoverId, 'cutover id');
  const row = cutoverRow(project._db, cutoverId);
  if (!row) throw new ProductionCutoverError(`cutover missing: ${cutoverId}`);
  const generation = verifyCandidateGeneration(project, row);
  return {
    schemaVersion: 1,
    cutoverId: row.cutover_id,
    state: row.state,
    basePointerGeneration: row.base_pointer_generation,
    baseGenerationName: row.base_generation_name,
    baseIdentityHash: row.base_identity_hash,
    candidateGenerationName: row.candidate_generation_name,
    candidateIdentityHash: generation.generationHash,
    sandboxSourceHash: row.sandbox_source_hash,
    packageHash: row.package_hash,
    registryGeneration: row.registry_generation,
    registryHash: row.registry_hash,
    reportHash: row.report_hash,
    corpusReportHash: row.corpus_report_hash,
    rollbackProofHash: row.rollback_proof_hash,
    reviewAuthorized: true,
    danAuthorized: true,
  };
}

export function recoverProductionProject(project) {
  assertProject(project);
  const state = readProductionProject(project);
  const cutovers = project._db.prepare('SELECT cutover_id FROM cutovers ORDER BY created_at,cutover_id').all()
    .map((row) => readCutoverStatus(project, row.cutover_id));
  const referenced = new Set([LEGACY_GENERATION, ...cutovers.map((row) => row.candidateGenerationName)]);
  const orphanedGenerations = fs.readdirSync(project.generationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !referenced.has(entry.name)).map((entry) => entry.name).sort();
  const orphanedStaging = fs.readdirSync(project.stagingDir).sort();
  return { schemaVersion: 1, project: state, cutovers, orphanedGenerations, orphanedStaging };
}

function exercisePointerCycle(project, current, source, candidateGenerationName) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE pointer(
      id INTEGER PRIMARY KEY CHECK(id=1),pointer_generation INTEGER NOT NULL,
      active_generation_name TEXT NOT NULL,active_lane TEXT NOT NULL,
      active_identity_hash TEXT NOT NULL,package_hash TEXT,registry_generation INTEGER,
      registry_hash TEXT,report_hash TEXT,source_hash TEXT NOT NULL,cutover_id TEXT
    ) STRICT;`);
    db.prepare('INSERT INTO pointer VALUES (1,?,?,?,?,?,?,?,?,?,?)').run(
      current.pointerGeneration, current.activeGenerationName, current.activeLane,
      current.activeIdentityHash, current.packageHash, current.registryGeneration,
      current.registryHash, current.reportHash, current.sourceHash, current.cutoverId,
    );
    const cutoverId = derivedCutoverId(current.pointerGeneration, source.sourceHash);
    const candidate = {
      generationName: candidateGenerationName,
      lane: 'compiler-v2',
      generationHash: candidateIdentityHash({
        candidateGenerationName,
        source,
        cutoverId,
        rollbackGenerationName: current.activeGenerationName,
        rollbackIdentityHash: current.activeIdentityHash,
      }),
      packageHash: source.packageHash,
      registryGeneration: source.sandboxRegistryGeneration,
      registryHash: source.sandboxRegistryHash,
      reportHash: source.reportHash,
      sourceHash: source.sourceHash,
      cutoverId,
    };
    db.exec('BEGIN IMMEDIATE');
    updatePointerTable(db, 'pointer', current.pointerGeneration + 1, candidate);
    db.exec('COMMIT');
    const activated = normalizedPointerExercise(db.prepare('SELECT * FROM pointer WHERE id=1').get());
    db.exec('BEGIN IMMEDIATE');
    updatePointerTable(db, 'pointer', activated.pointerGeneration + 1, {
      generationName: current.activeGenerationName,
      lane: current.activeLane,
      generationHash: current.activeIdentityHash,
      packageHash: current.packageHash,
      registryGeneration: current.registryGeneration,
      registryHash: current.registryHash,
      reportHash: current.reportHash,
      sourceHash: current.sourceHash,
      cutoverId: current.cutoverId,
    });
    db.exec('COMMIT');
    const restored = normalizedPointerExercise(db.prepare('SELECT * FROM pointer WHERE id=1').get());
    const exactPriorIdentityRestored = restored.activeGenerationName === current.activeGenerationName
      && restored.activeLane === current.activeLane
      && restored.activeIdentityHash === current.activeIdentityHash
      && restored.packageHash === current.packageHash
      && restored.registryGeneration === current.registryGeneration
      && restored.registryHash === current.registryHash
      && restored.reportHash === current.reportHash
      && restored.sourceHash === current.sourceHash
      && restored.cutoverId === current.cutoverId;
    const body = {
      schemaVersion: 1,
      method: 'sqlite-pointer-cycle-v1',
      basePointerGeneration: current.pointerGeneration,
      activationPointerGeneration: activated.pointerGeneration,
      rollbackPointerGeneration: restored.pointerGeneration,
      baseGenerationName: current.activeGenerationName,
      baseIdentityHash: current.activeIdentityHash,
      candidateGenerationName,
      candidateIdentityHash: candidate.generationHash,
      sandboxSourceHash: source.sourceHash,
      exactPriorIdentityRestored,
    };
    return { ...body, proofHash: sha256(canonicalJson(body)) };
  } finally { db.close(); }
}

function candidateGenerationRecord(proposal) {
  const payload = proposal.authorizationPayload;
  const body = candidateGenerationBody({
    candidateGenerationName: proposal.candidateGenerationName,
    packageHash: payload.packageHash,
    registryGeneration: payload.registryGeneration,
    registryHash: payload.registryHash,
    reportHash: payload.reportHash,
    sourceHash: payload.sandboxSourceHash,
    cutoverId: proposal.cutoverId,
    rollbackGenerationName: payload.baseProductionGenerationName,
    rollbackIdentityHash: payload.baseProductionIdentityHash,
  });
  return { ...body, generationHash: sha256(canonicalJson(body)) };
}

function candidateGenerationBody({
  candidateGenerationName, packageHash, registryGeneration, registryHash, reportHash, sourceHash,
  cutoverId, rollbackGenerationName, rollbackIdentityHash,
}) {
  return {
    schemaVersion: 1,
    namespace: NAMESPACE,
    generationName: candidateGenerationName,
    lane: 'compiler-v2',
    packageHash,
    registryGeneration,
    registryHash,
    reportHash,
    sourceHash,
    cutoverId,
    rollbackGenerationName,
    rollbackIdentityHash,
  };
}

function cutoverRecord(project, proposal, reviewSignature, danSignature) {
  return {
    schemaVersion: 1,
    namespace: NAMESPACE,
    proposalHash: proposal.proposalHash,
    authorizationPayload: proposal.authorizationPayload,
    reviewAuthorityId: project.reviewAuthority.authorityId,
    reviewSignature,
    reviewSignatureHash: sha256(Buffer.from(reviewSignature, 'base64')),
    danAuthorityId: project.danAuthority.authorityId,
    danSignature,
    danSignatureHash: sha256(Buffer.from(danSignature, 'base64')),
  };
}

function verifyUntrackedGeneration(project, proposal, reviewSignature, danSignature) {
  if (cutoverRow(project._db, proposal.cutoverId)) throw new ProductionCutoverError(`cutover already exists: ${proposal.cutoverId}`);
  const generation = verifyGenerationByName(project, proposal.candidateGenerationName);
  const expectedGeneration = candidateGenerationRecord(proposal);
  if (canonicalJson(generation) !== canonicalJson(expectedGeneration)) throw new ProductionCutoverError('untracked production generation does not match the authorized proposal');
  const projectReal = fs.realpathSync(project.projectDir);
  const root = realDirectory(projectReal, confined(project.projectDir, `generations/${proposal.candidateGenerationName}`), 'untracked production generation');
  const cutover = readJson(realRegularFile(root, path.join(root, 'cutover.json'), 'untracked cutover record'), 'untracked cutover record');
  const expectedCutover = cutoverRecord(project, proposal, reviewSignature, danSignature);
  if (canonicalJson(cutover) !== canonicalJson(expectedCutover)) throw new ProductionCutoverError('untracked cutover authorization does not match the supplied authorities');
}

function insertCutoverRow(project, proposal, reviewSignature, danSignature) {
  const payload = proposal.authorizationPayload;
  const generation = candidateGenerationRecord(proposal);
  project._db.exec('BEGIN IMMEDIATE');
  try {
    if (cutoverRow(project._db, proposal.cutoverId)) throw new ProductionCutoverError(`cutover already exists: ${proposal.cutoverId}`);
    project._db.prepare(`INSERT INTO cutovers(
      cutover_id,state,base_pointer_generation,base_generation_name,base_identity_hash,
      candidate_generation_name,candidate_identity_hash,sandbox_source_hash,package_hash,
      registry_generation,registry_hash,report_hash,corpus_report_hash,fidelity_budget_hash,
      environment_manifest_hash,rollback_proof_hash,proposal_hash,review_signature,dan_signature,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      proposal.cutoverId, 'STAGED', payload.basePointerGeneration,
      payload.baseProductionGenerationName, payload.baseProductionIdentityHash,
      proposal.candidateGenerationName, generation.generationHash, payload.sandboxSourceHash,
      payload.packageHash, payload.registryGeneration, payload.registryHash, payload.reportHash,
      payload.corpusReportHash, payload.fidelityBudgetHash, payload.environmentManifestHash,
      payload.rollbackExercise.proofHash, proposal.proposalHash, reviewSignature, danSignature,
      new Date().toISOString(),
    );
    project._db.exec('COMMIT');
  } catch (error) {
    try { project._db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

function verifyCandidateGeneration(project, row) {
  const generation = verifyGenerationByName(project, row.candidate_generation_name);
  if (generation.lane !== 'compiler-v2' || generation.generationHash !== row.candidate_identity_hash
    || generation.packageHash !== row.package_hash || generation.registryGeneration !== row.registry_generation
    || generation.registryHash !== row.registry_hash || generation.reportHash !== row.report_hash
    || generation.sourceHash !== row.sandbox_source_hash || generation.cutoverId !== row.cutover_id
    || generation.rollbackGenerationName !== row.base_generation_name
    || generation.rollbackIdentityHash !== row.base_identity_hash) throw new ProductionCutoverError('cutover generation/database identity drift');
  const root = realDirectory(fs.realpathSync(project.projectDir), confined(project.projectDir, `generations/${row.candidate_generation_name}`), 'production candidate generation');
  const cutover = readJson(realRegularFile(root, path.join(root, 'cutover.json'), 'production cutover record'), 'production cutover record');
  const payload = cutover.authorizationPayload;
  if (cutover.schemaVersion !== 1 || cutover.namespace !== NAMESPACE
    || cutover.proposalHash !== row.proposal_hash || payload?.cutoverId !== row.cutover_id
    || payload?.basePointerGeneration !== row.base_pointer_generation
    || payload?.baseProductionGenerationName !== row.base_generation_name
    || payload?.baseProductionIdentityHash !== row.base_identity_hash
    || payload?.candidateGenerationName !== row.candidate_generation_name
    || payload?.sandboxSourceHash !== row.sandbox_source_hash
    || payload?.packageHash !== row.package_hash || payload?.registryGeneration !== row.registry_generation
    || payload?.registryHash !== row.registry_hash || payload?.reportHash !== row.report_hash
    || payload?.corpusReportHash !== row.corpus_report_hash
    || payload?.fidelityBudgetHash !== row.fidelity_budget_hash
    || payload?.environmentManifestHash !== row.environment_manifest_hash
    || payload?.rollbackExercise?.proofHash !== row.rollback_proof_hash
    || cutover.reviewSignature !== row.review_signature || cutover.danSignature !== row.dan_signature
    || cutover.reviewSignatureHash !== sha256(Buffer.from(row.review_signature, 'base64'))
    || cutover.danSignatureHash !== sha256(Buffer.from(row.dan_signature, 'base64'))) throw new ProductionCutoverError('cutover authorization record drift');
  validateRollbackExercise(payload.rollbackExercise, payload);
  verifyAuthoritySignature(project._reviewKey, project.reviewAuthority.authorityId, payload, row.review_signature, 'review');
  verifyAuthoritySignature(project._danKey, project.danAuthority.authorityId, payload, row.dan_signature, 'Dan');
  const proposalBody = { schemaVersion: 1, cutoverId: row.cutover_id, candidateGenerationName: row.candidate_generation_name, authorizationPayload: payload };
  if (sha256(canonicalJson(proposalBody)) !== row.proposal_hash) throw new ProductionCutoverError('cutover proposal hash drift');
  return generation;
}

function verifyGenerationByName(project, generationName) {
  validateId(generationName, 'production generation name');
  const projectReal = fs.realpathSync(project.projectDir);
  const root = realDirectory(projectReal, confined(project.projectDir, `generations/${generationName}`), 'production generation');
  const generation = readJson(realRegularFile(root, path.join(root, 'generation.json'), 'production generation record'), 'production generation record');
  if (generation.schemaVersion !== 1 || generation.namespace !== NAMESPACE || generation.generationName !== generationName) throw new ProductionCutoverError('production generation record malformed');
  const { generationHash, ...body } = generation;
  if (!HASH.test(generationHash ?? '') || generationHash !== sha256(canonicalJson(body))) throw new ProductionCutoverError('production generation identity hash drift');
  if (generation.lane === 'legacy') {
    const expected = legacyGenerationRecord(project.initialLegacy);
    if (canonicalJson(generation) !== canonicalJson(expected)) throw new ProductionCutoverError('legacy rollback generation drift');
    return generation;
  }
  if (generation.lane !== 'compiler-v2') throw new ProductionCutoverError('production generation lane invalid');
  for (const key of ['packageHash', 'registryHash', 'reportHash', 'sourceHash', 'rollbackIdentityHash']) if (!HASH.test(generation[key] ?? '')) throw new ProductionCutoverError(`production generation ${key} malformed`);
  if (!Number.isInteger(generation.registryGeneration) || generation.registryGeneration < 0) throw new ProductionCutoverError('production registry generation malformed');
  const packageDir = realDirectory(root, path.join(root, 'package'), 'production package');
  const inventory = inventoryFromDisk(packageDir);
  if (sha256(canonicalJson(inventory)) !== generation.packageHash) throw new ProductionCutoverError('production package hash/inventory drift');
  const registry = readJson(realRegularFile(root, path.join(root, 'registry.json'), 'production registry'), 'production registry');
  if (registry.generation !== generation.registryGeneration || sha256(canonicalJson(registry)) !== generation.registryHash) throw new ProductionCutoverError('production registry hash/generation drift');
  const report = readJson(realRegularFile(root, path.join(root, 'report.json'), 'production report'), 'production report');
  validateReleaseReport(report);
  if (report.reportHash !== generation.reportHash) throw new ProductionCutoverError('production report hash drift');
  return generation;
}

function validateReleaseReport(report) {
  if (!report || report.schemaVersion !== 1 || report.state !== 'PROMOTABLE_VERIFIED'
    || !report.gates || Object.keys(report.gates).sort().join(',') !== [...GATES].sort().join(',')
    || GATES.some((gate) => report.gates[gate] !== 'VERIFIED') || !Array.isArray(report.blockers)
    || report.blockers.length) throw new ProductionCutoverError('production candidate report is not fully promotable');
  const { reportHash, ...body } = report;
  if (!HASH.test(reportHash ?? '') || reportHash !== sha256(canonicalJson(body))) throw new ProductionCutoverError('production candidate report hash drift');
  for (const key of ['corpusReportHash', 'fidelityBudgetHash', 'environmentManifestHash']) if (!HASH.test(report[key] ?? '')) throw new ProductionCutoverError(`production candidate ${key} malformed`);
}

function validateRollbackExercise(proof, payload) {
  if (!proof || proof.schemaVersion !== 1 || proof.method !== 'sqlite-pointer-cycle-v1'
    || proof.basePointerGeneration !== payload.basePointerGeneration
    || proof.activationPointerGeneration !== payload.basePointerGeneration + 1
    || proof.rollbackPointerGeneration !== payload.basePointerGeneration + 2
    || proof.baseGenerationName !== payload.baseProductionGenerationName
    || proof.baseIdentityHash !== payload.baseProductionIdentityHash
    || proof.candidateGenerationName !== payload.candidateGenerationName
    || proof.candidateIdentityHash !== candidateIdentityHash({
      candidateGenerationName: payload.candidateGenerationName,
      source: {
        packageHash: payload.packageHash,
        sandboxRegistryGeneration: payload.registryGeneration,
        sandboxRegistryHash: payload.registryHash,
        reportHash: payload.reportHash,
        sourceHash: payload.sandboxSourceHash,
      },
      cutoverId: payload.cutoverId,
      rollbackGenerationName: payload.baseProductionGenerationName,
      rollbackIdentityHash: payload.baseProductionIdentityHash,
    })
    || proof.sandboxSourceHash !== payload.sandboxSourceHash
    || proof.exactPriorIdentityRestored !== true) throw new ProductionCutoverError('rollback exercise proof malformed/drifted');
  const { proofHash, ...body } = proof;
  if (!HASH.test(proofHash ?? '') || proofHash !== sha256(canonicalJson(body))) throw new ProductionCutoverError('rollback exercise proof hash drift');
}

function candidateIdentityHash({ candidateGenerationName, source, cutoverId, rollbackGenerationName, rollbackIdentityHash }) {
  const body = candidateGenerationBody({
    candidateGenerationName,
    packageHash: source.packageHash,
    registryGeneration: source.sandboxRegistryGeneration,
    registryHash: source.sandboxRegistryHash,
    reportHash: source.reportHash,
    sourceHash: source.sourceHash,
    cutoverId,
    rollbackGenerationName,
    rollbackIdentityHash,
  });
  return sha256(canonicalJson(body));
}

function updatePointer(db, pointerGeneration, generation) {
  updatePointerTable(db, 'project_state', pointerGeneration, generation);
}

function updatePointerTable(db, table, pointerGeneration, generation) {
  if (!['project_state', 'pointer'].includes(table)) throw new ProductionCutoverError('pointer table invalid');
  db.prepare(`UPDATE ${table} SET pointer_generation=?,active_generation_name=?,active_lane=?,active_identity_hash=?,package_hash=?,registry_generation=?,registry_hash=?,report_hash=?,source_hash=?,cutover_id=? WHERE id=1`).run(
    pointerGeneration, generation.generationName, generation.lane, generation.generationHash,
    generation.packageHash ?? null, generation.registryGeneration ?? null, generation.registryHash ?? null,
    generation.reportHash ?? null, generation.sourceHash, generation.cutoverId ?? null,
  );
}

function stateFromGeneration(projectId, pointerGeneration, generation) {
  return {
    schemaVersion: 1,
    namespace: NAMESPACE,
    projectId,
    pointerGeneration,
    activeGenerationName: generation.generationName,
    activeLane: generation.lane,
    activeIdentityHash: generation.generationHash,
    packageHash: generation.packageHash ?? null,
    registryGeneration: generation.registryGeneration ?? null,
    registryHash: generation.registryHash ?? null,
    reportHash: generation.reportHash ?? null,
    sourceHash: generation.sourceHash,
    cutoverId: generation.cutoverId ?? null,
  };
}

function normalizedProjectRow(row, projectId = undefined) {
  if (!row) throw new ProductionCutoverError('production pointer missing');
  if (!Number.isSafeInteger(row.pointer_generation) || row.pointer_generation < 0
    || !ID.test(row.active_generation_name ?? '') || !['legacy', 'compiler-v2'].includes(row.active_lane)
    || !HASH.test(row.active_identity_hash ?? '') || !HASH.test(row.source_hash ?? '')) throw new ProductionCutoverError('production pointer fields malformed');
  return {
    schemaVersion: 1,
    namespace: NAMESPACE,
    projectId,
    pointerGeneration: row.pointer_generation,
    activeGenerationName: row.active_generation_name,
    activeLane: row.active_lane,
    activeIdentityHash: row.active_identity_hash,
    packageHash: row.package_hash ?? null,
    registryGeneration: row.registry_generation ?? null,
    registryHash: row.registry_hash ?? null,
    reportHash: row.report_hash ?? null,
    sourceHash: row.source_hash,
    cutoverId: row.cutover_id ?? null,
  };
}

function normalizedPointerExercise(row) {
  const state = normalizedProjectRow(row);
  delete state.schemaVersion;
  delete state.namespace;
  delete state.projectId;
  return state;
}

function projectRow(db) { return db.prepare('SELECT * FROM project_state WHERE id=1').get(); }
function cutoverRow(db, cutoverId) { return db.prepare('SELECT * FROM cutovers WHERE cutover_id=?').get(cutoverId); }

function normalizeAuthority(authority, label) {
  if (!authority || Object.keys(authority).sort().join(',') !== AUTHORITY_FIELDS
    || !ID.test(authority.authorityId ?? '') || typeof authority.publicKeyPem !== 'string') throw new ProductionCutoverError(`${label} authority must contain public verification fields only`);
  let key;
  try { key = createPublicKey(authority.publicKeyPem); }
  catch (error) { throw new ProductionCutoverError(`${label} public key malformed: ${error.message}`); }
  if (key.asymmetricKeyType !== 'ed25519') throw new ProductionCutoverError(`${label} authority requires an Ed25519 public key`);
  const der = key.export({ type: 'spki', format: 'der' });
  return {
    key,
    authorityId: authority.authorityId,
    publicKeyHash: sha256(der),
    public: {
      authorityId: authority.authorityId,
      publicKeyPem: key.export({ type: 'spki', format: 'pem' }).toString(),
      publicKeyHash: sha256(der),
    },
  };
}

function normalizeLegacy(legacy) {
  if (!legacy || Object.keys(legacy).sort().join(',') !== LEGACY_FIELDS
    || typeof legacy.route !== 'string' || !/^\/(?!\/)[^\s\\]*$/.test(legacy.route)
    || typeof legacy.version !== 'string' || !legacy.version
    || !HASH.test(legacy.artifactHash ?? '')) throw new ProductionCutoverError('initial legacy rollback identity malformed');
  return structuredClone(legacy);
}

function verifyAuthoritySignature(key, authorityId, payload, signature, label) {
  if (payload?.[`${label === 'Dan' ? 'dan' : 'review'}AuthorityId`] !== authorityId) throw new ProductionCutoverError(`${label} authority identity mismatch`);
  if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) throw new ProductionCutoverError(`${label} signature malformed`);
  if (!verifySignature(null, Buffer.from(canonicalJson(payload)), key, Buffer.from(signature, 'base64'))) throw new ProductionCutoverError(`${label} signature invalid`);
}

function ensureLegacyGeneration(generationsDir, legacy) {
  const target = path.join(generationsDir, LEGACY_GENERATION);
  if (!fs.existsSync(target)) {
    const stage = path.join(generationsDir, `.legacy-${randomUUID()}`);
    fs.mkdirSync(stage);
    try {
      writeDurable(path.join(stage, 'generation.json'), Buffer.from(canonicalJson(legacyGenerationRecord(legacy))));
      fsyncDirectory(stage);
      try { fs.renameSync(stage, target); }
      catch (error) {
        if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
      }
      fsyncDirectory(generationsDir);
    } finally { fs.rmSync(stage, { recursive: true, force: true }); }
  }
  const record = readJson(realRegularFile(fs.realpathSync(generationsDir), path.join(target, 'generation.json'), 'legacy generation record'), 'legacy generation record');
  const expected = legacyGenerationRecord(legacy);
  if (canonicalJson(record) !== canonicalJson(expected)) throw new ProductionCutoverError('legacy rollback generation mismatch');
  return record;
}

function legacyGenerationRecord(legacy) {
  const body = {
    schemaVersion: 1,
    namespace: NAMESPACE,
    generationName: LEGACY_GENERATION,
    lane: 'legacy',
    legacy,
    packageHash: null,
    registryGeneration: null,
    registryHash: null,
    reportHash: null,
    sourceHash: legacy.artifactHash,
    cutoverId: null,
  };
  return { ...body, generationHash: sha256(canonicalJson(body)) };
}

function ensureExactFile(file, expected, label) {
  if (!fs.existsSync(file)) {
    try { writeDurable(file, Buffer.from(canonicalJson(expected))); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const stat = lstat(file, label);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new ProductionCutoverError(`${label} invalid/symlinked`);
  if (canonicalJson(readJson(file, label)) !== canonicalJson(expected)) throw new ProductionCutoverError(`${label} authority/legacy mismatch`);
}

function assertProject(project) {
  if (!project || project.schemaVersion !== 1 || project.namespace !== NAMESPACE || project.closed || !project._db) throw new ProductionCutoverError('production project handle invalid/closed');
  assertTopology(project);
}

function assertTopology(project) {
  const rootReal = fs.realpathSync(project.rootDir);
  const projectReal = fs.realpathSync(project.projectDir);
  if (projectReal !== project.projectDir || !within(rootReal, projectReal)) throw new ProductionCutoverError('production project topology drift');
  for (const [label, dir] of [['generations', project.generationsDir], ['staging', project.stagingDir]]) {
    const stat = lstat(dir, `production ${label}`);
    if (stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync(dir) !== dir || !within(projectReal, dir)) throw new ProductionCutoverError(`production ${label} topology invalid/symlinked`);
  }
  const dbStat = lstat(project._dbPath, 'production database');
  if (dbStat.isSymbolicLink() || !dbStat.isFile() || !within(projectReal, fs.realpathSync(project._dbPath))) throw new ProductionCutoverError('production database topology invalid/symlinked');
}

function inventoryFromDisk(root) {
  const rows = [];
  const pending = [''];
  while (pending.length) {
    const relDir = pending.pop();
    const absDir = relDir ? path.join(root, relDir) : root;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const relative = relDir ? `${relDir}/${entry.name}` : entry.name;
      safeRelative(relative, 'production package path');
      const absolute = path.join(root, relative);
      if (entry.isSymbolicLink()) throw new ProductionCutoverError(`production package symlink forbidden: ${relative}`);
      if (entry.isDirectory()) pending.push(relative);
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(absolute);
        rows.push([relative, { sha256: sha256(bytes), bytes: bytes.length }]);
      } else throw new ProductionCutoverError(`production package entry type forbidden: ${relative}`);
    }
  }
  return Object.fromEntries(rows.sort(([a], [b]) => a.localeCompare(b)));
}

function fsyncDirectoryTree(root) {
  const directories = [root];
  for (let index = 0; index < directories.length; index++) {
    const dir = directories[index];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new ProductionCutoverError(`staged production symlink forbidden: ${path.join(dir, entry.name)}`);
      if (entry.isDirectory()) directories.push(path.join(dir, entry.name));
    }
  }
  for (const dir of directories.reverse()) fsyncDirectory(dir);
}

function fsyncDirectory(dir) {
  const fd = fs.openSync(dir, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function writeDurable(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'wx');
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new ProductionCutoverError(`${label} unreadable: ${error.message}`); }
}

function confined(root, relative) {
  safeRelative(relative, 'production path');
  const target = path.resolve(root, relative);
  if (!within(path.resolve(root), target)) throw new ProductionCutoverError(`production path escapes: ${relative}`);
  return target;
}

function realRegularFile(rootReal, candidate, label) {
  const stat = lstat(candidate, label);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new ProductionCutoverError(`${label} invalid/symlinked`);
  const real = fs.realpathSync(candidate);
  if (!within(rootReal, real)) throw new ProductionCutoverError(`${label} resolves outside production store`);
  return real;
}

function realDirectory(rootReal, candidate, label) {
  const stat = lstat(candidate, label);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new ProductionCutoverError(`${label} invalid/symlinked`);
  const real = fs.realpathSync(candidate);
  if (!within(rootReal, real)) throw new ProductionCutoverError(`${label} resolves outside production store`);
  return real;
}

function lstat(candidate, label) {
  try { return fs.lstatSync(candidate); }
  catch (error) { throw new ProductionCutoverError(`${label} missing: ${error.message}`); }
}

function safeRelative(value, label) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.isAbsolute(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..')) throw new ProductionCutoverError(`${label} invalid: ${value}`);
}

function validateId(value, label) {
  if (!ID.test(value ?? '')) throw new ProductionCutoverError(`${label} invalid`);
}

const within = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);
const derivedCutoverId = (pointerGeneration, sourceHash) => `cutover-${pointerGeneration + 1}-${sourceHash.slice(0, 48)}`;
const derivedGenerationName = (pointerGeneration, sourceHash) => `g-${pointerGeneration + 1}-${sourceHash.slice(0, 48)}`;
