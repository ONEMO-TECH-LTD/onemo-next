import * as THREE from 'three';

import {
    clearBridgeComponent,
    createRectangleOutline,
    ensureBridgeHelper,
    getStoredBridgeComponentData,
    readNumber,
    readVec2,
    updateRectangleOutline,
    setStoredBridgeComponentData
} from './bridge-utils';


const UI_WORLD_SCALE = 0.01;

const getScreenDefaults = () => {
    return editor.call('components:getDefault', 'screen') || {};
};

export const createScreenData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'screen', getScreenDefaults());
};

export const createScreenComponentData = createScreenData;

export const applyScreenObserverChange = (
    object: THREE.Object3D,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const screenData = observer.get('components.screen');
    if (!screenData) {
        clearBridgeComponent(object, 'screen');
        return true;
    }

    setStoredBridgeComponentData(object, 'screen', screenData);

    if (path === 'components.screen.scaleMode' || path === 'components.screen.scaleBlend') {
        // No direct Three.js equivalent for PlayCanvas screen scaling policy.
        return true;
    }

    const outline = ensureBridgeHelper(object, 'screen:outline', () => {
        return createRectangleOutline(1, 1, '#22d3ee');
    }) as THREE.Line;

    const referenceResolution = readVec2(observer.get('components.screen.referenceResolution'), [1280, 720]);
    const width = Math.max(0.24, referenceResolution[0] * UI_WORLD_SCALE);
    const height = Math.max(0.24, referenceResolution[1] * UI_WORLD_SCALE);
    updateRectangleOutline(outline, width, height);
    outline.visible = !!observer.get('components.screen.enabled');
    outline.position.z = 0.002;
    outline.scale.setScalar(observer.get('components.screen.screenSpace') ? 1 : 0.75);
    outline.renderOrder = readNumber(observer.get('components.screen.priority'), 0);

    return true;
};
