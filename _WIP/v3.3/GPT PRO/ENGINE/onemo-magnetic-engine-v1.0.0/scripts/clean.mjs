import { rm } from 'node:fs/promises';
for (const path of [
  'dist',
  'packages/geometry-compute/dist',
  'packages/magnetic-logic/dist',
  'packages/magnetic-next/dist',
  'examples/cli-demo/dist'
]) {
  await rm(new URL(`../${path}`, import.meta.url), { recursive: true, force: true });
}
