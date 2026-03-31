editor.once('load', () => {
    const sceneSettings = editor.call('sceneSettings');
    const app = editor.call('viewport:app');
    if (!app) {
        return;
    } // webgl not available

    let assetsLoaded = false;
    let sceneSettingsLoaded = false;
    let updating;

    const toPlayCanvasFogType = (value) => {
        return value === 'exponential' ? 'exp2' : value;
    };

    // apply settings
    const applySettings = function () {
        if (!app) {
            return;
        }

        updating = false;

        // apply scene settings
        const settingsJson = sceneSettings.json();
        app.applySceneSettings({
            ...settingsJson,
            render: {
                ...settingsJson.render,
                fog: toPlayCanvasFogType(settingsJson.render?.fog)
            }
        });

        // apply sky depth write (not yet handled by engine's applySettings)
        const skyDepthWrite = sceneSettings.get('render.skyDepthWrite');
        if (skyDepthWrite !== undefined) {
            app.scene.sky.depthWrite = skyDepthWrite;
        }

        // need to update all materials on scene settings change
        app.assets.filter((asset) => {
            return asset.type === 'material' && asset.resource;
        }).forEach((asset) => {
            asset.resource.update();
        });

        editor.call('viewport:render');
    };

    // queue settings apply
    const queueApplySettings = function () {
        if (!sceneSettingsLoaded || updating || !assetsLoaded) {
            return;
        }

        updating = true;

        editor.call('viewport:render');
        editor.once('viewport:update', applySettings);
    };

    // on settings change
    sceneSettings.on('*:set', queueApplySettings);

    editor.on('assets:load', () => {
        assetsLoaded = true;
        queueApplySettings();
    });

    editor.on('sceneSettings:load', () => {
        sceneSettingsLoaded = true;
        queueApplySettings();
    });
});
