# Studio Architectural Decisions

References to decisions that shape the studio's architecture. Full decision text lives in the brain decision vault (`kai-solo-brain/3-knowledge/decisions/universal-decisions.md`) and the SSOT ADR folder (`onemo-ssot-global/10-adr/`).

## DEC S42-SCENE: Three.js scene graph is the canonical scene format (2026-03-30)

**Source:** Brief 37.91, Reflection 37.78, ADR 10.3
**Impact:** Defines the entire scene pipeline

Three.js scene graph is the single source of truth for all scene data. One format, no conversion between studio and user viewer. PlayCanvas fork = UI shell only — it reads from and writes to Three.js objects but does not own scene data.

- Scene format: `.onemo` file (GLB + studio.json sidecar in ZIP)
- Studio saves → .onemo → same file loads in user viewer
- No translation layer between formats
- ViewerConfig (face/back/frame material mapping) becomes a product-level view on top of the scene format

## DEC S37-CONFIGURATOR-FIRST: Configurator IS the product page (2026-03-26)

**Source:** Session 37, ADR 10.2
**Impact:** The studio exists to produce templates for the configurator

The configurator is not a secondary experience — it IS the product page. The studio is the authoring tool that produces the templates the configurator consumes.

## DEC S37-MOBILE: Mobile-first single design (2026-03-26)

**Source:** Session 37, ADR 10.2
**Impact:** The user viewer/configurator is mobile-first

The studio is desktop (editor with side panels). The configurator is mobile-first (same layout on all screens). This affects how the `.onemo` template renders — the viewer must work on mobile Safari.

## Format Research Outcome (2026-03-30)

**Source:** Reflection 37.78, research file `brain/3-knowledge/research/2026-03-30-3d-scene-file-format-comparison.md`

Evaluated 7 formats: glTF/GLB, Three.js JSON, USD, FBX, OBJ, USDZ, 3DM. No single format stores the complete Three.js rendering state.

**Result:** GLB (binary glTF) for scene graph + studio.json sidecar for renderer settings. GLB handles ~90% (geometry, PBR materials via 15+ KHR extensions, lights, cameras, animations). Studio.json handles the remaining ~10% (renderer settings, environment, fog, background, product config).

**Eliminated:** USD (immature Three.js loader), FBX (no exporter), OBJ (no PBR), 3DM (NURBS niche), Three.js JSON (no binary option, no external tool interop).

## Two-Layer Architecture (2026-03-30)

**Source:** Brief 37.91, Reflection 37.79

**Layer 1 — Templates (.onemo files):** Complete 3D scene. One per product type. Created in studio. Stored on CDN.

**Layer 2 — User configurations (database JSON):** Lightweight overrides (colors, artwork). Stored as database rows. References a template. Does NOT duplicate 3D data.

This separation means: one template, millions of user configurations. The template is heavy (3D model, materials, environment). The configs are tiny (color hex codes, artwork URL).

## PlayCanvas Fork = UI Shell (2026-03-27)

The PlayCanvas Editor was forked for its editor UI capabilities (hierarchy panel, inspector forms with data-binding, asset browser, toolbar, gizmo system, undo/redo). The PlayCanvas rendering engine is hidden — replaced by Three.js/R3F.

The bridge (23 mapper files in `src/editor/adapter/`) translates between PlayCanvas observer patterns and Three.js objects. PlayCanvas observers populate the UI. Three.js objects render the scene. The bridge keeps them in sync.
