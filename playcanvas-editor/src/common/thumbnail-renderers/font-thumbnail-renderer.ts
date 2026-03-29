import type { Observer } from '@playcanvas/observer';

import { buildQueryUrl } from '../utils';
import { ThumbnailRenderer } from './thumbnail-renderer';

declare const editor: any;
declare const config: any;

const pickPreviewText = (asset: Observer) => {
    const chars = String(asset.get('meta.chars') || '');
    const filtered = Array.from(chars).filter((char) => !/\s/.test(char));

    if (filtered.length >= 2) {
        return `${filtered[0]}${filtered[1]}`;
    }

    return 'Aa';
};

const loadedFontFaces = new Map<string, Promise<string | null>>();

const loadFontFamily = (asset: Observer) => {
    const fileUrl = asset.get('file.url');
    if (typeof fileUrl !== 'string' || !fileUrl) {
        return Promise.resolve<string | null>(null);
    }

    const hash = asset.get('file.hash');
    const absoluteUrl = fileUrl.startsWith('http') ? fileUrl : `${config.url.home}${fileUrl}`;
    const url = buildQueryUrl(absoluteUrl, hash ? { t: hash } : {});
    const cached = loadedFontFaces.get(url);
    if (cached) {
        return cached;
    }

    const family = `thumbnail-font-${String(asset.get('id') ?? 'asset')}`;
    const promise = new FontFace(family, `url("${url}")`).load().then((fontFace) => {
        document.fonts.add(fontFace);
        return family;
    }).catch(() => null);

    loadedFontFaces.set(url, promise);
    return promise;
};

class FontThumbnailRenderer extends ThumbnailRenderer {
    _asset: Observer | null;

    _canvas: HTMLCanvasElement | null;

    _queueRenderHandler: () => void;

    _watch: unknown;

    _queuedRender: boolean;

    _frameRequest: number | null;

    constructor(asset: Observer, canvas: HTMLCanvasElement) {
        super();

        this._asset = asset;
        this._canvas = canvas;
        this._queueRenderHandler = this.queueRender.bind(this);
        this._watch = editor.call('assets:font:watch', {
            asset,
            autoLoad: true,
            callback: this._queueRenderHandler
        });
        this._queuedRender = false;
        this._frameRequest = null;
    }

    queueRender() {
        if (this._queuedRender || !this._asset) {
            return;
        }

        this._queuedRender = true;
        this._frameRequest = requestAnimationFrame(() => {
            this.render();
        });
    }

    async render() {
        this._queuedRender = false;

        if (!this._asset || !this._canvas) {
            return;
        }

        const ctx = this._canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        const { width, height, offsetX, offsetY } = this.getSquareRenderSize(this._canvas);
        const family = await loadFontFamily(this._asset);
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.fillStyle = 'rgba(41,53,56,0)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#f3f6f7';
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${Math.round(height * 0.48)}px "${family || 'sans-serif'}"`;
        ctx.lineWidth = Math.max(1, height * 0.02);

        const text = pickPreviewText(this._asset);
        ctx.strokeText(text, width / 2, height / 2);
        ctx.fillText(text, width / 2, height / 2);
        ctx.restore();
    }

    destroy() {
        if (this._watch) {
            editor.call('assets:font:unwatch', this._asset, this._watch);
            this._watch = null;
        }

        if (this._frameRequest) {
            cancelAnimationFrame(this._frameRequest);
            this._frameRequest = null;
        }

        this._asset = null;
        this._canvas = null;
    }
}

export { FontThumbnailRenderer };
