import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, '..');

const productionFiles = [
    'src/editor/adapter/bridge-utils.ts',
    'src/editor/adapter/camera-mapper.ts',
    'src/editor/adapter/constants.ts',
    'src/editor/adapter/entity-mapper.ts',
    'src/editor/adapter/light-mapper.ts',
    'src/editor/adapter/material-mapper.ts',
    'src/editor/adapter/model-mapper.ts',
    'src/editor/adapter/observer-r3f-bridge.ts',
    'src/editor/adapter/onemo-deserialize.ts',
    'src/editor/adapter/onemo-format.ts',
    'src/editor/adapter/onemo-serialize.ts',
    'src/editor/adapter/render-mapper.ts',
    'src/editor/adapter/scene-schema.ts',
    'src/editor/assets/asset-panel.ts',
    'src/editor/assets/assets-context-menu.ts',
    'src/editor/assets/assets-edit.ts',
    'src/editor/assets/assets-upload.ts',
    'src/editor/attributes/reference/settings.ts',
    'src/editor/entities/entities-components-menu.ts',
    'src/editor/entities/entities-context-menu.ts',
    'src/editor/entities/entities-menu.ts',
    'src/editor/entities/entities-treeview.ts',
    'src/editor/inspector/asset.ts',
    'src/editor/inspector/entity.ts',
    'src/editor/inspector/settings-panel.ts',
    'src/editor/inspector/settings-panels/editor.ts',
    'src/editor/schema/schema-components.ts',
    'src/editor/toolbar/toolbar-logo.ts',
    'src/editor/viewport/StudioViewport.tsx',
    'src/editor/viewport/camera/camera-orbit.ts',
    'src/editor/viewport/effect-viewer-mount.tsx',
    'src/editor/viewport/viewport-entities-components-binding.ts',
    'src/editor/viewport/viewport-entities-create.ts',
    'src/editor/viewport/viewport-entities-observer-binding.ts',
    'src/editor/viewport/viewport-grid.ts'
];

const run = (command, args) => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: studioRoot,
            stdio: 'inherit',
            env: process.env
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

await run('node_modules/.bin/stylelint', ['sass/editor/_editor-settings-panel.scss']);
await run('node_modules/.bin/eslint', [
    '-c',
    'eslint.production.config.mjs',
    ...productionFiles
]);
