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
        // Placeholder primitive type — actual geometry comes from the R3F scene, not this field.
        type: 'box',
        asset: null,
        castShadows: !!mesh.castShadow,
        castShadowsLightmap: false,
        receiveShadows: !!mesh.receiveShadow,
        isStatic: false,
        lightmapped: false,
        lightmapSizeMultiplier: 1,
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
