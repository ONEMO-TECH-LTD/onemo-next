import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';

import EffectViewer, {
    type EffectViewerBridge,
    type EffectViewerTransformSnapshot,
    type ViewerCameraCommand,
    type ViewerCameraPreset,
    type ViewerRenderPass
} from '../../../../src/app/(dev)/prototype/core/EffectViewer';
import type { DesignState, ViewerConfig } from '../../../../src/app/(dev)/prototype/types';

import { createObserverR3FBridge } from '../adapter/observer-r3f-bridge';
import { createDefaultViewerConfig } from '../adapter/scene-schema';

const DEFAULT_DESIGN_STATE: DesignState = {
    offsetX: 0,
    offsetY: 0,
    scale: 1
};

const DEFAULT_CONFIG: ViewerConfig = createDefaultViewerConfig();

const DEFAULT_ARTWORK_URL = '/assets/test-artwork.png';
const LAST_SCENE_STORAGE_KEY = 'onemo.playcanvas.last-scene';

type SelectableObserver = {
    get: (path: string) => unknown;
};

type DropTargetHandle = {
    destroy: () => void;
    dom: HTMLElement;
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
    const [renderPass, setRenderPass] = useState<ViewerRenderPass>('standard');
    const [wireframeEnabled, setWireframeEnabled] = useState(false);
    const [cameraCommand, setCameraCommand] = useState<ViewerCameraCommand | null>(null);

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

        const syncRenderPass = (mode?: ViewerRenderPass | null) => {
            setRenderPass(mode || 'standard');
        };

        const syncWireframe = (enabled?: boolean | null) => {
            setWireframeEnabled(!!enabled);
        };

        const focusSelection = () => {
            setCameraCommand({
                kind: 'focus',
                seq: Date.now()
            });
        };

        const setCameraPreset = (preset?: ViewerCameraPreset | null) => {
            if (!preset) {
                return;
            }

            setCameraCommand({
                kind: 'preset',
                preset,
                seq: Date.now()
            });
        };

        const selectionHandle = editor.on('selector:change', syncSelection);
        const gizmoTypeHandle = editor.on('gizmo:type', syncGizmoMode);
        const gizmoSpaceHandle = editor.on('gizmo:coordSystem', syncGizmoSpace);
        const renderPassHandle = editor.on('r3f:viewer:renderPass', syncRenderPass);
        const wireframeHandle = editor.on('r3f:viewer:wireframe', syncWireframe);
        const focusHandle = editor.on('r3f:viewer:focus', focusSelection);
        const cameraPresetHandle = editor.on('r3f:viewer:cameraPreset', setCameraPreset);

        syncSelection(
            editor.call('selector:type') as string | null,
            editor.call('selector:items') as SelectableObserver[] || []
        );
        syncGizmoMode(editor.call('gizmo:type') as string | null);
        syncGizmoSpace(editor.call('gizmo:coordSystem') as string | null);
        syncRenderPass('standard');
        syncWireframe(false);

        return () => {
            selectionHandle.unbind();
            gizmoTypeHandle.unbind();
            gizmoSpaceHandle.unbind();
            renderPassHandle.unbind();
            wireframeHandle.unbind();
            focusHandle.unbind();
            cameraPresetHandle.unbind();
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
            renderPass={renderPass}
            wireframeEnabled={wireframeEnabled}
            cameraCommand={cameraCommand}
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
    let lastMaterialDropPoint: { x: number; y: number } | null = null;
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

    const pickMaterialDropTarget = (clientX: number, clientY: number) => {
        if (!currentContext) {
            return null;
        }

        const rect = overlay.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            return null;
        }

        const pointer = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, currentContext.camera);

        const hit = raycaster
        .intersectObjects(currentContext.scene.children, true)
        .find((entry) => !!bridge.getResourceIdForObject(entry.object));

        if (!hit) {
            return null;
        }

        const resourceId = bridge.getResourceIdForObject(hit.object);
        if (!resourceId) {
            return null;
        }

        const mesh = hit.object as THREE.Mesh;
        const materialIndex = Array.isArray(mesh.material)
            ? ((hit as THREE.Intersection<THREE.Object3D> & { face?: { materialIndex?: number } }).face?.materialIndex ?? 0)
            : 0;

        return {
            resourceId,
            materialIndex
        };
    };

    const updateMaterialDropPoint = (event: DragEvent) => {
        lastMaterialDropPoint = {
            x: event.clientX,
            y: event.clientY
        };
        event.preventDefault();
    };

    editor.method('r3f:bridge:setHidden', (resourceId: string, hidden: boolean) => {
        bridge.setViewportHidden(resourceId, hidden);
    });
    editor.method('r3f:bridge:isVisible', (resourceId: string) => {
        return !!bridge.getObjectById(resourceId)?.visible;
    });
    editor.method('r3f:bridge:isLocalAsset', (assetId: number | string) => {
        return bridge.isLocalAsset(assetId);
    });
    editor.method('r3f:bridge:renameLocalAsset', (assetId: number | string, name: string) => {
        return bridge.renameLocalAsset(assetId, name);
    });
    editor.method('r3f:bridge:dropMaterial', (assetId: number, clientX?: number, clientY?: number) => {
        const point = clientX !== undefined && clientY !== undefined
            ? { x: clientX, y: clientY }
            : lastMaterialDropPoint;
        if (!point) {
            return false;
        }

        const target = pickMaterialDropTarget(point.x, point.y);
        if (!target) {
            return false;
        }

        return bridge.applyMaterialAssetToResource(target.resourceId, assetId, target.materialIndex);
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

    const materialDropTarget = editor.call('drop:target', {
        ref: overlay,
        type: 'asset.material',
        hole: true,
        passThrough: true,
        drop: (_type: string, data: { id?: string }) => {
            const assetId = Number(data?.id);
            if (!Number.isFinite(assetId)) {
                return false;
            }

            return editor.call('r3f:bridge:dropMaterial', assetId);
        },
        leave: () => {
            lastMaterialDropPoint = null;
        }
    }) as DropTargetHandle;
    overlay.addEventListener('dragover', updateMaterialDropPoint);

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

        const sceneBlob = await response.blob();
        if (!(await bridge.deserializeScene(sceneBlob))) {
            throw new Error('Bridge is not ready for scene deserialization');
        }
        setLastSceneName(sceneName);
    };

    const saveSceneByName = async (name: string) => {
        const sceneName = name.trim();
        if (!sceneName) {
            return;
        }

        const payload = await bridge.serializeScene(sceneName);
        const response = await fetch('/api/onemo/scenes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-Scene-Name': sceneName
            },
            body: payload
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
        overlay.removeEventListener('dragover', updateMaterialDropPoint);
        materialDropTarget.destroy();
        lastMaterialDropPoint = null;
        currentContext = null;
        bridge.dispose();
        root.unmount();
        overlay.remove();
        canvasDom.style.removeProperty('opacity');
        canvasDom.style.removeProperty('pointer-events');
    };
}
