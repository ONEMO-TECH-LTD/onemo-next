import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, [
  '--test', '--test-reporter=spec',
  'packages/geometry-compute/tests/*.test.mjs',
  'packages/magnetic-logic/tests/*.test.mjs',
  'packages/magnetic-next/tests/*.test.mjs'
], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
