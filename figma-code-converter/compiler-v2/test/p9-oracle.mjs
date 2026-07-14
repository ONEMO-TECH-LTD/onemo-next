/** Independent P9 production-pointer oracle. It imports no production cutover code. */
import { createPublicKey, verify as verifySignature } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const NAMESPACE = 'compiler-v2-production-v1';
const HASH = /^[0-9a-f]{64}$/;
const GATES = Object.freeze(Array.from({ length: 14 }, (_, index) => `G${index}`));

export function p9Failures({ projectDir, reviewPublicKeyPem, danPublicKeyPem }) {
  const failures = [];
  try {
    const projectRoot = realDirectory(projectDir, projectDir, 'project', failures);
    const generationsDir = realDirectory(projectRoot, path.join(projectRoot, 'generations'), 'generations', failures);
    const project = readJson(realFile(projectRoot, path.join(projectRoot, 'project.json'), 'project metadata', failures), 'project metadata', failures);
    const reviewKey = authorityKey(reviewPublicKeyPem, project?.reviewAuthorityId, project?.reviewPublicKeyHash, 'review', failures);
    const danKey = authorityKey(danPublicKeyPem, project?.danAuthorityId, project?.danPublicKeyHash, 'Dan', failures);
    if (project?.schemaVersion !== 1 || project?.namespace !== NAMESPACE || !project?.projectId) failures.push('project metadata identity malformed');
    if (project?.reviewAuthorityId === project?.danAuthorityId || project?.reviewPublicKeyHash === project?.danPublicKeyHash) failures.push('authorities are not distinct');

    const dbFile = realFile(projectRoot, path.join(projectRoot, 'state.sqlite'), 'database', failures);
    if (!dbFile) return unique(failures);
    const db = new DatabaseSync(dbFile, { readOnly: true });
    try {
      const state = db.prepare('SELECT * FROM project_state WHERE id=1').get();
      if (!state) failures.push('project pointer missing');
      else {
        const active = verifyGeneration(generationsDir, state.active_generation_name, project, failures);
        if (active) comparePointer(state, active, failures);
      }
      const rows = db.prepare('SELECT * FROM cutovers ORDER BY cutover_id').all();
      for (const row of rows) verifyCutover(row, state, generationsDir, project, reviewKey, danKey, failures);
      if (state?.active_lane === 'compiler-v2') {
        const activeRows = rows.filter((row) => row.state === 'ACTIVE' && row.cutover_id === state.cutover_id);
        if (activeRows.length !== 1) failures.push('active compiler-v2 pointer lacks exactly one ACTIVE cutover');
      } else if (rows.some((row) => row.state === 'ACTIVE')) failures.push('legacy pointer retains an ACTIVE cutover');
    } finally { db.close(); }
  } catch (error) {
    failures.push(`oracle exception: ${error.message}`);
  }
  return unique(failures);
}

function verifyCutover(row, state, generationsDir, project, reviewKey, danKey, failures) {
  if (!['STAGED', 'ACTIVE', 'SUPERSEDED', 'ROLLED_BACK'].includes(row.state)) failures.push(`cutover ${row.cutover_id} state invalid`);
  const candidate = verifyGeneration(generationsDir, row.candidate_generation_name, project, failures);
  const base = verifyGeneration(generationsDir, row.base_generation_name, project, failures);
  if (!candidate || !base) return;
  for (const [field, actual, expected] of [
    ['candidate identity', candidate.generationHash, row.candidate_identity_hash],
    ['base identity', base.generationHash, row.base_identity_hash],
    ['package', candidate.packageHash, row.package_hash],
    ['registry generation', candidate.registryGeneration, row.registry_generation],
    ['registry', candidate.registryHash, row.registry_hash],
    ['report', candidate.reportHash, row.report_hash],
    ['source', candidate.sourceHash, row.sandbox_source_hash],
    ['cutover id', candidate.cutoverId, row.cutover_id],
    ['rollback generation', candidate.rollbackGenerationName, row.base_generation_name],
    ['rollback identity', candidate.rollbackIdentityHash, row.base_identity_hash],
  ]) if (actual !== expected) failures.push(`cutover ${row.cutover_id} ${field} drift`);

  const root = realDirectory(generationsDir, path.join(generationsDir, row.candidate_generation_name), 'candidate generation', failures);
  const cutover = readJson(realFile(root, path.join(root, 'cutover.json'), 'cutover record', failures), 'cutover record', failures);
  if (!cutover) return;
  const payload = cutover.authorizationPayload;
  for (const [field, actual, expected] of [
    ['namespace', payload?.namespace, NAMESPACE],
    ['project', payload?.projectId, project.projectId],
    ['review authority', payload?.reviewAuthorityId, project.reviewAuthorityId],
    ['Dan authority', payload?.danAuthorityId, project.danAuthorityId],
    ['cutover id', payload?.cutoverId, row.cutover_id],
    ['base pointer', payload?.basePointerGeneration, row.base_pointer_generation],
    ['base generation', payload?.baseProductionGenerationName, row.base_generation_name],
    ['base identity', payload?.baseProductionIdentityHash, row.base_identity_hash],
    ['candidate generation', payload?.candidateGenerationName, row.candidate_generation_name],
    ['source', payload?.sandboxSourceHash, row.sandbox_source_hash],
    ['package', payload?.packageHash, row.package_hash],
    ['registry generation', payload?.registryGeneration, row.registry_generation],
    ['registry', payload?.registryHash, row.registry_hash],
    ['report', payload?.reportHash, row.report_hash],
    ['corpus', payload?.corpusReportHash, row.corpus_report_hash],
    ['budget', payload?.fidelityBudgetHash, row.fidelity_budget_hash],
    ['environment', payload?.environmentManifestHash, row.environment_manifest_hash],
    ['rollback proof', payload?.rollbackExercise?.proofHash, row.rollback_proof_hash],
  ]) if (actual !== expected) failures.push(`cutover ${row.cutover_id} authorization ${field} drift`);

  const proposalBody = { schemaVersion: 1, cutoverId: row.cutover_id, candidateGenerationName: row.candidate_generation_name, authorizationPayload: payload };
  if (cutover.proposalHash !== row.proposal_hash || sha256(canonicalJson(proposalBody)) !== row.proposal_hash) failures.push(`cutover ${row.cutover_id} proposal hash drift`);
  if (cutover.reviewSignature !== row.review_signature || cutover.danSignature !== row.dan_signature) failures.push(`cutover ${row.cutover_id} signature persistence drift`);
  if (cutover.reviewSignatureHash !== signatureHash(row.review_signature) || cutover.danSignatureHash !== signatureHash(row.dan_signature)) failures.push(`cutover ${row.cutover_id} signature hash drift`);
  verifySigned(reviewKey, payload, row.review_signature, `cutover ${row.cutover_id} review`, failures);
  verifySigned(danKey, payload, row.dan_signature, `cutover ${row.cutover_id} Dan`, failures);
  verifyRollbackProof(payload?.rollbackExercise, payload, candidate, failures);
  if (row.state === 'ACTIVE' && (state?.active_generation_name !== row.candidate_generation_name
    || state?.active_identity_hash !== row.candidate_identity_hash)) failures.push(`cutover ${row.cutover_id} ACTIVE row/pointer drift`);
}

function verifyGeneration(generationsDir, generationName, project, failures) {
  if (typeof generationName !== 'string' || !generationName) { failures.push('generation name missing'); return null; }
  const root = realDirectory(generationsDir, path.join(generationsDir, generationName), `generation ${generationName}`, failures);
  const generation = readJson(realFile(root, path.join(root, 'generation.json'), 'generation record', failures), 'generation record', failures);
  if (!generation) return null;
  const { generationHash, ...body } = generation;
  if (generation.schemaVersion !== 1 || generation.namespace !== NAMESPACE || generation.generationName !== generationName
    || !HASH.test(generationHash ?? '') || generationHash !== sha256(canonicalJson(body))) failures.push(`generation ${generationName} identity drift`);
  if (generation.lane === 'legacy') {
    if (canonicalJson(generation.legacy) !== canonicalJson(project.initialLegacy)
      || generationName !== 'g-0-legacy' || generation.packageHash !== null
      || generation.registryGeneration !== null || generation.registryHash !== null
      || generation.reportHash !== null || generation.sourceHash !== project.initialLegacy?.artifactHash
      || generation.cutoverId !== null) failures.push('legacy rollback generation drift');
    return generation;
  }
  if (generation.lane !== 'compiler-v2') { failures.push(`generation ${generationName} lane invalid`); return generation; }
  const packageDir = realDirectory(root, path.join(root, 'package'), 'candidate package', failures);
  const packageInventory = inventoryFromDisk(packageDir, failures);
  if (sha256(canonicalJson(packageInventory)) !== generation.packageHash) failures.push(`generation ${generationName} package hash drift`);
  const registry = readJson(realFile(root, path.join(root, 'registry.json'), 'candidate registry', failures), 'candidate registry', failures);
  if (registry?.generation !== generation.registryGeneration || sha256(canonicalJson(registry)) !== generation.registryHash) failures.push(`generation ${generationName} registry drift`);
  const report = readJson(realFile(root, path.join(root, 'report.json'), 'candidate report', failures), 'candidate report', failures);
  if (report) {
    const { reportHash, ...reportBody } = report;
    if (report.state !== 'PROMOTABLE_VERIFIED' || report.blockers?.length !== 0
      || !report.gates || GATES.some((gate) => report.gates[gate] !== 'VERIFIED')
      || Object.keys(report.gates).sort().join(',') !== [...GATES].sort().join(',')
      || reportHash !== generation.reportHash || reportHash !== sha256(canonicalJson(reportBody))) failures.push(`generation ${generationName} report not promotable/exact`);
  }
  return generation;
}

function comparePointer(state, generation, failures) {
  for (const [field, actual, expected] of [
    ['generation', state.active_generation_name, generation.generationName],
    ['lane', state.active_lane, generation.lane],
    ['identity', state.active_identity_hash, generation.generationHash],
    ['package', state.package_hash ?? null, generation.packageHash ?? null],
    ['registry generation', state.registry_generation ?? null, generation.registryGeneration ?? null],
    ['registry', state.registry_hash ?? null, generation.registryHash ?? null],
    ['report', state.report_hash ?? null, generation.reportHash ?? null],
    ['source', state.source_hash, generation.sourceHash],
    ['cutover', state.cutover_id ?? null, generation.cutoverId ?? null],
  ]) if (actual !== expected) failures.push(`production pointer ${field} split`);
}

function verifyRollbackProof(proof, payload, candidate, failures) {
  if (!proof) { failures.push('rollback exercise missing'); return; }
  const { proofHash, ...body } = proof;
  if (proof.schemaVersion !== 1 || proof.method !== 'sqlite-pointer-cycle-v1'
    || proof.basePointerGeneration !== payload.basePointerGeneration
    || proof.activationPointerGeneration !== payload.basePointerGeneration + 1
    || proof.rollbackPointerGeneration !== payload.basePointerGeneration + 2
    || proof.baseGenerationName !== payload.baseProductionGenerationName
    || proof.baseIdentityHash !== payload.baseProductionIdentityHash
    || proof.candidateGenerationName !== payload.candidateGenerationName
    || proof.candidateIdentityHash !== candidate.generationHash
    || proof.sandboxSourceHash !== payload.sandboxSourceHash
    || proof.exactPriorIdentityRestored !== true || proofHash !== sha256(canonicalJson(body))) failures.push('rollback exercise proof drift');
}

function authorityKey(pem, expectedId, expectedHash, label, failures) {
  try {
    const key = createPublicKey(pem);
    if (key.asymmetricKeyType !== 'ed25519') failures.push(`${label} key is not Ed25519`);
    if (!expectedId) failures.push(`${label} authority id missing`);
    if (sha256(key.export({ type: 'spki', format: 'der' })) !== expectedHash) failures.push(`${label} public key hash mismatch`);
    return key;
  } catch (error) {
    failures.push(`${label} key invalid: ${error.message}`);
    return null;
  }
}

function verifySigned(key, payload, signature, label, failures) {
  try {
    if (!key || typeof signature !== 'string' || !verifySignature(null, Buffer.from(canonicalJson(payload)), key, Buffer.from(signature, 'base64'))) failures.push(`${label} signature invalid`);
  } catch { failures.push(`${label} signature invalid`); }
}

function signatureHash(signature) {
  try { return sha256(Buffer.from(signature, 'base64')); }
  catch { return null; }
}

function inventoryFromDisk(root, failures) {
  if (!root) return {};
  const rows = [];
  const pending = [''];
  while (pending.length) {
    const relativeDir = pending.pop();
    const absoluteDir = relativeDir ? path.join(root, relativeDir) : root;
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolute = path.join(root, relative);
      if (entry.isSymbolicLink()) failures.push(`package symlink: ${relative}`);
      else if (entry.isDirectory()) pending.push(relative);
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(absolute);
        rows.push([relative, { sha256: sha256(bytes), bytes: bytes.length }]);
      } else failures.push(`package entry type invalid: ${relative}`);
    }
  }
  return Object.fromEntries(rows.sort(([a], [b]) => a.localeCompare(b)));
}

function realDirectory(root, candidate, label, failures) {
  try {
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink() || !stat.isDirectory()) { failures.push(`${label} invalid/symlinked`); return null; }
    const real = fs.realpathSync(candidate);
    const rootReal = fs.realpathSync(root);
    if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) { failures.push(`${label} escapes project`); return null; }
    return real;
  } catch (error) { failures.push(`${label} missing: ${error.message}`); return null; }
}

function realFile(root, candidate, label, failures) {
  try {
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink() || !stat.isFile()) { failures.push(`${label} invalid/symlinked`); return null; }
    const real = fs.realpathSync(candidate);
    const rootReal = fs.realpathSync(root);
    if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) { failures.push(`${label} escapes project`); return null; }
    return real;
  } catch (error) { failures.push(`${label} missing: ${error.message}`); return null; }
}

function readJson(file, label, failures) {
  if (!file) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { failures.push(`${label} unreadable: ${error.message}`); return null; }
}

const unique = (values) => [...new Set(values)];
