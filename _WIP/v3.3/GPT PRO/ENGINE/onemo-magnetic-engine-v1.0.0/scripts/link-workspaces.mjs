import { mkdir, rm, symlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const links = [
  ['node_modules/@onemo/geometry-compute', 'packages/geometry-compute'],
  ['node_modules/@onemo/magnetic-logic', 'packages/magnetic-logic'],
  ['node_modules/@onemo/magnetic-next', 'packages/magnetic-next'],
  ['examples/cli-demo/node_modules/@onemo/geometry-compute', 'packages/geometry-compute'],
  ['examples/cli-demo/node_modules/@onemo/magnetic-logic', 'packages/magnetic-logic']
];
for (const [linkRel, targetRel] of links) {
  const link = resolve(root, linkRel);
  const target = resolve(root, targetRel);
  await mkdir(dirname(link), { recursive: true });
  await rm(link, { recursive: true, force: true });
  await symlink(target, link, 'dir');
}
