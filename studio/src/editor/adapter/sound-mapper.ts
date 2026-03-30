import * as THREE from 'three';

import {
    clearBridgeComponent,
    ensureBridgeHelper,
    ensureLabelSprite,
    getStoredBridgeComponentData,
    isRecord,
    loadAudioAsset,
    readNumber,
    setStoredBridgeComponentData
} from './bridge-utils';
import { getBridgeAudioListener } from './bridge-audio-state';


type SoundRuntime = {
    positional: boolean | null;
    slots: Record<string, THREE.Audio | THREE.PositionalAudio>;
};

const getSoundDefaults = () => {
    return editor.call('components:getDefault', 'sound') || {};
};

const getSoundRuntime = (object: THREE.Object3D): SoundRuntime => {
    if (!object.userData.__soundRuntime) {
        object.userData.__soundRuntime = {
            positional: null,
            slots: {}
        } satisfies SoundRuntime;
    }

    return object.userData.__soundRuntime as SoundRuntime;
};

const disposeSoundRuntime = (object: THREE.Object3D) => {
    const runtime = object.userData.__soundRuntime as SoundRuntime | undefined;
    Object.values(runtime?.slots || {}).forEach((audio) => {
        if (audio.isPlaying) {
            audio.stop();
        }
        audio.parent?.remove(audio);
    });
    delete object.userData.__soundRuntime;
    delete object.userData.sound;
    clearBridgeComponent(object, 'sound');
};

const createAudioNode = (positional: boolean) => {
    const listener = getBridgeAudioListener();
    return positional
        ? new THREE.PositionalAudio(listener)
        : new THREE.Audio(listener);
};

const syncSoundSlots = async (
    object: THREE.Object3D,
    observer: import('@/editor-api').EntityObserver,
    runtime: SoundRuntime,
    container: THREE.Group
) => {
    const positional = !!observer.get('components.sound.positional');
    const soundSlots = observer.get('components.sound.slots');
    const slotEntries = isRecord(soundSlots)
        ? Object.entries(soundSlots)
        : [];

    if (runtime.positional !== positional) {
        Object.values(runtime.slots).forEach((audio) => {
            if (audio.isPlaying) {
                audio.stop();
            }
            audio.parent?.remove(audio);
        });
        runtime.slots = {};
        runtime.positional = positional;
    }

    const activeKeys = new Set(slotEntries.map(([key]) => key));
    Object.keys(runtime.slots).forEach((key) => {
        if (!activeKeys.has(key)) {
            const audio = runtime.slots[key];
            if (audio.isPlaying) {
                audio.stop();
            }
            audio.parent?.remove(audio);
            delete runtime.slots[key];
        }
    });

    const componentVolume = readNumber(observer.get('components.sound.volume'), 1);
    const componentPitch = readNumber(observer.get('components.sound.pitch'), 1);
    const refDistance = readNumber(observer.get('components.sound.refDistance'), 1);
    const maxDistance = readNumber(observer.get('components.sound.maxDistance'), 10000);
    const rollOffFactor = readNumber(observer.get('components.sound.rollOffFactor'), 1);
    const distanceModel = String(observer.get('components.sound.distanceModel') || 'linear');
    const enabled = !!observer.get('components.sound.enabled');

    await Promise.all(slotEntries.map(async ([slotKey, slotValue]) => {
        if (!isRecord(slotValue) || !slotValue.asset) {
            const staleAudio = runtime.slots[slotKey];
            if (staleAudio) {
                if (staleAudio.isPlaying) {
                    staleAudio.stop();
                }
                staleAudio.parent?.remove(staleAudio);
                delete runtime.slots[slotKey];
            }
            return;
        }

        let audio = runtime.slots[slotKey];
        if (!audio) {
            audio = createAudioNode(positional);
            runtime.slots[slotKey] = audio;
            container.add(audio);
        }

        const buffer = await loadAudioAsset(slotValue.asset);
        if (!buffer) {
            return;
        }

        const assetId = Number(slotValue.asset);
        if (audio.userData.assetId !== assetId) {
            if (audio.isPlaying) {
                audio.stop();
            }
            audio.setBuffer(buffer);
            audio.userData.assetId = assetId;
        }

        audio.setLoop(!!slotValue.loop);
        audio.setVolume(componentVolume * readNumber(slotValue.volume, 1));
        audio.setPlaybackRate(componentPitch * readNumber(slotValue.pitch, 1));

        if (audio instanceof THREE.PositionalAudio) {
            audio.setRefDistance(refDistance);
            audio.setMaxDistance(maxDistance);
            audio.setRolloffFactor(rollOffFactor);
            audio.setDistanceModel(distanceModel as DistanceModelType);
        }

        if (enabled && slotValue.autoPlay && !audio.isPlaying) {
            audio.offset = readNumber(slotValue.startTime, 0);
            audio.play();
        }

        if (!enabled && audio.isPlaying) {
            audio.stop();
        }
    }));
};

export const createSoundData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'sound', getSoundDefaults());
};

export const createSoundComponentData = createSoundData;

export const applySoundObserverChange = (
    object: THREE.Object3D,
    _path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const soundData = observer.get('components.sound');
    if (!soundData) {
        disposeSoundRuntime(object);
        return true;
    }

    setStoredBridgeComponentData(object, 'sound', soundData);
    object.userData.sound = soundData;

    const group = ensureBridgeHelper(object, 'sound:group', () => new THREE.Group());
    const label = ensureLabelSprite(object, 'sound:label', {
        text: 'SOUND',
        backgroundColor: 'rgba(118, 69, 20, 0.88)',
        borderColor: 'rgba(255, 221, 168, 0.95)',
        scale: 0.006,
        fontSize: 34
    });
    label.position.set(0, 0.52, 0);

    const sphere = ensureBridgeHelper(object, 'sound:sphere', () => {
        return new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 16, 12),
            new THREE.MeshBasicMaterial({
                color: '#ffb347',
                wireframe: true,
                transparent: true,
                opacity: 0.9
            })
        );
    }, group);
    sphere.visible = !!observer.get('components.sound.enabled');
    label.visible = sphere.visible;

    const runtime = getSoundRuntime(object);
    void syncSoundSlots(object, observer, runtime, group as THREE.Group);

    return true;
};
