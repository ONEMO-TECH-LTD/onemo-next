import { Container, Button } from '@playcanvas/pcui';

import { LegacyTooltip } from '@/common/ui/tooltip';
import { config } from '@/editor/config';

editor.once('load', () => {
    const root = editor.call('layout.root');
    const viewport = editor.call('layout.viewport');

    // panel
    const panel = new Container({
        class: ['control-strip', 'top-right']
    });
    viewport.append(panel);

    editor.method('layout.toolbar.launch', () => {
        return panel;
    });

    const launchApp = (deviceOptions: { webgpu?: boolean; webgl2?: boolean; webgl1?: boolean; [key: string]: boolean | undefined } = {}, popup?: boolean) => {
        let url = config.url.launch + config.scene.id;

        const query = [];

        if (deviceOptions.webgpu) {
            query.push('device=webgpu');
        } else if (deviceOptions.webgl2) {
            query.push('device=webgl2');
        } else if (deviceOptions.webgl1) {
            query.push('device=webgl1');
        }

        const params = new URLSearchParams(location.search);
        if (params.has('use_local_engine')) {
            query.push(`use_local_engine=${params.get('use_local_engine')}`);
        } else {
            const engineVersion = editor.call('settings:session').get('engineVersion');
            if (engineVersion && engineVersion !== 'current') {
                query.push(`version=${config.engineVersions[engineVersion].version}`);
            }
        }

        if (params.has('use_local_frontend')) {
            query.push(`use_local_frontend=${params.get('use_local_frontend')}`);
        }

        if (query.length) {
            url += `?${query.join('&')}`;
        }

        const features = popup ? 'popup' : undefined;
        const launcher = window.open('', '_blank', features);
        if (launcher) {
            launcher.opener = null;
            launcher.location = url;
        }
    };

    editor.method('launch', launchApp);

    // fullscreen
    const buttonExpand = new Button({
        class: ['control-strip-btn', 'expand'],
        icon: 'E127'
    });
    panel.append(buttonExpand);

    buttonExpand.on('click', () => {
        editor.call('viewport:expand');
    });

    const tooltipExpand = LegacyTooltip.attach({
        target: buttonExpand.dom,
        text: 'Hide Panels',
        align: 'top',
        root: root
    });

    editor.on('viewport:expand', (state: boolean) => {
        if (state) {
            tooltipExpand.text = 'Show Panels';
            buttonExpand.class.add('active');
        } else {
            tooltipExpand.text = 'Hide Panels';
            buttonExpand.class.remove('active');
        }

        tooltipExpand.hidden = true;
    });

    // collapse button text to icon-only when the viewport is too narrow
    const topLeft = document.querySelector('.control-strip.top-left');
    const minGap = 20;

    const topStrips = ':is(.control-strip.top-left, .control-strip.top-right)';
    const buttonSelector = [
        `${topStrips} > .pcui-button`,
        `${topStrips} > .render > .pcui-button`,
        `${topStrips} > .camera > .pcui-button`
    ].join(', ');

    const restoreButtonText = () => {
        document.querySelectorAll(buttonSelector).forEach((btn) => {
            const text = btn.getAttribute('data-full-text');
            if (text !== null) {
                btn.textContent = text;
                btn.removeAttribute('data-full-text');
            }
        });
    };

    const clearButtonText = () => {
        document.querySelectorAll(buttonSelector).forEach((btn) => {
            if (btn.textContent) {
                btn.setAttribute('data-full-text', btn.textContent);
                btn.textContent = '';
            }
        });
    };

    const updateCompact = () => {
        // restore text to measure full width
        restoreButtonText();

        const leftRect = topLeft.getBoundingClientRect();
        const rightRect = panel.dom.getBoundingClientRect();

        if (leftRect.right + minGap > rightRect.left) {
            clearButtonText();
        }
    };

    editor.on('viewport:resize', updateCompact);
    editor.on('scene:name', updateCompact);
});
