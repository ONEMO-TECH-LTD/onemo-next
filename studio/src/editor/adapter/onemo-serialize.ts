import JSZip from 'jszip';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

import { suspendBridgeArtifactsForExport } from './bridge-utils';

import {
    DEFAULT_EDITOR_CAMERA,
    DEFAULT_ENVIRONMENT,
    DEFAULT_PRODUCT_CONFIG,
    DEFAULT_RENDERER_SETTINGS,
    DEFAULT_SCENE_SETTINGS,
    ONEMO_FORMAT_VERSION,
    type OnemoEditorCamera,
    type OnemoEnvironmentSettings,
    type OnemoProductConfig,
    type OnemoRendererSettings,
    type OnemoSceneSettings,
    type OnemoStudioJson
} from './onemo-format';

const DEFAULT_SCENE_NAME = 'Untitled Scene';
const TEXTURE_PROPERTY_KEYS = [
    'map',
    'alphaMap',
    'aoMap',
    'bumpMap',
    'clearcoatMap',
    'clearcoatNormalMap',
    'clearcoatRoughnessMap',
    'displacementMap',
    'emissiveMap',
    'iridescenceMap',
    'iridescenceThicknessMap',
    'lightMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
    'sheenColorMap',
    'sheenRoughnessMap',
    'specularColorMap',
    'specularIntensityMap',
    'thicknessMap',
    'transmissionMap'
] as const;

const toHex = (color: THREE.Color) => {
    return `#${color.getHexString()}`;
};

const toTuple3 = (
    value: THREE.Vector3 | readonly number[] | null | undefined,
    fallback: readonly number[]
): [number, number, number] => {
    if (value instanceof THREE.Vector3) {
        return [value.x, value.y, value.z];
    }

    if (!Array.isArray(value)) {
        return [Number(fallback[0]), Number(fallback[1]), Number(fallback[2])];
    }

    return [
        Number(value[0] ?? fallback[0]),
        Number(value[1] ?? fallback[1]),
        Number(value[2] ?? fallback[2])
    ];
};

const cloneProductConfig = (productConfig: OnemoProductConfig | null | undefined): OnemoProductConfig => {
    const source = productConfig ?? DEFAULT_PRODUCT_CONFIG;
    return JSON.parse(JSON.stringify(source)) as OnemoProductConfig;
};

const extractAmbientLight = (scene: THREE.Scene) => {
    let ambientLight: THREE.AmbientLight | null = null;

    scene.traverse((object) => {
        if (!ambientLight && object instanceof THREE.AmbientLight) {
            ambientLight = object;
        }
    });

    return ambientLight;
};

const extractSceneSettings = (scene: THREE.Scene): OnemoSceneSettings => {
    const ambientLight = extractAmbientLight(scene) as THREE.AmbientLight | null;
    const backgroundColor = scene.background instanceof THREE.Color
        ? [scene.background.r, scene.background.g, scene.background.b] as [number, number, number]
        : DEFAULT_SCENE_SETTINGS.backgroundColor;

    const sceneSettings: OnemoSceneSettings = {
        ...DEFAULT_SCENE_SETTINGS,
        backgroundColor,
        ambientColor: ambientLight ? [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b] : [...DEFAULT_SCENE_SETTINGS.ambientColor] as [number, number, number],
        ambientIntensity: ambientLight?.intensity ?? DEFAULT_SCENE_SETTINGS.ambientIntensity
    };

    if (scene.fog instanceof THREE.Fog) {
        sceneSettings.fog = 'linear';
        sceneSettings.fogColor = toHex(scene.fog.color);
        sceneSettings.fogNear = scene.fog.near;
        sceneSettings.fogFar = scene.fog.far;
        return sceneSettings;
    }

    if (scene.fog instanceof THREE.FogExp2) {
        sceneSettings.fog = 'exponential';
        sceneSettings.fogColor = toHex(scene.fog.color);
        sceneSettings.fogDensity = scene.fog.density;
    }

    return sceneSettings;
};

const extractMaterialOverrides = (material: THREE.Material): Record<string, unknown> | null => {
    const overrides: Record<string, unknown> = {};
    const physicalLike = material as THREE.MeshStandardMaterial & {
        anisotropy?: number;
        anisotropyRotation?: number;
        clearcoatNormalScale?: THREE.Vector2;
    };

    if (typeof physicalLike.envMapIntensity === 'number' && physicalLike.envMapIntensity !== 1) {
        overrides.envMapIntensity = physicalLike.envMapIntensity;
    }

    if (typeof physicalLike.bumpScale === 'number' && physicalLike.bumpScale !== 1) {
        overrides.bumpScale = physicalLike.bumpScale;
    }

    if (physicalLike.normalScale instanceof THREE.Vector2 && (physicalLike.normalScale.x !== 1 || physicalLike.normalScale.y !== 1)) {
        overrides.normalScale = [physicalLike.normalScale.x, physicalLike.normalScale.y];
    }

    if (physicalLike.clearcoatNormalScale instanceof THREE.Vector2 &&
        (physicalLike.clearcoatNormalScale.x !== 1 || physicalLike.clearcoatNormalScale.y !== 1)) {
        overrides.clearcoatNormalScale = [physicalLike.clearcoatNormalScale.x, physicalLike.clearcoatNormalScale.y];
    }

    if (typeof physicalLike.anisotropy === 'number' && physicalLike.anisotropy !== 0) {
        overrides.anisotropy = physicalLike.anisotropy;
    }

    if (typeof physicalLike.anisotropyRotation === 'number' && physicalLike.anisotropyRotation !== 0) {
        overrides.anisotropyRotation = physicalLike.anisotropyRotation;
    }

    return Object.keys(overrides).length > 0 ? overrides : null;
};

const hasValidTextureImageData = (texture: THREE.Texture | null | undefined) => {
    if (!(texture instanceof THREE.Texture)) {
        return false;
    }

    const source = texture.source?.data ?? texture.image;
    if (!source) {
        return false;
    }

    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
        return source.width > 0 && source.height > 0;
    }

    if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
        return source.width > 0 && source.height > 0;
    }

    if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
        return (source.naturalWidth || source.width || 0) > 0 && (source.naturalHeight || source.height || 0) > 0;
    }

    if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
        return source.width > 0 && source.height > 0;
    }

    if (typeof ImageData !== 'undefined' && source instanceof ImageData) {
        return source.width > 0 && source.height > 0;
    }

    if (ArrayBuffer.isView(source)) {
        return source.byteLength > 0;
    }

    if (typeof source === 'object' && source !== null) {
        const width = Number((source as { width?: number }).width ?? 0);
        const height = Number((source as { height?: number }).height ?? 0);
        if (width > 0 && height > 0) {
            return true;
        }

        const data = (source as { data?: ArrayBufferView | ArrayLike<number> | null }).data;
        if (ArrayBuffer.isView(data)) {
            return data.byteLength > 0;
        }
    }

    return false;
};

const withExportSafeTextures = async <T>(scene: THREE.Scene, run: (exportScene: THREE.Scene) => Promise<T>) => {
    const replacements = new Map<THREE.Material, Map<string, THREE.Texture | null>>();

    scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
            return;
        }

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
            if (!(material instanceof THREE.Material)) {
                return;
            }

            TEXTURE_PROPERTY_KEYS.forEach((key) => {
                const texture = (material as THREE.Material & Record<string, unknown>)[key];
                if (!(texture instanceof THREE.Texture) || hasValidTextureImageData(texture)) {
                    return;
                }

                let materialReplacements = replacements.get(material);
                if (!materialReplacements) {
                    materialReplacements = new Map<string, THREE.Texture | null>();
                    replacements.set(material, materialReplacements);
                }

                materialReplacements.set(key, texture);
                (material as THREE.Material & Record<string, unknown>)[key] = null;
                material.needsUpdate = true;
            });
        });
    });

    try {
        return await run(scene);
    } finally {
        replacements.forEach((entries, material) => {
            entries.forEach((texture, key) => {
                (material as THREE.Material & Record<string, unknown>)[key] = texture;
            });
            material.needsUpdate = true;
        });
    }
};

const collectMaterialOverrides = (scene: THREE.Scene) => {
    const materialOverrides: Record<string, Record<string, unknown>> = {};

    scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
            return;
        }

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
            if (!material?.name) {
                return;
            }

            const overrides = extractMaterialOverrides(material);
            if (overrides) {
                materialOverrides[material.name] = overrides;
            }
        });
    });

    return Object.keys(materialOverrides).length > 0 ? materialOverrides : undefined;
};

const extractEditorCamera = (
    editorCamera: {
        position: THREE.Vector3;
        target: THREE.Vector3;
        fov: number;
        near: number;
        far: number;
    }
): OnemoEditorCamera => {
    return {
        position: toTuple3(editorCamera.position, DEFAULT_EDITOR_CAMERA.position),
        target: toTuple3(editorCamera.target, DEFAULT_EDITOR_CAMERA.target),
        fov: Number.isFinite(editorCamera.fov) ? editorCamera.fov : DEFAULT_EDITOR_CAMERA.fov,
        near: Number.isFinite(editorCamera.near) ? editorCamera.near : DEFAULT_EDITOR_CAMERA.near,
        far: Number.isFinite(editorCamera.far) ? editorCamera.far : DEFAULT_EDITOR_CAMERA.far
    };
};

export async function serializeOnemo(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    editorCamera: {
        position: THREE.Vector3;
        target: THREE.Vector3;
        fov: number;
        near: number;
        far: number;
    },
    productConfig: OnemoProductConfig,
    environmentHdr?: ArrayBuffer | null,
    rendererOverrides?: Partial<OnemoRendererSettings>,
    sceneOverrides?: Partial<OnemoSceneSettings>,
    environmentOverrides?: Partial<OnemoEnvironmentSettings>
): Promise<Blob> {
    const exporter = new GLTFExporter();
    const restoreBridgeArtifacts = suspendBridgeArtifactsForExport(scene);
    const glb = await withExportSafeTextures(scene, async (exportScene) => {
        try {
            const exported = await exporter.parseAsync(exportScene, { binary: true });
            if (!(exported instanceof ArrayBuffer)) {
                throw new Error('Expected binary GLB output from GLTFExporter');
            }
            return exported;
        } finally {
            restoreBridgeArtifacts();
        }
    });
    const now = new Date().toISOString();
    const sceneWithEnvironment = scene as THREE.Scene & {
        environmentIntensity?: number;
        environmentRotation?: THREE.Euler;
    };

    const extractedSceneSettings = extractSceneSettings(scene);
    const extractedEnvironmentSettings: OnemoEnvironmentSettings = {
        ...DEFAULT_ENVIRONMENT,
        file: environmentHdr ? 'environment.hdr' : null,
        preset: environmentHdr ? null : DEFAULT_ENVIRONMENT.preset,
        intensity: typeof sceneWithEnvironment.environmentIntensity === 'number'
            ? sceneWithEnvironment.environmentIntensity
            : DEFAULT_ENVIRONMENT.intensity,
        rotation: sceneWithEnvironment.environmentRotation instanceof THREE.Euler
            ? THREE.MathUtils.radToDeg(sceneWithEnvironment.environmentRotation.y)
            : DEFAULT_ENVIRONMENT.rotation
    };

    const studioJson: OnemoStudioJson = {
        version: ONEMO_FORMAT_VERSION,
        created: now,
        modified: now,
        name: scene.name.trim() || productConfig.productType || DEFAULT_SCENE_NAME,
        renderer: {
            toneMapping: rendererOverrides?.toneMapping ?? renderer.toneMapping ?? DEFAULT_RENDERER_SETTINGS.toneMapping,
            toneMappingExposure: rendererOverrides?.toneMappingExposure ?? renderer.toneMappingExposure ?? DEFAULT_RENDERER_SETTINGS.toneMappingExposure,
            outputColorSpace: rendererOverrides?.outputColorSpace ?? renderer.outputColorSpace ?? DEFAULT_RENDERER_SETTINGS.outputColorSpace,
            shadowsEnabled: rendererOverrides?.shadowsEnabled ?? renderer.shadowMap.enabled ?? DEFAULT_RENDERER_SETTINGS.shadowsEnabled,
            shadowType: rendererOverrides?.shadowType ?? renderer.shadowMap.type ?? DEFAULT_RENDERER_SETTINGS.shadowType
        },
        environment: {
            ...extractedEnvironmentSettings,
            ...environmentOverrides,
            ground: {
                ...extractedEnvironmentSettings.ground,
                ...(environmentOverrides?.ground || {})
            }
        },
        scene: {
            ...extractedSceneSettings,
            ...sceneOverrides
        },
        editorCamera: extractEditorCamera(editorCamera),
        product: cloneProductConfig(productConfig),
        materialOverrides: collectMaterialOverrides(scene)
    };

    const zip = new JSZip();
    zip.file('scene.glb', glb);
    zip.file('studio.json', JSON.stringify(studioJson, null, 2));

    if (environmentHdr) {
        zip.file('environment.hdr', environmentHdr);
    }

    return zip.generateAsync({ type: 'blob' });
}
