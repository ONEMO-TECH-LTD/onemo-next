import * as THREE from 'three';

import {
    clearBridgeComponent,
    ensureBridgeHelper,
    getStoredBridgeComponentData,
    loadSpriteFrameTexture,
    readColor3,
    readNumber,
    setStoredBridgeComponentData
} from './bridge-utils';


type SpriteRuntime = {
    loadToken: number;
};

const NO_THREE_EQUIVALENT_PATHS = new Set([
    'components.sprite.layers',
    'components.sprite.batchGroupId',
    'components.sprite.autoPlayClip',
    'components.sprite.clips'
]);

const getSpriteDefaults = () => {
    return editor.call('components:getDefault', 'sprite') || {};
};

const getSpriteRuntime = (object: THREE.Object3D): SpriteRuntime => {
    if (!object.userData.__spriteRuntime) {
        object.userData.__spriteRuntime = {
            loadToken: 0
        } satisfies SpriteRuntime;
    }

    return object.userData.__spriteRuntime as SpriteRuntime;
};

const clearSprite = (object: THREE.Object3D) => {
    delete object.userData.__spriteRuntime;
    clearBridgeComponent(object, 'sprite');
};

const updateSpriteTexture = async (
    object: THREE.Object3D,
    observer: import('@/editor-api').EntityObserver,
    sprite: THREE.Sprite,
    runtime: SpriteRuntime
) => {
    const spriteAsset = observer.get('components.sprite.spriteAsset');
    const frame = readNumber(observer.get('components.sprite.frame'), 0);
    const token = ++runtime.loadToken;
    const frameTexture = await loadSpriteFrameTexture(spriteAsset, frame);
    if (runtime.loadToken !== token || !frameTexture) {
        return;
    }

    sprite.material = new THREE.SpriteMaterial({
        map: frameTexture.texture,
        color: readColor3(observer.get('components.sprite.color'), [1, 1, 1]),
        transparent: true,
        opacity: readNumber(observer.get('components.sprite.opacity'), 1),
        depthWrite: false
    });

    const width = readNumber(observer.get('components.sprite.width'), frameTexture.width / Math.max(frameTexture.pixelsPerUnit, 1));
    const height = readNumber(observer.get('components.sprite.height'), frameTexture.height / Math.max(frameTexture.pixelsPerUnit, 1));
    sprite.scale.set(width, height, 1);
    sprite.center.set(frameTexture.pivot[0], frameTexture.pivot[1]);
    sprite.renderOrder = readNumber(observer.get('components.sprite.drawOrder'), 0);
  };

export const createSpriteData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'sprite', getSpriteDefaults());
};

export const createSpriteComponentData = createSpriteData;

export const applySpriteObserverChange = (
    object: THREE.Object3D,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const spriteData = observer.get('components.sprite');
    if (!spriteData) {
        clearSprite(object);
        return true;
    }

    setStoredBridgeComponentData(object, 'sprite', spriteData);

    if (NO_THREE_EQUIVALENT_PATHS.has(path)) {
        // No Three.js equivalent for PlayCanvas-specific sprite playback metadata.
        return true;
    }

    const sprite = ensureBridgeHelper(object, 'sprite:billboard', () => {
        return new THREE.Sprite(new THREE.SpriteMaterial({
            color: '#ffffff',
            transparent: true
        }));
    });

    sprite.visible = !!observer.get('components.sprite.enabled');
    sprite.renderOrder = readNumber(observer.get('components.sprite.drawOrder'), 0);

    const runtime = getSpriteRuntime(object);
    void updateSpriteTexture(object, observer, sprite as THREE.Sprite, runtime);

    return true;
};
