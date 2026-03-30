import * as THREE from 'three';

import {
    clearBridgeComponent,
    ensureBridgeHelper,
    ensureLabelSprite,
    getStoredBridgeComponentData,
    loadPlyGeometryAsset,
    readNumber,
    resolveAssetUrl,
    setStoredBridgeComponentData
} from './bridge-utils';


type GSplatRuntime = {
    loadToken: number;
};

const getGSplatDefaults = () => {
    return editor.call('components:getDefault', 'gsplat') || {};
};

const getGSplatRuntime = (object: THREE.Object3D): GSplatRuntime => {
    if (!object.userData.__gsplatRuntime) {
        object.userData.__gsplatRuntime = {
            loadToken: 0
        } satisfies GSplatRuntime;
    }

    return object.userData.__gsplatRuntime as GSplatRuntime;
};

const clearGSplatRuntime = (object: THREE.Object3D) => {
    delete object.userData.__gsplatRuntime;
    clearBridgeComponent(object, 'gsplat');
};

const updateGSplatPoints = async (
    observer: import('@/editor-api').EntityObserver,
    points: THREE.Points,
    runtime: GSplatRuntime
) => {
    const assetId = observer.get('components.gsplat.asset');
    const token = ++runtime.loadToken;
    const url = resolveAssetUrl(assetId);
    const geometry = url && url.toLowerCase().endsWith('.ply')
        ? await loadPlyGeometryAsset(assetId)
        : null;

    if (runtime.loadToken !== token) {
        return;
    }

    if (geometry) {
        const material = new THREE.PointsMaterial({
            size: 0.02,
            vertexColors: !!geometry.getAttribute('color'),
            color: geometry.getAttribute('color') ? '#ffffff' : '#9bd6ff',
            transparent: true,
            opacity: 0.95,
            depthWrite: false
        });
        points.geometry.dispose();
        points.geometry = geometry;
        points.material = material;
        return;
    }

    const fallbackPositions = new Float32Array(3 * 64);
    for (let i = 0; i < 64; i++) {
        fallbackPositions[i * 3] = (Math.random() - 0.5) * 0.6;
        fallbackPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
        fallbackPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    const fallbackGeometry = new THREE.BufferGeometry();
    fallbackGeometry.setAttribute('position', new THREE.BufferAttribute(fallbackPositions, 3));
    points.geometry.dispose();
    points.geometry = fallbackGeometry;
    points.material = new THREE.PointsMaterial({
        size: 0.035,
        color: '#9bd6ff'
    });
};

export const createGSplatData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'gsplat', getGSplatDefaults());
};

export const createGSplatComponentData = createGSplatData;

export const applyGSplatObserverChange = (
    object: THREE.Object3D,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const data = observer.get('components.gsplat');
    if (!data) {
        clearGSplatRuntime(object);
        return true;
    }

    setStoredBridgeComponentData(object, 'gsplat', data);

    if (path === 'components.gsplat.layers') {
        // No Three.js equivalent for PlayCanvas layer routing in this bridge.
        return true;
    }

    const label = ensureLabelSprite(object, 'gsplat:label', {
        text: 'GSPLAT',
        backgroundColor: 'rgba(31, 75, 119, 0.88)',
        borderColor: 'rgba(179, 223, 255, 0.95)',
        scale: 0.006,
        fontSize: 34
    });
    label.position.set(0, 0.58, 0);
    label.visible = !!observer.get('components.gsplat.enabled');

    const points = ensureBridgeHelper(object, 'gsplat:points', () => {
        return new THREE.Points(
            new THREE.BufferGeometry(),
            new THREE.PointsMaterial({
                size: 0.03,
                color: '#9bd6ff'
            })
        );
    });
    points.visible = !!observer.get('components.gsplat.enabled');
    points.renderOrder = 0;

    const runtime = getGSplatRuntime(object);
    void updateGSplatPoints(observer, points as THREE.Points, runtime);

    return true;
};
