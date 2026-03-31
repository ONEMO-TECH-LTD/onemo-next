import * as THREE from 'three';

import { BLEND_NONE, BLEND_NORMAL } from './constants';

declare const editor: any;

const MATERIAL_VERTEX_COLOR_PATHS = [
    'data.aoVertexColor',
    'data.diffuseVertexColor',
    'data.metalnessVertexColor',
    'data.specularVertexColor',
    'data.specularityFactorVertexColor',
    'data.glossVertexColor',
    'data.emissiveVertexColor',
    'data.opacityVertexColor',
    'data.clearCoatVertexColor',
    'data.clearCoatGlossVertexColor',
    'data.sheenVertexColor',
    'data.sheenGlossVertexColor',
    'data.sheenGlossVertexColorChannel',
    'data.refractionVertexColor',
    'data.refractionVertexColorChannel',
    'data.thicknessVertexColor',
    'data.thicknessVertexColorChannel',
    'data.lightVertexColor'
] as const;

const NO_THREE_EQUIVALENT_PATHS = new Set([
    'data.enableGGXSpecular',
    'data.occludeSpecular',
    'data.ambient',
    'data.useDynamicRefraction',
    'data.useMetalnessSpecularColor',
    'data.specularTint',
    'data.specularityFactorTint',
    'data.opacityFadesSpecular',
    'data.opacityDither',
    'data.opacityShadowDither',
    'data.alphaFade',
    'data.clearCoatVertexColor',
    'data.clearCoatVertexColorChannel',
    'data.clearCoatGlossVertexColor',
    'data.clearCoatGlossVertexColorChannel',
    'data.sphereMap',
    'data.cubeMap',
    'data.cubeMapProjection',
    'data.cubeMapProjectionBox.center',
    'data.cubeMapProjectionBox.halfExtents',
    'data.twoSidedLighting',
    'data.useLighting',
    'data.useSkybox',
    'data.vertexColorGamma'
]);

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

const getMeshPhysicalMaterial = (material: THREE.Material) => {
    if (material instanceof THREE.MeshPhysicalMaterial) {
        return material;
    }

    return null;
};

const toThreeIor = (value: unknown, fallback = 1.5) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    // PlayCanvas stores this in a normalized 0-1 UI range; Three.js expects > 1.
    return numeric >= 1 ? numeric : 1 + numeric;
};

const fromThreeIor = (value: unknown, fallback = 0.5) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    return numeric >= 1 ? numeric - 1 : numeric;
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    return THREE.MathUtils.clamp(numeric, min, max);
};

const readColorArray = (value: unknown, fallback: [number, number, number] = [0, 0, 0]): [number, number, number] => {
    if (!Array.isArray(value)) {
        return [...fallback] as [number, number, number];
    }

    return [
        Number(value[0] ?? fallback[0]),
        Number(value[1] ?? fallback[1]),
        Number(value[2] ?? fallback[2])
    ];
};

const setMaterialColor = (target: THREE.Color, value: unknown, fallback: [number, number, number]) => {
    const next = readColorArray(value, fallback);
    target.setRGB(next[0], next[1], next[2]);
};

const setVector2Magnitude = (target: THREE.Vector2 | undefined, value: number) => {
    if (!target) {
        return;
    }

    target.set(value, value);
};

const setVector2Pair = (target: THREE.Vector2 | undefined, value: number) => {
    if (!target) {
        return;
    }

    target.set(value, value);
};

const toThreeTextureSlot = (slot: string) => {
    switch (slot) {
        case 'diffuseMap':
        case 'baseColorMap':
        case 'colorMap':
            return 'map';
        case 'normalMap':
            return 'normalMap';
        case 'heightMap':
        case 'bumpMap':
            return 'bumpMap';
        case 'roughnessMap':
        case 'glossMap':
            return 'roughnessMap';
        case 'metalnessMap':
            return 'metalnessMap';
        case 'aoMap':
            return 'aoMap';
        case 'lightMap':
            return 'lightMap';
        case 'opacityMap':
            return 'alphaMap';
        case 'emissiveMap':
            return 'emissiveMap';
        case 'clearCoatMap':
            return 'clearcoatMap';
        case 'clearCoatGlossMap':
            return 'clearcoatRoughnessMap';
        case 'clearCoatNormalMap':
            return 'clearcoatNormalMap';
        case 'sheenMap':
        case 'sheenColorMap':
            return 'sheenColorMap';
        case 'sheenGlossMap':
            return 'sheenRoughnessMap';
        case 'refractionMap':
            return 'transmissionMap';
        case 'thicknessMap':
            return 'thicknessMap';
        case 'iridescenceMap':
            return 'iridescenceMap';
        case 'iridescenceThicknessMap':
            return 'iridescenceThicknessMap';
        case 'anisotropyMap':
            return 'anisotropyMap';
        case 'specularMap':
            return 'specularColorMap';
        case 'specularityFactorMap':
            return 'specularIntensityMap';
        default:
            return slot;
    }
};

const setMaterialCullMode = (material: THREE.Material, cull: unknown) => {
    switch (Number(cull)) {
        case 0:
            material.side = THREE.DoubleSide;
            break;
        case 2:
            material.side = THREE.BackSide;
            break;
        case 1:
        default:
            material.side = THREE.FrontSide;
            break;
    }
};

const applyBlendType = (material: THREE.Material, blendType: unknown, opacity: number) => {
    const value = Number(blendType ?? BLEND_NONE);

    material.transparent = opacity < 1 || value !== BLEND_NONE;
    material.premultipliedAlpha = value === 4;
    material.blending = THREE.NormalBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = THREE.SrcAlphaFactor;
    material.blendDst = THREE.OneMinusSrcAlphaFactor;

    switch (value) {
        case BLEND_NONE:
        case BLEND_NORMAL:
            return;
        case 1:
            material.blending = THREE.AdditiveBlending;
            return;
        case 4:
            material.blending = THREE.NormalBlending;
            return;
        case 5:
            material.blending = THREE.CustomBlending;
            material.blendSrc = THREE.DstColorFactor;
            material.blendDst = THREE.ZeroFactor;
            return;
        case 6:
            material.blending = THREE.CustomBlending;
            material.blendSrc = THREE.SrcAlphaFactor;
            material.blendDst = THREE.OneFactor;
            return;
        case 7:
            material.blending = THREE.CustomBlending;
            material.blendSrc = THREE.DstColorFactor;
            material.blendDst = THREE.SrcColorFactor;
            return;
        case 8:
            material.blending = THREE.CustomBlending;
            material.blendSrc = THREE.OneFactor;
            material.blendDst = THREE.OneMinusSrcColorFactor;
            return;
        case 9:
            material.blending = THREE.CustomBlending;
            material.blendEquation = THREE.MinEquation;
            material.blendSrc = THREE.OneFactor;
            material.blendDst = THREE.OneFactor;
            return;
        case 10:
            material.blending = THREE.CustomBlending;
            material.blendEquation = THREE.MaxEquation;
            material.blendSrc = THREE.OneFactor;
            material.blendDst = THREE.OneFactor;
            break;
        default:
            break;
    }
};

const updateVertexColorMode = (material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial, asset: import('@/editor-api').AssetObserver) => {
    material.vertexColors = MATERIAL_VERTEX_COLOR_PATHS.some((path) => {
        return !!asset.get(path);
    });
};

export const createMaterialData = (material: THREE.Material, existingData: Record<string, unknown> = {}) => {
    const physicalMaterial = getPhysicalMaterial(material);
    const meshPhysicalMaterial = getMeshPhysicalMaterial(material);
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
        useMetalness: existingData.useMetalness ?? true,
        diffuse: toObserverColor(physicalMaterial.color),
        metalness: physicalMaterial.metalness ?? defaults.metalness,
        roughness: physicalMaterial.roughness ?? defaults.roughness ?? 1,
        shininess: toGlossiness(physicalMaterial.roughness ?? 0),
        glossInvert: false,
        ambient: existingData.ambient ?? defaults.ambient,
        aoIntensity: physicalMaterial.aoMapIntensity ?? defaults.aoIntensity ?? 1,
        lightMapIntensity: physicalMaterial.lightMapIntensity ?? defaults.lightMapIntensity ?? 1,
        normalStrength: physicalMaterial.normalScale?.x ?? defaults.normalStrength ?? 1,
        bumpMapFactor: physicalMaterial.bumpScale ?? defaults.bumpMapFactor ?? 1,
        heightMapFactor: physicalMaterial.bumpScale ?? defaults.heightMapFactor ?? 1,
        emissive: toObserverColor((meshPhysicalMaterial ?? physicalMaterial).emissive),
        emissiveIntensity: (meshPhysicalMaterial ?? physicalMaterial).emissiveIntensity ?? defaults.emissiveIntensity,
        opacity: physicalMaterial.opacity ?? 1,
        blendType: existingData.blendType ?? (physicalMaterial.transparent || physicalMaterial.opacity < 1 ? BLEND_NORMAL : BLEND_NONE),
        alphaTest: physicalMaterial.alphaTest ?? defaults.alphaTest,
        alphaToCoverage: material.alphaToCoverage ?? defaults.alphaToCoverage ?? false,
        clearCoat: meshPhysicalMaterial?.clearcoat ?? defaults.clearCoat ?? 0,
        clearcoat: meshPhysicalMaterial?.clearcoat ?? defaults.clearcoat ?? 0,
        clearcoatRoughness: meshPhysicalMaterial?.clearcoatRoughness ?? defaults.clearcoatRoughness ?? 0,
        clearCoatGloss: 1 - (meshPhysicalMaterial?.clearcoatRoughness ?? 0),
        clearCoatBumpiness: meshPhysicalMaterial?.clearcoatNormalScale?.x ?? defaults.clearCoatBumpiness ?? 1,
        useSheen: (meshPhysicalMaterial?.sheen ?? 0) > 0,
        sheenEnabled: (meshPhysicalMaterial?.sheen ?? 0) > 0,
        sheen: toObserverColor(meshPhysicalMaterial?.sheenColor),
        sheenGloss: 1 - (meshPhysicalMaterial?.sheenRoughness ?? 1),
        sheenRoughness: meshPhysicalMaterial?.sheenRoughness ?? defaults.sheenRoughness ?? 1,
        specular: toObserverColor(meshPhysicalMaterial?.specularColor),
        specularityFactor: meshPhysicalMaterial?.specularIntensity ?? defaults.specularityFactor ?? 1,
        anisotropyIntensity: meshPhysicalMaterial?.anisotropy ?? defaults.anisotropyIntensity ?? 0,
        anisotropyRotation: meshPhysicalMaterial?.anisotropyRotation ?? defaults.anisotropyRotation ?? 0,
        refraction: meshPhysicalMaterial?.transmission ?? defaults.refraction ?? 0,
        refractionIndex: fromThreeIor(meshPhysicalMaterial?.ior, Number(defaults.refractionIndex ?? 0.5)),
        dispersion: meshPhysicalMaterial?.dispersion ?? defaults.dispersion ?? 0,
        thickness: meshPhysicalMaterial?.thickness ?? defaults.thickness ?? 0,
        attenuation: toObserverColor(meshPhysicalMaterial?.attenuationColor),
        attenuationDistance: meshPhysicalMaterial?.attenuationDistance ?? defaults.attenuationDistance ?? 0,
        useIridescence: (meshPhysicalMaterial?.iridescence ?? 0) > 0,
        iridescence: meshPhysicalMaterial?.iridescence ?? defaults.iridescence ?? 0,
        iridescenceThicknessMin: meshPhysicalMaterial?.iridescenceThicknessRange?.[0] ?? defaults.iridescenceThicknessMin ?? 100,
        iridescenceThicknessMax: meshPhysicalMaterial?.iridescenceThicknessRange?.[1] ?? defaults.iridescenceThicknessMax ?? 400,
        iridescenceRefractionIndex: fromThreeIor(meshPhysicalMaterial?.iridescenceIOR, Number(defaults.iridescenceRefractionIndex ?? 0.3)),
        reflectivity: physicalMaterial.envMapIntensity ?? defaults.reflectivity ?? 1,
        depthTest: material.depthTest ?? defaults.depthTest ?? true,
        depthWrite: material.depthWrite ?? defaults.depthWrite ?? true,
        cull: material.side === THREE.DoubleSide ? 0 : material.side === THREE.BackSide ? 2 : 1,
        useFog: material.fog ?? defaults.useFog ?? true,
        useTonemap: material.toneMapped ?? defaults.useTonemap ?? true
    };
};

export const applyMaterialObserverChange = (
    material: THREE.Material,
    path: string,
    asset: import('@/editor-api').AssetObserver
) => {
    const physicalMaterial = getPhysicalMaterial(material);
    const meshPhysicalMaterial = getMeshPhysicalMaterial(material);
    if (!physicalMaterial) {
        return false;
    }

    if (NO_THREE_EQUIVALENT_PATHS.has(path)) {
        // No Three.js equivalent for this PlayCanvas-era material field in the
        // current MeshStandard/MeshPhysical bridge.
        return false;
    }

    let changed = false;

    if (path.endsWith('MapUv')) {
        const slotName = path.replace('data.', '').replace('Uv', '');
        const threeSlotName = toThreeTextureSlot(slotName);
        const texture = (physicalMaterial as THREE.MeshStandardMaterial & Record<string, unknown>)[threeSlotName];
        if (threeSlotName && texture instanceof THREE.Texture) {
            texture.channel = Number(asset.get(path) ?? 0);
            texture.needsUpdate = true;
            physicalMaterial.needsUpdate = true;
            return true;
        }
        return false;
    }

    if (path === 'data.diffuse') {
        setMaterialColor(physicalMaterial.color, asset.get('data.diffuse'), [1, 1, 1]);
        changed = true;
    }

    if (path === 'data.aoIntensity') {
        physicalMaterial.aoMapIntensity = clampNumber(asset.get('data.aoIntensity'), physicalMaterial.aoMapIntensity ?? 1, 0, 10);
        changed = true;
    }

    if (path === 'data.lightMapIntensity') {
        physicalMaterial.lightMapIntensity = clampNumber(asset.get('data.lightMapIntensity'), physicalMaterial.lightMapIntensity ?? 1, 0, 10);
        physicalMaterial.needsUpdate = true;
        return true;
    }

    if (path === 'data.useMetalness') {
        const useMetalness = Boolean(asset.get('data.useMetalness'));
        if (!useMetalness) {
            physicalMaterial.metalness = 0;
        } else {
            physicalMaterial.metalness = clampNumber(asset.get('data.metalness'), physicalMaterial.metalness, 0, 1);
        }
        changed = true;
    }

    if (path === 'data.metalness') {
        physicalMaterial.metalness = clampNumber(asset.get('data.metalness'), physicalMaterial.metalness, 0, 1);
        changed = true;
    }

    if (path === 'data.roughness') {
        physicalMaterial.roughness = clampNumber(asset.get('data.roughness'), physicalMaterial.roughness, 0, 1);
        changed = true;
    }

    if (path === 'data.shininess' || path === 'data.glossInvert') {
        const shininess = Number(asset.get('data.shininess') ?? toGlossiness(physicalMaterial.roughness));
        physicalMaterial.roughness = toRoughness(shininess);
        changed = true;
    }

    if (path === 'data.normalStrength') {
        const normalStrength = clampNumber(asset.get('data.normalStrength'), physicalMaterial.normalScale?.x ?? 1, 0, 4);
        setVector2Magnitude(physicalMaterial.normalScale, normalStrength);
        physicalMaterial.bumpScale = normalStrength;
        changed = true;
    }

    if (path === 'data.bumpMapFactor' || path === 'data.heightMapFactor') {
        physicalMaterial.bumpScale = clampNumber(
            asset.get(path),
            physicalMaterial.bumpScale ?? 1,
            0,
            10
        );
        changed = true;
    }

    if ((path === 'data.specular' || path === 'data.specularityFactor') && meshPhysicalMaterial) {
        if (path === 'data.specular') {
            setMaterialColor(meshPhysicalMaterial.specularColor, asset.get('data.specular'), [1, 1, 1]);
        }

        if (path === 'data.specularityFactor') {
            meshPhysicalMaterial.specularIntensity = clampNumber(asset.get('data.specularityFactor'), meshPhysicalMaterial.specularIntensity ?? 1, 0, 1);
        }
        changed = true;
    }

    if ((path === 'data.anisotropyIntensity' || path === 'data.anisotropyRotation') && meshPhysicalMaterial) {
        if (path === 'data.anisotropyIntensity') {
            meshPhysicalMaterial.anisotropy = clampNumber(asset.get('data.anisotropyIntensity'), meshPhysicalMaterial.anisotropy ?? 0, 0, 1);
        }

        if (path === 'data.anisotropyRotation') {
            meshPhysicalMaterial.anisotropyRotation = THREE.MathUtils.degToRad(
                clampNumber(asset.get('data.anisotropyRotation'), THREE.MathUtils.radToDeg(meshPhysicalMaterial.anisotropyRotation ?? 0), 0, 360)
            );
        }
        changed = true;
    }

    if (path === 'data.emissive') {
        setMaterialColor((meshPhysicalMaterial ?? physicalMaterial).emissive, asset.get('data.emissive'), [0, 0, 0]);
        changed = true;
    }

    if (path === 'data.emissiveIntensity') {
        (meshPhysicalMaterial ?? physicalMaterial).emissiveIntensity = clampNumber(asset.get('data.emissiveIntensity'), (meshPhysicalMaterial ?? physicalMaterial).emissiveIntensity ?? 1, 0, 100);
        changed = true;
    }

    if (path === 'data.opacity' || path === 'data.blendType' || path === 'data.alphaTest' || path === 'data.alphaToCoverage') {
        physicalMaterial.opacity = clampNumber(asset.get('data.opacity'), physicalMaterial.opacity ?? 1, 0, 1);
        physicalMaterial.alphaTest = clampNumber(asset.get('data.alphaTest'), physicalMaterial.alphaTest ?? 0, 0, 1);
        material.alphaToCoverage = Boolean(asset.get('data.alphaToCoverage'));
        applyBlendType(material, asset.get('data.blendType'), physicalMaterial.opacity);
        changed = true;
    }

    if ((path === 'data.clearCoat' || path === 'data.clearcoat') && meshPhysicalMaterial) {
        meshPhysicalMaterial.clearcoat = clampNumber(asset.get(path), meshPhysicalMaterial.clearcoat ?? 0, 0, 1);
        changed = true;
    }

    if (path === 'data.clearcoatRoughness' && meshPhysicalMaterial) {
        meshPhysicalMaterial.clearcoatRoughness = clampNumber(asset.get('data.clearcoatRoughness'), meshPhysicalMaterial.clearcoatRoughness ?? 0, 0, 1);
        changed = true;
    }

    if ((path === 'data.clearCoatGloss' || path === 'data.clearCoatGlossInvert') && meshPhysicalMaterial) {
        const gloss = clampNumber(asset.get('data.clearCoatGloss'), 1, 0, 1);
        const invert = Boolean(asset.get('data.clearCoatGlossInvert'));
        meshPhysicalMaterial.clearcoatRoughness = glossSliderToRoughness(gloss, invert);
        changed = true;
    }

    if (path === 'data.clearCoatBumpiness' && meshPhysicalMaterial) {
        const clearcoatBumpiness = clampNumber(asset.get('data.clearCoatBumpiness'), meshPhysicalMaterial.clearcoatNormalScale?.x ?? 1, 0, 4);
        setVector2Pair(meshPhysicalMaterial.clearcoatNormalScale, clearcoatBumpiness);
        changed = true;
    }

    if (path === 'data.sheenEnabled' || path === 'data.useSheen' || path === 'data.sheen') {
        const value = asset.get('data.sheen') || [0, 0, 0];
        const sheenEnabled = !!(asset.get('data.sheenEnabled') ?? asset.get('data.useSheen'));
        if (meshPhysicalMaterial) {
            meshPhysicalMaterial.sheen = sheenEnabled ? 1 : 0;
            meshPhysicalMaterial.sheenColor.setRGB(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
        }
        changed = true;
    }

    if (path === 'data.sheenRoughness') {
        if (meshPhysicalMaterial) {
            meshPhysicalMaterial.sheenRoughness = clampNumber(asset.get('data.sheenRoughness'), meshPhysicalMaterial.sheenRoughness ?? 1, 0, 1);
        }
        changed = true;
    }

    if (path === 'data.sheenGloss' || path === 'data.sheenGlossInvert') {
        const gloss = clampNumber(asset.get('data.sheenGloss'), 1, 0, 1);
        const invert = Boolean(asset.get('data.sheenGlossInvert'));
        if (meshPhysicalMaterial) {
            meshPhysicalMaterial.sheenRoughness = glossSliderToRoughness(gloss, invert);
        }
        changed = true;
    }

    if ((path === 'data.refraction' || path === 'data.refractionIndex' || path === 'data.dispersion' || path === 'data.thickness' || path === 'data.attenuation' || path === 'data.attenuationDistance') && meshPhysicalMaterial) {
        if (path === 'data.refraction') {
            meshPhysicalMaterial.transmission = clampNumber(asset.get('data.refraction'), meshPhysicalMaterial.transmission ?? 0, 0, 1);
        }
        if (path === 'data.refractionIndex') {
            meshPhysicalMaterial.ior = toThreeIor(asset.get('data.refractionIndex'), meshPhysicalMaterial.ior ?? 1.5);
        }
        if (path === 'data.dispersion') {
            meshPhysicalMaterial.dispersion = Math.max(0, Number(asset.get('data.dispersion') ?? meshPhysicalMaterial.dispersion ?? 0));
        }
        if (path === 'data.thickness') {
            meshPhysicalMaterial.thickness = Math.max(0, Number(asset.get('data.thickness') ?? meshPhysicalMaterial.thickness ?? 0));
        }
        if (path === 'data.attenuation') {
            setMaterialColor(meshPhysicalMaterial.attenuationColor, asset.get('data.attenuation'), [1, 1, 1]);
        }
        if (path === 'data.attenuationDistance') {
            meshPhysicalMaterial.attenuationDistance = Math.max(0, Number(asset.get('data.attenuationDistance') ?? meshPhysicalMaterial.attenuationDistance ?? 0));
        }
        changed = true;
    }

    if ((path === 'data.useIridescence' || path === 'data.iridescence' || path === 'data.iridescenceThicknessMin' || path === 'data.iridescenceThicknessMax' || path === 'data.iridescenceRefractionIndex') && meshPhysicalMaterial) {
        if (path === 'data.useIridescence') {
            const enabled = Boolean(asset.get('data.useIridescence'));
            meshPhysicalMaterial.iridescence = enabled ? Math.max(meshPhysicalMaterial.iridescence ?? 0, 1) : 0;
        }
        if (path === 'data.iridescence') {
            meshPhysicalMaterial.iridescence = clampNumber(asset.get('data.iridescence'), meshPhysicalMaterial.iridescence ?? 0, 0, 1);
        }
        if (path === 'data.iridescenceThicknessMin' || path === 'data.iridescenceThicknessMax') {
            const min = Math.max(0, Number(asset.get('data.iridescenceThicknessMin') ?? meshPhysicalMaterial.iridescenceThicknessRange?.[0] ?? 100));
            const max = Math.max(min, Number(asset.get('data.iridescenceThicknessMax') ?? meshPhysicalMaterial.iridescenceThicknessRange?.[1] ?? 400));
            meshPhysicalMaterial.iridescenceThicknessRange = [min, max];
        }
        if (path === 'data.iridescenceRefractionIndex') {
            meshPhysicalMaterial.iridescenceIOR = toThreeIor(asset.get('data.iridescenceRefractionIndex'), meshPhysicalMaterial.iridescenceIOR ?? 1.3);
        }
        changed = true;
    }

    if (path === 'data.reflectivity') {
        physicalMaterial.envMapIntensity = Math.max(0, Number(asset.get('data.reflectivity') ?? physicalMaterial.envMapIntensity ?? 1));
        changed = true;
    }

    if (path === 'data.depthTest') {
        material.depthTest = Boolean(asset.get('data.depthTest'));
        changed = true;
    }

    if (path === 'data.depthWrite') {
        material.depthWrite = Boolean(asset.get('data.depthWrite'));
        changed = true;
    }

    if (path === 'data.cull') {
        setMaterialCullMode(material, asset.get('data.cull'));
        changed = true;
    }

    if (path === 'data.useFog') {
        material.fog = Boolean(asset.get('data.useFog'));
        changed = true;
    }

    if (path === 'data.useTonemap') {
        material.toneMapped = Boolean(asset.get('data.useTonemap'));
        changed = true;
    }

    if (MATERIAL_VERTEX_COLOR_PATHS.includes(path as typeof MATERIAL_VERTEX_COLOR_PATHS[number])) {
        updateVertexColorMode(physicalMaterial, asset);
        changed = true;
    }

    if (changed) {
        physicalMaterial.needsUpdate = true;
    }

    return changed;
};
