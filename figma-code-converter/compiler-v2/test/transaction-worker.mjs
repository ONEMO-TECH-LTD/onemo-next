import { promises as fs } from 'node:fs';
import path from 'node:path';
import { beginTransaction, withTransaction, prepareStaging, publishGeneration, recoverGenerations } from '../tools/atomic-publish.mjs';

const [outDir, id, mode = 'publish'] = process.argv.slice(2);
if (!outDir || !id) throw new Error('transaction-worker requires outDir and id');

if (mode === 'crash-stage') {
  const transaction = await beginTransaction(outDir);
  const stage = await prepareStaging({ outDir, genBase: 'multi', token: id, transaction });
  await fs.writeFile(path.join(stage, 'artifact.txt'), id);
  await fs.writeFile(path.join(outDir, `crash-${id}.json`), JSON.stringify({ stage }));
  process.exit(23);
}

if (mode === 'crash-generation' || mode === 'crash-before-pointer') {
  const transaction = await beginTransaction(outDir);
  const stage = await prepareStaging({ outDir, genBase: 'multi', token: id, transaction });
  const marker = JSON.parse(await fs.readFile(path.join(stage, '.transaction.json'), 'utf8'));
  await fs.writeFile(path.join(stage, 'artifact.txt'), id);
  await fs.writeFile(path.join(outDir, `crash-${id}.json`), JSON.stringify({ generation: path.join(outDir, marker.generation) }));
  await publishGeneration({
    outDir, genBase: 'multi', token: id, transaction,
    _injectAfterGen: mode === 'crash-generation' ? async () => process.exit(24) : undefined,
    _injectBeforePointer: mode === 'crash-before-pointer' ? async () => process.exit(25) : undefined,
  });
}

if (mode === 'barrier-before-pointer') {
  await withTransaction(outDir, async (transaction) => {
    const stage = await prepareStaging({ outDir, genBase: 'multi', token: id, transaction });
    const marker = JSON.parse(await fs.readFile(path.join(stage, '.transaction.json'), 'utf8'));
    await fs.writeFile(path.join(stage, 'artifact.txt'), id);
    await publishGeneration({
      outDir, genBase: 'multi', token: id, transaction,
      _injectBeforePointer: async () => {
        await fs.writeFile(path.join(outDir, `barrier-${id}.json`), JSON.stringify({ generation: marker.generation, transactionId: transaction.id }));
        const release = path.join(outDir, `release-${id}`);
        while (!await fs.access(release).then(() => true, () => false)) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      },
    });
  });
  process.exit(0);
}

await withTransaction(outDir, async (transaction) => {
  await recoverGenerations(outDir, { transaction });
  const stage = await prepareStaging({ outDir, genBase: 'multi', token: id, transaction });
  await fs.writeFile(path.join(stage, 'artifact.txt'), id);
  await new Promise((resolve) => setTimeout(resolve, Number(id.split('-').at(-1)) % 5));
  const { genDir } = await publishGeneration({ outDir, genBase: 'multi', token: id, transaction });
  await fs.writeFile(path.join(outDir, `result-${id}.json`), JSON.stringify({ genDir }));
});
