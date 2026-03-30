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

const getScrollviewDefaults = () => {
    return editor.call('components:getDefault', 'scrollview') || {};
};

const getScrollbarDefaults = () => {
    return editor.call('components:getDefault', 'scrollbar') || {};
};

const getScrollRectSize = (observer: import('@/editor-api').EntityObserver) => {
    return [
        Math.max(0.24, readNumber(observer.get('components.element.width'), 100) * UI_WORLD_SCALE),
        Math.max(0.16, readNumber(observer.get('components.element.height'), 48) * UI_WORLD_SCALE)
    ] as [number, number];
};

export const createScrollviewData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'scrollview', getScrollviewDefaults());
};

export const createScrollviewComponentData = createScrollviewData;

export const applyScrollviewObserverChange = (
    object: THREE.Object3D,
    _path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const scrollviewData = observer.get('components.scrollview');
    const scrollbarData = observer.get('components.scrollbar');
    if (!scrollviewData && !scrollbarData) {
        delete object.userData.scrollview;
        delete object.userData.scrollbar;
        clearBridgeComponent(object, 'scrollview');
        clearBridgeComponent(object, 'scrollbar');
        return true;
    }

    if (scrollviewData) {
        setStoredBridgeComponentData(object, 'scrollview', scrollviewData);
        object.userData.scrollview = scrollviewData;
    } else {
        delete object.userData.scrollview;
    }
    if (scrollbarData) {
        setStoredBridgeComponentData(object, 'scrollbar', scrollbarData);
        object.userData.scrollbar = scrollbarData;
    } else {
        delete object.userData.scrollbar;
    }

    const [width, height] = getScrollRectSize(observer);
    const outline = ensureBridgeHelper(object, 'scrollview:outline', () => {
        return createRectangleOutline(1, 1, '#38bdf8');
    }) as THREE.Line;
    updateRectangleOutline(outline, width, height);
    outline.visible = !!(observer.get('components.scrollview.enabled') ?? observer.get('components.scrollbar.enabled'));
    outline.position.z = 0.016;

    const label = ensureLabelSprite(object, 'scrollview:label', {
        text: 'SCROLL',
        backgroundColor: 'rgba(8, 47, 73, 0.86)',
        borderColor: 'rgba(186, 230, 253, 0.95)',
        scale: 0.005,
        fontSize: 30
    });
    label.position.set(0, height * 0.5 + 0.08, 0.016);
    label.visible = outline.visible;

    const arrowX = ensureBridgeHelper(object, 'scrollview:arrow-x', () => {
        return new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-0.2, 0, 0), 0.4, '#38bdf8');
    });
    const arrowY = ensureBridgeHelper(object, 'scrollview:arrow-y', () => {
        return new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -0.2, 0), 0.4, '#38bdf8');
    });
    arrowX.visible = !!observer.get('components.scrollview.horizontal');
    arrowY.visible = !!observer.get('components.scrollview.vertical');
    arrowX.position.z = 0.016;
    arrowY.position.z = 0.016;

    const handle = ensureBridgeHelper(object, 'scrollbar:handle', () => {
        return createRectangleOutline(0.4, 0.08, '#fbbf24');
    }) as THREE.Line;
    const orientation = readNumber(observer.get('components.scrollbar.orientation'), 0);
    const handleSize = THREE.MathUtils.clamp(readNumber(observer.get('components.scrollbar.handleSize'), 0.5), 0.05, 1);
    const handleValue = THREE.MathUtils.clamp(readNumber(observer.get('components.scrollbar.value'), 0), 0, 1);
    if (orientation === 0) {
        updateRectangleOutline(handle, width * handleSize, Math.max(0.05, height * 0.12));
        handle.position.set((-width * 0.5) + (width * handleValue), -height * 0.55, 0.02);
    } else {
        updateRectangleOutline(handle, Math.max(0.05, width * 0.12), height * handleSize);
        handle.position.set(width * 0.55, (-height * 0.5) + (height * handleValue), 0.02);
    }
    handle.visible = !!observer.get('components.scrollbar.enabled');

    return true;
};
