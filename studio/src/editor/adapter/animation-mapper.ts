import * as THREE from 'three';

import {
    clearBridgeComponent,
    ensureLabelSprite,
    getStoredBridgeComponentData,
    loadAnimationClipsForAssets,
    resolveAssetObserver,
    setBridgeUpdater,
    setStoredBridgeComponentData
} from './bridge-utils';


type AnimationRuntime = {
    mixer: THREE.AnimationMixer | null;
    action: THREE.AnimationAction | null;
    currentClipName: string | null;
    clipMap: Map<string, THREE.AnimationClip>;
    loadToken: number;
};

const NO_THREE_EQUIVALENT_PATHS = new Set<string>([]);

const getAnimationDefaults = () => {
    return editor.call('components:getDefault', 'animation') || {};
};

const getAnimationRuntime = (object: THREE.Object3D): AnimationRuntime => {
    if (!object.userData.__animationRuntime) {
        object.userData.__animationRuntime = {
            mixer: null,
            action: null,
            currentClipName: null,
            clipMap: new Map<string, THREE.AnimationClip>(),
            loadToken: 0
        } satisfies AnimationRuntime;
    }

    return object.userData.__animationRuntime as AnimationRuntime;
};

const disposeAnimationRuntime = (object: THREE.Object3D) => {
    const runtime = object.userData.__animationRuntime as AnimationRuntime | undefined;
    runtime?.action?.stop();
    runtime?.mixer?.stopAllAction();
    delete object.userData.__animationRuntime;
    clearBridgeComponent(object, 'animation');
};

const getSelectedClipName = (
    observer: import('@/editor-api').EntityObserver,
    clipMap: Map<string, THREE.AnimationClip>
) => {
    const runtimeAnimation = observer.entity?.animation as {
        currAnim?: string | null;
        playing?: boolean;
    } | undefined;

    if (runtimeAnimation?.currAnim && clipMap.has(runtimeAnimation.currAnim)) {
        return runtimeAnimation.currAnim;
    }

    const animationData = observer.get('components.animation') as {
        assets?: number[];
    } | undefined;
    const assets = Array.isArray(animationData?.assets) ? animationData.assets : [];
    for (const assetId of assets) {
        const asset = resolveAssetObserver(assetId);
        const assetName = String(asset?.get('name') || '');
        if (assetName && clipMap.has(assetName)) {
            return assetName;
        }

        const stripped = assetName.replace(/\.[^.]+$/, '');
        if (stripped && clipMap.has(stripped)) {
            return stripped;
        }
    }

    return clipMap.keys().next().value || null;
};

const syncAnimationClips = async (
    object: THREE.Object3D,
    observer: import('@/editor-api').EntityObserver,
    runtime: AnimationRuntime
) => {
    const assets = observer.get('components.animation.assets') as number[] || [];
    const token = ++runtime.loadToken;
    const clipMap = new Map<string, THREE.AnimationClip>();
    const clipsByAsset = await loadAnimationClipsForAssets(assets);

    if (runtime.loadToken !== token) {
        return;
    }

    clipsByAsset.forEach((clips, assetId) => {
        const asset = resolveAssetObserver(assetId);
        const assetName = String(asset?.get('name') || '').trim();
        const strippedName = assetName.replace(/\.[^.]+$/, '');

        clips.forEach((clip, index) => {
            clipMap.set(clip.name, clip);
            if (clips.length === 1 && assetName) {
                clipMap.set(assetName, clip);
            }
            if (clips.length === 1 && strippedName) {
                clipMap.set(strippedName, clip);
            }
            if (!clip.name && assetName) {
                clipMap.set(`${assetName}:${index}`, clip);
            }
        });
    });

    runtime.clipMap = clipMap;
};

const syncAnimationAction = (
    object: THREE.Object3D,
    observer: import('@/editor-api').EntityObserver,
    runtime: AnimationRuntime
) => {
    const animationData = observer.get('components.animation') as {
        enabled?: boolean;
        speed?: number;
        loop?: boolean;
        activate?: boolean;
    } | undefined;

    if (!animationData?.enabled || runtime.clipMap.size === 0) {
        runtime.action?.stop();
        runtime.action = null;
        runtime.currentClipName = null;
        return;
    }

    if (!runtime.mixer) {
        runtime.mixer = new THREE.AnimationMixer(object);
    }

    const clipName = getSelectedClipName(observer, runtime.clipMap);
    if (!clipName) {
        return;
    }

    const clip = runtime.clipMap.get(clipName);
    if (!clip) {
        return;
    }

    if (runtime.currentClipName !== clipName || !runtime.action) {
        runtime.action?.stop();
        runtime.action = runtime.mixer.clipAction(clip);
        runtime.currentClipName = clipName;
        runtime.action.reset();
    }

    runtime.action.loop = animationData.loop === false ? THREE.LoopOnce : THREE.LoopRepeat;
    runtime.action.clampWhenFinished = true;
    runtime.action.timeScale = Number(animationData.speed ?? 1);

    const runtimeAnimation = observer.entity?.animation as {
        playing?: boolean;
        currentTime?: number;
    } | undefined;
    const shouldPlay = !!animationData.activate && (runtimeAnimation?.playing ?? true);

    if (runtimeAnimation && typeof runtimeAnimation.currentTime === 'number') {
        runtime.action.time = runtimeAnimation.currentTime;
    }

    if (shouldPlay) {
        runtime.action.paused = false;
        runtime.action.play();
    } else if (runtime.action.isRunning()) {
        runtime.action.paused = true;
    }
};

export const createAnimationData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'animation', getAnimationDefaults());
};

export const createAnimationComponentData = createAnimationData;

export const applyAnimationObserverChange = (
    object: THREE.Object3D,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    if (NO_THREE_EQUIVALENT_PATHS.has(path)) {
        // No Three.js equivalent for this animation path in the bridge.
        return false;
    }

    const animationData = observer.get('components.animation');
    if (!animationData) {
        disposeAnimationRuntime(object);
        return true;
    }

    setStoredBridgeComponentData(object, 'animation', animationData);

    const label = ensureLabelSprite(object, 'animation:label', {
        text: 'ANIM',
        backgroundColor: 'rgba(26, 77, 132, 0.88)',
        borderColor: 'rgba(162, 214, 255, 0.95)',
        scale: 0.006,
        fontSize: 34
    });
    label.position.set(0, 0.42, 0);
    label.visible = !!observer.get('components.animation.enabled');

    const runtime = getAnimationRuntime(object);
    void syncAnimationClips(object, observer, runtime).then(() => {
        syncAnimationAction(object, observer, runtime);
    });

    setBridgeUpdater(object, 'animation', (delta) => {
        syncAnimationAction(object, observer, runtime);
        runtime.mixer?.update(delta);
    });

    return true;
};
