/** P8 v2-sandbox registry/package transaction kernel. Never touches or activates legacy. */
import {
  createPublicKey, randomUUID, verify as verifySignature,
} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonicalJson, sha256 } from './evidence.mjs';
import { STATES } from './schema.mjs';
import { validateRegistry } from './token-registry.mjs';

const NAMESPACE = 'compiler-v2-sandbox-v1';
const HASH = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const GATES = Object.freeze(Array.from({ length: 14 }, (_, index) => `G${index}`));
const GATE_STATES = Object.freeze(['VERIFIED', 'FAILED', 'DIAGNOSTIC_ONLY']);
const INITIAL_REGISTRY = Object.freeze({ schemaVersion: 1, generation: 0, entries: {} });
const INITIAL_REGISTRY_HASH = sha256(canonicalJson(INITIAL_REGISTRY));

export class SandboxStoreError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_STATIC'; }
}

export function openSandboxProject({ rootDir, projectId, promotionAuthority }) {
  if (typeof rootDir !== 'string' || !path.isAbsolute(rootDir)) throw new SandboxStoreError('sandbox root must be absolute');
  if (!ID.test(projectId ?? '')) throw new SandboxStoreError('sandbox project id invalid');
  validateAuthority(promotionAuthority);
  fs.mkdirSync(rootDir, { recursive: true });
  const rootReal = fs.realpathSync(rootDir);
  const namespaceDir = path.join(rootReal, NAMESPACE);
  const projectsDir = path.join(namespaceDir, 'projects');
  const projectDir = path.join(projectsDir, projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  const projectReal = fs.realpathSync(projectDir);
  if (!within(rootReal, projectReal)) throw new SandboxStoreError('sandbox project escapes root');
  const generationsDir = path.join(projectReal, 'generations');
  const stagingDir = path.join(projectReal, 'staging');
  for (const dir of [generationsDir, stagingDir]) fs.mkdirSync(dir, { recursive: true });

  const publicKey = createPublicKey(promotionAuthority.publicKeyPem);
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  const authority = {
    authorityId: promotionAuthority.authorityId,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    publicKeyHash: sha256(publicKeyDer),
  };
  const projectFile = path.join(projectReal, 'project.json');
  const expectedProject = { schemaVersion: 1, namespace: NAMESPACE, projectId, promotionAuthorityId: authority.authorityId, promotionPublicKeyHash: authority.publicKeyHash };
  ensureProjectMetadata(projectFile, expectedProject);

  const dbPath = path.join(projectReal, 'state.sqlite');
  if (fs.existsSync(dbPath) && fs.lstatSync(dbPath).isSymbolicLink()) throw new SandboxStoreError('sandbox database symlink forbidden');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout=5000;');
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_state (
      id INTEGER PRIMARY KEY CHECK (id = 1), generation INTEGER NOT NULL,
      registry_generation INTEGER NOT NULL, registry_hash TEXT NOT NULL,
      package_hash TEXT, generation_name TEXT,
      report_hash TEXT, receipt_hash TEXT
    ) STRICT;
    CREATE TABLE IF NOT EXISTS candidates (
      transaction_id TEXT PRIMARY KEY, state TEXT NOT NULL,
      base_generation INTEGER NOT NULL, base_registry_generation INTEGER NOT NULL,
      base_registry_hash TEXT NOT NULL,
      candidate_registry_hash TEXT NOT NULL, package_hash TEXT NOT NULL,
      report_hash TEXT NOT NULL, report_state TEXT NOT NULL,
      generation_name TEXT NOT NULL, receipt_hash TEXT, created_at TEXT NOT NULL
    ) STRICT;
    INSERT OR IGNORE INTO project_state(id, generation, registry_generation, registry_hash) VALUES (1, 0, 0, '${INITIAL_REGISTRY_HASH}');
  `);
  let closed = false;
  return Object.freeze({
    schemaVersion: 1,
    namespace: NAMESPACE,
    projectId,
    rootDir: rootReal,
    projectDir: projectReal,
    generationsDir,
    stagingDir,
    promotionAuthority: Object.freeze(authority),
    _db: db,
    _dbPath: dbPath,
    _publicKey: publicKey,
    get closed() { return closed; },
    close() { if (!closed) { db.close(); closed = true; } },
  });
}

export function buildCandidateProposal(project, input) {
  assertProject(project);
  const current = readSandboxProject(project);
  return deriveProposal(project, {
    ...input,
    baseGeneration: current.generation,
    baseRegistryGeneration: current.registryGeneration,
    baseRegistryHash: current.registryHash,
  });
}

export async function stageSandboxCandidate(project, { proposal, promotionSignature }) {
  assertProject(project);
  const derived = deriveProposal(project, proposal);
  if (canonicalJson(proposal.receiptPayload) !== canonicalJson(derived.receiptPayload)
    || proposal.proposalHash !== derived.proposalHash) throw new SandboxStoreError('candidate proposal/receipt drift');
  let receiptHash = null;
  if (promotionSignature !== null && promotionSignature !== undefined) {
    verifyPromotionSignature(project, derived.receiptPayload, promotionSignature);
    receiptHash = sha256(Buffer.from(promotionSignature, 'base64'));
  }
  const db = project._db;
  if (candidateRow(db, derived.transactionId)) throw new SandboxStoreError(`candidate transaction already exists: ${derived.transactionId}`);
  const stageDir = confined(project.projectDir, `staging/${derived.transactionId}-${randomUUID()}`);
  const generationDir = confined(project.projectDir, `generations/${derived.generationName}`);
  if (fs.existsSync(generationDir)) throw new SandboxStoreError(`candidate generation already exists: ${derived.generationName}`);
  fs.mkdirSync(path.join(stageDir, 'package'), { recursive: true });
  let generationOwned = false;
  try {
    writeDurable(path.join(stageDir, 'registry.json'), Buffer.from(canonicalJson(derived.registry)));
    writeDurable(path.join(stageDir, 'report.json'), Buffer.from(canonicalJson(derived.report)));
    for (const [name, content] of Object.entries(derived.packageFiles)) {
      const target = confined(path.join(stageDir, 'package'), name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      writeDurable(target, bytesOf(content, `package file ${name}`));
    }
    const candidateRecord = persistedCandidate(derived, promotionSignature ?? null, receiptHash);
    writeDurable(path.join(stageDir, 'candidate.json'), Buffer.from(canonicalJson(candidateRecord)));
    fsyncDirectoryTree(stageDir);
    assertTopology(project);
    fs.renameSync(stageDir, generationDir);
    generationOwned = true;
    fsyncDirectory(project.generationsDir);
    fsyncDirectory(project.stagingDir);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`INSERT INTO candidates(
        transaction_id,state,base_generation,base_registry_generation,base_registry_hash,candidate_registry_hash,
        package_hash,report_hash,report_state,generation_name,receipt_hash,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        derived.transactionId, 'STAGED', derived.baseGeneration, derived.baseRegistryGeneration, derived.baseRegistryHash,
        derived.candidateRegistryHash, derived.packageHash, derived.report.reportHash,
        derived.report.state, derived.generationName, receiptHash, new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } catch (error) {
    fs.rmSync(stageDir, { recursive: true, force: true });
    if (generationOwned && !candidateRow(db, derived.transactionId)) fs.rmSync(generationDir, { recursive: true, force: true });
    throw error instanceof SandboxStoreError ? error : new SandboxStoreError(`candidate staging failed: ${error.message}`);
  }
  return { ...readCandidateStatus(project, derived.transactionId), generationDir };
}

export function commitSandboxCandidate(project, transactionId, { inject = null } = {}) {
  assertProject(project);
  if (!ID.test(transactionId ?? '')) throw new SandboxStoreError('candidate transaction id invalid');
  const db = project._db;
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = candidateRow(db, transactionId);
    if (!row) throw new SandboxStoreError(`candidate ${transactionId} missing`);
    if (row.state !== 'STAGED') throw new SandboxStoreError(`candidate ${transactionId} is ${row.state}`);
    const current = projectRow(db);
    if (current.generation !== row.base_generation || current.registry_generation !== verifiedRegistryBase(row)
      || current.registry_hash !== row.base_registry_hash) throw new SandboxStoreError('candidate base generation/hash conflict; rebase and revalidate — last-write-wins forbidden');
    const verified = verifyGeneration(project, row);
    if (verified.report.state !== 'PROMOTABLE_VERIFIED') throw new SandboxStoreError(`candidate report state ${verified.report.state} is not promotable`);
    assertAllGates(verified.report);
    if (verified.report.blockers.length) throw new SandboxStoreError('candidate has unresolved blockers and is not promotable');
    if (!verified.record.promotionSignature) throw new SandboxStoreError('candidate promotion signature missing');
    verifyPromotionSignature(project, verified.record.receiptPayload, verified.record.promotionSignature);
    if (inject === 'after-verification') throw new SandboxStoreError('injected crash after verification');
    db.prepare(`UPDATE project_state SET generation=?, registry_generation=?, registry_hash=?, package_hash=?, generation_name=?, report_hash=?, receipt_hash=? WHERE id=1`).run(
      current.generation + 1, verified.registry.generation, row.candidate_registry_hash, row.package_hash, row.generation_name,
      row.report_hash, row.receipt_hash,
    );
    db.prepare('UPDATE candidates SET state=? WHERE transaction_id=?').run('PROMOTED', transactionId);
    if (inject === 'after-pointer-update') throw new SandboxStoreError('injected crash after pointer update');
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error instanceof SandboxStoreError ? error : new SandboxStoreError(`sandbox commit failed: ${error.message}`);
  }
  return readSandboxProject(project);
}

export function cancelSandboxCandidate(project, transactionId) {
  assertProject(project);
  const db = project._db;
  db.exec('BEGIN IMMEDIATE');
  let generationName;
  try {
    const row = candidateRow(db, transactionId);
    if (!row) throw new SandboxStoreError(`candidate ${transactionId} missing`);
    if (row.state !== 'STAGED') throw new SandboxStoreError(`candidate ${transactionId} is ${row.state}`);
    generationName = row.generation_name;
    db.prepare('UPDATE candidates SET state=? WHERE transaction_id=?').run('CANCELLED', transactionId);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error instanceof SandboxStoreError ? error : new SandboxStoreError(`sandbox cancel failed: ${error.message}`);
  }
  fs.rmSync(confined(project.projectDir, `generations/${generationName}`), { recursive: true, force: true });
  return readCandidateStatus(project, transactionId);
}

export function readSandboxProject(project) {
  assertProject(project);
  const row = projectRow(project._db);
  const status = normalizeProjectRow(row);
  if (status.generation === 0) {
    if (status.registryGeneration !== 0 || status.registryHash !== INITIAL_REGISTRY_HASH || status.generationName !== null || status.packageHash !== null) throw new SandboxStoreError('initial sandbox project pointer malformed');
  } else {
    const candidate = project._db.prepare('SELECT * FROM candidates WHERE generation_name=? AND state=?').get(status.generationName, 'PROMOTED');
    if (!candidate) throw new SandboxStoreError('sandbox pointer lacks a promoted candidate');
    const verified = verifyGeneration(project, candidate);
    if (verified.candidateRegistryHash !== status.registryHash || verified.packageHash !== status.packageHash || verified.report.reportHash !== status.reportHash) throw new SandboxStoreError('sandbox pointer disagrees with referenced generation');
  }
  return status;
}

export function readCandidateStatus(project, transactionId) {
  assertProject(project);
  const row = candidateRow(project._db, transactionId);
  if (!row) throw new SandboxStoreError(`candidate ${transactionId} missing`);
  let receiptVerified = false;
  if (row.state !== 'CANCELLED') {
    const verified = verifyGeneration(project, row);
    if (verified.record.promotionSignature) {
      try { verifyPromotionSignature(project, verified.record.receiptPayload, verified.record.promotionSignature); receiptVerified = true; }
      catch { receiptVerified = false; }
    }
  }
  const current = projectRow(project._db);
  return {
    schemaVersion: 1,
    transactionId: row.transaction_id,
    state: row.state,
    reportState: row.report_state,
    baseGeneration: row.base_generation,
    baseRegistryGeneration: verifiedRegistryBase(row),
    baseRegistryHash: row.base_registry_hash,
    candidateRegistryHash: row.candidate_registry_hash,
    packageHash: row.package_hash,
    reportHash: row.report_hash,
    generationName: row.generation_name,
    promotionReceiptVerified: receiptVerified,
    canPromote: row.state === 'STAGED' && row.report_state === 'PROMOTABLE_VERIFIED' && receiptVerified
      && current.generation === row.base_generation && current.registry_generation === verifiedRegistryBase(row)
      && current.registry_hash === row.base_registry_hash,
  };
}

export function recoverSandboxProject(project) {
  assertProject(project);
  const state = readSandboxProject(project);
  const cancelled = project._db.prepare('SELECT generation_name FROM candidates WHERE state=?').all('CANCELLED');
  for (const row of cancelled) fs.rmSync(confined(project.projectDir, `generations/${row.generation_name}`), { recursive: true, force: true });
  const candidates = project._db.prepare('SELECT transaction_id FROM candidates ORDER BY transaction_id').all()
    .map((row) => readCandidateStatus(project, row.transaction_id));
  return { schemaVersion: 1, project: state, candidates };
}

export function buildDualRunView(project, legacy, transactionId) {
  assertProject(project);
  if (legacy?.operating !== true || typeof legacy.route !== 'string' || !legacy.route.startsWith('/') || !legacy.version) throw new SandboxStoreError('legacy operating-lane identity malformed');
  const candidate = readCandidateStatus(project, transactionId);
  return {
    schemaVersion: 1,
    productionLane: 'legacy',
    legacy: { lane: 'legacy', operating: true, route: legacy.route, version: legacy.version, untouched: true },
    v2: {
      lane: 'compiler-v2-sandbox',
      transactionId,
      terminalState: candidate.reportState,
      transactionState: candidate.state,
      canPromote: candidate.canPromote,
      promotionReceiptVerified: candidate.promotionReceiptVerified,
      packageHash: candidate.packageHash,
      reportHash: candidate.reportHash,
    },
  };
}

function deriveProposal(project, input) {
  if (!input || typeof input !== 'object' || !ID.test(input.transactionId ?? '')) throw new SandboxStoreError('candidate transaction id invalid');
  if (!Number.isInteger(input.baseGeneration) || input.baseGeneration < 0
    || !Number.isInteger(input.baseRegistryGeneration) || input.baseRegistryGeneration < 0
    || !HASH.test(input.baseRegistryHash ?? '')) throw new SandboxStoreError('candidate base identity malformed');
  validateRegistry(input.registry);
  const report = validateReport(input.report);
  const packageFiles = validatePackageFiles(input.packageFiles);
  const packageInventory = inventoryOf(packageFiles);
  const candidateRegistryHash = sha256(canonicalJson(input.registry));
  const registryChanged = candidateRegistryHash !== input.baseRegistryHash;
  const expectedRegistryGeneration = input.baseRegistryGeneration + (registryChanged ? 1 : 0);
  if (input.registry.generation !== expectedRegistryGeneration) throw new SandboxStoreError('candidate registry generation disagrees with base hash/change');
  const packageHash = sha256(canonicalJson(packageInventory));
  const generationName = `g-${input.baseGeneration + 1}-${input.transactionId}`;
  const receiptPayload = {
    schemaVersion: 1,
    namespace: NAMESPACE,
    authorityId: project.promotionAuthority.authorityId,
    projectId: project.projectId,
    transactionId: input.transactionId,
    generationName,
    baseGeneration: input.baseGeneration,
    baseRegistryGeneration: input.baseRegistryGeneration,
    baseRegistryHash: input.baseRegistryHash,
    candidateRegistryHash,
    packageHash,
    reportHash: report.reportHash,
    corpusReportHash: report.corpusReportHash,
    fidelityBudgetHash: report.fidelityBudgetHash,
    environmentManifestHash: report.environmentManifestHash,
    state: report.state,
  };
  const proposalBody = {
    schemaVersion: 1,
    transactionId: input.transactionId,
    baseGeneration: input.baseGeneration,
    baseRegistryGeneration: input.baseRegistryGeneration,
    baseRegistryHash: input.baseRegistryHash,
    registry: input.registry,
    packageInventory,
    report,
    candidateRegistryHash,
    packageHash,
    generationName,
    receiptPayload,
  };
  return {
    ...structuredClone(proposalBody),
    packageFiles: structuredClone(packageFiles),
    proposalHash: sha256(canonicalJson(proposalBody)),
  };
}

function persistedCandidate(proposal, promotionSignature, receiptHash) {
  return {
    schemaVersion: 1,
    namespace: NAMESPACE,
    proposalHash: proposal.proposalHash,
    transactionId: proposal.transactionId,
    baseGeneration: proposal.baseGeneration,
    baseRegistryGeneration: proposal.baseRegistryGeneration,
    baseRegistryHash: proposal.baseRegistryHash,
    candidateRegistryHash: proposal.candidateRegistryHash,
    packageHash: proposal.packageHash,
    packageInventory: proposal.packageInventory,
    reportHash: proposal.report.reportHash,
    generationName: proposal.generationName,
    receiptPayload: proposal.receiptPayload,
    promotionSignature,
    receiptHash,
  };
}

function verifyGeneration(project, row) {
  const generationDir = confined(project.projectDir, `generations/${row.generation_name}`);
  const projectReal = fs.realpathSync(project.projectDir);
  const generationReal = realDirectory(projectReal, generationDir, 'candidate generation');
  const record = readJson(realRegularFile(generationReal, path.join(generationReal, 'candidate.json'), 'candidate record'), 'candidate record');
  const registry = readJson(realRegularFile(generationReal, path.join(generationReal, 'registry.json'), 'candidate registry'), 'candidate registry');
  const report = readJson(realRegularFile(generationReal, path.join(generationReal, 'report.json'), 'candidate report'), 'candidate report');
  validateRegistry(registry);
  validateReport(report);
  const packageDir = realDirectory(generationReal, path.join(generationReal, 'package'), 'candidate package');
  const inventory = inventoryFromDisk(packageDir);
  const candidateRegistryHash = sha256(canonicalJson(registry));
  const packageHash = sha256(canonicalJson(inventory));
  if (candidateRegistryHash !== row.candidate_registry_hash || packageHash !== row.package_hash
    || report.reportHash !== row.report_hash || record.transactionId !== row.transaction_id
    || record.generationName !== row.generation_name || record.candidateRegistryHash !== candidateRegistryHash
    || record.packageHash !== packageHash || record.reportHash !== report.reportHash
    || canonicalJson(record.packageInventory) !== canonicalJson(inventory)) throw new SandboxStoreError('candidate generation hash/inventory drift');
  const expectedReceipt = {
    schemaVersion: 1, namespace: NAMESPACE, authorityId: project.promotionAuthority.authorityId,
    projectId: project.projectId, transactionId: row.transaction_id, generationName: row.generation_name,
    baseGeneration: row.base_generation, baseRegistryHash: row.base_registry_hash,
    baseRegistryGeneration: verifiedRegistryBase(row),
    candidateRegistryHash, packageHash, reportHash: report.reportHash,
    corpusReportHash: report.corpusReportHash, fidelityBudgetHash: report.fidelityBudgetHash,
    environmentManifestHash: report.environmentManifestHash, state: report.state,
  };
  if (record.receiptHash !== row.receipt_hash || (record.promotionSignature ? sha256(Buffer.from(record.promotionSignature, 'base64')) : null) !== row.receipt_hash) throw new SandboxStoreError('candidate receipt hash drift');
  const proposalBody = {
    schemaVersion: 1,
    transactionId: row.transaction_id,
    baseGeneration: row.base_generation,
    baseRegistryGeneration: verifiedRegistryBase(row),
    baseRegistryHash: row.base_registry_hash,
    registry,
    packageInventory: inventory,
    report,
    candidateRegistryHash,
    packageHash,
    generationName: row.generation_name,
    receiptPayload: expectedReceipt,
  };
  const expectedRecord = {
    schemaVersion: 1,
    namespace: NAMESPACE,
    proposalHash: sha256(canonicalJson(proposalBody)),
    transactionId: row.transaction_id,
    baseGeneration: row.base_generation,
    baseRegistryGeneration: verifiedRegistryBase(row),
    baseRegistryHash: row.base_registry_hash,
    candidateRegistryHash,
    packageHash,
    packageInventory: inventory,
    reportHash: report.reportHash,
    generationName: row.generation_name,
    receiptPayload: expectedReceipt,
    promotionSignature: record.promotionSignature,
    receiptHash: row.receipt_hash,
  };
  if (canonicalJson(record) !== canonicalJson(expectedRecord)) throw new SandboxStoreError('candidate record/proposal derivation drift');
  if (report.state !== row.report_state) throw new SandboxStoreError('candidate report state disagrees with transaction');
  return { generationDir, record, registry, report, candidateRegistryHash, packageHash };
}

function verifyPromotionSignature(project, payload, signature) {
  if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) throw new SandboxStoreError('promotion signature malformed');
  if (payload?.authorityId !== project.promotionAuthority.authorityId || payload?.projectId !== project.projectId || payload?.namespace !== NAMESPACE) throw new SandboxStoreError('promotion receipt authority/project mismatch');
  if (!verifySignature(null, Buffer.from(canonicalJson(payload)), project._publicKey, Buffer.from(signature, 'base64'))) throw new SandboxStoreError('promotion signature invalid');
}

function validateReport(report) {
  if (!report || report.schemaVersion !== 1 || !STATES.includes(report.state) || !Array.isArray(report.blockers)
    || !report.gates || typeof report.gates !== 'object' || Array.isArray(report.gates)) throw new SandboxStoreError('candidate report malformed');
  const { reportHash, ...body } = report;
  if (!HASH.test(reportHash ?? '') || reportHash !== sha256(canonicalJson(body))) throw new SandboxStoreError('candidate report hash drift');
  for (const key of ['corpusReportHash', 'fidelityBudgetHash', 'environmentManifestHash']) if (!HASH.test(report[key] ?? '')) throw new SandboxStoreError(`candidate report ${key} missing`);
  if (Object.keys(report.gates).sort().join(',') !== [...GATES].sort().join(',')) throw new SandboxStoreError('candidate report gate census malformed');
  for (const [gate, state] of Object.entries(report.gates)) if (!GATE_STATES.includes(state)) throw new SandboxStoreError(`candidate report gate ${gate} state invalid`);
  if (!report.blockers.every((blocker) => typeof blocker === 'string' && blocker.length > 0)
    || new Set(report.blockers).size !== report.blockers.length) throw new SandboxStoreError('candidate report blockers malformed/duplicated');
  return structuredClone(report);
}

function assertAllGates(report) {
  for (const gate of GATES) if (report.gates[gate] !== 'VERIFIED') throw new SandboxStoreError(`candidate ${gate} is not VERIFIED`);
}

function validatePackageFiles(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files) || !Object.keys(files).length) throw new SandboxStoreError('candidate package files missing');
  const out = {};
  for (const [name, content] of Object.entries(files)) {
    safeRelative(name, 'candidate package path');
    out[name] = bytesOf(content, `package file ${name}`);
  }
  return out;
}

function inventoryOf(files) {
  return Object.fromEntries(Object.entries(files).sort().map(([name, content]) => {
    const bytes = bytesOf(content, `package file ${name}`);
    return [name, { sha256: sha256(bytes), bytes: bytes.length }];
  }));
}

function inventoryFromDisk(root) {
  const rows = [];
  const pending = [''];
  while (pending.length) {
    const relDir = pending.pop();
    const absDir = relDir ? path.join(root, relDir) : root;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      safeRelative(rel, 'persisted package path');
      const abs = path.join(root, rel);
      if (entry.isSymbolicLink()) throw new SandboxStoreError(`persisted package symlink forbidden: ${rel}`);
      if (entry.isDirectory()) pending.push(rel);
      else if (entry.isFile()) rows.push([rel, fs.readFileSync(abs)]);
      else throw new SandboxStoreError(`persisted package entry type forbidden: ${rel}`);
    }
  }
  return inventoryOf(Object.fromEntries(rows));
}

function projectRow(db) {
  const row = db.prepare('SELECT * FROM project_state WHERE id=1').get();
  if (!row) throw new SandboxStoreError('sandbox project pointer missing');
  return row;
}

function normalizeProjectRow(row) {
  return {
    schemaVersion: 1,
    generation: row.generation,
    registryGeneration: row.registry_generation,
    registryHash: row.registry_hash,
    packageHash: row.package_hash ?? null,
    generationName: row.generation_name ?? null,
    reportHash: row.report_hash ?? null,
    receiptHash: row.receipt_hash ?? null,
  };
}

const candidateRow = (db, transactionId) => db.prepare('SELECT * FROM candidates WHERE transaction_id=?').get(transactionId);
const verifiedRegistryBase = (row) => {
  const record = row?.base_registry_generation;
  if (!Number.isInteger(record)) throw new SandboxStoreError('candidate base registry generation missing');
  return record;
};

function validateAuthority(authority) {
  if (!authority || !ID.test(authority.authorityId ?? '') || typeof authority.publicKeyPem !== 'string') throw new SandboxStoreError('promotion authority malformed');
  let key;
  try { key = createPublicKey(authority.publicKeyPem); }
  catch (error) { throw new SandboxStoreError(`promotion public key malformed: ${error.message}`); }
  if (key.asymmetricKeyType !== 'ed25519') throw new SandboxStoreError('promotion authority requires an Ed25519 public key');
}

function assertProject(project) {
  if (!project || project.schemaVersion !== 1 || project.namespace !== NAMESPACE || project.closed || !project._db) throw new SandboxStoreError('sandbox project handle invalid/closed');
  assertTopology(project);
}

function assertTopology(project) {
  const rootReal = fs.realpathSync(project.rootDir);
  const projectReal = fs.realpathSync(project.projectDir);
  if (projectReal !== project.projectDir || !within(rootReal, projectReal)) throw new SandboxStoreError('sandbox project topology drift');
  for (const [label, dir] of [['generations', project.generationsDir], ['staging', project.stagingDir]]) {
    let stat;
    try { stat = fs.lstatSync(dir); }
    catch (error) { throw new SandboxStoreError(`sandbox ${label} topology missing: ${error.message}`); }
    if (stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync(dir) !== dir || !within(projectReal, dir)) throw new SandboxStoreError(`sandbox ${label} topology invalid/symlinked`);
  }
  let dbStat;
  try { dbStat = fs.lstatSync(project._dbPath); }
  catch (error) { throw new SandboxStoreError(`sandbox database topology missing: ${error.message}`); }
  if (dbStat.isSymbolicLink() || !dbStat.isFile() || !within(projectReal, fs.realpathSync(project._dbPath))) throw new SandboxStoreError('sandbox database topology invalid/symlinked');
}

function writeDurable(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'wx');
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}

function ensureProjectMetadata(file, expected) {
  if (!fs.existsSync(file)) {
    try { writeDurable(file, Buffer.from(canonicalJson(expected))); }
    catch (error) { if (error?.code !== 'EEXIST') throw error; }
  }
  const stat = lstat(file, 'sandbox project metadata');
  if (stat.isSymbolicLink() || !stat.isFile()) throw new SandboxStoreError('sandbox project metadata invalid/symlinked');
  const current = readJson(file, 'sandbox project metadata');
  if (canonicalJson(current) !== canonicalJson(expected)) throw new SandboxStoreError('sandbox promotion authority mismatch');
}

function fsyncDirectoryTree(root) {
  const directories = [root];
  for (let index = 0; index < directories.length; index++) {
    const dir = directories[index];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new SandboxStoreError(`staged package symlink forbidden: ${path.join(dir, entry.name)}`);
      if (entry.isDirectory()) directories.push(path.join(dir, entry.name));
    }
  }
  for (const dir of directories.reverse()) fsyncDirectory(dir);
}

function fsyncDirectory(dir) {
  const fd = fs.openSync(dir, 'r');
  try { fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}

function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new SandboxStoreError(`${label} unreadable: ${error.message}`); }
}

function confined(root, relative) {
  safeRelative(relative, 'sandbox path');
  const target = path.resolve(root, relative);
  if (!within(path.resolve(root), target)) throw new SandboxStoreError(`sandbox path escapes: ${relative}`);
  return target;
}

function realConfined(rootReal, candidate, label) {
  let real;
  try { real = fs.realpathSync(candidate); }
  catch (error) { throw new SandboxStoreError(`${label} missing: ${error.message}`); }
  if (!within(rootReal, real)) throw new SandboxStoreError(`${label} resolves outside sandbox`);
  return real;
}

function realRegularFile(rootReal, candidate, label) {
  const stat = lstat(candidate, label);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new SandboxStoreError(`${label} invalid/symlinked`);
  return realConfined(rootReal, candidate, label);
}

function realDirectory(rootReal, candidate, label) {
  const stat = lstat(candidate, label);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new SandboxStoreError(`${label} invalid/symlinked`);
  return realConfined(rootReal, candidate, label);
}

function lstat(candidate, label) {
  try { return fs.lstatSync(candidate); }
  catch (error) { throw new SandboxStoreError(`${label} missing: ${error.message}`); }
}

function safeRelative(value, label) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.isAbsolute(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..')) throw new SandboxStoreError(`${label} invalid: ${value}`);
}

function bytesOf(value, label) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') return Buffer.from(value);
  throw new SandboxStoreError(`${label} is not byte content`);
}

const within = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);
