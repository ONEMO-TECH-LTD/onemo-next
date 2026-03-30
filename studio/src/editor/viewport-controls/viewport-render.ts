import { BooleanInput, Button, Container, Label, RadioButton } from '@playcanvas/pcui';

import type { ViewerRenderPass } from '../../../../src/app/(dev)/prototype/core/EffectViewer';

editor.once('viewport:load', () => {
    const controls = editor.call('layout.toolbar.launch');

    const renderContainer = new Container({
        class: 'render'
    });
    controls.prepend(renderContainer);

    const renderButton = new Button({
        class: 'control-strip-btn',
        icon: 'E188',
        text: 'Render'
    });
    renderContainer.append(renderButton);

    const renderOptions = new Container({
        class: 'render-options',
        hidden: true
    });
    renderContainer.append(renderOptions);

    const createCheckbox = (name, callback = (_state) => {}) => {
        const renderOption = new Container({
            flex: true
        });
        renderOptions.append(renderOption);

        let state = false;
        const renderOptionRadio = new BooleanInput({
            value: state
        });
        renderOption.append(renderOptionRadio);

        renderOption.dom.addEventListener('click', () => {
            state = !state;
            renderOptionRadio.value = state;
            callback(state);
        });

        const label = new Label({
            text: name
        });
        renderOption.append(label);
    };

    const renderRadioOptions = [];
    const createShaderOption = (name: string, mode: ViewerRenderPass, state = false) => {
        const renderOption = new Container({
            flex: true
        });
        renderOptions.append(renderOption);

        const renderOptionRadio = new RadioButton({
            value: state
        });
        renderOption.append(renderOptionRadio);
        renderRadioOptions.push(renderOptionRadio);
        if (state) {
            renderButton.text = name;
        }

        renderOption.dom.addEventListener('click', () => {
            renderButton.text = name;
            for (let i = 0; i < renderRadioOptions.length; i++) {
                renderRadioOptions[i].value = false;
            }
            renderOptionRadio.value = true;
            editor.emit('r3f:viewer:renderPass', mode);
        });

        const label = new Label({
            text: name
        });
        renderOption.append(label);
    };

    createCheckbox('Wireframe', (state) => {
        renderButton.icon = state ? 'E187' : 'E188';
        editor.emit('r3f:viewer:wireframe', state);
    });

    const divider = new Container({
        class: 'divider'
    });
    renderOptions.append(divider);

    createShaderOption('Standard', 'standard', true);
    createShaderOption('Albedo', 'albedo');
    createShaderOption('Opacity', 'opacity');
    createShaderOption('World Normal', 'worldNormal');
    createShaderOption('Specularity', 'specularity');
    createShaderOption('Gloss', 'gloss');
    createShaderOption('Metalness', 'metalness');
    createShaderOption('AO', 'ao');
    createShaderOption('Emission', 'emission');
    createShaderOption('Lighting', 'lighting');
    createShaderOption('UV0', 'uv0');

    let timeout;
    let inOptions = false;
    let inButton = false;

    const enable = () => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }

        renderOptions.hidden = false;
    };

    const disable = () => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }

        if (!inOptions && !inButton) {
            renderOptions.hidden = true;
        }
    };

    renderContainer.dom.addEventListener('mouseenter', () => {
        inButton = true;
        enable();
    }, false);

    renderContainer.dom.addEventListener('mouseleave', () => {
        inButton = false;
        disable();
    }, false);

    renderContainer.dom.addEventListener('mouseenter', () => {
        inOptions = true;

        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
    }, false);

    renderContainer.dom.addEventListener('mouseleave', () => {
        inOptions = false;

        disable();
    }, false);
});
