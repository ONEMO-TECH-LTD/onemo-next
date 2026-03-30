import * as THREE from 'three';

import {
    clearBridgeComponent,
    ensureBridgeHelper,
    getStoredBridgeComponentData,
    isRecord,
    readNumber,
    readVec3,
    setStoredBridgeComponentData
} from './bridge-utils';


const NO_THREE_EQUIVALENT_PATHS = new Set([
    'components.collision.convexHull'
]);

const getCollisionDefaults = () => {
    return editor.call('components:getDefault', 'collision') || {};
};

const createCollisionGeometry = (object: THREE.Object3D, observer: import('@/editor-api').EntityObserver) => {
    const type = String(observer.get('components.collision.type') || 'box');
    const halfExtents = readVec3(observer.get('components.collision.halfExtents'), [0.5, 0.5, 0.5]);
    const radius = Math.max(0.001, readNumber(observer.get('components.collision.radius'), 0.5));
    const height = Math.max(0.001, readNumber(observer.get('components.collision.height'), 2));

    switch (type) {
        case 'sphere':
            return new THREE.SphereGeometry(radius, 16, 12);
        case 'cylinder':
            return new THREE.CylinderGeometry(radius, radius, height, 16, 1, true);
        case 'capsule':
            return new THREE.CapsuleGeometry(radius, Math.max(0.001, height - radius * 2), 6, 12);
        case 'mesh':
            if (object instanceof THREE.Mesh) {
                return object.geometry.clone();
            }
            return new THREE.BoxGeometry(1, 1, 1);
        default:
            return new THREE.BoxGeometry(
                Math.max(0.001, halfExtents[0] * 2),
                Math.max(0.001, halfExtents[1] * 2),
                Math.max(0.001, halfExtents[2] * 2)
            );
    }
};

export const createCollisionData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'collision', getCollisionDefaults());
};

export const createCollisionComponentData = createCollisionData;

export const applyCollisionObserverChange = (
    object: THREE.Object3D,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const collisionData = observer.get('components.collision');
    if (!collisionData) {
        clearBridgeComponent(object, 'collision');
        return true;
    }

    setStoredBridgeComponentData(object, 'collision', collisionData);

    if (NO_THREE_EQUIVALENT_PATHS.has(path)) {
        // No Three.js equivalent for convex-hull generation in the bridge.
        return true;
    }

    const helper = ensureBridgeHelper(object, 'collision:wireframe', () => {
        return new THREE.LineSegments(
            new THREE.WireframeGeometry(new THREE.BoxGeometry(1, 1, 1)),
            new THREE.LineBasicMaterial({
                color: '#58ff7d',
                transparent: true,
                opacity: 0.92
            })
        );
    });

    const geometry = createCollisionGeometry(object, observer);
    const axis = readNumber(observer.get('components.collision.axis'), 1);
    const linearOffset = readVec3(observer.get('components.collision.linearOffset'), [0, 0, 0]);
    const angularOffset = readVec3(observer.get('components.collision.angularOffset'), [0, 0, 0]);

    (helper as THREE.LineSegments).geometry.dispose();
    (helper as THREE.LineSegments).geometry = new THREE.WireframeGeometry(geometry);
    helper.position.set(linearOffset[0], linearOffset[1], linearOffset[2]);
    helper.rotation.set(
        THREE.MathUtils.degToRad(angularOffset[0]),
        THREE.MathUtils.degToRad(angularOffset[1]),
        THREE.MathUtils.degToRad(angularOffset[2])
    );

    if (axis === 0) {
        helper.rotation.z += Math.PI / 2;
    } else if (axis === 2) {
        helper.rotation.x += Math.PI / 2;
    }

    helper.visible = !!observer.get('components.collision.enabled');

    if (isRecord(collisionData) && (collisionData.asset || collisionData.renderAsset)) {
        // No Three.js equivalent for loading collision source assets in this visual-only bridge.
    }

    return true;
};
