import type { EventHandle } from '@playcanvas/observer';
import { Button, Container } from '@playcanvas/pcui';

import type { Attribute } from './attribute.type.d';
import { AttributesInspector } from './attributes-inspector';
import type { BaseSettingsPanelArgs } from './settings-panels/base';
import { EditorSettingsPanel } from './settings-panels/editor';
import { RenderingSettingsPanel } from './settings-panels/rendering';


const CLASS_ROOT = 'settings';

const SETTINGS_PANELS = [
    {
        id: 'rendering',
        label: 'Scene Environment',
        constructor: RenderingSettingsPanel
    },
    {
        id: 'editor',
        label: 'Editor',
        constructor: EditorSettingsPanel
    }
] as const;

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

    private _panelTabs: Record<string, Button> = {};

    private _panelInstances: Record<string, Container> = {};

    private _activePanelId = 'rendering';

    constructor(args: BaseSettingsPanelArgs) {
        args.flex = true;

        super(args);
        this._args = args;

        this.class.add(CLASS_ROOT);

        this.buildDom(DOM(this));

        const tabs = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'settings-tabs'
        });
        this.append(tabs);

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

        SETTINGS_PANELS.forEach((panelConfig) => {
            const tabButton = new Button({
                text: panelConfig.label,
                class: 'settings-tab-button'
            });
            tabButton.on('click', () => {
                this.setActivePanel(panelConfig.id);
            });
            tabs.append(tabButton);
            this._panelTabs[panelConfig.id] = tabButton;

            const panel = new panelConfig.constructor({
                history: args.history,
                assets: args.assets,
                entities: args.entities,
                settings: args.settings,
                projectSettings: args.projectSettings,
                userSettings: args.userSettings,
                sceneSettings: args.sceneSettings,
                sessionSettings: args.sessionSettings
            });
            panel.hidden = true;
            this.append(panel);
            this._panelInstances[panelConfig.id] = panel;
        });

        this.setActivePanel(this._activePanelId);

        this._linkSceneNameField();
    }

    setActivePanel(panelId: string) {
        this._activePanelId = this._panelInstances[panelId] ? panelId : 'rendering';

        Object.entries(this._panelInstances).forEach(([id, panel]) => {
            const isActive = id === this._activePanelId;
            panel.hidden = !isActive;
            if (isActive) {
                panel.collapsed = false;
            }
        });

        Object.entries(this._panelTabs).forEach(([id, button]) => {
            if (id === this._activePanelId) {
                button.class.add('active');
            } else {
                button.class.remove('active');
            }
        });
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
