import { expect } from 'chai';
import JSZip from 'jszip';
import { describe, it } from 'mocha';
import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

import { deserializeOnemo } from '../../src/editor/adapter/onemo-deserialize';
import {
    DEFAULT_RENDERER_SETTINGS,
    ONEMO_FORMAT_VERSION,
    type OnemoProductConfig
} from '../../src/editor/adapter/onemo-format';
import { serializeOnemo } from '../../src/editor/adapter/onemo-serialize';

const FAKE_GLB_BUFFER = Uint8Array.from([1, 2, 3, 4]).buffer;

const createRendererStub = () => {
    return {
        toneMapping: THREE.NeutralToneMapping,
        toneMappingExposure: 0.85,
        outputColorSpace: THREE.SRGBColorSpace,
        shadowMap: {
            enabled: true,
            type: THREE.PCFSoftShadowMap
        }
    } as unknown as THREE.WebGLRenderer;
};

const createProductConfig = (): OnemoProductConfig => {
    return {
        productType: 'effect-70mm',
        materialRoles: [
            {
                role: 'frame',
                meshNames: ['Frame'],
                configurable: true,
                configurableProperties: ['color']
            }
        ]
    };
};

const createScene = () => {
    const scene = new THREE.Scene();
    scene.name = 'Pipeline Test Scene';
    scene.background = new THREE.Color('#123456');
    scene.fog = new THREE.FogExp2('#654321', 0.025);
    scene.environmentIntensity = 1.35;
    scene.environmentRotation = new THREE.Euler(0, Math.PI / 2, 0);

    const ambient = new THREE.AmbientLight(new THREE.Color(0.25, 0.5, 0.75), 0.8);
    scene.add(ambient);

    const material = new THREE.MeshPhysicalMaterial({
        color: '#0f0f0f',
        clearcoat: 0.4
    });
    material.name = 'Frame';
    material.envMapIntensity = 0.42;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    mesh.name = 'Frame Mesh';
    scene.add(mesh);

    return scene;
};

const withStubbedExporter = async <T>(run: () => Promise<T>) => {
    const original = GLTFExporter.prototype.parseAsync;
    GLTFExporter.prototype.parseAsync = (async () => {
        return FAKE_GLB_BUFFER;
    }) as typeof GLTFExporter.prototype.parseAsync;

    try {
        return await run();
    } finally {
        GLTFExporter.prototype.parseAsync = original;
    }
};

const withStubbedLoader = async <T>(scene: THREE.Group, run: () => Promise<T>) => {
    const original = GLTFLoader.prototype.parseAsync;
    GLTFLoader.prototype.parseAsync = (async () => {
        return {
            scene,
            animations: []
        };
    }) as unknown as typeof GLTFLoader.prototype.parseAsync;

    try {
        return await run();
    } finally {
        GLTFLoader.prototype.parseAsync = original;
    }
};

const withStubbedEnvironmentLoaders = async <T>(run: () => Promise<T>) => {
    const originalHdrParse = HDRLoader.prototype.parse;
    const originalExrParse = EXRLoader.prototype.parse;

    const createTexture = () => {
        return new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    };

    HDRLoader.prototype.parse = (() => {
        return createTexture();
    }) as unknown as typeof HDRLoader.prototype.parse;

    EXRLoader.prototype.parse = (() => {
        return createTexture();
    }) as unknown as typeof EXRLoader.prototype.parse;

    try {
        return await run();
    } finally {
        HDRLoader.prototype.parse = originalHdrParse;
        EXRLoader.prototype.parse = originalExrParse;
    }
};

describe('onemo serialize/deserialize pipeline', function () {
    this.timeout(10000);

    it('serializes a scene into a .onemo zip with studio metadata', async () => {
        const scene = createScene();
        const renderer = createRendererStub();
        const productConfig = createProductConfig();
        const environmentBuffer = new TextEncoder().encode('fake hdr').buffer;

        const blob = await withStubbedExporter(async () => {
            return serializeOnemo(
                scene,
                renderer,
                {
                    position: new THREE.Vector3(1, 2, 3),
                    target: new THREE.Vector3(4, 5, 6),
                    fov: 50,
                    near: 0.1,
                    far: 500
                },
                productConfig,
                environmentBuffer
            );
        });

        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const studioFile = zip.file('studio.json');
        const glbFile = zip.file('scene.glb');
        const environmentFile = zip.file('environment.hdr');

        expect(studioFile).to.not.equal(null);
        expect(glbFile).to.not.equal(null);
        expect(environmentFile).to.not.equal(null);

        const studioJson = JSON.parse(await studioFile!.async('string'));

        expect(studioJson.version).to.equal(ONEMO_FORMAT_VERSION);
        expect(studioJson.name).to.equal('Pipeline Test Scene');
        expect(studioJson.renderer).to.deep.equal({
            toneMapping: THREE.NeutralToneMapping,
            toneMappingExposure: 0.85,
            outputColorSpace: THREE.SRGBColorSpace,
            shadowsEnabled: true,
            shadowType: THREE.PCFSoftShadowMap
        });
        expect(studioJson.environment.file).to.equal('environment.hdr');
        expect(studioJson.environment.intensity).to.equal(1.35);
        expect(studioJson.environment.rotation).to.equal(90);
        expect(studioJson.scene.backgroundColor).to.equal('#123456');
        expect(studioJson.scene.fog).to.equal('exponential');
        expect(studioJson.scene.fogColor).to.equal('#654321');
        expect(studioJson.scene.fogDensity).to.equal(0.025);
        expect(studioJson.scene.ambientColor).to.deep.equal([0.25, 0.5, 0.75]);
        expect(studioJson.scene.ambientIntensity).to.equal(0.8);
        expect(studioJson.editorCamera).to.deep.equal({
            position: [1, 2, 3],
            target: [4, 5, 6],
            fov: 50,
            near: 0.1,
            far: 500
        });
        expect(studioJson.product).to.deep.equal(productConfig);
        expect(studioJson.materialOverrides.Frame).to.deep.equal({
            envMapIntensity: 0.42
        });
        expect(Array.from(await glbFile!.async('uint8array'))).to.deep.equal([1, 2, 3, 4]);
    });

    it('deserializes a .onemo zip and reapplies renderer, scene, and material overrides', async () => {
        const sourceScene = createScene();
        const sourceRenderer = createRendererStub();
        const environmentBuffer = new TextEncoder().encode('fake hdr').buffer;
        const blob = await withStubbedExporter(async () => {
            return serializeOnemo(
                sourceScene,
                sourceRenderer,
                {
                    position: new THREE.Vector3(0, 0, 5),
                    target: new THREE.Vector3(0, 0, 0),
                    fov: 35,
                    near: 0.001,
                    far: 100
                },
                createProductConfig(),
                environmentBuffer
            );
        });

        const targetRenderer = {
            toneMapping: THREE.NoToneMapping,
            toneMappingExposure: 1,
            outputColorSpace: THREE.LinearSRGBColorSpace,
            shadowMap: {
                enabled: false,
                type: THREE.BasicShadowMap
            }
        } as unknown as THREE.WebGLRenderer;

        const loadedScene = new THREE.Group();
        const loadedMaterial = new THREE.MeshStandardMaterial({ color: '#0f0f0f' });
        loadedMaterial.name = 'Frame';
        loadedMaterial.envMapIntensity = 1;
        loadedScene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), loadedMaterial));

        const result = await withStubbedEnvironmentLoaders(async () => {
            return withStubbedLoader(loadedScene, async () => {
                return deserializeOnemo(blob, targetRenderer);
            });
        });
        const restoredScene = result.scene as THREE.Group & {
            background?: THREE.Color | null;
            fog?: THREE.Fog | THREE.FogExp2 | null;
            environment?: THREE.Texture | null;
            environmentIntensity?: number;
            environmentRotation?: THREE.Euler;
        };

        expect(targetRenderer.toneMapping).to.equal(THREE.NeutralToneMapping);
        expect(targetRenderer.toneMappingExposure).to.equal(0.85);
        expect(targetRenderer.outputColorSpace).to.equal(THREE.SRGBColorSpace);
        expect(targetRenderer.shadowMap.enabled).to.equal(true);
        expect(targetRenderer.shadowMap.type).to.equal(THREE.PCFSoftShadowMap);

        expect(restoredScene.background?.getHexString()).to.equal('123456');
        expect(restoredScene.fog).to.be.instanceOf(THREE.FogExp2);
        expect((restoredScene.fog as THREE.FogExp2).density).to.equal(0.025);
        expect(restoredScene.environment).to.be.instanceOf(THREE.Texture);
        expect(restoredScene.environmentIntensity).to.equal(1.35);
        expect(restoredScene.environmentRotation?.y).to.equal(Math.PI / 2);

        const ambientLight = restoredScene.children.find((child) => {
            return child instanceof THREE.AmbientLight;
        }) as THREE.AmbientLight | undefined;
        expect(ambientLight).to.not.equal(undefined);
        expect(ambientLight?.intensity).to.equal(0.8);

        let restoredMaterial: THREE.Material | null = null;
        restoredScene.traverse((object) => {
            if (!restoredMaterial && object instanceof THREE.Mesh) {
                restoredMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
            }
        });

        expect(restoredMaterial).to.not.equal(null);
        expect((restoredMaterial as THREE.MeshStandardMaterial).envMapIntensity).to.equal(0.42);
        expect(result.environmentHdr).to.be.instanceOf(ArrayBuffer);
        expect(result.studioJson.version).to.equal(ONEMO_FORMAT_VERSION);
    });

    it('uses defaults when studio.json is missing', async () => {
        const scene = createScene();
        const blob = await withStubbedExporter(async () => {
            return serializeOnemo(
                scene,
                createRendererStub(),
                {
                    position: new THREE.Vector3(),
                    target: new THREE.Vector3(),
                    fov: 35,
                    near: 0.001,
                    far: 100
                },
                createProductConfig()
            );
        });

        const sourceZip = await JSZip.loadAsync(await blob.arrayBuffer());
        const rebuiltZip = new JSZip();
        rebuiltZip.file('scene.glb', await sourceZip.file('scene.glb')!.async('arraybuffer'));
        const blobWithoutStudioJson = await rebuiltZip.generateAsync({ type: 'blob' });

        const renderer = createRendererStub();
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.toneMappingExposure = 2;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        renderer.shadowMap.enabled = false;
        renderer.shadowMap.type = THREE.BasicShadowMap;

        const result = await withStubbedLoader(new THREE.Group(), async () => {
            return deserializeOnemo(blobWithoutStudioJson, renderer);
        });

        expect(result.environmentHdr).to.equal(null);
        expect(result.studioJson.version).to.equal(ONEMO_FORMAT_VERSION);
        expect(result.studioJson.renderer).to.deep.equal(DEFAULT_RENDERER_SETTINGS);
        expect(renderer.toneMapping).to.equal(DEFAULT_RENDERER_SETTINGS.toneMapping);
        expect(renderer.shadowMap.enabled).to.equal(DEFAULT_RENDERER_SETTINGS.shadowsEnabled);
    });
});
