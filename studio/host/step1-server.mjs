import http from 'node:http';
import { Duplex } from 'node:stream';
import { createReadStream, existsSync } from 'node:fs';
import { access, mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ShareDB from 'sharedb';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const editorRoot = path.resolve(__dirname, '..');
const distRoot = path.join(editorRoot, 'dist');
const engineRoot = path.join(editorRoot, 'vendor', 'playcanvas');
const scenesRoot = path.join(editorRoot, 'data', 'scenes');
const worktreeRoot = path.resolve(editorRoot, '..');
const publicRoot = path.join(worktreeRoot, 'public');
const assetsRoot = path.join(publicRoot, 'assets');

const PORT = Number(process.env.PORT || 3487);
const HOST = process.env.HOST || '127.0.0.1';
const ORIGIN = `http://${HOST}:${PORT}`;
// Local dev fixture values only.
const PROJECT_ID = 917469;
const OWNER_ID = 171953;
const BRANCH_ID = '8cfb5a07-1d7e-44af-bee1-68e7a148ae06';
const SCENE_ID = '1';
const SCENE_UNIQUE_ID = '1';
const ROOT_ENTITY_ID = '00000000-0000-0000-0000-000000000001';

const USERNAME = 'studio-user';
const FULL_NAME = 'Studio User';
const DEFAULT_TIP_FLAGS = {
    mainMenu: true,
    hierarchy: true,
    dashboard: true,
    assets: true,
    store: true,
    controls: true,
    entityInspector: true,
    soundComponent: true,
    howdoi: true
};

const DEFAULT_DISK_ALLOWANCE_BYTES = 10 * 1024 * 1024 * 1024;
const DEFAULT_UPLOAD_FOLDER = 'uploads';
const TRANSPARENT_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nWb0AAAAASUVORK5CYII=',
    'base64'
);
const ASSET_TYPE_BY_EXTENSION = new Map([
    ['.glb', 'container'],
    ['.gltf', 'container'],
    ['.hdr', 'texture'],
    ['.exr', 'texture'],
    ['.png', 'texture'],
    ['.jpg', 'texture'],
    ['.jpeg', 'texture']
]);

let assetRegistry = [];
const assetById = new Map();
const folderByRelativeDir = new Map();
let nextAssetId = 1;

const backend = new ShareDB();

class WsJsonStream extends Duplex {
    constructor(ws) {
        super({ objectMode: true });

        this.ws = ws;
        this.isServer = true;

        ws.on('close', () => {
            this.push(null);
            this.end();
        });

        ws.on('error', (error) => {
            this.destroy(error);
        });
    }

    _read() {}

    _write(chunk, _encoding, callback) {
        try {
            if (this.ws.readyState === this.ws.OPEN) {
                this.ws.send(JSON.stringify(chunk));
            }
            callback();
        } catch (error) {
            callback(error);
        }
    }
}

function normalizeAssetDirectory(value = '') {
    if (!value || value === '.') {
        return '';
    }

    return value
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

function splitAssetDirectory(value = '') {
    const normalized = normalizeAssetDirectory(value);
    return normalized ? normalized.split('/') : [];
}

function extensionForFilename(filename = '') {
    return path.extname(filename).toLowerCase();
}

function inferAssetType(filename = '', requestedType = '') {
    const extension = extensionForFilename(filename);
    const inferred = ASSET_TYPE_BY_EXTENSION.get(extension);
    if (inferred) {
        return inferred;
    }

    if (requestedType === 'scene') {
        return 'container';
    }

    if (requestedType) {
        return requestedType;
    }

    return 'binary';
}

function sanitizeUploadFilename(filename = '') {
    const safeName = path.basename(String(filename || '').trim()).replace(/[^\w.-]+/g, '-');
    return safeName.replace(/^-+|-+$/g, '') || `upload-${Date.now()}`;
}

function coerceNumber(value, fallback = null) {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBooleanField(value, fallback = true) {
    if (typeof value !== 'string') {
        return fallback;
    }

    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    return fallback;
}

function parseJsonField(value, fallback) {
    if (typeof value !== 'string' || !value.trim()) {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function parseTagsField(value) {
    if (typeof value !== 'string') {
        return [];
    }

    return value
    .split(/\r?\n/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

function assetRequestHeaders(headers) {
    const result = new Headers();

    Object.entries(headers).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((entry) => {
                if (entry !== undefined) {
                    result.append(key, entry);
                }
            });
            return;
        }

        if (value !== undefined) {
            result.set(key, value);
        }
    });

    return result;
}

async function readMultipartFormData(req) {
    const request = new Request(`${ORIGIN}${req.url}`, {
        method: req.method,
        headers: assetRequestHeaders(req.headers),
        body: req,
        duplex: 'half'
    });

    return request.formData();
}

function clonePathIds(pathIds = []) {
    return [...pathIds];
}

function createAssetRecord({
    name,
    type,
    relativeDir = '',
    pathIds,
    file = null,
    data = {},
    preload = true,
    tags = [],
    source = false,
    sourceAssetId = null,
    createdAt = new Date().toISOString()
}) {
    const normalizedDir = normalizeAssetDirectory(relativeDir);
    const id = nextAssetId++;

    return {
        id,
        uniqueId: id,
        name,
        type,
        path: clonePathIds(pathIds || []),
        relativeDir: normalizedDir,
        file,
        data,
        preload,
        tags,
        source,
        source_asset_id: sourceAssetId,
        scope: {
            type: 'project',
            id: PROJECT_ID
        },
        has_thumbnail: false,
        createdAt
    };
}

function registerAsset(asset) {
    assetRegistry.push(asset);
    assetById.set(asset.id, asset);

    if (asset.type === 'folder') {
        folderByRelativeDir.set(asset.relativeDir, asset);
    }

    return asset;
}

function resetAssetRegistry() {
    assetRegistry = [];
    assetById.clear();
    folderByRelativeDir.clear();
    nextAssetId = 1;
}

async function ensureFolderAsset(relativeDir) {
    const normalizedDir = normalizeAssetDirectory(relativeDir);
    if (!normalizedDir) {
        return null;
    }

    const existing = folderByRelativeDir.get(normalizedDir);
    if (existing) {
        return existing;
    }

    const parentDir = splitAssetDirectory(normalizedDir).slice(0, -1).join('/');
    await ensureFolderAsset(parentDir);

    return registerAsset(createAssetRecord({
        name: path.posix.basename(normalizedDir),
        type: 'folder',
        relativeDir: normalizedDir,
        pathIds: parentDir ? [...folderByRelativeDir.get(parentDir).path, folderByRelativeDir.get(parentDir).id] : [],
        file: null,
        data: {},
        preload: true
    }));
}

function serializeAsset(asset) {
    return {
        id: asset.id,
        uniqueId: asset.uniqueId,
        name: asset.name,
        type: asset.type,
        path: clonePathIds(asset.path),
        file: asset.file ? {
            ...asset.file
        } : null,
        data: asset.data || {},
        preload: asset.preload !== false,
        tags: [...(asset.tags || [])],
        source: asset.source === true,
        source_asset_id: asset.source_asset_id ?? null,
        has_thumbnail: !!asset.has_thumbnail,
        scope: asset.scope,
        createdAt: asset.createdAt
    };
}

async function registerFileAsset(filePath, relativeDir, options = {}) {
    const stats = await stat(filePath);
    const filename = path.basename(filePath);
    const normalizedDir = normalizeAssetDirectory(relativeDir);
    const folder = await ensureFolderAsset(normalizedDir);
    const relativeUrl = normalizedDir
        ? `/assets/${normalizedDir}/${filename}`
        : `/assets/${filename}`;
    const pathIds = folder ? [...folder.path, folder.id] : [];

    const asset = registerAsset(createAssetRecord({
        name: options.name || filename,
        type: options.type || inferAssetType(filename, options.requestedType),
        relativeDir: normalizedDir,
        pathIds,
        file: {
            url: relativeUrl,
            filename,
            size: stats.size
        },
        data: options.data || {},
        preload: options.preload ?? true,
        tags: options.tags || [],
        source: false,
        sourceAssetId: options.sourceAssetId ?? null,
        createdAt: options.createdAt || new Date().toISOString()
    }));

    if (folder) {
        asset.folderId = folder.id;
    }

    asset.absolutePath = filePath;
    return asset;
}

async function scanAssetsDirectory(directoryPath, relativeDir = '') {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    entries.sort((left, right) => {
        const typeWeight = Number(right.isDirectory()) - Number(left.isDirectory());
        if (typeWeight !== 0) {
            return typeWeight;
        }

        return left.name.localeCompare(right.name);
    });

    for (const entry of entries) {
        const absolutePath = path.join(directoryPath, entry.name);
        const nextRelativeDir = normalizeAssetDirectory(relativeDir
            ? path.posix.join(relativeDir, entry.name)
            : entry.name);

        if (entry.isDirectory()) {
            await ensureFolderAsset(nextRelativeDir);
            await scanAssetsDirectory(absolutePath, nextRelativeDir);
            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        await registerFileAsset(absolutePath, relativeDir);
    }
}

async function initializeAssetRegistry() {
    resetAssetRegistry();
    await mkdir(assetsRoot, { recursive: true });
    await scanAssetsDirectory(assetsRoot);
}

function getAssetById(id) {
    return assetById.get(id) || null;
}

function assetDetailRoute(pathname) {
    const match = pathname.match(/^\/api\/assets\/(\d+)$/);
    return match ? Number(match[1]) : null;
}

function assetFileRoute(pathname) {
    const match = pathname.match(/^\/api\/assets\/(\d+)\/file\/[^/]+$/);
    return match ? Number(match[1]) : null;
}

async function uniqueUploadPath(targetDir, filename) {
    const extension = path.extname(filename);
    const basename = extension ? filename.slice(0, -extension.length) : filename;
    let counter = 0;

    while (true) {
        const candidate = counter === 0
            ? filename
            : `${basename}-${counter}${extension}`;
        const candidatePath = path.join(targetDir, candidate);

        if (!existsSync(candidatePath)) {
            return {
                filename: candidate,
                filePath: candidatePath
            };
        }

        counter++;
        if (counter > 10000) {
            const fallbackName = `${Date.now()}-${filename}`;
            return {
                filename: fallbackName,
                filePath: path.join(targetDir, fallbackName)
            };
        }
    }
}

function resolveUploadDirectory(parentId) {
    const folder = getAssetById(coerceNumber(parentId));
    if (folder && folder.type === 'folder') {
        return folder.relativeDir;
    }

    return DEFAULT_UPLOAD_FOLDER;
}

async function createUploadedAsset(formData) {
    const fileEntry = formData.get('file');
    if (!(fileEntry instanceof File)) {
        throw new Error('Multipart upload requires a file field');
    }

    const relativeDir = resolveUploadDirectory(formData.get('parent'));
    const targetDir = path.join(assetsRoot, ...splitAssetDirectory(relativeDir));
    await mkdir(targetDir, { recursive: true });
    await ensureFolderAsset(relativeDir);

    const requestedFilename = sanitizeUploadFilename(
        typeof formData.get('filename') === 'string' ? formData.get('filename') : fileEntry.name
    );
    const { filename, filePath } = await uniqueUploadPath(targetDir, requestedFilename);
    const payload = Buffer.from(await fileEntry.arrayBuffer());
    await writeFile(filePath, payload);

    const asset = await registerFileAsset(filePath, relativeDir, {
        name: typeof formData.get('name') === 'string' ? formData.get('name') : filename,
        requestedType: typeof formData.get('type') === 'string' ? formData.get('type') : '',
        data: parseJsonField(formData.get('data'), {}),
        preload: true,
        tags: parseTagsField(formData.get('tags')),
        sourceAssetId: coerceNumber(formData.get('source_asset_id'))
    });

    return asset;
}

function json(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(body));
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

function mimeType(filePath) {
    if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
    if (filePath.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
    if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
    if (filePath.endsWith('.svg')) return 'image/svg+xml';
    if (filePath.endsWith('.gif')) return 'image/gif';
    if (filePath.endsWith('.glb')) return 'model/gltf-binary';
    if (filePath.endsWith('.gltf')) return 'model/gltf+json; charset=utf-8';
    if (filePath.endsWith('.png')) return 'image/png';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
    if (filePath.endsWith('.hdr') || filePath.endsWith('.exr')) return 'application/octet-stream';
    if (filePath.endsWith('.wasm')) return 'application/wasm';
    if (filePath.endsWith('.d.ts')) return 'text/plain; charset=utf-8';
    return 'application/octet-stream';
}

async function sendFile(res, filePath) {
    try {
        await access(filePath);
    } catch {
        text(res, 404, 'Not found');
        return;
    }

    res.writeHead(200, {
        'Content-Type': mimeType(filePath),
        'Cache-Control': 'no-store'
    });

    createReadStream(filePath).pipe(res);
}

async function proxyRemote(res, remotePath, fallbackPaths = []) {
    const paths = [remotePath, ...fallbackPaths];

    for (const candidate of paths) {
        const target = new URL(candidate, 'https://playcanvas.com');

        try {
            const response = await fetch(target);
            if (!response.ok) {
                continue;
            }

            const body = Buffer.from(await response.arrayBuffer());
            const headers = {};
            ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified'].forEach((header) => {
                const value = response.headers.get(header);
                if (value) {
                    headers[header] = value;
                }
            });

            res.writeHead(200, headers);
            res.end(body);
            return true;
        } catch (_error) {
            // Try the next fallback path.
        }
    }

    return false;
}

function setting(type, defaultValue, scope, extra = {}) {
    return {
        $type: type,
        $default: defaultValue,
        $scope: scope,
        ...extra
    };
}

function sanitizeSceneName(name) {
    const normalized = String(name || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-{2,}/g, '-');
    return normalized.replace(/^-+|-+$/g, '') || 'scene';
}

function sceneNameFromPath(pathname) {
    if (!pathname.startsWith('/api/onemo/scenes/')) {
        return null;
    }

    const rawName = pathname.slice('/api/onemo/scenes/'.length);
    if (!rawName) {
        return null;
    }

    try {
        return decodeURIComponent(rawName);
    } catch {
        return rawName;
    }
}

function toSceneFilePaths(name) {
    const safeName = sanitizeSceneName(name);
    return {
        safeName,
        onemoPath: path.join(scenesRoot, `${safeName}.onemo`),
        legacyPath: path.join(scenesRoot, `${safeName}.json`)
    };
}

async function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;

        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > 5 * 1024 * 1024) {
                reject(new Error('Request body exceeds 5MB limit'));
                req.destroy();
                return;
            }

            chunks.push(chunk);
        });

        req.on('end', () => {
            if (!chunks.length) {
                resolve(null);
                return;
            }

            try {
                const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                resolve(body);
            } catch {
                reject(new Error('Invalid JSON body'));
            }
        });

        req.on('error', reject);
    });
}

async function readBinaryBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;

        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > 20 * 1024 * 1024) {
                reject(new Error('Request body exceeds 20MB limit'));
                req.destroy();
                return;
            }

            chunks.push(chunk);
        });

        req.on('end', () => {
            resolve(chunks.length ? Buffer.concat(chunks) : null);
        });

        req.on('error', reject);
    });
}

function createSchema() {
    return {
        settings: {
            width: setting('number', 1280, 'project'),
            height: setting('number', 720, 'project'),
            antiAlias: setting('boolean', true, 'project'),
            fillMode: setting('string', 'FILL_WINDOW', 'project'),
            resolutionMode: setting('string', 'AUTO', 'project'),
            use3dPhysics: setting('boolean', false, 'project'),
            enableWebGpu: setting('boolean', false, 'project'),
            enableWebGl2: setting('boolean', true, 'project'),
            powerPreference: setting('string', 'high-performance', 'project'),
            preserveDrawingBuffer: setting('boolean', false, 'project'),
            transparentCanvas: setting('boolean', false, 'project'),
            useDevicePixelRatio: setting('boolean', false, 'project'),
            useLegacyScripts: setting('boolean', false, 'project'),
            loadingScreenScript: setting('string', null, 'project', { $allowNull: true }),
            importMap: setting('string', null, 'project', { $allowNull: true }),
            externalScripts: setting(['string'], [], 'project'),
            scripts: setting(['number'], [], 'project'),
            batchGroups: setting('map', {}, 'project'),
            layers: setting('map', {}, 'project'),
            layerOrder: setting([{
                layer: { $type: 'number' },
                transparent: { $type: 'boolean' },
                enabled: { $type: 'boolean' }
            }], [], 'project'),
            i18nAssets: setting(['number'], [], 'project'),
            useLegacyAmmoPhysics: setting('boolean', false, 'project'),
            vr: setting('boolean', false, 'project'),
            useKeyboard: setting('boolean', true, 'project'),
            useMouse: setting('boolean', true, 'project'),
            useTouch: setting('boolean', true, 'project'),
            useGamepads: setting('boolean', false, 'project'),
            maxAssetRetries: setting('number', 0, 'project'),
            editor: {
                gridDivisions: setting('number', 8, 'projectUser'),
                gridDivisionSize: setting('number', 1, 'projectUser'),
                snapIncrement: setting('number', 1, 'projectUser'),
                cameraGrabDepth: setting('boolean', false, 'projectUser'),
                cameraGrabColor: setting('boolean', false, 'projectUser'),
                cameraNearClip: setting('number', 0.1, 'projectUser'),
                cameraFarClip: setting('number', 1000, 'projectUser'),
                cameraClearColor: setting(['number'], [0.118, 0.118, 0.118, 1], 'projectUser', { $length: 4 }),
                cameraToneMapping: setting('number', 0, 'projectUser'),
                cameraGammaCorrection: setting('number', 1, 'projectUser'),
                showFog: setting('boolean', true, 'projectUser'),
                showViewCube: setting('boolean', true, 'user'),
                viewCubeSize: setting('number', 1, 'user'),
                gizmoSize: setting('number', 1, 'user'),
                gizmoPreset: setting('string', 'default', 'user'),
                showSkeleton: setting('boolean', false, 'projectUser'),
                iconSize: setting('number', 1, 'projectUser'),
                locale: setting('string', 'en-US', 'projectUser'),
                zoomSensitivity: setting('number', 1, 'user'),
                lastSelectedFontId: setting('number', -1, 'projectUser'),
                launchReleaseCandidate: setting('boolean', false, 'projectUser'),
                launchDebug: setting('boolean', false, 'projectUser'),
                launchMinistats: setting('boolean', false, 'projectUser'),
                renameDuplicatedEntities: setting('boolean', true, 'projectUser'),
                lightmapperAutoBake: setting('boolean', false, 'projectUser'),
                codeEditor: setting('string', 'internal', 'projectUser'),
                pipeline: {
                    searchRelatedAssets: setting('boolean', false, 'projectUser'),
                    defaultAssetPreload: setting('boolean', false, 'projectUser'),
                    texturePot: setting('boolean', false, 'projectUser'),
                    textureDefaultToAtlas: setting('boolean', false, 'projectUser'),
                    preserveMapping: setting('boolean', false, 'projectUser'),
                    overwriteModel: setting('boolean', false, 'projectUser'),
                    overwriteAnimation: setting('boolean', false, 'projectUser'),
                    overwriteMaterial: setting('boolean', false, 'projectUser'),
                    overwriteTexture: setting('boolean', false, 'projectUser'),
                    useGlb: setting('boolean', false, 'projectUser'),
                    useContainers: setting('boolean', true, 'projectUser'),
                    meshCompression: setting('string', 'none', 'projectUser'),
                    dracoDecodeSpeed: setting('number', 0.5, 'projectUser'),
                    dracoMeshSize: setting('number', 0.5, 'projectUser'),
                    unwrapUv: setting('boolean', false, 'projectUser'),
                    unwrapUvTexelsPerMeter: setting('number', 10, 'projectUser'),
                    importMorphNormals: setting('boolean', true, 'projectUser'),
                    useUniqueIndices: setting('boolean', false, 'projectUser'),
                    createFBXFolder: setting('boolean', false, 'projectUser'),
                    animUseFbxFilename: setting('boolean', false, 'projectUser'),
                    animSampleRate: setting('number', 0, 'projectUser'),
                    animCurveTolerance: setting('number', 0, 'projectUser'),
                    animEnableCubic: setting('boolean', false, 'projectUser')
                }
            }
        },
        scene: {
            entities: {
                $of: {
                    components: {
                        script: {
                            enabled: {
                                $type: 'boolean',
                                $default: true
                            },
                            order: {
                                $type: ['string'],
                                $default: []
                            },
                            scripts: {
                                $type: 'map',
                                $default: {}
                            }
                        }
                    }
                }
            },
            settings: {
                physics: {
                    gravity: {
                        $type: ['number'],
                        $default: [0, -9.8, 0],
                        $length: 3
                    }
                },
                render: {
                    global_ambient: {
                        $type: ['number'],
                        $default: [0, 0, 0],
                        $length: 3
                    },
                    ambientLuminance: {
                        $type: 'number',
                        $default: 0
                    },
                    fog: {
                        $type: 'string',
                        $default: 'none'
                    },
                    fog_color: {
                        $type: ['number'],
                        $default: [0, 0, 0],
                        $length: 3
                    },
                    fog_start: {
                        $type: 'number',
                        $default: 1
                    },
                    fog_end: {
                        $type: 'number',
                        $default: 1000
                    },
                    fog_density: {
                        $type: 'number',
                        $default: 0.01
                    },
                    gamma_correction: {
                        $type: 'number',
                        $default: 1
                    },
                    tonemapping: {
                        $type: 'number',
                        $default: 0
                    },
                    exposure: {
                        $type: 'number',
                        $default: 1
                    },
                    skybox: {
                        $type: 'number',
                        $default: null,
                        $allowNull: true
                    },
                    skyType: {
                        $type: 'string',
                        $default: 'infinite'
                    },
                    skyMeshPosition: {
                        $type: ['number'],
                        $default: [0, 0, 0],
                        $length: 3
                    },
                    skyMeshRotation: {
                        $type: ['number'],
                        $default: [0, 0, 0],
                        $length: 3
                    },
                    skyMeshScale: {
                        $type: ['number'],
                        $default: [1, 1, 1],
                        $length: 3
                    },
                    skyCenter: {
                        $type: ['number'],
                        $default: [0, 0, 0],
                        $length: 3
                    },
                    skyboxIntensity: {
                        $type: 'number',
                        $default: 1
                    },
                    skyboxMip: {
                        $type: 'number',
                        $default: 0
                    },
                    skyboxRotation: {
                        $type: ['number'],
                        $default: [0, 0, 0],
                        $length: 3
                    },
                    skyDepthWrite: {
                        $type: 'boolean',
                        $default: true
                    },
                    lightmapSizeMultiplier: {
                        $type: 'number',
                        $default: 1
                    },
                    lightmapMaxResolution: {
                        $type: 'number',
                        $default: 2048
                    },
                    lightmapMode: {
                        $type: 'number',
                        $default: 1
                    },
                    clusteredLightingEnabled: {
                        $type: 'boolean',
                        $default: false
                    },
                    lightingCells: {
                        $type: ['number'],
                        $default: [10, 3, 10],
                        $length: 3
                    },
                    lightingMaxLightsPerCell: {
                        $type: 'number',
                        $default: 255
                    },
                    lightingCookiesEnabled: {
                        $type: 'boolean',
                        $default: false
                    },
                    lightingCookieAtlasResolution: {
                        $type: 'number',
                        $default: 2048
                    },
                    lightingShadowsEnabled: {
                        $type: 'boolean',
                        $default: true
                    },
                    lightingShadowAtlasResolution: {
                        $type: 'number',
                        $default: 2048
                    },
                    lightingShadowType: {
                        $type: 'number',
                        $default: 0
                    },
                    lightingAreaLightsEnabled: {
                        $type: 'boolean',
                        $default: false
                    }
                }
            }
        },
        asset: {
            type: {
                $enum: [
                    'animation',
                    'animstategraph',
                    'audio',
                    'binary',
                    'bundle',
                    'container',
                    'css',
                    'cubemap',
                    'font',
                    'folder',
                    'gsplat',
                    'html',
                    'json',
                    'material',
                    'model',
                    'render',
                    'script',
                    'shader',
                    'sprite',
                    'template',
                    'text',
                    'texture',
                    'textureatlas'
                ]
            }
        },
        animstategraphData: {},
        materialData: {},
        modelData: {
            mapping: {
                $type: [{
                    material: {
                        $type: 'number',
                        $editorType: 'asset'
                    }
                }]
            }
        }
    };
}

function createSceneDocument() {
    return {
        item_id: Number(SCENE_ID),
        name: 'Main',
        settings: {
            physics: {
                gravity: [0, -9.8, 0]
            },
            render: {
                global_ambient: [0, 0, 0],
                ambientLuminance: 0,
                fog: 'none',
                fog_color: [0, 0, 0],
                fog_start: 1,
                fog_end: 1000,
                fog_density: 0.01,
                gamma_correction: 1,
                tonemapping: 0,
                exposure: 1,
                skybox: null,
                skyType: 'infinite',
                skyMeshPosition: [0, 0, 0],
                skyMeshRotation: [0, 0, 0],
                skyMeshScale: [1, 1, 1],
                skyCenter: [0, 0, 0],
                skyboxIntensity: 1,
                skyboxMip: 0,
                skyboxRotation: [0, 0, 0],
                skyDepthWrite: true,
                lightmapSizeMultiplier: 1,
                lightmapMaxResolution: 2048,
                lightmapMode: 1,
                clusteredLightingEnabled: false,
                lightingCells: [10, 3, 10],
                lightingMaxLightsPerCell: 255,
                lightingCookiesEnabled: false,
                lightingCookieAtlasResolution: 2048,
                lightingShadowsEnabled: true,
                lightingShadowAtlasResolution: 2048,
                lightingShadowType: 0,
                lightingAreaLightsEnabled: false
            }
        },
        entities: {
            [ROOT_ENTITY_ID]: {
                name: 'Root',
                resource_id: ROOT_ENTITY_ID,
                parent: null,
                children: [],
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                enabled: true,
                tags: [],
                components: {}
            }
        }
    };
}

function createProjectUserSettings() {
    return {
        editor: {
            gridDivisions: 8,
            gridDivisionSize: 1,
            snapIncrement: 1,
            cameraGrabDepth: false,
            cameraGrabColor: false,
            cameraNearClip: 0.1,
            cameraFarClip: 1000,
            cameraClearColor: [0.118, 0.118, 0.118, 1],
            cameraToneMapping: 0,
            cameraGammaCorrection: 1,
            showFog: true,
            showSkeleton: false,
            iconSize: 1,
            locale: 'en-US',
            lastSelectedFontId: -1,
            launchReleaseCandidate: false,
            launchDebug: false,
            launchMinistats: false,
            renameDuplicatedEntities: true,
            lightmapperAutoBake: false,
            codeEditor: 'internal',
            pipeline: {
                searchRelatedAssets: false,
                defaultAssetPreload: false,
                texturePot: false,
                textureDefaultToAtlas: false,
                preserveMapping: false,
                overwriteModel: false,
                overwriteAnimation: false,
                overwriteMaterial: false,
                overwriteTexture: false,
                useGlb: false,
                useContainers: true,
                meshCompression: 'none',
                dracoDecodeSpeed: 0.5,
                dracoMeshSize: 0.5,
                unwrapUv: false,
                unwrapUvTexelsPerMeter: 10,
                importMorphNormals: true,
                useUniqueIndices: false,
                createFBXFolder: false,
                animUseFbxFilename: false,
                animSampleRate: 0,
                animCurveTolerance: 0,
                animEnableCubic: false
            }
        },
        branch: BRANCH_ID,
        favoriteBranches: [BRANCH_ID]
    };
}

function createUserSettings() {
    return {
        editor: {
            zoomSensitivity: 1,
            gizmoSize: 1,
            gizmoPreset: 'default',
            showViewCube: true,
            viewCubeSize: 1
        }
    };
}

function createUserData() {
    return {
        cameras: {
            perspective: {
                position: [9, 8, 9],
                rotation: [-35, 45, 0],
                focus: [0, 0, 0]
            }
        }
    };
}

async function ensureDoc(connection, collection, id, data) {
    const doc = connection.get(collection, id);
    await new Promise((resolve, reject) => {
        doc.fetch((error) => {
            if (error) {
                reject(error);
                return;
            }

            if (doc.type) {
                resolve();
                return;
            }

            doc.create(data, (createError) => {
                if (createError) {
                    reject(createError);
                    return;
                }
                resolve();
            });
        });
    });
}

function normalizeProjectSettings(settings = {}) {
    return {
        engineV2: Boolean(settings.engineV2),
        antiAlias: settings.antiAlias ?? true,
        fillMode: settings.fillMode ?? 'FILL_WINDOW',
        resolutionMode: settings.resolutionMode ?? 'AUTO',
        width: settings.width ?? 1280,
        height: settings.height ?? 720,
        use3dPhysics: settings.use3dPhysics ?? false,
        enableWebGpu: settings.enableWebGpu ?? false,
        enableWebGl2: settings.enableWebGl2 ?? true,
        powerPreference: settings.powerPreference ?? 'high-performance',
        preserveDrawingBuffer: settings.preserveDrawingBuffer ?? false,
        transparentCanvas: settings.transparentCanvas ?? false,
        useDevicePixelRatio: settings.useDevicePixelRatio ?? false,
        useLegacyScripts: settings.useLegacyScripts ?? false,
        loadingScreenScript: settings.loadingScreenScript ?? null,
        importMap: settings.importMap ?? null,
        externalScripts: settings.externalScripts ?? [],
        scripts: settings.scripts ?? [],
        batchGroups: settings.batchGroups ?? {},
        layers: settings.layers ?? {},
        layerOrder: settings.layerOrder ?? [],
        i18nAssets: settings.i18nAssets ?? [],
        useLegacyAmmoPhysics: settings.useLegacyAmmoPhysics ?? false,
        vr: settings.vr ?? false,
        useKeyboard: settings.useKeyboard ?? true,
        useMouse: settings.useMouse ?? true,
        useTouch: settings.useTouch ?? true,
        useGamepads: settings.useGamepads ?? false,
        maxAssetRetries: settings.maxAssetRetries ?? 0
    };
}

async function fetchPublicProject() {
    const fallback = {
        id: PROJECT_ID,
        name: 'Studio Project',
        description: 'Local 3D editor fixture',
        private: false,
        private_source_assets: false,
        settings: normalizeProjectSettings(),
        thumbnails: {},
        master_branch: BRANCH_ID
    };

    return fallback;
}

function buildConfig(project, schema) {
    return {
        version: 'studio-host',
        self: {
            id: OWNER_ID,
            username: USERNAME,
            flags: {
                openedEditor: true,
                superUser: false,
                tips: {
                    ...DEFAULT_TIP_FLAGS
                }
            },
            branch: {
                id: BRANCH_ID,
                name: 'main',
                createdAt: new Date('2022-04-24T17:57:37.548Z').toISOString(),
                latestCheckpointId: 'local-checkpoint-1'
            },
            plan: {
                id: 1,
                type: 'free'
            },
            locale: 'en-US'
        },
        owner: {
            id: OWNER_ID,
            username: USERNAME,
            plan: {
                id: 1,
                type: 'free'
            },
            size: 0,
            diskAllowance: DEFAULT_DISK_ALLOWANCE_BYTES
        },
        accessToken: '',
        project: {
            id: PROJECT_ID,
            name: project.name,
            description: project.description || '',
            permissions: {
                admin: [OWNER_ID],
                write: [OWNER_ID],
                read: []
            },
            private: false,
            primaryApp: project.primary_app ?? null,
            playUrl: `${ORIGIN}/`,
            settings: project.settings,
            privateAssets: Boolean(project.private_source_assets),
            hasPrivateSettings: false,
            thumbnails: project.thumbnails || {},
            masterBranch: BRANCH_ID
        },
        aws: {
            s3Prefix: ''
        },
        store: {
            sketchfab: {
                clientId: '',
                cookieName: '',
                redirectUrl: `${ORIGIN}/`
            }
        },
        scene: {
            id: SCENE_ID,
            uniqueId: SCENE_UNIQUE_ID
        },
        url: {
            api: `${ORIGIN}/api`,
            home: ORIGIN,
            realtime: {
                http: `ws://${HOST}:${PORT}/realtime`
            },
            messenger: {
                http: `${ORIGIN}/messenger`,
                ws: `ws://${HOST}:${PORT}/messenger`
            },
            relay: {
                http: `${ORIGIN}/relay`,
                ws: `ws://${HOST}:${PORT}/relay`
            },
            frontend: `${ORIGIN}/`,
            engine: `${ORIGIN}/engine/playcanvas.js`,
            useCustomEngine: true,
            store: `${ORIGIN}/store`,
            howdoi: `${ORIGIN}/howdoi`,
            static: `${ORIGIN}/static`,
            images: `${ORIGIN}/images`
        },
        engineVersions: {
            current: {
                version: 'stable',
                description: 'stable'
            },
            force: {
                version: 'stable',
                description: 'stable'
            }
        },
        sentry: {
            enabled: false
        },
        metrics: {
            env: 'local',
            send: false
        },
        oneTrustDomainKey: '',
        schema,
        wasmModules: []
    };
}

function createBranchSummary() {
    return {
        id: BRANCH_ID,
        projectId: PROJECT_ID,
        userId: OWNER_ID,
        user: {
            id: OWNER_ID,
            username: USERNAME,
            fullName: FULL_NAME,
            email: ''
        },
        name: 'main',
        createdAt: new Date('2022-04-24T17:57:37.548Z').toISOString(),
        closed: false,
        permanent: true,
        latestCheckpointId: 'local-checkpoint-1'
    };
}

function buildHtml(config) {
    const escapedConfig = JSON.stringify(config).replace(/</g, '\\u003c');

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>3D Studio</title>
    <link rel="stylesheet" href="/css/editor.css" />
</head>
<body>
    <script>
        window.log = {
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console)
        };
        window.config = ${escapedConfig};
    </script>
    <script src="/engine/playcanvas.js"></script>
    <script src="/js/editor.js"></script>
</body>
</html>`;
}

async function createRuntime() {
    const schema = createSchema();
    const project = await fetchPublicProject();
    const config = buildConfig(project, schema);

    const connection = backend.connect();
    await ensureDoc(connection, 'scenes', SCENE_UNIQUE_ID, createSceneDocument());
    await ensureDoc(connection, 'settings', `user_${OWNER_ID}`, createUserSettings());
    await ensureDoc(connection, 'settings', `project_${PROJECT_ID}_${OWNER_ID}`, createProjectUserSettings());
    await ensureDoc(connection, 'user_data', `${SCENE_UNIQUE_ID}_${OWNER_ID}`, createUserData());
    connection.close();

    return {
        config,
        html: buildHtml(config),
        project,
        sceneSummary: {
            id: Number(SCENE_ID),
            uniqueId: SCENE_UNIQUE_ID,
            name: 'Main'
        },
        branchSummary: createBranchSummary(),
        user: {
            id: OWNER_ID,
            username: USERNAME,
            fullName: FULL_NAME
        }
    };
}

await initializeAssetRegistry();
const runtime = await createRuntime();

const realtimeWss = new WebSocketServer({ noServer: true });
const messengerWss = new WebSocketServer({ noServer: true });
const relayWss = new WebSocketServer({ noServer: true });

realtimeWss.on('connection', (ws) => {
    let stream = null;

    ws.on('message', (raw) => {
        const message = raw.toString();

        if (message.startsWith('auth')) {
            ws.send('auth');
            if (!stream) {
                stream = new WsJsonStream(ws);
                backend.listen(stream);
            }
            return;
        }

        if (!stream) {
            return;
        }

        if (!message.startsWith('{') && !message.startsWith('[')) {
            return;
        }

        try {
            stream.push(JSON.parse(message));
        } catch {
            // Ignore non-ShareDB messages for the Step 1 host.
        }
    });
});

messengerWss.on('connection', (ws) => {
    ws.on('message', (raw) => {
        const message = raw.toString();

        if (message === 'ping') {
            ws.send('pong');
            return;
        }

        let payload = null;
        try {
            payload = JSON.parse(message);
        } catch {
            return;
        }

        if (payload.name === 'authenticate') {
            ws.send(JSON.stringify({
                name: 'welcome',
                data: {
                    user: runtime.user
                }
            }));
            return;
        }

        if (payload.name === 'project.watch') {
            return;
        }
    });
});

relayWss.on('connection', (ws) => {
    ws.send(JSON.stringify({
        t: 'welcome',
        userId: OWNER_ID
    }));

    ws.on('message', (raw) => {
        const message = raw.toString();

        if (message === 'pong' || message === 'ping') {
            ws.send('pong');
            return;
        }

        let payload = null;
        try {
            payload = JSON.parse(message);
        } catch {
            return;
        }

        if (payload.t === 'room:join') {
            ws.send(JSON.stringify({
                t: 'room:join',
                name: payload.name,
                users: [OWNER_ID]
            }));
            return;
        }

        if (payload.t === 'room:leave') {
            ws.send(JSON.stringify({
                t: 'room:leave',
                name: payload.name,
                userId: OWNER_ID
            }));
        }
    });
});

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, ORIGIN);
    const { pathname } = url;

    if (pathname === '/' || /^\/editor\/scene\/[^/]+$/.test(pathname)) {
        text(res, 200, runtime.html, 'text/html; charset=utf-8');
        return;
    }

    if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (pathname === `/api/projects/${PROJECT_ID}/scenes`) {
        json(res, 200, {
            result: [runtime.sceneSummary],
            pagination: {
                hasMore: false
            }
        });
        return;
    }

    if (pathname === `/api/scenes/${SCENE_ID}`) {
        json(res, 200, runtime.sceneSummary);
        return;
    }

    if (pathname === `/api/projects/${PROJECT_ID}`) {
        json(res, 200, runtime.project);
        return;
    }

    if (pathname === `/api/projects/${PROJECT_ID}/assets`) {
        if (req.method !== 'GET') {
            res.writeHead(405, { Allow: 'GET' });
            res.end();
            return;
        }

        json(res, 200, assetRegistry.map(serializeAsset));
        return;
    }

    const requestedAssetId = assetDetailRoute(pathname);
    if (requestedAssetId !== null) {
        const asset = getAssetById(requestedAssetId);
        if (!asset) {
            json(res, 404, { error: 'Asset not found' });
            return;
        }

        if (req.method === 'GET') {
            json(res, 200, serializeAsset(asset));
            return;
        }

        res.writeHead(405, { Allow: 'GET' });
        res.end();
        return;
    }

    const assetFileId = assetFileRoute(pathname);
    if (assetFileId !== null) {
        const asset = getAssetById(assetFileId);
        if (!asset || !asset.absolutePath) {
            json(res, 404, { error: 'Asset file not found' });
            return;
        }

        if (req.method !== 'GET') {
            res.writeHead(405, { Allow: 'GET' });
            res.end();
            return;
        }

        await sendFile(res, asset.absolutePath);
        return;
    }

    if (pathname === '/api/assets') {
        if (req.method === 'POST') {
            try {
                const formData = await readMultipartFormData(req);
                const asset = await createUploadedAsset(formData);
                json(res, 201, serializeAsset(asset));
            } catch (error) {
                json(res, 400, {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            return;
        }

        res.writeHead(405, { Allow: 'POST' });
        res.end();
        return;
    }

    if (pathname === `/api/projects/${PROJECT_ID}/branches`) {
        if (req.method !== 'GET') {
            res.writeHead(405, { Allow: 'GET' });
            res.end();
            return;
        }

        const closed = url.searchParams.get('closed');
        const favorite = url.searchParams.get('favorite');
        const skip = url.searchParams.get('skip');
        const limit = Number(url.searchParams.get('limit') || 0);

        let branches = [runtime.branchSummary];

        if (closed === 'true') {
            branches = branches.filter(branch => branch.closed);
        } else if (closed === 'false') {
            branches = branches.filter(branch => !branch.closed);
        }

        if (favorite === 'true') {
            branches = branches.filter(branch => branch.id === BRANCH_ID);
        }

        if (skip) {
            const index = branches.findIndex(branch => String(branch.id) === String(skip));
            if (index >= 0) {
                branches = branches.slice(index + 1);
            } else {
                branches = [];
            }
        }

        if (Number.isFinite(limit) && limit > 0) {
            branches = branches.slice(0, limit);
        }

        json(res, 200, {
            result: branches,
            pagination: {
                hasMore: false
            }
        });
        return;
    }

    if (pathname === `/api/users/${OWNER_ID}`) {
        json(res, 200, runtime.user);
        return;
    }

    if (pathname === `/api/users/${OWNER_ID}/thumbnail`) {
        if (await proxyRemote(res, pathname)) {
            return;
        }

        res.writeHead(204);
        res.end();
        return;
    }

    if (pathname === '/api/onemo/scenes') {
        if (req.method === 'GET') {
            try {
                await mkdir(scenesRoot, { recursive: true });
                const files = await readdir(scenesRoot);
                const preferredScenes = new Map();

                files.forEach((file) => {
                    if (file.endsWith('.onemo')) {
                        preferredScenes.set(file.slice(0, -6), 'onemo');
                        return;
                    }

                    if (file.endsWith('.json')) {
                        const sceneName = file.slice(0, -5);
                        if (!preferredScenes.has(sceneName)) {
                            preferredScenes.set(sceneName, 'json');
                        }
                    }
                });

                const scenes = Array.from(preferredScenes.keys())
                .sort((a, b) => a.localeCompare(b));

                json(res, 200, { scenes });
            } catch (error) {
                json(res, 500, { error: String(error) });
            }
            return;
        }

        if (req.method === 'POST') {
            try {
                await mkdir(scenesRoot, { recursive: true });
                const name = typeof req.headers['x-scene-name'] === 'string' ? req.headers['x-scene-name'] : '';
                if (!name.trim()) {
                    json(res, 400, { error: 'Scene name is required' });
                    return;
                }

                const body = await readBinaryBody(req);
                if (!body || !body.length) {
                    json(res, 400, { error: 'Binary scene body is required' });
                    return;
                }

                const { safeName, onemoPath } = toSceneFilePaths(name);
                await writeFile(onemoPath, body);
                json(res, 200, { saved: safeName });
            } catch (error) {
                json(res, 500, { error: String(error) });
            }
            return;
        }

        res.writeHead(405, { Allow: 'GET, POST' });
        res.end();
        return;
    }

    const requestSceneName = sceneNameFromPath(pathname);
    if (requestSceneName !== null) {
        const { safeName, onemoPath, legacyPath } = toSceneFilePaths(requestSceneName);

        if (req.method === 'GET') {
            try {
                if (existsSync(onemoPath)) {
                    const content = await readFile(onemoPath);
                    res.writeHead(200, { 'Content-Type': 'application/zip' });
                    res.end(content);
                    return;
                }

                const content = await readFile(legacyPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(content);
            } catch {
                json(res, 404, { error: 'Scene not found' });
            }
            return;
        }

        if (req.method === 'DELETE') {
            if (safeName === 'default') {
                json(res, 403, { error: 'Default scene is protected' });
                return;
            }

            try {
                let deleted = false;
                if (existsSync(onemoPath)) {
                    await unlink(onemoPath);
                    deleted = true;
                }
                if (existsSync(legacyPath)) {
                    await unlink(legacyPath);
                    deleted = true;
                }

                if (!deleted) {
                    json(res, 404, { error: 'Scene not found' });
                    return;
                }

                json(res, 200, { deleted: safeName });
            } catch {
                json(res, 404, { error: 'Scene not found' });
            }
            return;
        }

        res.writeHead(405, { Allow: 'GET, DELETE' });
        res.end();
        return;
    }

    if (pathname === '/engine/playcanvas.js') {
        await sendFile(res, path.join(engineRoot, 'playcanvas.js'));
        return;
    }

    if (pathname === '/engine/playcanvas.d.ts') {
        await sendFile(res, path.join(engineRoot, 'playcanvas.d.ts'));
        return;
    }

    if (pathname.startsWith('/assets/')) {
        const assetPath = path.normalize(path.join(publicRoot, pathname));
        if (assetPath.includes('..') || !assetPath.startsWith(publicRoot)) {
            text(res, 403, 'Forbidden');
            return;
        }
        if (assetPath.startsWith(publicRoot) && existsSync(assetPath)) {
            await sendFile(res, assetPath);
            return;
        }
    }

    if (pathname.startsWith('/editor/scene/img/entity-icons/')) {
        if (await proxyRemote(res, pathname)) {
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-store',
            'Content-Length': TRANSPARENT_PNG.length
        });
        res.end(TRANSPARENT_PNG);
        return;
    }

    if (pathname.startsWith('/static/platform/images/')) {
        const fallbackPaths = pathname === '/static/platform/images/common/blank_project.png'
            ? ['/static/platform/images/home/blank_project.png']
            : [];

        if (await proxyRemote(res, pathname, fallbackPaths)) {
            return;
        }
    }

    const staticPath = path.normalize(path.join(distRoot, pathname));
    if (staticPath.startsWith(distRoot) && existsSync(staticPath)) {
        await sendFile(res, staticPath);
        return;
    }

    if (pathname.startsWith('/api/')) {
        console.warn(`[step1-host] Unhandled API route: ${pathname}`);
        json(res, 404, { error: 'Not found' });
        return;
    }

    text(res, 404, `Unhandled route: ${pathname}`);
});

server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, ORIGIN);

    if (url.pathname === '/realtime') {
        realtimeWss.handleUpgrade(req, socket, head, (ws) => {
            realtimeWss.emit('connection', ws, req);
        });
        return;
    }

    if (url.pathname === '/messenger') {
        messengerWss.handleUpgrade(req, socket, head, (ws) => {
            messengerWss.emit('connection', ws, req);
        });
        return;
    }

    if (url.pathname === '/relay') {
        relayWss.handleUpgrade(req, socket, head, (ws) => {
            relayWss.emit('connection', ws, req);
        });
        return;
    }

    socket.destroy();
});

server.listen(PORT, HOST, () => {
    console.log(`[step1-host] 3D Studio host ready on ${ORIGIN}`);
});
