import * as THREE from 'three';


type BridgeEntityData = {
    name: string;
    tags: string[];
    enabled: boolean;
    resource_id: string;
    parent: string | null;
    children: string[];
    position: number[];
    rotation: number[];
    scale: number[];
    components: Record<string, unknown>;
};

type CreateEntityArgs = {
    resourceId: string;
    name: string;
    parent: string | null;
    children: string[];
    object: THREE.Object3D | null;
    components?: Record<string, unknown>;
};

const toFixedNumber = (value: number) => {
    return Number(value.toFixed(6));
};

const toDegrees = (value: number) => {
    return toFixedNumber(THREE.MathUtils.radToDeg(value));
};

export const toObserverVec3 = (vector: THREE.Vector3) => {
    return [
        toFixedNumber(vector.x),
        toFixedNumber(vector.y),
        toFixedNumber(vector.z)
    ];
};

export const toObserverEuler = (object: THREE.Object3D) => {
    return [
        toDegrees(object.rotation.x),
        toDegrees(object.rotation.y),
        toDegrees(object.rotation.z)
    ];
};

export const isBridgeVisible = (object: THREE.Object3D) => {
    return object.visible;
};

export const createBridgeEntityData = ({
    resourceId,
    name,
    parent,
    children,
    object,
    components = {}
}: CreateEntityArgs): BridgeEntityData => {
    return {
        name,
        tags: [],
        enabled: object ? isBridgeVisible(object) : true,
        resource_id: resourceId,
        parent,
        children,
        position: object ? toObserverVec3(object.position) : [0, 0, 0],
        rotation: object ? toObserverEuler(object) : [0, 0, 0],
        scale: object ? toObserverVec3(object.scale) : [1, 1, 1],
        components
    };
};

export const getEntityDisplayName = (object: THREE.Object3D, fallbackIndex = 0) => {
    if (object.name?.trim()) {
        return object.name.trim();
    }

    if (fallbackIndex > 0) {
        return `${object.type} ${fallbackIndex}`;
    }

    return object.type;
};
