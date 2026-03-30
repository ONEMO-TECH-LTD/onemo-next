import { BaseSettingsPanel, type BaseSettingsPanelArgs } from './base';

class LayersSettingsPanelRenderOrderPanel extends BaseSettingsPanel {
    constructor(args: BaseSettingsPanelArgs) {
        args = Object.assign({}, args);
        args.headerText = 'RENDER ORDER';
        args.hideIcon = true;

        super(args);

        this.hidden = true;
    }
}

export { LayersSettingsPanelRenderOrderPanel };
