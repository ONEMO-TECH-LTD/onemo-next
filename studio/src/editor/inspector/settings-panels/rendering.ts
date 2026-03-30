import type { Label } from '@playcanvas/pcui';

import { TONEMAPPING } from '@/core/constants';

import { BaseSettingsPanel, type BaseSettingsPanelArgs } from './base';
import type { Attribute, Divider } from '../attribute.type.d';

const ATTRIBUTES: (Attribute | Divider)[] = [
    {
        observer: 'sceneSettings',
        label: 'Ambient Color',
        path: 'render.global_ambient',
        alias: 'ambientColor',
        reference: 'settings:ambientColor',
        type: 'rgb'
    },
    {
        observer: 'sceneSettings',
        label: 'Skybox',
        path: 'render.skybox',
        reference: 'settings:skybox',
        type: 'asset',
        args: {
            assetType: 'cubemap'
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Type',
        path: 'render.skyType',
        reference: 'settings:skyType',
        type: 'select',
        args: {
            type: 'string',
            options: [
                {
                    v: 'infinite',
                    t: 'Infinite'
                },
                {
                    v: 'box',
                    t: 'Box'
                },
                {
                    v: 'dome',
                    t: 'Dome'
                }
            ]
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Mesh Position',
        path: 'render.skyMeshPosition',
        reference: 'settings:skyMeshPosition',
        type: 'vec3',
        args: {
            placeholder: ['X', 'Y', 'Z']
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Mesh Rotation',
        path: 'render.skyMeshRotation',
        reference: 'settings:skyMeshRotation',
        type: 'vec3',
        args: {
            placeholder: ['X', 'Y', 'Z']
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Mesh Scale',
        path: 'render.skyMeshScale',
        reference: 'settings:skyMeshScale',
        type: 'vec3',
        args: {
            placeholder: ['X', 'Y', 'Z'],
            step: 1,
            precision: 3
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Sky Center',
        path: 'render.skyCenter',
        reference: 'settings:skyCenter',
        type: 'vec3',
        args: {
            placeholder: ['X', 'Y', 'Z']
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Intensity',
        path: 'render.skyboxIntensity',
        reference: 'settings:skyboxIntensity',
        type: 'slider',
        args: {
            min: 0,
            max: 8
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Rotation',
        path: 'render.skyboxRotation',
        reference: 'settings:skyboxRotation',
        type: 'vec3',
        args: {
            placeholder: ['X', 'Y', 'Z']
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Mip',
        path: 'render.skyboxMip',
        reference: 'settings:skyboxMip',
        type: 'select',
        args: {
            type: 'number',
            options: [
                {
                    v: 0,
                    t: '1'
                },
                {
                    v: 1,
                    t: '2'
                },
                {
                    v: 2,
                    t: '3'
                },
                {
                    v: 3,
                    t: '4'
                },
                {
                    v: 4,
                    t: '5'
                }
            ]
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Sky Depth Write',
        path: 'render.skyDepthWrite',
        reference: 'settings:skyDepthWrite',
        type: 'boolean'
    },
    {
        observer: 'sceneSettings',
        label: 'Tonemapping',
        reference: 'settings:toneMapping',
        path: 'render.tonemapping',
        type: 'select',
        args: {
            type: 'number',
            options: TONEMAPPING.map((v, i) => {
                return {
                    v: i,
                    t: v
                };
            })
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Exposure',
        path: 'render.exposure',
        reference: 'settings:exposure',
        type: 'slider',
        args: {
            min: 0,
            max: 8
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Gamma',
        reference: 'settings:gammaCorrection',
        path: 'render.gamma_correction',
        type: 'select',
        args: {
            type: 'number',
            options: [
                {
                    v: 0,
                    t: '1.0'
                },
                {
                    v: 1,
                    t: '2.2'
                }
            ]
        }
    },
    {
        type: 'divider'
    },
    {
        observer: 'sceneSettings',
        label: 'Fog',
        path: 'render.fog',
        reference: 'settings:fog',
        type: 'select',
        args: {
            type: 'string',
            options: [
                {
                    v: 'none',
                    t: 'None'
                },
                {
                    v: 'linear',
                    t: 'Linear'
                },
                {
                    v: 'exp',
                    t: 'Exponential'
                },
                {
                    v: 'exp2',
                    t: 'Exponential Squared'
                }
            ]
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Distance Start',
        alias: 'fogDistance',
        reference: 'settings:fogDistance',
        path: 'render.fog_start',
        type: 'number',
        args: {
            min: 0
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Distance End',
        alias: 'fogDistance',
        reference: 'settings:fogDistance',
        path: 'render.fog_end',
        type: 'number',
        args: {
            min: 0
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Density',
        alias: 'fogDensity',
        reference: 'settings:fogDensity',
        path: 'render.fog_density',
        type: 'number',
        args: {
            min: 0
        }
    },
    {
        observer: 'sceneSettings',
        label: 'Color',
        alias: 'fogColor',
        reference: 'settings:fogColor',
        path: 'render.fog_color',
        type: 'rgb'
    },
    {
        type: 'divider'
    },
    {
        observer: 'projectSettings',
        label: 'Resolution Width',
        path: 'width',
        type: 'number',
        args: {
            min: 1
        },
        reference: 'settings:project:width'
    },
    {
        observer: 'projectSettings',
        label: 'Resolution Height',
        path: 'height',
        type: 'number',
        args: {
            min: 1
        },
        reference: 'settings:project:height'
    },
    {
        observer: 'projectSettings',
        label: 'Resolution Mode',
        path: 'resolutionMode',
        alias: 'project:resolutionMode',
        reference: 'settings:project:resolutionMode',
        type: 'select',
        args: {
            type: 'string',
            options: [
                {
                    v: 'AUTO',
                    t: 'Auto'
                },
                {
                    v: 'FIXED',
                    t: 'Fixed'
                }
            ]
        }
    },
    {
        observer: 'projectSettings',
        label: 'Fill Mode',
        path: 'fillMode',
        alias: 'project:fillMode',
        reference: 'settings:project:fillMode',
        type: 'select',
        args: {
            type: 'string',
            options: [
                {
                    v: 'NONE',
                    t: 'None'
                },
                {
                    v: 'KEEP_ASPECT',
                    t: 'Keep aspect ratio'
                },
                {
                    v: 'FILL_WINDOW',
                    t: 'Fill window'
                }
            ]
        }
    },
    {
        type: 'divider'
    },
    {
        label: 'Device Order',
        reference: 'settings:project:deviceOrder',
        path: 'deviceOrder',
        type: 'label',
        args: {
            text: 'WebGL 2.0'
        }
    },
    {
        observer: 'projectSettings',
        label: `Enable WebGPU${editor.projectEngineV2 ? '' : ' (beta)'}`,
        type: 'boolean',
        reference: 'settings:project:enableWebGpu',
        path: 'enableWebGpu'
    },
    {
        observer: 'projectSettings',
        label: 'Enable WebGL 2.0',
        type: 'boolean',
        reference: 'settings:project:enableWebGl2',
        path: 'enableWebGl2'
    },
    {
        type: 'divider'
    },
    {
        observer: 'projectSettings',
        label: 'Power Preference',
        type: 'select',
        alias: 'project:powerPreference',
        reference: 'settings:project:powerPreference',
        path: 'powerPreference',
        args: {
            type: 'string',
            options: [
                {
                    v: 'default',
                    t: 'Default'
                },
                {
                    v: 'low-power',
                    t: 'Low Power'
                },
                {
                    v: 'high-performance',
                    t: 'High Performance'
                }
            ]
        }
    },
    {
        observer: 'projectSettings',
        label: 'Anti-aliasing',
        type: 'boolean',
        alias: 'project:antiAlias',
        reference: 'settings:project:antiAlias',
        path: 'antiAlias'
    },
    {
        observer: 'projectSettings',
        label: 'Device Pixel Ratio',
        type: 'boolean',
        alias: 'project:pixelRatio',
        reference: 'settings:project:pixelRatio',
        path: 'useDevicePixelRatio'
    },
    {
        observer: 'projectSettings',
        label: 'Transparent Canvas',
        type: 'boolean',
        alias: 'project:transparentCanvas',
        reference: 'settings:project:transparentCanvas',
        path: 'transparentCanvas'
    },
    {
        observer: 'projectSettings',
        label: 'Preserve Drawing Buffer',
        type: 'boolean',
        alias: 'project:preserveDrawingBuffer',
        reference: 'settings:project:preserveDrawingBuffer',
        path: 'preserveDrawingBuffer'
    },
    {
        type: 'divider'
    },
    {
        label: 'Basis Library',
        alias: 'basis',
        reference: 'settings:basis',
        type: 'button',
        args: {
            text: 'IMPORT BASIS',
            icon: 'E228'
        }
    },
    {
        label: 'Draco Library',
        alias: 'draco',
        reference: 'settings:draco',
        type: 'button',
        args: {
            text: 'IMPORT DRACO',
            icon: 'E228'
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
        const fogChangeEvt = fogAttribute.on('change', (value) => {
            switch (value) {
                case 'none':
                    this._attributesInspector.getField('render.fog_start').parent.hidden = true;
                    this._attributesInspector.getField('render.fog_end').parent.hidden = true;
                    this._attributesInspector.getField('render.fog_density').parent.hidden = true;
                    this._attributesInspector.getField('render.fog_color').parent.hidden = true;
                    break;
                case 'linear':
                    this._attributesInspector.getField('render.fog_start').parent.hidden = false;
                    this._attributesInspector.getField('render.fog_end').parent.hidden = false;
                    this._attributesInspector.getField('render.fog_density').parent.hidden = true;
                    this._attributesInspector.getField('render.fog_color').parent.hidden = false;
                    break;
                case 'exp':
                    this._attributesInspector.getField('render.fog_start').parent.hidden = true;
                    this._attributesInspector.getField('render.fog_end').parent.hidden = true;
                    this._attributesInspector.getField('render.fog_density').parent.hidden = false;
                    this._attributesInspector.getField('render.fog_color').parent.hidden = false;
                    break;
                case 'exp2':
                    this._attributesInspector.getField('render.fog_start').parent.hidden = true;
                    this._attributesInspector.getField('render.fog_end').parent.hidden = true;
                    this._attributesInspector.getField('render.fog_density').parent.hidden = false;
                    this._attributesInspector.getField('render.fog_color').parent.hidden = false;
                    break;
                default:
                    break;
            }
        });
        this.once('destroy', () => {
            fogChangeEvt.unbind();
        });

        const clickBasisEvt = this._attributesInspector.getField('basis').on('click', () => {
            editor.call('project:module:addModule', 'basis.js', 'basis');
        });
        this.once('destroy', () => {
            clickBasisEvt.unbind();
        });

        const clickDracoEvt = this._attributesInspector.getField('draco').on('click', () => {
            editor.call('project:module:addModule', 'draco.js', 'draco');
        });
        this.once('destroy', () => {
            clickDracoEvt.unbind();
        });

        const skyType = this._attributesInspector.getField('render.skyType');
        const skyMeshPosition = this._attributesInspector.getField('render.skyMeshPosition');
        const skyMeshRotation = this._attributesInspector.getField('render.skyMeshRotation');
        const skyMeshScale = this._attributesInspector.getField('render.skyMeshScale');
        const skyCenter = this._attributesInspector.getField('render.skyCenter');

        skyType.on('change', (value) => {
            switch (value) {
                case 'infinite':
                    skyMeshPosition.parent.hidden = true;
                    skyMeshRotation.parent.hidden = true;
                    skyMeshScale.parent.hidden = true;
                    skyCenter.parent.hidden = true;
                    break;
                case 'box':
                case 'dome':
                    skyMeshPosition.parent.hidden = false;
                    skyMeshRotation.parent.hidden = false;
                    skyMeshScale.parent.hidden = false;
                    skyCenter.parent.hidden = false;
                    break;
            }
        });

        const deviceOrder = this._attributesInspector.getField('deviceOrder');

        const enableWebGpu = this._attributesInspector.getField('enableWebGpu');
        const enableWebGl2 = this._attributesInspector.getField('enableWebGl2');

        const onDeviceChange = () => {
            (deviceOrder as Label).text = [
                enableWebGpu.value ? `WebGPU${editor.projectEngineV2 ? '' : ' (beta)'}` : '',
                enableWebGl2.value ? 'WebGL 2.0' : '',
                editor.projectEngineV2 ? '' : 'WebGL 1.0'
            ].filter(Boolean).join(' ► ');
            setTimeout(() => editor.emit('toolbar:launch:refresh'));
        };
        enableWebGpu.on('change', onDeviceChange);
        enableWebGl2.on('change', onDeviceChange);

        onDeviceChange();

        this._attributesInspector.getField('render.tonemapping').parent.hidden = editor.projectEngineV2;
        this._attributesInspector.getField('render.gamma_correction').parent.hidden = editor.projectEngineV2;
    }
}

export { RenderingSettingsPanel };
