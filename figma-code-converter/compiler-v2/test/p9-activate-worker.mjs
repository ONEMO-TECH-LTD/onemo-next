import fs from 'node:fs';
import { activateProductionCutover, openProductionProject } from '../src/production-cutover.mjs';

const [rootDir, projectId, reviewKeyFile, danKeyFile, legacyFile, cutoverId] = process.argv.slice(2);
let project;
try {
  project = openProductionProject({
    rootDir,
    projectId,
    reviewAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: fs.readFileSync(reviewKeyFile, 'utf8') },
    danAuthority: { authorityId: 'dan-cutover-v1', publicKeyPem: fs.readFileSync(danKeyFile, 'utf8') },
    initialLegacy: JSON.parse(fs.readFileSync(legacyFile, 'utf8')),
  });
  const state = activateProductionCutover(project, cutoverId);
  process.stdout.write(JSON.stringify({ ok: true, state }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: error.message }));
} finally { project?.close(); }
