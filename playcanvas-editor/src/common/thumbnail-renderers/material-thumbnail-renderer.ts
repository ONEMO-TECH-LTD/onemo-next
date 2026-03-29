import type { EventHandle, Observer } from '@playcanvas/observer';
import * as THREE from 'three';

import { ThumbnailRenderer } from './thumbnail-renderer';

declare const editor: any;
declare const pc: any;

class MaterialThumbnailRenderer extends ThumbnailRenderer {
    _asset: Observer | null;

    _canvas: HTMLCanvasElement | null;

    _queueRenderHandler: () => void;

    _watch: unknown;

    _queuedRender: boolean;

    _rotationX: number;

    _rotationY: number;

    _model: 'sphere' | 'box';

    _evtSceneSettingsSet: EventHandle | null;

    _frameRequest: number | null;

    constructor(asset: Observer, canvas: HTMLCanvasElement, sceneSettings?: Observer) {
        super();

        this._asset = asset;
        this._canvas = canvas;
        this._queueRenderHandler = this.queueRender.bind(this);
        this._watch = editor.call('assets:material:watch', {
            asset,
            autoLoad: true,
            callback: this._queueRenderHandler
        });
        this._queuedRender = false;
        this._rotationX = 0;
        this._rotationY = 0;
        this._model = 'sphere';
        this._frameRequest = null;
        this._evtSceneSettingsSet = sceneSettings?.on('*:set', this._queueRenderHandler) || null;
    }

    queueRender() {
        if (this._queuedRender || !this._asset) {
            return;
        }

        this._queuedRender = true;
        this._frameRequest = requestAnimationFrame(() => {
            this.render(this._rotationX, this._rotationY, this._model);
        });
    }

    async render(rotationX: number = 0, rotationY: number = 0, model: 'sphere' | 'box' = 'sphere') {
        this._queuedRender = false;

        if (!this._asset || !this._canvas) {
            return;
        }

        this._rotationX = rotationX;
        this._rotationY = rotationY;
        this._model = model;

        const data = this._asset.get('data');
        if (!data) {
            this.clearCanvas(this._canvas);
            return;
        }

        const material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(
                data.diffuse?.[0] ?? 0.8,
                data.diffuse?.[1] ?? 0.8,
                data.diffuse?.[2] ?? 0.8
            ),
            emissive: new THREE.Color(
                data.emissive?.[0] ?? 0,
                data.emissive?.[1] ?? 0,
                data.emissive?.[2] ?? 0
            ),
            emissiveIntensity: Number(data.emissiveIntensity ?? 1),
            metalness: THREE.MathUtils.clamp(Number(data.metalness ?? 0), 0, 1),
            roughness: data.roughness !== undefined
                ? THREE.MathUtils.clamp(Number(data.roughness), 0, 1)
                : THREE.MathUtils.clamp(1 - (Number(data.shininess ?? 50) / 100), 0, 1),
            clearcoat: THREE.MathUtils.clamp(Number(data.clearcoat ?? data.clearCoat ?? 0), 0, 1),
            clearcoatRoughness: THREE.MathUtils.clamp(Number(data.clearcoatRoughness ?? 0), 0, 1),
            opacity: Number(data.opacity ?? 1),
            transparent: Number(data.opacity ?? 1) < 1,
            side: THREE.DoubleSide
        });

        const diffuseMapAssetId = data.diffuseMap || data.baseColorMap || data.colorMap;
        const normalMapAssetId = data.normalMap;

        const [diffuseMap, normalMap] = await Promise.all([
            this.loadTextureAsset(diffuseMapAssetId),
            this.loadTextureAsset(normalMapAssetId, THREE.NoColorSpace)
        ]);

        if (diffuseMap) {
            material.map = diffuseMap;
        }

        if (normalMap) {
            material.normalMap = normalMap;
        }

        const geometry = model === 'box'
            ? new THREE.BoxGeometry(0.9, 0.9, 0.9)
            : new THREE.SphereGeometry(0.55, 48, 32);
        const mesh = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        group.add(mesh);

        this.renderGroupToCanvas(this._canvas, group, {
            rotationX,
            rotationY,
            clearColor: 0x293538,
            clearAlpha: 0
        });

        geometry.dispose();
        material.dispose();
    }

    destroy() {
        if (this._watch) {
            editor.call('assets:material:unwatch', this._asset, this._watch);
            this._watch = null;
        }

        if (this._evtSceneSettingsSet) {
            this._evtSceneSettingsSet.unbind();
            this._evtSceneSettingsSet = null;
        }

        if (this._frameRequest) {
            cancelAnimationFrame(this._frameRequest);
            this._frameRequest = null;
        }

        this._asset = null;
        this._canvas = null;
    }
}

export { MaterialThumbnailRenderer };
