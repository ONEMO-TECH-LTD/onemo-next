import { Observer } from '@playcanvas/observer';
import * as THREE from 'three';

import { buildQueryUrl } from '../utils';

declare const editor: any;
declare const config: any;
declare const pc: any;

type MeshPreviewResult = {
    group: THREE.Group;
    hasGeometry: boolean;
    dispose: () => void;
};

/**
 * Shared thumbnail renderer with a single offscreen Three.js renderer.
 * Individual thumbnail types provide their own scene data and call the helpers here.
 */
class ThumbnailRenderer extends Observer {
    private static renderer: THREE.WebGLRenderer | null = null;

    private static rendererCanvas: HTMLCanvasElement | null = null;

    private static textureLoader = new THREE.TextureLoader();

    private static textureCache = new Map<string, Promise<THREE.Texture | null>>();

    private static cubeTextureCache = new Map<string, Promise<THREE.CubeTexture | null>>();

    protected getSquareRenderSize(canvas: HTMLCanvasElement) {
        let width = canvas.width;
        let height = canvas.height;

        if (width > height) {
            width = height;
        } else {
            height = width;
        }

        return {
            width,
            height,
            offsetX: (canvas.width - width) / 2,
            offsetY: (canvas.height - height) / 2
        };
    }

    protected clearCanvas(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    protected renderSceneToCanvas(
        canvas: HTMLCanvasElement,
        scene: THREE.Scene,
        camera: THREE.Camera,
        options: { clearColor?: number; clearAlpha?: number } = {}
    ) {
        const { width, height, offsetX, offsetY } = this.getSquareRenderSize(canvas);
        const renderer = ThumbnailRenderer.ensureRenderer(width, height);
        const clearColor = options.clearColor ?? 0x293538;
        const clearAlpha = options.clearAlpha ?? 0;

        renderer.setSize(width, height, false);
        renderer.setClearColor(clearColor, clearAlpha);
        renderer.render(scene, camera);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(renderer.domElement, offsetX, offsetY, width, height);
    }

    protected renderGroupToCanvas(
        canvas: HTMLCanvasElement,
        group: THREE.Group,
        options: {
            rotationX?: number;
            rotationY?: number;
            clearColor?: number;
            clearAlpha?: number;
            fov?: number;
            lightIntensity?: number;
            ambientIntensity?: number;
        } = {}
    ) {
        const { width, height } = this.getSquareRenderSize(canvas);
        const scene = new THREE.Scene();
        const pivot = new THREE.Group();
        scene.add(pivot);

        group.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(group);
        if (bounds.isEmpty()) {
            bounds.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 0.2, 0.2));
        }

        const center = bounds.getCenter(new THREE.Vector3());
        group.position.sub(center);
        group.updateMatrixWorld(true);

        pivot.rotation.x = THREE.MathUtils.degToRad(options.rotationX ?? 0);
        pivot.rotation.y = THREE.MathUtils.degToRad(options.rotationY ?? 0);
        pivot.add(group);

        const ambient = new THREE.AmbientLight(0xffffff, options.ambientIntensity ?? 0.9);
        const directional = new THREE.DirectionalLight(0xffffff, options.lightIntensity ?? 1.8);
        directional.position.set(2, 3, 4);
        scene.add(ambient, directional);

        const size = bounds.getSize(new THREE.Vector3());
        const radius = Math.max(size.length() * 0.5, 0.1);
        const camera = new THREE.PerspectiveCamera(options.fov ?? 45, width / height, 0.01, radius * 12 + 10);
        camera.position.set(0, radius * 0.15, radius * 2.5);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        this.renderSceneToCanvas(canvas, scene, camera, options);
    }

    protected createGroupFromMeshInstances(meshInstances: any[]): MeshPreviewResult {
        const group = new THREE.Group();
        const materials = new Set<THREE.Material>();
        const geometries = new Set<THREE.BufferGeometry>();
        let hasGeometry = false;

        meshInstances.forEach((meshInstance) => {
            const geometry = this.createGeometryFromMesh(meshInstance?.mesh);
            if (!geometry) {
                return;
            }

            const material = this.createThreeMaterial(meshInstance?.material);
            const mesh = new THREE.Mesh(geometry, material);
            const transform = meshInstance?.node?.getWorldTransform?.();

            if (transform?.data) {
                mesh.matrix.fromArray(Array.from(transform.data));
                mesh.matrixAutoUpdate = false;
            }

            group.add(mesh);
            geometries.add(geometry);
            materials.add(material);
            hasGeometry = true;
        });

        return {
            group,
            hasGeometry,
            dispose: () => {
                geometries.forEach((geometry) => geometry.dispose());
                materials.forEach((material) => material.dispose());
            }
        };
    }

    protected resolveAssetUrl(assetId: unknown) {
        if (typeof assetId === 'string' && assetId.trim() && (assetId.startsWith('/') || assetId.startsWith('http'))) {
            return assetId;
        }

        const numericId = Number(assetId);
        if (!Number.isFinite(numericId)) {
            return null;
        }

        const asset = editor.call('assets:get', numericId);
        if (!asset) {
            return null;
        }

        const fileUrl = asset.get('file.url');
        if (typeof fileUrl !== 'string' || !fileUrl) {
            return null;
        }

        const hash = asset.get('file.hash');
        const absoluteUrl = fileUrl.startsWith('http') ? fileUrl : `${config.url.home}${fileUrl}`;
        return buildQueryUrl(absoluteUrl, hash ? { t: hash } : {});
    }

    protected loadTextureAsset(assetId: unknown, colorSpace = THREE.SRGBColorSpace) {
        const url = this.resolveAssetUrl(assetId);
        if (!url) {
            return Promise.resolve(null);
        }

        const cached = ThumbnailRenderer.textureCache.get(url);
        if (cached) {
            return cached;
        }

        const promise = ThumbnailRenderer.textureLoader.loadAsync(url).then((texture) => {
            texture.colorSpace = colorSpace;
            texture.needsUpdate = true;
            return texture;
        }).catch(() => null);

        ThumbnailRenderer.textureCache.set(url, promise);
        return promise;
    }

    protected loadCubemapAssets(assetIds: unknown[]) {
        const urls = assetIds.map((assetId) => this.resolveAssetUrl(assetId));
        if (urls.some((url) => !url)) {
            return Promise.resolve(null);
        }

        const key = urls.join('|');
        const cached = ThumbnailRenderer.cubeTextureCache.get(key);
        if (cached) {
            return cached;
        }

        const loader = new THREE.CubeTextureLoader();
        const promise = loader.loadAsync(urls as string[]).then((texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            return texture;
        }).catch(() => null);

        ThumbnailRenderer.cubeTextureCache.set(key, promise);
        return promise;
    }

    private static ensureRenderer(width: number, height: number) {
        if (!ThumbnailRenderer.rendererCanvas) {
            ThumbnailRenderer.rendererCanvas = document.createElement('canvas');
        }

        if (!ThumbnailRenderer.renderer) {
            ThumbnailRenderer.renderer = new THREE.WebGLRenderer({
                canvas: ThumbnailRenderer.rendererCanvas,
                alpha: true,
                antialias: true,
                preserveDrawingBuffer: true
            });
            ThumbnailRenderer.renderer.outputColorSpace = THREE.SRGBColorSpace;
        }

        ThumbnailRenderer.renderer.setSize(width, height, false);
        return ThumbnailRenderer.renderer;
    }

    private createThreeMaterial(sourceMaterial: any) {
        const diffuse = sourceMaterial?.diffuse;
        const emissive = sourceMaterial?.emissive;
        const color = new THREE.Color(
            diffuse?.r ?? diffuse?.[0] ?? 0.78,
            diffuse?.g ?? diffuse?.[1] ?? 0.78,
            diffuse?.b ?? diffuse?.[2] ?? 0.78
        );
        const emissiveColor = new THREE.Color(
            emissive?.r ?? emissive?.[0] ?? 0,
            emissive?.g ?? emissive?.[1] ?? 0,
            emissive?.b ?? emissive?.[2] ?? 0
        );
        const gloss = Number(sourceMaterial?.gloss ?? sourceMaterial?.shininess ?? 50);
        const roughness = sourceMaterial?.roughness !== undefined
            ? Number(sourceMaterial.roughness)
            : THREE.MathUtils.clamp(1 - (gloss / 100), 0, 1);
        const opacity = Number(sourceMaterial?.opacity ?? 1);

        return new THREE.MeshStandardMaterial({
            color,
            emissive: emissiveColor,
            metalness: THREE.MathUtils.clamp(Number(sourceMaterial?.metalness ?? 0), 0, 1),
            roughness: THREE.MathUtils.clamp(roughness, 0, 1),
            opacity,
            transparent: opacity < 1,
            side: THREE.DoubleSide
        });
    }

    private createGeometryFromMesh(mesh: any) {
        const vertexBuffer = mesh?.vertexBuffer;
        if (!vertexBuffer?.storage || !vertexBuffer?.format) {
            return null;
        }

        const elements = vertexBuffer.format.elements || [];
        const positionElement = elements.find((element: any) => element.name === (pc?.SEMANTIC_POSITION ?? 'POSITION'));
        if (!positionElement) {
            return null;
        }

        const normalElement = elements.find((element: any) => element.name === (pc?.SEMANTIC_NORMAL ?? 'NORMAL'));
        const uvElement = elements.find((element: any) => element.name === (pc?.SEMANTIC_TEXCOORD0 ?? 'TEXCOORD0'));
        const stride = vertexBuffer.format.size / Float32Array.BYTES_PER_ELEMENT;
        const vertexData = new Float32Array(vertexBuffer.storage);
        const positionOffset = positionElement.offset / Float32Array.BYTES_PER_ELEMENT;
        const normalOffset = normalElement ? normalElement.offset / Float32Array.BYTES_PER_ELEMENT : null;
        const uvOffset = uvElement ? uvElement.offset / Float32Array.BYTES_PER_ELEMENT : null;
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];

        for (let i = 0; i < vertexBuffer.numVertices; i++) {
            const base = i * stride;
            positions.push(
                vertexData[base + positionOffset],
                vertexData[base + positionOffset + 1],
                vertexData[base + positionOffset + 2]
            );

            if (normalOffset !== null) {
                normals.push(
                    vertexData[base + normalOffset],
                    vertexData[base + normalOffset + 1],
                    vertexData[base + normalOffset + 2]
                );
            }

            if (uvOffset !== null) {
                uvs.push(
                    vertexData[base + uvOffset],
                    vertexData[base + uvOffset + 1]
                );
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        if (normals.length === positions.length) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        }
        if (uvs.length * 3 === positions.length * 2) {
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        }

        const primitive = mesh.primitive?.[0];
        const indexBuffer = mesh.indexBuffer?.[0];
        if (primitive && indexBuffer?.storage) {
            let indices: Uint8Array | Uint16Array | Uint32Array;
            if (indexBuffer.bytesPerIndex === 1) {
                indices = new Uint8Array(indexBuffer.storage);
            } else if (indexBuffer.bytesPerIndex === 2) {
                indices = new Uint16Array(indexBuffer.storage);
            } else {
                indices = new Uint32Array(indexBuffer.storage);
            }

            const start = primitive.base ?? 0;
            const end = start + (primitive.count ?? indices.length);
            geometry.setIndex(Array.from(indices.slice(start, end)));
        }

        geometry.computeBoundingBox();
        if (!geometry.getAttribute('normal')) {
            geometry.computeVertexNormals();
        }

        return geometry;
    }
}

export { ThumbnailRenderer };
