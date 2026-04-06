# Studio Production Readiness Audit — Full Report

**Date:** 2026-04-05T20:19Z
**Agent:** Kai (Claude Opus 4.6, CLI, 1M context)
**Session:** Session 43 (KAI-4398)
**Trigger:** Dan's directive to run a thorough audit of Studio production readiness

---

## Audit Scope

Checked against `studio/docs/development/audit-spec.md` (507 lines, 4 layers).
Read all Session 43 briefs (43.1–43.18), summaries (43.2, 43.3), and the actual source code.

Questions answered:
1. Is the pipeline for loading, exporting, importing in correct format working?
2. Is capturing scene models working?
3. Is the studio fully agnostic of scenes, setups, models (nothing hardcoded)?
4. Is it free of PlayCanvas code, UI, and logic?
5. Is it working directly with EffectViewer in R3F?
6. Is everything finished — production-ready?

---

## L3 Code Health — ALL 13 CHECKS PASS

| # | Check | Result |
|---|-------|--------|
| 1 | No `from 'playcanvas'` in editor/common (excl compat) | 0 hits — PASS |
| 2 | No `from 'playcanvas'` in viewport (excl engine) | 0 hits — PASS |
| 3 | playcanvas-compat.ts reads from globalThis.pc | Confirmed — PASS |
| 4 | viewport-engine.ts exports from compat | Confirmed — PASS |
| 5 | No `import.*from 'playcanvas'` in src/ | 0 hits — PASS |
| 6 | src/launch/ deleted | Not found — PASS |
| 7 | src/editor/expose.ts deleted | Not found — PASS |
| 8 | vendor/playcanvas/playcanvas.js exists | Found — PASS |
| 9 | No playcanvas npm dependency | Not in deps — PASS |
| 10 | No PlayCanvas branding in src/sass | Only @playcanvas scoped packages — PASS |
| 11 | No hardcoded localhost in src/ | 0 hits — PASS |
| 12 | No console.log in adapter/ | 0 hits — PASS |
| 13 | No window.pc/globalThis.pc outside compat | 0 hits — PASS |

---

## Section 1: File Pipeline (Save / Load / Export / Import)

**Verdict: WORKING — production-grade pipeline.**

### Save/Export (onemo-serialize.ts, 377 lines)
- ZIP-based .onemo format: scene.glb + studio.json + optional environment.hdr
- GLTFExporter handles geometry, materials, lights, cameras, animations
- Material overrides capture properties GLTFExporter can't export (anisotropy, normalScale, etc.)
- Editor camera state preserved (position, target, fov, near, far)
- Product config (material roles, artwork slots) preserved
- Environment settings (HDR, intensity, rotation, ground) preserved
- Bridge artifacts suspended during export (clean GLB)

### Load/Import (onemo-deserialize.ts, 475 lines)
- ZIP extraction → GLTFLoader → HDR/EXR with PMREM
- studio.json normalization with safe defaults for every field
- Scene settings application (background, fog, ambient)
- Material overrides re-application
- Renderer settings restoration

### Scene Management API
- RESTful: GET /api/onemo/scenes (list), GET /api/onemo/scenes/{name} (load), POST (save)

### Gaps
- Scene picker uses window.prompt() — not production UX
- Template fallback hardcodes "golden" scene name
- No file upload/import dialog or drag-and-drop .onemo
- No "New Scene" workflow beyond template loading

---

## Section 2: Model/Scene Agnosticism

**Verdict: FORMAT IS AGNOSTIC — some hardcoded defaults remain.**

### What IS agnostic
- OnemoProductConfig.productType is an open string
- OnemoMaterialRole.role uses string + glob patterns
- Scene contains arbitrary Three.js object graph via GLB
- Serialize/deserialize handles any Three.js scene

### Hardcoded values found

| Item | Location | Issue |
|------|----------|-------|
| `/assets/test-artwork.png` | StudioViewport.tsx:12, effect-viewer-mount.tsx:31 | Hardcoded test artwork default |
| `onemo.playcanvas.last-scene` | effect-viewer-mount.tsx:32 | "playcanvas" in localStorage key |
| `onemo.playcanvas.grid-divisions` | effect-viewer-mount.tsx:35 | "playcanvas" in localStorage key |
| `golden` template name | effect-viewer-mount.tsx:597 | Template fallback loads named scene |
| `untitled-scene` product type | onemo-format.ts:293 | Reasonable default (not an issue) |

---

## Section 3: PlayCanvas Dependence

**Verdict: NOT FREE — by design. Dual architecture is correct.**

### Fully removed
- No direct `from 'playcanvas'` imports
- No `window.pc` outside compat shim
- No engine npm dependency
- Launch dir and expose.ts deleted

### Retained by design

| Dependency | Purpose | Removable? |
|-----------|---------|------------|
| @playcanvas/observer | Reactive state management (data model) | No |
| @playcanvas/pcui | All editor UI panels | No |
| @playcanvas/pcui-graph | Animation state graph UI | No |
| vendor/playcanvas.js | Inspector schemas, gizmo helpers | Partially |
| playcanvas-compat.ts | globalThis.pc shim | Needed |

### Architecture
- PC Observer + PCUI = editor shell (panels, data binding, undo/redo)
- R3F/Three.js = rendering viewport
- Bridge (observer-r3f-bridge.ts, 43K tokens) = translation layer

---

## Section 4: R3F / EffectViewer Integration

**Verdict: WORKING — wraps golden EffectViewer with full bridge.**

### StudioViewport.tsx wraps EffectViewer
- OrbitControls, TransformControls, GizmoHelper, GizmoViewcube (drei)
- Camera with perspective/orthographic switching (PR #147)
- Render pass debug modes (albedo, normals, metalness, etc.)
- Grid with toggle, material drag-to-viewport, focus on selection

### All 22 component mappers are REAL implementations
- render, light, camera, material — fully functional
- collision, rigidbody — wireframe/arrow helpers
- anim, animation — AnimationMixer integration
- sound, audiolistener — Web Audio API
- particle — full particle system
- element, sprite, screen, gsplat, button, layoutgroup, layoutchild, scrollview, zone, script, model — all produce Three.js visuals

### Material mapper gaps (documented)
~20 PC-specific properties in NO_THREE_EQUIVALENT_PATHS — silently skipped (no Three.js equivalent).

### Prototype monorepo coupling
5 files import from `../../../../src/app/(dev)/prototype/`:
- EffectViewerBridge type
- ViewerConfig, ViewerMaterialRole, DesignState types
- The actual EffectViewer component

Studio CANNOT be deployed independently.

---

## Section 5: Production Readiness Blockers

### Critical
1. **Prototype monorepo coupling** — 5 files import from prototype dir. Studio can't be packaged independently.
2. **Scene management UX** — window.prompt() picker. No file upload. No "New Scene" flow.

### Important
3. **Camera/viewport bugs** — orbit drift, frustum culling, layers, viewport rect still may have issues (Brief 43.18 partially fixed by PR #146, #147).
4. **Branding cleanup** — "playcanvas" in localStorage keys.
5. **Hardcoded defaults** — test artwork path, golden template name.

### By Design (architecture)
6. PC Observer + PCUI dependency is structural and correct.

---

## Component Bridge Coverage Map

| Mapper | Status | Notes |
|--------|--------|-------|
| render-mapper.ts | REAL | mesh.visible, castShadow, receiveShadow |
| light-mapper.ts | REAL | All light types, shadows, decay |
| camera-mapper.ts | REAL | Full projection, clipping |
| material-mapper.ts | PARTIAL | Extensive, but ~20 PC paths skipped |
| collision-mapper.ts | REAL | Wireframe geometries |
| rigidbody-mapper.ts | REAL | Arrow helpers, userData |
| anim-mapper.ts | REAL | AnimationMixer, clips |
| animation-mapper.ts | REAL | AnimationMixer, async loading |
| sound-mapper.ts | REAL | THREE.Audio/PositionalAudio |
| audiolistener-mapper.ts | REAL | AudioListener management |
| particle-mapper.ts | REAL | Full particle system |
| element-mapper.ts | REAL | Textures, sprites, materials |
| sprite-mapper.ts | REAL | SpriteMaterial, frames |
| screen-mapper.ts | REAL | Rectangle outline helpers |
| gsplat-mapper.ts | REAL | PLY geometry, vertex colors |
| button-mapper.ts | REAL | Rectangle outline, tint |
| layoutgroup-mapper.ts | REAL | Rectangle outline, labels |
| layoutchild-mapper.ts | REAL | Rectangle outline, labels |
| scrollview-mapper.ts | REAL | Rectangle outline, labels |
| zone-mapper.ts | REAL | Wireframe box helper |
| script-mapper.ts | REAL | Label sprites |
| model-mapper.ts | REAL | Visibility, shadows, labels |
