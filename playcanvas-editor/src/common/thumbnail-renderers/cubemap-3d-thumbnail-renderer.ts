import type { EventHandle, Observer } from '@playcanvas/observer';
import * as THREE from 'three';

import { ThumbnailRenderer } from './thumbnail-renderer';

declare const editor: any;

class Cubemap3dThumbnailRenderer extends ThumbnailRenderer {
    _asset: Observer | null;

    _canvas: HTMLCanvasElement | null;

    _queueRenderHandler: () => void;

    _rotationX: number;

    _rotationY: number;

    _mipLevel: number;

    _watch: unknown;

    _sceneSettings: Observer | null;

    _evtSceneSettings: EventHandle | null;

    _queuedRender: boolean;

    _frameRequest: number | null;

    constructor(asset: Observer, canvas: HTMLCanvasElement, sceneSettings?: Observer) {
        super();

        this._asset = asset;
        this._canvas = canvas;
        this._queueRenderHandler = this.queueRender.bind(this);
        this._rotationX = 0;
        this._rotationY = 0;
        this._mipLevel = 0;
        this._watch = editor.call('assets:cubemap:watch', {
            asset,
            autoLoad: true,
            callback: this._queueRenderHandler
        });
        this._sceneSettings = sceneSettings || editor.call('sceneSettings');
        this._evtSceneSettings = this._sceneSettings?.on('*:set', this._queueRenderHandler) || null;
        this._queuedRender = false;
        this._frameRequest = null;
    }

    queueRender() {
        if (this._queuedRender || !this._asset) {
            return;
        }

        this._queuedRender = true;
        this._frameRequest = requestAnimationFrame(() => {
            this.render(this._rotationX, this._rotationY, this._mipLevel);
        });
    }

    async render(rotationX: number = 0, rotationY: number = 0, mipLevel: number = 0) {
        this._queuedRender = false;

        if (!this._asset || !this._canvas) {
            return;
        }

        this._rotationX = rotationX;
        this._rotationY = rotationY;
        this._mipLevel = mipLevel;

        const assetIds = Array.from({ length: 6 }, (_value, index) => this._asset?.get(`data.textures.${index}`));
        const cubeTexture = await this.loadCubemapAssets(assetIds);
        if (!cubeTexture) {
            this.clearCanvas(this._canvas);
            return;
        }

        const { width, height } = this.getSquareRenderSize(this._canvas);
        const scene = new THREE.Scene();
        scene.background = cubeTexture;

        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10);
        camera.position.set(0, 0, 0.01);
        camera.rotation.order = 'YXZ';
        camera.rotation.x = THREE.MathUtils.degToRad(rotationX);
        camera.rotation.y = THREE.MathUtils.degToRad(rotationY);

        this.renderSceneToCanvas(this._canvas, scene, camera, {
            clearColor: 0x000000,
            clearAlpha: 1
        });
    }

    destroy() {
        if (this._watch) {
            editor.call('assets:cubemap:unwatch', this._asset, this._watch);
            this._watch = null;
        }

        if (this._evtSceneSettings) {
            this._evtSceneSettings.unbind();
            this._evtSceneSettings = null;
        }

        if (this._frameRequest) {
            cancelAnimationFrame(this._frameRequest);
            this._frameRequest = null;
        }

        this._asset = null;
        this._sceneSettings = null;
        this._canvas = null;
    }
}

export { Cubemap3dThumbnailRenderer };
