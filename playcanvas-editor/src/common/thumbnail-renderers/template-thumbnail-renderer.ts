import { Observer } from '@playcanvas/observer';

import { Asset as EditorAsset } from '@/editor-api';

import { ThumbnailRenderer } from './thumbnail-renderer';

declare const editor: any;
declare const pc: any;

const DEFAULT_FOV = 45.0;
const INV_TAN_HALF_FOV = 1 / Math.tan((DEFAULT_FOV / 2.0) * Math.PI / 180);

const calculateCameraDistance = (boundingRadius: number) => {
    return boundingRadius * INV_TAN_HALF_FOV * 1.05;
};

const calculateBoundingBoxOfMeshInstances = (meshInstances: any[]) => {
    const aabb = new pc.BoundingBox();
    let first = true;

    for (const meshInstance of meshInstances) {
        if (first) {
            aabb.copy(meshInstance.aabb);
            first = false;
        } else {
            aabb.add(meshInstance.aabb);
        }
    }

    if (first) {
        aabb.center.set(0, 0, 0);
        aabb.halfExtents.set(0.1, 0.1, 0.1);
    }

    return aabb;
};

class TemplatePreviewScene extends Observer {
    sceneRoot: any;

    templateOrigin: any;

    templateInstance?: any;

    cameraEntity: any;

    cameraOrigin: any;

    lightEntity: any;

    meshInstances: any[] | null = null;

    materialAssetIds: number[] = [];

    aabb: any = new pc.BoundingBox();

    requiredAssetLoadCount = 0;

    assetLoadedCount = 0;

    isInitialized = false;

    private _renderComponents: any[] = [];

    constructor(private readonly app: any) {
        super();
    }

    enableScene() {
        this.sceneRoot.enabled = true;
        this.sceneRoot._notifyHierarchyStateChanged(this.sceneRoot, true);
    }

    disableScene() {
        this.sceneRoot.enabled = false;
    }

    destroy() {
        this.sceneRoot.destroy();
    }

    initializePlaceholderScene() {
        this.cameraEntity = new pc.Entity();
        this.cameraOrigin = new pc.Entity();
        this.cameraEntity.addComponent('camera', {
            nearClip: 0.1,
            farClip: 32,
            clearColor: new pc.Color(41 / 255, 53 / 255, 56 / 255, 0.0),
            frustumCulling: false,
            layers: []
        });
        this.cameraEntity.setLocalPosition(0, 0, 1.35);
        this.cameraOrigin.addChild(this.cameraEntity);

        this.lightEntity = new pc.Entity();
        this.lightEntity.addComponent('light', {
            type: 'directional',
            layers: []
        });
        this.lightEntity.setLocalEulerAngles(45, 135, 0);

        this.templateOrigin = new pc.Entity();

        this.sceneRoot = new pc.Entity();
        this.sceneRoot.addChild(this.cameraOrigin);
        this.sceneRoot.addChild(this.lightEntity);
        this.sceneRoot.addChild(this.templateOrigin);
        this.sceneRoot.enabled = true;
        this.sceneRoot.syncHierarchy();
    }

    instantiateTemplate(template: any) {
        this.isInitialized = false;
        this.meshInstances = [];
        this.materialAssetIds = [];

        if (this.templateInstance) {
            this.templateOrigin.removeChild(this.templateInstance);
            this.templateInstance.destroy();
        }

        this.templateInstance = template.instantiate();
        this.templateOrigin.addChild(this.templateInstance);
        this._renderComponents = this.templateInstance.findComponents('render') || [];

        this.enableScene();
        this._renderComponents = this._renderComponents.filter((component) => component.entity.enabled);
        this.disableScene();

        this.assetLoadedCount = 0;
        this.requiredAssetLoadCount = 0;

        this._renderComponents.forEach((component: any) => {
            if (component.asset) {
                this.queueAssetLoad(component.asset);
            }

            if (component.materialAssets) {
                component.materialAssets.forEach((assetId: number) => {
                    if (assetId) {
                        this.materialAssetIds.push(assetId);
                        this.queueAssetLoad(assetId);
                    }
                });
            }
        });

        if (this.requiredAssetLoadCount === 0) {
            this.onAllAssetsLoaded();
        }
    }

    private onAllAssetsLoaded() {
        this.initializeMeshInstances();
        this.isInitialized = true;
        this.emit('loaded');
    }

    private queueAssetLoad(assetId: number) {
        if (!assetId) {
            return;
        }

        const asset = this.app.assets.get(assetId);
        if (!asset) {
            return;
        }

        this.requiredAssetLoadCount++;
        asset.ready(this.handleAssetLoad.bind(this));
        this.app.assets.load(asset);
    }

    private handleAssetLoad(asset: any) {
        this.assetLoadedCount++;

        if (asset.type === 'render') {
            const containerAssetId = asset.data.containerAsset;
            if (containerAssetId) {
                this.queueAssetLoad(containerAssetId);
            }
        }

        if (asset.type === 'material') {
            const material = asset.resource;
            if (material instanceof pc.StandardMaterial) {
                Object.keys(material._assetReferences || {}).forEach((key) => {
                    const reference = material._assetReferences[key];
                    const referencedAsset = reference?.asset;
                    if (referencedAsset instanceof pc.Asset) {
                        this.queueAssetLoad(referencedAsset.id);
                    }
                });
            }
        }

        if (this.assetLoadedCount >= this.requiredAssetLoadCount) {
            this.onAllAssetsLoaded();
        }
    }

    initializeMeshInstances() {
        this.meshInstances = [];

        this._renderComponents.forEach((renderComponent: any) => {
            renderComponent.layers = [];
            this.meshInstances?.push(...renderComponent.meshInstances);
        });

        this.aabb = calculateBoundingBoxOfMeshInstances(this.meshInstances || []);
    }
}

export class TemplateThumbnailRenderer extends ThumbnailRenderer {
    private scene: TemplatePreviewScene;

    private templateAsset: any;

    private readonly app: any;

    private requestFrameId: number | null = null;

    private rotationX = -20;

    private rotationY = 25;

    private materialWatches: Map<number, number> = new Map();

    private readonly handleQueueRender: () => void;

    private readonly handleTemplateAssetLoad: (asset: any) => void;

    private readonly handleTemplateAssetChange: (asset: any, type: string) => void;

    constructor(editorAsset: Observer,
                private canvas: HTMLCanvasElement) {
        super();

        this.app = pc.Application.getApplication();
        this.scene = new TemplatePreviewScene(this.app);
        this.scene.initializePlaceholderScene();
        this.handleQueueRender = this.queueRender.bind(this);
        this.handleTemplateAssetLoad = this.onTemplateAssetLoad.bind(this);
        this.handleTemplateAssetChange = this.onTemplateAssetChange.bind(this);
        this.templateAsset = this.app.assets.get(editorAsset.get('id'));

        if (this.templateAsset?.type === 'template') {
            this.templateAsset.on('change', this.handleTemplateAssetChange);
            this.templateAsset.ready(this.handleTemplateAssetLoad);
            this.app.assets.load(this.templateAsset);
        } else {
            console.error('No template asset was passed into the thumbnail renderer');
        }
    }

    queueRender() {
        if (this.requestFrameId !== null) {
            return;
        }

        this.requestFrameId = requestAnimationFrame(() => {
            this.render(this.rotationX, this.rotationY);
        });
    }

    private onTemplateAssetChange(_asset: any, type: string) {
        if (type === 'data') {
            requestAnimationFrame(() => {
                this.handleTemplateAssetLoad(this.templateAsset);
                this.queueRender();
            });
        }
    }

    private onTemplateAssetLoad(engineAsset: any) {
        this.scene.instantiateTemplate(engineAsset.resource);
        this.watchDependencies();
    }

    private watchDependencies() {
        this.unwatchDependencies();
        this.scene.materialAssetIds.forEach((id) => this._watchMaterial(id));
    }

    private unwatchDependencies() {
        this.materialWatches.forEach((handle, id) => {
            const asset = editor.call('assets:get', id) as EditorAsset;
            if (asset && handle) {
                editor.call('assets:material:unwatch', asset, handle);
            }
        });
        this.materialWatches.clear();
    }

    private _watchMaterial(id: number) {
        const asset = editor.call('assets:get', id) as EditorAsset;
        if (!asset) {
            return;
        }

        this.materialWatches.set(id, editor.call('assets:material:watch', {
            asset,
            loadMaterial: true,
            autoLoad: true,
            callback: this.handleQueueRender
        }));
    }

    render(rotationX: number = 0, rotationY: number = 0) {
        this.requestFrameId = null;
        this.rotationX = rotationX;
        this.rotationY = rotationY;

        if (!this.scene.isInitialized) {
            this.scene.once('loaded', this.handleQueueRender);
            return;
        }

        this.scene.enableScene();
        const meshInstances = this.scene.meshInstances || [];
        const aabb = this.scene.aabb;

        const boundingRadius = aabb.halfExtents.length();
        const cameraDistance = calculateCameraDistance(boundingRadius);

        this.scene.cameraEntity.setLocalPosition(0, 0, cameraDistance);
        this.scene.cameraEntity.camera.farClip = cameraDistance * 2.0;
        this.scene.cameraOrigin.setLocalPosition(aabb.center);
        this.scene.cameraOrigin.setLocalEulerAngles(rotationX, rotationY, 0);
        this.scene.cameraOrigin.syncHierarchy();

        meshInstances.forEach((meshInstance: any) => {
            if (meshInstance.skinInstance) {
                meshInstance.skinInstance.updateMatrices(meshInstance.node);
            }
        });

        const preview = this.createGroupFromMeshInstances(meshInstances);
        if (!preview.hasGeometry) {
            this.clearCanvas(this.canvas);
            this.emit('preview-available', false);
            this.scene.disableScene();
            return;
        }

        this.renderGroupToCanvas(this.canvas, preview.group, {
            rotationX,
            rotationY,
            clearColor: 0x293538,
            clearAlpha: 0
        });
        preview.dispose();
        this.emit('preview-available', true);
        this.scene.disableScene();
    }

    destroy() {
        if (this.requestFrameId !== null) {
            cancelAnimationFrame(this.requestFrameId);
            this.requestFrameId = null;
        }

        this.scene.unbind('loaded', this.handleQueueRender);
        this.unwatchDependencies();

        if (this.templateAsset && this.handleTemplateAssetLoad) {
            this.templateAsset.off('load', this.handleTemplateAssetLoad);
            this.templateAsset.off('change', this.handleTemplateAssetChange);
        }

        if (this.scene) {
            this.scene.destroy();
        }

        this.templateAsset = null;
        this.canvas = null!;
    }
}
