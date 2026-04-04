import * as THREE from 'three';

import { getStoredBridgeComponentData, setStoredBridgeComponentData } from './bridge-utils';

const getRenderDefaults = () => {
    return editor.call('components:getDefault', 'render') || {};
};

export const createRenderComponentData = (object: THREE.Object3D, materialAssetIds: number[]) => {
    const defaults = getRenderDefaults();
    const stored = getStoredBridgeComponentData(object, 'render', defaults);
    const mesh = object as THREE.Mesh;

    return {
        ...defaults,
        ...stored,
        enabled: typeof stored.enabled === 'boolean' ? stored.enabled : true,
        type: typeof stored.type === 'string' ? stored.type : 'asset',
        asset: stored.asset ?? null,
        castShadows: !!mesh.castShadow,
        receiveShadows: !!mesh.receiveShadow,
        isStatic: typeof stored.isStatic === 'boolean' ? stored.isStatic : false,
        materialAssets: materialAssetIds.length ? materialAssetIds : (Array.isArray(stored.materialAssets) ? stored.materialAssets : [null])
    };
};

export const applyRenderObserverChange = (
    object: THREE.Object3D,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    if (!(object instanceof THREE.Mesh)) {
        return false;
    }

    const renderData = observer.get('components.render');
    if (renderData) {
        setStoredBridgeComponentData(object, 'render', renderData);
    }

    if (path === 'components.render.enabled') {
        object.visible = !!observer.get('enabled') && !!observer.get('components.render.enabled');
        return true;
    }

    if (path === 'components.render.castShadows') {
        object.castShadow = !!observer.get('components.render.castShadows');
        return true;
    }

    if (path === 'components.render.receiveShadows') {
        object.receiveShadow = !!observer.get('components.render.receiveShadows');
        return true;
    }

    return false;
};
