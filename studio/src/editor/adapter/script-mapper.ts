import * as THREE from 'three';

import { clearBridgeComponent, ensureLabelSprite, getStoredBridgeComponentData, isRecord, setStoredBridgeComponentData } from './bridge-utils';


const getScriptDefaults = () => {
    return editor.call('components:getDefault', 'script') || {};
};

export const createScriptData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'script', getScriptDefaults());
};

export const createScriptComponentData = createScriptData;

export const applyScriptObserverChange = (
    object: THREE.Object3D,
    _path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const scriptData = observer.get('components.script');
    if (!scriptData) {
        delete object.userData.script;
        clearBridgeComponent(object, 'script');
        return true;
    }

    setStoredBridgeComponentData(object, 'script', scriptData);
    object.userData.script = scriptData;

    const scripts = isRecord(observer.get('components.script.scripts'))
        ? Object.keys(observer.get('components.script.scripts')).length
        : 0;
    const label = ensureLabelSprite(object, 'script:label', {
        text: scripts > 0 ? `S${scripts}` : 'S',
        backgroundColor: 'rgba(55, 65, 81, 0.88)',
        borderColor: 'rgba(229, 231, 235, 0.95)',
        scale: 0.005,
        fontSize: 32
    });
    label.position.set(0.18, 0.42, 0);
    label.visible = !!observer.get('components.script.enabled');

    return true;
};
