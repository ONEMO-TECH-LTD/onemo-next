import fs from 'node:fs';
import {
  buildCandidateProposal, openSandboxProject, stageSandboxCandidate,
} from '../src/sandbox-store.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const [rootDir, projectId, authorityId, publicKeyPath, transactionId] = process.argv.slice(2);
const hash = (value) => sha256(canonicalJson(value));
const reportBody = {
  schemaVersion: 1,
  state: 'DIAGNOSTIC_ONLY',
  gates: Object.fromEntries(Array.from({ length: 14 }, (_, index) => [`G${index}`, 'DIAGNOSTIC_ONLY'])),
  blockers: ['integration-corpus'],
  corpusReportHash: hash('corpus'),
  fidelityBudgetHash: hash('budget'),
  environmentManifestHash: hash('environment'),
};
let project;
try {
  project = openSandboxProject({
    rootDir,
    projectId,
    promotionAuthority: { authorityId, publicKeyPem: fs.readFileSync(publicKeyPath, 'utf8') },
  });
  const proposal = buildCandidateProposal(project, {
    transactionId,
    registry: { schemaVersion: 1, generation: 0, entries: {} },
    packageFiles: { 'manifest.json': '{"schemaVersion":1}\n' },
    report: { ...reportBody, reportHash: hash(reportBody) },
  });
  const status = await stageSandboxCandidate(project, { proposal, promotionSignature: null });
  process.stdout.write(JSON.stringify({ ok: true, state: status.state }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: error.message }));
} finally {
  project?.close();
}
