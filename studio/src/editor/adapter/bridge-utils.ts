import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

type BridgeUpdater = (delta: number) => void;

type BridgeStore = {
    componentData: Record<string, unknown>;
    helpers: Record<string, THREE.Object3D>;
    updaters: Record<string, BridgeUpdater>;
};

type LabelSpriteOptions = {
    text: string;
    textColor?: string;
    backgroundColor?: string;
    borderColor?: string;
    fontSize?: number;
    padding?: number;
    scale?: number;
    borderRadius?: number;
};

type SpriteFrameTexture = {
    texture: THREE.Texture;
    width: number;
    height: number;
    pivot: [number, number];
    pixelsPerUnit: number;
};

const STORE_KEY = '__r3fBridgeStore';
const textureLoader = new THREE.TextureLoader();
const audioLoader = new THREE.AudioLoader();
const gltfLoader = new GLTFLoader();
const plyLoader = new PLYLoader();

const textureCache = new Map<string, Promise<THREE.Texture>>();
const audioCache = new Map<string, Promise<AudioBuffer | null>>();
const animationClipCache = new Map<string, Promise<THREE.AnimationClip[]>>();
const plyGeometryCache = new Map<string, Promise<THREE.BufferGeometry | null>>();

const cloneSerializable = <T>(value: T): T => {
    return JSON.parse(JSON.stringify(value));
};

export const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getBridgeStore = (object: THREE.Object3D): BridgeStore => {
    const existing = object.userData[STORE_KEY];
    if (existing) {
        return existing as BridgeStore;
    }

    const created: BridgeStore = {
        componentData: {},
        helpers: {},
        updaters: {}
    };
    object.userData[STORE_KEY] = created;
    return created;
};

export const getStoredBridgeComponentData = <T>(object: THREE.Object3D, component: string, fallback: T): T => {
    const store = getBridgeStore(object);
    const stored = store.componentData[component];
    if (stored === undefined) {
        return cloneSerializable(fallback);
    }

    return cloneSerializable(stored as T);
};

export const setStoredBridgeComponentData = (object: THREE.Object3D, component: string, value: unknown) => {
    getBridgeStore(object).componentData[component] = cloneSerializable(value);
};

export const removeStoredBridgeComponentData = (object: THREE.Object3D, component: string) => {
    delete getBridgeStore(object).componentData[component];
};

export const getStoredBridgeComponents = (object: THREE.Object3D) => {
    return cloneSerializable(getBridgeStore(object).componentData);
};

export const ensureBridgeHelper = <T extends THREE.Object3D>(
    object: THREE.Object3D,
    key: string,
    factory: () => T,
    parent?: THREE.Object3D
) => {
    const store = getBridgeStore(object);
    const existing = store.helpers[key];
    if (existing) {
        if ((parent || object) && existing.parent !== (parent || object)) {
            (parent || object).add(existing);
        }
        return existing as T;
    }

    const helper = factory();
    (parent || object).add(helper);
    store.helpers[key] = helper;
    return helper;
};

export const getBridgeHelper = <T extends THREE.Object3D>(object: THREE.Object3D, key: string) => {
    return (getBridgeStore(object).helpers[key] || null) as T | null;
};

export const setBridgeUpdater = (object: THREE.Object3D, key: string, updater?: BridgeUpdater) => {
    const store = getBridgeStore(object);
    if (!updater) {
        delete store.updaters[key];
        return;
    }

    store.updaters[key] = updater;
};

export const runBridgeUpdaters = (object: THREE.Object3D, delta: number) => {
    const store = getBridgeStore(object);
    Object.values(store.updaters).forEach((updater) => {
        updater(delta);
    });
};

export const disposeThreeObject = (object: THREE.Object3D) => {
    object.traverse((child) => {
        const mesh = child as THREE.Mesh & {
            material?: THREE.Material | THREE.Material[];
            geometry?: THREE.BufferGeometry;
        };

        if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
            mesh.geometry.dispose();
        }

        const materials = Array.isArray(mesh.material)
            ? mesh.material
            : mesh.material
                ? [mesh.material]
                : [];
        materials.forEach((material) => {
            Object.values(material).forEach((value) => {
                if (value instanceof THREE.Texture) {
                    value.dispose();
                }
            });
            material.dispose();
        });
    });
};

export const removeBridgeHelper = (object: THREE.Object3D, key: string) => {
    const store = getBridgeStore(object);
    const helper = store.helpers[key];
    if (!helper) {
        return;
    }

    delete store.helpers[key];
    delete store.updaters[key];
    helper.parent?.remove(helper);
    disposeThreeObject(helper);
};

export const clearBridgeComponent = (object: THREE.Object3D, component: string) => {
    const store = getBridgeStore(object);
    delete store.componentData[component];

    Object.keys(store.helpers)
    .filter((key) => key === component || key.startsWith(`${component}:`))
    .forEach((key) => {
        removeBridgeHelper(object, key);
    });

    Object.keys(store.updaters)
    .filter((key) => key === component || key.startsWith(`${component}:`))
    .forEach((key) => {
        delete store.updaters[key];
    });
};

export const resolveAssetObserver = (assetId: unknown) => {
    const numericId = Number(assetId);
    if (!Number.isFinite(numericId)) {
        return null;
    }

    return editor.call('assets:get', numericId) || null;
};

export const resolveAssetUrl = (assetId: unknown) => {
    if (typeof assetId === 'string' && assetId.trim() && (assetId.startsWith('/') || assetId.startsWith('http'))) {
        return assetId.trim();
    }

    const asset = resolveAssetObserver(assetId);
    const fileUrl = asset?.get('file.url');
    return typeof fileUrl === 'string' && fileUrl ? fileUrl : null;
};

const loadTextureFromUrl = async (url: string, colorSpace: THREE.ColorSpace) => {
    let promise = textureCache.get(url);
    if (!promise) {
        promise = new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(url, resolve, undefined, reject);
        });
        textureCache.set(url, promise);
    }

    const texture = (await promise).clone();
    texture.userData.sourceUrl = url;
    texture.colorSpace = colorSpace;
    texture.needsUpdate = true;
    return texture;
};

export const loadTextureAsset = async (
    assetId: unknown,
    colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace
) => {
    const url = resolveAssetUrl(assetId);
    if (!url) {
        return null;
    }

    return loadTextureFromUrl(url, colorSpace);
};

export const loadAudioAsset = async (assetId: unknown) => {
    const url = resolveAssetUrl(assetId);
    if (!url) {
        return null;
    }

    let promise = audioCache.get(url);
    if (!promise) {
        promise = new Promise<AudioBuffer | null>((resolve) => {
            audioLoader.load(url, resolve, undefined, () => resolve(null));
        });
        audioCache.set(url, promise);
    }

    return promise;
};

const loadAnimationClipsForUrl = async (url: string) => {
    let promise = animationClipCache.get(url);
    if (!promise) {
        promise = new Promise<THREE.AnimationClip[]>((resolve) => {
            gltfLoader.load(url, (gltf) => {
                resolve(gltf.animations || []);
            }, undefined, () => resolve([]));
        });
        animationClipCache.set(url, promise);
    }

    return promise;
};

export const loadAnimationClipsForAssets = async (assetIds: unknown[]) => {
    const result = new Map<number, THREE.AnimationClip[]>();

    await Promise.all(assetIds.map(async (assetId) => {
        const numericId = Number(assetId);
        if (!Number.isFinite(numericId)) {
            return;
        }

        const url = resolveAssetUrl(numericId);
        if (!url) {
            result.set(numericId, []);
            return;
        }

        result.set(numericId, await loadAnimationClipsForUrl(url));
    }));

    return result;
};

export const loadPlyGeometryAsset = async (assetId: unknown) => {
    const url = resolveAssetUrl(assetId);
    if (!url) {
        return null;
    }

    let promise = plyGeometryCache.get(url);
    if (!promise) {
        promise = new Promise<THREE.BufferGeometry | null>((resolve) => {
            plyLoader.load(url, (geometry) => {
                resolve(geometry);
            }, undefined, () => resolve(null));
        });
        plyGeometryCache.set(url, promise);
    }

    const geometry = await promise;
    return geometry ? geometry.clone() : null;
};

export const loadSpriteFrameTexture = async (assetId: unknown, frameIndex = 0): Promise<SpriteFrameTexture | null> => {
    const asset = resolveAssetObserver(assetId);
    if (!asset) {
        return null;
    }

    const atlasId = asset.get('data.textureAtlasAsset');
    const atlasAsset = resolveAssetObserver(atlasId);
    if (!atlasAsset) {
        return null;
    }

    const atlasTexture = await loadTextureAsset(atlasAsset.get('id'));
    if (!atlasTexture) {
        return null;
    }

    const frameKeys = asset.get('data.frameKeys') || [];
    const clampedFrameIndex = THREE.MathUtils.clamp(frameIndex, 0, Math.max(frameKeys.length - 1, 0));
    const frameKey = frameKeys[clampedFrameIndex] ?? frameKeys[0];
    const frames = atlasAsset.get('data.frames') || {};
    const frameData = frames?.[frameKey] || atlasAsset.get(`data.frames.${frameKey}`) || {};
    const rect = Array.isArray(frameData?.rect)
        ? frameData.rect
        : [0, 0, Number(atlasAsset.get('meta.width') || 1), Number(atlasAsset.get('meta.height') || 1)];
    const pivot = Array.isArray(frameData?.pivot)
        ? [Number(frameData.pivot[0] ?? 0.5), Number(frameData.pivot[1] ?? 0.5)] as [number, number]
        : [0.5, 0.5] as [number, number];
    const atlasWidth = Number(atlasAsset.get('meta.width') || rect[2] || 1);
    const atlasHeight = Number(atlasAsset.get('meta.height') || rect[3] || 1);

    atlasTexture.repeat.set(
        Number(rect[2] || 1) / atlasWidth,
        Number(rect[3] || 1) / atlasHeight
    );
    atlasTexture.offset.set(
        Number(rect[0] || 0) / atlasWidth,
        1 - ((Number(rect[1] || 0) + Number(rect[3] || 1)) / atlasHeight)
    );
    atlasTexture.wrapS = THREE.ClampToEdgeWrapping;
    atlasTexture.wrapT = THREE.ClampToEdgeWrapping;
    atlasTexture.needsUpdate = true;

    return {
        texture: atlasTexture,
        width: Number(rect[2] || 1),
        height: Number(rect[3] || 1),
        pivot,
        pixelsPerUnit: Number(asset.get('data.pixelsPerUnit') || 100)
    };
};

const createRectPoints = (width: number, height: number, pivot: [number, number] = [0.5, 0.5]) => {
    const safeWidth = Math.max(0.001, width);
    const safeHeight = Math.max(0.001, height);
    const left = -safeWidth * pivot[0];
    const right = safeWidth * (1 - pivot[0]);
    const bottom = -safeHeight * pivot[1];
    const top = safeHeight * (1 - pivot[1]);

    return [
        new THREE.Vector3(left, bottom, 0),
        new THREE.Vector3(right, bottom, 0),
        new THREE.Vector3(right, top, 0),
        new THREE.Vector3(left, top, 0),
        new THREE.Vector3(left, bottom, 0)
    ];
};

export const createRectangleOutline = (
    width: number,
    height: number,
    color: THREE.ColorRepresentation,
    dashed = false,
    pivot: [number, number] = [0.5, 0.5]
) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(createRectPoints(width, height, pivot));
    const material = dashed
        ? new THREE.LineDashedMaterial({
            color,
            dashSize: 0.08,
            gapSize: 0.05,
            transparent: true,
            opacity: 0.85
        })
        : new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9
        });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
};

export const updateRectangleOutline = (
    line: THREE.Line,
    width: number,
    height: number,
    pivot: [number, number] = [0.5, 0.5]
) => {
    line.geometry.setFromPoints(createRectPoints(width, height, pivot));
    line.computeLineDistances();
    line.geometry.computeBoundingSphere();
};

const getLabelCanvas = (sprite: THREE.Sprite) => {
    const existing = sprite.userData.labelCanvas;
    if (existing instanceof HTMLCanvasElement) {
        return existing;
    }

    const canvas = document.createElement('canvas');
    sprite.userData.labelCanvas = canvas;
    return canvas;
};

export const updateLabelSprite = (sprite: THREE.Sprite, options: LabelSpriteOptions) => {
    const canvas = getLabelCanvas(sprite);
    const context = canvas.getContext('2d');
    if (!context) {
        return sprite;
    }

    const fontSize = options.fontSize ?? 36;
    const padding = options.padding ?? 18;
    const borderRadius = options.borderRadius ?? 16;
    const scale = options.scale ?? 0.01;

    context.font = `${fontSize}px sans-serif`;
    const textMetrics = context.measureText(options.text);
    const width = Math.ceil(textMetrics.width + padding * 2);
    const height = Math.ceil(fontSize + padding * 2);

    canvas.width = width;
    canvas.height = height;

    context.clearRect(0, 0, width, height);
    context.fillStyle = options.backgroundColor ?? 'rgba(10, 14, 22, 0.82)';
    context.strokeStyle = options.borderColor ?? 'rgba(255, 255, 255, 0.75)';
    context.lineWidth = 2;

    context.beginPath();
    context.moveTo(borderRadius, 0);
    context.lineTo(width - borderRadius, 0);
    context.quadraticCurveTo(width, 0, width, borderRadius);
    context.lineTo(width, height - borderRadius);
    context.quadraticCurveTo(width, height, width - borderRadius, height);
    context.lineTo(borderRadius, height);
    context.quadraticCurveTo(0, height, 0, height - borderRadius);
    context.lineTo(0, borderRadius);
    context.quadraticCurveTo(0, 0, borderRadius, 0);
    context.closePath();
    context.fill();
    context.stroke();

    context.font = `${fontSize}px sans-serif`;
    context.fillStyle = options.textColor ?? '#ffffff';
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    context.fillText(options.text, width / 2, height / 2 + 1);

    const texture = sprite.material.map instanceof THREE.Texture
        ? sprite.material.map
        : new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    sprite.material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });
    sprite.scale.set(width * scale, height * scale, 1);
    return sprite;
};

export const ensureLabelSprite = (object: THREE.Object3D, key: string, options: LabelSpriteOptions) => {
    const sprite = ensureBridgeHelper(object, key, () => {
        return new THREE.Sprite(new THREE.SpriteMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false
        }));
    });

    updateLabelSprite(sprite as THREE.Sprite, options);
    return sprite as THREE.Sprite;
};

export const readNumber = (value: unknown, fallback: number) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export const readBoolean = (value: unknown, fallback = false) => {
    return typeof value === 'boolean' ? value : fallback;
};

export const readVec2 = (value: unknown, fallback: [number, number]): [number, number] => {
    if (!Array.isArray(value)) {
        return [...fallback] as [number, number];
    }

    return [
        readNumber(value[0], fallback[0]),
        readNumber(value[1], fallback[1])
    ];
};

export const readVec3 = (value: unknown, fallback: [number, number, number]): [number, number, number] => {
    if (!Array.isArray(value)) {
        return [...fallback] as [number, number, number];
    }

    return [
        readNumber(value[0], fallback[0]),
        readNumber(value[1], fallback[1]),
        readNumber(value[2], fallback[2])
    ];
};

export const readVec4 = (value: unknown, fallback: [number, number, number, number]): [number, number, number, number] => {
    if (!Array.isArray(value)) {
        return [...fallback] as [number, number, number, number];
    }

    return [
        readNumber(value[0], fallback[0]),
        readNumber(value[1], fallback[1]),
        readNumber(value[2], fallback[2]),
        readNumber(value[3], fallback[3])
    ];
};

export const readColor3 = (value: unknown, fallback: [number, number, number] = [1, 1, 1]) => {
    const [r, g, b] = readVec3(value, fallback);
    return new THREE.Color(
        THREE.MathUtils.clamp(r, 0, 1),
        THREE.MathUtils.clamp(g, 0, 1),
        THREE.MathUtils.clamp(b, 0, 1)
    );
};

export const readColor4 = (value: unknown, fallback: [number, number, number, number] = [1, 1, 1, 1]) => {
    return readVec4(value, fallback);
};

const normalizeCurveChannel = (channel: unknown): number[] => {
    if (!Array.isArray(channel)) {
        return [];
    }

    if (channel.length > 0 && typeof channel[0] === 'number') {
        return channel.map((entry) => readNumber(entry, 0));
    }

    if (channel.length > 0 && Array.isArray(channel[0])) {
        return (channel as unknown[][]).flatMap((entry) => {
            return [
                readNumber(entry[0], 0),
                readNumber(entry[1], 0)
            ];
        });
    }

    return [];
};

const sampleCurveArray = (keys: number[], alpha: number, fallback: number) => {
    if (keys.length < 2) {
        return fallback;
    }

    if (keys.length === 2) {
        return readNumber(keys[1], fallback);
    }

    for (let i = 0; i <= keys.length - 4; i += 2) {
        const t0 = readNumber(keys[i], 0);
        const v0 = readNumber(keys[i + 1], fallback);
        const t1 = readNumber(keys[i + 2], 1);
        const v1 = readNumber(keys[i + 3], v0);

        if (alpha <= t0) {
            return v0;
        }

        if (alpha <= t1) {
            const range = Math.max(0.0001, t1 - t0);
            const localAlpha = (alpha - t0) / range;
            return THREE.MathUtils.lerp(v0, v1, localAlpha);
        }
    }

    return readNumber(keys[keys.length - 1], fallback);
};

export const sampleCurve = (graph: unknown, alpha: number, fallback: number) => {
    if (!isRecord(graph)) {
        return fallback;
    }

    const keys = normalizeCurveChannel(graph.keys);
    return sampleCurveArray(keys, alpha, fallback);
};

export const sampleCurveSet = (
    graph: unknown,
    alpha: number,
    fallback: [number, number, number]
): [number, number, number] => {
    if (!isRecord(graph) || !Array.isArray(graph.keys)) {
        return [...fallback] as [number, number, number];
    }

    const channels = graph.keys as unknown[];
    return [
        sampleCurveArray(normalizeCurveChannel(channels[0]), alpha, fallback[0]),
        sampleCurveArray(normalizeCurveChannel(channels[1]), alpha, fallback[1]),
        sampleCurveArray(normalizeCurveChannel(channels[2]), alpha, fallback[2])
    ];
};
