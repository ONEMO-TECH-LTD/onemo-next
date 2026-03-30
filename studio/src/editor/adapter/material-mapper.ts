import * as THREE from 'three';

import { BLEND_NONE, BLEND_NORMAL } from './constants';

declare const editor: any;

const toObserverColor = (color?: THREE.Color) => {
    if (!color) {
        return [0, 0, 0];
    }

    return [color.r, color.g, color.b];
};

const toGlossiness = (roughness = 0) => {
    return THREE.MathUtils.clamp((1 - roughness) * 100, 0, 100);
};

const toRoughness = (shininess = 100) => {
    return THREE.MathUtils.clamp(1 - (shininess / 100), 0, 1);
};

// Maps inspector gloss slider (0–1) to Three.js roughness; when invert is false, gloss 1 → roughness 0.
const glossSliderToRoughness = (gloss: number, invert: boolean) => {
    return THREE.MathUtils.clamp(invert ? gloss : 1 - gloss, 0, 1);
};

const getMaterialDefaults = (existingData: Record<string, unknown> = {}) => {
    return editor.call('schema:material:getDefaultData', existingData) || {};
};

const getPhysicalMaterial = (material: THREE.Material) => {
    if (material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshStandardMaterial) {
        return material;
    }

    return null;
};

export const createMaterialData = (material: THREE.Material, existingData: Record<string, unknown> = {}) => {
    const physicalMaterial = getPhysicalMaterial(material);
    const defaults = getMaterialDefaults(existingData);

    if (!physicalMaterial) {
        return {
            ...defaults,
            ...existingData
        };
    }

    return {
        ...defaults,
        ...existingData,
        useMetalness: true,
        diffuse: toObserverColor(physicalMaterial.color),
        metalness: physicalMaterial.metalness ?? defaults.metalness,
        // Intentional dual authority: roughness (0–1) is canonical for Three.js; shininess (0–100) is the
        // inspector gloss panel. They stay in sync — editing either path updates the material (see applyMaterialObserverChange).
        roughness: physicalMaterial.roughness ?? defaults.roughness ?? 1,
        shininess: toGlossiness(physicalMaterial.roughness ?? 0),
        glossInvert: false,
        normalStrength: physicalMaterial.normalScale?.x ?? defaults.normalStrength ?? 1,
        emissive: toObserverColor((physicalMaterial as THREE.MeshPhysicalMaterial).emissive),
        emissiveIntensity: (physicalMaterial as THREE.MeshPhysicalMaterial).emissiveIntensity ?? defaults.emissiveIntensity,
        opacity: physicalMaterial.opacity ?? 1,
        blendType: physicalMaterial.transparent || physicalMaterial.opacity < 1 ? BLEND_NORMAL : BLEND_NONE,
        alphaTest: physicalMaterial.alphaTest ?? defaults.alphaTest,
        // Schema-aligned keys only (see material schema) — avoids duplicate bridge-only names that trigger "Unknown type" warnings.
        clearCoat: (physicalMaterial as THREE.MeshPhysicalMaterial).clearcoat ?? defaults.clearCoat ?? 0,
        clearCoatGloss: 1 - ((physicalMaterial as THREE.MeshPhysicalMaterial).clearcoatRoughness ?? 0),
        useSheen: ((physicalMaterial as THREE.MeshPhysicalMaterial).sheen ?? 0) > 0,
        sheen: toObserverColor((physicalMaterial as THREE.MeshPhysicalMaterial).sheenColor),
        sheenGloss: 1 - ((physicalMaterial as THREE.MeshPhysicalMaterial).sheenRoughness ?? 1)
    };
};

export const applyMaterialObserverChange = (
    material: THREE.Material,
    path: string,
    asset: import('@/editor-api').AssetObserver
) => {
    const physicalMaterial = getPhysicalMaterial(material);
    if (!physicalMaterial) {
        return false;
    }

    let changed = false;

    if (path === 'data.diffuse') {
        const value = asset.get('data.diffuse') || [1, 1, 1];
        physicalMaterial.color.setRGB(value[0] ?? 1, value[1] ?? 1, value[2] ?? 1);
        changed = true;
    }

    if (path === 'data.metalness') {
        physicalMaterial.metalness = Number(asset.get('data.metalness') ?? physicalMaterial.metalness);
        changed = true;
    }

    if (path === 'data.roughness') {
        physicalMaterial.roughness = THREE.MathUtils.clamp(Number(asset.get('data.roughness') ?? physicalMaterial.roughness), 0, 1);
        changed = true;
    }

    if (path === 'data.shininess' || path === 'data.glossInvert') {
        const shininess = Number(asset.get('data.shininess') ?? toGlossiness(physicalMaterial.roughness));
        physicalMaterial.roughness = toRoughness(shininess);
        changed = true;
    }

    if (path === 'data.normalStrength') {
        const normalStrength = Number(asset.get('data.normalStrength') ?? physicalMaterial.normalScale?.x ?? 1);
        physicalMaterial.normalScale?.set(normalStrength, normalStrength);
        (physicalMaterial as THREE.MeshPhysicalMaterial).bumpScale = normalStrength;
        changed = true;
    }

    if (path === 'data.bumpMapFactor' || path === 'data.heightMapFactor') {
        const value = Number(
            asset.get('data.bumpMapFactor') ?? asset.get('data.heightMapFactor') ?? physicalMaterial.bumpScale ?? 1
        );
        physicalMaterial.bumpScale = value;
        changed = true;
    }

    if (path === 'data.emissive') {
        const value = asset.get('data.emissive') || [0, 0, 0];
        (physicalMaterial as THREE.MeshPhysicalMaterial).emissive.setRGB(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
        changed = true;
    }

    if (path === 'data.emissiveIntensity') {
        (physicalMaterial as THREE.MeshPhysicalMaterial).emissiveIntensity = Number(asset.get('data.emissiveIntensity') ?? 1);
        changed = true;
    }

    if (path === 'data.clearCoat') {
        (physicalMaterial as THREE.MeshPhysicalMaterial).clearcoat = Number(asset.get('data.clearCoat') ?? 0);
        changed = true;
    }

    if (path === 'data.clearcoat') {
        (physicalMaterial as THREE.MeshPhysicalMaterial).clearcoat = Number(asset.get('data.clearcoat') ?? 0);
        changed = true;
    }

    if (path === 'data.clearcoatRoughness') {
        (physicalMaterial as THREE.MeshPhysicalMaterial).clearcoatRoughness = THREE.MathUtils.clamp(Number(asset.get('data.clearcoatRoughness') ?? 0), 0, 1);
        changed = true;
    }

    if (path === 'data.clearCoatGloss' || path === 'data.clearCoatGlossInvert') {
        const gloss = Number(asset.get('data.clearCoatGloss') ?? 1);
        const invert = Boolean(asset.get('data.clearCoatGlossInvert'));
        (physicalMaterial as THREE.MeshPhysicalMaterial).clearcoatRoughness = glossSliderToRoughness(gloss, invert);
        changed = true;
    }

    if (path === 'data.sheenEnabled' || path === 'data.useSheen' || path === 'data.sheen') {
        const value = asset.get('data.sheen') || [0, 0, 0];
        const sheenEnabled = !!(asset.get('data.sheenEnabled') ?? asset.get('data.useSheen'));
        (physicalMaterial as THREE.MeshPhysicalMaterial).sheen = sheenEnabled ? 1 : 0;
        (physicalMaterial as THREE.MeshPhysicalMaterial).sheenColor.setRGB(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
        changed = true;
    }

    if (path === 'data.sheenRoughness') {
        (physicalMaterial as THREE.MeshPhysicalMaterial).sheenRoughness = THREE.MathUtils.clamp(Number(asset.get('data.sheenRoughness') ?? 1), 0, 1);
        changed = true;
    }

    if (path === 'data.sheenGloss' || path === 'data.sheenGlossInvert') {
        const gloss = Number(asset.get('data.sheenGloss') ?? 1);
        const invert = Boolean(asset.get('data.sheenGlossInvert'));
        (physicalMaterial as THREE.MeshPhysicalMaterial).sheenRoughness = glossSliderToRoughness(gloss, invert);
        changed = true;
    }

    if (path === 'data.opacity' || path === 'data.blendType' || path === 'data.alphaTest') {
        physicalMaterial.opacity = Number(asset.get('data.opacity') ?? 1);
        physicalMaterial.transparent = physicalMaterial.opacity < 1 || Number(asset.get('data.blendType') ?? BLEND_NONE) !== BLEND_NONE;
        physicalMaterial.alphaTest = Number(asset.get('data.alphaTest') ?? 0);
        changed = true;
    }

    if (changed) {
        physicalMaterial.needsUpdate = true;
    }

    return changed;
};
