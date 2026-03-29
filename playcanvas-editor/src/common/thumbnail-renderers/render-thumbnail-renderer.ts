import type { Observer } from '@playcanvas/observer';

import { ThumbnailRenderer } from './thumbnail-renderer';

declare const editor: any;
declare const pc: any;

let previewEntity: any = null;

const ensurePreviewEntity = () => {
    if (previewEntity) {
        return previewEntity;
    }

    previewEntity = new pc.Entity('thumbnail-render-renderer');
    previewEntity.addComponent('render', {
        type: 'asset'
    });
    return previewEntity;
};

class RenderThumbnailRenderer extends ThumbnailRenderer {
    _asset: Observer | null;

    _canvas: HTMLCanvasElement | null;

    _queueRenderHandler: () => void;

    _watch: unknown;

    _materialWatches: Record<string, unknown>;

    _rotationX: number;

    _rotationY: number;

    _queuedRender: boolean;

    _frameRequest: number | null;

    constructor(asset: Observer, canvas: HTMLCanvasElement) {
        super();

        this._asset = asset;
        this._canvas = canvas;
        this._queueRenderHandler = this.queueRender.bind(this);
        this._watch = editor.call('assets:render:watch', {
            asset,
            autoLoad: true,
            callback: this._queueRenderHandler
        });
        this._materialWatches = {};
        this._rotationX = -15;
        this._rotationY = 45;
        this._queuedRender = false;
        this._frameRequest = null;
    }

    _watchMaterials() {
        const app = pc.Application.getApplication();
        const renderAsset = app.assets.get(this._asset.get('id'));
        if (!renderAsset) {
            return;
        }

        let containerAssetId;
        let containerObserver;
        let materialMappings;
        let model;

        try {
            containerAssetId = this._asset.get('data.containerAsset');
            const containerAssetObserver = editor.call('assets:get', containerAssetId);
            const sourceAssetId = containerAssetObserver.get('source_asset_id');
            containerObserver = editor.call('assets:get', sourceAssetId);
            materialMappings = containerObserver.get('meta.mappings');
            model = app.assets.get(containerAssetId)?.resource?.model?.resource;
        } catch (_error) {
            this._unwatchMaterials();
            return;
        }

        const firstMeshInstanceIndex = model?.meshInstances?.findIndex((entry: any) => entry.node.name === this._asset.get('name')) ?? -1;
        const meshInstanceCount = Number(this._asset.get('meta.meshInstances') ?? 0);
        const mappings = firstMeshInstanceIndex >= 0
            ? materialMappings.slice(firstMeshInstanceIndex, firstMeshInstanceIndex + meshInstanceCount)
            : [];
        const materialAssets = mappings.map((mappingIndex: number) => {
            const materialName = containerObserver.get(`meta.materials.${mappingIndex}.name`);
            const found = editor.call('assets:find', (asset: any) => {
                return asset.get('source_asset_id') === containerObserver.get('id').toString() &&
                    asset.get('name') === materialName &&
                    asset.get('type') === 'material';
            });

            return found.length ? found[0][1] : null;
        }).filter(Boolean);

        Object.keys(this._materialWatches).forEach((id) => {
            if (!materialAssets.find((asset: any) => Number(asset.get('id')) === Number(id))) {
                this._unwatchMaterial(id);
            }
        });

        materialAssets.forEach((asset: any) => {
            const id = Number(asset.get('id'));
            if (!this._materialWatches[id]) {
                this._watchMaterial(id);
            }
        });
    }

    _watchMaterial(id: number) {
        const material = editor.call('assets:get', id);
        if (!material) {
            return;
        }

        this._materialWatches[id] = editor.call('assets:material:watch', {
            asset: material,
            loadMaterial: true,
            autoLoad: true,
            callback: this._queueRenderHandler
        });
    }

    _unwatchMaterial(id: string | number) {
        const material = editor.call('assets:get', id);
        if (material && this._materialWatches[id]) {
            editor.call('assets:material:unwatch', material, this._materialWatches[id]);
        }
        delete this._materialWatches[id];
    }

    _unwatchMaterials() {
        Object.keys(this._materialWatches).forEach((id) => {
            this._unwatchMaterial(id);
        });
    }

    queueRender() {
        if (this._queuedRender) {
            return;
        }

        this._queuedRender = true;
        this._frameRequest = requestAnimationFrame(() => {
            this.render(this._rotationX, this._rotationY);
        });
    }

    render(rotationX: number = -15, rotationY: number = 45) {
        this._queuedRender = false;

        if (!this._asset || !this._canvas) {
            return;
        }

        const app = pc.Application.getApplication();
        const renderAsset = app.assets.get(this._asset.get('id'));
        if (!renderAsset) {
            this.clearCanvas(this._canvas);
            return;
        }

        this._rotationX = rotationX;
        this._rotationY = rotationY;
        this._watchMaterials();

        const entity = ensurePreviewEntity();
        entity.render.asset = renderAsset;

        const meshInstances = entity.render.meshInstances || [];
        if (!meshInstances.length) {
            entity.render.asset = null;
            this.clearCanvas(this._canvas);
            return;
        }

        meshInstances.forEach((meshInstance: any) => {
            if (meshInstance.skinInstance) {
                meshInstance.skinInstance.updateMatrices(meshInstance.node);
            }
        });

        const preview = this.createGroupFromMeshInstances(meshInstances);
        this.renderGroupToCanvas(this._canvas, preview.group, {
            rotationX,
            rotationY,
            clearColor: 0x293538,
            clearAlpha: 0
        });

        preview.dispose();
        entity.render.asset = null;
    }

    destroy() {
        if (this._watch) {
            editor.call('assets:render:unwatch', this._asset, this._watch);
            this._watch = null;
        }

        this._unwatchMaterials();

        if (this._frameRequest) {
            cancelAnimationFrame(this._frameRequest);
            this._frameRequest = null;
        }

        this._asset = null;
        this._canvas = null;
    }
}

export { RenderThumbnailRenderer };
