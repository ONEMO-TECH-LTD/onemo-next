import { Button, Container } from '@playcanvas/pcui';

import { LegacyTooltip } from '@/common/ui/tooltip';

editor.once('load', () => {
    const root = editor.call('layout.root');
    const viewport = editor.call('layout.viewport');
    const openEditorSettings = (panelId = 'editor') => {
        const projectUserSettings = editor.call('settings:projectUser');
        editor.call('selector:set', 'editorSettings', [projectUserSettings]);
        editor.emit('attributes:inspect[editorSettings]');
        editor.call('editorSettings:tab:set', panelId);
        editor.call('editorSettings:panel:foldAll');
        editor.call('editorSettings:panel:unfold', panelId);
    };

    const panel = new Container({
        class: ['control-strip', 'top-left']
    });
    viewport.append(panel);

    editor.method('layout.toolbar.scene', () => {
        return panel;
    });

    const homeButton = new Button({
        class: 'control-strip-btn',
        icon: 'E140'
    });
    panel.append(homeButton);

    homeButton.on('click', () => {
        const perspectiveCamera = editor.call('camera:get', 'perspective');
        if (perspectiveCamera) {
            editor.call('camera:set', perspectiveCamera);
        }
        editor.emit('r3f:viewer:cameraPreset', 'perspective');
        editor.call('viewport:focus');
    });

    LegacyTooltip.attach({
        target: homeButton.dom,
        text: 'Frame Scene',
        align: 'top',
        root: root
    });

    const settingsButton = new Button({
        class: 'control-strip-btn',
        icon: 'E134'
    });
    panel.append(settingsButton);

    LegacyTooltip.attach({
        target: settingsButton.dom,
        text: 'Settings',
        align: 'top',
        root: root
    });

    settingsButton.on('click', () => {
        openEditorSettings('editor');
    });

    editor.on('attributes:clear', () => {
        settingsButton.class.remove('active');
    });

    editor.on('attributes:inspect[editorSettings]', () => {
        settingsButton.class.add('active');
    });

    const scenesButton = new Button({
        class: 'control-strip-btn',
        icon: 'E147'
    });
    panel.append(scenesButton);

    editor.on('scene:name', (name) => {
        scenesButton.text = name;
    });

    LegacyTooltip.attach({
        target: scenesButton.dom,
        text: 'Manage Scenes',
        align: 'top',
        root: root
    });

    scenesButton.on('click', () => {
        editor.call('picker:scene');
    });

    // Reset orbit center button
    const resetOrbitButton = new Button({
        class: 'control-strip-btn',
        icon: 'E186'
    });
    panel.append(resetOrbitButton);

    LegacyTooltip.attach({
        target: resetOrbitButton.dom,
        text: 'Reset Orbit Center (Numpad 5)',
        align: 'top',
        root: root
    });

    resetOrbitButton.on('click', () => {
        editor.emit('r3f:viewer:resetOrbit');
    });

    editor.on('picker:scene:open', () => {
        scenesButton.class.add('active');
    });

    editor.on('picker:scene:close', () => {
        scenesButton.class.remove('active');
    });
});
