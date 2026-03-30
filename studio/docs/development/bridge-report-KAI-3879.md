# KAI-3879 — R3F Component Bridge Report

## Scope

This change extends `studio/src/editor/adapter/observer-r3f-bridge.ts` so the R3F viewport reacts to all previously unbridged component families covered by KAI-3879. The bridge now persists component payloads on the Three.js object, rehydrates them during rebuild/load, and runs per-frame updaters for animation and particles.

## Mapper Files

- `studio/src/editor/adapter/animation-mapper.ts`
  Handles legacy animation component data, loads GLTF animation clips, creates a `THREE.AnimationMixer`, mirrors play state into the viewport, and shows an `ANIM` label.
- `studio/src/editor/adapter/anim-mapper.ts`
  Handles anim state-graph playback at a basic level by loading assigned clips, following the active/default state, driving a `THREE.AnimationMixer`, and showing a `STATE` label.
- `studio/src/editor/adapter/sound-mapper.ts`
  Handles positional vs non-positional sound, per-slot audio buffers, volume/pitch/distance properties, autoplay/loop, and adds a speaker helper sphere plus `SOUND` label.
- `studio/src/editor/adapter/audiolistener-mapper.ts`
  Handles the audio-listener component, attaches a shared `THREE.AudioListener` to the active R3F camera, enforces a single active owner, and adds a `LISTEN` label.
- `studio/src/editor/adapter/sprite-mapper.ts`
  Handles sprite asset/frame loading from atlas data, sprite tint/opacity/size/draw order, and renders a billboard `THREE.Sprite`.
- `studio/src/editor/adapter/particle-mapper.ts`
  Handles the particle-system bridge with a visible `THREE.Points` simulation, emitter shape/rate/lifetime/velocity, sampled color/scale curves, and an `FX` label.
- `studio/src/editor/adapter/gsplat-mapper.ts`
  Handles gsplat assets by loading `.ply` data into a point cloud fallback renderer, with a placeholder cloud when full splat data is unavailable, plus a `GSPLAT` label.
- `studio/src/editor/adapter/collision-mapper.ts`
  Handles visual-only collision helpers for box/sphere/cylinder/capsule/mesh, including size/axis/offset fields, rendered as green wireframes.
- `studio/src/editor/adapter/rigidbody-mapper.ts`
  Handles rigidbody property storage in `object.userData.rigidbody` and shows a gravity arrow for dynamic bodies.
- `studio/src/editor/adapter/element-mapper.ts`
  Handles UI element rendering for text/image/group modes, text canvas sprites, texture/sprite assets, size/color/opacity/pivot, and draws a bounding rectangle.
- `studio/src/editor/adapter/screen-mapper.ts`
  Handles screen-space bounds using the reference resolution and renders a cyan wireframe screen rectangle.
- `studio/src/editor/adapter/button-mapper.ts`
  Handles button state storage and overlays a colored border based on active/hover/inactive tint state.
- `studio/src/editor/adapter/layoutgroup-mapper.ts`
  Handles layout-group storage and renders a dashed layout boundary with orientation labeling.
- `studio/src/editor/adapter/layoutchild-mapper.ts`
  Handles layout-child storage and renders a dashed child-boundary helper sized from min width/height.
- `studio/src/editor/adapter/scrollview-mapper.ts`
  Handles both `scrollview` and `scrollbar` data, renders a scroll container boundary, direction arrows, and a scrollbar-handle indicator.
- `studio/src/editor/adapter/script-mapper.ts`
  Handles script component storage only, with no runtime execution, and renders an `S` badge showing script count.
- `studio/src/editor/adapter/zone-mapper.ts`
  Handles zone size data and renders a yellow wireframe volume.
- `studio/src/editor/adapter/model-mapper.ts`
  Handles legacy model-component storage, mirrors enabled/cast/receive-shadow behavior into the mesh, and keeps model payloads available for render-path redirection.

## Observer Bridge Changes

- `observer-r3f-bridge.ts` now routes render, light, camera, animation, anim, sound, audiolistener, sprite, particlesystem, gsplat, collision, rigidbody, element, screen, button, layoutgroup, layoutchild, scrollview, scrollbar, script, zone, and model paths.
- The bridge now keeps component snapshots on each Three.js object, merges them into rebuild/save flows, reapplies them after scene load, and runs per-frame bridge updaters.
- Audio camera state is synchronized through a shared bridge audio module so sound and audiolistener helpers target the active R3F camera.

## No-Equivalent Notes

Where a PlayCanvas property has no stable Three.js equivalent in the current bridge, the mapper includes a `No Three.js equivalent` comment and stores the raw component data without inventing a fake runtime behavior.

## Verification

- `npm run build` in `studio/` — PASS
- `npm test` in `studio/` — PASS (`157 passing`)
