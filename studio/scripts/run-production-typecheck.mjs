import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, '..');

const run = (command, args) => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: studioRoot,
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'production'
            }
        });

        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
        });
    });
};

await run('node_modules/.bin/vite', ['build']);
