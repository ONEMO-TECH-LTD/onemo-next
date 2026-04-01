import * as THREE from 'three';

export type ViewerCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

const NO_DIRECT_CAMERA_EQUIVALENT_PATHS = new Set<string>();
const DEFAULT_CAMERA_RECT = [0, 0, 1, 1] as const;
const DEFAULT_CAMERA_LAYERS = [0, 1, 2, 3, 4] as const;

const toObserverColor = (color: THREE.Color) => {
    return [color.r, color.g, color.b, 1];
};

const getCameraDefaults = () => {
    return editor.call('components:getDefault', 'camera') || {};
};

const getCameraUserSetting = <T>(camera: ViewerCamera, key: string, fallback: T): T => {
    return (camera.userData?.[key] ?? fallback) as T;
};

const normalizeCameraRect = (value: unknown) => {
    if (!Array.isArray(value) || value.length < 4) {
        return [...DEFAULT_CAMERA_RECT];
    }

    return DEFAULT_CAMERA_RECT.map((fallback, index) => {
        return Number(value[index] ?? fallback);
    });
};

const normalizeCameraLayers = (value: unknown) => {
    if (!Array.isArray(value) || value.length === 0) {
        return [...DEFAULT_CAMERA_LAYERS];
    }

    return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    return THREE.MathUtils.clamp(numeric, min, max);
};

export const createCameraComponentData = (camera: ViewerCamera, scene: THREE.Scene) => {
    const defaults = getCameraDefaults();
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const orthographicCamera = camera as THREE.OrthographicCamera;
    const background = scene.background instanceof THREE.Color ? scene.background : new THREE.Color('#ffffff');
    const defaultRect = normalizeCameraRect(defaults.rect);
    const defaultLayers = normalizeCameraLayers(defaults.layers);

    return {
        ...defaults,
        enabled: true,
        clearColorBuffer: getCameraUserSetting(camera, 'clearColorBuffer', true),
        clearDepthBuffer: getCameraUserSetting(camera, 'clearDepthBuffer', true),
        clearColor: getCameraUserSetting(camera, 'clearColor', toObserverColor(background)),
        renderSceneDepthMap: getCameraUserSetting(camera, 'renderSceneDepthMap', defaults.renderSceneDepthMap),
        renderSceneColorMap: getCameraUserSetting(camera, 'renderSceneColorMap', defaults.renderSceneColorMap),
        projection: camera instanceof THREE.OrthographicCamera ? 1 : getCameraUserSetting(camera, 'projection', 0),
        frustumCulling: getCameraUserSetting(camera, 'frustumCulling', defaults.frustumCulling ?? false),
        fov: camera instanceof THREE.PerspectiveCamera ? perspectiveCamera.fov : defaults.fov,
        orthoHeight: camera instanceof THREE.OrthographicCamera ? Math.abs(orthographicCamera.top) : defaults.orthoHeight,
        nearClip: camera.near,
        farClip: camera.far,
        priority: getCameraUserSetting(camera, 'priority', defaults.priority ?? 0),
        rect: normalizeCameraRect(getCameraUserSetting(camera, 'rect', defaultRect)),
        layers: normalizeCameraLayers(getCameraUserSetting(camera, 'layers', defaultLayers)),
        toneMapping: getCameraUserSetting(camera, 'toneMapping', defaults.toneMapping ?? 0),
        gammaCorrection: getCameraUserSetting(camera, 'gammaCorrection', defaults.gammaCorrection ?? 1)
    };
};

export const createReplacementCameraForProjection = (
    camera: ViewerCamera,
    observer: import('@/editor-api').EntityObserver
): ViewerCamera | null => {
    const projection = Number(observer.get('components.camera.projection') ?? 0);

    if (projection === 0 && !(camera instanceof THREE.PerspectiveCamera)) {
        const ortho = camera as THREE.OrthographicCamera;
        const fov = Number(observer.get('components.camera.fov') ?? 45);
        const aspect = Math.abs(ortho.right - ortho.left) / Math.abs(ortho.top - ortho.bottom) || 1;
        const persp = new THREE.PerspectiveCamera(fov, aspect, camera.near, camera.far);
        persp.position.copy(camera.position);
        persp.rotation.copy(camera.rotation);
        persp.visible = camera.visible;
        persp.name = camera.name;
        persp.userData = { ...camera.userData };
        persp.updateProjectionMatrix();
        return persp;
    }

    if (projection === 1 && !(camera instanceof THREE.OrthographicCamera)) {
        const persp = camera as THREE.PerspectiveCamera;
        const height = Number(observer.get('components.camera.orthoHeight') ?? 10);
        const aspect = persp.aspect || 1;
        const ortho = new THREE.OrthographicCamera(
            -height * aspect, height * aspect,
            height, -height,
            camera.near, camera.far
        );
        ortho.position.copy(camera.position);
        ortho.rotation.copy(camera.rotation);
        ortho.visible = camera.visible;
        ortho.name = camera.name;
        ortho.userData = { ...camera.userData };
        ortho.updateProjectionMatrix();
        return ortho;
    }

    return null;
};

export const applyCameraObserverChange = (
    camera: ViewerCamera,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    if (NO_DIRECT_CAMERA_EQUIVALENT_PATHS.has(path)) {
        // Perspective/orthographic camera swapping requires recreating the
        // active R3F camera, so the current bridge does not mutate it here.
        return false;
    }

    let projectionNeedsUpdate = false;

    if (path === 'components.camera.enabled') {
        camera.visible = !!observer.get('enabled') && !!observer.get('components.camera.enabled');
        return true;
    }

    if (path === 'components.camera.clearColorBuffer') {
        camera.userData.clearColorBuffer = !!observer.get('components.camera.clearColorBuffer');
        return true;
    }

    if (path === 'components.camera.clearDepthBuffer') {
        camera.userData.clearDepthBuffer = !!observer.get('components.camera.clearDepthBuffer');
        return true;
    }

    if (path === 'components.camera.clearColor') {
        camera.userData.clearColor = observer.get('components.camera.clearColor') || [1, 1, 1, 1];
        return true;
    }

    if (path === 'components.camera.renderSceneDepthMap') {
        camera.userData.renderSceneDepthMap = !!observer.get('components.camera.renderSceneDepthMap');
        return true;
    }

    if (path === 'components.camera.renderSceneColorMap') {
        camera.userData.renderSceneColorMap = !!observer.get('components.camera.renderSceneColorMap');
        return true;
    }

    if (path === 'components.camera.frustumCulling') {
        const value = !!observer.get('components.camera.frustumCulling');
        camera.userData.frustumCulling = value;
        camera.frustumCulling = value;
        return true;
    }

    if (path === 'components.camera.fov' && camera instanceof THREE.PerspectiveCamera) {
        camera.fov = clampNumber(observer.get('components.camera.fov'), camera.fov, 0, 180);
        projectionNeedsUpdate = true;
    }

    if (path === 'components.camera.nearClip') {
        camera.near = Math.max(0.0001, Number(observer.get('components.camera.nearClip') ?? camera.near));
        projectionNeedsUpdate = true;
    }

    if (path === 'components.camera.farClip') {
        camera.far = Math.max(camera.near + 0.0001, Number(observer.get('components.camera.farClip') ?? camera.far));
        projectionNeedsUpdate = true;
    }

    if (path === 'components.camera.orthoHeight' && camera instanceof THREE.OrthographicCamera) {
        const height = Math.max(0.0001, Number(observer.get('components.camera.orthoHeight') ?? Math.abs(camera.top)));
        camera.top = height;
        camera.bottom = -height;
        projectionNeedsUpdate = true;
    }

    if (path === 'components.camera.priority') {
        camera.userData.priority = Number(observer.get('components.camera.priority') ?? 0);
        return true;
    }

    if (path === 'components.camera.rect') {
        camera.userData.rect = observer.get('components.camera.rect');
        return true;
    }

    if (path === 'components.camera.layers') {
        const layerValue = observer.get('components.camera.layers');
        camera.userData.layers = layerValue;
        if (Array.isArray(layerValue)) {
            camera.layers.disableAll();
            layerValue.forEach((layer: number) => camera.layers.enable(layer));
        } else if (typeof layerValue === 'number') {
            camera.layers.mask = layerValue;
        }
        return true;
    }

    if (path === 'components.camera.toneMapping') {
        camera.userData.toneMapping = Number(observer.get('components.camera.toneMapping') ?? 0);
        return true;
    }

    if (path === 'components.camera.gammaCorrection') {
        camera.userData.gammaCorrection = Number(observer.get('components.camera.gammaCorrection') ?? 1);
        return true;
    }

    if (projectionNeedsUpdate) {
        camera.updateProjectionMatrix();
        return true;
    }

    return false;
};
