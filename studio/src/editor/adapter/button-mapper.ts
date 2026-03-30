import * as THREE from 'three';

import {
    clearBridgeComponent,
    createRectangleOutline,
    ensureBridgeHelper,
    getStoredBridgeComponentData,
    readColor4,
    readNumber,
    updateRectangleOutline,
    setStoredBridgeComponentData
} from './bridge-utils';


const UI_WORLD_SCALE = 0.01;

const getButtonDefaults = () => {
    return editor.call('components:getDefault', 'button') || {};
};

const getButtonSize = (observer: import('@/editor-api').EntityObserver) => {
    return [
        Math.max(0.24, readNumber(observer.get('components.element.width'), 100) * UI_WORLD_SCALE),
        Math.max(0.12, readNumber(observer.get('components.element.height'), 32) * UI_WORLD_SCALE)
    ] as [number, number];
};

export const createButtonData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'button', getButtonDefaults());
};

export const createButtonComponentData = createButtonData;

export const applyButtonObserverChange = (
    object: THREE.Object3D,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const buttonData = observer.get('components.button');
    if (!buttonData) {
        delete object.userData.button;
        clearBridgeComponent(object, 'button');
        return true;
    }

    setStoredBridgeComponentData(object, 'button', buttonData);
    object.userData.button = buttonData;

    if (path === 'components.button.imageEntity') {
        // No direct Three.js equivalent for remote image entity binding in the bridge.
        return true;
    }

    const outline = ensureBridgeHelper(object, 'button:outline', () => {
        return createRectangleOutline(1, 1, '#60a5fa');
    }) as THREE.Line;

    const [width, height] = getButtonSize(observer);
    updateRectangleOutline(outline, width, height);
    outline.position.z = 0.008;
    outline.visible = !!observer.get('components.button.enabled');

    const active = !!observer.get('components.button.active');
    const tint = active
        ? readColor4(observer.get('components.button.hoverTint'), [0.47, 0.84, 1, 1])
        : readColor4(observer.get('components.button.inactiveTint'), [0.58, 0.63, 0.7, 1]);
    ((outline.material as THREE.LineBasicMaterial).color).setRGB(tint[0], tint[1], tint[2]);
    (outline.material as THREE.LineBasicMaterial).opacity = tint[3];

    return true;
};
