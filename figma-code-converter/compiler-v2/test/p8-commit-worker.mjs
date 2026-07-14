import fs from 'node:fs';
import { commitSandboxCandidate, openSandboxProject } from '../src/sandbox-store.mjs';

const [rootDir, projectId, authorityId, publicKeyPath, transactionId] = process.argv.slice(2);
let project;
try {
  project = openSandboxProject({
    rootDir,
    projectId,
    promotionAuthority: { authorityId, publicKeyPem: fs.readFileSync(publicKeyPath, 'utf8') },
  });
  const state = commitSandboxCandidate(project, transactionId);
  process.stdout.write(JSON.stringify({ ok: true, transactionId, state }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, transactionId, error: error.message }));
} finally {
  project?.close();
}
