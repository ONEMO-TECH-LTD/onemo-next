import * as THREE from 'three';

import { clearBridgeComponent, ensureLabelSprite, getStoredBridgeComponentData, setStoredBridgeComponentData } from './bridge-utils';
import { getBridgeAudioListener, isBridgeAudioListenerOwner, setBridgeAudioListenerOwner } from './bridge-audio-state';


const getAudioListenerDefaults = () => {
    return editor.call('components:getDefault', 'audiolistener') || {};
};

export const createAudiolistenerData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'audiolistener', getAudioListenerDefaults());
};

export const createAudiolistenerComponentData = createAudiolistenerData;

export const applyAudiolistenerObserverChange = (
    object: THREE.Object3D,
    _path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const data = observer.get('components.audiolistener');
    if (!data) {
        if (isBridgeAudioListenerOwner(object.uuid)) {
            setBridgeAudioListenerOwner(null);
        }
        clearBridgeComponent(object, 'audiolistener');
        return true;
    }

    setStoredBridgeComponentData(object, 'audiolistener', data);

    const label = ensureLabelSprite(object, 'audiolistener:label', {
        text: 'LISTEN',
        backgroundColor: 'rgba(40, 92, 132, 0.88)',
        borderColor: 'rgba(187, 233, 255, 0.95)',
        scale: 0.006,
        fontSize: 34
    });
    label.position.set(0, 0.58, 0);
    label.visible = !!observer.get('components.audiolistener.enabled');

    if (observer.get('components.audiolistener.enabled')) {
        getBridgeAudioListener();
        setBridgeAudioListenerOwner(object.uuid);
    } else if (isBridgeAudioListenerOwner(object.uuid)) {
        setBridgeAudioListenerOwner(null);
    }

    return true;
};
