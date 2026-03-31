import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

const NO_THREE_EQUIVALENT_LIGHT_PATHS = new Set([
    'components.light.type',
    'components.light.isStatic',
    'components.light.bake',
    'components.light.bakeDir',
    'components.light.bakeNumSamples',
    'components.light.bakeArea',
    'components.light.affectLightmapped',
    'components.light.affectDynamic',
    'components.light.affectSpecularity',
    'components.light.shadowUpdateMode',
    'components.light.shadowType',
    'components.light.vsmBlurMode',
    'components.light.vsmBlurSize',
    'components.light.vsmBias',
    'components.light.shadowIntensity',
    'components.light.numCascades',
    'components.light.cascadeDistribution',
    'components.light.penumbraFalloff',
    'components.light.cookieAsset',
    'components.light.cookieIntensity',
    'components.light.cookieAngle',
    'components.light.cookieOffset',
    'components.light.cookieScale',
    'components.light.cookieFalloff',
    'components.light.cookieChannel',
    'components.light.layers'
]);

const toObserverColor = (color: THREE.Color) => {
    return [color.r, color.g, color.b];
};

const getLightDefaults = () => {
    return editor.call('components:getDefault', 'light') || {};
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    return THREE.MathUtils.clamp(numeric, min, max);
};

const readLightColor = (value: unknown) => {
    if (!Array.isArray(value)) {
        return [1, 1, 1] as const;
    }

    return [
        Number(value[0] ?? 1),
        Number(value[1] ?? 1),
        Number(value[2] ?? 1)
    ] as const;
};

const getShadow = (light: THREE.Light) => {
    if (light instanceof THREE.DirectionalLight || light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        return light.shadow;
    }

    return null;
};

const getLightRange = (light: THREE.Light) => {
    if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        return light.distance || 0;
    }

    return 0;
};

const getLightFalloffMode = (light: THREE.Light) => {
    if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        return light.decay === 2 ? 1 : 0;
    }

    return 1;
};

const getLightShape = (light: THREE.Light, defaults: Record<string, unknown>) => {
    if (light instanceof THREE.RectAreaLight) {
        return 1;
    }

    return Number(defaults.shape ?? 0);
};

export const createLightComponentData = (light: THREE.Light) => {
    const defaults = getLightDefaults();
    const spotLight = light as THREE.SpotLight;
    const shadow = getShadow(light);

    return {
        ...defaults,
        enabled: true,
        type: light instanceof THREE.SpotLight ? 'spot' : light instanceof THREE.PointLight ? 'point' : 'directional',
        color: toObserverColor(light.color),
        intensity: light.intensity,
        range: getLightRange(light),
        castShadows: !!light.castShadow,
        innerConeAngle: light instanceof THREE.SpotLight ? THREE.MathUtils.radToDeg(spotLight.angle * (1 - spotLight.penumbra)) : defaults.innerConeAngle,
        outerConeAngle: light instanceof THREE.SpotLight ? THREE.MathUtils.radToDeg(spotLight.angle) : defaults.outerConeAngle,
        falloffMode: getLightFalloffMode(light),
        shape: getLightShape(light, defaults),
        shadowResolution: shadow?.mapSize?.x ?? defaults.shadowResolution,
        shadowBias: shadow?.bias ?? defaults.shadowBias,
        normalOffsetBias: shadow?.normalBias ?? defaults.normalOffsetBias,
        shadowDistance: shadow?.camera && 'far' in shadow.camera ? (shadow.camera.far ?? defaults.shadowDistance) : defaults.shadowDistance
    };
};

export const createReplacementLightForShape = (
    light: THREE.Light,
    observer: import('@/editor-api').EntityObserver
): THREE.Light | null => {
    const shape = Number(observer.get('components.light.shape') ?? 0);
    const color = light.color.clone();
    const intensity = light.intensity;

    if (shape === 1 && !(light instanceof THREE.RectAreaLight)) {
        RectAreaLightUniformsLib.init();
        const rect = new THREE.RectAreaLight(color, intensity, 1, 1);
        rect.position.copy(light.position);
        rect.rotation.copy(light.rotation);
        rect.visible = light.visible;
        rect.name = light.name;
        rect.userData = { ...light.userData };
        return rect;
    }

    if (shape === 0 && light instanceof THREE.RectAreaLight) {
        const lightType = String(observer.get('components.light.type') ?? 'directional');
        let newLight: THREE.Light;
        if (lightType === 'spot') {
            newLight = new THREE.SpotLight(color, intensity);
        } else if (lightType === 'point') {
            newLight = new THREE.PointLight(color, intensity);
        } else {
            newLight = new THREE.DirectionalLight(color, intensity);
        }
        newLight.position.copy(light.position);
        newLight.rotation.copy(light.rotation);
        newLight.visible = light.visible;
        newLight.name = light.name;
        newLight.userData = { ...light.userData };
        return newLight;
    }

    return null;
};

export const applyLightObserverChange = (
    light: THREE.Light,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    if (NO_THREE_EQUIVALENT_LIGHT_PATHS.has(path)) {
        // No direct Three.js equivalent for this PlayCanvas-era light control
        // in the current bridge light architecture.
        return false;
    }

    if (path === 'components.light.enabled') {
        light.visible = !!observer.get('enabled') && !!observer.get('components.light.enabled');
        return true;
    }

    if (path === 'components.light.color') {
        const value = readLightColor(observer.get('components.light.color'));
        light.color.setRGB(value[0], value[1], value[2]);
        return true;
    }

    if (path === 'components.light.intensity') {
        light.intensity = Math.max(0, Number(observer.get('components.light.intensity') ?? light.intensity));
        return true;
    }

    if (path === 'components.light.castShadows') {
        light.castShadow = !!observer.get('components.light.castShadows');
        return true;
    }

    if (path === 'components.light.range' && (light instanceof THREE.PointLight || light instanceof THREE.SpotLight)) {
        light.distance = Math.max(0, Number(observer.get('components.light.range') ?? light.distance));
        return true;
    }

    if (path === 'components.light.falloffMode' && (light instanceof THREE.PointLight || light instanceof THREE.SpotLight)) {
        light.decay = Number(observer.get('components.light.falloffMode')) === 1 ? 2 : 0;
        return true;
    }

    if (light instanceof THREE.SpotLight && (
        path === 'components.light.innerConeAngle' ||
        path === 'components.light.outerConeAngle' ||
        path === 'components.light.penumbraSize'
    )) {
        const outerCone = clampNumber(observer.get('components.light.outerConeAngle'), 45, 0, 90);
        const innerCone = clampNumber(observer.get('components.light.innerConeAngle'), outerCone, 0, outerCone || 90);
        light.angle = THREE.MathUtils.degToRad(outerCone);
        light.penumbra = THREE.MathUtils.clamp(
            Number(observer.get('components.light.penumbraSize') ?? (1 - (innerCone / Math.max(outerCone, 0.0001)))),
            0,
            1
        );
        return true;
    }

    const shadow = getShadow(light);
    if (!shadow) {
        return false;
    }

    if (path === 'components.light.shadowResolution') {
        const resolution = Math.max(16, Number(observer.get('components.light.shadowResolution') ?? shadow.mapSize.x));
        shadow.mapSize.set(resolution, resolution);
        if ('dispose' in shadow.map && typeof shadow.map?.dispose === 'function') {
            shadow.map.dispose();
        }
        return true;
    }

    if (path === 'components.light.shadowBias') {
        shadow.bias = Number(observer.get('components.light.shadowBias') ?? shadow.bias);
        return true;
    }

    if (path === 'components.light.normalOffsetBias') {
        shadow.normalBias = Number(observer.get('components.light.normalOffsetBias') ?? shadow.normalBias);
        return true;
    }

    if (path === 'components.light.shadowDistance' && shadow.camera && 'far' in shadow.camera) {
        shadow.camera.far = Math.max(0, Number(observer.get('components.light.shadowDistance') ?? shadow.camera.far));
        shadow.camera.updateProjectionMatrix?.();
        return true;
    }

    if (path === 'components.light.shape') {
        // No stable in-place light-class swap here. RectAreaLight would require
        // recreating the bridge light, so the current runtime skips this field.
        return false;
    }

    return false;
};
