import type { ViewerConfig } from '../../../../src/app/(dev)/prototype/types';
import { DEFAULT_RENDERER_SETTINGS } from './onemo-format';

export type SavedSceneMaterialRole = string;

export type SavedSceneTextureKey =
    | 'map'
    | 'normalMap'
    | 'bumpMap'
    | 'roughnessMap'
    | 'metalnessMap'
    | 'aoMap'
    | 'lightMap'
    | 'alphaMap'
    | 'emissiveMap'
    | 'clearcoatMap'
    | 'clearcoatRoughnessMap'
    | 'clearcoatNormalMap'
    | 'sheenColorMap'
    | 'sheenRoughnessMap'
    | 'transmissionMap'
    | 'thicknessMap'
    | 'iridescenceMap'
    | 'iridescenceThicknessMap'
    | 'anisotropyMap'
    | 'specularColorMap'
    | 'specularIntensityMap';

export type SavedSceneTexture = {
    url: string;
    channel?: string | number;
    uv?: number;
    offset?: [number, number];
    tiling?: [number, number];
    rotation?: number;
};

export type SavedSceneMaterialData = {
    color?: [number, number, number];
    metalness?: number;
    roughness?: number;
    normalScale?: number;
    bumpScale?: number;
    envMapIntensity?: number;
    emissive?: [number, number, number];
    emissiveIntensity?: number;
    opacity?: number;
    transparent?: boolean;
    alphaTest?: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
    sheen?: number;
    sheenColor?: [number, number, number];
    sheenRoughness?: number;
    textures?: Partial<Record<SavedSceneTextureKey, SavedSceneTexture>>;
};

export type SavedSceneRenderComponent = {
    enabled: boolean;
    castShadows: boolean;
    receiveShadows: boolean;
    materialAssets: (number | null)[];
};

export type SavedSceneLightComponent = {
    enabled: boolean;
    type: 'directional' | 'point' | 'spot';
    color: [number, number, number];
    intensity: number;
    range: number;
    castShadows: boolean;
    innerConeAngle?: number;
    outerConeAngle?: number;
};

export type SavedSceneCameraComponent = {
    enabled: boolean;
    projection: number;
    clearColor?: [number, number, number, number];
    fov?: number;
    orthoHeight?: number;
    nearClip: number;
    farClip: number;
};

export type SavedSceneEntityComponents = {
    render?: SavedSceneRenderComponent;
    light?: SavedSceneLightComponent;
    camera?: SavedSceneCameraComponent;
};

export type SavedSceneEntity = {
    name: string;
    resource_id: string;
    parent: string | null;
    children: string[];
    enabled: boolean;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    components: SavedSceneEntityComponents;
};

export type SavedSceneMaterial = {
    name: string;
    role?: SavedSceneMaterialRole;
    data: SavedSceneMaterialData;
};

export type SavedSceneSettings = {
    exposure: number;
    skyboxIntensity: number;
    tonemapping: number;
    gamma_correction: number;
};

export type SavedScene = {
    name: string;
    created: string;
    modified: string;
    modelPath: string;
    entities: Record<string, SavedSceneEntity>;
    materials: Record<string, SavedSceneMaterial>;
    sceneSettings: SavedSceneSettings;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const clampColorChannel = (value: number) => {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(Math.max(value, 0), 1);
};

const asRgbTuple = (value: unknown, fallback: [number, number, number]): [number, number, number] => {
    if (!Array.isArray(value)) {
        return [...fallback] as [number, number, number];
    }

    return [
        Number(value[0] ?? fallback[0]),
        Number(value[1] ?? fallback[1]),
        Number(value[2] ?? fallback[2])
    ];
};

const readNumber = (
    source: Record<string, unknown>,
    keys: string[],
    fallback: number
) => {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
    }

    return fallback;
};

const readBoolean = (
    source: Record<string, unknown>,
    keys: string[],
    fallback: boolean
) => {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'boolean') {
            return value;
        }
    }

    return fallback;
};

const readColor = (
    source: Record<string, unknown>,
    keys: string[],
    fallback: [number, number, number]
) => {
    for (const key of keys) {
        const value = source[key];
        if (Array.isArray(value)) {
            return asRgbTuple(value, fallback);
        }
    }

    return [...fallback] as [number, number, number];
};

const rgbTupleToHexInternal = (value: [number, number, number]) => {
    return `#${value.map((channel) => {
        return Math.round(clampColorChannel(channel) * 255).toString(16).padStart(2, '0');
    }).join('')}`;
};

const inferMaterialRole = (material: SavedSceneMaterial) => {
    if (material.role) {
        return material.role;
    }

    const normalizedName = String(material.name || '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const strippedName = normalizedName.replace(/\bmaterial\b/g, '').replace(/\s+/g, ' ').trim();

    if (strippedName === 'face' || normalizedName.includes('print surface') || normalizedName.includes('face material')) {
        return 'face';
    }

    if (strippedName === 'back' || normalizedName.includes('back material')) {
        return 'back';
    }

    if (strippedName === 'frame' || normalizedName.includes('frame material')) {
        return 'frame';
    }

    return 'generic';
};

const readMaterialTextures = (source: Record<string, unknown>) => {
    if (!isRecord(source.textures)) {
        return {};
    }

    const result: Partial<Record<SavedSceneTextureKey, SavedSceneTexture>> = {};
    Object.entries(source.textures).forEach(([key, value]) => {
        if (!isRecord(value) || typeof value.url !== 'string' || !value.url) {
            return;
        }

        result[key as SavedSceneTextureKey] = {
            url: value.url,
            channel: typeof value.channel === 'string' || typeof value.channel === 'number' ? value.channel : undefined,
            uv: typeof value.uv === 'number' ? value.uv : undefined,
            offset: Array.isArray(value.offset)
                ? [Number(value.offset[0] ?? 0), Number(value.offset[1] ?? 0)]
                : undefined,
            tiling: Array.isArray(value.tiling)
                ? [Number(value.tiling[0] ?? 1), Number(value.tiling[1] ?? 1)]
                : undefined,
            rotation: typeof value.rotation === 'number' ? value.rotation : undefined
        };
    });

    return result;
};

const readBackgroundColor = (scene: SavedScene) => {
    const entities = Object.values(scene.entities || {});
    for (const entity of entities) {
        const clearColor = entity.components?.camera?.clearColor;
        if (Array.isArray(clearColor)) {
            return rgbTupleToHexInternal(asRgbTuple(clearColor, [1, 1, 1]));
        }
    }

    return null;
};

const getCompatibilityRoles = (config: ViewerConfig) => {
    const materialRoles = config.product?.materialRoles ?? [];
    const artworkRole = config.product?.artworkSlot
        ? materialRoles.find((role) => role.role === config.product?.artworkSlot?.role)
        : undefined;

    const primaryRole = artworkRole ?? materialRoles[0];
    const secondaryRole = materialRoles.find((role) => role !== primaryRole) ?? primaryRole;
    const tertiaryRole = materialRoles.find((role) => role !== primaryRole && role !== secondaryRole) ?? secondaryRole;

    return {
        primaryRole,
        secondaryRole,
        tertiaryRole
    };
};

const readRoleColor = (
    role: ViewerConfig['product']['materialRoles'][number] | undefined,
    fallback: string
) => {
    const value = role?.defaults?.color;
    return typeof value === 'string' && value.trim() ? value : fallback;
};

const upsertProductRoleFromSceneMaterial = (
    config: ViewerConfig,
    roleName: string,
    materialName: string,
    defaults: Record<string, unknown>,
    textures: Partial<Record<SavedSceneTextureKey, SavedSceneTexture>>
) => {
    if (!roleName || roleName === 'generic') {
        return;
    }

    const existingRole = config.product.materialRoles.find((role) => role.role === roleName);
    const nextTextures: Record<string, string | undefined> = {
        map: textures.map?.url,
        normalMap: textures.normalMap?.url,
        roughnessMap: textures.roughnessMap?.url,
        bumpMap: textures.bumpMap?.url,
        sheenColorMap: textures.sheenColorMap?.url
    };

    if (existingRole) {
        if (materialName && !existingRole.meshNames.includes(materialName)) {
            existingRole.meshNames.push(materialName);
        }
        existingRole.defaults = {
            ...(existingRole.defaults || {}),
            ...defaults
        };
        existingRole.textures = {
            ...(existingRole.textures || {}),
            ...Object.fromEntries(Object.entries(nextTextures).filter(([, value]) => !!value))
        };
        return;
    }

    config.product.materialRoles.push({
        role: roleName,
        meshNames: materialName ? [materialName] : [],
        defaults: { ...defaults },
        textures: Object.fromEntries(Object.entries(nextTextures).filter(([, value]) => !!value)),
        configurable: true
    });
};

export const cloneViewerConfig = (value: ViewerConfig): ViewerConfig => {
    return JSON.parse(JSON.stringify(value)) as ViewerConfig;
};

export const rgbTupleToHex = (value: [number, number, number]) => {
    return rgbTupleToHexInternal(value);
};

export const createDefaultViewerConfig = (): ViewerConfig => {
    return {
        modelPath: '',
        scene: {
            exposure: 0.7,
            ambientIntensity: 0.5,
            envIntensity: 1,
            background: '#ffffff'
        },
        colors: {
            backColor: '#080808',
            frameColor: '#0f0f0f',
            bgColor: '#ffffff'
        },
        camera: {
            fov: 35,
            distance: 0.2,
            polarAngle: 90,
            azimuthAngle: 0,
            target: [0, 0, 0],
            enableDamping: true,
            dampingFactor: 0.1,
            autoRotate: false,
            autoRotateSpeed: 2
        },
        environment: {
            preset: 'studio',
            customHdri: '/assets/env/studio.exr',
            envRotation: 0,
            groundEnabled: false,
            groundHeight: 0,
            groundRadius: 20
        },
        renderer: {
            ...DEFAULT_RENDERER_SETTINGS
        },
        product: {
            productType: 'untitled-scene',
            materialRoles: [],
            artworkSlot: undefined
        }
    };
};

export const savedSceneToViewerConfig = (
    scene: SavedScene,
    baseConfig: ViewerConfig = createDefaultViewerConfig()
): ViewerConfig => {
    const next = cloneViewerConfig(baseConfig);

    if (typeof scene.modelPath === 'string' && scene.modelPath.trim()) {
        next.modelPath = scene.modelPath;
    }

    next.scene.exposure = readNumber(scene.sceneSettings || {}, ['exposure'], next.scene.exposure);
    next.scene.envIntensity = readNumber(scene.sceneSettings || {}, ['skyboxIntensity'], next.scene.envIntensity);

    const background = readBackgroundColor(scene);
    if (background) {
        next.scene.background = background;
        next.colors.bgColor = background;
    }

    Object.values(scene.materials || {}).forEach((material) => {
        const data = isRecord(material.data) ? material.data : {};
        const textures = readMaterialTextures(data);
        const role = inferMaterialRole(material);

        upsertProductRoleFromSceneMaterial(next, role, material.name, {
            color: rgbTupleToHexInternal(readColor(data, ['color', 'diffuse'], [1, 1, 1])),
            roughness: readNumber(data, ['roughness'], 1),
            metalness: readNumber(data, ['metalness'], 0),
            envMapIntensity: readNumber(data, ['envMapIntensity'], 0.1),
            normalScale: readNumber(data, ['normalScale', 'normalStrength'], 0.15),
            bumpScale: readNumber(data, ['bumpScale', 'heightMapFactor', 'bumpMapFactor'], 1),
            clearcoat: readNumber(data, ['clearcoat', 'clearCoat', 'clearcoatAmount'], 0),
            clearcoatRoughness: readNumber(data, ['clearcoatRoughness', 'clearcoatGlossiness'], 0),
            sheen: readNumber(data, ['sheen'], readBoolean(data, ['useSheen', 'sheenEnabled'], false) ? 1 : 0),
            sheenColor: rgbTupleToHexInternal(readColor(data, ['sheenColor', 'sheen'], [0.1, 0.1, 0.1])),
            sheenRoughness: readNumber(data, ['sheenRoughness'], 0.8)
        }, textures);

    });

    const { secondaryRole, tertiaryRole } = getCompatibilityRoles(next);
    next.colors.backColor = readRoleColor(secondaryRole, next.colors.backColor);
    next.colors.frameColor = readRoleColor(tertiaryRole, next.colors.frameColor);
    next.colors.bgColor = next.scene.background;

    return next;
};
