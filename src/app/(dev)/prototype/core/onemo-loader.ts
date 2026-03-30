import * as THREE from 'three';

import { deserializeOnemo, type OnemoDeserializeResult } from '../../../../../studio/src/editor/adapter/onemo-deserialize';
import type { OnemoProductConfig } from '../../../../../studio/src/editor/adapter/onemo-format';

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
