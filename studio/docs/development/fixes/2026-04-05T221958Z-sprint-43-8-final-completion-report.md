# Sprint 43.8 — Production Readiness Fixes (MS-3/4/5) — Final Report

**Timestamp:** 2026-04-05T22:19:58Z
**Agent:** Kai (Claude Opus 4.6, CLI)
**Sprint:** KAI-4768 (Sprint 43.8: Production Readiness Fix Sprint)
**Session:** Session 43 (KAI-4398)

---

## MS-4: Branding Cleanup (KAI-4773)

### KAI-4787: Rename localStorage keys to remove playcanvas

**Status:** DONE

- Renamed `onemo.playcanvas.*` keys to `onemo.studio.*` in `effect-viewer-mount.tsx`
- Added migration: reads old key value, writes to new key, deletes old key
- Swept for other playcanvas strings in localStorage/sessionStorage usage

**Files changed:** `studio/src/editor/viewport/effect-viewer-mount.tsx`

---

## MS-5: Hardcoded Defaults Fix (KAI-4774)

### KAI-4788: Make artwork default configurable (remove test-artwork.png)

**Status:** DONE

- Removed `const DEFAULT_ARTWORK = '/assets/test-artwork.png'` from `EffectViewer.tsx`
- Changed `artworkUrl || DEFAULT_ARTWORK` to `artworkUrl` — no fallback to test asset
- Made `artworkUrl` optional in `EffectModelProps` interface (`artworkUrl?: string`)
- Removed `DEFAULT_ARTWORK` from `StudioViewport.tsx` (was already unused there, replaced with comment)
- `loadOptionalTexture` already accepts `string | undefined` — no change needed

**Files changed:**
- `src/app/(dev)/prototype/core/EffectViewer.tsx`
- `src/app/(dev)/prototype/core/EffectModel.tsx`
- `studio/src/editor/viewport/StudioViewport.tsx`

### KAI-4789: Remove or gate console.info in production save flow

**Status:** DONE

- Wrapped `console.info` at line 556 of `effect-viewer-mount.tsx` with `import.meta.env?.DEV` guard

**Files changed:** `studio/src/editor/viewport/effect-viewer-mount.tsx`

---

## MS-3: Camera Bugs (KAI-4775)

### KAI-4781: Fix orbit center drift over time

**Status:** DONE

**Root cause:** Two sources of orbit target fighting:
1. `CameraConfigSync` in `EffectViewer.tsx` called `applyCameraConfig()` 5 times (immediately + 4 retry `setTimeout` calls at 0/50/150/500ms). Each call reset `controls.target.set(...)` with the config value, overwriting any user panning.
2. The `target` prop on `<OrbitControls target={cam?.target ?? [0, 0, 0]} />` was reactive — parent re-renders with new config object references would re-apply the target, fighting with user interaction.

**Fix:**
- Removed all 4 retry `setTimeout` calls from `CameraConfigSync`. Camera config now applies once synchronously when the config signature actually changes.
- Removed the `target` prop from `<OrbitControls>`. `CameraConfigSync` already handles initial target setup imperatively via `controls.target.set()`.

**Files changed:**
- `src/app/(dev)/prototype/core/EffectViewer.tsx`

### KAI-4782: Add orbit center reset control

**Status:** ALREADY IMPLEMENTED — NO CHANGES NEEDED

- Keyboard shortcut `Numpad5` already exists in `OrbitControlsOverride` (StudioViewport.tsx:1948)
- Toolbar button already exists in `viewport-scene.ts` (line 95-109), emitting `r3f:viewer:resetOrbit`
- Both paths call `resetOrbitCenter()` which centers on selected object or falls back to scene center

### KAI-4783: Fix frustum culling

**Status:** ALREADY IMPLEMENTED — NO CHANGES NEEDED

Full wiring verified:
- Inspector UI: `type: 'boolean'` at `components.camera.frustumCulling` (camera.ts:49)
- Observer bridge: `applyCameraObserverChange` sets both `camera.userData.frustumCulling` AND `camera.frustumCulling` (camera-mapper.ts:166-171)
- Runtime: `ActiveCameraRuntimeSync` reads `camera.userData.frustumCulling` and applies `child.frustumCulled` to all meshes (StudioViewport.tsx:1222)

### KAI-4784: Fix viewport rect

**Status:** ALREADY IMPLEMENTED — NO CHANGES NEEDED

Full wiring verified:
- Inspector UI: `type: 'vec4'` at `components.camera.rect` with X/Y/W/H placeholders (camera.ts:101-110)
- Observer bridge: `applyCameraObserverChange` stores rect in `camera.userData.rect` (camera-mapper.ts:200-203)
- Runtime: `ActiveCameraRuntimeSync` normalizes rect and applies scissor+viewport clipping via `gl.setScissorTest/setViewport/setScissor` (StudioViewport.tsx:1251-1265)

### KAI-4785: Fix layers

**Status:** ALREADY IMPLEMENTED — NO CHANGES NEEDED

Full wiring verified:
- Inspector UI: `type: 'layers'` at `components.camera.layers` (camera.ts:112-115)
- Observer bridge: `applyCameraObserverChange` sets `camera.userData.layers` AND calls `camera.layers.disableAll()` / `camera.layers.enable()` (camera-mapper.ts:205-215)
- Runtime: `ActiveCameraRuntimeSync` reads `camera.userData.layers` and applies camera layer mask (StudioViewport.tsx:1214-1218)

### KAI-4786: Fix camera clear color

**Status:** DONE

**Root cause:** `ActiveCameraRuntimeSync` set `gl.setClearColor()` inside a signature-gated block. The clear color only updated when camera userData changed, but persisted globally as renderer state. A scene camera's clear color would leak into subsequent render passes (e.g., the camera preview pip).

**Fix:**
1. Moved `gl.setClearColor()` out of the signature-gated block so it applies every frame. The scene background (`config.colors.bgColor`) is always re-applied as baseline; camera-specific clear color only overrides for that frame.
2. `SceneCameraPreviewRenderer` now saves/restores clear color around its render pass using `gl.getClearColor()` / `gl.getClearAlpha()`. If the preview camera has its own `clearColor` userData, it applies scoped to that render only.

**Files changed:**
- `studio/src/editor/viewport/StudioViewport.tsx`

---

## Summary

| Task | Status | Changes |
|------|--------|---------|
| KAI-4787 | DONE | localStorage key migration |
| KAI-4788 | DONE | Remove DEFAULT_ARTWORK, make artworkUrl optional |
| KAI-4789 | DONE | Gate console.info with DEV check |
| KAI-4781 | DONE | Remove retry timers + reactive target prop |
| KAI-4782 | VERIFIED | Already implemented (Numpad5 + toolbar button) |
| KAI-4783 | VERIFIED | Already implemented (full inspector-to-runtime wiring) |
| KAI-4784 | VERIFIED | Already implemented (scissor+viewport clipping) |
| KAI-4785 | VERIFIED | Already implemented (camera layer mask) |
| KAI-4786 | DONE | Per-frame clear color + preview save/restore |

**Type check:** Zero new errors introduced. All errors in output are pre-existing (legacy PCUI types, OrbitControls ref generic, JSX intrinsics).
