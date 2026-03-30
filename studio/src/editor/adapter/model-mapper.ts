import * as THREE from 'three';

import { clearBridgeComponent, ensureLabelSprite, getStoredBridgeComponentData, setStoredBridgeComponentData } from './bridge-utils';


const NO_THREE_EQUIVALENT_PATHS = new Set([
    'components.model.type',
    'components.model.asset',
    'components.model.materialAsset',
    'components.model.layers',
    'components.model.mapping',
    'components.model.batchGroupId',
    'components.model.isStatic',
    'components.model.aabbCenter',
    'components.model.aabbHalfExtents'
]);

const getModelDefaults = () => {
    return editor.call('components:getDefault', 'model') || {};
};

export const createModelData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'model', getModelDefaults());
};

export const createModelComponentData = createModelData;

export const applyModelObserverChange = (
    object: THREE.Object3D,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const modelData = observer.get('components.model');
    if (!modelData) {
        clearBridgeComponent(object, 'model');
        return true;
    }

    setStoredBridgeComponentData(object, 'model', modelData);

    if (NO_THREE_EQUIVALENT_PATHS.has(path)) {
        // No direct Three.js equivalent for this legacy model property in the bridge.
        return true;
    }

    if (object instanceof THREE.Mesh) {
        object.visible = !!observer.get('enabled') && !!observer.get('components.model.enabled');
        object.castShadow = !!observer.get('components.model.castShadows');
        object.receiveShadow = !!observer.get('components.model.receiveShadows');
    }

    const label = ensureLabelSprite(object, 'model:label', {
        text: 'MODEL',
        backgroundColor: 'rgba(71, 85, 105, 0.86)',
        borderColor: 'rgba(226, 232, 240, 0.95)',
        scale: 0.005,
        fontSize: 30
    });
    label.position.set(0, 0.48, 0);
    label.visible = !!observer.get('components.model.enabled');

    return true;
};
