import type { EventHandle } from '@playcanvas/observer';
import { Button } from '@playcanvas/pcui';

import {
    LAYERID_DEPTH,
    LAYERID_SKYBOX,
    LAYERID_IMMEDIATE,
    SHADOW_PCF1_32F,
    SHADOW_PCF3_32F,
    SHADOW_PCF5_32F,
    SHADOW_PCSS_32F,
    SHADOW_VSM_16F,
    SHADOW_VSM_32F,
    SHADOWUPDATE_REALTIME,
    SHADOWUPDATE_THISFRAME
} from '@/common/playcanvas-compat';

import { LegacyTooltip } from '@/common/ui/tooltip';
import type { EntityObserver } from '@/editor-api';

import { ComponentInspector, type ComponentInspectorArgs } from './component';
import type { Attribute, Divider } from '../attribute.type.d';
import { AttributesInspector } from '../attributes-inspector';


const ATTRIBUTES: (Attribute | Divider)[] = [{
    label: 'Type',
    path: 'components.light.type',
    reference: 'light:type',
    type: 'select',
    args: {
        type: 'string',
        options: [{
            v: 'directional', t: 'Directional'
        }, {
            v: 'spot', t: 'Spot'
        }, {
            v: 'point', t: 'Omni'
        }]
    }
}, {
    label: 'Color',
    path: 'components.light.color',
    reference: 'light:color',
    type: 'rgb'
}, {
    label: 'Intensity',
    path: 'components.light.intensity',
    reference: 'light:intensity',
    type: 'slider',
    args: {
        precision: 2,
        min: 0,
        max: 32,
        step: 0.1
    }
}, {
    label: 'Range',
    path: 'components.light.range',
    reference: 'light:range',
    type: 'number',
    args: {
        precision: 2,
        step: 0.1,
        min: 0
    }
}, {
    label: 'Falloff Mode',
    path: 'components.light.falloffMode',
    reference: 'light:falloffMode',
    type: 'select',
    args: {
        type: 'number',
        options: [{
            v: 0, t: 'Linear'
        }, {
            v: 1, t: 'Inverse Squared'
        }]
    }
}, {
    label: 'Inner Cone Angle',
    path: 'components.light.innerConeAngle',
    reference: 'light:innerConeAngle',
    type: 'number',
    args: {
        precision: 2,
        step: 1,
        min: 0,
        max: 90
    }
}, {
    label: 'Outer Cone Angle',
    path: 'components.light.outerConeAngle',
    reference: 'light:outerConeAngle',
    type: 'number',
    args: {
        precision: 2,
        step: 1,
        min: 0,
        max: 90
    }
}, {
    label: 'Shape',
    path: 'components.light.shape',
    reference: 'light:shape',
    type: 'select',
    args: {
        type: 'number',
        options: [{
            v: 0, t: 'Punctual'
        }, {
            v: 1, t: 'Rectangle'
        }, {
            v: 2, t: 'Disk'
        }, {
            v: 3, t: 'Sphere'
        }]
    }
}, {
    type: 'divider'
}, {
    label: 'Affect Dynamic',
    path: 'components.light.affectDynamic',
    reference: 'light:affectDynamic',
    type: 'boolean'
}, {
    label: 'Affect Specularity',
    path: 'components.light.affectSpecularity',
    reference: 'light:affectSpecularity',
    type: 'boolean'
}, {
    type: 'divider'
}, {
    label: 'Cast Shadows',
    path: 'components.light.castShadows',
    reference: 'light:castShadows',
    type: 'boolean'
}, {
    label: 'Resolution',
    path: 'components.light.shadowResolution',
    reference: 'light:shadowResolution',
    type: 'select',
    args: {
        type: 'number',
        options: [{
            v: 16, t: '16 x 16'
        }, {
            v: 32, t: '32 x 32'
        }, {
            v: 64, t: '64 x 64'
        }, {
            v: 128, t: '128 x 128'
        }, {
            v: 256, t: '256 x 256'
        }, {
            v: 512, t: '512 x 512'
        },  {
            v: 1024, t: '1024 x 1024'
        }, {
            v: 2048, t: '2048 x 2048'
        }, {
            v: 4096, t: '4096 x 4096'
        }]
    }
}, {
    label: 'Distance',
    path: 'components.light.shadowDistance',
    reference: 'light:shadowDistance',
    type: 'number',
    args: {
        precision: 2,
        step: 1,
        min: 0
    }
}, {
    label: 'Shadow Bias',
    path: 'components.light.shadowBias',
    reference: 'light:shadowBias',
    type: 'number',
    args: {
        min: 0,
        max: 1,
        precision: 4,
        step: 0.001
    }
}, {
    label: 'Normal Offset Bias',
    path: 'components.light.normalOffsetBias',
    reference: 'light:normalOffsetBias',
    type: 'number',
    args: {
        min: 0,
        max: 1,
        precision: 3,
        step: 0.001
    }
}, {
    label: 'Penumbra Size',
    path: 'components.light.penumbraSize',
    reference: 'light:penumbraSize',
    type: 'number',
    args: {
        precision: 2,
        step: 0.1,
        min: 0
    }
}, {
    label: 'Penumbra Falloff',
    path: 'components.light.penumbraFalloff',
    reference: 'light:penumbraFalloff',
    type: 'number',
    args: {
        precision: 2,
        step: 0.1,
        min: 0
    }
}, {
    type: 'divider'
}, {
    label: 'Layers',
    path: 'components.light.layers',
    reference: 'light:layers',
    type: 'layers',
    args: {
        excludeLayers: [
            LAYERID_DEPTH,
            LAYERID_SKYBOX,
            LAYERID_IMMEDIATE
        ]
    }
}];

class LightComponentInspector extends ComponentInspector {
    _btnUpdateShadow: Button;

    _eventUpdateShadow: EventHandle | null = null;

    _suppressToggleFields = false;

    constructor(args: ComponentInspectorArgs) {
        args = Object.assign({}, args);
        args.component = 'light';

        super(args);

        this._attributesInspector = new AttributesInspector({
            assets: args.assets,
            projectSettings: args.projectSettings,
            history: args.history,
            attributes: ATTRIBUTES,
            templateOverridesInspector: this._templateOverridesInspector
        });
        this.append(this._attributesInspector);

        [
            'type',
            'castShadows',
            'affectDynamic',
            'shape'
        ].forEach((field) => {
            this._field(field)?.on('change', this._toggleFields.bind(this));
        });

        // add update shadow button
        this._btnUpdateShadow = new Button({
            size: 'small',
            icon: 'E128'
        });
        const shadowResolutionField = this._field('shadowResolution');
        shadowResolutionField?.parent.append(this._btnUpdateShadow);

        const tooltip = LegacyTooltip.attach({
            target: this._btnUpdateShadow.dom,
            text: 'Update Shadows',
            align: 'bottom',
            root: editor.call('layout.root')
        });
        this._btnUpdateShadow.once('destroy', () => {
            tooltip.destroy();
        });
    }

    _toggleFields() {
        if (this._suppressToggleFields) {
            return;
        }

        const type = this._field('type').value;
        const isDirectional = type === 'directional';
        const isSpot = type === 'spot';
        const isPoint = type === 'point';
        const castShadows = !!this._field('castShadows')?.value;

        const areaEnabled = editor.call('sceneSettings').get('render.lightingAreaLightsEnabled');
        const shape = this._field('shape')?.value;

        if (this._field('shape')) {
            this._field('shape').parent.hidden = !areaEnabled;
        }

        ['range', 'falloffMode'].forEach((field) => {
            this._field(field)?.parent && (this._field(field)!.parent.hidden = isDirectional);
        });

        // falloff mode is ignored on area lights
        if (areaEnabled && shape !== 0 && this._field('falloffMode')?.parent) {
            this._field('falloffMode')!.parent.hidden = true;
        }

        ['innerConeAngle', 'outerConeAngle'].forEach((field) => {
            this._field(field)?.parent && (this._field(field)!.parent.hidden = !isSpot);
        });

        // Avoid inner cone angle from being larger than outer cone angle
        this._resetInnerConeAngleLimit();
        this._field('outerConeAngle')?.on('change', this._resetInnerConeAngleLimit.bind(this));

        if (this._field('affectSpecularity')) {
            this._field('affectSpecularity').parent.hidden = !isDirectional;
        }

        this._field('shadowResolution')?.parent && (this._field('shadowResolution')!.parent.hidden = !castShadows);
        this._field('shadowDistance')?.parent && (this._field('shadowDistance')!.parent.hidden = !castShadows);

        ['shadowBias', 'normalOffsetBias', 'penumbraSize', 'penumbraFalloff'].forEach((field) => {
            this._field(field)?.parent && (this._field(field)!.parent.hidden = !castShadows);
        });

        this._btnUpdateShadow.hidden = !castShadows;
    }

    _updateShadows(entities: EntityObserver[]) {
        for (let i = 0; i < entities.length; i++) {
            if (entities[i].entity && entities[i].entity.light && entities[i].entity.light.shadowUpdateMode === SHADOWUPDATE_THISFRAME) {
                entities[i].entity.light.light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
            }
        }
        editor.call('viewport:render');
    }

    _resetInnerConeAngleLimit() {
        this._field('innerConeAngle').max = this._field('outerConeAngle').value;
    }

    link(entities: EntityObserver[]) {
        this._suppressToggleFields = true;
        super.link(entities);
        this._suppressToggleFields = false;
        this._toggleFields();

        this._eventUpdateShadow = this._btnUpdateShadow.on('click', () => {
            this._updateShadows(entities);
        });
    }

    unlink() {
        super.unlink();
        if (this._eventUpdateShadow) {
            this._eventUpdateShadow.unbind();
            this._eventUpdateShadow = null;
        }
    }
}

export { LightComponentInspector };
