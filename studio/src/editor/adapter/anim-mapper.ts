import * as THREE from 'three';

import {
    clearBridgeComponent,
    ensureLabelSprite,
    getStoredBridgeComponentData,
    isRecord,
    loadAnimationClipsForAssets,
    setBridgeUpdater,
    setStoredBridgeComponentData
} from './bridge-utils';


type AnimRuntime = {
    mixer: THREE.AnimationMixer | null;
    action: THREE.AnimationAction | null;
    currentClipName: string | null;
    clipMap: Map<string, THREE.AnimationClip>;
    loadToken: number;
};

const NO_THREE_EQUIVALENT_PATHS = new Set([
    'components.anim.masks',
    'components.anim.normalizeWeights',
    'components.anim.stateGraphAsset'
]);

const getAnimDefaults = () => {
    return editor.call('components:getDefault', 'anim') || {};
};

const getAnimRuntime = (object: THREE.Object3D): AnimRuntime => {
    if (!object.userData.__animRuntime) {
        object.userData.__animRuntime = {
            mixer: null,
            action: null,
            currentClipName: null,
            clipMap: new Map<string, THREE.AnimationClip>(),
            loadToken: 0
        } satisfies AnimRuntime;
    }

    return object.userData.__animRuntime as AnimRuntime;
};

const disposeAnimRuntime = (object: THREE.Object3D) => {
    const runtime = object.userData.__animRuntime as AnimRuntime | undefined;
    runtime?.action?.stop();
    runtime?.mixer?.stopAllAction();
    delete object.userData.__animRuntime;
    clearBridgeComponent(object, 'anim');
};

const getAnimationAssetIds = (observer: import('@/editor-api').EntityObserver) => {
    const animationAssets = observer.get('components.anim.animationAssets');
    if (!isRecord(animationAssets)) {
        return [];
    }

    return Object.values(animationAssets)
    .map((value) => {
        return isRecord(value) ? Number(value.asset) : NaN;
    })
    .filter((value) => Number.isFinite(value));
};

const syncAnimClips = async (
    object: THREE.Object3D,
    observer: import('@/editor-api').EntityObserver,
    runtime: AnimRuntime
) => {
    const assetIds = getAnimationAssetIds(observer);
    const token = ++runtime.loadToken;
    const clipsByAsset = await loadAnimationClipsForAssets(assetIds);
    if (runtime.loadToken !== token) {
        return;
    }

    const clipMap = new Map<string, THREE.AnimationClip>();
    const animationAssets = observer.get('components.anim.animationAssets');
    if (isRecord(animationAssets)) {
        Object.entries(animationAssets).forEach(([pathKey, value]) => {
            const assetId = isRecord(value) ? Number(value.asset) : NaN;
            if (!Number.isFinite(assetId)) {
                return;
            }

            const clips = clipsByAsset.get(assetId) || [];
            const stateName = pathKey.split(':').slice(1).join(':') || pathKey;
            clips.forEach((clip) => {
                clipMap.set(clip.name, clip);
                if (clips.length === 1) {
                    clipMap.set(stateName, clip);
                }
            });
        });
    }

    runtime.clipMap = clipMap;
};

const syncAnimAction = (
    object: THREE.Object3D,
    observer: import('@/editor-api').EntityObserver,
    runtime: AnimRuntime
) => {
    const data = observer.get('components.anim') as {
        enabled?: boolean;
        speed?: number;
        activate?: boolean;
        playing?: boolean;
    } | undefined;
    if (!data?.enabled || runtime.clipMap.size === 0) {
        runtime.action?.stop();
        runtime.action = null;
        runtime.currentClipName = null;
        return;
    }

    if (!runtime.mixer) {
        runtime.mixer = new THREE.AnimationMixer(object);
    }

    const runtimeAnim = observer.entity?.anim as {
        baseLayer?: {
            activeStateName?: string;
            activeStateCurrentTime?: number;
        };
        playing?: boolean;
    } | undefined;

    const preferredClipName = runtimeAnim?.baseLayer?.activeStateName && runtime.clipMap.has(runtimeAnim.baseLayer.activeStateName)
        ? runtimeAnim.baseLayer.activeStateName
        : runtime.clipMap.keys().next().value || null;
    if (!preferredClipName) {
        return;
    }

    const clip = runtime.clipMap.get(preferredClipName);
    if (!clip) {
        return;
    }

    if (runtime.currentClipName !== preferredClipName || !runtime.action) {
        runtime.action?.stop();
        runtime.action = runtime.mixer.clipAction(clip);
        runtime.currentClipName = preferredClipName;
        runtime.action.reset();
    }

    runtime.action.loop = THREE.LoopRepeat;
    runtime.action.clampWhenFinished = true;
    runtime.action.timeScale = Number(data.speed ?? 1);

    if (runtimeAnim?.baseLayer && typeof runtimeAnim.baseLayer.activeStateCurrentTime === 'number') {
        runtime.action.time = runtimeAnim.baseLayer.activeStateCurrentTime;
    }

    const shouldPlay = !!data.activate && (runtimeAnim?.playing ?? observer.get('components.anim.playing') ?? true);
    if (shouldPlay) {
        runtime.action.paused = false;
        runtime.action.play();
    } else if (runtime.action.isRunning()) {
        runtime.action.paused = true;
    }
};

export const createAnimData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'anim', getAnimDefaults());
};

export const createAnimComponentData = createAnimData;

export const applyAnimObserverChange = (
    object: THREE.Object3D,
    path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const animData = observer.get('components.anim');
    if (!animData) {
        disposeAnimRuntime(object);
        return true;
    }

    setStoredBridgeComponentData(object, 'anim', animData);

    if (NO_THREE_EQUIVALENT_PATHS.has(path)) {
        // No Three.js equivalent for masks, normalizeWeights, or full state-graph assets.
        return true;
    }

    const label = ensureLabelSprite(object, 'anim:label', {
        text: 'STATE',
        backgroundColor: 'rgba(20, 95, 68, 0.88)',
        borderColor: 'rgba(164, 255, 220, 0.95)',
        scale: 0.006,
        fontSize: 34
    });
    label.position.set(0, 0.5, 0);
    label.visible = !!observer.get('components.anim.enabled');

    const runtime = getAnimRuntime(object);
    void syncAnimClips(object, observer, runtime).then(() => {
        syncAnimAction(object, observer, runtime);
    });

    setBridgeUpdater(object, 'anim', (delta) => {
        syncAnimAction(object, observer, runtime);
        runtime.mixer?.update(delta);
    });

    return true;
};
