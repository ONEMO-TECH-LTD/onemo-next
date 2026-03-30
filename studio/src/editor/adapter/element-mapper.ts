import * as THREE from 'three';

import {
    clearBridgeComponent,
    createRectangleOutline,
    ensureBridgeHelper,
    getStoredBridgeComponentData,
    loadSpriteFrameTexture,
    loadTextureAsset,
    readColor3,
    readNumber,
    readVec2,
    readVec4,
    updateLabelSprite,
    updateRectangleOutline,
    setStoredBridgeComponentData
} from './bridge-utils';


type ElementRuntime = {
    loadToken: number;
};

const UI_WORLD_SCALE = 0.01;

const NO_THREE_EQUIVALENT_PATHS = new Set([
    'components.element.fontAsset',
    'components.element.materialAsset',
    'components.element.mask',
    'components.element.useInput',
    'components.element.layers',
    'components.element.batchGroupId',
    'components.element.fitMode'
]);

const getElementDefaults = () => {
    return editor.call('components:getDefault', 'element') || {};
};

const getElementRuntime = (object: THREE.Object3D): ElementRuntime => {
    if (!object.userData.__elementRuntime) {
        object.userData.__elementRuntime = {
            loadToken: 0
        } satisfies ElementRuntime;
    }

    return object.userData.__elementRuntime as ElementRuntime;
};

const clearElementRuntime = (object: THREE.Object3D) => {
    delete object.userData.__elementRuntime;
    clearBridgeComponent(object, 'element');
};

const getElementSize = (observer: import('@/editor-api').EntityObserver) => {
    return [
        Math.max(0.24, readNumber(observer.get('components.element.width'), 100) * UI_WORLD_SCALE),
        Math.max(0.12, readNumber(observer.get('components.element.height'), 32) * UI_WORLD_SCALE)
    ] as [number, number];
};

const getElementPivot = (observer: import('@/editor-api').EntityObserver) => {
    return readVec2(observer.get('components.element.pivot'), [0.5, 0.5]);
};

const updateElementTexture = async (
    observer: import('@/editor-api').EntityObserver,
    sprite: THREE.Sprite,
    runtime: ElementRuntime
) => {
    const token = ++runtime.loadToken;
    let texture: THREE.Texture | null = null;

    const textureAsset = observer.get('components.element.textureAsset');
    const spriteAsset = observer.get('components.element.spriteAsset');
    const spriteFrame = readNumber(observer.get('components.element.spriteFrame'), 0);

    if (textureAsset) {
        texture = await loadTextureAsset(textureAsset);
    } else if (spriteAsset) {
        const frameTexture = await loadSpriteFrameTexture(spriteAsset, spriteFrame);
        texture = frameTexture?.texture || null;
        if (frameTexture) {
            sprite.center.set(frameTexture.pivot[0], frameTexture.pivot[1]);
        }
    }

    if (runtime.loadToken !== token || !texture) {
        return;
    }

    sprite.material = new THREE.SpriteMaterial({
        map: texture,
        color: readColor3(observer.get('components.element.color'), [1, 1, 1]),
        transparent: true,
        opacity: readNumber(observer.get('components.element.opacity'), 1),
        depthWrite: false
    });
};

export const createElementData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'element', getElementDefaults());
};

export const createElementComponentData = createElementData;

export const applyElementObserverChange = (
    object: THREE.Object3D,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const elementData = observer.get('components.element');
    if (!elementData) {
        clearElementRuntime(object);
        return true;
    }

    setStoredBridgeComponentData(object, 'element', elementData);

    if (NO_THREE_EQUIVALENT_PATHS.has(path)) {
        // No Three.js equivalent for this UI-layout-only property in the bridge.
        return true;
    }

    const group = ensureBridgeHelper(object, 'element:group', () => new THREE.Group());
    const outline = ensureBridgeHelper(object, 'element:outline', () => {
        return createRectangleOutline(1, 1, '#7dd3fc');
    }, group) as THREE.Line;
    const sprite = ensureBridgeHelper(object, 'element:visual', () => {
        return new THREE.Sprite(new THREE.SpriteMaterial({
            color: '#ffffff',
            transparent: true,
            depthWrite: false
        }));
    }, group) as THREE.Sprite;

    const [width, height] = getElementSize(observer);
    const pivot = getElementPivot(observer);
    const anchor = readVec4(observer.get('components.element.anchor'), [0.5, 0.5, 0.5, 0.5]);
    const anchorOffsetX = (((anchor[0] + anchor[2]) * 0.5) - 0.5) * width;
    const anchorOffsetY = (((anchor[1] + anchor[3]) * 0.5) - 0.5) * height;
    group.position.set(anchorOffsetX, anchorOffsetY, 0);
    updateRectangleOutline(outline, width, height, pivot);
    outline.visible = !!observer.get('components.element.enabled');

    const type = String(observer.get('components.element.type') || 'group');
    const opacity = readNumber(observer.get('components.element.opacity'), 1);
    sprite.visible = !!observer.get('components.element.enabled');
    sprite.position.z = 0.001;

    if (type === 'text') {
        updateLabelSprite(sprite, {
            text: String(observer.get('components.element.text') || 'Text'),
            textColor: `#${readColor3(observer.get('components.element.color')).getHexString()}`,
            backgroundColor: 'rgba(12, 18, 32, 0.58)',
            borderColor: 'rgba(125, 211, 252, 0.92)',
            fontSize: Math.max(18, readNumber(observer.get('components.element.fontSize'), 32)),
            scale: 0.004
        });
        sprite.scale.set(width, height, 1);
        sprite.material.opacity = opacity;
    } else if (type === 'image') {
        const runtime = getElementRuntime(object);
        sprite.scale.set(width, height, 1);
        sprite.center.set(pivot[0], pivot[1]);
        void updateElementTexture(observer, sprite, runtime);
    } else {
        updateLabelSprite(sprite, {
            text: 'GROUP',
            backgroundColor: 'rgba(16, 24, 40, 0.45)',
            borderColor: 'rgba(125, 211, 252, 0.82)',
            scale: 0.004
        });
        sprite.scale.set(width * 0.6, height * 0.4, 1);
        sprite.material.opacity = opacity;
    }

    return true;
};
