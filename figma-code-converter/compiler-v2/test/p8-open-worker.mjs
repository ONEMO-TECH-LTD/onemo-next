import fs from 'node:fs';
import { openSandboxProject, readSandboxProject } from '../src/sandbox-store.mjs';

const [rootDir, projectId, authorityId, publicKeyPath] = process.argv.slice(2);
let project;
try {
  project = openSandboxProject({
    rootDir,
    projectId,
    promotionAuthority: { authorityId, publicKeyPem: fs.readFileSync(publicKeyPath, 'utf8') },
  });
  process.stdout.write(JSON.stringify({ ok: true, state: readSandboxProject(project) }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: error.message }));
} finally {
  project?.close();
}
