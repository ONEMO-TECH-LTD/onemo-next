import type { EventHandle, Observer } from '@playcanvas/observer';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { ThumbnailRenderer } from './thumbnail-renderer';

declare const editor: any;

class ModelThumbnailRenderer extends ThumbnailRenderer {
    private static readonly loader = new GLTFLoader();

    _asset: Observer | null;

    _canvas: HTMLCanvasElement | null;

    _queueRenderHandler: () => void;

    _watch: unknown;

    _rotationX: number;

    _rotationY: number;

    _queuedRender: boolean;

    _frameRequest: number | null;

    _evts: Record<string, EventHandle>;

    _materialWatches: Record<string, unknown>;

    constructor(asset: Observer, canvas: HTMLCanvasElement) {
        super();

        this._asset = asset;
        this._canvas = canvas;
        this._queueRenderHandler = this.queueRender.bind(this);
        this._watch = editor.call('assets:model:watch', {
            asset,
            autoLoad: true,
            callback: this._queueRenderHandler
        });
        this._rotationX = -15;
        this._rotationY = 45;
        this._queuedRender = false;
        this._frameRequest = null;
        this._evts = {};
        this._materialWatches = {};

        this._evts.setMaterialMappingsEvent = this._asset.on('*:set', (path: string) => {
            if (path.startsWith('data.mapping')) {
                this.queueRender();
            }
        });
    }

    _watchMaterials() {
        this._unwatchMaterials();

        const mapping = this._asset?.get('data.mapping');
        if (!mapping) {
            return;
        }

        Object.keys(mapping).forEach((key) => {
            const materialId = mapping[key].material;
            if (materialId) {
                this._watchMaterial(materialId);
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
            autoLoad: true,
            loadMaterial: true,
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
        if (this._queuedRender || !this._asset) {
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

        const modelUrl = this.resolveAssetUrl(this._asset.get('id'));
        if (!modelUrl || !/\.(?:gltf|glb)(?:$|\?)/i.test(modelUrl)) {
            this.clearCanvas(this._canvas);
            return;
        }

        this._rotationX = rotationX;
        this._rotationY = rotationY;
        this._watchMaterials();

        ModelThumbnailRenderer.loader.loadAsync(modelUrl).then((gltf) => {
            if (!this._asset || !this._canvas) {
                return;
            }

            const previewGroup = new THREE.Group();
            const sourceRoot = gltf.scene.clone(true);
            const meshList: THREE.Mesh[] = [];

            sourceRoot.traverse((child) => {
                if (!(child instanceof THREE.Mesh)) {
                    return;
                }

                const geometry = child.geometry.clone();
                const material = Array.isArray(child.material)
                    ? child.material.map(entry => entry.clone())
                    : child.material.clone();
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(child.position);
                mesh.quaternion.copy(child.quaternion);
                mesh.scale.copy(child.scale);
                previewGroup.add(mesh);
                meshList.push(mesh);
            });

            meshList.forEach((mesh, index) => {
                const materialId = this._asset?.get(`data.mapping.${index}.material`);
                if (!materialId) {
                    return;
                }

                const materialAsset = editor.call('assets:get', materialId);
                const materialData = materialAsset?.get('data');
                if (!materialData) {
                    return;
                }

                const overrideMaterial = this.createThreeMaterial(materialData);
                mesh.material = Array.isArray(mesh.material)
                    ? mesh.material.map(() => overrideMaterial.clone())
                    : overrideMaterial;
            });

            if (!meshList.length) {
                this.clearCanvas(this._canvas);
                previewGroup.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(entry => entry.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                return;
            }

            this.renderGroupToCanvas(this._canvas, previewGroup, {
                rotationX,
                rotationY,
                clearColor: 0x293538,
                clearAlpha: 0
            });

            previewGroup.traverse((child) => {
                if (!(child instanceof THREE.Mesh)) {
                    return;
                }

                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(entry => entry.dispose());
                } else {
                    child.material.dispose();
                }
            });
        }).catch(() => {
            this.clearCanvas(this._canvas);
        });
    }

    destroy() {
        if (this._watch) {
            editor.call('assets:model:unwatch', this._asset, this._watch);
            this._watch = null;
        }

        this._unwatchMaterials();

        Object.keys(this._evts).forEach((key) => {
            this._evts[key].unbind();
        });
        this._evts = {};

        if (this._frameRequest) {
            cancelAnimationFrame(this._frameRequest);
            this._frameRequest = null;
        }

        this._asset = null;
        this._canvas = null;
    }
}

export { ModelThumbnailRenderer };
