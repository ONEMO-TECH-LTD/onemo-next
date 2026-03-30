import * as THREE from 'three';

import {
    clearBridgeComponent,
    createRectangleOutline,
    ensureBridgeHelper,
    ensureLabelSprite,
    getStoredBridgeComponentData,
    readNumber,
    updateRectangleOutline,
    setStoredBridgeComponentData
} from './bridge-utils';


const UI_WORLD_SCALE = 0.01;

const getLayoutchildDefaults = () => {
    return editor.call('components:getDefault', 'layoutchild') || {};
};

export const createLayoutchildData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'layoutchild', getLayoutchildDefaults());
};

export const createLayoutchildComponentData = createLayoutchildData;

export const applyLayoutchildObserverChange = (
    object: THREE.Object3D,
    _path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const data = observer.get('components.layoutchild');
    if (!data) {
        delete object.userData.layoutchild;
        clearBridgeComponent(object, 'layoutchild');
        return true;
    }

    setStoredBridgeComponentData(object, 'layoutchild', data);
    object.userData.layoutchild = data;

    const minWidth = Math.max(0.16, readNumber(observer.get('components.layoutchild.minWidth'), 32) * UI_WORLD_SCALE);
    const minHeight = Math.max(0.08, readNumber(observer.get('components.layoutchild.minHeight'), 16) * UI_WORLD_SCALE);

    const outline = ensureBridgeHelper(object, 'layoutchild:outline', () => {
        return createRectangleOutline(1, 1, '#f9a8d4', true);
    }) as THREE.Line;
    updateRectangleOutline(outline, minWidth, minHeight);
    outline.position.z = 0.014;
    outline.visible = !!observer.get('components.layoutchild.enabled');

    const label = ensureLabelSprite(object, 'layoutchild:label', {
        text: 'CHILD',
        backgroundColor: 'rgba(157, 23, 77, 0.84)',
        borderColor: 'rgba(251, 207, 232, 0.95)',
        scale: 0.005,
        fontSize: 30
    });
    label.position.set(0, minHeight * 0.5 + 0.07, 0.014);
    label.visible = outline.visible;

    return true;
};
