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

const getLayoutgroupDefaults = () => {
    return editor.call('components:getDefault', 'layoutgroup') || {};
};

const getLayoutSize = (observer: import('@/editor-api').EntityObserver) => {
    return [
        Math.max(0.24, readNumber(observer.get('components.element.width'), 100) * UI_WORLD_SCALE),
        Math.max(0.12, readNumber(observer.get('components.element.height'), 32) * UI_WORLD_SCALE)
    ] as [number, number];
};

export const createLayoutgroupData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'layoutgroup', getLayoutgroupDefaults());
};

export const createLayoutgroupComponentData = createLayoutgroupData;

export const applyLayoutgroupObserverChange = (
    object: THREE.Object3D,
    _path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const data = observer.get('components.layoutgroup');
    if (!data) {
        delete object.userData.layoutgroup;
        clearBridgeComponent(object, 'layoutgroup');
        return true;
    }

    setStoredBridgeComponentData(object, 'layoutgroup', data);
    object.userData.layoutgroup = data;

    const outline = ensureBridgeHelper(object, 'layoutgroup:outline', () => {
        return createRectangleOutline(1, 1, '#c084fc', true);
    }) as THREE.Line;
    const [width, height] = getLayoutSize(observer);
    updateRectangleOutline(outline, width, height);
    outline.position.z = 0.012;
    outline.visible = !!observer.get('components.layoutgroup.enabled');

    const label = ensureLabelSprite(object, 'layoutgroup:label', {
        text: readNumber(observer.get('components.layoutgroup.orientation'), 0) === 0 ? 'LAYOUT H' : 'LAYOUT V',
        backgroundColor: 'rgba(88, 28, 135, 0.84)',
        borderColor: 'rgba(224, 181, 255, 0.95)',
        scale: 0.005,
        fontSize: 30
    });
    label.position.set(0, height * 0.5 + 0.08, 0.012);
    label.visible = outline.visible;

    return true;
};
