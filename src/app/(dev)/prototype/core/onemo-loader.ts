/**
 * .onemo loader — shared between prototype and Studio.
 *
 * Two modes:
 * 1. parseOnemoConfig() — lightweight, no renderer needed. Extracts ViewerConfig
 *    from studio.json + GLB as blob URL. Used by prototype on mount.
 * 2. loadOnemoTemplate() — full deserialization including renderer settings, env
 *    texture, scene graph. Used by Studio bridge.
 */

import JSZip from 'jszip';
import * as THREE from 'three';

import { deserializeOnemo, normalizeStudioJsonPublic, type OnemoDeserializeResult } from '../../../../../studio/src/editor/adapter/onemo-deserialize';
import type { OnemoStudioJson, OnemoProductConfig, OnemoMaterialRole } from '../../../../../studio/src/editor/adapter/onemo-format';
import type {
    ViewerConfig, CameraConfig, EnvironmentConfig, SceneSettings,
    ColorConfig, FaceMaterial, BackMaterial, FrameMaterial, TexturePaths,
    FaceMaterialConfig, BackMaterialConfig, FrameMaterialConfig, ViewerProductConfig,
} from '../types';

// ─── Lightweight config extraction (no renderer) ──────────────────

export interface ParsedOnemoConfig {
    config: ViewerConfig;
    modelBlobUrl: string;
    studioJson: OnemoStudioJson;
}

const DEFAULT_TEXTURES: TexturePaths = {
    normal: '/assets/materials/ultrasuede/suede-normal.png',
    roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
    height: '/assets/materials/ultrasuede/suede-height.png',
};

function roleDefaults(role: OnemoMaterialRole | undefined, fallback: Record<string, unknown>) {
    const d = role?.defaults ?? {};
    return { ...fallback, ...d };
}

function roleTextures(role: OnemoMaterialRole | undefined): TexturePaths {
    const t = role?.textures;
    return {
        normal: t?.normalMap ?? DEFAULT_TEXTURES.normal,
        roughness: t?.roughnessMap ?? DEFAULT_TEXTURES.roughness,
        height: t?.bumpMap ?? DEFAULT_TEXTURES.height,
    };
}

/**
 * Convert .onemo editor camera (Cartesian position + target) to the spherical
 * CameraConfig that EffectViewer expects.
 */
function editorCameraToSpherical(pos: [number, number, number], target: [number, number, number], fov: number): CameraConfig {
    const dx = pos[0] - target[0];
    const dy = pos[1] - target[1];
    const dz = pos[2] - target[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const polarAngle = distance > 0 ? Math.acos(dy / distance) * (180 / Math.PI) : 90;
    const azimuthAngle = Math.atan2(dx, dz) * (180 / Math.PI);

    return {
        fov,
        distance,
        polarAngle,
        azimuthAngle,
        enableDamping: true,
        dampingFactor: 0.1,
        autoRotate: false,
        autoRotateSpeed: 2,
    };
}

function studioJsonToViewerConfig(studioJson: OnemoStudioJson, modelBlobUrl: string): ViewerConfig {
    const faceRole = studioJson.product.materialRoles.find((r) => r.role === 'face');
    const backRole = studioJson.product.materialRoles.find((r) => r.role === 'back');
    const frameRole = studioJson.product.materialRoles.find((r) => r.role === 'frame');

    const faceDefaults = roleDefaults(faceRole, {
        color: '#ffffff', roughness: 1, metalness: 0, envMapIntensity: 0.1,
        normalScale: 0.15, bumpScale: 1, sheen: 1, sheenColor: '#1a1a1a',
        sheenRoughness: 0.8, colorMultiplier: 1,
    });
    const backDefaults = roleDefaults(backRole, {
        color: '#080808', roughness: 1, envMapIntensity: 0.1, normalScale: 0.15,
        bumpScale: 1, sheen: 1, sheenColor: '#1a1a1a', sheenRoughness: 0.8,
    });
    const frameDefaults = roleDefaults(frameRole, {
        color: '#0f0f0f', roughness: 0.5, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3,
    });

    const scene: SceneSettings = {
        exposure: studioJson.renderer.toneMappingExposure,
        ambientIntensity: studioJson.scene.ambientIntensity,
        envIntensity: studioJson.environment.intensity,
        background: studioJson.scene.backgroundColor,
    };

    const colors: ColorConfig = {
        backColor: (backDefaults.color as string) ?? '#080808',
        frameColor: (frameDefaults.color as string) ?? '#0f0f0f',
        bgColor: studioJson.scene.backgroundColor,
    };

    const camera = editorCameraToSpherical(
        studioJson.editorCamera.position,
        studioJson.editorCamera.target,
        studioJson.editorCamera.fov,
    );

    const environment: EnvironmentConfig = {
        preset: studioJson.environment.preset ?? 'studio',
        customHdri: studioJson.environment.file ?? undefined,
        envRotation: studioJson.environment.rotation,
        groundEnabled: studioJson.environment.ground.enabled,
        groundHeight: studioJson.environment.ground.height,
        groundRadius: studioJson.environment.ground.radius,
    };

    const face: FaceMaterial = {
        params: faceDefaults as unknown as FaceMaterialConfig,
        textures: roleTextures(faceRole),
    };
    const back: BackMaterial = {
        params: backDefaults as unknown as BackMaterialConfig,
        textures: roleTextures(backRole),
    };
    const frame: FrameMaterial = {
        params: frameDefaults as unknown as FrameMaterialConfig,
        textures: {},
    };

    const product: ViewerProductConfig = {
        productType: studioJson.product.productType,
        materialRoles: studioJson.product.materialRoles.map((role) => ({
            role: role.role,
            meshNames: [...role.meshNames],
            defaults: role.defaults ? { ...role.defaults } : undefined,
            textures: role.textures ? { ...role.textures } : undefined,
            configurable: role.configurable,
            configurableProperties: role.configurableProperties ? [...role.configurableProperties] : undefined,
        })),
        artworkSlot: studioJson.product.artworkSlot
            ? { ...studioJson.product.artworkSlot }
            : undefined,
    };

    return { modelPath: modelBlobUrl, face, back, frame, scene, colors, camera, environment, product };
}

/**
 * Parse .onemo file and extract ViewerConfig without needing a renderer.
 * Returns config + GLB blob URL. Prototype uses this on mount.
 */
export async function parseOnemoConfig(url: string): Promise<ParsedOnemoConfig> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load template: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Extract GLB as blob URL
    const glbFile = zip.file('scene.glb');
    if (!glbFile) {
        throw new Error('Invalid .onemo file: missing scene.glb');
    }
    const glbBlob = new Blob([await glbFile.async('arraybuffer')], { type: 'model/gltf-binary' });
    const modelBlobUrl = URL.createObjectURL(glbBlob);

    // Parse studio.json
    const studioFile = zip.file('studio.json');
    let parsedJson: unknown = null;
    if (studioFile) {
        try {
            parsedJson = JSON.parse(await studioFile.async('string'));
        } catch {
            parsedJson = null;
        }
    }

    const studioJson = normalizeStudioJsonPublic(parsedJson, null);

    const config = studioJsonToViewerConfig(studioJson, modelBlobUrl);

    return { config, modelBlobUrl, studioJson };
}

// ─── Full deserialization (needs renderer) ────────────────────────

export async function loadOnemoTemplate(
    url: string,
    renderer: THREE.WebGLRenderer
): Promise<OnemoDeserializeResult> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load template: ${response.status}`);
    }

    const blob = await response.blob();
    return deserializeOnemo(blob, renderer);
}

// ─── User overrides ───────────────────────────────────────────────

export function applyUserOverrides(
    scene: THREE.Group,
    productConfig: OnemoProductConfig,
    userConfig: { materials: Array<{ role: string; color?: string; [key: string]: unknown }> }
) {
    for (const override of userConfig.materials) {
        const roleConfig = productConfig.materialRoles.find((role) => role.role === override.role);
        if (!roleConfig) {
            continue;
        }

        scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) {
                return;
            }

            const meshName = object.name;
            if (!roleConfig.meshNames.some((pattern) => {
                return meshName === pattern || meshName.toLowerCase() === pattern.toLowerCase();
            })) {
                return;
            }

            const material = Array.isArray(object.material) ? object.material[0] : object.material;
            if (override.color && material instanceof THREE.MeshStandardMaterial) {
                material.color.set(override.color);
                material.needsUpdate = true;
            }
        });
    }
}
