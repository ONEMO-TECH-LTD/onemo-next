import { Button, Container, LabelGroup } from '@playcanvas/pcui';

import type { ObserverR3FBridge } from '../../adapter/observer-r3f-bridge';
import { BaseSettingsPanel, type BaseSettingsPanelArgs } from './base';
import type { Attribute, Divider } from '../attribute.type.d';

const ATTRIBUTES: (Attribute | Divider)[] = [
    {
        observer: 'sceneSettings',
        label: 'Tonemapping',
        path: 'render.tonemapping',
        type: 'select',
        args: {
            type: 'number',
            options: [
                { v: 0, t: 'None' },
                { v: 1, t: 'Linear' },
                { v: 2, t: 'Reinhard' },
                { v: 3, t: 'Cineon' },
                { v: 4, t: 'ACES' },
                { v: 6, t: 'AgX' },
                { v: 7, t: 'Neutral' }
            ]
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Exposure',
        path: 'render.exposure',
        type: 'slider',
        args: {
            min: 0,
            max: 8
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Output Color Space',
        path: 'render.outputColorSpace',
        type: 'select',
        args: {
            type: 'string',
            options: [
                {
                    v: 'srgb',
                    t: 'sRGB'
                },
                {
                    v: 'srgb-linear',
                    t: 'Linear sRGB'
                }
            ]
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Shadows Enabled',
        path: 'render.shadowsEnabled',
        type: 'boolean'
    },
    {
        observer: 'sceneSettings',
        label: 'Shadow Type',
        path: 'render.shadowType',
        type: 'select',
        args: {
            type: 'number',
            options: [
                { v: 0, t: 'Basic' },
                { v: 1, t: 'PCF' },
                { v: 2, t: 'PCF Soft' },
                { v: 3, t: 'VSM' }
            ]
        }
    },
    {
        type: 'divider'
    },
    {
        observer: 'sceneSettings',
        label: 'Background Color',
        path: 'render.backgroundColor',
        type: 'rgb'
    },
    {
        observer: 'sceneSettings',
        label: 'Fog',
        path: 'render.fog',
        type: 'select',
        args: {
            type: 'string',
            options: [
                { v: 'none', t: 'None' },
                { v: 'linear', t: 'Linear' },
                { v: 'exponential', t: 'Exponential' }
            ]
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Fog Color',
        path: 'render.fog_color',
        type: 'rgb'
    },
    {
        observer: 'sceneSettings',
        label: 'Fog Near',
        path: 'render.fog_start',
        type: 'number',
        args: {
            min: 0
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Fog Far',
        path: 'render.fog_end',
        type: 'number',
        args: {
            min: 0
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Fog Density',
        path: 'render.fog_density',
        type: 'number',
        args: {
            min: 0
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Ambient Color',
        path: 'render.global_ambient',
        type: 'rgb'
    },
    {
        observer: 'sceneSettings',
        label: 'Ambient Intensity',
        path: 'render.ambientIntensity',
        type: 'slider',
        args: {
            min: 0,
            max: 4
        }
    },
    {
        type: 'divider'
    },
    {
        observer: 'sceneSettings',
        label: 'Environment Preset',
        path: 'render.envPreset',
        type: 'select',
        args: {
            type: 'string',
            options: [
                { v: 'studio', t: 'Studio' },
                { v: 'city', t: 'City' },
                { v: 'sunset', t: 'Sunset' },
                { v: 'dawn', t: 'Dawn' },
                { v: 'warehouse', t: 'Warehouse' },
                { v: 'forest', t: 'Forest' },
                { v: 'apartment', t: 'Apartment' },
                { v: 'lobby', t: 'Lobby' },
                { v: 'night', t: 'Night' },
                { v: 'park', t: 'Park' },
                { v: '', t: 'None (Custom HDR)' }
            ]
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Environment Intensity',
        path: 'render.envIntensity',
        type: 'slider',
        args: {
            min: 0,
            max: 4
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Environment Rotation',
        path: 'render.envRotation',
        type: 'slider',
        args: {
            min: 0,
            max: 360
        }
    },
    {
        type: 'divider'
    },
    {
        observer: 'sceneSettings',
        label: 'Ground Projection',
        path: 'render.groundEnabled',
        type: 'boolean'
    },
    {
        observer: 'sceneSettings',
        label: 'Ground Height',
        path: 'render.groundHeight',
        type: 'number',
        args: {
            min: -100,
            max: 100,
            step: 0.1
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Ground Radius',
        path: 'render.groundRadius',
        type: 'number',
        args: {
            min: 1,
            max: 1000,
            step: 1
        }
    }
];

class RenderingSettingsPanel extends BaseSettingsPanel {
    constructor(args: BaseSettingsPanelArgs) {
        args = Object.assign({}, args);
        args.headerText = 'SCENE ENVIRONMENT';
        args.attributes = ATTRIBUTES;
        args._tooltipReference = 'settings:rendering';

        super(args);

        this.class.add('rendering');

        const fogAttribute = this._attributesInspector.getField('render.fog');
        const updateFogFieldVisibility = (value: string) => {
            const showLinearFog = value === 'linear';
            const showExponentialFog = value === 'exponential';

            this._attributesInspector.getField('render.fog_color').parent.hidden = value === 'none';
            this._attributesInspector.getField('render.fog_start').parent.hidden = !showLinearFog;
            this._attributesInspector.getField('render.fog_end').parent.hidden = !showLinearFog;
            this._attributesInspector.getField('render.fog_density').parent.hidden = !showExponentialFog;
        };

        const refreshFogFieldVisibility = () => {
            updateFogFieldVisibility(String(this._sceneSettings?.get('render.fog') ?? fogAttribute.value ?? 'none'));
        };

        const fogChangeEvt = fogAttribute.on('change', refreshFogFieldVisibility);
        const fogObserverEvt = this._sceneSettings?.on('render.fog:set', refreshFogFieldVisibility);
        this.once('destroy', () => {
            fogChangeEvt.unbind();
            fogObserverEvt?.unbind();
        });
        refreshFogFieldVisibility();

        const groundAttribute = this._attributesInspector.getField('render.groundEnabled');
        const updateGroundFieldVisibility = (enabled: boolean) => {
            this._attributesInspector.getField('render.groundHeight').parent.hidden = !enabled;
            this._attributesInspector.getField('render.groundRadius').parent.hidden = !enabled;
        };

        const refreshGroundFieldVisibility = () => {
            updateGroundFieldVisibility(!!(this._sceneSettings?.get('render.groundEnabled') ?? groundAttribute.value));
        };

        const groundChangeEvt = groundAttribute.on('change', refreshGroundFieldVisibility);
        const groundObserverEvt = this._sceneSettings?.on('render.groundEnabled:set', refreshGroundFieldVisibility);
        this.once('destroy', () => {
            groundChangeEvt.unbind();
            groundObserverEvt?.unbind();
        });
        refreshGroundFieldVisibility();

        const environmentPresetField = this._attributesInspector.getField('render.envPreset');
        const environmentPresetGroup = environmentPresetField.parent;
        const environmentFileField = new Container({
            flex: true,
            flexDirection: 'row'
        });
        environmentFileField.dom.style.alignItems = 'center';
        environmentFileField.dom.style.gap = '8px';

        const environmentFileButton = new Button({
            text: 'Load HDR/EXR...'
        });
        environmentFileButton.dom.style.flexShrink = '0';

        const environmentFileName = document.createElement('span');
        environmentFileName.className = 'environment-file-name';
        environmentFileName.textContent = 'Use preset';
        Object.assign(environmentFileName.style, {
            flex: '1 1 auto',
            minWidth: '0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: '0.7'
        });

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.hdr,.exr';
        fileInput.hidden = true;

        environmentFileField.append(environmentFileButton);
        environmentFileField.dom.appendChild(environmentFileName);
        environmentFileField.dom.appendChild(fileInput);

        const environmentFileGroup = new LabelGroup({
            text: 'Environment File',
            field: environmentFileField
        });
        this._attributesInspector.append(environmentFileGroup);

        const environmentPresetIndex = Array.from(this._attributesInspector.dom.children)
            .findIndex((child) => child === environmentPresetGroup.dom);
        if (environmentPresetIndex >= 0) {
            this._attributesInspector.move(environmentFileGroup, environmentPresetIndex + 1);
        }

        let currentEnvironmentFileUrl: string | null = null;
        const revokeEnvironmentFileUrl = () => {
            if (!currentEnvironmentFileUrl || !currentEnvironmentFileUrl.startsWith('blob:')) {
                currentEnvironmentFileUrl = null;
                return;
            }

            URL.revokeObjectURL(currentEnvironmentFileUrl);
            currentEnvironmentFileUrl = null;
        };

        const toEnvironmentDataUrl = (file: File) => {
            return new Promise<string>((resolve, reject) => {
                const normalizedName = file.name.toLowerCase();
                const mimeType = normalizedName.endsWith('.exr') ? 'application/exr' : 'application/hdr';
                const reader = new FileReader();

                reader.onerror = () => {
                    reject(reader.error || new Error('Failed to read environment file'));
                };

                reader.onload = () => {
                    if (typeof reader.result !== 'string') {
                        reject(new Error('Environment file could not be encoded'));
                        return;
                    }

                    resolve(reader.result);
                };

                reader.readAsDataURL(new Blob([file], { type: mimeType }));
            });
        };

        const getBridge = () => {
            const bridge = editor.call('viewport:bridgeAdapter') as ObserverR3FBridge | null;
            if (bridge) {
                return bridge;
            }

            const viewportApp = editor.call('viewport:app') as { bridge?: ObserverR3FBridge } | null;
            return viewportApp?.bridge ?? null;
        };

        const keepSettingsPanelSelected = () => {
            const projectUserSettings = editor.call('settings:projectUser');
            if (!projectUserSettings) {
                return;
            }

            const restoreSelection = () => {
                editor.call('selector:set', 'editorSettings', [projectUserSettings]);
                editor.emit('attributes:inspect[editorSettings]');
            };

            window.setTimeout(restoreSelection, 0);
            window.setTimeout(restoreSelection, 100);
        };

        const environmentPresetChangeEvt = environmentPresetField.on('change', (value) => {
            if (value) {
                revokeEnvironmentFileUrl();
                environmentFileName.textContent = 'Use preset';
            }
        });
        const environmentPresetObserverEvt = this._sceneSettings?.on('render.envPreset:set', keepSettingsPanelSelected);

        const buttonClickEvt = environmentFileButton.on('click', () => {
            fileInput.click();
        });

        const onEnvironmentFileChange = async () => {
            const file = fileInput.files?.[0];
            fileInput.value = '';
            if (!file) {
                return;
            }

            const bridge = getBridge();
            if (!bridge) {
                console.warn('[rendering] viewport bridge is not available for environment uploads');
                return;
            }

            revokeEnvironmentFileUrl();

            try {
                currentEnvironmentFileUrl = await toEnvironmentDataUrl(file);
                bridge.loadEnvironment(currentEnvironmentFileUrl);
            } catch (error) {
                currentEnvironmentFileUrl = null;
                console.error('[rendering] Failed to read environment file', error);
                return;
            }

            if (this._sceneSettings) {
                this._sceneSettings.set('render.envPreset', '');
            } else {
                environmentPresetField.value = '';
            }

            environmentFileName.textContent = file.name;
        };

        fileInput.addEventListener('change', onEnvironmentFileChange);
        this.once('destroy', () => {
            buttonClickEvt.unbind();
            environmentPresetChangeEvt.unbind();
            environmentPresetObserverEvt?.unbind();
            fileInput.removeEventListener('change', onEnvironmentFileChange);
            revokeEnvironmentFileUrl();
        });
    }
}

export { RenderingSettingsPanel };
