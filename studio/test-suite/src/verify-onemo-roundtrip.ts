import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

const DEFAULT_STUDIO_URL = 'http://127.0.0.1:3490/editor/scene/1';
const DEFAULT_EXECUTABLE_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const studioUrl = process.env.ONEMO_STUDIO_URL || DEFAULT_STUDIO_URL;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || DEFAULT_EXECUTABLE_PATH;
const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';

const browser = await chromium.launch({
    headless,
    executablePath,
    args: [
        '--disable-web-security',
        '--ignore-gpu-blocklist',
        '--use-gl=angle',
        '--use-angle=default'
    ]
});

const page = await browser.newPage();

const closeBrowser = async (code = 0) => {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    process.exitCode = code;
};

const assertApprox = (actual: number, expected: number, epsilon = 0.0001) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} ≈ ${expected} (±${epsilon})`);
};

try {
    await page.goto(studioUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
        return Boolean(window.editor?.call?.('viewport:bridgeAdapter'));
    }, { timeout: 30000 });
    await page.waitForFunction(() => {
        const bridge = window.editor?.call?.('viewport:bridgeAdapter');
        return Boolean(
            bridge?.config?.modelPath &&
            bridge?.context?.modelRoot &&
            bridge?.context?.materialSlots &&
            bridge.context.materialSlots.size > 0
        );
    }, { timeout: 30000 });

    const result = await page.evaluate(async () => {
        const editor = window.editor;
        const bridge = editor.call('viewport:bridgeAdapter');
        const sceneSettings = editor.call('sceneSettings');

        sceneSettings.set('render.tonemapping', 4);
        sceneSettings.set('render.exposure', 1.5);
        sceneSettings.set('render.backgroundColor', [0.5, 0.2, 0.1]);
        sceneSettings.set('render.fog', 'linear');
        sceneSettings.set('render.fog_color', [0.1, 0.2, 0.3]);
        sceneSettings.set('render.fog_start', 5);
        sceneSettings.set('render.fog_end', 200);
        sceneSettings.set('render.ambientIntensity', 2);
        sceneSettings.set('render.envPreset', 'city');
        sceneSettings.set('render.envIntensity', 2);
        sceneSettings.set('render.shadowsEnabled', true);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        bridge.context.camera.position.set(1, 2, 8);
        if (bridge.context.camera.isPerspectiveCamera) {
            bridge.context.camera.fov = 35;
            bridge.context.camera.updateProjectionMatrix();
        }

        if (bridge.context.orbitControls) {
            bridge.context.orbitControls.target.set(0, 1, 0);
            bridge.context.orbitControls.update();
        }

        await new Promise((resolve) => setTimeout(resolve, 200));

        const payload = await bridge.serializeScene('qa-roundtrip');
        await bridge.deserializeScene(payload);
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const fog = bridge.context.scene.fog;
        const camera = bridge.context.camera;
        const target = bridge.context.orbitControls?.target?.toArray?.() ?? null;

        return {
            renderer: {
                toneMapping: bridge.context.renderer.toneMapping,
                exposure: bridge.context.renderer.toneMappingExposure,
                shadowsEnabled: bridge.context.renderer.shadowMap.enabled,
            },
            config: {
                background: bridge.config?.scene?.background ?? null,
                ambientIntensity: bridge.config?.scene?.ambientIntensity ?? null,
                envPreset: bridge.config?.environment?.preset ?? null,
                envIntensity: bridge.config?.scene?.envIntensity ?? null,
            },
            fog: {
                type: fog?.isFog ? 'linear' : fog?.isFogExp2 ? 'exponential' : 'none',
                near: fog?.isFog ? fog.near : null,
                far: fog?.isFog ? fog.far : null,
            },
            camera: {
                type: camera.type,
                position: camera.position.toArray(),
                fov: camera.isPerspectiveCamera ? camera.fov : null,
                target,
            },
        };
    });

    assert.equal(result.renderer.toneMapping, 4, 'toneMapping should survive round-trip');
    assertApprox(result.renderer.exposure, 1.5, 0.0001);
    assert.equal(result.renderer.shadowsEnabled, true, 'shadow enabled state should survive round-trip');
    assert.equal(result.config.background, '#80331a', 'background should survive round-trip as the same visual color');
    assertApprox(Number(result.config.ambientIntensity), 2, 0.0001);
    assert.equal(result.config.envPreset, 'city', 'environment preset should survive round-trip');
    assertApprox(Number(result.config.envIntensity), 2, 0.0001);
    assert.equal(result.fog.type, 'linear', 'fog type should survive round-trip');
    assertApprox(Number(result.fog.near), 5, 0.0001);
    assertApprox(Number(result.fog.far), 200, 0.0001);
    assert.equal(result.camera.type, 'PerspectiveCamera', 'camera type should remain perspective for this verification');
    assertApprox(Number(result.camera.position[0]), 1, 0.0001);
    assertApprox(Number(result.camera.position[1]), 2, 0.0001);
    assertApprox(Number(result.camera.position[2]), 8, 0.0001);
    assertApprox(Number(result.camera.fov), 35, 0.0001);
    assert.ok(Array.isArray(result.camera.target), 'orbit target should be available');
    assertApprox(Number(result.camera.target?.[0]), 0, 0.0001);
    assertApprox(Number(result.camera.target?.[1]), 1, 0.0001);
    assertApprox(Number(result.camera.target?.[2]), 0, 0.0001);

    console.log(`Playwright round-trip verification passed against ${studioUrl}`);
    await closeBrowser(0);
} catch (error) {
    console.error('Playwright round-trip verification failed:', error);
    await closeBrowser(1);
}
