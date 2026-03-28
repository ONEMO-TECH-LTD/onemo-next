import * as THREE from 'three';

// Returns RGB[3] for light colors. Camera colors use RGBA[4] (camera-mapper.ts).
// PlayCanvas Observer expects 3-component colors for lights, 4-component for camera clear color.
const toObserverColor = (color: THREE.Color) => {
    return [color.r, color.g, color.b];
};

const getLightDefaults = () => {
    return editor.call('components:getDefault', 'light') || {};
};

export const createLightComponentData = (light: THREE.Light) => {
    const defaults = getLightDefaults();
    const pointLight = light as THREE.PointLight;
    const spotLight = light as THREE.SpotLight;

    return {
        ...defaults,
        enabled: true,
        type: light instanceof THREE.SpotLight ? 'spot' : light instanceof THREE.PointLight ? 'point' : 'directional',
        color: toObserverColor(light.color),
        intensity: light.intensity,
        range: light instanceof THREE.PointLight || light instanceof THREE.SpotLight ? pointLight.distance || 0 : 0,
        castShadows: !!light.castShadow,
        innerConeAngle: light instanceof THREE.SpotLight ? THREE.MathUtils.radToDeg(spotLight.angle * (1 - spotLight.penumbra)) : defaults.innerConeAngle,
        outerConeAngle: light instanceof THREE.SpotLight ? THREE.MathUtils.radToDeg(spotLight.angle) : defaults.outerConeAngle
    };
};

export const applyLightObserverChange = (
    light: THREE.Light,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    if (path === 'components.light.enabled') {
        light.visible = !!observer.get('enabled') && !!observer.get('components.light.enabled');
        return true;
    }

    if (path === 'components.light.color') {
        const value = observer.get('components.light.color') || [1, 1, 1];
        light.color.setRGB(value[0] ?? 1, value[1] ?? 1, value[2] ?? 1);
        return true;
    }

    if (path === 'components.light.intensity') {
        light.intensity = Number(observer.get('components.light.intensity') ?? light.intensity);
        return true;
    }

    if (path === 'components.light.castShadows') {
        light.castShadow = !!observer.get('components.light.castShadows');
        return true;
    }

    if (path === 'components.light.range' && (light instanceof THREE.PointLight || light instanceof THREE.SpotLight)) {
        light.distance = Number(observer.get('components.light.range') ?? light.distance);
        return true;
    }

    if (light instanceof THREE.SpotLight && (
        path === 'components.light.innerConeAngle' ||
        path === 'components.light.outerConeAngle'
    )) {
        const outerCone = Number(observer.get('components.light.outerConeAngle') ?? 45);
        const innerCone = Number(observer.get('components.light.innerConeAngle') ?? outerCone);
        light.angle = THREE.MathUtils.degToRad(outerCone);
        light.penumbra = THREE.MathUtils.clamp(1 - (innerCone / Math.max(outerCone, 0.0001)), 0, 1);
        return true;
    }

    return false;
};
