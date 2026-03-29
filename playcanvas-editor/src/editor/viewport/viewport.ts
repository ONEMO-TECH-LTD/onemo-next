import { Canvas } from '@playcanvas/pcui';
import { WasmModule, moveViewportDepthLayer } from './viewport-engine';

import { config } from '@/editor/config';

import { mountEffectViewer } from './effect-viewer-mount';
import { ViewportApplication } from './viewport-application';

editor.once('load', () => {
    const canvas = new Canvas({
        id: 'canvas-3d',
        useDevicePixelRatio: true
    });

    let keepRendering = false;

    const projectUserSettings = editor.call('settings:projectUser');

    // Allow anti-aliasing to be forcibly disabled - this is useful for Selenium tests in
    // order to ensure that the generated screenshots are consistent across different GPUs.
    const disableAntiAliasing = /disableAntiAliasing=true/.test(location.search);

    // create the minimal editor app shell
    let app;
    try {
        app = new ViewportApplication(canvas.element, {
            editorSettings: projectUserSettings.json().editor,
            graphicsDeviceOptions: {
                antialias: !disableAntiAliasing,
                alpha: true
            }
        });

        // Pointer handling now lives in viewport-tap.ts and the R3F overlay.
        // Keep the legacy depth-layer shuffle only for tools still hanging off the app shell.
        moveViewportDepthLayer(app);

        app.enableBundles = false;

        // Force compatibility mode for Specular and Sheen maps when Editor is running with V2
        // and project running on V1.
        if (!editor.projectEngineV2) {
            app.scene.forcePassThroughSpecular = true;
        }
    } catch (ex) {
        editor.emit('viewport:error', ex);
        return;
    }

    // set module configs
    config.wasmModules.forEach((m: { moduleName: string; glueUrl: string; wasmUrl: string; fallbackUrl: string }) => {
        WasmModule.setConfig(m.moduleName, {
            glueUrl: m.glueUrl,
            wasmUrl: m.wasmUrl,
            fallbackUrl: m.fallbackUrl
        });
    });

    projectUserSettings.on('*:set', (): void => {
        app.setEditorSettings(projectUserSettings.json().editor);
    });


    // add canvas
    const viewport = editor.call('layout.viewport');
    viewport.prepend(canvas);

    const viewportDom = (viewport.dom || viewport.element || viewport) as HTMLElement;
    const canvasDom = (canvas.dom || canvas.element) as HTMLElement;
    const cleanupR3F = mountEffectViewer(viewportDom, canvasDom);
    editor.method('viewport:disposeR3F', () => {
        cleanupR3F();
    });

    // get canvas
    editor.method('viewport:canvas', () => {
        return canvas;
    });

    // get app
    editor.method('viewport:app', () => {
        return app;
    });

    // re-render viewport
    editor.method('viewport:render', () => {
        app.redraw = true;
    });

    // returns true if the viewport should continuously render
    editor.method('viewport:keepRendering', (value?: boolean) => {
        if (typeof value === 'boolean') {
            keepRendering = value;
        }

        return keepRendering;
    });

    app.start();

    editor.emit('viewport:load', app);
});
