import type { EventHandle, Observer } from '@playcanvas/observer';
import JSZip from 'jszip';
import * as THREE from 'three';

import { config } from '@/editor/config';
import { Asset, type AssetObserver, type Entity, type EntityObserver } from '@/editor-api';


import { applyAnimObserverChange } from './anim-mapper';
import { applyAnimationObserverChange } from './animation-mapper';
import { applyAudiolistenerObserverChange } from './audiolistener-mapper';
import { setBridgeAudioCamera } from './bridge-audio-state';
import { applyButtonObserverChange } from './button-mapper';
import { getStoredBridgeComponents, runBridgeUpdaters } from './bridge-utils';
import { createCameraComponentData, createReplacementCameraForProjection, applyCameraObserverChange } from './camera-mapper';
import { applyCollisionObserverChange } from './collision-mapper';
import {
    BRIDGE_ASSET_ID_BASE,
    BRIDGE_ASSET_TAG,
    BRIDGE_ASSET_UNIQUE_ID_BASE,
    BLEND_NONE,
    BLEND_NORMAL,
    BRIDGE_CAMERA_ID,
    BRIDGE_CAMERA_NAME,
    BRIDGE_LIGHT_ID,
    BRIDGE_LIGHT_NAME,
    BRIDGE_ROOT_ID,
    BRIDGE_ROOT_NAME,
    SCENE_SYNC_EPSILON
} from './constants';
import { applyElementObserverChange } from './element-mapper';
import { createBridgeEntityData, getEntityDisplayName, toObserverEuler, toObserverVec3 } from './entity-mapper';
import { applyGSplatObserverChange } from './gsplat-mapper';
import { applyLayoutchildObserverChange } from './layoutchild-mapper';
import { applyLayoutgroupObserverChange } from './layoutgroup-mapper';
import { createLightComponentData, createReplacementLightForShape, applyLightObserverChange } from './light-mapper';
import { createMaterialData, applyMaterialObserverChange } from './material-mapper';
import { applyModelObserverChange } from './model-mapper';
import { applyParticleObserverChange } from './particle-mapper';
import { createRenderComponentData, applyRenderObserverChange } from './render-mapper';
import { applyRigidbodyObserverChange } from './rigidbody-mapper';
import { applyScreenObserverChange } from './screen-mapper';
import {
    cloneViewerConfig,
    decomposeViewerColor,
    savedSceneToViewerConfig,
    type SavedScene,
    type SavedSceneCameraComponent,
    type SavedSceneEntity,
    type SavedSceneEntityComponents,
    type SavedSceneLightComponent,
    type SavedSceneMaterial,
    type SavedSceneMaterialData,
    type SavedSceneMaterialRole,
    type SavedSceneRenderComponent,
    type SavedSceneSettings,
    type SavedSceneTexture,
    type SavedSceneTextureKey
} from './scene-schema';
import { DEFAULT_EDITOR_CAMERA, DEFAULT_PRODUCT_CONFIG } from './onemo-format';
import { applyOnemoSceneState, deserializeOnemo } from './onemo-deserialize';
import { serializeOnemo } from './onemo-serialize';
import { applyScriptObserverChange } from './script-mapper';
import { applyScrollviewObserverChange } from './scrollview-mapper';
import { applySoundObserverChange } from './sound-mapper';
import { applySpriteObserverChange } from './sprite-mapper';
import { applyZoneObserverChange } from './zone-mapper';
// Monorepo coupling: imports shared types from the prototype viewer.
// TODO: Extract to a shared types package when the editor is packaged independently.
import type { EffectViewerBridge } from '../../../../src/app/(dev)/prototype/core/EffectViewer';
import type { ViewerConfig } from '../../../../src/app/(dev)/prototype/types';
import { CameraComponentInspector } from '../inspector/components/camera';
import { LightComponentInspector } from '../inspector/components/light';
import { RenderComponentInspector } from '../inspector/components/render';


type BridgeMaterialRecord = {
    assetId: number;
    material: THREE.Material;
    name: string;
    role: 'face' | 'back' | 'frame' | 'generic';
};

type SceneSnapshot = {
    name: string;
    enabled: boolean;
    position: number[];
    rotation: number[];
    scale: number[];
    light?: {
        color: number[];
        intensity: number;
        range: number;
        castShadows: boolean;
    };
    camera?: {
        fov: number;
        nearClip: number;
        farClip: number;
    };
};

type BridgeViewerActions = {
    updateConfig: (updater: (config: ViewerConfig) => void) => void;
};

type TransformSnapshot = {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
};

type HistoryToggleTarget = {
    history?: {
        enabled?: boolean;
    };
} | null | undefined;

type RuntimeEntityInspector = {
    _templateOverridesInspector: unknown;
    _componentInspectors: Record<string, unknown>;
    append: (inspector: unknown) => void;
};

const nearlyEqual = (a: number, b: number) => {
    return Math.abs(a - b) <= SCENE_SYNC_EPSILON;
};

const arraysEqual = (a: number[] = [], b: number[] = []) => {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        if (!nearlyEqual(a[i], b[i])) {
            return false;
        }
    }

    return true;
};

const normalizeAssetPath = (path: string) => {
    const knownPrefixes = [
        'data.diffuse',
        'data.aoIntensity',
        'data.ambient',
        'data.enableGGXSpecular',
        'data.useMetalness',
        'data.metalness',
        'data.specular',
        'data.specularityFactor',
        'data.anisotropyIntensity',
        'data.anisotropyRotation',
        'data.roughness',
        'data.shininess',
        'data.normalStrength',
        'data.bumpMapFactor',
        'data.heightMapFactor',
        'data.glossInvert',
        'data.emissive',
        'data.emissiveIntensity',
        'data.alphaToCoverage',
        'data.clearcoat',
        'data.clearcoatRoughness',
        'data.clearCoat',
        'data.clearCoatGloss',
        'data.clearCoatBumpiness',
        'data.sheenEnabled',
        'data.useSheen',
        'data.sheen',
        'data.sheenRoughness',
        'data.sheenGloss',
        'data.refraction',
        'data.refractionIndex',
        'data.dispersion',
        'data.thickness',
        'data.attenuation',
        'data.attenuationDistance',
        'data.useIridescence',
        'data.iridescence',
        'data.iridescenceThicknessMin',
        'data.iridescenceThicknessMax',
        'data.iridescenceRefractionIndex',
        'data.reflectivity',
        'data.cubeMapProjectionBox.center',
        'data.cubeMapProjectionBox.halfExtents',
        'data.depthTest',
        'data.depthWrite',
        'data.cull',
        'data.useFog',
        'data.useLighting',
        'data.useSkybox',
        'data.useTonemap',
        'data.opacity',
        'data.blendType',
        'data.alphaTest'
    ];

    return knownPrefixes.find(prefix => path.startsWith(prefix)) || path;
};

const normalizeEntityPath = (path: string) => {
    const knownPrefixes = [
        'components.light.color',
        'components.light.layers',
        'components.render.materialAssets',
        'components.camera.rect',
        'components.camera.layers'
    ];

    return knownPrefixes.find(prefix => path.startsWith(prefix)) || path;
};

const cloneArray = (value: number[]) => {
    return value.slice(0);
};

const cloneSerializable = <T>(value: T): T => {
    return JSON.parse(JSON.stringify(value));
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toSavedRgbTuple = (color: THREE.Color): [number, number, number] => {
    return [color.r, color.g, color.b];
};

const TEXTURE_SLOT_ALIASES_BY_PROPERTY: Record<SavedSceneTextureKey, string[]> = {
    map: ['diffuseMap', 'baseColorMap', 'colorMap'],
    normalMap: ['normalMap'],
    bumpMap: ['heightMap', 'bumpMap'],
    roughnessMap: ['roughnessMap', 'glossMap'],
    metalnessMap: ['metalnessMap'],
    aoMap: ['aoMap'],
    lightMap: ['lightMap'],
    alphaMap: ['opacityMap'],
    emissiveMap: ['emissiveMap'],
    clearcoatMap: ['clearCoatMap'],
    clearcoatRoughnessMap: ['clearCoatGlossMap'],
    clearcoatNormalMap: ['clearCoatNormalMap'],
    sheenColorMap: ['sheenColorMap', 'sheenMap'],
    sheenRoughnessMap: ['sheenGlossMap'],
    transmissionMap: ['refractionMap'],
    thicknessMap: ['thicknessMap'],
    iridescenceMap: ['iridescenceMap'],
    iridescenceThicknessMap: ['iridescenceThicknessMap'],
    anisotropyMap: ['anisotropyMap'],
    specularColorMap: ['specularMap'],
    specularIntensityMap: ['specularityFactorMap']
};

const OBSERVER_TEXTURE_SLOTS = Array.from(new Set(
    Object.values(TEXTURE_SLOT_ALIASES_BY_PROPERTY).flat()
));

const getLightRange = (light: THREE.Light) => {
    if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        return light.distance || 0;
    }

    return 0;
};

const collectMaterialSlots = (root: THREE.Object3D) => {
    const materialSlots = new Map<string, THREE.Material | THREE.Material[]>();

    root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            materialSlots.set(object.uuid, object.material);
        }
    });

    return materialSlots;
};

const createCameraConfigFromEditorCamera = (
    editorCamera: {
        position: [number, number, number];
        target: [number, number, number];
        fov: number;
    },
    fallback?: ViewerConfig['camera']
): NonNullable<ViewerConfig['camera']> => {
    const position = new THREE.Vector3(...editorCamera.position);
    const target = new THREE.Vector3(...editorCamera.target);
    const offset = position.clone().sub(target);
    const spherical = new THREE.Spherical().setFromVector3(offset.lengthSq() > 0 ? offset : new THREE.Vector3(0, 0, DEFAULT_EDITOR_CAMERA.position[2]));
    const base = fallback || {
        fov: DEFAULT_EDITOR_CAMERA.fov,
        distance: 0.2,
        polarAngle: 90,
        azimuthAngle: 0,
        enableDamping: true,
        dampingFactor: 0.1,
        autoRotate: false,
        autoRotateSpeed: 2
    };

    return {
        ...base,
        fov: editorCamera.fov,
        distance: spherical.radius,
        polarAngle: THREE.MathUtils.radToDeg(spherical.phi),
        azimuthAngle: THREE.MathUtils.radToDeg(spherical.theta)
    };
};

const isJsonBlob = (blob: Blob) => {
    return blob.type.toLowerCase().includes('application/json') || blob.type.toLowerCase().includes('text/json');
};

const isViewerCamera = (camera: THREE.Camera): camera is THREE.PerspectiveCamera | THREE.OrthographicCamera => {
    return camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera;
};

const DEFAULT_SCENE_BACKGROUND_RGB: [number, number, number] = [0.067, 0.075, 0.082];
const DEFAULT_FOG_COLOR_RGB: [number, number, number] = [0, 0, 0];
const DEFAULT_AMBIENT_RGB: [number, number, number] = [0.15, 0.15, 0.15];
const DEFAULT_FOG_START = 1;
const DEFAULT_FOG_END = 1000;
const DEFAULT_FOG_DENSITY = 0.01;
const DEFAULT_AMBIENT_INTENSITY = 0.5;
const DEFAULT_ENV_INTENSITY = 1;
const DEFAULT_ENV_ROTATION = 0;
const BRIDGE_BASE_ENV_MAP_INTENSITY = '__bridgeBaseEnvMapIntensity';

const rgbTupleToHex = (value: readonly number[]) => {
    return `#${new THREE.Color(
        Number(value[0] ?? DEFAULT_AMBIENT_RGB[0]),
        Number(value[1] ?? DEFAULT_AMBIENT_RGB[1]),
        Number(value[2] ?? DEFAULT_AMBIENT_RGB[2])
    ).getHexString()}`;
};

const findAmbientLight = (scene: THREE.Scene) => {
    let ambientLight: THREE.AmbientLight | null = null;

    scene.traverse((object) => {
        if (!ambientLight && object instanceof THREE.AmbientLight) {
            ambientLight = object;
        }
    });

    return ambientLight;
};

export class ObserverR3FBridge {
    private readonly config: ViewerConfig;

    private context: EffectViewerBridge | null = null;

    private viewerActions: BridgeViewerActions | null = null;

    private readonly objectById = new Map<string, THREE.Object3D>();

    private resourceIdByObject = new WeakMap<THREE.Object3D, string>();

    private readonly materialByAssetId = new Map<number, THREE.Material>();

    private readonly materialIdsByUuid = new Map<string, number>();

    private readonly materialRoleByAssetId = new Map<number, BridgeMaterialRecord['role']>();

    private readonly customMaterialNames = new Map<number, string>();

    private readonly entityBindings = new Map<string, EventHandle>();

    private readonly materialBindings = new Map<number, EventHandle>();

    private sceneSettingsBinding: EventHandle | null = null;

    private sceneSettingsObserver: Observer | null = null;

    private readonly editorEvents: EventHandle[] = [];

    private readonly lastSceneSnapshot = new Map<string, SceneSnapshot>();

    private readonly viewportHiddenIds = new Set<string>();

    private readonly textureLoader = new THREE.TextureLoader();

    private rebuildQueued = false;

    private syncGuard = false;

    private nextAssetId = BRIDGE_ASSET_ID_BASE;

    private sceneSyncFrame: number | null = null;

    private sceneDirty = true;

    private environmentHdrBuffer: ArrayBuffer | null = null;

    private environmentObjectUrl: string | null = null;

    private sceneSettingsSeeded = false;
    private loadedModelBlobUrl: string | null = null;

    constructor(configData: ViewerConfig) {
        this.config = configData;
        this.ensureEntityInspectorComponents();

        this.editorEvents.push(editor.on('scene:raw', () => {
            this.scheduleRebuild();
        }));
        this.editorEvents.push(editor.on('scene:unload', () => {
            this.lastSceneSnapshot.clear();
            this.sceneSettingsSeeded = false;
        }));
        this.editorEvents.push(editor.on('entities:add:entity', (observer: EntityObserver) => {
            if (this.objectById.has(observer.get('resource_id')) && observer.entity) {
                observer.entity.__noIcon = true;
            }
        }));

        this.editorEvents.push(editor.on('selector:change', () => {
            this.sceneDirty = true;
        }));
        this.editorEvents.push(editor.on('sceneSettings:load', (settings: Observer) => {
            this.bindSceneSettingsObserver(settings);
            this.syncSceneSettingsObserverFromContext(settings);
        }));

        this.startSceneSyncLoop();
    }

    private ensureEntityInspectorComponents() {
        const entityInspector = editor.call('attributes:entity.panelComponents') as RuntimeEntityInspector | null;
        if (!entityInspector) {
            return;
        }

        const sharedArgs = {
            hidden: true,
            assets: editor.call('assets:raw'),
            entities: editor.call('entities:raw'),
            projectSettings: editor.call('settings:project'),
            templateOverridesInspector: entityInspector._templateOverridesInspector,
            history: editor.api.globals.history
        };

        [
            ['camera', CameraComponentInspector],
            ['light', LightComponentInspector],
            ['render', RenderComponentInspector]
        ].forEach(([key, Constructor]) => {
            if (entityInspector._componentInspectors[key]) {
                return;
            }

            const ComponentInspectorConstructor = Constructor as new (args: Record<string, unknown>) => unknown;
            const inspector = new ComponentInspectorConstructor(sharedArgs);
            entityInspector._componentInspectors[key] = inspector;
            entityInspector.append(inspector);
        });
    }

    setContext(context: EffectViewerBridge) {
        const shouldRebuild = !this.context ||
            this.context.scene !== context.scene ||
            this.context.camera !== context.camera ||
            this.context.renderer !== context.renderer ||
            this.context.modelRoot !== context.modelRoot;

        this.context = context;
        setBridgeAudioCamera(context.camera);
        const sceneSettings = editor.call('sceneSettings') as Observer | null;
        this.bindSceneSettingsObserver(sceneSettings);
        this.syncSceneSettingsObserverFromContext(sceneSettings);
        if (shouldRebuild) {
            this.scheduleRebuild();
        }
    }

    setViewerActions(actions: BridgeViewerActions) {
        this.viewerActions = actions;
    }

    private setEnvironmentBuffer(buffer: ArrayBuffer | null, filename = 'environment.hdr') {
        this.environmentHdrBuffer = buffer;

        if (this.environmentObjectUrl) {
            URL.revokeObjectURL(this.environmentObjectUrl);
            this.environmentObjectUrl = null;
        }

        if (!buffer) {
            return;
        }

        const mimeType = filename.toLowerCase().endsWith('.exr')
            ? 'image/x-exr'
            : 'image/vnd.radiance';

        this.environmentObjectUrl = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
    }

    loadModel(url: string) {
        const resolvedUrl = this.normalizeAssetUrl(url);
        this.updateViewerConfig((configData) => {
            configData.modelPath = resolvedUrl;
        });
        this.sceneDirty = true;
    }

    loadEnvironment(url: string) {
        const resolvedUrl = this.normalizeAssetUrl(url);
        this.updateViewerConfig((configData) => {
            configData.environment = configData.environment || {
                preset: 'studio',
                customHdri: resolvedUrl,
                envRotation: 0,
                groundEnabled: false,
                groundHeight: 0,
                groundRadius: 20
            };
            configData.environment.customHdri = resolvedUrl;
        });
        if (!resolvedUrl) {
            this.setEnvironmentBuffer(null);
        } else {
            void fetch(resolvedUrl)
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch environment: ${response.status}`);
                }

                this.setEnvironmentBuffer(await response.arrayBuffer(), resolvedUrl);
            })
            .catch(() => {
                this.setEnvironmentBuffer(null);
            });
        }
        this.sceneDirty = true;
    }

    async applyTexture(materialId: number | string, slot: string, url: string | null) {
        const assetId = Number(materialId);
        if (!Number.isFinite(assetId)) {
            return false;
        }

        const material = this.materialByAssetId.get(assetId);
        if (!material) {
            return false;
        }

        const normalizedSlot = this.normalizeTextureSlot(slot);
        const propertyName = this.materialPropertyForTextureSlot(normalizedSlot);
        const nextTexture = url ? await this.loadTexture(url, normalizedSlot) : null;

        if (propertyName && propertyName in material) {
            (material as THREE.Material & Record<string, unknown>)[propertyName] = nextTexture;
        }

        if ((material as THREE.Material & Record<string, unknown>).needsUpdate !== undefined) {
            material.needsUpdate = true;
        }

        if (propertyName === 'alphaMap') {
            const transparentMaterial = material as THREE.Material & { transparent?: boolean };
            transparentMaterial.transparent = !!nextTexture || transparentMaterial.transparent === true;
        }

        const observer = editor.call('assets:get', assetId) as AssetObserver | null;
        const role = this.materialRoleForAsset(assetId);
        if (role) {
            const configKey = this.textureConfigKeyForSlot(normalizedSlot);
            if (configKey) {
                this.config[role].textures[configKey] = url || undefined;
            }
        }

        if (observer && (role === 'frame' || role === 'face' || role === 'back')) {
            this.updateViewerConfigMaterial({
                assetId,
                material,
                name: observer.get('name') || `Material ${assetId}`,
                role
            }, observer);
        }

        this.sceneDirty = true;
        return true;
    }

    dispose() {
        this.stopSceneSyncLoop();
        this.cleanupBindings();
        this.sceneSettingsBinding?.unbind();
        this.sceneSettingsBinding = null;
        this.sceneSettingsObserver = null;
        setBridgeAudioCamera(null);
        this.setEnvironmentBuffer(null);
        this.editorEvents.forEach(event => event.unbind());
        this.editorEvents.length = 0;
        this.viewportHiddenIds.clear();
        if (this.loadedModelBlobUrl) {
            URL.revokeObjectURL(this.loadedModelBlobUrl);
            this.loadedModelBlobUrl = null;
        }
    }

    getObjectById(resourceId: string) {
        return this.objectById.get(resourceId) || null;
    }

    getResourceIdForObject(object: THREE.Object3D | null) {
        let current: THREE.Object3D | null = object;
        while (current) {
            const resourceId = this.resourceIdByObject.get(current);
            if (resourceId) {
                return resourceId;
            }
            current = current.parent;
        }

        return null;
    }

    markSceneDirty() {
        this.sceneDirty = true;
    }

    recordTransformHistory(resourceId: string, before: TransformSnapshot, after: TransformSnapshot) {
        if (
            arraysEqual(before.position, after.position) &&
            arraysEqual(before.rotation, after.rotation) &&
            arraysEqual(before.scale, after.scale)
        ) {
            return;
        }

        editor.api.globals.history.add({
            name: 'entities.transform',
            combine: false,
            undo: () => {
                this.applyTransformSnapshot(resourceId, before);
            },
            redo: () => {
                this.applyTransformSnapshot(resourceId, after);
            }
        });
    }

    isLocalAsset(assetId: number | string) {
        const numericId = Number(assetId);
        if (!Number.isFinite(numericId) || numericId < BRIDGE_ASSET_ID_BASE) {
            return false;
        }

        const observer = editor.call('assets:get', numericId) as AssetObserver | null;
        const tags = observer?.get('tags');
        return Array.isArray(tags) && tags.includes(BRIDGE_ASSET_TAG);
    }

    renameLocalAsset(assetId: number | string, name: string) {
        const numericId = Number(assetId);
        if (!this.isLocalAsset(numericId)) {
            return false;
        }

        const observer = editor.call('assets:get', numericId) as AssetObserver | null;
        const trimmedName = String(name || '').trim();
        if (!observer || !trimmedName) {
            return false;
        }

        this.customMaterialNames.set(numericId, trimmedName);
        observer.set('name', trimmedName);
        return true;
    }

    applyMaterialAssetToResource(resourceId: string, assetId: number, materialIndex = 0) {
        const observer = editor.call('entities:get', resourceId) as EntityObserver | null;
        const object = this.objectById.get(resourceId);
        if (!observer || !(object instanceof THREE.Mesh) || !observer.has('components.render')) {
            return false;
        }

        const previous = Array.isArray(observer.get('components.render.materialAssets'))
            ? [...(observer.get('components.render.materialAssets') as (number | null)[])]
            : [null];
        const next = previous.length ? [...previous] : [null];
        const targetIndex = observer.get('components.render.type') !== 'asset'
            ? 0
            : THREE.MathUtils.clamp(materialIndex, 0, Math.max(next.length - 1, 0));

        if (next[targetIndex] === assetId) {
            return false;
        }

        next[targetIndex] = assetId;

        const applyMaterialAssets = (values: (number | null)[]) => {
            const current = editor.call('entities:get', resourceId) as EntityObserver | null;
            if (!current || !current.has('components.render')) {
                return;
            }

            const historyEnabled = current.history.enabled;
            current.history.enabled = false;
            current.set('components.render.materialAssets', [...values]);
            current.history.enabled = historyEnabled;
        };

        applyMaterialAssets(next);

        editor.api.globals.history.add({
            name: `entities.${resourceId}.components.render.materialAssets`,
            combine: false,
            undo: () => {
                applyMaterialAssets(previous);
            },
            redo: () => {
                applyMaterialAssets(next);
            }
        });

        return true;
    }

    isViewportHidden(resourceId: string) {
        return this.viewportHiddenIds.has(resourceId);
    }

    setViewportHidden(resourceId: string, hidden: boolean) {
        if (hidden) {
            this.viewportHiddenIds.add(resourceId);
        } else {
            this.viewportHiddenIds.delete(resourceId);
        }

        this.sceneDirty = true;

        const observer = editor.call('entities:get', resourceId) as EntityObserver | null;
        const object = this.objectById.get(resourceId);
        if (observer && object) {
            this.applyEffectiveVisibility(resourceId, object, observer);
            object.updateMatrixWorld(true);
        }
    }

    async serializeScene(name = 'default') {
        if (!this.context) {
            throw new Error('Bridge is not ready for scene serialization');
        }

        const sceneSettings = editor.call('sceneSettings') as { get: (path: string) => unknown } | null;
        const orbitTarget = this.context.orbitControls?.target ?? new THREE.Vector3(...DEFAULT_EDITOR_CAMERA.target);
        const camera = this.context.camera;
        const perspectiveCamera = camera instanceof THREE.PerspectiveCamera ? camera : null;

        return serializeOnemo(
            this.context.scene,
            this.context.renderer,
            {
                position: camera.position.clone(),
                target: orbitTarget.clone(),
                fov: perspectiveCamera?.fov ?? DEFAULT_EDITOR_CAMERA.fov,
                near: isViewerCamera(camera) ? camera.near : DEFAULT_EDITOR_CAMERA.near,
                far: isViewerCamera(camera) ? camera.far : DEFAULT_EDITOR_CAMERA.far
            },
            DEFAULT_PRODUCT_CONFIG,
            this.environmentHdrBuffer,
            sceneSettings ? {
                toneMapping: Number(sceneSettings.get('render.tonemapping') ?? this.context.renderer.toneMapping),
                toneMappingExposure: Number(sceneSettings.get('render.exposure') ?? this.context.renderer.toneMappingExposure),
                outputColorSpace: String(sceneSettings.get('render.outputColorSpace') ?? this.context.renderer.outputColorSpace),
                shadowsEnabled: !!sceneSettings.get('render.shadowsEnabled'),
                shadowType: Number(sceneSettings.get('render.shadowType') ?? this.context.renderer.shadowMap.type)
            } : undefined
        );
    }

    async deserializeScene(blob: Blob) {
        if (!this.context) {
            return false;
        }

        if (isJsonBlob(blob)) {
            try {
                const legacyScene = JSON.parse(await blob.text()) as SavedScene;
                const success = this.deserializeLegacyScene(legacyScene);

                if (success) {
                    const nextConfig = savedSceneToViewerConfig(legacyScene, cloneViewerConfig(this.config));
                    this.updateViewerConfig((configData) => {
                        Object.assign(configData, nextConfig);
                    });
                }

                return success;
            } catch {
                return false;
            }
        }

        // Deserialize the .onemo — applies renderer settings (tonemapping, exposure, shadows)
        // directly to the WebGLRenderer and parses the studio.json.
        const result = await deserializeOnemo(blob, this.context.renderer);

        // Extract the GLB as a blob URL so EffectModel can load it via useGLTF.
        // This preserves the golden EffectModel rendering path — same lighting,
        // same material application, same visual output as the prototype.
        const zipData = await JSZip.loadAsync(await blob.arrayBuffer());
        const glbFile = zipData.file('scene.glb');
        const glbBlob = glbFile
            ? new Blob([await glbFile.async('arraybuffer')], { type: 'model/gltf-binary' })
            : null;

        // Revoke previous blob URL if any
        if (this.loadedModelBlobUrl) {
            URL.revokeObjectURL(this.loadedModelBlobUrl);
            this.loadedModelBlobUrl = null;
        }

        const modelBlobUrl = glbBlob ? URL.createObjectURL(glbBlob) : '';

        if (modelBlobUrl) {
            this.loadedModelBlobUrl = modelBlobUrl;
        }

        this.setEnvironmentBuffer(result.environmentHdr, result.studioJson.environment.file ?? 'environment.hdr');

        const editorCamera = result.studioJson.editorCamera;
        const camera = this.context.camera;
        camera.position.set(...editorCamera.position);
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = editorCamera.fov;
        }
        if (isViewerCamera(camera)) {
            camera.near = editorCamera.near;
            camera.far = editorCamera.far;
            camera.updateProjectionMatrix();
        }
        const orbitControls = this.context.orbitControls;
        if (orbitControls) {
            orbitControls.target.set(...editorCamera.target);
            orbitControls.update();
        } else {
            camera.lookAt(new THREE.Vector3(...editorCamera.target));
        }

        const nextEnvironment = {
            preset: result.studioJson.environment.preset ?? 'studio',
            customHdri: this.environmentObjectUrl ?? undefined,
            envRotation: result.studioJson.environment.rotation,
            groundEnabled: result.studioJson.environment.ground.enabled,
            groundHeight: result.studioJson.environment.ground.height,
            groundRadius: result.studioJson.environment.ground.radius
        };

        // Update the viewer config — EffectModel re-renders via React with the
        // golden scene settings. The model loads from the blob URL through the
        // same useGLTF path as the prototype, ensuring visual parity.
        this.updateViewerConfig((configData) => {
            configData.modelPath = modelBlobUrl;
            configData.scene.exposure = result.studioJson.renderer.toneMappingExposure;
            configData.scene.ambientColor = rgbTupleToHex(result.studioJson.scene.ambientColor);
            configData.scene.envIntensity = result.studioJson.environment.intensity;
            configData.scene.background = result.studioJson.scene.backgroundColor;
            configData.scene.ambientIntensity = result.studioJson.scene.ambientIntensity;
            configData.colors.bgColor = result.studioJson.scene.backgroundColor;
            configData.environment = nextEnvironment;
            configData.camera = createCameraConfigFromEditorCamera(editorCamera, configData.camera);
        });

        this.sceneSettingsSeeded = false;
        this.syncSceneSettingsObserverFromContext();
        this.scheduleRebuild();
        return true;
    }

    private deserializeLegacyScene(scene: SavedScene) {
        if (!scene || typeof scene !== 'object') {
            return false;
        }

        if (!this.context) {
            return false;
        }

        const sceneEntities = scene.entities || {};
        Object.entries(sceneEntities).forEach(([resourceId, entityData]) => {
            const observer = editor.call('entities:get', resourceId) as EntityObserver | null;
            const object = this.objectById.get(resourceId);

            if (observer) {
                this.withSyncGuard(() => {
                    this.setObserverValue(observer, 'name', entityData.name);
                    this.setObserverValue(observer, 'enabled', !!entityData.enabled);
                    this.setObserverArray(observer, 'position', entityData.position || [0, 0, 0]);
                    this.setObserverArray(observer, 'rotation', entityData.rotation || [0, 0, 0]);
                    this.setObserverArray(observer, 'scale', entityData.scale || [1, 1, 1]);
                });
            }

            if (!object) {
                return;
            }

            const position = this.asVec3Tuple(entityData.position, [0, 0, 0]);
            const rotation = this.asVec3Tuple(entityData.rotation, [0, 0, 0]);
            const scale = this.asVec3Tuple(entityData.scale, [1, 1, 1]);

            object.position.set(position[0], position[1], position[2]);
            object.rotation.set(
                THREE.MathUtils.degToRad(rotation[0]),
                THREE.MathUtils.degToRad(rotation[1]),
                THREE.MathUtils.degToRad(rotation[2])
            );
            object.scale.set(scale[0], scale[1], scale[2]);

            const components = entityData.components || {};
            const renderComponent = components.render as Record<string, unknown> | undefined;
            const lightComponent = components.light as Record<string, unknown> | undefined;
            const cameraComponent = components.camera as Record<string, unknown> | undefined;

            if (object instanceof THREE.Mesh && renderComponent) {
                if (observer && observer.has('components.render.enabled') && typeof renderComponent.enabled === 'boolean') {
                    this.withSyncGuard(() => {
                        this.setObserverValue(observer, 'components.render.enabled', renderComponent.enabled);
                    });
                }

                if (typeof renderComponent.castShadows === 'boolean') {
                    object.castShadow = renderComponent.castShadows;
                    if (observer && observer.has('components.render.castShadows')) {
                        this.withSyncGuard(() => {
                            this.setObserverValue(observer, 'components.render.castShadows', renderComponent.castShadows);
                        });
                    }
                }
                if (typeof renderComponent.receiveShadows === 'boolean') {
                    object.receiveShadow = renderComponent.receiveShadows;
                    if (observer && observer.has('components.render.receiveShadows')) {
                        this.withSyncGuard(() => {
                            this.setObserverValue(observer, 'components.render.receiveShadows', renderComponent.receiveShadows);
                        });
                    }
                }
                if (observer && Array.isArray(renderComponent.materialAssets)) {
                    this.withSyncGuard(() => {
                        this.setObserverValue(observer, 'components.render.materialAssets', renderComponent.materialAssets);
                    });
                    this.applyMaterialAssignments(object, observer);
                }
            }

            if (object instanceof THREE.Light && lightComponent) {
                if (observer && observer.has('components.light.enabled') && typeof lightComponent.enabled === 'boolean') {
                    this.withSyncGuard(() => {
                        this.setObserverValue(observer, 'components.light.enabled', lightComponent.enabled);
                    });
                }

                const color = lightComponent.color;
                if (Array.isArray(color)) {
                    object.color.setRGB(
                        Number(color[0] ?? object.color.r),
                        Number(color[1] ?? object.color.g),
                        Number(color[2] ?? object.color.b)
                    );
                    if (observer && observer.has('components.light.color')) {
                        this.withSyncGuard(() => {
                            this.setObserverArray(observer, 'components.light.color', this.asVec3Tuple(color, [1, 1, 1]));
                        });
                    }
                }

                if (typeof lightComponent.intensity === 'number') {
                    object.intensity = lightComponent.intensity;
                    if (observer && observer.has('components.light.intensity')) {
                        this.withSyncGuard(() => {
                            this.setObserverValue(observer, 'components.light.intensity', lightComponent.intensity);
                        });
                    }
                }
                if (typeof lightComponent.castShadows === 'boolean') {
                    object.castShadow = lightComponent.castShadows;
                    if (observer && observer.has('components.light.castShadows')) {
                        this.withSyncGuard(() => {
                            this.setObserverValue(observer, 'components.light.castShadows', lightComponent.castShadows);
                        });
                    }
                }
                if (typeof lightComponent.range === 'number' && (object instanceof THREE.PointLight || object instanceof THREE.SpotLight)) {
                    object.distance = lightComponent.range;
                    if (observer && observer.has('components.light.range')) {
                        this.withSyncGuard(() => {
                            this.setObserverValue(observer, 'components.light.range', lightComponent.range);
                        });
                    }
                }
            }

            if (object instanceof THREE.Camera && cameraComponent) {
                const viewerCamera = isViewerCamera(object) ? object : null;
                if (observer && observer.has('components.camera.enabled') && typeof cameraComponent.enabled === 'boolean') {
                    this.withSyncGuard(() => {
                        this.setObserverValue(observer, 'components.camera.enabled', cameraComponent.enabled);
                    });
                }

                if (object instanceof THREE.PerspectiveCamera && typeof cameraComponent.fov === 'number') {
                    object.fov = cameraComponent.fov;
                    if (observer && observer.has('components.camera.fov')) {
                        this.withSyncGuard(() => {
                            this.setObserverValue(observer, 'components.camera.fov', cameraComponent.fov);
                        });
                    }
                }
                if (viewerCamera && typeof cameraComponent.nearClip === 'number') {
                    viewerCamera.near = cameraComponent.nearClip;
                    if (observer && observer.has('components.camera.nearClip')) {
                        this.withSyncGuard(() => {
                            this.setObserverValue(observer, 'components.camera.nearClip', cameraComponent.nearClip);
                        });
                    }
                }
                if (viewerCamera && typeof cameraComponent.farClip === 'number') {
                    viewerCamera.far = cameraComponent.farClip;
                    if (observer && observer.has('components.camera.farClip')) {
                        this.withSyncGuard(() => {
                            this.setObserverValue(observer, 'components.camera.farClip', cameraComponent.farClip);
                        });
                    }
                }
                viewerCamera?.updateProjectionMatrix();
            }

            if (observer) {
                const extraComponents = Object.entries(components).filter(([componentKey]) => {
                    return componentKey !== 'render' && componentKey !== 'light' && componentKey !== 'camera';
                });

                if (extraComponents.length) {
                    this.withSyncGuard(() => {
                        extraComponents.forEach(([componentKey, componentValue]) => {
                            observer.set(`components.${componentKey}`, cloneSerializable(componentValue));
                        });
                    }, [observer]);
                    this.applyMappedEntityComponents(object, observer);
                }

                this.applyEffectiveVisibility(resourceId, object, observer);
            }
            object.updateMatrixWorld(true);
        });

        const sceneMaterials = scene.materials || {};
        Object.entries(sceneMaterials).forEach(([assetIdString, materialData]) => {
            const assetId = Number(assetIdString);
            if (!Number.isFinite(assetId)) {
                return;
            }

            const observer = editor.call('assets:get', assetId) as AssetObserver | null;
            const material = this.materialByAssetId.get(assetId);
            if (!observer || !material) {
                return;
            }

            if (typeof materialData.name === 'string' && materialData.name.trim()) {
                this.withSyncGuard(() => {
                    observer.set('name', materialData.name.trim());
                }, [observer]);
            }

            if (materialData.role && materialData.role !== 'generic') {
                this.materialRoleByAssetId.set(assetId, materialData.role);
            }

            const data = isRecord(materialData.data) ? materialData.data : {};
            if (this.isCanonicalSavedMaterialData(data)) {
                this.applyCanonicalSavedMaterialData(assetId, material, observer, data);
            } else {
                this.withSyncGuard(() => {
                    Object.entries(data).forEach(([key, value]) => {
                        observer.set(`data.${key}`, cloneSerializable(value));
                        applyMaterialObserverChange(material, `data.${key}`, observer);
                    });
                }, [observer]);
            }

            material.needsUpdate = true;
            this.updateViewerConfigMaterial({
                assetId,
                material,
                name: observer.get('name') as string || `Material ${assetId}`,
                role: this.materialRoleByAssetId.get(assetId) || 'generic'
            }, observer);
        });

        this.applySceneSettings(scene.sceneSettings);
        this.lastSceneSnapshot.clear();
        this.syncObserversFromScene();
        this.refreshEntitySelectionInspector();
        this.sceneDirty = false;
        return true;
    }

    private startSceneSyncLoop() {
        let lastFrameTime = performance.now();
        const tick = (now: number) => {
            const delta = Math.min((now - lastFrameTime) / 1000, 0.1);
            lastFrameTime = now;
            this.sceneSyncFrame = requestAnimationFrame(tick);
            this.objectById.forEach((object) => {
                runBridgeUpdaters(object, delta);
            });
            if (this.sceneDirty) {
                this.syncObserversFromScene();
                this.sceneDirty = false;
            }
        };

        tick(lastFrameTime);
    }

    private stopSceneSyncLoop() {
        if (this.sceneSyncFrame !== null) {
            cancelAnimationFrame(this.sceneSyncFrame);
            this.sceneSyncFrame = null;
        }
    }

    private scheduleRebuild() {
        if (!this.context || this.rebuildQueued) {
            return;
        }

        this.rebuildQueued = true;
        setTimeout(() => {
            this.rebuildQueued = false;
            this.rebuild();
        }, 0);
    }

    private rebuild() {
        if (!this.context) {
            return;
        }

        const selectedResourceIds = editor.call('selector:type') === 'entity'
            ? (editor.call('selector:items') as EntityObserver[]).map((item) => item.get('resource_id'))
            : [];
        const rootEntity = editor.call('entities:root') as EntityObserver | null;
        const expandedState = rootEntity
            ? editor.call('entities:panel:getExpandedState', rootEntity) as Record<string, boolean>
            : null;

        this.cleanupBindings();
        this.objectById.clear();
        this.resourceIdByObject = new WeakMap<THREE.Object3D, string>();
        this.materialByAssetId.clear();
        this.materialRoleByAssetId.clear();
        this.lastSceneSnapshot.clear();

        editor.call('selector:clear');
        editor.call('attributes:clear');
        editor.call('entities:clear');

        const materialState = this.collectMaterialState();
        this.syncMaterialAssets(materialState);

        const entityData = this.buildEntityData(materialState);
        entityData.forEach((data) => {
            editor.api.globals.entities.serverAdd(data as unknown as { parent: Entity | null, children: Entity[] });
        });

        entityData.forEach((data) => {
            const observer = editor.call('entities:get', data.resource_id) as EntityObserver | null;
            if (observer) {
                if (observer.entity) {
                    observer.entity.__noIcon = true;
                }
                if (observer.sync) {
                    observer.sync.enabled = false;
                }
                this.bindEntityObserver(observer);
            }
        });

        editor.emit('entities:load');

        if (expandedState) {
            editor.call('entities:panel:restoreExpandedState', expandedState);
        }

        if (selectedResourceIds.length) {
            const restoredSelection = selectedResourceIds
            .map((resourceId) => editor.call('entities:get', resourceId) as EntityObserver | null)
            .filter((observer): observer is EntityObserver => !!observer);

            if (restoredSelection.length) {
                editor.call('selector:set', 'entity', restoredSelection);
                editor.emit('attributes:inspect[entity]', restoredSelection);
            }
        }

        const sceneSettings = editor.call('sceneSettings') as Observer | null;
        this.bindSceneSettingsObserver(sceneSettings);
        this.syncSceneSettingsObserverFromContext(sceneSettings);
        this.applySceneSettingsObserverToContext(sceneSettings);
        this.syncObserversFromScene();
        this.sceneDirty = false;
    }

    private collectMaterialState() {
        if (!this.context) {
            return {
                objectMaterialIds: new Map<string, number[]>(),
                materialRecords: new Map<number, BridgeMaterialRecord>()
            };
        }

        const ctx = this.context;
        const objectMaterialIds = new Map<string, number[]>();
        const materialRecords = new Map<number, BridgeMaterialRecord>();

        ctx.modelRoot.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) {
                return;
            }

            const materials = Array.isArray(object.material) ? object.material : [object.material];
            const materialIds = materials.map((material, index) => {
                const assetId = this.getOrCreateMaterialAssetId(material.uuid);
                const existing = materialRecords.get(assetId);

                if (!existing) {
                    materialRecords.set(assetId, {
                        assetId,
                        material,
                        name: this.customMaterialNames.get(assetId) || this.getMaterialDisplayName(object, index),
                        role: this.getMaterialRole(object)
                    });
                }

                return assetId;
            });

            objectMaterialIds.set(object.uuid, materialIds);
        });

        return {
            objectMaterialIds,
            materialRecords
        };
    }

    private buildEntityData(materialState: ReturnType<ObserverR3FBridge['collectMaterialState']>) {
        if (!this.context) {
            return [];
        }

        const ctx = this.context;
        const result = [];
        const rootChildren = [
            ctx.modelRoot.uuid,
            BRIDGE_CAMERA_ID
        ];

        if (ctx.keyLight) {
            rootChildren.push(BRIDGE_LIGHT_ID);
        }

        result.push(createBridgeEntityData({
            resourceId: BRIDGE_ROOT_ID,
            name: BRIDGE_ROOT_NAME,
            parent: null,
            children: rootChildren,
            object: null
        }));

        const appendObject = (object: THREE.Object3D, parentId: string) => {
            const children = object.children
            .filter(child => this.shouldIncludeSceneObject(child))
            .map(child => child.uuid);

            const components: Record<string, unknown> = {
                ...getStoredBridgeComponents(object)
            };

            if (object instanceof THREE.Mesh) {
                components.render = createRenderComponentData(object, materialState.objectMaterialIds.get(object.uuid) || []);
            }

            if (object instanceof THREE.Light) {
                components.light = createLightComponentData(object);
            }

            if (isViewerCamera(object)) {
                components.camera = createCameraComponentData(object, ctx.scene);
            }

            result.push(createBridgeEntityData({
                resourceId: object.uuid,
                name: object === ctx.modelRoot ? (object.name || 'Model') : getEntityDisplayName(object),
                parent: parentId,
                children,
                object,
                components
            }));
            this.registerObjectBinding(object.uuid, object);

            object.children.forEach((child) => {
                if (this.shouldIncludeSceneObject(child)) {
                    appendObject(child, object.uuid);
                }
            });
        };

        appendObject(ctx.modelRoot, BRIDGE_ROOT_ID);

        result.push(createBridgeEntityData({
            resourceId: BRIDGE_CAMERA_ID,
            name: BRIDGE_CAMERA_NAME,
            parent: BRIDGE_ROOT_ID,
            children: [],
            object: ctx.camera,
            components: {
                ...getStoredBridgeComponents(ctx.camera),
                camera: createCameraComponentData(
                    isViewerCamera(ctx.camera) ? ctx.camera : new THREE.PerspectiveCamera(DEFAULT_EDITOR_CAMERA.fov, 1, DEFAULT_EDITOR_CAMERA.near, DEFAULT_EDITOR_CAMERA.far),
                    ctx.scene
                )
            }
        }));
        this.registerObjectBinding(BRIDGE_CAMERA_ID, ctx.camera);

        if (ctx.keyLight) {
            result.push(createBridgeEntityData({
                resourceId: BRIDGE_LIGHT_ID,
                name: BRIDGE_LIGHT_NAME,
                parent: BRIDGE_ROOT_ID,
                children: [],
                object: ctx.keyLight,
                components: {
                    ...getStoredBridgeComponents(ctx.keyLight),
                    light: createLightComponentData(ctx.keyLight)
                }
            }));
            this.registerObjectBinding(BRIDGE_LIGHT_ID, ctx.keyLight);
        }

        return result;
    }

    private shouldIncludeSceneObject(object: THREE.Object3D) {
        if ((object as THREE.Bone).isBone) {
            return false;
        }

        return true;
    }

    private getMaterialRole(object: THREE.Object3D) {
        switch (object.name) {
            case 'PRINT_SURFACE_FRONT':
                return 'face';
            case 'BACK':
                return 'back';
            case 'FRAME':
                return 'frame';
            default:
                return 'generic';
        }
    }

    private getMaterialDisplayName(object: THREE.Object3D, index: number) {
        const role = this.getMaterialRole(object);
        if (role !== 'generic') {
            return `${role[0].toUpperCase()}${role.substring(1)} Material`;
        }

        const suffix = index > 0 ? ` ${index + 1}` : '';
        return `${getEntityDisplayName(object)} Material${suffix}`;
    }

    private getOrCreateMaterialAssetId(materialUuid: string) {
        let assetId = this.materialIdsByUuid.get(materialUuid);
        if (assetId !== undefined) {
            return assetId;
        }

        assetId = this.nextAssetId++;
        this.materialIdsByUuid.set(materialUuid, assetId);
        return assetId;
    }

    private syncMaterialAssets(materialState: ReturnType<ObserverR3FBridge['collectMaterialState']>) {
        const activeIds = new Set<number>();
        const previousBridgeAssets = editor.api.globals.assets.list().filter((asset) => {
            const tags = asset.get('tags') || [];
            return Array.isArray(tags) && tags.includes(BRIDGE_ASSET_TAG);
        }) as AssetObserver[];

        materialState.materialRecords.forEach((record, assetId) => {
            activeIds.add(assetId);
            this.materialByAssetId.set(assetId, record.material);
            this.materialRoleByAssetId.set(assetId, record.role);

            const existing = editor.api.globals.assets.get(assetId);
            const previousAsset = existing || this.findPreviousBridgeAsset(record, previousBridgeAssets);
            const previousData = previousAsset?.get('data') || {};
            this.setMaterialBaseEnvMapIntensity(
                record.material,
                previousData?.reflectivity ?? (record.material instanceof THREE.MeshPhysicalMaterial || record.material instanceof THREE.MeshStandardMaterial ? record.material.envMapIntensity : 1)
            );
            this.applySceneEnvIntensityToMaterial(record.material, previousAsset);
            const previousName = typeof previousAsset?.get('name') === 'string' ? previousAsset.get('name') : record.name;
            if (existing) {
                this.withSyncGuard(() => {
                    existing.set('name', record.name);
                    existing.set('data', createMaterialData(record.material, previousData));
                    existing.set('tags', [BRIDGE_ASSET_TAG]);
                }, [existing]);
            } else {
                const asset = new Asset({
                    id: assetId,
                    uniqueId: BRIDGE_ASSET_UNIQUE_ID_BASE + assetId,
                    name: previousName,
                    type: 'material',
                    source: false,
                    preload: false,
                    path: [],
                    tags: [BRIDGE_ASSET_TAG],
                    data: createMaterialData(record.material, previousData),
                    file: null,
                    meta: null,
                    scope: {
                        type: 'project',
                        id: config.project.id
                    }
                });
                editor.api.globals.assets.add(asset);
                if (previousName !== record.name) {
                    this.customMaterialNames.set(assetId, previousName);
                }
            }
        });

        editor.api.globals.assets.list().forEach((asset) => {
            const tags = asset.get('tags') || [];
            if (!tags.includes(BRIDGE_ASSET_TAG)) {
                return;
            }

            if (!activeIds.has(asset.get('id'))) {
                this.materialRoleByAssetId.delete(asset.get('id'));
                this.customMaterialNames.delete(asset.get('id'));
                editor.api.globals.assets.remove(asset);
            }
        });

        Array.from(this.materialBindings.keys()).forEach((assetId) => {
            if (!activeIds.has(assetId)) {
                this.materialBindings.get(assetId)?.unbind();
                this.materialBindings.delete(assetId);
                this.materialRoleByAssetId.delete(assetId);
                this.customMaterialNames.delete(assetId);
            }
        });

        activeIds.forEach((assetId) => {
            const observer = editor.call('assets:get', assetId) as AssetObserver | null;
            if (!observer || this.materialBindings.has(assetId)) {
                return;
            }

            if (observer.sync) {
                observer.sync.enabled = false;
            }

            const handle = observer.on('*:set', (path: string) => {
                if (this.syncGuard) {
                    return;
                }

                const material = this.materialByAssetId.get(assetId);
                if (!material) {
                    return;
                }

                const normalizedPath = normalizeAssetPath(path);
                if (normalizedPath.startsWith('data.') && normalizedPath.endsWith('Map')) {
                    const textureUrl = this.resolveTextureAssetUrl(observer.get(normalizedPath));
                    void this.applyTexture(assetId, normalizedPath.replace(/^data\./, ''), textureUrl).catch((err) => {
                        console.warn('[r3f-bridge] texture load failed', err);
                    });
                    return;
                }

                if (this.applyTexturePropertyChange(material, normalizedPath, observer)) {
                    this.sceneDirty = true;
                    return;
                }

                applyMaterialObserverChange(material, normalizedPath, observer);
                if (normalizedPath === 'data.reflectivity') {
                    this.setMaterialBaseEnvMapIntensity(material, observer.get('data.reflectivity'));
                    this.applySceneEnvIntensityToMaterial(material, observer);
                }
                this.sceneDirty = true;
                this.updateViewerConfigMaterial(materialState.materialRecords.get(assetId), observer);
            });

            this.materialBindings.set(assetId, handle);
            this.reapplyPersistedTextureSlots(assetId, observer);
        });
    }

    private findPreviousBridgeAsset(record: BridgeMaterialRecord, previousAssets: AssetObserver[]) {
        return previousAssets.find((asset) => {
            const assetId = Number(asset.get('id'));
            const assetRole = this.materialRoleForAsset(assetId);
            if (record.role !== 'generic' && assetRole === record.role) {
                return true;
            }

            return String(asset.get('name') || '') === record.name;
        }) || null;
    }

    private reapplyPersistedTextureSlots(assetId: number, observer: AssetObserver) {
        OBSERVER_TEXTURE_SLOTS.forEach((slot) => {
            const textureAsset = observer.get(`data.${slot}`);
            if (textureAsset === null || textureAsset === undefined || textureAsset === '') {
                return;
            }

            const textureUrl = this.resolveTextureAssetUrl(textureAsset);
            if (!textureUrl) {
                return;
            }

            void this.applyTexture(assetId, slot, textureUrl).catch((error) => {
                console.warn('[r3f-bridge] texture load failed', error);
            });
        });
    }

    private serializeEntityComponents(
        object: THREE.Object3D | null | undefined,
        components: Record<string, unknown>
    ): SavedSceneEntityComponents {
        const result: SavedSceneEntityComponents = {};
        const renderComponent = isRecord(components.render) ? components.render : null;
        const lightComponent = isRecord(components.light) ? components.light : null;
        const cameraComponent = isRecord(components.camera) ? components.camera : null;

        if (object instanceof THREE.Mesh || renderComponent) {
            result.render = {
                enabled: typeof renderComponent?.enabled === 'boolean' ? renderComponent.enabled : true,
                castShadows: object instanceof THREE.Mesh ? !!object.castShadow : !!renderComponent?.castShadows,
                receiveShadows: object instanceof THREE.Mesh ? !!object.receiveShadow : !!renderComponent?.receiveShadows,
                materialAssets: Array.isArray(renderComponent?.materialAssets)
                    ? renderComponent.materialAssets.map((value) => {
                        return value === null ? null : Number(value);
                    })
                    : []
            } satisfies SavedSceneRenderComponent;
        }

        if (object instanceof THREE.Light || lightComponent) {
            const light = object instanceof THREE.Light ? object : null;
            result.light = {
                enabled: typeof lightComponent?.enabled === 'boolean' ? lightComponent.enabled : true,
                type: light instanceof THREE.SpotLight
                    ? 'spot'
                    : light instanceof THREE.PointLight
                        ? 'point'
                        : (lightComponent?.type === 'spot' || lightComponent?.type === 'point' ? lightComponent.type : 'directional'),
                color: light ? toSavedRgbTuple(light.color) : this.asVec3Tuple(lightComponent?.color, [1, 1, 1]),
                intensity: light?.intensity ?? Number(lightComponent?.intensity ?? 1),
                range: light instanceof THREE.PointLight || light instanceof THREE.SpotLight
                    ? light.distance || 0
                    : Number(lightComponent?.range ?? 0),
                castShadows: light ? !!light.castShadow : !!lightComponent?.castShadows,
                innerConeAngle: typeof lightComponent?.innerConeAngle === 'number' ? lightComponent.innerConeAngle : undefined,
                outerConeAngle: typeof lightComponent?.outerConeAngle === 'number' ? lightComponent.outerConeAngle : undefined
            } satisfies SavedSceneLightComponent;
        }

        if (object instanceof THREE.Camera || cameraComponent) {
            const camera = object instanceof THREE.Camera && isViewerCamera(object) ? object : null;
            const perspectiveCamera = camera instanceof THREE.PerspectiveCamera ? camera : null;
            const orthographicCamera = camera instanceof THREE.OrthographicCamera ? camera : null;
            result.camera = {
                enabled: typeof cameraComponent?.enabled === 'boolean' ? cameraComponent.enabled : true,
                projection: perspectiveCamera
                    ? 0
                    : orthographicCamera
                        ? 1
                        : Number(cameraComponent?.projection ?? 0),
                clearColor: Array.isArray(cameraComponent?.clearColor)
                    ? [
                        Number(cameraComponent.clearColor[0] ?? 1),
                        Number(cameraComponent.clearColor[1] ?? 1),
                        Number(cameraComponent.clearColor[2] ?? 1),
                        Number(cameraComponent.clearColor[3] ?? 1)
                    ]
                    : undefined,
                fov: perspectiveCamera?.fov ?? (typeof cameraComponent?.fov === 'number' ? cameraComponent.fov : undefined),
                orthoHeight: orthographicCamera ? Math.abs(orthographicCamera.top) : (typeof cameraComponent?.orthoHeight === 'number' ? cameraComponent.orthoHeight : undefined),
                nearClip: camera?.near ?? Number(cameraComponent?.nearClip ?? 0.1),
                farClip: camera?.far ?? Number(cameraComponent?.farClip ?? 1000)
            } satisfies SavedSceneCameraComponent;
        }

        if (object) {
            const storedComponents = getStoredBridgeComponents(object);
            Object.entries(storedComponents).forEach(([componentKey, value]) => {
                if (componentKey === 'render' || componentKey === 'light' || componentKey === 'camera') {
                    return;
                }

                (result as Record<string, unknown>)[componentKey] = cloneSerializable(value);
            });
        }

        return result;
    }

    private serializeMaterialData(material: THREE.Material, observer: AssetObserver | null): SavedSceneMaterialData {
        const result: SavedSceneMaterialData = {};
        const physicalMaterial = material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshStandardMaterial
            ? material
            : null;
        const observerData = isRecord(observer?.get('data')) ? observer.get('data') as Record<string, unknown> : {};

        if (physicalMaterial) {
            result.color = toSavedRgbTuple(physicalMaterial.color);
            result.metalness = physicalMaterial.metalness ?? 0;
            result.roughness = physicalMaterial.roughness ?? 1;
            result.normalScale = physicalMaterial.normalScale?.x ?? Number(observerData.normalStrength ?? 1);
            result.bumpScale = physicalMaterial.bumpScale ?? Number(observerData.bumpMapFactor ?? observerData.heightMapFactor ?? 1);
            result.envMapIntensity = physicalMaterial.envMapIntensity ?? 0;
            result.emissive = toSavedRgbTuple((physicalMaterial as THREE.MeshPhysicalMaterial).emissive ?? new THREE.Color(0, 0, 0));
            result.emissiveIntensity = (physicalMaterial as THREE.MeshPhysicalMaterial).emissiveIntensity ?? 1;
            result.opacity = physicalMaterial.opacity ?? 1;
            result.transparent = !!physicalMaterial.transparent;
            result.alphaTest = physicalMaterial.alphaTest ?? 0;
        }

        if (material instanceof THREE.MeshPhysicalMaterial) {
            result.clearcoat = material.clearcoat ?? 0;
            result.clearcoatRoughness = material.clearcoatRoughness ?? 0;
            result.sheen = material.sheen ?? 0;
            result.sheenColor = toSavedRgbTuple(material.sheenColor);
            result.sheenRoughness = material.sheenRoughness ?? 1;
        }

        const textures = this.serializeMaterialTextures(material, observerData);
        if (Object.keys(textures).length > 0) {
            result.textures = textures;
        }

        return result;
    }

    private serializeMaterialTextures(
        material: THREE.Material,
        observerData: Record<string, unknown>
    ): Partial<Record<SavedSceneTextureKey, SavedSceneTexture>> {
        const result: Partial<Record<SavedSceneTextureKey, SavedSceneTexture>> = {};

        (Object.entries(TEXTURE_SLOT_ALIASES_BY_PROPERTY) as [SavedSceneTextureKey, string[]][]).forEach(([propertyKey, observerSlots]) => {
            const observerSlot = observerSlots.find((slot) => {
                return observerData[slot] !== undefined && observerData[slot] !== null;
            }) || observerSlots[0];
            const propertyName = this.materialPropertyForTextureSlot(observerSlot);
            const texture = propertyName
                ? (material as THREE.Material & Record<string, unknown>)[propertyName]
                : null;
            const textureUrl = this.resolveSavedTextureUrl(observerData[observerSlot], texture);

            if (!textureUrl) {
                return;
            }

            const threeTexture = texture instanceof THREE.Texture ? texture : null;
            const entry: SavedSceneTexture = {
                url: textureUrl
            };

            const channel = observerData[`${observerSlot}Channel`] ?? threeTexture?.userData?.playcanvasChannel;
            if (typeof channel === 'string' || typeof channel === 'number') {
                entry.channel = channel;
            }

            const uv = observerData[`${observerSlot}Uv`];
            if (typeof uv === 'number') {
                entry.uv = uv;
            } else if (typeof threeTexture?.channel === 'number' && threeTexture.channel !== 0) {
                entry.uv = threeTexture.channel;
            }

            const offset = Array.isArray(observerData[`${observerSlot}Offset`])
                ? observerData[`${observerSlot}Offset`]
                : (threeTexture ? [threeTexture.offset.x, threeTexture.offset.y] : null);
            if (Array.isArray(offset) && (Number(offset[0] ?? 0) !== 0 || Number(offset[1] ?? 0) !== 0)) {
                entry.offset = [Number(offset[0] ?? 0), Number(offset[1] ?? 0)];
            }

            const tiling = Array.isArray(observerData[`${observerSlot}Tiling`])
                ? observerData[`${observerSlot}Tiling`]
                : (threeTexture ? [threeTexture.repeat.x, threeTexture.repeat.y] : null);
            if (Array.isArray(tiling) && (Number(tiling[0] ?? 1) !== 1 || Number(tiling[1] ?? 1) !== 1)) {
                entry.tiling = [Number(tiling[0] ?? 1), Number(tiling[1] ?? 1)];
            }

            const rotation = observerData[`${observerSlot}Rotation`];
            if (typeof rotation === 'number' && rotation !== 0) {
                entry.rotation = rotation;
            } else if (threeTexture && threeTexture.rotation !== 0) {
                entry.rotation = THREE.MathUtils.radToDeg(threeTexture.rotation);
            }

            result[propertyKey] = entry;
        });

        return result;
    }

    private resolveSavedTextureUrl(assetValue: unknown, texture: unknown) {
        const assetUrl = this.resolveTextureAssetUrl(assetValue);
        if (assetUrl) {
            return assetUrl;
        }

        if (!(texture instanceof THREE.Texture)) {
            return null;
        }

        const sourceUrl = texture.userData?.sourceUrl;
        if (typeof sourceUrl === 'string' && sourceUrl) {
            return sourceUrl;
        }

        const image = texture.image as { currentSrc?: string; src?: string } | undefined;
        if (typeof image?.currentSrc === 'string' && image.currentSrc) {
            return image.currentSrc;
        }

        if (typeof image?.src === 'string' && image.src) {
            return image.src;
        }

        return null;
    }

    private isCanonicalSavedMaterialData(data: Record<string, unknown>) {
        return 'textures' in data ||
            'color' in data ||
            'normalScale' in data ||
            'bumpScale' in data ||
            'envMapIntensity' in data ||
            'clearcoat' in data ||
            'sheenColor' in data ||
            'transparent' in data;
    }

    private applyCanonicalSavedMaterialData(
        assetId: number,
        material: THREE.Material,
        observer: AssetObserver,
        data: Record<string, unknown>
    ) {
        const physicalMaterial = material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshStandardMaterial
            ? material
            : null;

        this.withSyncGuard(() => {
            if (Array.isArray(data.color)) {
                observer.set('data.diffuse', cloneSerializable(data.color));
                applyMaterialObserverChange(material, 'data.diffuse', observer);
            }

            if (typeof data.metalness === 'number') {
                observer.set('data.metalness', data.metalness);
                applyMaterialObserverChange(material, 'data.metalness', observer);
            }

            if (typeof data.roughness === 'number') {
                observer.set('data.roughness', data.roughness);
                observer.set('data.shininess', THREE.MathUtils.clamp((1 - data.roughness) * 100, 0, 100));
                applyMaterialObserverChange(material, 'data.roughness', observer);
            }

            if (typeof data.normalScale === 'number') {
                observer.set('data.normalStrength', data.normalScale);
                applyMaterialObserverChange(material, 'data.normalStrength', observer);
            }

            if (typeof data.bumpScale === 'number') {
                observer.set('data.heightMapFactor', data.bumpScale);
                observer.set('data.bumpMapFactor', data.bumpScale);
                applyMaterialObserverChange(material, 'data.heightMapFactor', observer);
            }

            if (Array.isArray(data.emissive)) {
                observer.set('data.emissive', cloneSerializable(data.emissive));
                applyMaterialObserverChange(material, 'data.emissive', observer);
            }

            if (typeof data.emissiveIntensity === 'number') {
                observer.set('data.emissiveIntensity', data.emissiveIntensity);
                applyMaterialObserverChange(material, 'data.emissiveIntensity', observer);
            }

            if (typeof data.opacity === 'number') {
                observer.set('data.opacity', data.opacity);
                observer.set('data.blendType', data.opacity < 1 || data.transparent === true ? BLEND_NORMAL : BLEND_NONE);
                applyMaterialObserverChange(material, 'data.opacity', observer);
            }

            if (typeof data.alphaTest === 'number') {
                observer.set('data.alphaTest', data.alphaTest);
                applyMaterialObserverChange(material, 'data.alphaTest', observer);
            }

            if (typeof data.clearcoat === 'number') {
                observer.set('data.clearCoat', data.clearcoat);
                applyMaterialObserverChange(material, 'data.clearCoat', observer);
            }

            if (typeof data.clearcoatRoughness === 'number') {
                observer.set('data.clearcoatRoughness', data.clearcoatRoughness);
                observer.set('data.clearCoatGloss', 1 - data.clearcoatRoughness);
                applyMaterialObserverChange(material, 'data.clearcoatRoughness', observer);
            }

            if (typeof data.sheen === 'number') {
                observer.set('data.useSheen', data.sheen > 0);
            }

            if (Array.isArray(data.sheenColor)) {
                observer.set('data.sheen', cloneSerializable(data.sheenColor));
                applyMaterialObserverChange(material, 'data.sheen', observer);
            }

            if (typeof data.sheenRoughness === 'number') {
                observer.set('data.sheenRoughness', data.sheenRoughness);
                observer.set('data.sheenGloss', 1 - data.sheenRoughness);
                applyMaterialObserverChange(material, 'data.sheenRoughness', observer);
            }
        }, [observer]);

        if (physicalMaterial && typeof data.envMapIntensity === 'number') {
            physicalMaterial.envMapIntensity = data.envMapIntensity;
        }

        this.restoreSavedMaterialTextures(assetId, observer, data.textures);
    }

    private restoreSavedMaterialTextures(assetId: number, observer: AssetObserver, texturesValue: unknown) {
        const textures = isRecord(texturesValue) ? texturesValue : {};

        (Object.entries(TEXTURE_SLOT_ALIASES_BY_PROPERTY) as [SavedSceneTextureKey, string[]][]).forEach(([propertyKey, observerSlots]) => {
            const observerSlot = observerSlots[0];
            const textureEntry = textures[propertyKey];
            const clearTextureMetadata = () => {
                observer.set(`data.${observerSlot}Channel`, null);
                observer.set(`data.${observerSlot}Uv`, null);
                observer.set(`data.${observerSlot}Offset`, null);
                observer.set(`data.${observerSlot}Tiling`, null);
                observer.set(`data.${observerSlot}Rotation`, null);
            };

            if (!isRecord(textureEntry) || typeof textureEntry.url !== 'string' || !textureEntry.url) {
                this.withSyncGuard(() => {
                    observer.set(`data.${observerSlot}`, null);
                    clearTextureMetadata();
                }, [observer]);
                void this.applyTexture(assetId, observerSlot, null).catch((error) => {
                    console.warn('[r3f-bridge] texture load failed', error);
                });
                return;
            }

            const matchedAssetId = this.findTextureAssetIdByUrl(textureEntry.url);
            this.withSyncGuard(() => {
                observer.set(`data.${observerSlot}`, matchedAssetId);

                if ('channel' in textureEntry) {
                    observer.set(`data.${observerSlot}Channel`, textureEntry.channel);
                } else {
                    observer.set(`data.${observerSlot}Channel`, null);
                }

                if ('uv' in textureEntry) {
                    observer.set(`data.${observerSlot}Uv`, textureEntry.uv);
                } else {
                    observer.set(`data.${observerSlot}Uv`, null);
                }

                if (Array.isArray(textureEntry.offset)) {
                    observer.set(`data.${observerSlot}Offset`, cloneSerializable(textureEntry.offset));
                } else {
                    observer.set(`data.${observerSlot}Offset`, null);
                }

                if (Array.isArray(textureEntry.tiling)) {
                    observer.set(`data.${observerSlot}Tiling`, cloneSerializable(textureEntry.tiling));
                } else {
                    observer.set(`data.${observerSlot}Tiling`, null);
                }

                if (typeof textureEntry.rotation === 'number') {
                    observer.set(`data.${observerSlot}Rotation`, textureEntry.rotation);
                } else {
                    observer.set(`data.${observerSlot}Rotation`, null);
                }
            }, [observer]);

            void this.applyTexture(assetId, observerSlot, textureEntry.url).then(() => {
                const material = this.materialByAssetId.get(assetId);
                const propertyName = this.materialPropertyForTextureSlot(observerSlot);
                const texture = propertyName && material
                    ? (material as THREE.Material & Record<string, unknown>)[propertyName]
                    : null;

                if (!(texture instanceof THREE.Texture)) {
                    return;
                }

                if ('channel' in textureEntry && textureEntry.channel !== undefined) {
                    texture.userData.playcanvasChannel = textureEntry.channel;
                }

                if (typeof textureEntry.uv === 'number' && 'channel' in texture) {
                    texture.channel = textureEntry.uv;
                }

                if (Array.isArray(textureEntry.offset)) {
                    texture.offset.set(
                        Number(textureEntry.offset[0] ?? 0),
                        Number(textureEntry.offset[1] ?? 0)
                    );
                }

                if (Array.isArray(textureEntry.tiling)) {
                    texture.repeat.set(
                        Number(textureEntry.tiling[0] ?? 1),
                        Number(textureEntry.tiling[1] ?? 1)
                    );
                }

                if (typeof textureEntry.rotation === 'number') {
                    texture.center.set(0.5, 0.5);
                    texture.rotation = THREE.MathUtils.degToRad(textureEntry.rotation);
                }

                texture.needsUpdate = true;
                if (material) {
                    material.needsUpdate = true;
                }
            }).catch((error) => {
                console.warn('[r3f-bridge] texture load failed', error);
            });
        });
    }

    private findTextureAssetIdByUrl(url: string) {
        const normalizedUrl = this.normalizeAssetUrl(url);
        const assets = editor.api.globals.assets.list() as AssetObserver[];

        for (const asset of assets) {
            if (asset.get('type') !== 'texture') {
                continue;
            }

            const assetUrl = this.normalizeAssetUrl(String(asset.get('file.url') || ''));
            if (assetUrl && assetUrl === normalizedUrl) {
                return Number(asset.get('id'));
            }
        }

        return null;
    }

    private getSceneEnvIntensity() {
        const sceneSettings = editor.call('sceneSettings') as { get: (path: string) => unknown } | null;
        const value = Number(sceneSettings?.get('render.envIntensity') ?? this.config.scene.envIntensity ?? DEFAULT_ENV_INTENSITY);
        return Number.isFinite(value) ? value : DEFAULT_ENV_INTENSITY;
    }

    private setMaterialBaseEnvMapIntensity(material: THREE.Material, value: unknown) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return;
        }

        const target = material as THREE.Material & { userData?: Record<string, unknown> };
        target.userData = target.userData || {};
        target.userData[BRIDGE_BASE_ENV_MAP_INTENSITY] = Math.max(0, numeric);
    }

    private getMaterialBaseEnvMapIntensity(material: THREE.Material, asset?: AssetObserver | null) {
        const target = material as THREE.Material & { userData?: Record<string, unknown> };
        const value = target.userData?.[BRIDGE_BASE_ENV_MAP_INTENSITY];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return Math.max(0, value);
        }

        const fallback = asset
            ? Number(asset.get('data.reflectivity') ?? (material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshStandardMaterial ? material.envMapIntensity : 1))
            : (material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshStandardMaterial ? Number(material.envMapIntensity ?? 1) : 1);
        const base = Number.isFinite(fallback) ? Math.max(0, fallback) : 1;
        this.setMaterialBaseEnvMapIntensity(material, base);
        return base;
    }

    private applySceneEnvIntensityToMaterial(material: THREE.Material, asset?: AssetObserver | null) {
        const physicalMaterial = material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshStandardMaterial
            ? material
            : null;
        if (!physicalMaterial) {
            return;
        }

        const base = this.getMaterialBaseEnvMapIntensity(material, asset);
        physicalMaterial.envMapIntensity = base * this.getSceneEnvIntensity();
        physicalMaterial.needsUpdate = true;
    }

    private applySceneEnvIntensityToAllMaterials() {
        this.materialByAssetId.forEach((material, assetId) => {
            const asset = editor.call('assets:get', assetId) as AssetObserver | null;
            this.applySceneEnvIntensityToMaterial(material, asset);
        });
    }

    private updateViewerConfigMaterial(record: BridgeMaterialRecord | undefined, asset: AssetObserver) {
        if (!record) {
            return;
        }

        const material = record.material;
        const physicalMaterial = material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshStandardMaterial
            ? material
            : null;

        if (!physicalMaterial) {
            return;
        }

        const roughness = physicalMaterial.roughness ?? Number(asset.get('data.roughness') ?? (1 - Number(asset.get('data.shininess') ?? 100) / 100));
        const normalScale = physicalMaterial.normalScale?.x ?? Number(asset.get('data.normalStrength') ?? 1);
        const bumpScale = physicalMaterial.bumpScale ?? Number(asset.get('data.bumpMapFactor') ?? asset.get('data.heightMapFactor') ?? 1);
        const envMapIntensity = this.getMaterialBaseEnvMapIntensity(material, asset);
        const sheenEnabled = material instanceof THREE.MeshPhysicalMaterial
            ? (material.sheen ?? 0) > 0
            : !!(asset.get('data.sheenEnabled') ?? asset.get('data.useSheen'));
        const sheenColor = material instanceof THREE.MeshPhysicalMaterial
            ? this.rgbArrayToHex(toSavedRgbTuple(material.sheenColor))
            : this.rgbArrayToHex(asset.get('data.sheen'));
        const sheenRoughness = material instanceof THREE.MeshPhysicalMaterial
            ? material.sheenRoughness ?? Number(asset.get('data.sheenRoughness') ?? (1 - Number(asset.get('data.sheenGloss') ?? 1)))
            : Number(asset.get('data.sheenRoughness') ?? (1 - Number(asset.get('data.sheenGloss') ?? 1)));

        if (record.role === 'face') {
            const faceColor = decomposeViewerColor(toSavedRgbTuple(physicalMaterial.color));
            this.config.face.params.color = faceColor.color;
            this.config.face.params.colorMultiplier = faceColor.colorMultiplier;
            this.config.face.params.roughness = roughness;
            this.config.face.params.metalness = physicalMaterial.metalness ?? Number(asset.get('data.metalness') ?? 0);
            this.config.face.params.envMapIntensity = envMapIntensity;
            this.config.face.params.normalScale = normalScale;
            this.config.face.params.bumpScale = bumpScale;
            this.config.face.params.sheen = material instanceof THREE.MeshPhysicalMaterial ? material.sheen ?? Number(sheenEnabled) : Number(sheenEnabled);
            this.config.face.params.sheenColor = sheenColor;
            this.config.face.params.sheenRoughness = sheenRoughness;
        }

        if (record.role === 'back') {
            this.config.back.params.color = this.rgbArrayToHex(toSavedRgbTuple(physicalMaterial.color));
            this.config.back.params.roughness = roughness;
            this.config.back.params.envMapIntensity = envMapIntensity;
            this.config.back.params.normalScale = normalScale;
            this.config.back.params.bumpScale = bumpScale;
            this.config.back.params.sheen = material instanceof THREE.MeshPhysicalMaterial ? material.sheen ?? Number(sheenEnabled) : Number(sheenEnabled);
            this.config.back.params.sheenColor = sheenColor;
            this.config.back.params.sheenRoughness = sheenRoughness;
        }

        if (record.role === 'frame' && material instanceof THREE.MeshPhysicalMaterial) {
            this.config.frame.params.color = this.rgbArrayToHex(toSavedRgbTuple(material.color));
            this.config.frame.params.roughness = roughness;
            this.config.frame.params.metalness = material.metalness ?? Number(asset.get('data.metalness') ?? 0);
            this.config.frame.params.clearcoat = material.clearcoat ?? Number(asset.get('data.clearcoat') ?? asset.get('data.clearCoat') ?? 0);
            this.config.frame.params.clearcoatRoughness = material.clearcoatRoughness ?? Number(asset.get('data.clearcoatRoughness') ?? (1 - Number(asset.get('data.clearCoatGloss') ?? 1)));
        }
    }

    private updateViewerConfig(updater: (config: ViewerConfig) => void) {
        if (this.viewerActions) {
            this.viewerActions.updateConfig(updater);
            return;
        }

        updater(this.config);
    }

    private normalizeAssetUrl(url: string) {
        return typeof url === 'string' ? url.trim() : '';
    }

    private resolveTextureAssetUrl(assetId: unknown) {
        if (typeof assetId === 'string' && assetId.trim() && (assetId.startsWith('/') || assetId.startsWith('http'))) {
            return assetId;
        }

        const numericId = Number(assetId);
        const observer = editor.call('assets:get', numericId) as AssetObserver | null;
        const fallback = !observer
            ? (editor.call('assets:list') as AssetObserver[]).find((asset) => asset.get('id') === numericId) || null
            : null;
        const resolvedObserver = observer || fallback;
        const fileUrl = resolvedObserver?.get('file.url');
        return typeof fileUrl === 'string' && fileUrl ? fileUrl : null;
    }

    private normalizeTextureSlot(slot: string) {
        return slot.replace(/^data\./, '');
    }

    private materialPropertyForTextureSlot(slot: string) {
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
    }

    private textureConfigKeyForSlot(slot: string): keyof ViewerConfig['face']['textures'] | null {
        switch (slot) {
            case 'diffuseMap':
            case 'baseColorMap':
            case 'colorMap':
                return 'texture';
            case 'normalMap':
                return 'normal';
            case 'roughnessMap':
            case 'glossMap':
                return 'roughness';
            case 'heightMap':
            case 'bumpMap':
                return 'height';
            case 'sheenMap':
            case 'sheenColorMap':
                return 'sheenColor';
            default:
                return null;
        }
    }

    private applyTexturePropertyChange(material: THREE.Material, path: string, observer: AssetObserver) {
        const match = path.match(/^data\.(.+Map)(Channel|Uv|Offset|Tiling|Rotation)$/);
        if (!match) {
            return false;
        }

        const slot = match[1];
        const property = this.materialPropertyForTextureSlot(slot);
        const suffix = match[2];
        if (!property || !(property in material)) {
            return false;
        }

        const texture = (material as THREE.Material & Record<string, unknown>)[property];
        if (!(texture instanceof THREE.Texture)) {
            return true;
        }

        if (suffix === 'Channel') {
            texture.userData.playcanvasChannel = observer.get(path);
        } else if (suffix === 'Uv' && 'channel' in texture) {
            texture.channel = Number(observer.get(path) ?? texture.channel);
        } else if (suffix === 'Offset') {
            const value = observer.get(path) as number[] || [texture.offset.x, texture.offset.y];
            texture.offset.set(Number(value[0] ?? texture.offset.x), Number(value[1] ?? texture.offset.y));
        } else if (suffix === 'Tiling') {
            const value = observer.get(path) as number[] || [texture.repeat.x, texture.repeat.y];
            texture.repeat.set(Number(value[0] ?? texture.repeat.x), Number(value[1] ?? texture.repeat.y));
        } else if (suffix === 'Rotation') {
            texture.center.set(0.5, 0.5);
            texture.rotation = THREE.MathUtils.degToRad(Number(observer.get(path) ?? THREE.MathUtils.radToDeg(texture.rotation)));
        }

        texture.needsUpdate = true;
        material.needsUpdate = true;
        return true;
    }

    private materialRoleForAsset(assetId: number): 'face' | 'back' | 'frame' | null {
        const mappedRole = this.materialRoleByAssetId.get(assetId);
        if (mappedRole && mappedRole !== 'generic') {
            return mappedRole;
        }

        const observer = editor.call('assets:get', assetId) as AssetObserver | null;
        const name = String(observer?.get('name') || '');
        const normalizedName = name
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

        return null;
    }

    private async loadTexture(url: string, slot: string) {
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
            this.textureLoader.load(url, resolve, undefined, reject);
        });

        texture.userData.sourceUrl = url;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.colorSpace = this.isColorTextureSlot(slot)
            ? THREE.SRGBColorSpace
            : THREE.NoColorSpace;
        texture.needsUpdate = true;
        return texture;
    }

    private isColorTextureSlot(slot: string) {
        return slot === 'diffuseMap' ||
            slot === 'baseColorMap' ||
            slot === 'colorMap' ||
            slot === 'emissiveMap' ||
            slot === 'sheenMap' ||
            slot === 'sheenColorMap';
    }

    private rgbArrayToHex(value: number[] = [0, 0, 0]) {
        return `#${value.map((channel) => {
            return Math.round(THREE.MathUtils.clamp(channel ?? 0, 0, 1) * 255).toString(16).padStart(2, '0');
        }).join('')}`;
    }

    private registerObjectBinding(resourceId: string, object: THREE.Object3D) {
        this.objectById.set(resourceId, object);
        this.resourceIdByObject.set(object, resourceId);
    }

    private replaceMappedObject(resourceId: string, currentObject: THREE.Object3D, nextObject: THREE.Object3D, observer: EntityObserver) {
        const parent = currentObject.parent;
        if (!parent) {
            return null;
        }

        const currentIndex = parent.children.indexOf(currentObject);
        parent.remove(currentObject);
        parent.add(nextObject);
        const insertedIndex = parent.children.indexOf(nextObject);
        if (currentIndex !== -1 && insertedIndex !== -1 && insertedIndex !== currentIndex) {
            parent.children.splice(insertedIndex, 1);
            parent.children.splice(currentIndex, 0, nextObject);
        }

        this.registerObjectBinding(resourceId, nextObject);

        if (this.context && currentObject === this.context.camera && nextObject instanceof THREE.Camera && isViewerCamera(nextObject)) {
            this.context.camera = nextObject;
            setBridgeAudioCamera(nextObject);
        }

        if (this.context && currentObject === this.context.keyLight && nextObject instanceof THREE.Light) {
            this.context.keyLight = nextObject as THREE.PointLight;
        }

        this.applyMappedEntityComponents(nextObject, observer);
        this.applyEffectiveVisibility(resourceId, nextObject, observer);
        nextObject.updateMatrixWorld(true);
        this.sceneDirty = true;

        return nextObject;
    }

    private applyActiveCameraClearColor(observer: EntityObserver) {
        if (!this.context) {
            return;
        }

        const clearColor = observer.get('components.camera.clearColor');
        if (!Array.isArray(clearColor)) {
            return;
        }

        const nextColor = this.asVec3Tuple(clearColor, [1, 1, 1]);
        const alpha = THREE.MathUtils.clamp(Number(clearColor[3] ?? 1), 0, 1);
        this.context.renderer.setClearColor(new THREE.Color(nextColor[0], nextColor[1], nextColor[2]), alpha);
    }

    private applyMappedEntityPath(object: THREE.Object3D, normalizedPath: string, observer: EntityObserver) {
        let changed = false;

        if (normalizedPath.startsWith('components.render')) {
            changed = applyRenderObserverChange(object, normalizedPath, observer) || changed;
            if (normalizedPath.startsWith('components.render.materialAssets') && object instanceof THREE.Mesh) {
                changed = this.applyMaterialAssignments(object, observer) || changed;
            }
            this.applyEffectiveVisibility(observer.get('resource_id'), object, observer);
        }

        if (normalizedPath.startsWith('components.light') && object instanceof THREE.Light) {
            changed = applyLightObserverChange(object, normalizedPath, observer) || changed;
            this.applyEffectiveVisibility(observer.get('resource_id'), object, observer);
        }

        if (normalizedPath.startsWith('components.camera') && object === this.context?.camera) {
            changed = applyCameraObserverChange(this.context.camera, normalizedPath, observer) || changed;
            if (normalizedPath === 'components.camera.clearColor' || normalizedPath === 'components.camera') {
                this.applyActiveCameraClearColor(observer);
            }
            this.applyEffectiveVisibility(observer.get('resource_id'), object, observer);
            this.config.camera = this.config.camera || {
                fov: 35,
                distance: 0.2,
                polarAngle: 90,
                azimuthAngle: 0,
                enableDamping: true,
                dampingFactor: 0.1,
                autoRotate: false,
                autoRotateSpeed: 2
            };
            if (this.context.camera instanceof THREE.PerspectiveCamera) {
                this.config.camera.fov = this.context.camera.fov;
            }
        }

        if (normalizedPath.startsWith('components.animation')) {
            changed = applyAnimationObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.anim')) {
            changed = applyAnimObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.sound')) {
            changed = applySoundObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.audiolistener')) {
            changed = applyAudiolistenerObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.sprite')) {
            changed = applySpriteObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.particlesystem')) {
            changed = applyParticleObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.gsplat')) {
            changed = applyGSplatObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.collision')) {
            changed = applyCollisionObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.rigidbody')) {
            changed = applyRigidbodyObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.element')) {
            changed = applyElementObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.screen')) {
            changed = applyScreenObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.button')) {
            changed = applyButtonObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.layoutgroup')) {
            changed = applyLayoutgroupObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.layoutchild')) {
            changed = applyLayoutchildObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.scrollview') || normalizedPath.startsWith('components.scrollbar')) {
            changed = applyScrollviewObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.script')) {
            changed = applyScriptObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.zone')) {
            changed = applyZoneObserverChange(object, normalizedPath, observer) || changed;
        }

        if (normalizedPath.startsWith('components.model')) {
            if (observer.has('components.render')) {
                if (normalizedPath === 'components.model' || normalizedPath === 'components.model.enabled') {
                    this.withSyncGuard(() => {
                        observer.set('components.render.enabled', !!observer.get('components.model.enabled'));
                    }, [observer]);
                    changed = applyRenderObserverChange(object, 'components.render.enabled', observer) || changed;
                }

                if (normalizedPath === 'components.model' || normalizedPath === 'components.model.castShadows') {
                    this.withSyncGuard(() => {
                        observer.set('components.render.castShadows', !!observer.get('components.model.castShadows'));
                    }, [observer]);
                    changed = applyRenderObserverChange(object, 'components.render.castShadows', observer) || changed;
                }

                if (normalizedPath === 'components.model' || normalizedPath === 'components.model.receiveShadows') {
                    this.withSyncGuard(() => {
                        observer.set('components.render.receiveShadows', !!observer.get('components.model.receiveShadows'));
                    }, [observer]);
                    changed = applyRenderObserverChange(object, 'components.render.receiveShadows', observer) || changed;
                }

                if (normalizedPath === 'components.model' || normalizedPath === 'components.model.materialAsset') {
                    const materialAsset = Number(observer.get('components.model.materialAsset'));
                    this.withSyncGuard(() => {
                        observer.set('components.render.materialAssets', Number.isFinite(materialAsset) ? [materialAsset] : [null]);
                    }, [observer]);
                    if (object instanceof THREE.Mesh) {
                        changed = this.applyMaterialAssignments(object, observer) || changed;
                    }
                }

                if (normalizedPath === 'components.model' || normalizedPath === 'components.model.type') {
                    this.withSyncGuard(() => {
                        observer.set('components.render.type', observer.get('components.model.type'));
                    }, [observer]);
                }

                if (normalizedPath === 'components.model' || normalizedPath === 'components.model.asset') {
                    this.withSyncGuard(() => {
                        observer.set('components.render.asset', observer.get('components.model.asset'));
                    }, [observer]);
                }
            }

            changed = applyModelObserverChange(object, normalizedPath, observer) || changed;
            this.applyEffectiveVisibility(observer.get('resource_id'), object, observer);
        }

        return changed;
    }

    private applyMappedEntityComponents(object: THREE.Object3D, observer: EntityObserver) {
        let changed = false;
        [
            'render',
            'light',
            'camera',
            'animation',
            'anim',
            'sound',
            'audiolistener',
            'sprite',
            'particlesystem',
            'gsplat',
            'collision',
            'rigidbody',
            'element',
            'screen',
            'button',
            'layoutgroup',
            'layoutchild',
            'scrollview',
            'scrollbar',
            'script',
            'zone',
            'model'
        ].forEach((componentName) => {
            if (observer.has(`components.${componentName}`)) {
                changed = this.applyMappedEntityPath(object, `components.${componentName}`, observer) || changed;
            }
        });

        return changed;
    }

    private bindEntityObserver(observer: EntityObserver) {
        const resourceId = observer.get('resource_id');
        let object = this.objectById.get(resourceId);

        if (!object || this.entityBindings.has(resourceId)) {
            return;
        }

        const handlePathChange = (path: string) => {
            if (this.syncGuard) {
                return;
            }

            const normalizedPath = normalizeEntityPath(path);
            let changed = false;

            if (normalizedPath === 'name') {
                object.name = observer.get('name') || object.name;
                changed = true;
            } else if (normalizedPath.startsWith('position')) {
                const position = observer.get('position') || [0, 0, 0];
                object.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
                changed = true;
            } else if (normalizedPath.startsWith('rotation')) {
                const rotation = observer.get('rotation') || [0, 0, 0];
                object.rotation.set(
                    THREE.MathUtils.degToRad(rotation[0] ?? 0),
                    THREE.MathUtils.degToRad(rotation[1] ?? 0),
                    THREE.MathUtils.degToRad(rotation[2] ?? 0)
                );
                changed = true;
            } else if (normalizedPath.startsWith('scale')) {
                const scale = observer.get('scale') || [1, 1, 1];
                object.scale.set(scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1);
                changed = true;
            } else if (normalizedPath === 'enabled') {
                this.applyEffectiveVisibility(resourceId, object, observer);
                changed = true;
            }

            if (normalizedPath === 'components.light.shape' && object instanceof THREE.Light) {
                const replacementLight = createReplacementLightForShape(object, observer);
                if (replacementLight) {
                    const nextObject = this.replaceMappedObject(resourceId, object, replacementLight, observer);
                    if (nextObject) {
                        object = nextObject;
                        changed = true;
                    }
                }
            }

            if (normalizedPath === 'components.camera.projection' && isViewerCamera(object)) {
                const replacementCamera = createReplacementCameraForProjection(object, observer);
                if (replacementCamera) {
                    const nextObject = this.replaceMappedObject(resourceId, object, replacementCamera, observer);
                    if (nextObject && isViewerCamera(nextObject)) {
                        object = nextObject;
                        changed = true;
                    }
                }
            }

            changed = this.applyMappedEntityPath(object, normalizedPath, observer) || changed;

            if (changed) {
                object.updateMatrixWorld(true);
                this.sceneDirty = true;
            }
        };

        const handles = [
            observer.on('*:set', handlePathChange),
            observer.on('*:insert', handlePathChange),
            observer.on('*:remove', handlePathChange),
            observer.on('*:unset', handlePathChange)
        ];

        const compositeHandle = {
            unbind: () => {
                handles.forEach((handle) => handle.unbind());
            }
        } as EventHandle;

        this.entityBindings.set(resourceId, compositeHandle);
        this.applyMappedEntityComponents(object, observer);
        this.applyEffectiveVisibility(resourceId, object, observer);
        object.updateMatrixWorld(true);
    }

    private applyMaterialAssignments(mesh: THREE.Mesh, observer: EntityObserver) {
        const assetIds = observer.get('components.render.materialAssets') || [];
        const materials = assetIds
        .map(assetId => this.materialByAssetId.get(assetId))
        .filter(Boolean) as THREE.Material[];

        if (!materials.length) {
            return false;
        }

        mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
        return true;
    }

    private cleanupBindings() {
        this.entityBindings.forEach(handle => handle.unbind());
        this.entityBindings.clear();

        this.materialBindings.forEach(handle => handle.unbind());
        this.materialBindings.clear();
    }

    private syncObserversFromScene() {
        if (!this.context || this.syncGuard) {
            return;
        }

        this.objectById.forEach((object, resourceId) => {
            const observer = editor.call('entities:get', resourceId) as EntityObserver | null;
            if (!observer) {
                return;
            }

            const snapshot = this.createSceneSnapshot(resourceId, object, observer);
            const previous = this.lastSceneSnapshot.get(resourceId);
            if (previous && this.snapshotsEqual(previous, snapshot)) {
                return;
            }

            this.lastSceneSnapshot.set(resourceId, snapshot);

            this.withSyncGuard(() => {
                this.setObserverValue(observer, 'name', snapshot.name);
                this.setObserverArray(observer, 'position', snapshot.position);
                this.setObserverArray(observer, 'rotation', snapshot.rotation);
                this.setObserverArray(observer, 'scale', snapshot.scale);

                if (snapshot.light && observer.has('components.light')) {
                    this.setObserverArray(observer, 'components.light.color', snapshot.light.color);
                    this.setObserverValue(observer, 'components.light.intensity', snapshot.light.intensity);
                    this.setObserverValue(observer, 'components.light.range', snapshot.light.range);
                    this.setObserverValue(observer, 'components.light.castShadows', snapshot.light.castShadows);
                }

                if (snapshot.camera && observer.has('components.camera')) {
                    this.setObserverValue(observer, 'components.camera.fov', snapshot.camera.fov);
                    this.setObserverValue(observer, 'components.camera.nearClip', snapshot.camera.nearClip);
                    this.setObserverValue(observer, 'components.camera.farClip', snapshot.camera.farClip);
                }
            }, [observer]);
        });
    }

    private bindSceneSettingsObserver(sceneSettings: Observer | null) {
        if (this.sceneSettingsObserver === sceneSettings) {
            return;
        }

        this.sceneSettingsBinding?.unbind();
        this.sceneSettingsBinding = null;
        this.sceneSettingsObserver = sceneSettings;
        this.sceneSettingsSeeded = false;

        if (!sceneSettings) {
            return;
        }

        this.sceneSettingsBinding = sceneSettings.on('*:set', (path: string) => {
            if (this.syncGuard || !this.context) {
                return;
            }

            this.applyLiveSceneSetting(path, sceneSettings);
        });
    }

    private syncSceneSettingsObserverFromContext(sceneSettingsInput?: Observer | null) {
        if (!this.context || this.sceneSettingsSeeded) {
            return;
        }

        const sceneSettings = sceneSettingsInput ?? this.sceneSettingsObserver ?? editor.call('sceneSettings') as Observer | null;
        if (!sceneSettings) {
            return;
        }

        const renderer = this.context.renderer;
        const scene = this.context.scene;
        const sceneWithEnvironment = scene as THREE.Scene & {
            backgroundIntensity?: number;
            backgroundRotation?: THREE.Euler;
            environmentIntensity?: number;
            environmentRotation?: THREE.Euler;
        };
        const ambientLight = findAmbientLight(scene);
        const backgroundColor = scene.background instanceof THREE.Color
            ? [scene.background.r, scene.background.g, scene.background.b]
            : [...DEFAULT_SCENE_BACKGROUND_RGB] as [number, number, number];
        const fogColor = scene.fog
            ? [scene.fog.color.r, scene.fog.color.g, scene.fog.color.b]
            : [...DEFAULT_FOG_COLOR_RGB] as [number, number, number];
        const fogType = scene.fog instanceof THREE.Fog
            ? 'linear'
            : scene.fog instanceof THREE.FogExp2
                ? 'exponential'
                : 'none';
        const outputColorSpace = renderer.outputColorSpace === THREE.LinearSRGBColorSpace
            ? 'srgb-linear'
            : 'srgb';
        const gammaCorrection = renderer.outputColorSpace === THREE.LinearSRGBColorSpace ? 0 : 1;
        const envIntensity = typeof sceneWithEnvironment.environmentIntensity === 'number'
            ? sceneWithEnvironment.environmentIntensity
            : DEFAULT_ENV_INTENSITY;
        const envRotation = sceneWithEnvironment.environmentRotation instanceof THREE.Euler
            ? THREE.MathUtils.radToDeg(sceneWithEnvironment.environmentRotation.y)
            : DEFAULT_ENV_ROTATION;

        this.withSyncGuard(() => {
            this.setObserverValue(sceneSettings, 'render.exposure', renderer.toneMappingExposure ?? this.config.scene.exposure ?? 1);
            this.setObserverValue(sceneSettings, 'render.tonemapping', Number(renderer.toneMapping ?? THREE.NoToneMapping));
            this.setObserverValue(sceneSettings, 'render.gamma_correction', gammaCorrection);
            this.setObserverValue(sceneSettings, 'render.outputColorSpace', outputColorSpace);
            this.setObserverValue(sceneSettings, 'render.shadowsEnabled', !!renderer.shadowMap.enabled);
            this.setObserverValue(sceneSettings, 'render.shadowType', Number(renderer.shadowMap.type));
            this.setObserverArray(sceneSettings, 'render.backgroundColor', backgroundColor);
            this.setObserverValue(sceneSettings, 'render.fog', fogType);
            this.setObserverArray(sceneSettings, 'render.fog_color', fogColor);
            this.setObserverValue(sceneSettings, 'render.fog_start', scene.fog instanceof THREE.Fog ? scene.fog.near : DEFAULT_FOG_START);
            this.setObserverValue(sceneSettings, 'render.fog_end', scene.fog instanceof THREE.Fog ? scene.fog.far : DEFAULT_FOG_END);
            this.setObserverValue(sceneSettings, 'render.fog_density', scene.fog instanceof THREE.FogExp2 ? scene.fog.density : DEFAULT_FOG_DENSITY);
            this.setObserverArray(
                sceneSettings,
                'render.global_ambient',
                ambientLight
                    ? [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b]
                    : [...DEFAULT_AMBIENT_RGB] as [number, number, number]
            );
            this.setObserverValue(sceneSettings, 'render.ambientIntensity', ambientLight?.intensity ?? DEFAULT_AMBIENT_INTENSITY);
            this.setObserverValue(sceneSettings, 'render.envIntensity', envIntensity);
            this.setObserverValue(sceneSettings, 'render.envRotation', envRotation);
            this.setObserverValue(sceneSettings, 'render.envPreset', this.config.environment?.preset ?? '');
            this.setObserverValue(sceneSettings, 'render.groundEnabled', !!this.config.environment?.groundEnabled);
            this.setObserverValue(sceneSettings, 'render.groundHeight', this.config.environment?.groundHeight ?? 0);
            this.setObserverValue(sceneSettings, 'render.groundRadius', this.config.environment?.groundRadius ?? 20);
        }, [sceneSettings]);

        this.sceneSettingsSeeded = true;
    }

    private applySceneSettingsObserverToContext(sceneSettingsInput?: Observer | null) {
        if (!this.context) {
            return;
        }

        const sceneSettings = sceneSettingsInput ?? this.sceneSettingsObserver ?? editor.call('sceneSettings') as Observer | null;
        if (!sceneSettings) {
            return;
        }

        [
            'render.tonemapping',
            'render.exposure',
            'render.gamma_correction',
            'render.outputColorSpace',
            'render.shadowsEnabled',
            'render.shadowType',
            'render.backgroundColor',
            'render.fog',
            'render.fog_color',
            'render.fog_start',
            'render.fog_end',
            'render.fog_density',
            'render.global_ambient',
            'render.ambientIntensity',
            'render.envIntensity',
            'render.envRotation'
        ].forEach((path) => {
            this.applyLiveSceneSetting(path, sceneSettings);
        });
    }

    private applyLiveSceneSetting(
        path: string,
        sceneSettings: { get: (path: string) => unknown }
    ) {
        if (!this.context) {
            return;
        }

        const renderer = this.context.renderer;
        const scene = this.context.scene;

        if (path === 'render.tonemapping') {
            renderer.toneMapping = Number(sceneSettings.get('render.tonemapping') ?? renderer.toneMapping) as THREE.ToneMapping;
            this.sceneDirty = true;
            return;
        }

        if (path === 'render.exposure') {
            renderer.toneMappingExposure = Number(sceneSettings.get('render.exposure') ?? renderer.toneMappingExposure);
            this.config.scene.exposure = renderer.toneMappingExposure;
            this.sceneDirty = true;
            return;
        }

        if (path === 'render.outputColorSpace') {
            const value = sceneSettings.get('render.outputColorSpace');
            renderer.outputColorSpace = value === 'srgb-linear' ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
            this.sceneDirty = true;
            return;
        }

        if (path === 'render.shadowsEnabled') {
            renderer.shadowMap.enabled = !!sceneSettings.get('render.shadowsEnabled');
            renderer.shadowMap.needsUpdate = true;
            this.sceneDirty = true;
            return;
        }

        if (path === 'render.shadowType') {
            renderer.shadowMap.type = Number(sceneSettings.get('render.shadowType') ?? renderer.shadowMap.type) as THREE.ShadowMapType;
            renderer.shadowMap.needsUpdate = true;
            this.sceneDirty = true;
            return;
        }

        if (path === 'render.backgroundColor') {
            const colorValue = sceneSettings.get('render.backgroundColor');
            let backgroundColor: THREE.Color | null = null;

            if (Array.isArray(colorValue)) {
                backgroundColor = new THREE.Color(
                    Number(colorValue[0] ?? 0),
                    Number(colorValue[1] ?? 0),
                    Number(colorValue[2] ?? 0)
                );
            } else if (typeof colorValue === 'string') {
                backgroundColor = new THREE.Color(colorValue);
            }

            if (backgroundColor) {
                scene.background = backgroundColor;
                const hex = `#${backgroundColor.getHexString()}`;
                this.config.scene.background = hex;
                this.config.colors.bgColor = hex;
                this.sceneDirty = true;
            }
            return;
        }

        if (
            path === 'render.fog' ||
            path === 'render.fog_color' ||
            path === 'render.fog_start' ||
            path === 'render.fog_end' ||
            path === 'render.fog_density'
        ) {
            const fogType = String(sceneSettings.get('render.fog') ?? 'none');
            const fogColorValue = sceneSettings.get('render.fog_color');
            let fogColor = new THREE.Color(0);

            if (Array.isArray(fogColorValue)) {
                fogColor = new THREE.Color(
                    Number(fogColorValue[0] ?? 0),
                    Number(fogColorValue[1] ?? 0),
                    Number(fogColorValue[2] ?? 0)
                );
            } else if (typeof fogColorValue === 'string') {
                fogColor = new THREE.Color(fogColorValue);
            }

            if (fogType === 'linear') {
                scene.fog = new THREE.Fog(
                    fogColor,
                    Number(sceneSettings.get('render.fog_start') ?? DEFAULT_FOG_START),
                    Number(sceneSettings.get('render.fog_end') ?? DEFAULT_FOG_END)
                );
            } else if (fogType === 'exponential' || fogType === 'exp' || fogType === 'exp2') {
                scene.fog = new THREE.FogExp2(
                    fogColor,
                    Number(sceneSettings.get('render.fog_density') ?? DEFAULT_FOG_DENSITY)
                );
            } else {
                scene.fog = null;
            }

            this.sceneDirty = true;
            return;
        }

        if (path === 'render.global_ambient' || path === 'render.ambientIntensity') {
            const ambientColor = sceneSettings.get('render.global_ambient');
            const ambientIntensity = Number(sceneSettings.get('render.ambientIntensity') ?? DEFAULT_AMBIENT_INTENSITY);
            let ambientLight = findAmbientLight(scene);

            if (!ambientLight) {
                ambientLight = new THREE.AmbientLight();
                ambientLight.name = '__bridge_ambient_light__';
                scene.add(ambientLight);
            }

            if (Array.isArray(ambientColor)) {
                ambientLight.color.setRGB(
                    Number(ambientColor[0] ?? ambientLight.color.r),
                    Number(ambientColor[1] ?? ambientLight.color.g),
                    Number(ambientColor[2] ?? ambientLight.color.b)
                );
            } else if (typeof ambientColor === 'string') {
                ambientLight.color.set(ambientColor);
            }

            ambientLight.intensity = ambientIntensity;
            if (Array.isArray(ambientColor)) {
                this.config.scene.ambientColor = rgbTupleToHex(ambientColor as number[]);
            } else if (typeof ambientColor === 'string') {
                this.config.scene.ambientColor = ambientColor;
            }
            this.config.scene.ambientIntensity = ambientIntensity;
            this.sceneDirty = true;
            return;
        }

        if (path === 'render.envIntensity') {
            const sceneWithEnvironment = scene as THREE.Scene & {
                backgroundIntensity?: number;
                environmentIntensity?: number;
            };
            const intensity = Number(sceneSettings.get('render.envIntensity') ?? DEFAULT_ENV_INTENSITY);
            sceneWithEnvironment.environmentIntensity = intensity;
            sceneWithEnvironment.backgroundIntensity = intensity;
            this.config.scene.envIntensity = intensity;
            this.applySceneEnvIntensityToAllMaterials();
            this.sceneDirty = true;
            return;
        }

        if (path === 'render.envRotation') {
            const sceneWithEnvironment = scene as THREE.Scene & {
                backgroundRotation?: THREE.Euler;
                environmentRotation?: THREE.Euler;
            };
            const degrees = Number(sceneSettings.get('render.envRotation') ?? DEFAULT_ENV_ROTATION);
            const rotation = new THREE.Euler(0, THREE.MathUtils.degToRad(degrees), 0);
            sceneWithEnvironment.environmentRotation = rotation;
            sceneWithEnvironment.backgroundRotation = rotation.clone();
            if (this.config.environment) {
                this.config.environment.envRotation = degrees;
            }
            this.sceneDirty = true;
            return;
        }

        if (path === 'render.envPreset') {
            const preset = String(sceneSettings.get('render.envPreset') ?? '');
            this.updateViewerConfig((configData) => {
                configData.environment = configData.environment || {
                    preset: 'studio',
                    envRotation: 0,
                    groundEnabled: false,
                    groundHeight: 0,
                    groundRadius: 20
                };
                configData.environment.preset = preset || undefined;
                if (preset) {
                    configData.environment.customHdri = undefined;
                }
            });
            return;
        }

        if (path === 'render.groundEnabled' || path === 'render.groundHeight' || path === 'render.groundRadius') {
            const groundEnabled = !!sceneSettings.get('render.groundEnabled');
            const groundHeight = Number(sceneSettings.get('render.groundHeight') ?? 0);
            const groundRadius = Number(sceneSettings.get('render.groundRadius') ?? 20);
            this.updateViewerConfig((configData) => {
                configData.environment = configData.environment || {
                    preset: 'studio',
                    envRotation: 0,
                    groundEnabled: false,
                    groundHeight: 0,
                    groundRadius: 20
                };
                configData.environment.groundEnabled = groundEnabled;
                configData.environment.groundHeight = groundHeight;
                configData.environment.groundRadius = groundRadius;
            });
        }
    }

    private createSceneSnapshot(resourceId: string, object: THREE.Object3D, observer: EntityObserver): SceneSnapshot {
        const snapshot: SceneSnapshot = {
            name: object.name || getEntityDisplayName(object),
            enabled: this.viewportHiddenIds.has(resourceId) ? !!observer.get('enabled') : object.visible,
            position: toObserverVec3(object.position),
            rotation: toObserverEuler(object),
            scale: toObserverVec3(object.scale)
        };

        if (object instanceof THREE.Light) {
            snapshot.light = {
                color: [object.color.r, object.color.g, object.color.b],
                intensity: object.intensity,
                range: getLightRange(object),
                castShadows: !!object.castShadow
            };
        }

        if (isViewerCamera(object)) {
            snapshot.camera = {
                fov: object instanceof THREE.PerspectiveCamera ? object.fov : 0,
                nearClip: object.near,
                farClip: object.far
            };
        }

        return snapshot;
    }

    private snapshotsEqual(a: SceneSnapshot, b: SceneSnapshot) {
        const baseEqual = a.name === b.name &&
            a.enabled === b.enabled &&
            arraysEqual(a.position, b.position) &&
            arraysEqual(a.rotation, b.rotation) &&
            arraysEqual(a.scale, b.scale);

        if (!baseEqual) {
            return false;
        }

        if (!!a.light !== !!b.light || !!a.camera !== !!b.camera) {
            return false;
        }

        if (a.light && b.light) {
            if (!arraysEqual(a.light.color, b.light.color) ||
                !nearlyEqual(a.light.intensity, b.light.intensity) ||
                !nearlyEqual(a.light.range, b.light.range) ||
                a.light.castShadows !== b.light.castShadows) {
                return false;
            }
        }

        if (a.camera && b.camera) {
            if (!nearlyEqual(a.camera.fov, b.camera.fov) ||
                !nearlyEqual(a.camera.nearClip, b.camera.nearClip) ||
                !nearlyEqual(a.camera.farClip, b.camera.farClip)) {
                return false;
            }
        }

        return true;
    }

    private withObserverHistoryDisabled(observer: HistoryToggleTarget, fn: () => void) {
        const enabled = observer?.history?.enabled;
        if (!this.syncGuard || enabled === undefined) {
            fn();
            return;
        }

        observer.history.enabled = false;
        try {
            fn();
        } finally {
            observer.history.enabled = enabled;
        }
    }

    private setObserverValue(observer: Observer, path: string, value: unknown) {
        if (observer.get(path) !== value) {
            this.withObserverHistoryDisabled(observer, () => {
                observer.set(path, value);
            });
        }
    }

    private setObserverArray(observer: Observer, path: string, value: number[]) {
        const current = observer.get(path);
        if (!arraysEqual(current || [], value)) {
            this.withObserverHistoryDisabled(observer, () => {
                observer.set(path, cloneArray(value));
            });
        }
    }

    private normalizeSceneName(name: string) {
        const normalized = String(name || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-{2,}/g, '-');
        return normalized.replace(/^-+|-+$/g, '') || 'scene';
    }

    private asVec3Tuple(value: unknown, fallback: [number, number, number]): [number, number, number] {
        if (!Array.isArray(value)) {
            return [...fallback] as [number, number, number];
        }

        return [
            Number(value[0] ?? fallback[0]),
            Number(value[1] ?? fallback[1]),
            Number(value[2] ?? fallback[2])
        ];
    }

    private readSceneSettings(): SavedSceneSettings {
        const sceneSettings = editor.call('sceneSettings') as { get: (path: string) => unknown } | null;
        const rendererExposure = this.context?.renderer?.toneMappingExposure ?? this.config.scene.exposure ?? 1;
        const rendererToneMapping = this.context?.renderer?.toneMapping ?? THREE.NoToneMapping;
        const rendererGamma = this.context?.renderer?.outputColorSpace === THREE.SRGBColorSpace ? 1 : 0;
        const sceneEnvironmentIntensity = (this.context?.scene as THREE.Scene & { environmentIntensity?: number } | undefined)?.environmentIntensity;

        const exposure = Number(sceneSettings?.get('render.exposure') ?? rendererExposure);
        const skyboxIntensity = Number(sceneSettings?.get('render.envIntensity') ?? sceneSettings?.get('render.skyboxIntensity') ?? sceneEnvironmentIntensity ?? this.config.scene.envIntensity ?? 1);
        const tonemapping = Number(sceneSettings?.get('render.tonemapping') ?? rendererToneMapping);
        const gammaCorrection = Number(sceneSettings?.get('render.gamma_correction') ?? rendererGamma);

        return {
            exposure: Number.isFinite(exposure) ? exposure : 1,
            skyboxIntensity: Number.isFinite(skyboxIntensity) ? skyboxIntensity : 1,
            tonemapping: Number.isFinite(tonemapping) ? tonemapping : THREE.NoToneMapping,
            gamma_correction: Number.isFinite(gammaCorrection) ? gammaCorrection : 1
        };
    }

    private applySceneSettings(settings: Partial<SavedSceneSettings> = {}) {
        if (!this.context) {
            return;
        }

        const currentSettings = this.readSceneSettings();
        const exposure = Number(settings.exposure ?? currentSettings.exposure);
        const skyboxIntensity = Number(settings.skyboxIntensity ?? currentSettings.skyboxIntensity);
        const tonemapping = Number(settings.tonemapping ?? currentSettings.tonemapping);
        const gammaCorrection = Number(settings.gamma_correction ?? currentSettings.gamma_correction);

        const sceneSettings = editor.call('sceneSettings') as Observer | null;
        if (sceneSettings) {
            this.withSyncGuard(() => {
                sceneSettings.set('render.exposure', Number.isFinite(exposure) ? exposure : currentSettings.exposure);
                sceneSettings.set('render.envIntensity', Number.isFinite(skyboxIntensity) ? skyboxIntensity : currentSettings.skyboxIntensity);
                sceneSettings.set('render.tonemapping', Number.isFinite(tonemapping) ? tonemapping : currentSettings.tonemapping);
                sceneSettings.set('render.gamma_correction', Number.isFinite(gammaCorrection) ? gammaCorrection : currentSettings.gamma_correction);
            }, [sceneSettings]);
        }

        this.context.renderer.toneMappingExposure = Number.isFinite(exposure) ? exposure : currentSettings.exposure;
        this.context.renderer.toneMapping = (Number.isFinite(tonemapping) ? tonemapping : currentSettings.tonemapping) as THREE.ToneMapping;
        this.context.renderer.outputColorSpace = (Number.isFinite(gammaCorrection) ? gammaCorrection : currentSettings.gamma_correction) === 0
            ? THREE.LinearSRGBColorSpace
            : THREE.SRGBColorSpace;

        const sceneWithEnvironment = this.context.scene as THREE.Scene & {
            backgroundIntensity?: number;
            environmentIntensity?: number;
        };
        if ('environmentIntensity' in sceneWithEnvironment) {
            sceneWithEnvironment.environmentIntensity = Number.isFinite(skyboxIntensity) ? skyboxIntensity : currentSettings.skyboxIntensity;
        }
        if ('backgroundIntensity' in sceneWithEnvironment) {
            sceneWithEnvironment.backgroundIntensity = Number.isFinite(skyboxIntensity) ? skyboxIntensity : currentSettings.skyboxIntensity;
        }

        this.config.scene.exposure = this.context.renderer.toneMappingExposure;
        this.config.scene.envIntensity = Number.isFinite(skyboxIntensity) ? skyboxIntensity : currentSettings.skyboxIntensity;
    }

    private refreshEntitySelectionInspector() {
        if (editor.call('selector:type') !== 'entity') {
            return;
        }

        const selected = editor.call('selector:items') as EntityObserver[] || [];
        if (selected.length > 0) {
            editor.emit('attributes:inspect[entity]', selected);
        }
    }

    private withSyncGuard(fn: () => void, historyTargets: HistoryToggleTarget[] = []) {
        const previousSyncGuard = this.syncGuard;
        const toggled = historyTargets
            .filter((target): target is Exclude<HistoryToggleTarget, null | undefined> => !!target)
            .map((target) => {
                return {
                    target,
                    enabled: target.history?.enabled
                };
            });

        this.syncGuard = true;
        try {
            toggled.forEach(({ target, enabled }) => {
                if (enabled !== undefined) {
                    target.history.enabled = false;
                }
            });
            fn();
        } finally {
            toggled.forEach(({ target, enabled }) => {
                if (enabled !== undefined) {
                    target.history.enabled = enabled;
                }
            });
            this.syncGuard = previousSyncGuard;
        }
    }

    private applyTransformSnapshot(resourceId: string, snapshot: TransformSnapshot) {
        const object = this.objectById.get(resourceId);
        const observer = editor.call('entities:get', resourceId) as EntityObserver | null;
        if (!object || !observer) {
            return;
        }

        object.position.set(snapshot.position[0], snapshot.position[1], snapshot.position[2]);
        object.rotation.set(
            THREE.MathUtils.degToRad(snapshot.rotation[0]),
            THREE.MathUtils.degToRad(snapshot.rotation[1]),
            THREE.MathUtils.degToRad(snapshot.rotation[2])
        );
        object.scale.set(snapshot.scale[0], snapshot.scale[1], snapshot.scale[2]);
        object.updateMatrixWorld(true);

        this.withSyncGuard(() => {
            this.setObserverArray(observer, 'position', snapshot.position);
            this.setObserverArray(observer, 'rotation', snapshot.rotation);
            this.setObserverArray(observer, 'scale', snapshot.scale);
        }, [observer]);

        this.lastSceneSnapshot.set(resourceId, this.createSceneSnapshot(resourceId, object, observer));
        this.sceneDirty = false;
    }

    private applyEffectiveVisibility(resourceId: string, object: THREE.Object3D, observer: EntityObserver) {
        let visible = !!observer.get('enabled');

        if (object instanceof THREE.Mesh && observer.has('components.render.enabled')) {
            visible = visible && !!observer.get('components.render.enabled');
        }

        if (observer.has('components.model.enabled')) {
            visible = visible && !!observer.get('components.model.enabled');
        }

        if (object instanceof THREE.Light && observer.has('components.light.enabled')) {
            visible = visible && !!observer.get('components.light.enabled');
        }

        if (object instanceof THREE.Camera && observer.has('components.camera.enabled')) {
            visible = visible && !!observer.get('components.camera.enabled');
        }

        object.visible = visible && !this.viewportHiddenIds.has(resourceId);
    }
}

export const createObserverR3FBridge = (configData: ViewerConfig) => {
    return new ObserverR3FBridge(configData);
};
