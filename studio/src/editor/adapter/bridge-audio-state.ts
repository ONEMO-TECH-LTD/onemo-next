import * as THREE from 'three';

let activeCamera: THREE.Camera | null = null;
let sharedListener: THREE.AudioListener | null = null;
let activeOwnerId: string | null = null;

const attachListenerToCamera = () => {
    if (!sharedListener || !activeCamera) {
        return;
    }

    if (sharedListener.parent !== activeCamera) {
        sharedListener.parent?.remove(sharedListener);
        activeCamera.add(sharedListener);
    }
};

export const setBridgeAudioCamera = (camera: THREE.Camera | null) => {
    activeCamera = camera;
    attachListenerToCamera();
};

export const getBridgeAudioListener = () => {
    if (!sharedListener) {
        sharedListener = new THREE.AudioListener();
    }

    attachListenerToCamera();
    return sharedListener;
};

export const setBridgeAudioListenerOwner = (ownerId: string | null) => {
    activeOwnerId = ownerId;
};

export const isBridgeAudioListenerOwner = (ownerId: string) => {
    return activeOwnerId === ownerId;
};
