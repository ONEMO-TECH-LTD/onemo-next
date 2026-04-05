import { BaseSettingsPanel, type BaseSettingsPanelArgs } from './base';
import type { Attribute, Divider } from '../attribute.type.d';

const ATTRIBUTES: (Attribute | Divider)[] = [
    {
        observer: 'settings',
        label: 'Field of View',
        path: 'editor.cameraFov',
        alias: 'cameraFov',
        reference: 'settings:cameraFov',
        type: 'number',
        args: {
            min: 1,
            max: 179,
            precision: 1,
            placeholder: '35'
        }
    },
    {
        observer: 'settings',
        label: 'Projection',
        path: 'editor.cameraProjection',
        alias: 'cameraProjection',
        reference: 'settings:cameraProjection',
        type: 'select',
        args: {
            type: 'string',
            options: [
                {
                    v: 'perspective',
                    t: 'Perspective'
                },
                {
                    v: 'orthographic',
                    t: 'Orthographic'
                }
            ]
        }
    },
    {
        alias: 'divider:0',
        type: 'divider'
    },
    {
        observer: 'settings',
        label: 'Near Clip',
        alias: 'cameraClip',
        reference: 'settings:cameraClip',
        path: 'editor.cameraNearClip',
        type: 'number',
        args: {
            min: 0
        }
    },
    {
        observer: 'settings',
        label: 'Far Clip',
        alias: 'cameraClip',
        reference: 'settings:cameraClip',
        path: 'editor.cameraFarClip',
        type: 'number',
        args: {
            min: 0
        }
    },
    {
        alias: 'divider:1',
        type: 'divider'
    },
    {
        observer: 'settings',
        label: 'Clear Color',
        path: 'editor.cameraClearColor',
        alias: 'clearColor',
        reference: 'settings:cameraClearColor',
        type: 'rgba'
    },
    {
        observer: 'settings',
        label: 'Depth Grabpass',
        path: 'editor.cameraGrabDepth',
        alias: 'cameraGrabDepth',
        reference: 'settings:cameraGrabDepth',
        type: 'boolean'
    },
    {
        observer: 'settings',
        label: 'Color Grabpass',
        path: 'editor.cameraGrabColor',
        alias: 'cameraGrabColor',
        reference: 'settings:cameraGrabColor',
        type: 'boolean'
    },
    {
        alias: 'divider:2',
        type: 'divider'
    },
    {
        observer: 'userSettings',
        label: 'Zoom Sensitivity',
        type: 'slider',
        alias: 'zoomSensitivity',
        reference: 'settings:zoomSensitivity',
        path: 'editor.zoomSensitivity',
        args: {
            value: 1,
            min: 1,
            sliderMin: 1,
            max: 15,
            sliderMax: 15,
            step: 1
        }
    }
];

class EditorCameraSettingsPanel extends BaseSettingsPanel {
    constructor(args: BaseSettingsPanelArgs) {
        args = Object.assign({}, args);
        args.headerText = 'EDITOR CAMERA';
        args.attributes = ATTRIBUTES;
        args._tooltipReference = 'settings:editorCamera';

        super(args);

        // Initialize defaults for new fields that don't exist in the scene settings
        const fieldFov = this._field('cameraFov');
        if (fieldFov && (fieldFov.value === undefined || fieldFov.value === null || fieldFov.value === 0 || fieldFov.value === 1)) {
            fieldFov.value = 35;
        }

        const fieldProjection = this._field('cameraProjection');
        if (fieldProjection && !fieldProjection.value) {
            fieldProjection.value = 'perspective';
        }

        // Wire FOV and projection changes to the R3F viewport
        if (fieldFov) {
            fieldFov.on('change', (value: number) => {
                editor.emit('r3f:viewer:editorCameraFov', value);
            });
        }

        if (fieldProjection) {
            fieldProjection.on('change', (value: string) => {
                editor.emit('r3f:viewer:editorCameraProjection', value);
            });
        }

        const fieldNear = this._field('cameraNearClip');
        if (fieldNear) {
            fieldNear.on('change', (value: number) => {
                editor.emit('r3f:viewer:editorCameraNear', value);
            });
        }

        const fieldFar = this._field('cameraFarClip');
        if (fieldFar) {
            fieldFar.on('change', (value: number) => {
                editor.emit('r3f:viewer:editorCameraFar', value);
            });
        }
    }

    _field(name: string) {
        return this._attributesInspector.getField(`editor.${name}`);
    }
}

export { EditorCameraSettingsPanel };
