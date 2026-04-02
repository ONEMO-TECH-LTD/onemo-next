import JSZip from 'jszip';
import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

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

const AMBIENT_LIGHT_NAME = '__onemo_ambient_light__';
const FALLBACK_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const DEFAULT_SCENE_NAME = 'Untitled Scene';

export type OnemoSceneGroup = THREE.Group & {
    background?: THREE.Color | null;
    backgroundIntensity?: number;
    backgroundRotation?: THREE.Euler;
    fog?: THREE.Fog | THREE.FogExp2 | null;
    environment?: THREE.Texture | null;
    environmentIntensity?: number;
    environmentRotation?: THREE.Euler;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readNumber = (value: unknown, fallback: number) => {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const readString = (value: unknown, fallback: string) => {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
};

const readNullableString = (value: unknown, fallback: string | null) => {
    if (value === null) {
        return null;
    }

    return typeof value === 'string' && value.length > 0 ? value : fallback;
};

const readBoolean = (value: unknown, fallback: boolean) => {
    return typeof value === 'boolean' ? value : fallback;
};

const readTuple3 = (value: unknown, fallback: readonly number[]) => {
    if (!Array.isArray(value)) {
        return [Number(fallback[0]), Number(fallback[1]), Number(fallback[2])] as [number, number, number];
    }

    return [
        Number(value[0] ?? fallback[0]),
        Number(value[1] ?? fallback[1]),
        Number(value[2] ?? fallback[2])
    ] as [number, number, number];
};

const normalizeEditorCamera = (value: unknown): OnemoEditorCamera => {
    const source = isRecord(value) ? value : {};

    return {
        position: readTuple3(source.position, DEFAULT_EDITOR_CAMERA.position),
        target: readTuple3(source.target, DEFAULT_EDITOR_CAMERA.target),
        fov: readNumber(source.fov, DEFAULT_EDITOR_CAMERA.fov),
        near: readNumber(source.near, DEFAULT_EDITOR_CAMERA.near),
        far: readNumber(source.far, DEFAULT_EDITOR_CAMERA.far)
    };
};

const normalizeRendererSettings = (value: unknown): OnemoRendererSettings => {
    const source = isRecord(value) ? value : {};

    return {
        toneMapping: readNumber(source.toneMapping, DEFAULT_RENDERER_SETTINGS.toneMapping),
        toneMappingExposure: readNumber(source.toneMappingExposure, DEFAULT_RENDERER_SETTINGS.toneMappingExposure),
        outputColorSpace: readString(source.outputColorSpace, DEFAULT_RENDERER_SETTINGS.outputColorSpace),
        shadowsEnabled: readBoolean(source.shadowsEnabled, DEFAULT_RENDERER_SETTINGS.shadowsEnabled),
        shadowType: readNumber(source.shadowType, DEFAULT_RENDERER_SETTINGS.shadowType)
    };
};

const normalizeEnvironmentSettings = (value: unknown, fallbackFile: string | null): OnemoEnvironmentSettings => {
    const source = isRecord(value) ? value : {};
    const groundSource = isRecord(source.ground) ? source.ground : {};

    return {
        file: readNullableString(source.file, fallbackFile),
        preset: readNullableString(source.preset, DEFAULT_ENVIRONMENT.preset),
        intensity: readNumber(source.intensity, DEFAULT_ENVIRONMENT.intensity),
        rotation: readNumber(source.rotation, DEFAULT_ENVIRONMENT.rotation),
        ground: {
            enabled: readBoolean(groundSource.enabled, DEFAULT_ENVIRONMENT.ground.enabled),
            height: readNumber(groundSource.height, DEFAULT_ENVIRONMENT.ground.height),
            radius: readNumber(groundSource.radius, DEFAULT_ENVIRONMENT.ground.radius)
        }
    };
};

const normalizeSceneSettings = (value: unknown): OnemoSceneSettings => {
    const source = isRecord(value) ? value : {};
    const fog = source.fog === 'linear' || source.fog === 'exponential' || source.fog === 'none'
        ? source.fog
        : DEFAULT_SCENE_SETTINGS.fog;

    return {
        backgroundColor: readString(source.backgroundColor, DEFAULT_SCENE_SETTINGS.backgroundColor),
        fog,
        fogColor: readString(source.fogColor, DEFAULT_SCENE_SETTINGS.fogColor),
        fogNear: readNumber(source.fogNear, DEFAULT_SCENE_SETTINGS.fogNear),
        fogFar: readNumber(source.fogFar, DEFAULT_SCENE_SETTINGS.fogFar),
        fogDensity: readNumber(source.fogDensity, DEFAULT_SCENE_SETTINGS.fogDensity),
        ambientColor: readTuple3(source.ambientColor, DEFAULT_SCENE_SETTINGS.ambientColor),
        ambientIntensity: readNumber(source.ambientIntensity, DEFAULT_SCENE_SETTINGS.ambientIntensity)
    };
};

const normalizeProductConfig = (value: unknown): OnemoProductConfig => {
    if (!isRecord(value)) {
        return JSON.parse(JSON.stringify(DEFAULT_PRODUCT_CONFIG)) as OnemoProductConfig;
    }

    return {
        productType: readString(value.productType, DEFAULT_PRODUCT_CONFIG.productType),
        materialRoles: Array.isArray(value.materialRoles)
            ? JSON.parse(JSON.stringify(value.materialRoles)) as OnemoProductConfig['materialRoles']
            : JSON.parse(JSON.stringify(DEFAULT_PRODUCT_CONFIG.materialRoles)) as OnemoProductConfig['materialRoles'],
        artworkSlot: isRecord(value.artworkSlot)
            ? {
                meshName: readString(value.artworkSlot.meshName, DEFAULT_PRODUCT_CONFIG.artworkSlot?.meshName ?? ''),
                role: readString(value.artworkSlot.role, DEFAULT_PRODUCT_CONFIG.artworkSlot?.role ?? ''),
                defaultUrl: typeof value.artworkSlot.defaultUrl === 'string' ? value.artworkSlot.defaultUrl : DEFAULT_PRODUCT_CONFIG.artworkSlot?.defaultUrl,
                textureChannel: readString(value.artworkSlot.textureChannel, DEFAULT_PRODUCT_CONFIG.artworkSlot?.textureChannel ?? 'map')
            }
            : DEFAULT_PRODUCT_CONFIG.artworkSlot
                ? JSON.parse(JSON.stringify(DEFAULT_PRODUCT_CONFIG.artworkSlot))
                : undefined
    };
};

const normalizeMaterialOverrides = (value: unknown) => {
    if (!isRecord(value)) {
        return undefined;
    }

    const result: Record<string, Record<string, unknown>> = {};
    Object.entries(value).forEach(([materialName, overrides]) => {
        if (isRecord(overrides)) {
            result[materialName] = { ...overrides };
        }
    });

    return Object.keys(result).length > 0 ? result : undefined;
};

const normalizeStudioJson = (value: unknown, fallbackEnvironmentFile: string | null): OnemoStudioJson => {
    const source = isRecord(value) ? value : {};

    return {
        version: ONEMO_FORMAT_VERSION,
        created: readString(source.created, FALLBACK_TIMESTAMP),
        modified: readString(source.modified, FALLBACK_TIMESTAMP),
        name: readString(source.name, DEFAULT_SCENE_NAME),
        renderer: normalizeRendererSettings(source.renderer),
        environment: normalizeEnvironmentSettings(source.environment, fallbackEnvironmentFile),
        scene: normalizeSceneSettings(source.scene),
        editorCamera: normalizeEditorCamera(source.editorCamera),
        product: normalizeProductConfig(source.product),
        materialOverrides: normalizeMaterialOverrides(source.materialOverrides)
    };
};

const buildFog = (sceneSettings: OnemoSceneSettings) => {
    const fogColor = new THREE.Color(sceneSettings.fogColor);

    if (sceneSettings.fog === 'linear') {
        return new THREE.Fog(fogColor, sceneSettings.fogNear, sceneSettings.fogFar);
    }

    if (sceneSettings.fog === 'exponential') {
        return new THREE.FogExp2(fogColor, sceneSettings.fogDensity);
    }

    return null;
};

const cloneFog = (fog: THREE.Fog | THREE.FogExp2 | null | undefined) => {
    if (fog instanceof THREE.Fog) {
        return new THREE.Fog(fog.color.clone(), fog.near, fog.far);
    }

    if (fog instanceof THREE.FogExp2) {
        return new THREE.FogExp2(fog.color.clone(), fog.density);
    }

    return null;
};

const loadEnvironmentTexture = (
    buffer: ArrayBuffer,
    filename: string,
    renderer: THREE.WebGLRenderer
) => {
    try {
        const parsedTexture = filename.toLowerCase().endsWith('.exr')
            ? new EXRLoader().parse(buffer)
            : new HDRLoader().parse(buffer);
        const sourceTexture = parsedTexture as unknown as THREE.Texture;

        sourceTexture.mapping = THREE.EquirectangularReflectionMapping;

        if (typeof renderer.getContext !== 'function') {
            return sourceTexture;
        }

        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();

        try {
            const renderTarget = pmremGenerator.fromEquirectangular(sourceTexture);
            sourceTexture.dispose();
            return renderTarget.texture;
        } finally {
            pmremGenerator.dispose();
        }
    } catch {
        return null;
    }
};

const applySceneSettings = (
    scene: THREE.Group,
    studioJson: OnemoStudioJson,
    environmentTexture: THREE.Texture | null
) => {
    const target = scene as OnemoSceneGroup;

    target.background = new THREE.Color(studioJson.scene.backgroundColor);
    target.backgroundIntensity = studioJson.environment.intensity;
    target.backgroundRotation = new THREE.Euler(0, THREE.MathUtils.degToRad(studioJson.environment.rotation), 0);
    target.fog = buildFog(studioJson.scene);
    target.environment = environmentTexture;
    target.environmentIntensity = studioJson.environment.intensity;
    target.environmentRotation = new THREE.Euler(0, THREE.MathUtils.degToRad(studioJson.environment.rotation), 0);
};

export const applyOnemoSceneState = (targetScene: THREE.Scene, sourceScene: THREE.Group) => {
    const source = sourceScene as OnemoSceneGroup;

    targetScene.background = source.background instanceof THREE.Color ? source.background.clone() : null;
    targetScene.fog = cloneFog(source.fog);
    targetScene.environment = source.environment ?? null;

    if (typeof source.environmentIntensity === 'number') {
        targetScene.environmentIntensity = source.environmentIntensity;
    }

    if (typeof source.backgroundIntensity === 'number') {
        targetScene.backgroundIntensity = source.backgroundIntensity;
    }

    if (source.environmentRotation instanceof THREE.Euler) {
        targetScene.environmentRotation.copy(source.environmentRotation);
    }

    if (source.backgroundRotation instanceof THREE.Euler) {
        targetScene.backgroundRotation.copy(source.backgroundRotation);
    }
};

const applyAmbientLight = (scene: THREE.Group, sceneSettings: OnemoSceneSettings) => {
    let ambientLight = scene.children.find((child) => {
        return child instanceof THREE.AmbientLight && child.name === AMBIENT_LIGHT_NAME;
    }) as THREE.AmbientLight | undefined;

    if (!ambientLight) {
        ambientLight = new THREE.AmbientLight();
        ambientLight.name = AMBIENT_LIGHT_NAME;
        scene.add(ambientLight);
    }

    ambientLight.color.setRGB(
        sceneSettings.ambientColor[0],
        sceneSettings.ambientColor[1],
        sceneSettings.ambientColor[2]
    );
    ambientLight.intensity = sceneSettings.ambientIntensity;
};

const collectMaterialsByName = (scene: THREE.Group) => {
    const materialsByName = new Map<string, THREE.Material[]>();

    scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
            return;
        }

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
            if (!material?.name) {
                return;
            }

            const entry = materialsByName.get(material.name);
            if (entry) {
                entry.push(material);
            } else {
                materialsByName.set(material.name, [material]);
            }
        });
    });

    return materialsByName;
};

const applySingleMaterialOverride = (material: THREE.Material, key: string, value: unknown) => {
    if (!(key in material)) {
        return;
    }

    const target = material as THREE.Material & Record<string, unknown>;
    const current = target[key];

    if (current instanceof THREE.Color) {
        if (typeof value === 'string' || Array.isArray(value)) {
            current.set(value as THREE.ColorRepresentation);
        }
        return;
    }

    if (current instanceof THREE.Vector2) {
        if (Array.isArray(value)) {
            current.set(Number(value[0] ?? current.x), Number(value[1] ?? current.y));
        } else if (typeof value === 'number') {
            current.set(value, value);
        }
        return;
    }

    if (current instanceof THREE.Vector3) {
        if (Array.isArray(value)) {
            current.set(
                Number(value[0] ?? current.x),
                Number(value[1] ?? current.y),
                Number(value[2] ?? current.z)
            );
        }
        return;
    }

    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        target[key] = value;
    }
};

const applyMaterialOverrides = (scene: THREE.Group, materialOverrides?: Record<string, Record<string, unknown>>) => {
    if (!materialOverrides) {
        return;
    }

    const materialsByName = collectMaterialsByName(scene);
    Object.entries(materialOverrides).forEach(([materialName, overrides]) => {
        const materials = materialsByName.get(materialName);
        if (!materials) {
            return;
        }

        materials.forEach((material) => {
            Object.entries(overrides).forEach(([key, value]) => {
                applySingleMaterialOverride(material, key, value);
            });
            material.needsUpdate = true;
        });
    });
};

export interface OnemoDeserializeResult {
    scene: THREE.Group;
    studioJson: OnemoStudioJson;
    animations: THREE.AnimationClip[];
    environmentHdr: ArrayBuffer | null;
}

export async function deserializeOnemo(
    blob: Blob,
    renderer: THREE.WebGLRenderer
): Promise<OnemoDeserializeResult> {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const glbFile = zip.file('scene.glb');

    if (!glbFile) {
        throw new Error('Invalid .onemo file: missing scene.glb');
    }

    const environmentFile = zip.file('environment.hdr') ?? zip.file('environment.exr') ?? null;
    const studioFile = zip.file('studio.json');
    const glbBuffer = await glbFile.async('arraybuffer');
    const environmentHdr = environmentFile ? await environmentFile.async('arraybuffer') : null;

    let parsedStudioJson: unknown = null;
    if (studioFile) {
        try {
            parsedStudioJson = JSON.parse(await studioFile.async('string'));
        } catch {
            parsedStudioJson = null;
        }
    }

    const studioJson = normalizeStudioJson(parsedStudioJson, environmentFile?.name ?? null);
    const loader = new GLTFLoader();
    const gltf = await loader.parseAsync(glbBuffer, '');
    const environmentTexture = environmentHdr && environmentFile
        ? loadEnvironmentTexture(environmentHdr, environmentFile.name, renderer)
        : null;

    renderer.toneMapping = studioJson.renderer.toneMapping as THREE.ToneMapping;
    renderer.toneMappingExposure = studioJson.renderer.toneMappingExposure;
    renderer.outputColorSpace = studioJson.renderer.outputColorSpace as THREE.ColorSpace;
    renderer.shadowMap.enabled = studioJson.renderer.shadowsEnabled;
    renderer.shadowMap.type = studioJson.renderer.shadowType as THREE.ShadowMapType;

    applySceneSettings(gltf.scene, studioJson, environmentTexture);
    applyAmbientLight(gltf.scene, studioJson.scene);
    applyMaterialOverrides(gltf.scene, studioJson.materialOverrides);

    return {
        scene: gltf.scene,
        studioJson,
        animations: gltf.animations,
        environmentHdr
    };
}
