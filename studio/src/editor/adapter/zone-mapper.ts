import * as THREE from 'three';

import { clearBridgeComponent, ensureBridgeHelper, getStoredBridgeComponentData, readVec3, setStoredBridgeComponentData } from './bridge-utils';


const getZoneDefaults = () => {
    return editor.call('components:getDefault', 'zone') || {};
};

export const createZoneData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'zone', getZoneDefaults());
};

export const createZoneComponentData = createZoneData;

export const applyZoneObserverChange = (
    object: THREE.Object3D,
    _path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const zoneData = observer.get('components.zone');
    if (!zoneData) {
        clearBridgeComponent(object, 'zone');
        return true;
    }

    setStoredBridgeComponentData(object, 'zone', zoneData);

    const size = readVec3(observer.get('components.zone.size'), [1, 1, 1]);
    const helper = ensureBridgeHelper(object, 'zone:wireframe', () => {
        return new THREE.LineSegments(
            new THREE.WireframeGeometry(new THREE.BoxGeometry(1, 1, 1)),
            new THREE.LineBasicMaterial({
                color: '#fde047',
                transparent: true,
                opacity: 0.92
            })
        );
    });
    (helper as THREE.LineSegments).geometry.dispose();
    (helper as THREE.LineSegments).geometry = new THREE.WireframeGeometry(
        new THREE.BoxGeometry(
            Math.max(0.001, size[0]),
            Math.max(0.001, size[1]),
            Math.max(0.001, size[2])
        )
    );
    helper.visible = !!observer.get('components.zone.enabled');

    return true;
};
