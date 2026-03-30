import { Label } from '@playcanvas/pcui';

import { BaseSettingsPanel, type BaseSettingsPanelArgs } from './base';

class LayersSettingsPanel extends BaseSettingsPanel {
    constructor(args: BaseSettingsPanelArgs) {
        args = Object.assign({}, args);
        args.headerText = 'LAYERS';
        args.hideIcon = true;

        super(args);

        this.append(new Label({
            text: 'Layer composition editing is not available in ONEMO Studio.'
        }));
        this.collapsed = false;
    }
}

export { LayersSettingsPanel };
