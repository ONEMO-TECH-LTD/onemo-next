import { Events, type EventHandle, type Observer } from '@playcanvas/observer';

import { buildQueryUrl } from '../utils';

type AssetList = {
    get: (id: number | string) => Observer | null;
};

const CENTER_PIVOT = [0.5, 0.5];

class ImageCacheEntry extends Events {
    value: HTMLImageElement;

    status: 'loading' | 'loaded';

    constructor(image: HTMLImageElement) {
        super();

        this.value = image;
        this.status = 'loading';

        image.onload = () => {
            this.status = 'loaded';
            this.emit('loaded', this);
        };
    }
}

class ImageCache {
    _items: Record<string, ImageCacheEntry>;

    constructor() {
        this._items = {};
    }

    has(key: string) {
        return !!this._items[key];
    }

    get(key: string) {
        return this.has(key) ? this._items[key] : null;
    }

    insert(key: string, image: HTMLImageElement) {
        const entry = new ImageCacheEntry(image);
        this._items[key] = entry;
        return entry;
    }
}

const imageCache = new ImageCache();

class SpriteThumbnailRenderer {
    _asset: Observer | null;

    _canvas: HTMLCanvasElement | null;

    _assets: AssetList | null;

    _queueRenderHandler: () => void;

    _watch: unknown;

    _events: EventHandle[];

    _frame: number;

    _animating: boolean;

    _queuedRender: boolean;

    _frameRequest: number | null;

    constructor(asset: Observer, canvas: HTMLCanvasElement, assetsList: AssetList) {
        this._asset = asset;
        this._canvas = canvas;
        this._assets = assetsList;
        this._queueRenderHandler = this.queueRender.bind(this);
        this._watch = editor.call('assets:sprite:watch', {
            asset,
            autoLoad: true,
            callback: this._queueRenderHandler
        });
        this._events = [];
        this._frame = 0;
        this._animating = false;
        this._queuedRender = false;
        this._frameRequest = null;
    }

    queueRender() {
        if (this._queuedRender || !this._asset) {
            return;
        }

        this._queuedRender = true;
        this._frameRequest = requestAnimationFrame(() => {
            this.render(this._frame, this._animating);
        });
    }

    render(frame: number = 0, animating: boolean = false) {
        this._queuedRender = false;
        this._frameRequest = null;

        if (!this._asset || !this._canvas || !this._assets) {
            return;
        }

        this._frame = frame;
        this._animating = animating;

        const width = this._canvas.width;
        const height = this._canvas.height;
        const frameKeys = this._asset.get('data.frameKeys');
        if (!frameKeys?.length) {
            return this._cancelRender();
        }

        const atlasId = this._asset.get('data.textureAtlasAsset');
        if (!atlasId) {
            return this._cancelRender();
        }

        const atlas = this._assets.get(atlasId);
        if (!atlas) {
            return this._cancelRender();
        }

        const frames = atlas.get('data.frames');
        if (!frames) {
            return this._cancelRender();
        }

        const frameData = frames[frameKeys[frame]];
        if (!frameData) {
            return this._cancelRender();
        }

        const ctx = this._canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        let atlasUrl = atlas.get('file.url');
        if (!atlasUrl) {
            return this._cancelRender();
        }
        atlasUrl = buildQueryUrl(atlasUrl, { t: atlas.get('file.hash') });

        let leftBound = Number.POSITIVE_INFINITY;
        let rightBound = Number.NEGATIVE_INFINITY;
        let bottomBound = Number.POSITIVE_INFINITY;
        let topBound = Number.NEGATIVE_INFINITY;

        for (let i = 0; i < frameKeys.length; i++) {
            const spriteFrame = frames[frameKeys[i]];
            if (!spriteFrame) {
                continue;
            }

            const pivot = animating ? spriteFrame.pivot : CENTER_PIVOT;
            const rect = spriteFrame.rect;

            const left = -rect[2] * pivot[0];
            const right = (1 - pivot[0]) * rect[2];
            const bottom = -rect[3] * pivot[1];
            const top = (1 - pivot[1]) * rect[3];

            leftBound = Math.min(leftBound, left);
            rightBound = Math.max(rightBound, right);
            bottomBound = Math.min(bottomBound, bottom);
            topBound = Math.max(topBound, top);
        }

        const maxWidth = rightBound - leftBound;
        const maxHeight = topBound - bottomBound;
        const x = frameData.rect[0];
        const y = (0 || atlas.get('meta.height')) - frameData.rect[1] - frameData.rect[3]; // eslint-disable-line no-constant-binary-expression
        const w = frameData.rect[2];
        const h = frameData.rect[3];
        const canvasRatio = width / height;
        const aspectRatio = maxWidth / maxHeight;

        let widthFactor = width;
        let heightFactor = height;
        if (canvasRatio > aspectRatio) {
            widthFactor = height * aspectRatio;
        } else {
            heightFactor = width / aspectRatio;
        }

        const pivot = animating ? frameData.pivot : CENTER_PIVOT;
        const left = -frameData.rect[2] * pivot[0];
        let offsetX = widthFactor * (left - leftBound) / maxWidth;
        const targetWidth = widthFactor * frameData.rect[2] / maxWidth;

        const top = (1 - pivot[1]) * frameData.rect[3];
        let offsetY = heightFactor * (1 - (top - bottomBound) / maxHeight);
        const targetHeight = heightFactor * frameData.rect[3] / maxHeight;

        offsetX += (width - widthFactor) / 2;
        offsetY += (height - heightFactor) / 2;

        ctx.clearRect(0, 0, width, height);
        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;

        let image: HTMLImageElement | null = null;
        let entry = imageCache.get(atlas.get('file.hash'));
        if (entry) {
            if (entry.status === 'loaded') {
                image = entry.value;
            } else {
                this._events.push(entry.once('loaded', () => {
                    editor.call('assets:sprite:watch:trigger', this._asset);
                }));
            }
        } else {
            image = new Image();
            image.src = atlasUrl;
            entry = imageCache.insert(atlas.get('file.hash'), image);
            this._events.push(entry.once('loaded', () => {
                editor.call('assets:sprite:watch:trigger', this._asset);
            }));
        }

        if (!image) {
            return this._cancelRender();
        }

        ctx.drawImage(image, x, y, w, h, offsetX, offsetY, targetWidth, targetHeight);
        return true;
    }

    _cancelRender() {
        this._canvas?.getContext('2d')?.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }

    destroy() {
        this._events.forEach((evt) => evt.unbind());
        this._events.length = 0;

        if (this._watch) {
            editor.call('assets:sprite:unwatch', this._asset, this._watch);
            this._watch = null;
        }

        if (this._frameRequest) {
            cancelAnimationFrame(this._frameRequest);
            this._frameRequest = null;
        }

        this._asset = null;
        this._canvas = null;
        this._assets = null;
    }
}

export { SpriteThumbnailRenderer };
