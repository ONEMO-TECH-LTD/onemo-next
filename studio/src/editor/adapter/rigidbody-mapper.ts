import * as THREE from 'three';

import {
    clearBridgeComponent,
    ensureBridgeHelper,
    getStoredBridgeComponentData,
    readNumber,
    setStoredBridgeComponentData
} from './bridge-utils';


const getRigidbodyDefaults = () => {
    return editor.call('components:getDefault', 'rigidbody') || {};
};

export const createRigidbodyData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'rigidbody', getRigidbodyDefaults());
};

export const createRigidbodyComponentData = createRigidbodyData;

export const applyRigidbodyObserverChange = (
    object: THREE.Object3D,
    _path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const rigidbodyData = observer.get('components.rigidbody');
    if (!rigidbodyData) {
        delete object.userData.rigidbody;
        clearBridgeComponent(object, 'rigidbody');
        return true;
    }

    setStoredBridgeComponentData(object, 'rigidbody', rigidbodyData);
    object.userData.rigidbody = rigidbodyData;

    const type = String(observer.get('components.rigidbody.type') || 'static');
    const arrow = ensureBridgeHelper(object, 'rigidbody:arrow', () => {
        return new THREE.ArrowHelper(
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0.32, 0),
            0.4,
            '#7eb6ff'
        );
    });

    const color = type === 'dynamic'
        ? '#ff7a59'
        : type === 'kinematic'
            ? '#ffd866'
            : '#7eb6ff';
    (arrow as THREE.ArrowHelper).setColor(new THREE.Color(color));
    (arrow as THREE.ArrowHelper).setLength(0.25 + Math.min(0.75, readNumber(observer.get('components.rigidbody.mass'), 1) * 0.1));
    arrow.visible = !!observer.get('components.rigidbody.enabled') && type === 'dynamic';

    return true;
};
