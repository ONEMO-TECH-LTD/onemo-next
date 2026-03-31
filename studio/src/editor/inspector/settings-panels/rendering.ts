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
                { v: 5, t: 'AgX' },
                { v: 6, t: 'Neutral' }
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
                { v: '', t: 'None (Custom HDR)' },
                { v: 'studio', t: 'Studio' },
                { v: 'city', t: 'City' },
                { v: 'sunset', t: 'Sunset' },
                { v: 'dawn', t: 'Dawn' },
                { v: 'warehouse', t: 'Warehouse' },
                { v: 'forest', t: 'Forest' },
                { v: 'apartment', t: 'Apartment' },
                { v: 'lobby', t: 'Lobby' },
                { v: 'night', t: 'Night' },
                { v: 'park', t: 'Park' }
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
        args.headerText = 'RENDERING';
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

        const fogChangeEvt = fogAttribute.on('change', (value) => {
            switch (value) {
                case 'none':
                case 'linear':
                case 'exponential':
                    updateFogFieldVisibility(value);
                    break;
                default:
                    updateFogFieldVisibility('none');
                    break;
            }
        });
        this.once('destroy', () => {
            fogChangeEvt.unbind();
        });
        updateFogFieldVisibility(String(fogAttribute.value ?? 'none'));

        const groundAttribute = this._attributesInspector.getField('render.groundEnabled');
        const updateGroundFieldVisibility = (enabled: boolean) => {
            this._attributesInspector.getField('render.groundHeight').parent.hidden = !enabled;
            this._attributesInspector.getField('render.groundRadius').parent.hidden = !enabled;
        };

        const groundChangeEvt = groundAttribute.on('change', (value) => {
            updateGroundFieldVisibility(!!value);
        });
        this.once('destroy', () => {
            groundChangeEvt.unbind();
        });
        updateGroundFieldVisibility(!!groundAttribute.value);
    }
}

export { RenderingSettingsPanel };
