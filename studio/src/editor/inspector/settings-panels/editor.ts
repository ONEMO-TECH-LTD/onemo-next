import { BaseSettingsPanel, type BaseSettingsPanelArgs } from './base';
import type { Attribute, Divider } from '../attribute.type.d';

const ATTRIBUTES: (Attribute | Divider)[] = [
    {
        observer: 'settings',
        label: 'Show Grid',
        path: 'editor.showGrid',
        alias: 'showGrid',
        reference: 'settings:showGrid',
        type: 'boolean'
    },
    {
        observer: 'settings',
        label: 'Grid Divisions',
        path: 'editor.gridDivisions',
        alias: 'grid',
        reference: 'settings:grid',
        type: 'number',
        args: {
            min: 0,
            max: 100,
            precision: 0
        }
    },
    {
        observer: 'settings',
        label: 'Grid Division Size',
        path: 'editor.gridDivisionSize',
        alias: 'grid',
        reference: 'settings:grid',
        type: 'number',
        args: {
            min: 0,
            max: 100
        }
    },
    {
        observer: 'settings',
        label: 'Snap',
        path: 'editor.snapIncrement',
        alias: 'snap',
        reference: 'settings:snap',
        type: 'number',
        args: {
            min: 0,
            max: 100,
            placeholder: 'Increment'
        }
    },
    {
        alias: 'divider:0',
        type: 'divider'
    },
    {
        observer: 'userSettings',
        label: 'Gizmo Size',
        type: 'slider',
        reference: 'settings:gizmoSize',
        path: 'editor.gizmoSize',
        args: {
            min: 0.1,
            max: 5,
            step: 0.1
        }
    },
    {
        observer: 'userSettings',
        label: 'Gizmo Preset',
        path: 'editor.gizmoPreset',
        reference: 'settings:gizmoPreset',
        type: 'select',
        args: {
            type: 'string',
            options: [
                {
                    v: 'default',
                    t: 'Default'
                },
                {
                    v: 'classic',
                    t: 'Classic'
                }
            ]
        }
    },
    {
        observer: 'userSettings',
        label: 'Show View Cube',
        path: 'editor.showViewCube',
        alias: 'showViewCube',
        reference: 'settings:showViewCube',
        type: 'boolean'
    },
    {
        observer: 'userSettings',
        label: 'View Cube Size',
        type: 'slider',
        reference: 'settings:viewCubeSize',
        path: 'editor.viewCubeSize',
        args: {
            min: 0.5,
            max: 2,
            step: 0.1
        }
    },
    {
        alias: 'divider:1',
        type: 'divider'
    },
    {
        observer: 'settings',
        label: 'Show Fog',
        path: 'editor.showFog',
        alias: 'showFog',
        reference: 'settings:showFog',
        type: 'boolean'
    },
    {
        observer: 'userSettings',
        label: 'Icons Size',
        path: 'editor.iconSize',
        alias: 'iconSize',
        reference: 'settings:iconSize',
        type: 'number',
        args: {
            min: 0,
            max: 100
        }
    },
    {
        observer: 'settings',
        label: 'Locale',
        path: 'editor.locale',
        reference: 'settings:locale',
        type: 'string'
    },
    {
        observer: 'settings',
        path: 'editor.renameDuplicatedEntities',
        reference: 'settings:renameDuplicatedEntities',
        label: 'Rename Duplicated Entities',
        type: 'boolean'
    },
    {
        alias: 'divider:3',
        type: 'divider'
    },
    {
        observer: 'settings',
        path: 'editor.codeEditor',
        reference: 'settings:codeEditor',
        label: 'Code Editor',
        type: 'select',
        args: {
            type: 'string',
            options: [
                {
                    v: 'web',
                    t: 'Web'
                },
                {
                    v: 'vscode',
                    t: 'VS Code'
                },
                {
                    v: 'cursor',
                    t: 'Cursor'
                }
            ]
        }
    }
];

class EditorSettingsPanel extends BaseSettingsPanel {
    constructor(args: BaseSettingsPanelArgs) {
        args = Object.assign({}, args);
        args.headerText = 'EDITOR';
        args.attributes = ATTRIBUTES;
        args.userOnlySettings = true;
        args._tooltipReference = 'settings:editor';

        super(args);

        const fieldShowViewCube = this._field('showViewCube');
        const fieldViewCubeSize = this._field('viewCubeSize');
        fieldViewCubeSize.parent.hidden = !fieldShowViewCube.value;
        fieldShowViewCube.on('change', (value: boolean) => {
            fieldViewCubeSize.parent.hidden = !value;
        });
    }

    _field(name: string) {
        return this._attributesInspector.getField(`editor.${name}`);
    }
}

export { EditorSettingsPanel };
