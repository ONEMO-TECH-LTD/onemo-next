import { Button, Container } from '@playcanvas/pcui';

import { LegacyTooltip } from '@/common/ui/tooltip';
import { config } from '@/editor/config';

editor.once('load', () => {
    const root = editor.call('layout.root');
    const viewport = editor.call('layout.viewport');

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
        window.open(`/project/${config.project.id}`, '_blank');
    });

    LegacyTooltip.attach({
        target: homeButton.dom,
        text: 'Home',
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
        editor.call('selector:set', 'editorSettings', [editor.call('settings:projectUser')]);
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

    editor.on('picker:scene:open', () => {
        scenesButton.class.add('active');
    });

    editor.on('picker:scene:close', () => {
        scenesButton.class.remove('active');
    });
});
