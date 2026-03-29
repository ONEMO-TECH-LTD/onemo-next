import type { ViewerConfig } from '../../../../src/app/(dev)/prototype/types';

export type SavedSceneMaterialRole = 'face' | 'back' | 'frame' | 'generic';

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

const DEFAULT_TEXTURES = {
    normal: '/assets/materials/ultrasuede/suede-normal.png',
    roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
    height: '/assets/materials/ultrasuede/suede-height.png'
} as const;

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

const applySharedTextures = (
    textures: Partial<Record<SavedSceneTextureKey, SavedSceneTexture>>,
    target: ViewerConfig['face']['textures']
) => {
    if (textures.map?.url) {
        target.texture = textures.map.url;
    }

    if (textures.normalMap?.url) {
        target.normal = textures.normalMap.url;
    }

    if (textures.roughnessMap?.url) {
        target.roughness = textures.roughnessMap.url;
    }

    if (textures.bumpMap?.url) {
        target.height = textures.bumpMap.url;
    }

    if (textures.sheenColorMap?.url) {
        target.sheenColor = textures.sheenColorMap.url;
    }
};

export const cloneViewerConfig = (value: ViewerConfig): ViewerConfig => {
    return JSON.parse(JSON.stringify(value)) as ViewerConfig;
};

export const rgbTupleToHex = (value: [number, number, number]) => {
    return rgbTupleToHexInternal(value);
};

export const decomposeViewerColor = (value: [number, number, number]) => {
    const multiplier = Math.max(1, value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
    const normalized: [number, number, number] = [
        clampColorChannel((value[0] ?? 0) / multiplier),
        clampColorChannel((value[1] ?? 0) / multiplier),
        clampColorChannel((value[2] ?? 0) / multiplier)
    ];

    return {
        color: rgbTupleToHexInternal(normalized),
        colorMultiplier: multiplier
    };
};

export const createDefaultViewerConfig = (): ViewerConfig => {
    return {
        modelPath: '/assets/shapes/effect-70mm-step.glb',
        face: {
            params: {
                color: '#ffffff',
                roughness: 1,
                metalness: 0,
                envMapIntensity: 0.1,
                normalScale: 0.15,
                bumpScale: 1,
                sheen: 1,
                sheenColor: '#1a1a1a',
                sheenRoughness: 0.8,
                colorMultiplier: 1
            },
            textures: {
                ...DEFAULT_TEXTURES
            }
        },
        back: {
            params: {
                color: '#080808',
                roughness: 1,
                envMapIntensity: 0.1,
                normalScale: 0.15,
                bumpScale: 1,
                sheen: 1,
                sheenColor: '#1a1a1a',
                sheenRoughness: 0.8
            },
            textures: {
                ...DEFAULT_TEXTURES
            }
        },
        frame: {
            params: {
                color: '#0f0f0f',
                roughness: 0.5,
                metalness: 0,
                clearcoat: 0.4,
                clearcoatRoughness: 0.3
            },
            textures: {}
        },
        scene: {
            exposure: 0.7,
            ambientIntensity: 0.5,
            envIntensity: 1,
            background: '#ffffff'
        },
        colors: {
            backColor: '#080808',
            frameColor: '#0f0f0f',
            bgColor: '#111315'
        },
        camera: {
            fov: 35,
            distance: 0.2,
            polarAngle: 90,
            azimuthAngle: 0,
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

        if (role === 'face') {
            const faceColor = readColor(data, ['color', 'diffuse'], [1, 1, 1]);
            const { color, colorMultiplier } = decomposeViewerColor(faceColor);

            next.face.params.color = color;
            next.face.params.colorMultiplier = readNumber(data, ['colorMultiplier'], colorMultiplier);
            next.face.params.roughness = readNumber(data, ['roughness'], next.face.params.roughness);
            next.face.params.metalness = readNumber(data, ['metalness'], next.face.params.metalness);
            next.face.params.envMapIntensity = readNumber(data, ['envMapIntensity'], next.face.params.envMapIntensity);
            next.face.params.normalScale = readNumber(data, ['normalScale', 'normalStrength'], next.face.params.normalScale);
            next.face.params.bumpScale = readNumber(data, ['bumpScale', 'heightMapFactor', 'bumpMapFactor'], next.face.params.bumpScale);
            next.face.params.sheen = readNumber(
                data,
                ['sheen'],
                readBoolean(data, ['useSheen', 'sheenEnabled'], next.face.params.sheen > 0) ? 1 : 0
            );
            next.face.params.sheenColor = rgbTupleToHexInternal(readColor(data, ['sheenColor', 'sheen'], [0.1, 0.1, 0.1]));
            next.face.params.sheenRoughness = readNumber(
                data,
                ['sheenRoughness'],
                1 - readNumber(data, ['sheenGloss'], 1 - next.face.params.sheenRoughness)
            );
            applySharedTextures(textures, next.face.textures);
            return;
        }

        if (role === 'back') {
            next.back.params.color = rgbTupleToHexInternal(readColor(data, ['color', 'diffuse'], [0.031, 0.031, 0.031]));
            next.back.params.roughness = readNumber(data, ['roughness'], next.back.params.roughness);
            next.back.params.envMapIntensity = readNumber(data, ['envMapIntensity'], next.back.params.envMapIntensity);
            next.back.params.normalScale = readNumber(data, ['normalScale', 'normalStrength'], next.back.params.normalScale);
            next.back.params.bumpScale = readNumber(data, ['bumpScale', 'heightMapFactor', 'bumpMapFactor'], next.back.params.bumpScale);
            next.back.params.sheen = readNumber(
                data,
                ['sheen'],
                readBoolean(data, ['useSheen', 'sheenEnabled'], next.back.params.sheen > 0) ? 1 : 0
            );
            next.back.params.sheenColor = rgbTupleToHexInternal(readColor(data, ['sheenColor', 'sheen'], [0.1, 0.1, 0.1]));
            next.back.params.sheenRoughness = readNumber(
                data,
                ['sheenRoughness'],
                1 - readNumber(data, ['sheenGloss'], 1 - next.back.params.sheenRoughness)
            );
            applySharedTextures(textures, next.back.textures);
            return;
        }

        if (role === 'frame') {
            next.frame.params.color = rgbTupleToHexInternal(readColor(data, ['color', 'diffuse'], [0.06, 0.06, 0.06]));
            next.frame.params.roughness = readNumber(data, ['roughness'], next.frame.params.roughness);
            next.frame.params.metalness = readNumber(data, ['metalness'], next.frame.params.metalness);
            next.frame.params.clearcoat = readNumber(data, ['clearcoat', 'clearCoat', 'clearcoatAmount'], next.frame.params.clearcoat);
            next.frame.params.clearcoatRoughness = readNumber(
                data,
                ['clearcoatRoughness', 'clearcoatGlossiness'],
                1 - readNumber(data, ['clearCoatGloss'], 1 - next.frame.params.clearcoatRoughness)
            );
        }
    });

    next.colors.backColor = next.back.params.color;
    next.colors.frameColor = next.frame.params.color;
    next.colors.bgColor = next.scene.background;

    return next;
};
