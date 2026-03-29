import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';

import EffectViewer, {
    type EffectViewerBridge,
    type EffectViewerTransformSnapshot
} from '../../../../src/app/(dev)/prototype/core/EffectViewer';
import type { DesignState, ViewerConfig } from '../../../../src/app/(dev)/prototype/types';

import { createObserverR3FBridge, type SavedScene } from '../adapter/observer-r3f-bridge';

const DEFAULT_TEXTURES = {
    normal: '/assets/materials/ultrasuede/suede-normal.png',
    roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
    height: '/assets/materials/ultrasuede/suede-height.png'
};

const DEFAULT_DESIGN_STATE: DesignState = {
    offsetX: 0,
    offsetY: 0,
    scale: 1
};

const DEFAULT_CONFIG: ViewerConfig = {
    modelPath: '/assets/shapes/effect-70mm-step.glb',
    face: {
        params: {
            roughness: 1,
            metalness: 0,
            envMapIntensity: 0.1,
            normalScale: 0.15,
            bumpScale: 1,
            sheen: 1,
            sheenColor: '#1a1a1a',
            sheenRoughness: 0.8,
            colorMultiplier: 1
        },
        textures: DEFAULT_TEXTURES
    },
    back: {
        params: {
            color: '#080808',
            roughness: 1,
            envMapIntensity: 0.1,
            normalScale: 0.15,
            bumpScale: 1,
            sheen: 1,
            sheenColor: '#1a1a1a',
            sheenRoughness: 0.8
        },
        textures: DEFAULT_TEXTURES
    },
    frame: {
        params: {
            color: '#0f0f0f',
            roughness: 0.5,
            metalness: 0,
            clearcoat: 0.4,
            clearcoatRoughness: 0.3
        },
        textures: {}
    },
    scene: {
        exposure: 0.7,
        ambientIntensity: 0.5,
        envIntensity: 1,
        background: '#ffffff'
    },
    colors: {
        backColor: '#080808',
        frameColor: '#0f0f0f',
        bgColor: '#111315'
    },
    camera: {
        fov: 35,
        distance: 0.2,
        polarAngle: 90,
        azimuthAngle: 0,
        enableDamping: true,
        dampingFactor: 0.1,
        autoRotate: false,
        autoRotateSpeed: 2
    },
    environment: {
        preset: 'studio',
        customHdri: '/assets/env/studio.exr',
        envRotation: 0,
        groundEnabled: false,
        groundHeight: 0,
        groundRadius: 20
    }
};

const DEFAULT_ARTWORK_URL = '/assets/test-artwork.png';
const LAST_SCENE_STORAGE_KEY = 'onemo.playcanvas.last-scene';

type SelectableObserver = {
    get: (path: string) => unknown;
};

type GizmoMode = 'translate' | 'rotate' | 'scale' | 'disabled';
type GizmoSpace = 'world' | 'local';

function BridgeViewportApp({
    bridge,
    viewerConfig,
    onContextReady
}: {
    bridge: ReturnType<typeof createObserverR3FBridge>;
    viewerConfig: ViewerConfig;
    onContextReady?: (context: EffectViewerBridge) => void;
}) {
    const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
    const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate');
    const [gizmoSpace, setGizmoSpace] = useState<GizmoSpace>('local');

    useEffect(() => {
        const syncSelection = (type: string | null, items: SelectableObserver[] = []) => {
            if (type !== 'entity') {
                setSelectedResourceIds([]);
                return;
            }

            setSelectedResourceIds(items
            .map(item => item.get('resource_id'))
            .filter((resourceId): resourceId is string => typeof resourceId === 'string'));
        };

        const syncGizmoMode = (mode?: string | null) => {
            if (mode === 'translate' || mode === 'rotate' || mode === 'scale') {
                setGizmoMode(mode);
            } else {
                setGizmoMode('disabled');
            }
        };

        const syncGizmoSpace = (space?: string | null) => {
            setGizmoSpace(space === 'world' ? 'world' : 'local');
        };

        const selectionHandle = editor.on('selector:change', syncSelection);
        const gizmoTypeHandle = editor.on('gizmo:type', syncGizmoMode);
        const gizmoSpaceHandle = editor.on('gizmo:coordSystem', syncGizmoSpace);

        syncSelection(
            editor.call('selector:type') as string | null,
            editor.call('selector:items') as SelectableObserver[] || []
        );
        syncGizmoMode(editor.call('gizmo:type') as string | null);
        syncGizmoSpace(editor.call('gizmo:coordSystem') as string | null);

        return () => {
            selectionHandle.unbind();
            gizmoTypeHandle.unbind();
            gizmoSpaceHandle.unbind();
        };
    }, []);

    const resolveObjectById = useMemo(() => {
        return (resourceId: string) => bridge.getObjectById(resourceId);
    }, [bridge]);
    const resolveIdByObject = useMemo(() => {
        return (object: THREE.Object3D) => bridge.getResourceIdForObject(object);
    }, [bridge]);
    const handleSelectResourceId = useCallback((resourceId: string) => {
        const observer = editor.call('entities:get', resourceId) as SelectableObserver | null;
        if (!observer) {
            return;
        }

        editor.call('selector:set', 'entity', [observer]);
        editor.emit('attributes:inspect[entity]', [observer]);
    }, []);
    const handleSceneChange = useCallback(() => {
        bridge.markSceneDirty();
    }, [bridge]);
    const handleTransformCommit = useCallback((payload: {
        resourceId: string;
        before: EffectViewerTransformSnapshot;
        after: EffectViewerTransformSnapshot;
    }) => {
        bridge.recordTransformHistory(payload.resourceId, payload.before, payload.after);
    }, [bridge]);
    const handleBridgeReady = useCallback((context: EffectViewerBridge) => {
        bridge.setContext(context);
        onContextReady?.(context);

        const hiddenIds = editor.call('entities:visibility:getHidden') as string[] || [];
        hiddenIds.forEach((resourceId) => {
            bridge.setViewportHidden(resourceId, true);
        });
    }, [bridge, onContextReady]);

    return (
        <EffectViewer
            config={viewerConfig}
            artworkUrl={DEFAULT_ARTWORK_URL}
            designState={DEFAULT_DESIGN_STATE}
            isEditing={false}
            selectedResourceIds={selectedResourceIds}
            resolveObjectById={resolveObjectById}
            resolveIdByObject={resolveIdByObject}
            onSelectResourceId={handleSelectResourceId}
            onTransformCommit={handleTransformCommit}
            onSceneChange={handleSceneChange}
            transformMode={gizmoMode}
            transformSpace={gizmoSpace}
            showGizmoHelper
            enableTransformControls
            onBridgeReady={handleBridgeReady}
        />
    );
}

export function mountEffectViewer(viewportDom: HTMLElement, canvasDom: HTMLElement) {
    const cloneViewerConfig = (value: ViewerConfig): ViewerConfig => {
        return JSON.parse(JSON.stringify(value)) as ViewerConfig;
    };
    const bridgeConfig = cloneViewerConfig(DEFAULT_CONFIG);
    let currentViewerConfig = cloneViewerConfig(bridgeConfig);
    const bridge = createObserverR3FBridge(bridgeConfig);
    let currentContext: EffectViewerBridge | null = null;
    let autoLoadAttempted = false;
    const overlay = document.createElement('div');
    overlay.className = 'viewport-r3f-overlay';
    Object.assign(overlay.style, {
        position: 'absolute',
        inset: '0',
        overflow: 'hidden'
    });

    if (!viewportDom.style.position) {
        viewportDom.style.position = 'relative';
    }

    canvasDom.style.opacity = '0';
    canvasDom.style.pointerEvents = 'none';

    viewportDom.insertBefore(overlay, canvasDom.nextSibling);

    editor.method('r3f:bridge:setHidden', (resourceId: string, hidden: boolean) => {
        bridge.setViewportHidden(resourceId, hidden);
    });
    editor.method('r3f:bridge:isVisible', (resourceId: string) => {
        return !!bridge.getObjectById(resourceId)?.visible;
    });
    editor.method('r3f:bridge:openAsset', (assets: SelectableObserver[] = []) => {
        if (!Array.isArray(assets) || assets.length !== 1) {
            return false;
        }

        const asset = assets[0];
        const type = asset.get('type');
        const fileUrl = asset.get('file.url');
        const filename = String(asset.get('file.filename') || '');
        const extension = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';
        if (typeof fileUrl !== 'string' || !fileUrl) {
            return false;
        }

        if (type === 'container' && (extension === 'glb' || extension === 'gltf')) {
            bridge.loadModel(fileUrl);
            return true;
        }

        if (type === 'texture' && (extension === 'hdr' || extension === 'exr')) {
            bridge.loadEnvironment(fileUrl);
            return true;
        }

        return false;
    });
    editor.method('r3f:bridge:projectToViewport', (resourceId: string) => {
        if (!currentContext) {
            return null;
        }

        const object = bridge.getObjectById(resourceId);
        if (!object) {
            return null;
        }

        const worldPosition = object.getWorldPosition(new THREE.Vector3());
        const projected = worldPosition.clone().project(currentContext.camera);

        return {
            world: worldPosition.toArray(),
            screen: {
                x: ((projected.x + 1) / 2) * viewportDom.clientWidth,
                y: ((1 - projected.y) / 2) * viewportDom.clientHeight,
                z: projected.z
            }
        };
    });

    const parseError = async (response: Response) => {
        try {
            const payload = await response.json() as { error?: string };
            return payload.error || response.statusText;
        } catch {
            return response.statusText;
        }
    };

    const setLastSceneName = (name: string) => {
        localStorage.setItem(LAST_SCENE_STORAGE_KEY, name);
    };

    const getLastSceneName = () => {
        return localStorage.getItem(LAST_SCENE_STORAGE_KEY) || 'default';
    };

    const fetchSceneList = async () => {
        const response = await fetch('/api/onemo/scenes');
        if (!response.ok) {
            throw new Error(await parseError(response));
        }

        const payload = await response.json() as { scenes?: string[] };
        return payload.scenes || [];
    };

    const loadSceneByName = async (name: string) => {
        const sceneName = name.trim();
        if (!sceneName) {
            return;
        }

        const response = await fetch(`/api/onemo/scenes/${encodeURIComponent(sceneName)}`);
        if (!response.ok) {
            throw new Error(await parseError(response));
        }

        const scene = await response.json() as SavedScene;
        if (!bridge.deserializeScene(scene)) {
            throw new Error('Bridge is not ready for scene deserialization');
        }

        setLastSceneName(sceneName);
    };

    const saveSceneByName = async (name: string) => {
        const sceneName = name.trim();
        if (!sceneName) {
            return;
        }

        const payload = bridge.serializeScene(sceneName);
        const response = await fetch('/api/onemo/scenes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: sceneName,
                data: payload
            })
        });

        if (!response.ok) {
            throw new Error(await parseError(response));
        }

        const result = await response.json() as { saved?: string };
        setLastSceneName(typeof result.saved === 'string' ? result.saved : sceneName);
    };

    const openScenePicker = async () => {
        const scenes = await fetchSceneList();
        if (!scenes.length) {
            window.alert('No saved scenes found.');
            return;
        }

        const preferredScene = getLastSceneName();
        const defaultSelection = scenes.includes(preferredScene) ? preferredScene : scenes[0];
        const selected = window.prompt(
            `Load scene:\n\n${scenes.join('\n')}\n`,
            defaultSelection
        );

        if (!selected) {
            return;
        }

        await loadSceneByName(selected);
    };

    const attemptAutoLoad = async () => {
        if (autoLoadAttempted) {
            return;
        }

        autoLoadAttempted = true;
        const scenes = await fetchSceneList();
        if (!scenes.length) {
            return;
        }

        const preferred = getLastSceneName();
        const fallback = scenes.includes('default') ? 'default' : null;
        const initialScene = scenes.includes(preferred) ? preferred : fallback;
        if (!initialScene) {
            return;
        }

        try {
            await loadSceneByName(initialScene);
        } catch {
            if (fallback && fallback !== initialScene) {
                await loadSceneByName(fallback);
            }
        }
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        const hasModifier = event.ctrlKey || event.metaKey;
        if (!hasModifier || event.altKey || event.shiftKey) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
        )) {
            return;
        }

        if (key === 's') {
            event.preventDefault();
            const suggestedName = getLastSceneName();
            const sceneName = window.prompt('Save scene name', suggestedName);
            if (!sceneName) {
                return;
            }

            void saveSceneByName(sceneName).catch((error) => {
                console.error('[r3f-bridge] Failed to save scene', error);
                window.alert(`Failed to save scene: ${error instanceof Error ? error.message : String(error)}`);
            });
            return;
        }

        if (key === 'o') {
            event.preventDefault();
            void openScenePicker().catch((error) => {
                console.error('[r3f-bridge] Failed to load scene', error);
                window.alert(`Failed to load scene: ${error instanceof Error ? error.message : String(error)}`);
            });
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    const root: Root = createRoot(overlay);
    const syncBridgeConfig = (nextConfig: ViewerConfig) => {
        bridgeConfig.modelPath = nextConfig.modelPath;
        bridgeConfig.face = nextConfig.face;
        bridgeConfig.back = nextConfig.back;
        bridgeConfig.frame = nextConfig.frame;
        bridgeConfig.scene = nextConfig.scene;
        bridgeConfig.colors = nextConfig.colors;
        bridgeConfig.camera = nextConfig.camera;
        bridgeConfig.environment = nextConfig.environment;
    };

    const renderViewport = () => {
        // Re-renders full JSX tree on config changes. React diffs and updates only what changed.
        // For production: consider ref-based updates to avoid prop diffing overhead.
        root.render(
            <BridgeViewportApp
                bridge={bridge}
                viewerConfig={currentViewerConfig}
                onContextReady={(context) => {
                    currentContext = context;
                    void attemptAutoLoad();
                }}
            />
        );
    };

    bridge.setViewerActions({
        updateConfig: (updater) => {
            const nextConfig = cloneViewerConfig(bridgeConfig);
            updater(nextConfig);
            currentViewerConfig = nextConfig;
            syncBridgeConfig(nextConfig);
            renderViewport();
        }
    });

    renderViewport();

    return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown);
        currentContext = null;
        bridge.dispose();
        root.unmount();
        overlay.remove();
        canvasDom.style.removeProperty('opacity');
        canvasDom.style.removeProperty('pointer-events');
    };
}
