import fs from 'node:fs';
import { openSandboxProject } from '../src/sandbox-store.mjs';
import { openProductionProject, stageProductionCutover } from '../src/production-cutover.mjs';

const [
  rootDir, projectId, promotionKeyFile, reviewKeyFile, danKeyFile, legacyFile,
  proposalFile, reviewSignatureFile, danSignatureFile,
] = process.argv.slice(2);
let sandbox;
let production;
try {
  sandbox = openSandboxProject({
    rootDir,
    projectId,
    promotionAuthority: { authorityId: 'promotion-v1', publicKeyPem: fs.readFileSync(promotionKeyFile, 'utf8') },
  });
  production = openProductionProject({
    rootDir,
    projectId,
    reviewAuthority: { authorityId: 'qa-meta-v1', publicKeyPem: fs.readFileSync(reviewKeyFile, 'utf8') },
    danAuthority: { authorityId: 'dan-cutover-v1', publicKeyPem: fs.readFileSync(danKeyFile, 'utf8') },
    initialLegacy: JSON.parse(fs.readFileSync(legacyFile, 'utf8')),
  });
  const status = stageProductionCutover(production, sandbox, {
    proposal: JSON.parse(fs.readFileSync(proposalFile, 'utf8')),
    reviewSignature: fs.readFileSync(reviewSignatureFile, 'utf8'),
    danSignature: fs.readFileSync(danSignatureFile, 'utf8'),
  });
  process.stdout.write(JSON.stringify({ ok: true, status }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: error.message }));
} finally {
  production?.close();
  sandbox?.close();
}
