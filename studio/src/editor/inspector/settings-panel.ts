import type { EventHandle } from '@playcanvas/observer';
import { Container } from '@playcanvas/pcui';

import type { Attribute } from './attribute.type.d';
import { AttributesInspector } from './attributes-inspector';
import type { BaseSettingsPanelArgs } from './settings-panels/base';
import { EditorSettingsPanel } from './settings-panels/editor';
import { PhysicsSettingsPanel } from './settings-panels/physics';
import { RenderingSettingsPanel } from './settings-panels/rendering';


const CLASS_ROOT = 'settings';

const SETTINGS_PANELS = [
    EditorSettingsPanel,
    PhysicsSettingsPanel,
    RenderingSettingsPanel
];

const ATTRIBUTES: Attribute[] = [
    {
        label: 'Scene Name',
        alias: 'name',
        reference: 'settings:name',
        type: 'string'
    }
];

const DOM = parent => [
    {
        sceneAttributes: new AttributesInspector({
            attributes: ATTRIBUTES,
            settings: parent._args.settings,
            projectSettings: parent._args.projectSettings,
            userSettings: parent._args.userSettings,
            sceneSettings: parent._args.sceneSettings
        })
    }
];

class SettingsPanel extends Container {
    private _args: BaseSettingsPanelArgs;

    private _settingsEvents: EventHandle[] = [];

    private _suspendSceneNameEvt = false;

    private _sceneName = 'Untitled';

    private _sceneAttributes: AttributesInspector;

    constructor(args: BaseSettingsPanelArgs) {
        args.flex = true;

        super(args);
        this._args = args;

        this.class.add(CLASS_ROOT);

        this.buildDom(DOM(this));

        editor.on('scene:raw', (data) => {
            editor.emit('scene:name', data.name);
            this._sceneName = data.name;
            const sceneNameField = this._sceneAttributes.getField('name');

            const suspend = this._suspendSceneNameEvt;
            this._suspendSceneNameEvt = true;
            sceneNameField.value = this._sceneName;
            this._suspendSceneNameEvt = suspend;
        });

        editor.on('realtime:scene:op:name', (op) => {
            editor.emit('scene:name', op.oi);
        });

        SETTINGS_PANELS.forEach((panelType) => {
            const panel = new panelType({
                history: args.history,
                assets: args.assets,
                entities: args.entities,
                settings: args.settings,
                projectSettings: args.projectSettings,
                userSettings: args.userSettings,
                sceneSettings: args.sceneSettings,
                sessionSettings: args.sessionSettings
            });
            this.append(panel);
        });

        this._linkSceneNameField();
    }

    _linkSceneNameField() {
        const sceneNameField = this._sceneAttributes.getField('name');
        sceneNameField.value = this._sceneName;
        this._settingsEvents.push(sceneNameField.on('change', (newSceneName) => {
            if (this._suspendSceneNameEvt) {
                return;
            }
            if (!editor.call('permissions:write')) {
                return;
            }

            editor.call('realtime:scene:op', {
                p: ['name'],
                od: this._sceneName || '',
                oi: newSceneName || ''
            });
            this._sceneName = newSceneName;
            editor.emit('scene:name', newSceneName);
        }));
    }
}

export { SettingsPanel };
