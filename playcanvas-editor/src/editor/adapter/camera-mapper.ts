import * as THREE from 'three';


const toObserverColor = (color: THREE.Color) => {
    return [color.r, color.g, color.b, 1];
};

const getCameraDefaults = () => {
    return editor.call('components:getDefault', 'camera') || {};
};

export const createCameraComponentData = (camera: THREE.Camera, scene: THREE.Scene) => {
    const defaults = getCameraDefaults();
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const orthographicCamera = camera as THREE.OrthographicCamera;
    const background = scene.background instanceof THREE.Color ? scene.background : new THREE.Color('#ffffff');

    return {
        ...defaults,
        enabled: true,
        clearColorBuffer: true,
        clearDepthBuffer: true,
        clearColor: toObserverColor(background),
        projection: camera instanceof THREE.OrthographicCamera ? 1 : 0,
        fov: camera instanceof THREE.PerspectiveCamera ? perspectiveCamera.fov : defaults.fov,
        orthoHeight: camera instanceof THREE.OrthographicCamera ? Math.abs(orthographicCamera.top) : defaults.orthoHeight,
        nearClip: camera.near,
        farClip: camera.far
    };
};

export const applyCameraObserverChange = (
    camera: THREE.Camera,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    let projectionNeedsUpdate = false;

    if (path === 'components.camera.enabled') {
        // visible is used for bridge state tracking (editor show/hide), not to disable camera rendering.
        camera.visible = !!observer.get('enabled') && !!observer.get('components.camera.enabled');
        return true;
    }

    if (path === 'components.camera.fov' && camera instanceof THREE.PerspectiveCamera) {
        camera.fov = Number(observer.get('components.camera.fov') ?? camera.fov);
        projectionNeedsUpdate = true;
    }

    if (path === 'components.camera.nearClip') {
        camera.near = Number(observer.get('components.camera.nearClip') ?? camera.near);
        projectionNeedsUpdate = true;
    }

    if (path === 'components.camera.farClip') {
        camera.far = Number(observer.get('components.camera.farClip') ?? camera.far);
        projectionNeedsUpdate = true;
    }

    if (path === 'components.camera.orthoHeight' && camera instanceof THREE.OrthographicCamera) {
        const height = Number(observer.get('components.camera.orthoHeight') ?? Math.abs(camera.top));
        camera.top = height;
        camera.bottom = -height;
        projectionNeedsUpdate = true;
    }

    if (projectionNeedsUpdate) {
        camera.updateProjectionMatrix();
        return true;
    }

    return false;
};
