import type { EventHandle } from '@playcanvas/observer';
import * as THREE from 'three';

import { config } from '@/editor/config';
import { Asset, type AssetObserver, type Entity, type EntityObserver } from '@/editor-api';


import { createCameraComponentData, applyCameraObserverChange } from './camera-mapper';
import {
    BRIDGE_ASSET_ID_BASE,
    BRIDGE_ASSET_TAG,
    BRIDGE_ASSET_UNIQUE_ID_BASE,
    BRIDGE_CAMERA_ID,
    BRIDGE_CAMERA_NAME,
    BRIDGE_LIGHT_ID,
    BRIDGE_LIGHT_NAME,
    BRIDGE_ROOT_ID,
    BRIDGE_ROOT_NAME,
    SCENE_SYNC_EPSILON
} from './constants';
import { createBridgeEntityData, getEntityDisplayName, toObserverEuler, toObserverVec3 } from './entity-mapper';
import { createLightComponentData, applyLightObserverChange } from './light-mapper';
import { createMaterialData, applyMaterialObserverChange } from './material-mapper';
import { createRenderComponentData, applyRenderObserverChange } from './render-mapper';
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

type SavedSceneEntity = {
    name: string;
    resource_id: string;
    parent: string | null;
    children: string[];
    enabled: boolean;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    components: Record<string, unknown>;
};

type SavedSceneMaterial = {
    name: string;
    data: Record<string, unknown>;
};

type SavedSceneSettings = {
    exposure: number;
    skyboxIntensity: number;
    tonemapping: number;
    gamma_correction: number;
};

type BridgeViewerActions = {
    updateConfig: (updater: (config: ViewerConfig) => void) => void;
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
        'data.metalness',
        'data.roughness',
        'data.shininess',
        'data.normalStrength',
        'data.glossInvert',
        'data.emissive',
        'data.emissiveIntensity',
        'data.clearcoat',
        'data.clearcoatRoughness',
        'data.clearCoat',
        'data.clearCoatGloss',
        'data.sheenEnabled',
        'data.useSheen',
        'data.sheen',
        'data.sheenRoughness',
        'data.sheenGloss',
        'data.opacity',
        'data.blendType',
        'data.alphaTest'
    ];

    return knownPrefixes.find(prefix => path.startsWith(prefix)) || path;
};

const normalizeEntityPath = (path: string) => {
    const knownPrefixes = [
        'components.light.color',
        'components.render.materialAssets',
        'components.camera.rect'
    ];

    return knownPrefixes.find(prefix => path.startsWith(prefix)) || path;
};

const cloneArray = (value: number[]) => {
    return value.slice(0);
};

const cloneSerializable = <T>(value: T): T => {
    return JSON.parse(JSON.stringify(value));
};

const getLightRange = (light: THREE.Light) => {
    if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        return light.distance || 0;
    }

    return 0;
};

export class ObserverR3FBridge {
    private readonly config: ViewerConfig;

    private context: EffectViewerBridge | null = null;

    private viewerActions: BridgeViewerActions | null = null;

    private readonly objectById = new Map<string, THREE.Object3D>();

    private readonly materialByAssetId = new Map<number, THREE.Material>();

    private readonly materialIdsByUuid = new Map<string, number>();

    private readonly entityBindings = new Map<string, EventHandle>();

    private readonly materialBindings = new Map<number, EventHandle>();

    private readonly editorEvents: EventHandle[] = [];

    private readonly lastSceneSnapshot = new Map<string, SceneSnapshot>();

    private readonly viewportHiddenIds = new Set<string>();

    private readonly textureLoader = new THREE.TextureLoader();

    private rebuildQueued = false;

    private syncGuard = false;

    private nextAssetId = BRIDGE_ASSET_ID_BASE;

    private sceneSyncFrame: number | null = null;

    private sceneDirty = true;

    constructor(configData: ViewerConfig) {
        this.config = configData;
        this.ensureEntityInspectorComponents();

        this.editorEvents.push(editor.on('scene:raw', () => {
            this.scheduleRebuild();
        }));
        this.editorEvents.push(editor.on('scene:unload', () => {
            this.lastSceneSnapshot.clear();
        }));
        this.editorEvents.push(editor.on('entities:add:entity', (observer: EntityObserver) => {
            if (this.objectById.has(observer.get('resource_id')) && observer.entity) {
                observer.entity.__noIcon = true;
            }
        }));

        this.editorEvents.push(editor.on('selector:change', () => {
            this.sceneDirty = true;
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
        if (
            this.context &&
            this.context.scene === context.scene &&
            this.context.camera === context.camera &&
            this.context.renderer === context.renderer &&
            this.context.modelRoot === context.modelRoot &&
            this.context.keyLight === context.keyLight
        ) {
            return;
        }

        this.context = context;
        this.scheduleRebuild();
    }

    setViewerActions(actions: BridgeViewerActions) {
        this.viewerActions = actions;
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

        if (observer && role === 'frame') {
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
        this.editorEvents.forEach(event => event.unbind());
        this.editorEvents.length = 0;
        this.viewportHiddenIds.clear();
    }

    getObjectById(resourceId: string) {
        return this.objectById.get(resourceId) || null;
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

    serializeScene(name = 'default'): SavedScene {
        const now = new Date().toISOString();
        const entities = editor.call('entities:list') as EntityObserver[] || [];
        const serializedEntities: Record<string, SavedSceneEntity> = {};

        entities.forEach((entity) => {
            const resourceId = entity.get('resource_id');
            if (!resourceId || typeof resourceId !== 'string') {
                return;
            }

            const object = this.objectById.get(resourceId);
            const observerPosition = entity.get('position') as number[] || [0, 0, 0];
            const observerRotation = entity.get('rotation') as number[] || [0, 0, 0];
            const observerScale = entity.get('scale') as number[] || [1, 1, 1];
            const parent = entity.get('parent');
            const children = entity.get('children') as string[] || [];
            const components = entity.get('components') as Record<string, unknown> || {};

            serializedEntities[resourceId] = {
                name: String(entity.get('name') || object?.name || resourceId),
                resource_id: resourceId,
                parent: typeof parent === 'string' ? parent : null,
                children: Array.isArray(children) ? [...children] : [],
                enabled: !!entity.get('enabled'),
                position: this.asVec3Tuple(object ? toObserverVec3(object.position) : observerPosition, [0, 0, 0]),
                rotation: this.asVec3Tuple(object ? toObserverEuler(object) : observerRotation, [0, 0, 0]),
                scale: this.asVec3Tuple(object ? toObserverVec3(object.scale) : observerScale, [1, 1, 1]),
                components: cloneSerializable(components)
            };
        });

        const serializedMaterials: Record<string, SavedSceneMaterial> = {};
        this.materialByAssetId.forEach((material, assetId) => {
            const observer = editor.call('assets:get', assetId) as AssetObserver | null;
            const observerData = observer?.get('data');
            const materialData = observerData && typeof observerData === 'object'
                ? observerData as Record<string, unknown>
                : createMaterialData(material);

            serializedMaterials[String(assetId)] = {
                name: String(observer?.get('name') || `Material ${assetId}`),
                data: cloneSerializable(materialData)
            };
        });

        return {
            name: this.normalizeSceneName(name),
            created: now,
            modified: now,
            modelPath: this.config.modelPath || '',
            entities: serializedEntities,
            materials: serializedMaterials,
            sceneSettings: this.readSceneSettings()
        };
    }

    deserializeScene(scene: SavedScene) {
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
                if (typeof cameraComponent.nearClip === 'number') {
                    object.near = cameraComponent.nearClip;
                    if (observer && observer.has('components.camera.nearClip')) {
                        this.withSyncGuard(() => {
                            this.setObserverValue(observer, 'components.camera.nearClip', cameraComponent.nearClip);
                        });
                    }
                }
                if (typeof cameraComponent.farClip === 'number') {
                    object.far = cameraComponent.farClip;
                    if (observer && observer.has('components.camera.farClip')) {
                        this.withSyncGuard(() => {
                            this.setObserverValue(observer, 'components.camera.farClip', cameraComponent.farClip);
                        });
                    }
                }
                object.updateProjectionMatrix();
            }

            if (observer) {
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
                observer.set('name', materialData.name.trim());
            }

            const data = materialData.data || {};
            Object.entries(data).forEach(([key, value]) => {
                observer.set(`data.${key}`, cloneSerializable(value));
                applyMaterialObserverChange(material, `data.${key}`, observer);
            });
            material.needsUpdate = true;
        });

        this.applySceneSettings(scene.sceneSettings);
        this.lastSceneSnapshot.clear();
        this.syncObserversFromScene();
        this.refreshEntitySelectionInspector();
        this.sceneDirty = false;
        return true;
    }

    private startSceneSyncLoop() {
        const tick = () => {
            this.sceneSyncFrame = requestAnimationFrame(tick);
            if (this.sceneDirty) {
                this.syncObserversFromScene();
                this.sceneDirty = false;
            }
        };

        tick();
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
        this.materialByAssetId.clear();
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
                        name: this.getMaterialDisplayName(object, index),
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

            const components: Record<string, unknown> = {};

            if (object instanceof THREE.Mesh) {
                components.render = createRenderComponentData(object, materialState.objectMaterialIds.get(object.uuid) || []);
            }

            result.push(createBridgeEntityData({
                resourceId: object.uuid,
                name: object === ctx.modelRoot ? (object.name || 'Model') : getEntityDisplayName(object),
                parent: parentId,
                children,
                object,
                components
            }));
            this.objectById.set(object.uuid, object);

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
                camera: createCameraComponentData(ctx.camera, ctx.scene)
            }
        }));
        this.objectById.set(BRIDGE_CAMERA_ID, ctx.camera);

        if (ctx.keyLight) {
            result.push(createBridgeEntityData({
                resourceId: BRIDGE_LIGHT_ID,
                name: BRIDGE_LIGHT_NAME,
                parent: BRIDGE_ROOT_ID,
                children: [],
                object: ctx.keyLight,
                components: {
                    light: createLightComponentData(ctx.keyLight)
                }
            }));
            this.objectById.set(BRIDGE_LIGHT_ID, ctx.keyLight);
        }

        return result;
    }

    private shouldIncludeSceneObject(object: THREE.Object3D) {
        if ((object as THREE.Bone).isBone) {
            return false;
        }

        if (object instanceof THREE.Light) {
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

        materialState.materialRecords.forEach((record, assetId) => {
            activeIds.add(assetId);
            this.materialByAssetId.set(assetId, record.material);

            const existing = editor.api.globals.assets.get(assetId);
            if (existing) {
                this.withSyncGuard(() => {
                    existing.set('name', record.name);
                    existing.set('data', createMaterialData(record.material, existing.get('data') || {}));
                    existing.set('tags', [BRIDGE_ASSET_TAG]);
                });
            } else {
                const asset = new Asset({
                    id: assetId,
                    uniqueId: BRIDGE_ASSET_UNIQUE_ID_BASE + assetId,
                    name: record.name,
                    type: 'material',
                    source: false,
                    preload: false,
                    path: [],
                    tags: [BRIDGE_ASSET_TAG],
                    data: createMaterialData(record.material),
                    file: null,
                    meta: null,
                    scope: {
                        type: 'project',
                        id: config.project.id
                    }
                });
                editor.api.globals.assets.add(asset);
            }
        });

        editor.api.globals.assets.list().forEach((asset) => {
            const tags = asset.get('tags') || [];
            if (!tags.includes(BRIDGE_ASSET_TAG)) {
                return;
            }

            if (!activeIds.has(asset.get('id'))) {
                editor.api.globals.assets.remove(asset);
            }
        });

        Array.from(this.materialBindings.keys()).forEach((assetId) => {
            if (!activeIds.has(assetId)) {
                this.materialBindings.get(assetId)?.unbind();
                this.materialBindings.delete(assetId);
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

                applyMaterialObserverChange(material, normalizedPath, observer);
                this.sceneDirty = true;
                this.updateViewerConfigMaterial(materialState.materialRecords.get(assetId), observer);
            });

            this.materialBindings.set(assetId, handle);
        });
    }

    private updateViewerConfigMaterial(record: BridgeMaterialRecord | undefined, asset: AssetObserver) {
        if (!record) {
            return;
        }

        if (record.role === 'frame') {
            this.config.frame.params.color = this.rgbArrayToHex(asset.get('data.diffuse'));
            this.config.frame.params.roughness = Number(asset.get('data.roughness') ?? (1 - Number(asset.get('data.shininess') ?? 100) / 100));
            this.config.frame.params.metalness = Number(asset.get('data.metalness') ?? 0);
            this.config.frame.params.clearcoat = Number(asset.get('data.clearcoat') ?? asset.get('data.clearCoat') ?? 0);
            this.config.frame.params.clearcoatRoughness = Number(asset.get('data.clearcoatRoughness') ?? (1 - Number(asset.get('data.clearCoatGloss') ?? 1)));
        }

        if (record.role === 'back') {
            this.config.back.params.color = this.rgbArrayToHex(asset.get('data.diffuse'));
            this.config.back.params.roughness = Number(asset.get('data.roughness') ?? (1 - Number(asset.get('data.shininess') ?? 100) / 100));
            this.config.back.params.sheen = !!(asset.get('data.sheenEnabled') ?? asset.get('data.useSheen')) ? 1 : 0;
            this.config.back.params.sheenColor = this.rgbArrayToHex(asset.get('data.sheen'));
            this.config.back.params.sheenRoughness = Number(asset.get('data.sheenRoughness') ?? (1 - Number(asset.get('data.sheenGloss') ?? 1)));
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
        const observer = editor.call('assets:get', Number(assetId)) as AssetObserver | null;
        const fileUrl = observer?.get('file.url');
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
            case 'opacityMap':
                return 'alphaMap';
            case 'emissiveMap':
                return 'emissiveMap';
            case 'sheenMap':
            case 'sheenColorMap':
                return 'sheenColorMap';
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

    private materialRoleForAsset(assetId: number): 'face' | 'back' | 'frame' | null {
        const observer = editor.call('assets:get', assetId) as AssetObserver | null;
        const name = String(observer?.get('name') || '');
        const lowerName = name.toLowerCase();
        if (lowerName === 'face' || lowerName.includes('print_surface') || lowerName.includes('face_material')) {
            return 'face';
        }

        if (lowerName === 'back' || lowerName.includes('back_material')) {
            return 'back';
        }

        if (lowerName === 'frame' || lowerName.includes('frame_material')) {
            return 'frame';
        }

        return null;
    }

    private async loadTexture(url: string, slot: string) {
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
            this.textureLoader.load(url, resolve, undefined, reject);
        });

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

    private bindEntityObserver(observer: EntityObserver) {
        const resourceId = observer.get('resource_id');
        const object = this.objectById.get(resourceId);

        if (!object || this.entityBindings.has(resourceId)) {
            return;
        }

        const handle = observer.on('*:set', (path: string) => {
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

            if (normalizedPath.startsWith('components.render')) {
                changed = applyRenderObserverChange(object, normalizedPath, observer) || changed;
                if (normalizedPath.startsWith('components.render.materialAssets') && object instanceof THREE.Mesh) {
                    changed = this.applyMaterialAssignments(object, observer) || changed;
                }
                this.applyEffectiveVisibility(resourceId, object, observer);
            }

            if (normalizedPath.startsWith('components.light') && object instanceof THREE.Light) {
                changed = applyLightObserverChange(object, normalizedPath, observer) || changed;
                this.applyEffectiveVisibility(resourceId, object, observer);
            }

            if (normalizedPath.startsWith('components.camera') && object === this.context?.camera) {
                changed = applyCameraObserverChange(this.context.camera, normalizedPath, observer) || changed;
                this.applyEffectiveVisibility(resourceId, object, observer);
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
                this.config.camera.fov = (this.context.camera as THREE.PerspectiveCamera).fov;
            }

            if (changed) {
                object.updateMatrixWorld(true);
                this.sceneDirty = true;
            }
        });

        this.entityBindings.set(resourceId, handle);
        this.applyEffectiveVisibility(resourceId, object, observer);
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
            });
        });
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

        if (object instanceof THREE.Camera) {
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

    private setObserverValue(observer: EntityObserver, path: string, value: unknown) {
        if (observer.get(path) !== value) {
            observer.set(path, value);
        }
    }

    private setObserverArray(observer: EntityObserver, path: string, value: number[]) {
        const current = observer.get(path);
        if (!arraysEqual(current || [], value)) {
            observer.set(path, cloneArray(value));
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
        const skyboxIntensity = Number(sceneSettings?.get('render.skyboxIntensity') ?? sceneEnvironmentIntensity ?? this.config.scene.envIntensity ?? 1);
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

        const sceneSettings = editor.call('sceneSettings') as { set: (path: string, value: unknown) => void } | null;
        if (sceneSettings) {
            sceneSettings.set('render.exposure', Number.isFinite(exposure) ? exposure : currentSettings.exposure);
            sceneSettings.set('render.skyboxIntensity', Number.isFinite(skyboxIntensity) ? skyboxIntensity : currentSettings.skyboxIntensity);
            sceneSettings.set('render.tonemapping', Number.isFinite(tonemapping) ? tonemapping : currentSettings.tonemapping);
            sceneSettings.set('render.gamma_correction', Number.isFinite(gammaCorrection) ? gammaCorrection : currentSettings.gamma_correction);
        }

        this.context.renderer.toneMappingExposure = Number.isFinite(exposure) ? exposure : currentSettings.exposure;
        this.context.renderer.toneMapping = (Number.isFinite(tonemapping) ? tonemapping : currentSettings.tonemapping) as THREE.ToneMapping;
        this.context.renderer.outputColorSpace = (Number.isFinite(gammaCorrection) ? gammaCorrection : currentSettings.gamma_correction) === 0
            ? THREE.LinearSRGBColorSpace
            : THREE.SRGBColorSpace;

        const sceneWithEnvironment = this.context.scene as THREE.Scene & { environmentIntensity?: number };
        if ('environmentIntensity' in sceneWithEnvironment) {
            sceneWithEnvironment.environmentIntensity = Number.isFinite(skyboxIntensity) ? skyboxIntensity : currentSettings.skyboxIntensity;
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

    private withSyncGuard(fn: () => void) {
        this.syncGuard = true;
        try {
            fn();
        } finally {
            this.syncGuard = false;
        }
    }

    private applyEffectiveVisibility(resourceId: string, object: THREE.Object3D, observer: EntityObserver) {
        let visible = !!observer.get('enabled');

        if (object instanceof THREE.Mesh && observer.has('components.render.enabled')) {
            visible = visible && !!observer.get('components.render.enabled');
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
