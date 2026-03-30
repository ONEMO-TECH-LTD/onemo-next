import * as THREE from 'three';


const getRenderDefaults = () => {
    return editor.call('components:getDefault', 'render') || {};
};

export const createRenderComponentData = (object: THREE.Object3D, materialAssetIds: number[]) => {
    const defaults = getRenderDefaults();
    const mesh = object as THREE.Mesh;

    return {
        ...defaults,
        enabled: true,
        // Imported meshes are external assets; the bridge does not author primitives here.
        type: 'asset',
        asset: null,
        castShadows: !!mesh.castShadow,
        receiveShadows: !!mesh.receiveShadow,
        isStatic: false,
        materialAssets: materialAssetIds.length ? materialAssetIds : [null]
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
