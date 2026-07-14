/** Truthful Studio adapter for an existing Compiler v2 sandbox project. No signer or stage path. */
import fs from 'node:fs';
import path from 'node:path';
import {
  buildDualRunView,
  cancelSandboxCandidate,
  commitSandboxCandidate,
  openSandboxProject,
  readCandidatePackageFile,
  recoverSandboxProject,
} from '../compiler-v2/src/sandbox-store.mjs';

const RUNTIME_FILES = Object.freeze({
  'index.html': 'runtime/index.html',
  'bundle.css': 'runtime/bundle.css',
  'bundle.js': 'runtime/bundle.js',
});

export class V2StudioError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_STATIC'; }
}

export function createUnavailableV2Studio(reason) {
  if (typeof reason !== 'string' || !reason) throw new V2StudioError('Compiler v2 unavailable reason missing');
  return Object.freeze({
    configured: false,
    snapshot(legacy) {
      return {
        schemaVersion: 1,
        configured: false,
        productionLane: 'legacy',
        legacy: normalizeLegacy(legacy),
        compilerV2: { terminalState: null, blockers: [reason] },
        project: null,
        candidates: [],
      };
    },
    commit() { throw new V2StudioError(`Compiler v2 Studio not configured: ${reason}`); },
    cancel() { throw new V2StudioError(`Compiler v2 Studio not configured: ${reason}`); },
    runtime() { throw new V2StudioError(`Compiler v2 Studio not configured: ${reason}`); },
    close() {},
  });
}

export function openV2StudioFromConfig(config, baseDir) {
  if (!config) return createUnavailableV2Studio('promotion authority not configured');
  if (typeof baseDir !== 'string' || !path.isAbsolute(baseDir)) throw new V2StudioError('Compiler v2 configuration base directory must be absolute');
  const fields = Object.keys(config).sort().join(',');
  if (fields !== ['authorityId', 'projectId', 'publicKeyFile', 'rootDir'].join(',')) throw new V2StudioError('Compiler v2 configuration fields malformed; signer/private-key fields are forbidden');
  for (const field of ['rootDir', 'projectId', 'authorityId', 'publicKeyFile']) {
    if (typeof config[field] !== 'string' || !config[field]) throw new V2StudioError(`Compiler v2 configuration ${field} missing`);
  }
  const project = openSandboxProject({
    rootDir: path.resolve(baseDir, config.rootDir),
    projectId: config.projectId,
    promotionAuthority: {
      authorityId: config.authorityId,
      publicKeyPem: fs.readFileSync(path.resolve(baseDir, config.publicKeyFile), 'utf8'),
    },
  });
  return createV2StudioController(project);
}

export function createV2StudioController(project) {
  if (!project) throw new V2StudioError('Compiler v2 project missing');
  const controller = {
    configured: true,
    snapshot(legacy) {
      const normalizedLegacy = normalizeLegacy(legacy);
      const recovered = recoverSandboxProject(project);
      const candidates = recovered.candidates.map((candidate) => {
        const runtimeAvailable = Object.values(RUNTIME_FILES).every((relative) => {
          try { readCandidatePackageFile(project, candidate.transactionId, relative); return true; }
          catch { return false; }
        });
        return {
          schemaVersion: 1,
          transactionId: candidate.transactionId,
          transactionState: candidate.state,
          terminalState: candidate.state === 'CANCELLED' ? 'CANCELLED' : candidate.reportState,
          canPromote: candidate.canPromote,
          promotionReceiptVerified: candidate.promotionReceiptVerified,
          baseGeneration: candidate.baseGeneration,
          baseRegistryGeneration: candidate.baseRegistryGeneration,
          baseRegistryHash: candidate.baseRegistryHash,
          candidateRegistryHash: candidate.candidateRegistryHash,
          packageHash: candidate.packageHash,
          reportHash: candidate.reportHash,
          gates: candidate.gates,
          blockers: candidate.blockers,
          runtimeAvailable,
          dualRun: buildDualRunView(project, legacy, candidate.transactionId),
        };
      });
      return {
        schemaVersion: 1,
        configured: true,
        productionLane: 'legacy',
        legacy: normalizedLegacy,
        compilerV2: {
          terminalState: null,
          blockers: candidates.length ? [] : ['No Compiler v2 candidate is staged'],
        },
        project: recovered.project,
        candidates,
      };
    },
    commit(transactionId, legacy) {
      const before = controller.snapshot(legacy).candidates.find((row) => row.transactionId === transactionId);
      if (!before) throw new V2StudioError(`Compiler v2 candidate ${transactionId} missing`);
      if (!before.canPromote) throw new V2StudioError(`Compiler v2 candidate ${transactionId} is not promotable`);
      commitSandboxCandidate(project, transactionId);
      return controller.snapshot(legacy);
    },
    cancel(transactionId, legacy) {
      cancelSandboxCandidate(project, transactionId);
      return controller.snapshot(legacy);
    },
    runtime(transactionId, artifact) {
      const relative = RUNTIME_FILES[artifact];
      if (!relative) throw new V2StudioError(`Compiler v2 runtime artifact forbidden: ${artifact}`);
      return readCandidatePackageFile(project, transactionId, relative);
    },
    close() { project.close(); },
  };
  return Object.freeze(controller);
}

function normalizeLegacy(legacy) {
  if (legacy?.operating !== true || typeof legacy.route !== 'string' || !legacy.route.startsWith('/')
    || typeof legacy.version !== 'string' || !legacy.version) throw new V2StudioError('legacy operating identity malformed');
  return { lane: 'legacy', operating: true, route: legacy.route, version: legacy.version, untouched: true };
}
